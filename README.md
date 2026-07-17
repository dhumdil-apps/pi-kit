# pi-bundle

A single, vendored [Pi](https://pi.dev) package maintained by `dhumdil-apps`.
It includes the active extensions and the Ask User skill previously installed as
separate packages.

## Install

```bash
pi install git:git@github.com:dhumdil-apps/pi-bundle.git
```

For a local test without changing settings:

```bash
pi -ne -e /absolute/path/to/pi-bundle
```

Start a fresh Pi invocation after local edits; `-e` is intended for quick tests.

## Updating an installed bundle

After committing and pushing changes, update the installed Git package:

```bash
pi update --extension git:git@github.com:dhumdil-apps/pi-bundle.git
```

Restart Pi after updating.

## Development

Edit the source under `extensions/` or `skills/`. Keep upstream provenance in
[`UPSTREAM.md`](UPSTREAM.md) when importing updates.
