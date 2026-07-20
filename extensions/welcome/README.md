# Welcome

Startup banner for interactive parent sessions: a box-drawn "command deck"
panel with git context (branch, status) and a spend summary (reusing
`usage-extension`'s `collectUsageData`), followed by the info pi's default
(non-quiet) startup listing would show — grouped, descriptive loaded
extensions, context files, skills, and prompts. Extension names are read live
from the bundle's `package.json`; `extensions.ts` supplies the user-facing
group/order/description for each active extension, and its focused test
requires an exact one-to-one match with that manifest. Context files come from
pi core's `loadProjectContextFiles`, so the list always matches what is
actually loaded.

The extension deck groups every active extension as UI, Flow, or Config. It
appears after the workflow prompt and before the shortcut row, keeping the
welcome screen scannable without hiding automatic extensions or the direct tools
and commands available to the user.

## User surface

Automatic on interactive session start; no tools or commands.

## Origin

Bundle-local.
