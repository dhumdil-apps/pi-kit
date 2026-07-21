# Session Dashboard

Startup banner for interactive parent sessions. Its hero starts with the bold
“Measure twice, cut once” line, followed by a standalone blue ASCII ruler that
marks π between 3 and 4 and an invitation that sets expectations for discovery,
plan approval, implementation, and polish.

The extension deck follows the hero and groups every active extension as UI,
Flow, or Config. Extension names are read live from the bundle's `package.json`;
`extensions.ts` supplies the user-facing group/order/description for each active
extension, and its focused test requires an exact one-to-one match with that
manifest.

A compact, responsive “Session context” card closes the dashboard. It combines
git context (branch and status), the spend summary from `usage-history`'s
`collectUsageData`, loaded context files, skills and prompts, and shortcut help.
Context files come from pi core's `loadProjectContextFiles`, so the list always
matches what is actually loaded. Labels align across sections, additional
resource values use indented continuation rows, and long values wrap within the
available terminal width. Terminal-visible widths keep emoji and ANSI styling
inside the border; unavailable spend and resource sections are omitted.

The dashboard does not duplicate the Progress Tracker phase ribbon.

## User surface

Automatic on interactive session start; no tools or commands.

## Origin

Bundle-local.
