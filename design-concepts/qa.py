"""Isolated, headless checks. Never attaches to a user's browser."""
import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
SHOTS = Path(tempfile.mkdtemp(prefix='design-concepts-', dir=ROOT.parent / 'screenshots'))
checks, failures, errors, remote = [], [], [], []

CONTRAST = '''() => {
  const ctx=document.createElement('canvas').getContext('2d');
  function rgba(color){ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];}
  function luminance(rgb){const c=rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*c[0]+.7152*c[1]+.0722*c[2];}
  const failures=[];
  for(const el of document.querySelectorAll('.view:not([hidden]) h1,.view:not([hidden]) .page-description,.view:not([hidden]) .panel-head .eyebrow,.view:not([hidden]) .place-feature h2,.view:not([hidden]) .place-next strong,.view:not([hidden]) .metric dt,.view:not([hidden]) .bar-number')){
    if(!el.getClientRects().length)continue;
    const style=getComputedStyle(el);let parent=el,bg;
    while(parent){bg=rgba(getComputedStyle(parent).backgroundColor);if(bg[3]===255)break;parent=parent.parentElement;}
    if(!bg||bg[3]!==255)continue;
    let fg=rgba(style.color);const opacity=Number(style.opacity)*fg[3]/255;
    fg=fg.slice(0,3).map((v,i)=>v*opacity+bg[i]*(1-opacity));
    const a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    const large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700);
    if(ratio<(large?3:4.5))failures.push({text:el.textContent.slice(0,80),ratio:ratio.toFixed(2),required:large?3:4.5});
  }return failures;
}'''

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(reduced_motion='reduce')
    context.route('http://**/*', lambda route: (remote.append(route.request.url), route.abort()))
    context.route('https://**/*', lambda route: (remote.append(route.request.url), route.abort()))
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    for file in ['a-fieldnotes.html', 'b-control-room.html', 'c-compass.html']:
        for width in [320, 390, 768, 1440]:
            page.set_viewport_size({'width': width, 'height': 1000})
            page.goto((ROOT / file).as_uri())
            page.evaluate('()=>document.fonts.ready')
            for tab in ['overview', 'financial', 'location', 'time', 'health']:
                page.locator(f'.workspace-nav a[href="#{tab}"]').click()
                page.wait_for_function('(tab)=>document.body.dataset.view===tab', arg=tab)
                assert page.locator('.view:visible').count() == 1
                assert page.locator(f'.workspace-nav a[href="#{tab}"][aria-current="page"]').count() == 1
                if page.evaluate('()=>document.documentElement.scrollWidth>innerWidth+1'):
                    failures.append({'file': file, 'width': width, 'tab': tab, 'issue': 'page overflow'})
                else:
                    checks.append(f'{file} {width}px {tab}: navigation and containment')
                if tab in ['overview', 'financial'] and width in [390, 1440]:
                    page.screenshot(path=str(SHOTS / f'{file[:-5]}-{tab}-{width}.png'), full_page=True)
                if width == 1440:
                    bad_contrast = page.evaluate(CONTRAST)
                    if bad_contrast:
                        failures.append({'file': file, 'tab': tab, 'contrast': bad_contrast})
                    else:
                        checks.append(f'{file} {tab}: representative text contrast')
            assert page.locator('.sample-note').is_visible()
        page.locator('.workspace-nav a[href="#financial"]').focus()
        page.keyboard.press('Enter')
        page.wait_for_function('()=>document.body.dataset.view==="financial"')
        assert page.evaluate('()=>document.activeElement.id==="title-financial"')
        checks.append(f'{file}: keyboard navigation moves focus to the new view')
        families = page.evaluate('()=>[...document.fonts].map(f=>f.family)')
        assert any('Geist' in family for family in families)
        if file.startswith('a-'):
            assert any('Fraunces' in family for family in families)
        duplicate = page.evaluate('()=>{const ids=[...document.querySelectorAll("[id]")].map(e=>e.id);return ids.filter((id,i)=>ids.indexOf(id)!==i)}')
        assert not duplicate
        checks.append(f'{file}: embedded fonts, unique IDs, and sample disclosure')
    for width in [320, 390, 768, 1440]:
        page.set_viewport_size({'width': width, 'height': 1000})
        page.goto((ROOT / 'index.html').as_uri())
        page.evaluate('()=>document.fonts.ready')
        assert not page.evaluate('()=>document.documentElement.scrollWidth>innerWidth+1')
        checks.append(f'Comparison page: {width}px containment')
        if width == 1440:
            page.screenshot(path=str(SHOTS / 'index-1440.png'), full_page=True)
    assert not errors and not remote
    checks.extend(['No JavaScript errors', 'No external requests'])
    browser.close()

result = {'passed': len(checks), 'failures': failures, 'checks': checks,
          'javascriptErrors': errors, 'externalRequests': remote, 'screenshots': str(SHOTS),
          'scope': 'Offline illustrative concepts only. Not authenticated app testing.'}
(SHOTS / 'results.json').write_text(json.dumps(result, indent=2))
print(json.dumps({key: value for key, value in result.items() if key != 'checks'}, indent=2))
if failures:
    raise SystemExit(1)
