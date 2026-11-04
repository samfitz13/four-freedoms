"""Actual retirement controls, snapshot consent, and failure retention, disconnected actions."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(sys.argv[1]).resolve()
checks = []
errors = []


def fits(page):
    assert not page.evaluate("()=>document.documentElement.scrollWidth>innerWidth+1")
    assert page.get_by_role("dialog").evaluate_all("(els)=>els.every(e=>e.scrollWidth<=e.clientWidth+1)")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(reduced_motion="reduce")
    page.on("pageerror", lambda error: errors.append(str(error)))
    for width in [320, 390, 1440]:
        page.set_viewport_size({"width": width, "height": 1000})
        for theme in ["light", "dark"]:
            for case in ["portfolio", "snapshot", "calendar", "savings", "savings-included"]:
                page.goto((root / "goal-lab.html").as_uri() + f"?case={case}")
                page.evaluate("(theme)=>document.documentElement.className=theme", theme)
                page.get_by_role("button", name="Adjust assumptions", exact=True).click()
                dialog = page.get_by_role("dialog")
                dialog.get_by_label("Return assumptions", exact=True).select_option("portfolio")
                expect(dialog.get_by_label("Equities (%)", exact=True)).to_have_value("6.00")
                expect(dialog.get_by_label("Bonds (%)", exact=True)).to_have_value("4.00")
                expect(dialog.get_by_label("Cash (%)", exact=True).first).to_have_value("3.00")
                assert not dialog.get_by_label("Base real return (after inflation)", exact=True).is_visible()
                expect(dialog).to_contain_text("Sample crypto")
                if case.startswith("savings"):
                    savings = dialog.get_by_role("checkbox", name="Money market savings", exact=True)
                    if case == "savings":
                        expect(savings).not_to_be_checked()
                        savings.focus()
                        page.keyboard.press("Space")
                    else:
                        expect(savings).to_be_checked()
                    expect(dialog).to_contain_text("100% cash allocation")
                    expect(dialog).to_contain_text("Leave emergency funds and near-term spending out")
                    assert dialog.locator('[name="allocationMode:qa-savings"]').count() == 0
                    assert dialog.locator('[name^="allocation:qa-savings:"]').count() == 0
                    assert dialog.locator('[name="confirmSnapshot:qa-savings"]').count() == 0
                    savings.uncheck()
                    expect(dialog).not_to_contain_text("100% cash allocation")
                    savings.check()
                if case == "snapshot":
                    expect(dialog).to_contain_text("Quote date unknown")
                    expect(dialog).to_contain_text("reconstructed cash")
                    expect(dialog).to_contain_text("Snapshot and statement months differ")
                    dialog.get_by_label("Use this snapshot", exact=False).check()
                else:
                    dialog.get_by_label("US equities (%)", exact=True).fill("60")
                    dialog.get_by_label("Municipal bonds (%)", exact=True).fill("30")
                    dialog.get_by_label("Cash (%)", exact=True).last.fill("10")
                if case == "calendar":
                    dialog.get_by_label("Retirement month", exact=True).fill("2040-01")
                    dialog.get_by_label("Plan end month", exact=True).fill("2070-01")
                    dialog.get_by_label("Income starts month", exact=True).fill("2050-01")
                else:
                    if dialog.get_by_role("button", name="Change income starts").count():
                        dialog.get_by_role("button", name="Change income starts").click()
                    dialog.get_by_label("Retirement age", exact=True).fill("65")
                    dialog.get_by_label("Plan end age", exact=True).fill("95")
                    dialog.get_by_label("Income starts age", exact=True).fill("70")
                dialog.get_by_label("Monthly after-tax retirement income (optional)", exact=True).fill("2000")
                dialog.get_by_label("I confirm the included accounts").check()
                fits(page)
                page.evaluate("()=>globalThis.__qaFailGoalAction=true")
                dialog.get_by_role("button", name="Save FI target").click()
                expect(dialog.get_by_role("status")).to_contain_text("Synthetic goal validation error")
                expect(dialog.get_by_label("I confirm the included accounts")).to_be_checked()
                expect(dialog.get_by_label("Monthly after-tax retirement income (optional)")).to_have_value("2000")
                if case.startswith("savings"):
                    expect(savings).to_be_checked()
                if case == "snapshot":
                    expect(dialog.get_by_label("Use this snapshot", exact=False)).to_be_checked()
                if width == 1440:
                    page.add_style_tag(content="html {font-size:200%!important} body {font-size:28px!important}")
                    fits(page)
                if width == 390 and case == "portfolio":
                    page.screenshot(path=str(root / f"fi-retirement-controls-{theme}.png"), full_page=True)
                page.evaluate("()=>globalThis.__qaFailGoalAction=false")
                if case.startswith("savings"):
                    selected = dialog.locator("form").evaluate("(form)=>new FormData(form).getAll('includedAccountIds')")
                    assert selected == ["qa-brokerage", "qa-savings"]
                dialog.get_by_role("button", name="Save FI target").click()
                expect(dialog).not_to_be_visible()
                data = page.evaluate("()=>globalThis.__qaGoalActions.at(-1).data")
                assert data["returnMode"] == "portfolio" and data["confirmIncludedAccounts"] == "true"
                assert data["monthlyRetirementIncome"] == "2000"
                if case.startswith("savings"):
                    assert data["includedAccountIds"] == "qa-savings"
                    assert "allocationMode:qa-savings" not in data
                assert data["retirementMonth"] == "2040-01" if case == "calendar" else data["retirementAge"] == "65"
                checks.append(f"{width}px {theme} {case}: consent, timing, error retention, serialization, fit")
    page.emulate_media(forced_colors="active")
    page.goto((root / "scenario-lab.html").as_uri() + "?case=retirement")
    page.locator(".fi-stress summary").click()
    assert page.locator(".fi-retirement-marker").count() == 1
    assert page.locator(".fi-depletion-marker").count() >= 1
    assert page.locator(".fi-stress tbody tr").count() == 2
    fits(page)
    page.screenshot(path=str(root / "fi-retirement-forced-colors.png"), full_page=True)
    checks.append("Forced colors: retirement, depletion, and stress results remain present")
    browser.close()
assert not errors, errors
(root / "fi-retirement-results.json").write_text(json.dumps({"passed": len(checks), "checks": checks, "errors": errors}, indent=2))
print(json.dumps({"passed": len(checks), "scope": "Synthetic component QA, not authenticated E2E", "errors": errors}))
