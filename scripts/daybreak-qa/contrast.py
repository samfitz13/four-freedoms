"""Sample rendered HTML text over actual Daybreak surfaces, not a WCAG certification."""
import json
import sys
from io import BytesIO
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(sys.argv[1]).resolve()


def luminance(rgb):
    channels = [v / 255 for v in rgb]
    return sum((v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4) * weight
               for v, weight in zip(channels, [.2126, .7152, .0722]))


def contrast(foreground, background):
    low, high = sorted([luminance(foreground), luminance(background)])
    return (high + .05) / (low + .05)


results = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(reduced_motion='reduce')
    for width in [390, 1440]:
        page.set_viewport_size({'width': width, 'height': 1000})
        for item in json.loads((ROOT / 'coverage.json').read_text()):
            if item['status'] != 'rendered':
                raise RuntimeError('A fixture failed to render')
            page.goto((ROOT / item['file']).as_uri())
            page.evaluate('()=>document.fonts.ready')
            for theme in ['light', 'dark']:
                page.evaluate('(theme)=>document.documentElement.className=theme', theme)
                texts = page.evaluate('''() => {
                  const canvas=document.createElement('canvas'), ctx=canvas.getContext('2d');
                  canvas.width=canvas.height=1;
                  return [...document.querySelectorAll('body *')]
                    .filter(el=>el.checkVisibility()&&!el.closest('svg,[aria-hidden="true"],:disabled')&&getComputedStyle(el).visibility==='visible'&&[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))
                    .map(el=>{
                      const style=getComputedStyle(el); ctx.clearRect(0,0,1,1);ctx.fillStyle=style.color;ctx.fillRect(0,0,1,1);
                      const rgba=[...ctx.getImageData(0,0,1,1).data]; let opacity=1, left=0,right=innerWidth,top=0,bottom=document.documentElement.scrollHeight;
                      for(let parent=el;parent;parent=parent.parentElement){const s=getComputedStyle(parent),r=parent.getBoundingClientRect();opacity*=Number(s.opacity);if(['hidden','auto','scroll','clip'].includes(s.overflowX)){left=Math.max(left,r.left);right=Math.min(right,r.right)}if(['hidden','auto','scroll','clip'].includes(s.overflowY)){top=Math.max(top,r.top);bottom=Math.min(bottom,r.bottom)}}
                      return {selector:el.className||el.tagName,text:el.textContent.trim().slice(0,140),color:rgba,opacity,size:parseFloat(style.fontSize),weight:parseInt(style.fontWeight),clip:{left,right,top,bottom},rects:[...el.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).flatMap(n=>{const r=document.createRange();r.selectNode(n);return [...r.getClientRects()].map(b=>({x:b.x,y:b.y,w:b.width,h:b.height}))})};
                    });
                }''')
                hidden = page.add_style_tag(content='* {-webkit-text-fill-color: transparent !important;}')
                capture = Image.open(BytesIO(page.screenshot(full_page=True))).convert('RGB')
                hidden.evaluate('(el)=>el.remove()')
                failures = []
                sampled = 0
                for text in texts:
                    ratios = []
                    alpha = text['color'][3] / 255 * text['opacity']
                    if alpha == 0:
                        continue
                    for rect in text['rects']:
                        for fraction in [.1, .5, .9]:
                            x, y = int(rect['x'] + rect['w'] * fraction), int(rect['y'] + rect['h'] * .5)
                            clip = text['clip']
                            if not (clip['left'] <= x < clip['right'] and clip['top'] <= y < clip['bottom']):
                                continue
                            if 0 <= x < capture.width and 0 <= y < capture.height:
                                background = capture.getpixel((x, y))
                                foreground = [value * alpha + back * (1-alpha) for value, back in zip(text['color'][:3], background)]
                                ratios.append(contrast(foreground, background))
                    required = 3 if text['size'] >= 24 or (text['size'] >= 18.66 and text['weight'] >= 700) else 4.5
                    if ratios:
                        sampled += 1
                    if ratios and min(ratios) < required:
                        failures.append({'text': text['text'], 'selector': text['selector'], 'ratio': round(min(ratios), 2), 'required': required})
                results.append({'file': item['file'], 'width': width, 'theme': theme, 'sampled': sampled, 'failures': failures})
    browser.close()

(ROOT / 'contrast-results.json').write_text(json.dumps(results, indent=2))
failed = [row for row in results if row['failures']]
print(json.dumps({'surfaces': len(results), 'textSamples': sum(row['sampled'] for row in results), 'failures': failed}, indent=2))
if failed:
    raise SystemExit(1)
