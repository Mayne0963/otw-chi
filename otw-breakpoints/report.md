# OTW breakpoint check (Desktop / Tablet / Mobile)

URL tested: https://otw-chi-two.vercel.app/

## What I could validate here

1) **Visual desktop pass (screenshot)**  
- Full-page screenshot: [desktop.png](./desktop.png)

2) **Responsive behavior from code (Tailwind breakpoints)**
- Marketing homepage uses `sm:`, `md:`, `lg:` responsive classes for typography, layout, and grids (e.g. hero type scale and tiles grid).
- Marketing navigation switches from a desktop nav (`hidden md:flex`) to a mobile slide-over menu (`md:hidden` + Sheet component).

## What I could NOT do in this environment (and why)

I wasn’t able to run an automated browser with a custom viewport (Playwright/Chromium) because the runtime is missing required system libraries (e.g. `libatk-1.0.so.0`), and installing OS packages failed due to repository/DNS resolution issues. The built-in browser tooling can capture screenshots, but **doesn’t expose viewport resizing**, so I can’t reliably produce “real” tablet/mobile-width renders here.

## Recommended: run the included Playwright breakpoint script locally

I added a small script that will:
- load the URL at Desktop/Tablet/Mobile viewports
- capture above-the-fold + full-page screenshots
- capture console + page errors
- detect basic horizontal overflow

Files:
- [playwright_breakpoints_test.py](./playwright_breakpoints_test.py)

Run:
```bash
cd otw-breakpoints
python3 -m pip install playwright
python3 -m playwright install chromium
python3 playwright_breakpoints_test.py
```

Outputs:
- `./shots/desktop-*.png`, `./shots/tablet-*.png`, `./shots/mobile-*.png`
- `./results.json`

If you’d like, paste the resulting `results.json` + any screenshots you want reviewed, and I’ll annotate specific responsive issues (spacing, type scale, nav behavior, overflows, etc.).

