# Freedom-four design concepts

Open `index.html` to compare three standalone, offline directions:

- **A · Fieldnotes:** warm editorial typography, open space, restrained surfaces.
- **B · Control Room:** dark, compact, persistent navigation, data-first.
- **C · Compass:** bright, more color, a slim navigation rail, spacious panels.

Each file includes Overview, Financial, Location, Time, and Health. Use the
navigation to switch views, and A/B/C in the preview bar to switch concepts.
The same fictional data appears throughout. Nothing connects to the app,
reads your finances, saves inputs, or sends network requests.

These are visual studies, not a finished redesign. They do not replace the
current application's design guidelines. Choose a direction before changing
production components, routes, or styles.

`build.py` embeds the local fonts and generates the four HTML files from the
CSS sources and comparison template. It requires `--font-bundle` (Atlas's
embedded font CSS) and `--app-css` (the built Four Freedoms font stylesheet).
Use `--refresh` only to regenerate these derived concept files. Edit the
generator, CSS, or template rather than the generated HTML.

`python3 design-concepts/qa.py` runs isolated headless Chromium checks with
the existing Python Playwright installation. Screenshots and results are
saved in a new directory under `screenshots/` on each run.
