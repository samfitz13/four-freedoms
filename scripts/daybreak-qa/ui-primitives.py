"""Radix migration regressions with disconnected component fixtures only."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(sys.argv[1]).resolve()
checks, errors = [], []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(reduced_motion="reduce")
    page.on("pageerror", lambda error: errors.append(str(error)))
    for width in [320, 390, 1440]:
        for theme in ["light", "dark"]:
            page.set_viewport_size({"width": width, "height": 1000})
            page.goto((root / "lab.html").as_uri())
            page.evaluate("(theme)=>document.documentElement.className=theme", theme)

            # Route tabs retain normal link semantics and native browser options.
            navigation = page.get_by_role("navigation", name="Fixture sections")
            expect(navigation.get_by_role("link", name="Overview")).to_have_attribute("aria-current", "page")
            expect(navigation.get_by_role("link", name="Accounts")).to_have_attribute("href", "/financial/accounts")
            expect(page.get_by_role("link", name="Jump to fields")).to_have_attribute("data-slot", "button")
            page.get_by_role("button", name="Non-submitting button").click()
            expect(page.get_by_label("Menu submission count")).to_have_text("0")
            selection = page.get_by_label("Shared selection")
            expect(selection).to_have_value("second")
            selection.select_option("first")
            page.get_by_label("Shared notes").fill("Synthetic notes")
            assert page.get_by_label("Shared notes").evaluate("(e)=>new FormData(e.form).get('notes')") == "Synthetic notes"
            expect(page.locator("#menu-required")).to_have_attribute("data-slot", "input")

            # Portaled menu items must retain their original form and validation.
            trigger = page.get_by_role("button", name="Form row actions")
            trigger.click()
            page.get_by_role("menuitem", name="Submit sample form").click()
            expect(page.get_by_label("Menu submission count")).to_have_text("0")
            expect(page.get_by_label("Required menu value")).to_be_focused()
            page.get_by_label("Required menu value").fill("Synthetic value")
            trigger.focus()
            page.keyboard.press("ArrowDown")
            page.keyboard.press("Enter")
            expect(page.get_by_label("Menu submission count")).to_have_text("1")
            expect(trigger).to_be_focused()

            # Pointer-open menus support outside dismissal, typeahead, and Home/End.
            trigger = page.get_by_role("button", name="Sample row actions")
            trigger.click()
            menu = page.get_by_role("menu")
            expect(menu).to_be_visible()
            page.get_by_role("heading", name="Accounts", exact=True).click()
            expect(menu).to_have_count(0)
            trigger.focus()
            page.keyboard.press("ArrowDown")
            page.keyboard.press("End")
            expect(page.get_by_role("menuitem", name="Close menu")).to_be_focused()
            page.keyboard.press("Home")
            expect(page.get_by_role("menuitem", name="Edit sample")).to_be_focused()
            page.keyboard.press("c")
            expect(page.get_by_role("menuitem", name="Close menu")).to_be_focused()
            page.keyboard.press("Home")
            expect(page.get_by_role("menuitem", name="Edit sample")).to_be_focused()
            page.keyboard.press("Enter")

            # Opening a dialog from a menu must not lose or steal focus.
            dialog = page.get_by_role("dialog", name="A home for an account")
            expect(dialog).to_be_visible()
            assert dialog.get_attribute("aria-describedby")
            page.wait_for_function('()=>document.activeElement.closest("[role=dialog]")!==null')
            page.keyboard.press("Tab")
            assert page.evaluate('()=>document.activeElement.closest("[role=dialog]")!==null')
            page.keyboard.press("Escape")
            expect(dialog).to_have_count(0)
            expect(trigger).to_be_focused()

            # Menus and nested dialogs work above a modal; Escape closes only the top.
            opener = page.get_by_role("button", name="Open account dialog")
            opener.click()
            # A calendar consumes only its own Escape and does not rename its buttons.
            date = dialog.get_by_label("Dialog date", exact=True)
            date.focus()
            expect(dialog.locator(".daybreak-date-popover")).to_be_visible()
            expect(dialog.get_by_role("button", name="Previous month", exact=True)).to_be_visible()
            page.keyboard.press("Escape")
            expect(dialog.locator(".daybreak-date-popover")).to_have_count(0)
            expect(dialog).to_be_visible()
            expect(date).to_be_focused()
            dialog.get_by_role("button", name="Remove sample", exact=True).click()
            dialog.get_by_role("button", name="Remove sample?", exact=True).focus()
            page.keyboard.press("Escape")
            expect(dialog.get_by_role("button", name="Remove sample", exact=True)).to_be_visible()
            expect(dialog).to_be_visible()
            nested_trigger = dialog.get_by_role("button", name="Dialog row actions")
            nested_trigger.focus()
            page.keyboard.press("ArrowDown")
            expect(page.get_by_role("menuitem", name="Open nested dialog")).to_be_focused()
            page.keyboard.press("Escape")
            expect(dialog).to_be_visible()
            expect(nested_trigger).to_be_focused()
            page.keyboard.press("ArrowDown")
            expect(page.get_by_role("menuitem", name="Open nested dialog")).to_be_focused()
            page.keyboard.press("Enter")
            nested = page.get_by_role("dialog", name="Nested sample", exact=True)
            expect(nested).to_be_visible()
            expect(nested.get_by_role("button", name="Close dialog")).to_be_focused()
            page.keyboard.press("Escape")
            expect(nested).to_have_count(0)
            expect(dialog).to_be_visible()
            expect(nested_trigger).to_be_focused()
            dialog.get_by_role("button", name="Close dialog", exact=True).click()
            expect(dialog).to_have_count(0)
            expect(opener).to_be_focused()

            opener.click()
            page.locator(".daybreak-dialog-overlay").click(position={"x": 2, "y": 2})
            expect(dialog).to_have_count(0)
            expect(opener).to_be_focused()
            assert not page.evaluate("()=>document.documentElement.scrollWidth>innerWidth+1")
            checks.append(f"{width}px {theme}: shared controls, route links, form menus, focus, nested overlays, and dismissal")
    browser.close()

assert not errors, errors
result = {"passed": len(checks), "checks": checks, "javascriptErrors": errors}
(root / "ui-primitives-results.json").write_text(json.dumps(result, indent=2))
print(json.dumps(result, indent=2))
