# Session Dashboard

Startup banner for interactive parent sessions: a box-drawn "command deck"
standalone blue ASCII ruler that marks π between 3 and 4, with “Measure twice,
cut once” below. Context and bundle resources follow, then a separate panel shows git context
(branch, status) and a spend summary (reusing
`usage-history`'s `collectUsageData`), followed by the info pi's default
(non-quiet) startup listing would show — grouped, descriptive loaded
extensions, context files, skills, and prompts. Extension names are read live
from the bundle's `package.json`; `extensions.ts` supplies the user-facing
group/order/description for each active extension, and its focused test
requires an exact one-to-one match with that manifest. Context files come from
pi core's `loadProjectContextFiles`, so the list always matches what is
actually loaded.

The extension deck groups every active extension as UI, Flow, or Config. It
appears before the shortcut row; the dashboard ends with an invitation that
sets expectations for discovery, plan approval, implementation, and polish,
without duplicating the Progress Tracker phase ribbon.

## User surface

Automatic on interactive session start; no tools or commands.

## Origin

Bundle-local.
