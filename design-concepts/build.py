"""Build three offline design studies. All displayed figures are fictional."""
import argparse
import base64
import re
from pathlib import Path

ROOT = Path(__file__).parent


def icon(name):
    paths = {
        "overview": '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
        "financial": '<path d="M4 18V12M10 18V8M16 18V4M3 21H21"/>',
        "location": '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
        "time": '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
        "health": '<path d="M20 13c4-6-3-12-8-6-5-6-12 0-8 6l8 8Z"/><path d="M6 12h3l2-3 2 6 2-3h3"/>',
    }
    return f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths[name]}</svg>'


def money_chart():
    values = [202400, 210100, 207900, 216600, 229800, 232200, 243100, 248600]
    points = " ".join(f"{55+i*70},{180-(v-200000)/50000*140:.1f}" for i, v in enumerate(values))
    axes = ''.join(f'<line x1="55" y1="{y}" x2="550" y2="{y}" class="grid-line"/><text x="0" y="{y+4}">{label}</text>' for y, label in [(40, '$250k'), (110, '$225k'), (180, '$200k')])
    labels = ''.join(f'<text x="{55+i*70}" y="214" text-anchor="middle">{label}</text>' for i, label in enumerate(['Mar','Apr','May','Jun','Jul','Aug','Sep','Oct']))
    return f'<svg class="money-chart" viewBox="0 0 580 232" role="img" aria-label="Illustrative net worth from March to October: $202,400, $210,100, $207,900, $216,600, $229,800, $232,200, $243,100, and $248,600. Vertical scale $200,000 to $250,000.">{axes}<polyline points="{points}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>{labels}<circle cx="545" cy="43.9" r="4" fill="currentColor"/></svg>'


def bars(values, labels, maximum, unit):
    parts = ''.join(f'<div class="bar-col"><span class="bar-number">{value:g}{unit}</span><div class="bar-track"><span style="height:{value/maximum*100:.2f}%"></span></div><span class="bar-label">{label}</span></div>' for value, label in zip(values, labels))
    return f'<div class="bars" aria-label="{unit} per day; bars start at zero">{parts}</div>'


def metric(label, value, note=''):
    return f'<div class="metric"><dt>{label}</dt><dd>{value}</dd>{f"<span>{note}</span>" if note else ""}</div>'


def panel_head(label, href, detail=''):
    return f'<header class="panel-head"><div><span class="eyebrow">{label}</span>{f"<p>{detail}</p>" if detail else ""}</div><a class="arrow" href="#{href}" aria-label="Explore {label.lower()}">↗</a></header>'


MONEY = f'''<article class="panel money" data-freedom="financial">{panel_head('Financial', 'financial', 'The long view')}
<div class="number-line"><div><p class="label">Net worth</p><h2 class="big-number">$248,600<span class="number-dot">.</span></h2></div><span class="change">+$5,500 this month</span></div>
{money_chart()}<div class="panel-foot"><span>March to October · sample history</span><a href="#financial">Your financial picture <span aria-hidden="true">→</span></a></div></article>'''

PLACE = f'''<article class="panel place" data-freedom="location">{panel_head('Location', 'location', 'A sense of place')}
<div class="place-feature"><span class="place-code">BOS</span><div><h2>Boston</h2><p>Home base · 21 of the past 30 nights</p></div></div>
<div class="route"><span class="route-dot"></span><span class="route-line"></span><span class="route-dot end"></span></div>
<div class="place-next"><span class="label">Up next</span><strong>Lisbon</strong><span>Nov 6–12 · time away</span></div></article>'''

TIME = f'''<article class="panel time" data-freedom="time">{panel_head('Time', 'time', 'Space to do good work')}
<div class="number-line"><h2>14<span class="unit">h</span></h2><span class="label">deep work this week</span></div>
{bars([3.5,2,4,1.5,3],['M','T','W','T','F'],5,'h')}<div class="panel-foot"><span>38h tracked in total</span><a href="#time">See your week →</a></div></article>'''

HEALTH = f'''<article class="panel health" data-freedom="health">{panel_head('Health', 'health', 'A steadier rhythm')}
<div class="number-line"><h2>7<span class="unit">h</span> 42<span class="unit">m</span></h2><span class="label">average sleep</span></div>
{bars([7,8,7.5,8,7.75,7.25,8.4],['M','T','W','T','F','S','S'],9,'h')}<div class="panel-foot"><span>4 movement sessions</span><a href="#health">Your rhythm →</a></div></article>'''

HORIZON = '''<aside class="panel horizon"><header class="panel-head"><span class="eyebrow">On the horizon</span><span class="quiet">03</span></header><ol class="agenda"><li><span class="date-stamp">18<small>OCT</small></span><div><strong>A moment to reflect</strong><p>Your weekly review</p></div></li><li><span class="date-stamp">31<small>OCT</small></span><div><strong>Close the month</strong><p>Statements and a fresh perspective</p></div></li><li><span class="date-stamp">06<small>NOV</small></span><div><strong>A change of scenery</strong><p>Lisbon · six nights away</p></div></li></ol><p class="aside-note">Not everything needs optimizing.<br>Notice what is working, too.</p></aside>'''


def overview(title, description):
    summary = ''.join([metric('Financial', '$248,600', 'net worth'), metric('Location', 'Boston', 'home base'), metric('Time', '14h', 'deep work'), metric('Health', '7h 42m', 'average sleep')])
    return f'''<section class="view" id="view-overview" aria-labelledby="title-overview"><header class="page-head"><div><p class="eyebrow">Thursday, October 15 · Week 42</p><h1 id="title-overview" tabindex="-1">{title}</h1><p class="page-description">{description}</p></div><span class="week-tag">A week in perspective <span aria-hidden="true">↗</span></span></header><dl class="summary">{summary}</dl><div class="workspace-grid">{MONEY}{PLACE}{TIME}{HEALTH}{HORIZON}</div></section>'''


def domain_header(key, title, description):
    return f'<header class="page-head"><div><p class="eyebrow">Your four freedoms / {key.title()}</p><h1 id="title-{key}" tabindex="-1">{title}</h1><p class="page-description">{description}</p></div><a class="text-link" href="#overview">← Overview</a></header>'


def domains():
    financial_metrics = ''.join([metric('Net worth','$248,600'),metric('Invested','$176,800'),metric('Savings rate','38%'),metric('Cash runway','8.2 mo')])
    account_rows = ''.join(f'<tr><th scope="row">{name}<small>{kind}</small></th><td>{amount}</td><td><span class="status">{status}</span></td></tr>' for name,kind,amount,status in [('Brokerage','Investments','$94,300','Reviewed'),('Retirement','Investments','$82,500','Reviewed'),('Cash reserve','Savings','$45,000','Reviewed'),('Everyday account','Checking','$9,800','Reviewed'),('Home equity','Property','$20,200','Estimate'),('Credit card','Debt','−$3,200','Reviewed')])
    financial = f'''<section class="view" id="view-financial" aria-labelledby="title-financial" hidden>{domain_header('financial','A stronger foundation.','See what you own, what you save, and the room you are creating.')}<dl class="summary">{financial_metrics}</dl><div class="domain-grid"><div class="domain-main">{MONEY}<article class="panel"><header class="panel-head"><h2>Your accounts</h2><span class="quiet">6 accounts · sample balances</span></header><div class="table-scroll" role="region" aria-label="Sample account balances" tabindex="0"><table><thead><tr><th scope="col">Account</th><th scope="col">Balance</th><th scope="col">Status</th></tr></thead><tbody>{account_rows}</tbody></table></div></article></div><aside class="panel flow"><span class="eyebrow">This month</span><h2>Room to save.</h2><p class="muted">A simple view of money in and money out.</p><dl class="cashflow"><div><dt>Income</dt><dd>$12,800</dd><span style="--fill:100%"></span></div><div><dt>Spending</dt><dd>$7,936</dd><span style="--fill:62%"></span></div><div><dt>Saved</dt><dd>$4,864</dd><span style="--fill:38%"></span></div></dl><div class="note"><strong>38% savings rate</strong><p>Of take-home income in this example month.</p></div><a class="text-link" href="#time">How does work fit into your week? →</a></aside></div></section>'''
    location = f'''<section class="view" id="view-location" aria-labelledby="title-location" hidden>{domain_header('location','Feel at home. Go somewhere.','The places you spend time, and the people who make them matter.')}<dl class="summary">{metric('Home base','Boston')}{metric('Nights at home','21 / 30')}{metric('Next trip','Lisbon')}{metric('Time away','6 nights')}</dl><div class="location-layout">{PLACE}<article class="panel travel"><header class="panel-head"><h2>Places ahead</h2><span class="quiet">November</span></header><div class="trip"><span class="trip-index">01</span><div><h3>Lisbon, Portugal</h3><p>Nov 6–12 · a change of pace</p></div><span class="trip-duration">6 nights</span></div><div class="trip"><span class="trip-index">02</span><div><h3>New York, NY</h3><p>Nov 19–21 · people and work</p></div><span class="trip-duration">2 nights</span></div><div class="trip"><span class="trip-index">03</span><div><h3>Somewhere familiar</h3><p>Leave room for a visit that is not on the calendar yet.</p></div></div></article><article class="panel nights"><span class="eyebrow">The past 30 nights</span><h2>Where your days became a life.</h2><div class="night-strip" aria-label="21 nights in Boston, 6 in New York, 3 elsewhere"><span style="flex:21">21</span><span style="flex:6">6</span><span style="flex:3">3</span></div><ul class="inline-legend"><li>Boston · 21</li><li>New York · 6</li><li>Elsewhere · 3</li></ul></article></div></section>'''
    time = f'''<section class="view" id="view-time" aria-labelledby="title-time" hidden>{domain_header('time','Time for what matters.','Not just a fuller calendar. A more deliberate week.')}<dl class="summary">{metric('Tracked','38h')}{metric('Deep work','14h')}{metric('Meetings','14h')}{metric('Personal time','10h')}</dl><div class="domain-grid"><article class="panel week"><header class="panel-head"><h2>A week with breathing room</h2><span class="quiet">October 12–16</span></header><div class="week-columns">{''.join(f'<div class="day"><span class="eyebrow">{day}</span><div class="time-block focus"><strong>Focus</strong><span>{hours}h protected</span></div><div class="time-block meetings"><strong>Connect</strong><span>Meetings & people</span></div><div class="time-block open"><span>Unscheduled</span></div></div>' for day,hours in [('Mon','3.5'),('Tue','2'),('Wed','4'),('Thu','1.5'),('Fri','3')])}</div><p class="muted small">An illustrative rhythm, not a time-scaled calendar.</p></article>{TIME}<article class="panel allocation"><span class="eyebrow">38 tracked hours</span><h2>How the week divides.</h2><div class="time-strip" aria-label="14 hours deep work, 14 hours meetings, 10 hours personal time"><span style="flex:14"></span><span style="flex:14"></span><span style="flex:10"></span></div><ul class="inline-legend"><li>Deep work · 14h</li><li>Meetings · 14h</li><li>Personal · 10h</li></ul></article></div></section>'''
    health = f'''<section class="view" id="view-health" aria-labelledby="title-health" hidden>{domain_header('health','Find your rhythm.','A little more attention to rest, movement, and how you feel.')}<dl class="summary">{metric('Average sleep','7h 42m')}{metric('Movement','4 sessions')}{metric('Resting heart rate','58 bpm')}{metric('Sleep logged','7 nights')}</dl><div class="domain-grid"><div class="domain-main">{HEALTH}<article class="panel"><header class="panel-head"><h2>Movement, without the noise.</h2><span class="quiet">This week</span></header><ul class="workouts"><li><span>Mon</span><strong>Strength training</strong><span>45 min</span></li><li><span>Wed</span><strong>A long walk</strong><span>40 min</span></li><li><span>Fri</span><strong>Strength training</strong><span>45 min</span></li><li><span>Sun</span><strong>Easy time outside</strong><span>60 min</span></li></ul></article></div><aside class="panel reflection"><span class="eyebrow">Worth noticing</span><h2>Rest is part<br>of the picture.</h2><p>Use the numbers to notice patterns, not to grade yourself.</p><div class="reflection-rule"></div><p class="muted">For your next weekly review</p><ul><li>When did you feel most rested?</li><li>What made movement easier?</li><li>What would you like to repeat?</li></ul><a class="text-link" href="#time">Make space in your week →</a></aside></div></section>'''
    return financial + location + time + health


SCRIPT = '''<script>
function showView(){const key=['overview','financial','location','time','health'].includes(location.hash.slice(1))?location.hash.slice(1):'overview';document.querySelectorAll('.view').forEach(view=>view.hidden=view.id!=='view-'+key);document.querySelectorAll('.workspace-nav a').forEach(link=>{const active=link.hash==='#'+key;if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});document.body.dataset.view=key;document.title=document.body.dataset.concept+' · '+key[0].toUpperCase()+key.slice(1)+' · freedom-four concept';}
addEventListener('hashchange',()=>{showView();document.querySelector('.view:not([hidden]) h1').focus({preventScroll:true});window.scrollTo(0,0);});showView();
</script>'''


def fonts(atlas_path, app_css):
    bundle = atlas_path.read_text()
    css = app_css.read_text()
    for block in re.findall(r'@font-face\{[^}]+\}', css):
        if not re.search(r'font-family:(?:Fraunces|Nunito Sans);', block):
            continue
        # Latin only; the sample text needs no additional language subsets.
        if 'U+0-FF' not in block and 'U+??' not in block:
            continue
        match = re.search(r'url\(([^)]+)\)', block)
        if not match:
            continue
        file = (app_css.parent / match.group(1).strip('"\'')).resolve()
        encoded = base64.b64encode(file.read_bytes()).decode()
        bundle += block.replace(match.group(0), f'url(data:font/woff2;base64,{encoded})')
    return bundle


def build():
    parser = argparse.ArgumentParser()
    parser.add_argument('--font-bundle', type=Path, required=True)
    parser.add_argument('--app-css', type=Path, required=True)
    parser.add_argument('--refresh', action='store_true', help='Regenerate these design-study outputs')
    args = parser.parse_args()
    font_css = fonts(args.font_bundle, args.app_css)
    common = (ROOT / 'common.css').read_text()
    concepts = [
        ('a','fieldnotes','Fieldnotes','The shape of your week.','A clear view of your money, places, time, and health.'),
        ('b','control-room','Control Room','Overview','Your position across all four freedoms.'),
        ('c','compass','Compass','A little more freedom.','See the whole picture. Choose where to go next.'),
    ]
    for letter, slug, name, title, description in concepts:
        filename = f'{letter}-{slug}.html'
        nav = ''.join(f'<a href="#{key}" data-key="{key}">{icon(key)}<span>{label}</span><small>0{i}</small></a>' for i,(key,label) in enumerate([('overview','Overview'),('financial','Financial'),('location','Location'),('time','Time'),('health','Health')]))
        switch = ''
        for a, b, c, _, _ in concepts:
            current = ' aria-current="page"' if a == letter else ''
            switch += f'<a href="{a}-{b}.html" aria-label="Concept {a.upper()}: {c}"{current}>{a.upper()}</a>'
        chrome = f'<div class="preview-bar"><a href="index.html" class="preview-label">Concept {letter.upper()} <span>· {name}</span></a><span class="sample-note">Sample data · not your records</span><nav class="concept-switch" aria-label="Choose concept">{switch}</nav></div>'
        brand = '<a class="brand" href="#overview" aria-label="Freedom-four overview"><span class="brand-symbol" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>freedom<span class="brand-hyphen">-</span>four</span></a>'
        sidebar = f'<header class="app-header">{brand}<div class="nav-caption">Your workspace</div><nav class="workspace-nav" aria-label="Freedoms">{nav}</nav><div class="nav-footer"><span class="avatar" aria-hidden="true">Y</span><div>Your workspace<small>Private by design</small></div></div></header>'
        content = overview(title, description) + domains()
        html = f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{name} · freedom-four concept</title><style>{font_css}\n{common}\n{(ROOT / (slug+".css")).read_text()}\n{(ROOT / "responsive.css").read_text()}</style></head><body class="{slug}" data-concept="{name}">{chrome}<div class="app">{sidebar}<main id="main-content">{content}<footer class="page-footer"><span>Four freedoms. One considered life.</span><span>Design study only · no data is saved</span></footer></main></div>{SCRIPT}</body></html>'
        target = ROOT / filename
        if target.exists() and args.refresh:
            previous = target.read_text()
            if 'Design study only' not in previous:
                raise ValueError(f'Refusing to replace a non-concept file: {target.name}')
        with target.open('w' if args.refresh else 'x') as file:
            file.write(html)
        print(f'Created {target.name} ({len(html):,} characters)')
    index = (ROOT / 'index.template.html').read_text().replace('__FONTS__', font_css)
    target = ROOT / 'index.html'
    if target.exists() and args.refresh:
        previous = target.read_text()
        if 'Three directions · freedom-four' not in previous:
            raise ValueError('Refusing to replace a non-concept index')
    with target.open('w' if args.refresh else 'x') as file:
        file.write(index)
    print('Created index.html')


if __name__ == '__main__':
    build()
