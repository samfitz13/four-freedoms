"""Isolated, headless checks of synthetic Daybreak data. No live app access."""
import json
import tempfile
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
SHOTS = Path(tempfile.mkdtemp(prefix='daybreak-study-', dir=ROOT.parents[1] / 'screenshots'))
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
            page.locator(f'.blade[data-view="{view}"]').click()
            page.wait_for_function('(view)=>document.body.dataset.view===view', arg=view)
            assert page.locator('.screen:visible').count() == 1
            assert page.locator(f'.blade[data-view="{view}"][aria-current="page"]').count() == 1
            overflow = page.evaluate('()=>document.documentElement.scrollWidth>innerWidth+1')
            if overflow:
                failures.append({'width': width, 'view': view, 'issue': 'horizontal document overflow'})
            else:
                checks.append(f'{width}px {view}: navigation and layout')
            if width in [390, 1440]:
                page.screenshot(path=str(SHOTS / f'{view}-{width}.png'), full_page=True)
        sizes = page.locator('.blade').evaluate_all('(links)=>links.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))')
        assert all(size['w'] >= 44 and size['h'] >= 44 for size in sizes)
        checks.append(f'{width}px: all five blades have 44px touch targets')
        page.locator('.blade[data-view="financial"]').click()
        page.wait_for_function('()=>document.body.dataset.view==="financial"')
        page.get_by_role('button', name='4 months', exact=True).click()
        assert page.locator('#finance-graph polyline').get_attribute('points').count(' ') == 3
        assert 'July' in page.locator('#chart-foot').inner_text()
        assert 'Jul to October' in page.locator('#finance-worth-title').text_content()
        page.get_by_role('button', name='8 months', exact=True).click()
        assert page.locator('#finance-graph polyline').get_attribute('points').count(' ') == 7
        checks.append(f'{width}px: chart range updates data and accessible labels')
        opener = page.locator('#screen-financial [data-note]')
        opener.click()
        assert page.locator('#note-dialog').is_visible()
        assert page.evaluate('()=>document.activeElement.closest("dialog")?.id==="note-dialog"')
        page.get_by_role('button', name='Preview my note').click()
        assert page.locator('#note-dialog').is_visible()
        assert not page.locator('#note-form').evaluate('(form)=>form.checkValidity()')
        page.locator('#note-area').fill('Synthetic QA note, not a personal record.')
        if width in [390, 1440]:
            page.screenshot(path=str(SHOTS / f'note-{width}.png'), full_page=True)
        assert not page.locator('#note-dialog').evaluate('(el)=>el.scrollWidth>el.clientWidth+1')
        page.get_by_role('button', name='Preview my note').click()
        page.wait_for_function('()=>!document.querySelector("#note-dialog").open&&document.querySelector("#note-area").value===""')
        assert page.locator('#toast').is_visible()
        page.get_by_role('button', name='Dismiss confirmation').click()
        assert opener.evaluate('(el)=>el===document.activeElement')
        checks.append(f'{width}px: note validation, clearing, confirmation, and focus return')
        opener.click()
        page.locator('#note-area').fill('Synthetic escape test')
        page.keyboard.press('Escape')
        page.wait_for_function('()=>!document.querySelector("#note-dialog").open&&document.querySelector("#note-area").value===""')
        assert opener.evaluate('(el)=>el===document.activeElement')
        checks.append(f'{width}px: Escape clears the note and restores focus')
        page.get_by_role('button', name='Reduce glass').click()
        assert page.locator('body').evaluate('(el)=>el.classList.contains("solid-glass")')
        assert page.locator('.console').evaluate('(el)=>getComputedStyle(el).backdropFilter') == 'none'
        page.get_by_role('button', name='Restore glass').click()
        checks.append(f'{width}px: reduce-glass control changes material and state')

    page.locator('.blade[data-view="financial"]').focus()
    for key, expected in [('ArrowRight', 'location'), ('ArrowDown', 'time'), ('ArrowRight', 'health'), ('ArrowRight', 'overview'), ('ArrowLeft', 'health'), ('ArrowUp', 'time')]:
        page.keyboard.press(key)
        page.wait_for_function('(view)=>document.body.dataset.view===view&&document.activeElement.dataset.view===view', arg=expected)
    checks.append('Arrow keys preserve navigation focus and wrap in both directions')
    page.locator('.blade[data-view="location"]').focus()
    page.keyboard.press('Enter')
    page.wait_for_function('()=>document.activeElement.id==="title-location"')
    checks.append('Enter navigation moves focus to the screen heading')
    page.evaluate('()=>location.hash="overview"')
    page.wait_for_function('()=>document.body.dataset.view==="overview"')
    page.locator('.home-money').click()
    page.wait_for_function('()=>document.body.dataset.view==="financial"')
    page.go_back()
    page.wait_for_function('()=>document.body.dataset.view==="overview"')
    checks.append('Selectable home tiles and browser history navigate correctly')
    assert page.locator('.screen:visible').evaluate('(el)=>getComputedStyle(el).animationName') == 'none'
    checks.append('Reduced motion disables screen transitions')
    page.locator('.skip-link').focus()
    page.keyboard.press('Enter')
    assert page.evaluate('()=>document.activeElement.id==="workspace"')
    checks.append('Skip link focuses the workspace without switching screens')
    assert page.evaluate('()=>localStorage.length===0&&sessionStorage.length===0')
    checks.append('No local or session storage writes')
    assert not page.evaluate('()=>{const ids=[...document.querySelectorAll("[id]")].map(el=>el.id);return ids.some((id,i)=>ids.indexOf(id)!==i)}')
    checks.append('No duplicate IDs')
    page.emulate_media(forced_colors='active')
    assert page.locator('.ambient-scene').evaluate('(el)=>getComputedStyle(el).display') == 'none'
    page.emulate_media(forced_colors='none')
    checks.append('Forced-colors mode removes the photographic backdrop')
    page.emulate_media(reduced_motion='no-preference')
    page.locator('.blade[data-view="health"]').click()
    page.wait_for_function('()=>document.body.dataset.view==="health"')
    assert page.locator('#screen-health').evaluate('(el)=>getComputedStyle(el).animationName') == 'enter-blade'
    checks.append('Normal motion uses the blade transition')
    fonts = page.evaluate('()=>[...document.fonts].filter(font=>font.family.includes("Manrope")).map(font=>({weight:font.weight,status:font.status}))')
    assert not errors
    assert all(urlparse(url).hostname in ['fonts.googleapis.com', 'fonts.gstatic.com'] for url in requests)
    checks.append('No JavaScript errors; network requests limited to Google Fonts')
    browser.close()

result = {'passed': len(checks), 'failures': failures, 'checks': checks, 'javascriptErrors': errors,
          'fontStatus': fonts, 'externalHosts': sorted(set(urlparse(url).hostname for url in requests)),
          'screenshots': str(SHOTS), 'scope': 'Standalone fictional-data prototype, not the live application'}
(SHOTS / 'results.json').write_text(json.dumps(result, indent=2))
print(json.dumps({key: value for key, value in result.items() if key not in ['checks', 'fontStatus']}, indent=2))
if failures:
    raise SystemExit(1)
