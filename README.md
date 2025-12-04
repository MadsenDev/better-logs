# Better Logs

A simple VS Code extension that makes console logging faster and cleaning logs effortless.

## Features
- **Insert formatted console.log** (`betterLogs.insertConsoleLog`)
  - Uses the current selection or the word under the cursor as the expression.
  - Inserts `console.log("[<file>:<line>] <name>:", <name>);` on the next line with matching indentation.
- **Insert console.log with templates** (`betterLogs.insertConsoleLogWithTemplate`)
  - Prompts for a template (standard log, warn, error, JSON, or timestamped) before inserting.
  - Respects the current selection/word and indentation, adjusting the log format to match the chosen template.
- **Trim all console.log statements** (`betterLogs.trimConsoleLogs`)
  - Removes every `console.log(...)` statement in the active file using an AST walk that respects multi-line logs and trailing comments.
  - Shows a friendly message when no logs are found.
- **Toggle mute on console.log statements** (`betterLogs.toggleConsoleLogsMuted`)
  - Comments out each console log statement (single or multi-line) so it no longer runs; run again to uncomment and restore.
  - Uses the same AST-based scan as trimming to locate logs accurately.

## Settings
- `betterLogs.trimOnSave` (default: `false`)
  - When enabled, the extension automatically removes `console.log` statements from supported JavaScript and TypeScript files on save.
  - Turn it on in your VS Code settings or set in `settings.json`: `{"betterLogs.trimOnSave": true}`. Set to `false` to disable.

## Keybindings
- `Ctrl+Alt+L` (`Cmd+Alt+L` on macOS) — Insert formatted console.log
- `Ctrl+Alt+T` (`Cmd+Alt+T` on macOS) — Insert console.log with templates
- `Ctrl+Alt+Shift+L` (`Cmd+Alt+Shift+L` on macOS) — Remove console.log statements
- `Ctrl+Alt+M` (`Cmd+Alt+M` on macOS) — Toggle mute/unmute console.log statements

## Requirements
- VS Code 1.80.0 or newer
- Node.js for compiling the extension

## Development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Compile the extension:
   ```bash
   npm run compile
   ```
3. Launch the **Extension Development Host** in VS Code to test the commands.

Compiled JavaScript outputs to the `out/` directory.
