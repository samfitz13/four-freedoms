"""Generate the Swiss HTML study. No application or financial data access."""
from pathlib import Path

ROOT = Path(__file__).parent
week = []
for day, hours in [('MON', 3.5), ('TUE', 2), ('WED', 4), ('THU', 1.5), ('FRI', 3)]:
    week.append(f'<article class="day-column"><h3>{day}</h3><div class="focus-block"><span>DEEP WORK</span><strong>{hours:g}<small>H</small></strong></div><div class="connect-block"><strong>CONNECT</strong><span>Meetings &amp; people</span></div><div class="open-block"><span>OPEN SPACE</span><span aria-hidden="true">+</span></div></article>')
sleep = []
for day, value in zip(['M', 'T', 'W', 'T', 'F', 'S', 'S'], [7, 8, 7.5, 8, 7.75, 7.25, 8.4]):
    sleep.append(f'<div class="sleep-day"><span>{value:g}H</span><div class="sleep-track"><span style="height:{value/9*100:.3f}%"></span></div><span>{day}</span></div>')
html = (ROOT / 'template.html').read_text()
for key, value in {
    '__STYLES__': '\n'.join((ROOT / name).read_text() for name in ['styles.css', 'workspaces.css', 'responsive.css']),
    '__SCRIPT__': (ROOT / 'app.js').read_text(),
    '__WEEK__': ''.join(week),
    '__SLEEP__': ''.join(sleep),
}.items():
    html = html.replace(key, value)
target = ROOT / 'index.html'
if target.exists():
    previous = target.read_text()
    if 'Swiss / freedom-four / design study' not in previous:
        raise ValueError('Refusing to overwrite a different file')
target.write_text(html)
print(f'Built {target} ({len(html):,} characters)')
