"""Headless, disconnected verification of actual Goals markup and client controls."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(sys.argv[1]).resolve()
checks = []


def fits(page):
    assert not page.evaluate("()=>document.documentElement.scrollWidth>innerWidth+1")
    assert page.get_by_role("dialog").evaluate_all(
        "(items)=>items.every(e=>e.scrollWidth<=e.clientWidth+1)"
    )


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(reduced_motion="reduce")
    for width in [320, 390, 768, 1024, 1440]:
        page.set_viewport_size({"width": width, "height": 1000})
        for theme in ["light", "dark"]:
            for suffix in ["", "-empty", "-qa-goals-horizon", "-qa-goals-no-statements", "-qa-goals-manual", "-qa-goals-age"]:
                page.goto((root / f"financial-tab-goals{suffix}.html").as_uri())
                page.evaluate("(theme)=>document.documentElement.className=theme", theme)
                page.evaluate("()=>document.fonts.ready")
                fits(page)
                assert page.get_by_text("Archived goal", exact=True).count() == 0
                if suffix in ["-empty", "-qa-goals-no-statements"]:
                    expect(page.get_by_role("button", name="Set FI target" if suffix == "-empty" else "Adjust assumptions")).to_be_visible()
                    assert page.locator(".goals-stats").count() == 0
                    assert page.locator(".fi-chart").count() == 0
                    if suffix == "-qa-goals-no-statements":
                        expect(page.locator(".goals-fi")).to_contain_text("Projection needs attention")
                        assert "37.5%" not in page.locator(".goals-workspace").inner_text()
                else:
                    assert page.locator(".goals-stats dt").count() == 3
                    assert page.get_by_role("progressbar", name="A longer summer abroad progress").get_attribute("aria-valuenow") == "30"
                    assert page.get_by_role("progressbar", name="Moving fund progress").get_attribute("aria-valuenow") == "100"
                    assert page.get_by_role("progressbar", name="Moving fund progress").get_attribute("aria-valuetext") == "125% of target"
                    assert "$1,500,000" in page.locator(".goals-stats").inner_text()
                    assert page.locator(".fi-chart").count() == 1
                    assert page.get_by_role("slider", name="Inspect investment balance").count() == 1
                    assert page.locator('input[type="range"]').count() == 0
                    assert page.locator(".goals-chart-scroll").count() == 0
                    assert page.locator(".fi-chart-milestones button").count() == 4
                    assert page.locator(".fi-scenario-options > div").count() == 3
                    assert page.locator(".fi-chart-plot .fi-scenario-line").count() == 3
                    assert "Base plan reaches target" in page.locator(".goals-stats").inner_text()
                    if suffix == "-qa-goals-horizon":
                        assert "Not reached by plan end" in page.locator(".goals-stats").inner_text()
                    elif suffix == "-qa-goals-manual":
                        assert "Oct 2044" in page.locator(".goals-stats").inner_text()
                        expect(page.locator(".goals-fi")).to_contain_text("Contributions · $3,000 / mo. · Manual")
                    else:
                        assert "$193,800" in page.locator(".goals-stats").inner_text()
                        assert ("Age 54y 3m" if suffix == "-qa-goals-age" else "Jun 2045") in page.locator(".goals-stats").inner_text()
                        expect(page.locator(".goals-fi")).to_contain_text("Contributions · $2,800 / mo. · 12-month average · 11/12 months recorded")
                        assert "Plan through" in page.locator(".fi-chart").inner_text()
                    assert page.locator(".goals-manage[open]").count() == 0
                if not suffix and width in [390, 1440]:
                    page.screenshot(path=str(root / f"goals-{width}-{theme}.png"), full_page=True)
                for summary in page.locator(".goals-workspace details > summary").all():
                    summary.click()
                fits(page)
                if width == 1440:
                    page.add_style_tag(content="html {font-size:200%!important} body {font-size:28px!important}")
                    fits(page)
                checks.append(f"Layout {width}px {theme} {suffix or 'populated'}: values, disclosure, overflow")

    for width in [320, 390, 1440]:
        page.set_viewport_size({"width": width, "height": 1000})
        for theme in ["light", "dark"]:
            page.goto((root / "goal-lab.html").as_uri())
            page.evaluate("(theme)=>document.documentElement.className=theme", theme)
            new = page.get_by_role("button", name="+ New goal", exact=True)
            new.click()
            dialog = page.get_by_role("dialog")
            expect(dialog).to_be_visible()
            dialog.get_by_role("button", name="Add goal", exact=True).click()
            assert page.evaluate("()=>!globalThis.__qaGoalActions?.length")
            dialog.get_by_label("Name", exact=True).fill("Reject")
            dialog.get_by_label("Target amount", exact=True).fill("20000")
            dialog.get_by_label("Track progress from").select_option("accounts")
            dialog.get_by_label("Sample brokerage").check()
            dialog.get_by_label("Sample checking").check()
            fits(page)
            dialog.get_by_role("button", name="Add goal", exact=True).click()
            expect(dialog.get_by_role("status")).to_have_text("Synthetic goal validation error")
            expect(dialog.get_by_label("Name", exact=True)).to_have_value("Reject")
            expect(dialog.get_by_label("Target amount", exact=True)).to_have_value("20000")
            expect(dialog.get_by_label("Sample brokerage")).to_be_checked()
            expect(dialog.get_by_label("Sample checking")).to_be_checked()
            dialog.get_by_label("Name", exact=True).fill("Test goal")
            page.evaluate("()=>globalThis.__qaPauseGoalAction=true")
            dialog.get_by_role("button", name="Add goal", exact=True).click()
            expect(dialog.get_by_role("button", name="Adding…")).to_be_disabled()
            page.evaluate("()=>{globalThis.__qaPauseGoalAction=false;globalThis.__qaResolveGoalAction()}")
            expect(dialog).not_to_be_visible()
            expect(new).to_be_focused()
            assert page.evaluate("()=>globalThis.__qaGoalActions.at(-1).linkedAccountIds") == ["qa-brokerage", "qa-checking"]
            checks.append(f"Create {width}px {theme}: validation, retained input, checkboxes, pending, save, focus")

            new.click()
            dialog.get_by_label("Goal type").select_option("emergency_fund")
            expect(dialog.get_by_label("Account class")).to_have_value("cash")
            dialog.get_by_label("Goal type").select_option("debt_payoff")
            expect(dialog.get_by_label("Account class")).to_have_value("debt")
            assert dialog.locator('input[name="invert"]').input_value() == "true"
            dialog.get_by_label("Goal type").select_option("savings_rate_target")
            assert dialog.get_by_label("Target amount", exact=True).count() == 0
            dialog.get_by_label("Name", exact=True).fill("Saving steadily")
            dialog.get_by_label("Target savings rate").fill("35")
            dialog.get_by_label("Measured over").select_option("24")
            fits(page)
            dialog.get_by_role("button", name="Add goal", exact=True).click()
            expect(dialog).not_to_be_visible()
            payload = page.evaluate("()=>globalThis.__qaGoalActions.at(-1).data")
            assert payload["kind"] == "savings_rate_target" and payload["rateWindow"] == "24" and payload["targetRate"] == "35"
            checks.append(f"Kinds {width}px {theme}: emergency/debt defaults and savings-rate serialization")

            page.get_by_role("button", name="Adjust assumptions", exact=True).click()
            expect(dialog.get_by_label("Annual spend", exact=True)).to_have_value("60000")
            override = dialog.get_by_role("switch", name="Manual contribution override")
            expect(override).not_to_be_checked()
            assert dialog.get_by_label("Monthly contribution", exact=True).count() == 0
            expect(dialog).to_contain_text("2,800 USD / mo")
            override.check()
            expect(dialog.get_by_label("Monthly contribution", exact=True)).to_have_value("3000")
            dialog.get_by_label("Monthly contribution", exact=True).fill("3123.45")
            override.uncheck()
            expect(dialog).to_contain_text("2,800 USD / mo")
            override.check()
            expect(dialog.get_by_label("Monthly contribution", exact=True)).to_have_value("3123.45")
            base_return = dialog.get_by_label("Base real return (after inflation)", exact=True)
            expect(base_return).to_have_value("5.0")
            assert dialog.get_by_role("button", name="Use realized", exact=False).count() == 0
            inflation = dialog.get_by_label("Assumed annual inflation", exact=True)
            reduction = dialog.get_by_label("Downside / upside sensitivity", exact=True)
            expect(inflation).to_have_value("3.0")
            expect(reduction).to_have_value("2.0")
            expect(dialog).to_contain_text("11.9% nominal → 8.6% real")
            inflation.fill("4.0")
            reduction.fill("1.5")
            expect(dialog).to_contain_text("11.9% nominal → 7.6% real")
            expect(base_return).to_have_value("5.0")
            fits(page)
            page.screenshot(path=str(root / f"goals-assumptions-{width}-{theme}.png"), full_page=True)
            dialog.get_by_label("Annual spend", exact=True).fill("72000")
            dialog.get_by_label("I confirm the included accounts").check()
            page.evaluate("()=>globalThis.__qaFailGoalAction=true")
            dialog.get_by_role("button", name="Save FI target").click()
            expect(dialog.get_by_role("status")).to_have_text("Synthetic goal validation error")
            expect(dialog.get_by_label("Annual spend", exact=True)).to_have_value("72000")
            expect(override).to_be_checked()
            expect(dialog.get_by_label("Monthly contribution", exact=True)).to_have_value("3123.45")
            expect(inflation).to_have_value("4.0")
            expect(reduction).to_have_value("1.5")
            page.evaluate("()=>globalThis.__qaFailGoalAction=false")
            dialog.get_by_role("button", name="Save FI target").click()
            expect(dialog).not_to_be_visible()
            payload = page.evaluate("()=>globalThis.__qaGoalActions.at(-1).data")
            assert float(payload["realReturn"]) == 5.0 and payload["monthlyContribution"] == "3123.45" and payload["annualSpend"] == "72000" and payload["useManualContribution"] == "true"
            assert float(payload["inflationRate"]) == 4.0 and float(payload["downsideReduction"]) == 1.5
            page.get_by_role("button", name="Adjust assumptions", exact=True).click()
            override = dialog.get_by_role("switch", name="Manual contribution override")
            expect(override).not_to_be_checked()
            dialog.get_by_label("I confirm the included accounts").check()
            dialog.get_by_role("button", name="Save FI target").click()
            expect(dialog).not_to_be_visible()
            assert "useManualContribution" not in page.evaluate("()=>globalThis.__qaGoalActions.at(-1).data")
            checks.append(f"Assumptions {width}px {theme}: automatic average, manual switch, retained amounts, errors and mode serialization")

            page.get_by_role("button", name="Progress source", exact=True).click()
            expect(dialog.get_by_label("Sample brokerage")).to_be_checked()
            expect(dialog.get_by_label("Sample checking")).not_to_be_checked()
            dialog.get_by_label("Sample checking").check()
            page.evaluate("()=>globalThis.__qaFailGoalAction=true")
            dialog.get_by_role("button", name="Save links").click()
            expect(dialog.get_by_role("status")).to_have_text("Synthetic goal validation error")
            expect(dialog.get_by_label("Sample checking")).to_be_checked()
            fits(page)
            page.evaluate("()=>globalThis.__qaFailGoalAction=false")
            dialog.get_by_role("button", name="Save links").click()
            expect(dialog).not_to_be_visible()
            assert page.evaluate("()=>globalThis.__qaGoalActions.at(-1).linkedAccountIds") == ["qa-brokerage", "qa-checking"]
            checks.append(f"Links {width}px {theme}: initial selection, retained error state, serialized account IDs")

            page.get_by_label("Current amount (USD)").fill("7000")
            page.evaluate("()=>globalThis.__qaFailGoalAction=true")
            page.get_by_role("button", name="Update", exact=True).click()
            expect(page.get_by_role("alert")).to_have_text("Synthetic goal validation error")
            expect(page.get_by_label("Current amount (USD)")).to_have_value("7000")
            page.evaluate("()=>globalThis.__qaFailGoalAction=false")
            page.get_by_role("button", name="Update", exact=True).click()
            expect(page.get_by_role("alert")).not_to_be_visible()
            assert page.evaluate("()=>globalThis.__qaGoalActions.at(-1).data.currentProgress") == "7000"
            new.click()
            page.keyboard.press("Escape")
            expect(dialog).not_to_be_visible()
            expect(new).to_be_focused()
            checks.append(f"Progress {width}px {theme}: error/retry, retained amount, Escape/focus")
    browser.close()

(root / "goal-results.json").write_text(json.dumps({"passed": len(checks), "checks": checks}, indent=2))
print(json.dumps({"passed": len(checks), "scope": "Synthetic component QA, not authenticated E2E"}))
