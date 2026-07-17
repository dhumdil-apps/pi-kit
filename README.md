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
pi -ne -e /path/to/pi-bundle
```

## Development

Edit the source under `extensions/` or `skills/`, then run `/reload` in Pi.
Keep upstream provenance in [`UPSTREAM.md`](UPSTREAM.md) when importing updates.
