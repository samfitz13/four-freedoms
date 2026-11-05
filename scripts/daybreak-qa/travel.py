"""Verify actual Travel components with disconnected, synthetic actions only."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(sys.argv[1]).resolve()
checks = []


def fits(page):
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(reduced_motion="reduce")
    page.set_default_timeout(5000)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    for width in [320, 390, 768, 1024, 1440]:
        page.set_viewport_size({"width": width, "height": 1100})
        for theme in ["light", "dark"]:
            page.goto((root / "travel-lab.html").as_uri())
            page.evaluate("(theme) => document.documentElement.className = theme", theme)
            page.evaluate("() => document.fonts.ready")
            expect(page.get_by_role("heading", name="A slower autumn")).to_be_visible()
            expect(page.get_by_text("Next departure", exact=True)).to_be_visible()
            expect(page.get_by_text("In 8 days", exact=True)).to_be_visible()
            assert page.locator("dl").inner_text().count("8") == 1
            expect(page.get_by_text("Budget EUR 2,400.00", exact=False)).to_be_visible()
            fits(page)
            if width in [390, 1440]:
                page.screenshot(path=str(root / f"travel-{width}-{theme}.png"), full_page=True)
            page.get_by_role("button", name="Past 1", exact=True).click()
            expect(page.get_by_role("heading", name="A summer by the river")).to_be_visible()
            expect(page.get_by_text("Budget USD 0.00", exact=False)).to_be_visible()
            page.get_by_role("button", name="All trips 3", exact=True).click()
            page.get_by_role("searchbox").fill("Kyoto")
            expect(page.get_by_role("heading", name="Spring in Kyoto")).to_be_visible()
            assert page.locator("article").count() == 1
            page.get_by_role("combobox", name="Trip year").select_option("2026")
            expect(page.get_by_text("No matching trips", exact=True)).to_be_visible()
            page.get_by_role("button", name="Clear filters").click()
            assert page.locator("article").count() == 3
            fits(page)
            checks.append(f"{width}px {theme}: itinerary, elapsed history, search, year, past, zero budget")

            page.get_by_role("button", name="Plan a trip", exact=True).click()
            creation = page.get_by_role("region", name="Plan a trip", exact=True)
            creation.get_by_label("Trip name", exact=True).fill("Synthetic journey")
            creation.get_by_label("First destination", exact=True).select_option("qa-lisbon")
            dates = creation.locator('input[placeholder="Select date"]')
            dates.nth(0).fill("2026-12-20")
            page.keyboard.press("Escape")
            dates.nth(1).fill("2026-12-10")
            page.keyboard.press("Escape")
            creation.get_by_role("button", name="Add trip", exact=True).click()
            expect(creation.get_by_role("status")).to_contain_text("end must be on or after")
            expect(creation.get_by_label("Trip name", exact=True)).to_have_value("Synthetic journey")
            dates.nth(1).fill("2026-12-30")
            page.keyboard.press("Escape")
            page.evaluate("globalThis.__qaFailTravelAction = true")
            creation.get_by_role("button", name="Add trip", exact=True).click()
            expect(creation.get_by_role("status")).to_contain_text("Couldn't save")
            expect(creation.get_by_label("Trip name", exact=True)).to_have_value("Synthetic journey")
            expect(creation.get_by_label("First destination", exact=True)).to_have_value("qa-lisbon")
            page.evaluate("globalThis.__qaFailTravelAction = false; globalThis.__qaPauseTravelAction = true")
            creation.get_by_role("button", name="Add trip", exact=True).click()
            expect(creation.get_by_role("button", name="Saving…")).to_be_disabled()
            page.evaluate("globalThis.__qaPauseTravelAction = false; globalThis.__qaResolveTravelAction()")
            expect(creation.get_by_role("status")).to_contain_text("Trip added")
            assert page.evaluate("globalThis.__qaTravelActions.at(-1).data.endsOn") == "2026-12-30"
            fits(page)
            if width == 320:
                page.screenshot(path=str(root / f"travel-form-{theme}.png"), full_page=True)
            page.get_by_role("button", name="Close new trip", exact=True).click()
            checks.append(f"{width}px {theme}: creation validation, retained input, error, pending, serialized dates")

            page.get_by_role("button", name="Upcoming 2", exact=True).click()
            row = page.locator("article").filter(has=page.get_by_role("heading", name="A slower autumn"))
            row.get_by_role("button", name="Edit trip", exact=True).click()
            edit = row.get_by_role("region", name="Edit A slower autumn")
            expect(edit.get_by_label("Trip name", exact=True)).to_have_value("A slower autumn")
            expect(edit.get_by_label("Planned budget (optional)", exact=True)).to_have_value("2400")
            edit.get_by_role("button", name="Save changes").click()
            expect(edit.get_by_role("status")).to_have_text("Trip updated.")
            assert page.evaluate("globalThis.__qaTravelActions.at(-1).data.id") == "qa-autumn"
            row.get_by_role("button", name="Archive A slower autumn", exact=True).click()
            row.get_by_role("button", name="Cancel", exact=True).click()
            row.get_by_role("button", name="Archive A slower autumn", exact=True).click()
            page.keyboard.press("Escape")
            expect(row.get_by_role("button", name="Archive A slower autumn", exact=True)).to_be_visible()
            row.get_by_role("button", name="Archive A slower autumn", exact=True).click()
            row.get_by_role("button", name="Confirm archive", exact=True).click()
            expect(row.get_by_role("button", name="Confirm archive", exact=True)).to_be_enabled()
            assert page.evaluate("globalThis.__qaTravelActions.at(-1).name") == "archiveTrip"
            fits(page)
            checks.append(f"{width}px {theme}: saved edit values, update, archive confirmation, Escape")

            page.get_by_role("button", name="Show empty fixture").click()
            expect(page.get_by_role("heading", name="Where would you like to go?")).to_be_visible()
            page.get_by_role("button", name="Plan a trip", exact=True).first.click()
            expect(page.get_by_role("link", name="Add a place")).to_be_visible()
            fits(page)
            if width == 1440:
                page.add_style_tag(content="html {font-size:200%!important}")
                fits(page)
            checks.append(f"{width}px {theme}: empty state and destination prerequisite")
    assert not errors, errors
    browser.close()

(root / "travel-results.json").write_text(json.dumps(checks, indent=2))
print(json.dumps({"passed": len(checks), "consoleErrors": errors, "output": str(root)}, indent=2))
