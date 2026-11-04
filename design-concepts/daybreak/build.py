"""Build an HTML prototype with embedded imagery; Google Fonts loads externally."""
import base64
from pathlib import Path

ROOT = Path(__file__).parent
paths = {
    '__HOME_ICON__': '<path d="m3 11 9-8 9 8v10h-6v-7H9v7H3Z"/>',
    '__MONEY_ICON__': '<path d="M4 19V12M10 19V7M16 19V3M3 22h18"/>',
    '__PLACE_ICON__': '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
    '__TIME_ICON__': '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    '__HEALTH_ICON__': '<path d="M20 13c4-6-3-12-8-6-5-6-12 0-8 6l8 8Z"/>',
}
html = (ROOT / 'template.html').read_text()
for key, path in paths.items():
    html = html.replace(key, f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{path}</svg>')
background = base64.b64encode((ROOT / 'backdrop.webp').read_bytes()).decode()
styles = '\n'.join((ROOT / name).read_text() for name in ['styles.css', 'responsive.css'])
styles = styles.replace('__BACKGROUND__', 'data:image/webp;base64,' + background)
html = html.replace('__STYLES__', styles).replace('__SCRIPT__', (ROOT / 'app.js').read_text())
target = ROOT / 'index.html'
if target.exists() and 'Daybreak / freedom-four concept' not in target.read_text():
    raise ValueError('Refusing to replace an unrelated file')
target.write_text(html)
print(f'Built {target} ({len(html):,} characters)')
