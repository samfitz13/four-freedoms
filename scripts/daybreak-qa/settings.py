"""Settings profile and appearance, using disconnected actions."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(sys.argv[1]).resolve()
checks = []
errors = []


def fits(page):
    assert not page.evaluate("()=>document.documentElement.scrollWidth>innerWidth+1")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(reduced_motion="reduce")
    page.on("pageerror", lambda error: errors.append(str(error)))
    for width in [320, 390, 768, 1440]:
        page.set_viewport_size({"width": width, "height": 1000})
        for theme in ["light", "dark"]:
            page.goto((root / "settings.html").as_uri())
            page.evaluate("(theme)=>document.documentElement.className=theme", theme)
            assert page.locator(".daybreak-shell-top button").count() == 0
            expect(page.get_by_role("region", name="Appearance")).to_be_visible()
            expect(page.get_by_label("Date of birth", exact=True)).to_be_visible()
            expect(page.get_by_role("button", name="Dark mode", exact=True)).to_be_visible()
            fits(page)
            page.goto((root / "settings-lab.html").as_uri())
            page.evaluate("(theme)=>{localStorage.clear();document.documentElement.className=theme;document.documentElement.dataset.glass='full'}", theme)
            birth = page.get_by_label("Date of birth", exact=True)
            expect(birth).to_have_value("1991-02-15")
            birth.fill("2027-01-01")
            page.get_by_role("button", name="Save birth date", exact=True).click()
            assert page.evaluate("()=>!globalThis.__qaProfileActions?.length")
            birth.fill("1992-03-20")
            page.evaluate("()=>globalThis.__qaFailProfileAction=true")
            page.get_by_role("button", name="Save birth date", exact=True).click()
            expect(page.get_by_role("alert")).to_have_text("Synthetic profile validation error")
            expect(birth).to_have_value("1992-03-20")
            page.evaluate("()=>{globalThis.__qaFailProfileAction=false;globalThis.__qaPauseProfileAction=true}")
            page.get_by_role("button", name="Save birth date", exact=True).click()
            expect(page.get_by_role("button", name="Saving…", exact=True)).to_be_disabled()
            page.evaluate("()=>{globalThis.__qaPauseProfileAction=false;globalThis.__qaResolveProfileAction()}")
            expect(page.get_by_role("status")).to_have_text("Saved.")
            expect(birth).to_have_value("1992-03-20")
            assert page.evaluate("()=>globalThis.__qaProfileActions.at(-1).birthDate") == "1992-03-20"
            birth.fill("")
            page.get_by_role("button", name="Save birth date", exact=True).click()
            expect(page.get_by_role("status")).to_have_text("Saved.")
            assert page.evaluate("()=>globalThis.__qaProfileActions.at(-1).birthDate") == ""
            dark = page.get_by_role("button", name="Dark mode", exact=True)
            expect(dark).to_have_attribute("aria-pressed", str(theme == "dark").lower())
            dark.click()
            assert page.evaluate("()=>localStorage.getItem('freedom-four-theme')") == ("light" if theme == "dark" else "dark")
            page.get_by_role("button", name="Reduce glass", exact=True).click()
            assert page.evaluate("()=>localStorage.getItem('freedom-four-glass')") == "solid"
            page.reload()
            expect(page.get_by_role("button", name="Restore glass", exact=True)).to_have_attribute("aria-pressed", "true")
            expect(dark).to_have_attribute("aria-pressed", str(theme != "dark").lower())
            fits(page)
            if width in [390, 1440]:
                page.screenshot(path=str(root / f"settings-profile-{width}-{theme}.png"), full_page=True)
            if width == 1440:
                page.add_style_tag(content="html {font-size:200%!important} body {font-size:28px!important}")
                fits(page)
            checks.append(f"{width}px {theme}: settings placement, profile validation/retention/pending/clear, theme and glass persistence")
    browser.close()
assert not errors, errors
(root / "settings-results.json").write_text(json.dumps({"passed": len(checks), "errors": errors, "checks": checks}, indent=2))
print(json.dumps({"passed": len(checks), "errors": errors, "scope": "Synthetic settings QA, not authenticated E2E"}))
