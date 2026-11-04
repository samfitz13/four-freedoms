"""Verify attention visibility and the open stats tray using synthetic render fixtures."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(sys.argv[1]).resolve()
checks = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(reduced_motion='reduce')
    for width in [320, 390, 768, 1440]:
        page.set_viewport_size({'width': width, 'height': 1000})
        for theme in ['light', 'dark']:
            for state in ['clear', 'empty', 'review', 'missing']:
                page.goto((root / f'financial-tab-overview-qa-attention-{state}.html').as_uri())
                page.evaluate('(theme)=>document.documentElement.className=theme', theme)
                page.evaluate('()=>document.fonts.ready')
                expected = state in ['review', 'missing']
                assert page.get_by_role('heading', name='Needs attention', exact=True).count() == int(expected)
                notes = page.get_by_role('heading', name='Board notes', exact=True).locator('..')
                assert notes.is_visible()
                if not expected:
                    assert notes.locator('..').evaluate('(e)=>getComputedStyle(e).gridTemplateColumns.split(" ").length') == 1
                else:
                    title = 'FI assumptions missing' if state == 'review' else 'Closed statement missing'
                    assert page.get_by_role('link', name=title, exact=False).is_visible()
                tray = page.locator('dl.daybreak-kpis')
                assert tray.locator(':scope > div > dt').count() == 5
                assert tray.locator(':scope > div > dd').count() == 5
                assert tray.locator(':scope > div').evaluate_all('(items)=>items.every(e=>{const s=getComputedStyle(e);return parseFloat(s.borderLeftWidth)===0&&parseFloat(s.paddingLeft)===0})')
                assert tray.evaluate('(e)=>parseFloat(getComputedStyle(e).rowGap)===28')
                assert tray.locator(':scope > div > dd').evaluate_all('(items)=>items.every(e=>getComputedStyle(e).justifyContent!=="space-between"&&parseFloat(getComputedStyle(e).rowGap)===8)')
                assert '$248,600' in tray.inner_text()
                assert not page.evaluate('()=>document.documentElement.scrollWidth>innerWidth+1')
                assert page.locator('.daybreak-shell-footer').count() == 0
                assert page.get_by_text('Read the verdict first', exact=False).count() == 0
                assert page.get_by_text('Keyboard shortcuts', exact=True).count() == 0
                if state == 'clear' and width in [390, 1440]:
                    tray.screenshot(path=str(root / f'open-stats-{width}-{theme}.png'))
                if width == 1440:
                    page.add_style_tag(content='html {font-size: 200% !important} body {font-size: 28px !important}')
                    assert not page.evaluate('()=>document.documentElement.scrollWidth>innerWidth+1')
                checks.append(f'{width}px {theme} {state}: visibility, no empty column, borderless metrics, values preserved, responsive layout')
    browser.close()
(root / 'financial-overview-results.json').write_text(json.dumps({'passed': len(checks), 'checks': checks}, indent=2))
print(json.dumps({'passed': len(checks), 'scope': 'Actual financial overview with synthetic data, not authenticated E2E'}))
