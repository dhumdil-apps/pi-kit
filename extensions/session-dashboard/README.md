# Session Dashboard

Startup banner for interactive parent sessions.

The dashboard opens with `π **Measure twice, cut once.**` — a static,
theme-rendered welcome that keeps startup focused. `extensions.ts` still supplies
the grouped metadata and descriptions for `/help`; its focused test requires an
exact one-to-one match with the active extension manifest.

A "Last 30 Days · Per bucket cost · by model" usage chart follows the welcome: a
non-interactive braille line chart built from `usage-history`'s `buildGraphModel`
and `renderChart`, showing the last 30 days' spend by model (with a "No usage in
the last 30 days" fallback). Its x-axis uses date labels. It is omitted when usage
data is unavailable.

One concise, plain-markdown line closes the dashboard, chips separated by ` · `:
the working directory and loaded context files (`📜 …`, italic / de-emphasised,
from pi core's `loadProjectContextFiles`) then `❓ /help`, rendered as code so it
pops. Git branch/status are intentionally not repeated here — the status bar
already shows them persistently.

`❓ /help` is the single pointer the banner needs: it prints a full reference —
commands, shortcuts, and every active extension with its complete description.
The help document is built by `help.ts` from the same
`EXTENSION_PRESENTATIONS` manifest and rendered in the banner's themed box.

The dashboard does not duplicate the Progress Tracker phase ribbon.

## User surface

Automatic on interactive session start. Provides `/help` — a reference of the
bundle's commands, shortcuts, and extensions.

## Origin

Bundle-local.
