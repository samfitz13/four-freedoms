"""Sample text against rendered glass. Not a complete accessibility audit."""
import json
import re
import tempfile
from io import BytesIO
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
OUTPUT = Path(tempfile.mkdtemp(prefix='daybreak-contrast-', dir=ROOT.parents[1] / 'screenshots'))


def luminance(color):
    channels = [n / 255 for n in color]
    channels = [n / 12.92 if n <= .04045 else ((n + .055) / 1.055) ** 2.4 for n in channels]
    return sum(a * b for a, b in zip(channels, [.2126, .7152, .0722]))


def contrast(a, b):
    low, high = sorted([luminance(a), luminance(b)])
    return (high + .05) / (low + .05)


results = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(reduced_motion='reduce')
    for width in [390, 1440]:
        page.set_viewport_size({'width': width, 'height': 1500})
        page.goto((ROOT / 'index.html').as_uri())
        page.evaluate('()=>document.fonts.ready')
        for view in ['overview', 'financial', 'location', 'time', 'health']:
            page.locator(f'.blade[data-view="{view}"]').click()
            page.wait_for_function('(v)=>document.body.dataset.view===v', arg=view)
            texts = page.evaluate('''()=>[...document.querySelectorAll('body *')]
                .filter(el=>el.getClientRects().length&&!el.closest('svg, [aria-hidden="true"]')&&[...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim()))
                .map(el=>{const s=getComputedStyle(el);const clip=el.closest('.table-scroll')?.getBoundingClientRect();return {selector:el.className||el.tagName,color:s.color,size:parseFloat(s.fontSize),weight:parseInt(s.fontWeight),text:el.textContent.trim(),clip:clip?{left:clip.left,right:clip.right}:null,
                rects:[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim()).flatMap(n=>{const r=document.createRange();r.selectNode(n);return [...r.getClientRects()].map(b=>({x:b.x,y:b.y,w:b.width,h:b.height}))})}})''')
            hide = page.add_style_tag(content='* {-webkit-text-fill-color: transparent !important;}')
            image = Image.open(BytesIO(page.screenshot(full_page=True))).convert('RGB')
            hide.evaluate('(el)=>el.remove()')
            failures = []
            for text in texts:
                color = list(map(float, re.findall(r'[\d.]+', text['color'])))[:3]
                ratios = []
                for rect in text['rects']:
                    for fx in [.1, .5, .9]:
                        x, y = int(rect['x'] + rect['w'] * fx), int(rect['y'] + rect['h'] * .5)
                        if text['clip'] and not text['clip']['left'] <= x < text['clip']['right']:
                            continue
                        if 0 <= x < image.width and 0 <= y < image.height:
                            ratios.append(contrast(color, image.getpixel((x, y))))
                minimum = 3 if text['size'] >= 24 or (text['size'] >= 18.66 and text['weight'] >= 700) else 4.5
                if ratios and min(ratios) < minimum:
                    failures.append({'selector': text['selector'], 'text': text['text'], 'ratio': round(min(ratios), 2), 'required': minimum})
            results.append({'width': width, 'view': view, 'sampled': len(texts), 'failures': failures})
    browser.close()

(OUTPUT / 'results.json').write_text(json.dumps(results, indent=2))
print(json.dumps({'results': results, 'output': str(OUTPUT)}, indent=2))
if any(result['failures'] for result in results):
    raise SystemExit(1)
