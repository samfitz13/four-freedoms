"""Headless habit UI checks. All actions are disconnected synthetic adapters."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(sys.argv[1]).resolve()
checks, errors, requests = [], [], []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(reduced_motion='reduce')
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: requests.append(request.url) if request.url.startswith('http') else None)
    for width in [320, 390, 768, 1024, 1440]:
        page.set_viewport_size({'width': width, 'height': 1000})
        for theme in ['light', 'dark']:
            for state in ['', '-empty']:
                page.goto((ROOT / f'time-tab-habits{state}.html').as_uri())
                page.evaluate('(theme)=>document.documentElement.className=theme', theme)
                page.evaluate('()=>document.fonts.ready')
                assert not page.evaluate('()=>document.documentElement.scrollWidth>innerWidth+1'), (width, theme, state)
                assert page.locator('.habit-day').evaluate_all('(days)=>days.every(day=>{const r=day.getBoundingClientRect();return r.width>=44&&r.height>=44})')
                if width in [390, 1440]:
                    page.screenshot(path=str(ROOT / f'habits{state}-{width}-{theme}.png'), full_page=True)
                page.evaluate('()=>document.querySelectorAll(".habit-details,.habit-edit,.habit-composer").forEach(el=>el.open=true)')
                assert not page.evaluate('()=>document.documentElement.scrollWidth>innerWidth+1'), (width, theme, state, 'expanded')
                checks.append(f'{width}px {theme} {state or "populated"}: closed and expanded layouts, 44px day targets')

    for width in [390, 1440]:
        for theme in ['light', 'dark']:
            page.set_viewport_size({'width': width, 'height': 1000})
            page.goto((ROOT / 'habit-lab.html').as_uri())
            page.reload()
            page.evaluate('(theme)=>document.documentElement.className=theme', theme)
            manual = page.get_by_role('form', name='Read a few pages check-ins', exact=True)
            linked = page.get_by_role('form', name='Get seven hours of sleep check-ins', exact=True)
            assert manual.get_by_role('button').count() == 7
            assert linked.get_by_role('button').count() == 0
            assert linked.get_by_role('img').count() == 7
            today = manual.get_by_role('button').last.get_attribute('value')
            page.evaluate('()=>globalThis.__qaPauseHabitAction=true')
            manual.get_by_role('button').last.focus()
            page.keyboard.press('Enter')
            expect(manual.get_by_role('status')).to_have_text('Saving check-in…')
            assert manual.get_by_role('button').evaluate_all('(buttons)=>buttons.every(button=>button.disabled)')
            assert page.evaluate('()=>globalThis.__qaHabitActions.at(-1)') == {'name': 'toggleCheckin', 'data': {'habitId': 'qa-read', 'occurredOn': today}}
            page.evaluate('()=>{globalThis.__qaPauseHabitAction=false;globalThis.__qaResolveHabitAction()}')
            expect(manual.get_by_role('button').last).to_be_enabled()
            page.evaluate('()=>globalThis.__qaFailHabitAction=true')
            manual.get_by_role('button').first.click()
            expect(manual.get_by_role('status')).to_contain_text('Couldn’t save')
            page.evaluate('()=>globalThis.__qaFailHabitAction=false')
            manual.get_by_role('button').first.click()
            expect(manual.get_by_role('status')).to_be_empty()
            checks.append(f'{width}px {theme}: keyboard check-in payload, pending lock, error/retry, read-only linked days')

            page.locator('.habit-composer > summary').click()
            form = page.get_by_role('form', name='New habit', exact=True)
            assert not form.evaluate('(form)=>form.checkValidity()')
            form.get_by_label('What would you like to make time for?').fill('Reject')
            form.get_by_label('Days per week').fill('3')
            form.get_by_role('button', name='Add habit', exact=True).click()
            expect(form).to_contain_text('Synthetic habit validation error')
            expect(form.get_by_label('What would you like to make time for?')).to_have_value('Reject')
            expect(form.get_by_label('Days per week')).to_have_value('3')
            form.get_by_label('How it’s recorded').select_option('workout')
            assert form.get_by_label('Minimum sleep hours').count() == 0
            form.get_by_label('Minimum workout minutes').fill('45')
            form.get_by_label('What would you like to make time for?').fill('Daily stretch')
            page.evaluate('()=>globalThis.__qaPauseHabitAction=true')
            form.get_by_role('button', name='Add habit', exact=True).click()
            expect(form.get_by_role('button', name='Saving…', exact=True)).to_be_disabled()
            record = page.evaluate('()=>globalThis.__qaHabitActions.at(-1)')
            assert record['name'] == 'createHabit'
            assert record['data']['minMinutes'] == '45' and 'minHours' not in record['data']
            assert record['data']['targetPerWeek'] == '3' and record['data']['startedOn'] == today
            page.evaluate('()=>{globalThis.__qaPauseHabitAction=false;globalThis.__qaResolveHabitAction()}')
            expect(form).to_contain_text('Habit added.')
            expect(form.get_by_label('What would you like to make time for?')).to_have_value('')
            checks.append(f'{width}px {theme}: labeled create form, preserved validation inputs, conditional fields, pending and success')

            row = page.locator('.habit-row').first
            row.locator('.habit-details > summary').click()
            assert row.locator('.habit-history > li').count() == 28
            row.locator('.habit-edit > summary').click()
            edit = row.get_by_role('form', name='Edit Read a few pages', exact=True)
            started = edit.locator('[name=startedOn]').input_value()
            edit.get_by_label('What would you like to make time for?').fill('Read a little longer')
            edit.get_by_label('Days per week').fill('5')
            edit.get_by_role('button', name='Save changes', exact=True).click()
            expect(edit).to_contain_text('Habit updated.')
            record = page.evaluate('()=>globalThis.__qaHabitActions.at(-1)')
            assert record['name'] == 'updateHabit' and record['data']['id'] == 'qa-read'
            assert record['data']['startedOn'] == started and record['data']['targetPerWeek'] == '5'
            row.locator('.habit-edit > summary').click()
            archive = row.locator('.habit-archive')
            before = page.evaluate('()=>globalThis.__qaHabitActions.length')
            archive.get_by_role('button', name='Archive habit', exact=True).click()
            archive.get_by_role('button', name='Keep habit', exact=True).click()
            expect(archive.get_by_role('button', name='Archive habit', exact=True)).to_be_focused()
            assert page.evaluate('()=>globalThis.__qaHabitActions.length') == before
            archive.get_by_role('button', name='Archive habit', exact=True).click()
            page.keyboard.press('Escape')
            expect(archive.get_by_role('button', name='Archive habit', exact=True)).to_be_visible()
            expect(archive.get_by_role('button', name='Archive habit', exact=True)).to_be_focused()
            archive.get_by_role('button', name='Archive habit', exact=True).click()
            page.evaluate('()=>globalThis.__qaPauseHabitAction=true')
            archive.get_by_role('button', name='Confirm archive', exact=True).click()
            expect(archive.get_by_role('button', name='Archiving…', exact=True)).to_be_disabled()
            page.evaluate('()=>{globalThis.__qaPauseHabitAction=false;globalThis.__qaResolveHabitAction()}')
            expect(archive.get_by_role('button', name='Archive habit', exact=True)).to_be_visible()
            assert page.evaluate('()=>globalThis.__qaHabitActions.at(-1)') == {'name': 'archiveHabit', 'data': {'id': 'qa-read'}}
            assert not page.evaluate('()=>document.documentElement.scrollWidth>innerWidth+1')
            page.screenshot(path=str(ROOT / f'habits-details-{width}-{theme}.png'), full_page=True)
            checks.append(f'{width}px {theme}: 28-day history, edit preserves start date, cancel/Escape/confirm archive')

            page.goto((ROOT / 'habit-lab.html').as_uri() + '#legacy')
            page.reload()
            page.evaluate('(theme)=>document.documentElement.className=theme', theme)
            page.locator('.habit-details > summary').click()
            page.locator('.habit-edit > summary').click()
            legacy = page.get_by_role('form', name='Edit Legacy rhythm', exact=True)
            expect(legacy.get_by_label('Pursuit')).to_have_value('qa-archived')
            expect(legacy.get_by_label('How it’s recorded')).to_have_value('body_weight')
            legacy.get_by_role('button', name='Save changes', exact=True).click()
            expect(legacy).to_contain_text('Habit updated.')
            record = page.evaluate('()=>globalThis.__qaHabitActions.at(-1)')
            assert record['data']['pursuitId'] == 'qa-archived' and record['data']['linkKind'] == 'body_weight'
            checks.append(f'{width}px {theme}: editing retains an unavailable pursuit and existing legacy source')
    assert not errors, errors
    assert not requests, requests
    browser.close()

result = {'passed': len(checks), 'checks': checks, 'javascriptErrors': errors, 'externalRequests': requests, 'scope': 'Actual habit components; synthetic data and mocked actions, not authenticated E2E'}
(ROOT / 'habit-results.json').write_text(json.dumps(result, indent=2))
print(json.dumps({key:value for key,value in result.items() if key!='checks'}, indent=2))
