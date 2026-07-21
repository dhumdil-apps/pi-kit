# Session Dashboard

Startup banner for interactive parent sessions.

The dashboard opens with the extension deck: one compact line per group
(`Display`, `Usage`, `Workflow`, `Guardrails`, `Config`) listing the active
extension names — no per-extension prose, so the banner stays short. Names are
read live from the bundle's `package.json`; `extensions.ts` supplies the
group/order for each active extension, and its focused test requires an exact
one-to-one match with that manifest.

A "This Week · Per bucket cost · by provider" usage chart follows the deck: a
non-interactive braille line chart built from `usage-history`'s `buildGraphModel`
and `renderChart`, showing this week's spend by provider (with a "No usage yet
this week" fallback). Its x-axis uses weekday + time labels so the ticks stay
distinct across a short week. It is omitted when usage data is unavailable.

A single slim, plain-markdown line closes the dashboard, every chip separated by
the same ` · `: the working directory and loaded context files (`📜 …`, italic /
de-emphasised, from pi core's `loadProjectContextFiles`) then the workflow
commands the deck does not spell out, rendered as code so they pop
(`⚡ /flash · 🪞 /retro · 🔬 /forensic · 🌱 /init`, a static constant). Git
branch/status are intentionally not repeated here — the status bar already shows
them persistently.

The dashboard does not duplicate the Progress Tracker phase ribbon.

## User surface

Automatic on interactive session start; no tools or commands.

## Origin

Bundle-local.
