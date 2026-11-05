"""Headless, isolated prototype checks. Does not access the live application."""
import json
import tempfile
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
SHOTS = Path(tempfile.mkdtemp(prefix='swiss-study-', dir=ROOT.parents[1] / 'screenshots'))
checks, failures, errors, requests = [], [], [], []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(reduced_motion='reduce')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: requests.append(request.url) if request.url.startswith('http') else None)
    for width in [320, 390, 768, 1024, 1440]:
        page.set_viewport_size({'width': width, 'height': 1000})
        page.goto((ROOT / 'index.html').as_uri())
        page.evaluate('()=>document.fonts.ready')
        for view in ['overview', 'financial', 'location', 'time', 'health']:
            page.locator(f'.main-nav [data-view="{view}"]').click()
            page.wait_for_function('(view)=>document.body.dataset.view===view', arg=view)
            assert page.locator('.view:visible').count() == 1
            assert page.locator(f'.main-nav [data-view="{view}"][aria-current="page"]').count() == 1
            overflow = page.evaluate('()=>document.documentElement.scrollWidth>innerWidth+1')
            if overflow:
                elements = page.evaluate('()=>[...document.querySelectorAll("body *")].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().right>innerWidth+1).slice(0,6).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right}))')
                failures.append({'width': width, 'view': view, 'issue': 'overflow', 'elements': elements})
            else:
                checks.append(f'{width}px {view}: navigation and layout')
            if width in [390, 1440]:
                page.screenshot(path=str(SHOTS / f'{view}-{width}.png'), full_page=True)
        assert page.locator('.study-strip').is_visible()
        buttons = page.locator('.main-nav a').evaluate_all('(links)=>links.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))')
        assert all(button['w'] >= 44 and button['h'] >= 44 for button in buttons)
        checks.append(f'{width}px: all freedom navigation targets are at least 44px')

        page.locator('.main-nav [data-view="financial"]').click()
        page.wait_for_function('()=>document.body.dataset.view==="financial"')
        page.get_by_role('button', name='4 MONTHS', exact=True).click()
        assert page.locator('#worth-labels text').count() == 4
        assert 'JUL' in page.locator('#chart-period').inner_text()
        page.get_by_role('button', name='8 MONTHS', exact=True).click()
        assert page.locator('#worth-labels text').count() == 8
        checks.append(f'{width}px: chart range updates labels, data, and accessible description')

        trigger = page.locator('#financial [data-open="balance-dialog"]')
        trigger.click()
        dialog = page.locator('#balance-dialog')
        assert dialog.is_visible()
        assert page.evaluate('()=>document.activeElement.closest("dialog")?.id==="balance-dialog"')
        assert not dialog.locator('form').evaluate('(form)=>form.checkValidity()')
        dialog.get_by_role('button', name='PREVIEW ENTRY').click()
        assert dialog.is_visible()
        dialog.locator('select').select_option(label='Brokerage')
        dialog.locator('[name="balance"]').fill('123.45')
        dialog.locator('[name="note"]').fill('Synthetic QA entry')
        if width in [390, 1440]:
            page.screenshot(path=str(SHOTS / f'balance-dialog-{width}.png'), full_page=True)
        assert not dialog.evaluate('(el)=>el.scrollWidth>el.clientWidth+1')
        dialog.get_by_role('button', name='PREVIEW ENTRY').click()
        page.wait_for_function('()=>!document.getElementById("balance-dialog").open')
        page.wait_for_function('()=>document.querySelector("#balance-dialog [name=balance]").value===""')
        assert page.locator('#preview-status').is_visible()
        page.get_by_role('button', name='Dismiss preview confirmation').click()
        assert trigger.evaluate('(el)=>el===document.activeElement')
        checks.append(f'{width}px: form validation, no-save confirmation, clearing, and focus return')

        page.locator('.main-nav [data-view="health"]').click()
        page.wait_for_function('()=>document.body.dataset.view==="health"')
        page.locator('#health [data-open="checkin-dialog"]').first.click()
        page.locator('#checkin-dialog textarea').fill('Synthetic unsaved note')
        page.keyboard.press('Escape')
        page.wait_for_function('()=>!document.getElementById("checkin-dialog").open')
        page.wait_for_function('()=>document.querySelector("#checkin-dialog textarea").value===""')
        checks.append(f'{width}px: Escape closes and clears the check-in preview')

    page.locator('.main-nav [data-view="location"]').focus()
    page.keyboard.press('Enter')
    page.wait_for_function('()=>document.body.dataset.view==="location"')
    assert page.evaluate('()=>document.activeElement.id==="location-title"')
    checks.append('Keyboard navigation focuses the selected view heading')
    assert page.evaluate('()=>localStorage.length===0&&sessionStorage.length===0')
    checks.append('No local or session storage writes')
    duplicate_ids = page.evaluate('()=>{const ids=[...document.querySelectorAll("[id]")].map(el=>el.id);return ids.filter((id,i)=>ids.indexOf(id)!==i)}')
    assert not duplicate_ids
    checks.append('Unique element IDs')
    fonts = page.evaluate('()=>[...document.fonts].filter(font=>font.family.includes("Inter")).map(font=>({weight:font.weight,status:font.status}))')
    assert not errors
    assert all(urlparse(url).hostname in ['fonts.googleapis.com', 'fonts.gstatic.com'] for url in requests)
    checks.append('No JavaScript errors; network requests limited to Google Fonts')
    browser.close()

result = {'passed': len(checks), 'failures': failures, 'checks': checks, 'javascriptErrors': errors,
          'fontStatus': fonts, 'externalHosts': sorted(set(urlparse(url).hostname for url in requests)),
          'screenshots': str(SHOTS), 'scope': 'Standalone sample-data prototype, not the live application'}
(SHOTS / 'results.json').write_text(json.dumps(result, indent=2))
print(json.dumps({key: value for key, value in result.items() if key != 'checks'}, indent=2))
if failures:
    raise SystemExit(1)
