"""Headless checks against actual UI with synthetic, disconnected data adapters."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(sys.argv[1]).resolve()
coverage = json.loads((ROOT / 'coverage.json').read_text())
checks, failures, errors, requests = [], [], [], []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(reduced_motion='reduce')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: requests.append(request.url) if request.url.startswith('http') else None)
    for width in ([] if '--interactions-only' in sys.argv else [320, 390, 768, 1440]):
        page.set_viewport_size({'width': width, 'height': 1000})
        for theme in ['light', 'dark']:
            for item in coverage:
                if item['status'] != 'rendered':
                    continue
                page.goto((ROOT / item['file']).as_uri())
                page.evaluate('(theme)=>document.documentElement.className=theme', theme)
                page.evaluate('()=>document.fonts.ready')
                if page.evaluate('()=>document.documentElement.scrollWidth>innerWidth+1'):
                    elements = page.evaluate('()=>[...document.querySelectorAll("body *")].filter(el=>el.getClientRects().length&&el.getBoundingClientRect().right>innerWidth+1&&!el.closest(".daybreak-table, [class*=overflow-x-auto]")).slice(0,8).map(el=>({tag:el.tagName,class:el.className,right:Math.round(el.getBoundingClientRect().right)}))')
                    failures.append({'width': width, 'theme': theme, 'route': item['route'], 'issue': 'horizontal overflow', 'elements': elements})
                else:
                    checks.append(f'{width}px {theme} {item["route"]}: fits viewport')
                if page.locator('.daybreak-blade').count():
                    sizes = page.locator('.daybreak-blade').evaluate_all('(links)=>links.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))')
                    if not all(size['w'] >= 44 and size['h'] >= 44 for size in sizes):
                        failures.append({'width': width, 'route': item['route'], 'issue': 'blade target smaller than 44px'})
                if width in [390, 1440] and item['route'] in ['/dashboard', '/financial/overview', '/financial/accounts', '/financial/wealth', '/health/overview', '/time/agenda?view=week', '/settings', '/login']:
                    page.screenshot(path=str(ROOT / f'{Path(item["file"]).stem}-{width}-{theme}.png'), full_page=True)

    (ROOT / 'layout-results.json').write_text(json.dumps({'passed': len(checks), 'failures': failures}, indent=2))
    for width in [390, 1440]:
        page.set_viewport_size({'width': width, 'height': 1000})
        page.goto((ROOT / 'lab.html').as_uri())
        page.get_by_role('button', name='Reduce glass').click()
        assert page.evaluate('()=>document.documentElement.dataset.glass==="solid"&&localStorage.getItem("freedom-four-glass")==="solid"')
        assert page.locator('.daybreak-shell').evaluate('(e)=>getComputedStyle(e).backdropFilter') == 'none'
        page.get_by_role('button', name='Restore glass').click()
        page.get_by_role('button', name='Switch to dark mode').click()
        assert page.evaluate('()=>document.documentElement.classList.contains("dark")&&localStorage.getItem("freedom-four-theme")==="dark"')
        page.get_by_role('button', name='Reduce glass').click()
        page.reload()
        assert page.evaluate('()=>document.documentElement.classList.contains("dark")&&document.documentElement.dataset.glass==="solid"')
        page.get_by_role('button', name='Restore glass').click()
        page.get_by_role('button', name='Switch to light mode').click()
        checks.append(f'{width}px: appearance controls and persistence')

        blade = page.locator('.daybreak-blade').first
        blade.focus()
        page.keyboard.press('ArrowRight')
        page.wait_for_function('()=>globalThis.__qaPath==="/financial/overview"')
        assert page.locator('.daybreak-blade[aria-current="page"]').inner_text().startswith('Financial')
        page.keyboard.press('ArrowLeft')
        page.wait_for_function('()=>globalThis.__qaPath==="/dashboard"')
        checks.append(f'{width}px: blade arrows navigate and update selection')

        opener = page.get_by_role('button', name='Open account dialog')
        opener.click()
        dialog = page.get_by_role('dialog')
        assert dialog.is_visible()
        assert page.evaluate('()=>document.activeElement.closest("[role=dialog]")!==null')
        for _ in range(12):
            page.keyboard.press('Tab')
            assert page.evaluate('()=>document.activeElement.closest("[role=dialog]")!==null')
        for _ in range(8):
            page.keyboard.press('Shift+Tab')
            assert page.evaluate('()=>document.activeElement.closest("[role=dialog]")!==null')
        page.keyboard.press('Escape')
        expect(dialog).to_have_count(0)
        expect(opener).to_be_focused()
        checks.append(f'{width}px: Radix modal traps and returns focus')

        opener.click()
        dialog = page.get_by_role('dialog')
        assert not dialog.locator('form').filter(has=page.locator('[name="name"]')).evaluate('(form)=>form.checkValidity()')
        dialog.locator('[name="name"]').fill('Reject')
        dialog.get_by_role('button', name='Add account', exact=True).click()
        page.get_by_text('Synthetic validation error').wait_for()
        dialog.locator('[name="name"]').fill('Synthetic account')
        dialog.get_by_role('button', name='Add account', exact=True).click()
        page.wait_for_function('()=>!document.querySelector("[role=dialog]")')
        assert page.get_by_label('Saved count').inner_text() == '1'
        checks.append(f'{width}px: real account form validation, error, and success with mocked actions')

        opener.click()
        dialog.locator('[name="name"]').fill('Pending')
        dialog.get_by_role('button', name='Add account', exact=True).click()
        pending = dialog.get_by_role('button', name='Adding…', exact=True)
        pending.wait_for()
        assert pending.is_disabled()
        page.evaluate('()=>globalThis.__qaResolveAction()')
        page.wait_for_function('()=>!document.querySelector("[role=dialog]")')
        checks.append(f'{width}px: pending action disables duplicate submission')

        menu_trigger = page.get_by_role('button', name='Sample row actions')
        menu_trigger.focus()
        page.keyboard.press('ArrowDown')
        menu = page.get_by_role('menu')
        expect(menu).to_be_visible()
        expect(page.get_by_role('menuitem', name='Edit sample')).to_be_focused()
        box = menu.bounding_box()
        assert box['x'] >= 0 and box['x'] + box['width'] <= width
        page.keyboard.press('ArrowDown')
        expect(page.get_by_role('menuitem', name='Close menu')).to_be_focused()
        page.keyboard.press('Escape')
        expect(menu).to_have_count(0)
        expect(menu_trigger).to_be_focused()
        checks.append(f'{width}px: menu escapes clipped ancestor and supports keyboard dismissal')

        date = page.locator('#field-test input[type=text]').first
        date.fill('not a date')
        assert not date.evaluate('(e)=>e.checkValidity()')
        date.fill('10/16/2026')
        page.keyboard.press('Tab')
        assert page.locator('#field-test [name=date]').input_value() == '2026-10-16'
        date.focus()
        page.keyboard.press('Escape')
        assert page.locator('.daybreak-date-popover').count() == 0
        amount = page.get_by_label('Sample amount')
        amount.fill('2345.67')
        page.keyboard.press('Tab')
        assert page.locator('[name=amount]').input_value() == '2345.67'
        checks.append(f'{width}px: date parsing and money input preserve submitted values')

        page.get_by_role('button', name='Delete', exact=True).click()
        page.get_by_role('button', name='Cancel', exact=True).click()
        assert page.get_by_label('Deleted count').inner_text() == '0'
        page.get_by_role('button', name='Delete', exact=True).click()
        page.get_by_role('button', name='Delete?', exact=True).click()
        page.wait_for_function("(el)=>el.textContent==='1'", arg=page.get_by_label('Deleted count').element_handle())
        checks.append(f'{width}px: destructive action requires confirmation, with a mocked action only')

        for theme in ['light', 'dark']:
            page.evaluate('(theme)=>document.documentElement.className=theme', theme)
            opener.click()
            page.screenshot(path=str(ROOT / f'dialog-{width}-{theme}.png'), full_page=True)
            assert not page.get_by_role('dialog').evaluate('(e)=>e.scrollWidth>e.clientWidth+1')
            page.keyboard.press('Escape')

        for kind in ['sleep', 'Check-in', 'workout', 'body']:
            page.get_by_role('button', name=kind, exact=True).click()
            assert page.get_by_role('button', name=kind, exact=True).get_attribute('aria-pressed') == 'true'
            assert not page.evaluate('()=>document.documentElement.scrollWidth>innerWidth+1')
        checks.append(f'{width}px: all four health entry forms fit and switch correctly')

    if '--interactions-only' not in sys.argv:
        page.set_viewport_size({'width': 1440, 'height': 1000})
        for item in coverage:
            page.goto((ROOT / item['file']).as_uri())
            page.add_style_tag(content='html {font-size: 200% !important} body {font-size: 28px !important}')
            if page.evaluate('()=>document.documentElement.scrollWidth>innerWidth+1'):
                failures.append({'route': item['route'], 'issue': '200% text resize overflow'})
            else:
                checks.append(f'{item["file"]}: 200% text resize fits viewport')

    page.goto((ROOT / 'lab.html').as_uri())
    session = context.new_cdp_session(page)
    session.send('Emulation.setEmulatedMedia', {'features': [
        {'name': 'prefers-reduced-transparency', 'value': 'reduce'},
        {'name': 'prefers-reduced-motion', 'value': 'reduce'},
    ]})
    page.evaluate('()=>{localStorage.removeItem("freedom-four-glass");delete document.documentElement.dataset.glass}')
    assert page.evaluate('()=>matchMedia("(prefers-reduced-transparency: reduce)").matches')
    assert page.locator('.daybreak-shell').evaluate('(e)=>getComputedStyle(e).backdropFilter') == 'none'
    assert page.locator('.daybreak-button').first.evaluate('(e)=>getComputedStyle(e).transitionDuration') == '0s'
    checks.append('System reduced transparency and motion remove blur and transitions')

    page.emulate_media(forced_colors='active')
    assert page.locator('.daybreak-scene').evaluate('(e)=>getComputedStyle(e).display') == 'none'
    checks.append('Forced colors removes decorative background')
    page.goto((ROOT / 'review-this-week.html').as_uri())
    page.evaluate('()=>document.documentElement.className="dark"')
    page.emulate_media(media='print', forced_colors='none')
    assert page.locator('html').evaluate('(e)=>getComputedStyle(e).colorScheme') == 'light'
    assert page.locator('.daybreak-sidebar').evaluate('(e)=>getComputedStyle(e).display') == 'none'
    assert page.locator('.daybreak-scene').evaluate('(e)=>getComputedStyle(e).display') == 'none'
    assert page.locator('h1').is_visible()
    page.screenshot(path=str(ROOT / 'review-print.png'), full_page=True)
    checks.append('Weekly review print removes navigation and background, including from dark mode')
    assert not errors, errors
    assert not requests, requests
    checks.append('No JavaScript errors or external network requests in isolated fixtures')
    browser.close()

result = {'passed': len(checks), 'failures': failures, 'checks': checks, 'javascriptErrors': errors, 'externalRequests': requests, 'scope': 'Actual components with synthetic data and mocked actions, not authenticated end-to-end coverage'}
(ROOT / 'results.json').write_text(json.dumps(result, indent=2))
print(json.dumps({key:value for key,value in result.items() if key!='checks'}, indent=2))
if failures:
    raise SystemExit(1)
