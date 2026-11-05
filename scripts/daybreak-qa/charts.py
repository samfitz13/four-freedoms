"""Disconnected FI chart interactions. No database, credentials, or external requests."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(sys.argv[1]).resolve()
checks = []
errors = []
external = []


def fits(page):
    assert not page.evaluate("()=>document.documentElement.scrollWidth>innerWidth+1")
    assert page.locator(".fi-chart").evaluate("(e)=>e.scrollWidth<=e.clientWidth+1")
    assert page.locator(".fi-chart button,.fi-chart input").evaluate_all(
        "(items)=>items.every(e=>e.getBoundingClientRect().height>=44)"
    )


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(reduced_motion="reduce")
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("request", lambda request: external.append(request.url) if request.url.startswith(("http:", "https:")) else None)
    for width in [320, 390, 768, 1024, 1440]:
        page.set_viewport_size({"width": width, "height": 1000})
        for theme in ["light", "dark"]:
            for scenario in ["normal", "horizon", "no-statements", "already-fi", "single"]:
                page.goto((root / "chart-lab.html").as_uri() + f"?scenario={scenario}")
                page.evaluate("(theme)=>document.documentElement.className=theme", theme)
                page.evaluate("()=>document.fonts.ready")
                expect(page.locator(".fi-chart")).to_be_visible()
                slider = page.get_by_role("slider", name="Inspect investment balance")
                assert page.locator('input[type="range"]').count() == 0
                output = page.locator(".fi-chart-inspector output")
                fits(page)
                assert page.locator(".fi-chart-milestones button").count() == 7
                assert page.get_by_text("Archived goal", exact=True).count() == 0
                if scenario == "single":
                    expect(slider).to_be_disabled()
                    expect(output).to_contain_text("Projected invested balance · $1,600,000")
                else:
                    slider.focus()
                    page.keyboard.press("Home")
                    expect(output).to_contain_text("Oct 2026" if scenario == "no-statements" else "Nov 2025")
                    initial = slider.get_attribute("aria-valuenow")
                    page.keyboard.press("ArrowRight")
                    assert slider.get_attribute("aria-valuenow") != initial
                    page.keyboard.press("End")
                    expect(output).to_contain_text("Projected")
                    assert slider.get_attribute("aria-valuetext") == output.inner_text()
                    assert slider.evaluate("(e)=>getComputedStyle(e).outlineStyle") != "none"
                if scenario in ["already-fi", "single"]:
                    assert "Met at start · Oct 2026" in page.locator(".fi-chart-threshold").inner_text()
                    assert ("C" in page.locator(".fi-projected-line").get_attribute("d")) == (scenario == "already-fi")
                elif scenario == "horizon":
                    expect(page.locator(".fi-chart-threshold")).to_contain_text("Not reached by plan end")
                    assert page.locator(".fi-crossing-point").count() == 0
                elif scenario == "no-statements":
                    assert page.locator(".fi-recorded-point").count() == 0
                    expect(page.locator(".fi-chart")).to_contain_text("Plan through Oct 2076.")

                if scenario == "normal":
                    full = page.get_by_role("button", name="Full plan", exact=True)
                    near = page.get_by_role("button", name="Next 5 years", exact=True)
                    near.click()
                    expect(near).to_have_attribute("aria-pressed", "true")
                    expect(full).to_have_attribute("aria-pressed", "false")
                    expect(page.locator(".fi-chart-x-axis")).to_contain_text("2031")
                    before = page.locator(".fi-projected-line").get_attribute("d")
                    summer = page.get_by_role("button", name="A longer summer abroad", exact=False)
                    summer.focus()
                    page.keyboard.press("Enter")
                    expect(summer).to_have_attribute("aria-pressed", "true")
                    expect(page.locator(".fi-chart-goal-detail")).to_contain_text("Target $20,000 · Target date Jun 1, 2027")
                    expect(output).to_contain_text("Jun 2027 · Projected")
                    assert page.locator(".fi-chart-rail i.is-selected").count() == 1
                    assert page.locator(".fi-goal-guide").count() == 1
                    assert page.locator(".fi-projected-line").get_attribute("d") == before
                    page.get_by_role("button", name="Another summer target", exact=False).click()
                    expect(page.locator(".fi-chart-goal-detail")).to_contain_text("Jun 15, 2027")
                    assert page.locator(".fi-chart-rail i.is-selected").count() == 1
                    page.get_by_role("button", name="Room for the unexpected", exact=False).click()
                    expect(page.locator(".fi-chart-goal-detail")).to_contain_text("No target date")
                    assert page.locator(".fi-goal-guide").count() == 0
                    for title in ["A past target", "A later chapter"]:
                        page.get_by_role("button", name=title, exact=False).click()
                        expect(full).to_have_attribute("aria-pressed", "true")
                        expect(page.locator(".fi-chart-goal-detail")).to_contain_text("Outside chart range")
                        assert page.locator(".fi-goal-guide").count() == 0
                    summer.click()
                    fits(page)
                    bounds = page.locator(".fi-chart-plot").bounding_box()
                    page.locator(".fi-chart-plot").click(position={"x": bounds["width"] * 0.7, "y": 100})
                    expect(output).to_contain_text("Projected")
                    if width in [390, 1440]:
                        page.screenshot(path=str(root / f"fi-chart-{width}-{theme}.png"), full_page=True)
                    if width == 1440:
                        page.add_style_tag(content="html {font-size:200%!important} body {font-size:28px!important}")
                        fits(page)
                checks.append(f"{width}px {theme} {scenario}: fit, keyboard inspection, correct state" + (", goal selection and range" if scenario == "normal" else ""))

    page.emulate_media(forced_colors="active")
    page.goto((root / "chart-lab.html").as_uri())
    page.get_by_role("button", name="A longer summer abroad", exact=False).click()
    fits(page)
    page.screenshot(path=str(root / "fi-chart-forced-colors.png"), full_page=True)
    page.emulate_media(media="print", forced_colors="none")
    fits(page)
    checks.append("Forced colors and print: selected goal and chart fit")

    touch = browser.new_page(viewport={"width": 390, "height": 900}, has_touch=True, is_mobile=True)
    touch.goto((root / "chart-lab.html").as_uri())
    expect(touch.locator(".fi-chart")).to_be_visible()
    touch.get_by_role("button", name="Next 5 years", exact=True).tap()
    touch.get_by_role("button", name="A longer summer abroad", exact=False).tap()
    expect(touch.locator(".fi-chart-goal-detail")).to_contain_text("Jun 1, 2027")
    plot = touch.locator(".fi-chart-plot")
    plot.scroll_into_view_if_needed()
    bounds = plot.bounding_box()
    touch.touchscreen.tap(bounds["x"] + bounds["width"] * 0.85, bounds["y"] + 100)
    expect(touch.locator(".fi-chart-inspector output")).to_contain_text("Projected")
    fits(touch)
    checks.append("Touch: view selection, target details, point inspection")
    browser.close()

assert not errors, errors
assert not external, external
(root / "chart-results.json").write_text(json.dumps({"passed": len(checks), "checks": checks, "errors": errors, "externalRequests": external}, indent=2))
print(json.dumps({"passed": len(checks), "scope": "Synthetic FI chart QA, not authenticated E2E", "errors": errors, "externalRequests": external}))
