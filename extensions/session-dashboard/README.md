# Session Dashboard

Startup banner for interactive parent sessions.

The dashboard opens with the extension deck, which groups every active extension
as UI, Flow, or Config. Extension names are read live from the bundle's
`package.json`; `extensions.ts` supplies the user-facing group/order/description
for each active extension, and its focused test requires an exact one-to-one
match with that manifest.

A "This Week · Per bucket cost · by provider" usage chart follows the deck: a
non-interactive braille line chart built from `usage-history`'s `buildGraphModel`
and `renderChart`, showing this week's spend by provider (with a "No usage yet
this week" fallback). It is omitted when usage data is unavailable.

A few slim, plain-markdown lines close the dashboard: the working directory
(tildified), the loaded context files (`📜 …`, from pi core's
`loadProjectContextFiles` so the list always matches what is actually loaded),
and a reminder of the workflow commands the extension deck does not already spell
out (`⚡ /flash · 🪞 /retro · 🔬 /forensic · 🌱 /init`, a static constant). Git
branch/status are intentionally not repeated here — the status bar already shows
them persistently.

The dashboard does not duplicate the Progress Tracker phase ribbon.

## User surface

Automatic on interactive session start; no tools or commands.

## Origin

Bundle-local.
