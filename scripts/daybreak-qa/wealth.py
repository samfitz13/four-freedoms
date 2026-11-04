"""Wealth labels and allocation separation, using synthetic rendered components."""
import json
import math
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(sys.argv[1]).resolve()
checks = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(reduced_motion="reduce")
    for width in [320, 390, 768, 1440]:
        for theme in ["light", "dark"]:
            page.set_viewport_size({"width": width, "height": 1000})
            page.goto((root / "financial-tab-wealth.html").as_uri())
            page.evaluate("(theme)=>document.documentElement.className=theme", theme)
            expect(page.get_by_text("Year to date", exact=True)).to_be_visible()
            assert page.get_by_text("Since start", exact=True).count() == 0
            chart = page.get_by_role("img", name="Asset allocation by account type", exact=False)
            segments = chart.locator('[data-slot="allocation-segment"]')
            assert segments.count() == 5
            assert chart.locator('[data-slot="allocation-separator"]').count() == 5
            assert "retirement 42%" in chart.get_attribute("aria-label")
            colors = segments.evaluate_all("""(elements)=>{
                const canvas=document.createElement('canvas');
                canvas.width=canvas.height=1;
                const ctx=canvas.getContext('2d');
                return elements.map(e=>{
                    ctx.clearRect(0,0,1,1);
                    ctx.fillStyle=getComputedStyle(e).stroke;
                    ctx.fillRect(0,0,1,1);
                    return [...ctx.getImageData(0,0,1,1).data].slice(0,3);
                });
            }""")
            minimum = min(
                math.dist(a, b) for i, a in enumerate(colors) for b in colors[i + 1:]
            )
            assert minimum >= 60, (theme, colors, minimum)
            # Color-independent names and percentages remain visible beside the ring.
            expect(chart.locator("..").get_by_text("retirement", exact=True)).to_be_visible()
            expect(chart.locator("..").get_by_text("equity comp", exact=True)).to_be_visible()
            assert not page.evaluate("()=>document.documentElement.scrollWidth>innerWidth+1")
            if width in [390, 1440]:
                page.screenshot(path=str(root / f"wealth-{width}-{theme}.png"), full_page=True)
            checks.append(f"{width}px {theme}: YTD label, five distinct colors, slice boundaries, and visible legend")
    browser.close()

result = {"passed": len(checks), "checks": checks, "scope": "Synthetic component checks, not authenticated E2E or color-blindness certification"}
(root / "wealth-results.json").write_text(json.dumps(result, indent=2))
print(json.dumps(result, indent=2))
