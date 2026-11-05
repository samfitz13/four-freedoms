"""Actual overlaid FI scenarios with disconnected, synthetic inputs."""
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
    assert page.locator(".fi-scenarios").evaluate("(e)=>e.scrollWidth<=e.clientWidth+1")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(reduced_motion="reduce")
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("request", lambda request: external.append(request.url) if request.url.startswith(("http:", "https:")) else None)
    for width in [320, 390, 768, 1024, 1440]:
        page.set_viewport_size({"width": width, "height": 1000})
        for theme in ["light", "dark"]:
            for case in ["normal", "short", "none", "negative", "met", "horizon", "age", "retirement", "short-retirement"]:
                page.goto((root / "scenario-lab.html").as_uri() + f"?case={case}")
                page.evaluate("(theme)=>document.documentElement.className=theme", theme)
                page.evaluate("()=>document.fonts.ready")
                legend = page.locator(".fi-scenario-options")
                expect(legend).to_be_visible()
                assert legend.locator("button").count() == 0
                assert legend.locator("dt").count() == 3
                fits(page)
                assert page.locator('input[type="range"]').count() == 0
                lines = page.locator(".fi-chart-plot .fi-scenario-line")
                assert lines.count() == 3
                assert all(pattern == "none" for pattern in lines.evaluate_all("(els)=>els.map(e=>getComputedStyle(e).strokeDasharray)"))
                assert len(set(lines.evaluate_all("(els)=>els.map(e=>getComputedStyle(e).stroke)"))) == lines.count()
                assert page.locator(".fi-scenario-endpoint").count() == lines.count()
                assert page.locator(".fi-scenario-history,.fi-scenario-detail").count() == 0
                assert "not a guarantee" not in page.locator(".fi-scenarios").inner_text()
                if case in ["short", "none"]:
                    expect(legend).to_contain_text("7.0% real / yr")
                    assert page.locator(".fi-scenario-line.fi-line-historical").count() == 0
                elif case == "negative":
                    expect(legend).to_contain_text("7.0% real / yr")
                elif case == "met":
                    assert legend.get_by_text("FI reached", exact=True).count() == 3
                    assert page.locator(".fi-chart-plot .fi-crossing-point").count() == 3
                inspect = page.get_by_role("slider", name="Inspect investment balance")
                inspect.focus()
                page.keyboard.press("Home")
                expect(page.locator(".fi-chart-inspector output")).to_contain_text("Recorded invested balance · $150,000")
                page.keyboard.press("End")
                assert inspect.get_attribute("aria-valuetext") == page.locator(".fi-chart-inspector output").inner_text()
                if case == "age":
                    expect(legend).to_contain_text("FI · Age 54y 3m")
                    expect(page.locator(".fi-chart-x-axis")).to_contain_text("Age ")
                    expect(page.locator(".fi-chart-inspector output")).to_contain_text("Age 85y 7m")
                elif case not in ["retirement", "short-retirement"]:
                    expect(page.locator(".fi-chart-inspector output")).to_contain_text("Oct 2076")
                if case in ["retirement", "short-retirement"]:
                    assert page.locator(".fi-retirement-marker").count() == 1
                    page.locator(".fi-stress summary").click()
                    if case == "retirement":
                        assert page.locator(".fi-stress tbody tr").count() == 2
                        assert page.locator(".fi-depletion-marker").count() >= 1
                        expect(page.locator(".fi-chart-inspector output")).to_contain_text("cumulative")
                    else:
                        expect(page.locator(".fi-stress")).to_contain_text("does not contain both full shock years")
                        assert page.locator(".fi-stress tbody tr").count() == 0
                    fits(page)
                if case == "normal":
                    expect(legend).to_contain_text("5.0% real / yr")
                    expect(legend).to_contain_text("3.0% real / yr")
                    expect(legend).to_contain_text("7.0% real / yr")
                    crossings = {kind: page.locator(f".fi-chart-plot .fi-crossing-{kind}").evaluate("(e)=>e.getBBox().x") for kind in ["base", "downside", "upside"]}
                    assert crossings["upside"] < crossings["base"] < crossings["downside"]
                    ends = page.locator(".fi-scenario-endpoint").evaluate_all("(els)=>els.map(e=>e.getBBox().x+e.getBBox().width/2)")
                    assert max(ends) - min(ends) < 0.01
                    assert ends[0] > crossings["downside"]
                    assert len(set(page.locator(".fi-scenario-endpoint").evaluate_all("(els)=>els.map(e=>e.getAttribute('d'))"))) == 3
                    for kind in ["base", "downside", "upside"]:
                        stroke = page.locator(f".fi-chart-plot .fi-line-{kind}").evaluate("(e)=>getComputedStyle(e).stroke")
                        fill = page.locator(f".fi-chart-plot .fi-crossing-{kind}").evaluate("(e)=>getComputedStyle(e).fill")
                        assert stroke == fill
                    page.get_by_role("button", name="Next 5 years", exact=True).click()
                    page.get_by_role("button", name="A longer summer abroad", exact=False).click()
                    output = page.locator(".fi-chart-inspector output")
                    expect(output).to_contain_text("Jun 2027")
                    for title in ["Base", "Downside", "Upside"]:
                        expect(output).to_contain_text(title)
                    ys = {kind: float(page.locator(f".fi-inspection-{kind}").get_attribute("cy")) for kind in ["base", "downside", "upside"]}
                    assert ys["upside"] < ys["base"] < ys["downside"]
                    xs = [float(value) for value in page.locator(".fi-inspection-point").evaluate_all("(els)=>els.map(e=>e.getAttribute('cx'))")]
                    assert max(xs) - min(xs) < 0.01
                    expect(page.locator(".fi-chart-goal-detail")).to_contain_text("Target $20,000 · Target date Jun 1, 2027")
                    assert lines.count() == 3
                    if width in [390, 1440]:
                        page.get_by_role("button", name="Full plan", exact=True).click()
                        page.screenshot(path=str(root / f"fi-scenarios-{width}-{theme}.png"), full_page=True)
                    if width == 1440:
                        page.add_style_tag(content="html {font-size:200%!important} body {font-size:28px!important}")
                        fits(page)
                assert page.evaluate("()=>!globalThis.__qaGoalActions?.length")
                checks.append(f"{width}px {theme} {case}: simultaneous lines, common scale, exact values and fit")

    page.emulate_media(forced_colors="active")
    page.goto((root / "scenario-lab.html").as_uri())
    patterns = page.locator(".fi-chart-plot .fi-scenario-line").evaluate_all("(els)=>els.map(e=>getComputedStyle(e).strokeDasharray)")
    assert len(set(patterns)) == 3
    fits(page)
    page.screenshot(path=str(root / "fi-scenarios-forced-colors.png"), full_page=True)
    page.emulate_media(media="print", forced_colors="none")
    fits(page)
    checks.append("Forced colors and print: three distinguishable line patterns")
    touch = browser.new_page(viewport={"width": 390, "height": 900}, has_touch=True, is_mobile=True)
    touch.goto((root / "scenario-lab.html").as_uri())
    touch.get_by_role("button", name="Next 5 years", exact=True).tap()
    touch.get_by_role("button", name="A longer summer abroad", exact=False).tap()
    for title in ["Base", "Downside", "Upside"]:
        expect(touch.locator(".fi-chart-inspector output")).to_contain_text(title)
    fits(touch)
    checks.append("Touch: shared-month inspection of all three returns")
    browser.close()

assert not errors, errors
assert not external, external
(root / "scenario-results.json").write_text(json.dumps({"passed": len(checks), "checks": checks, "errors": errors, "externalRequests": external}, indent=2))
print(json.dumps({"passed": len(checks), "scope": "Synthetic FI scenario QA, not authenticated E2E", "errors": errors, "externalRequests": external}))
