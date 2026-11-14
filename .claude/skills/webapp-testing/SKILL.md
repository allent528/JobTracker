---
name: webapp-testing
description: Test a local web app (or an Expo app's web build) in a real browser using Python Playwright. Captures screenshots, console errors, and checks that pages render and flows work. Use when verifying web UI changes or debugging browser behavior.
---

# Web App Testing (Playwright, Python)

Use this for any web app in the repo and, optionally, an Expo app's web build. It does **not** test native mobile apps; those need a device or simulator.

## One-time setup (check first, install only if missing)
```bash
python -c "import playwright" 2>/dev/null && echo installed || echo missing
# if missing:
python -m pip install playwright
python -m playwright install chromium
```

## 1. Make sure the server is running
1. Check whether something is already listening: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
2. If not, start it with the Bash tool using `run_in_background: true` (e.g. `npm run dev`). Use the command from the "Commands" section of `.claude/CLAUDE.md`.
3. Poll until it answers (Monitor tool, or a short curl loop). Don't use a fixed sleep.
4. Stop the background server when you're done if you started it.

## 2. Write the script in the scratchpad directory, not the repo
Save scripts and screenshots in the session scratchpad directory (never inside the repo; on Windows `/tmp` may not exist).

```python
import sys
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
out = sys.argv[2] if len(sys.argv) > 2 else "shot.png"
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.goto(url)
    page.wait_for_load_state("networkidle")   # wait for JS before inspecting
    page.screenshot(path=out, full_page=True)
    print("TITLE:", page.title())
    print("BUTTONS:", [b.inner_text() for b in page.get_by_role("button").all()][:20])
    print("ERRORS:", errors or "none")
    browser.close()
```
Run it with `python -I <script> <url> <screenshot path>`, then open the screenshot with the Read tool to look at it.

## 3. Reconnaissance, then action
1. Load the page, wait for `networkidle`, and take a screenshot and/or list roles and text.
2. Choose selectors from what actually rendered. Prefer `get_by_role`, `get_by_label`, then `get_by_text`, then CSS.
3. Run the flow (fill, click, `expect`), and take a screenshot after each meaningful step.

## Auth notes
- Pages behind login need a seeded test account. Never use real credentials, and never put credentials in a committed file.
- Report console errors and failed network requests (`page.on("requestfailed", ...)`) as findings even if the page looks fine.
