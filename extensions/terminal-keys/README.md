# Terminal Keys

Makes "insert a newline" and "submit" behave the same in every terminal.

Pi binds `tui.input.newLine` to shift+enter and ctrl+j, but a terminal has to
report those keys distinctly for either to work. Ghostty does, through the Kitty
keyboard protocol. VS Code's terminal supports neither Kitty nor Pi's
`modifyOtherKeys` fallback, so shift+enter arrives as a bare `\r` and ctrl+j as
a bare `\n` — and Pi reads a bare `\n` as Enter whenever the Kitty protocol is
inactive. Both newline keys collapse onto submit, leaving no way to insert a
newline at all.

Pi packages cannot ship keybindings, so this extension rewrites the raw bytes
instead: terminal input listeners run before key dispatch and may replace the
chunk.

- **ctrl+enter → submit.** Only ever reported as a CSI u / `modifyOtherKeys`
  sequence, so it is unambiguous and always applied.
- **ctrl+j → newline.** A lone `\n` is rewritten to the CSI u sequence for
  shift+enter, which Pi parses whether or not the protocol was negotiated.

## User surface

Automatic in interactive TUI sessions. It registers no command or tool.

## Settings

`newline-on-ctrl-j` (`/extension-settings`) — `auto` (default), `always`, `off`.

`auto` applies the newline rewrite in VS Code and under the Kitty protocol: the
two cases where a bare `\n` provably means ctrl+j. A terminal in line-feed
newline mode sends `\n` for Enter too, and rewriting there would make
submitting impossible — hence the gate, and `always` for terminals you have
checked yourself.

Pasting is unaffected: a bracketed paste arrives as one chunk, and only a chunk
that is exactly `\n` is rewritten.

## Origin

Bundle-local.
