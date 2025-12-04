# Better Logs

A simple VS Code extension that makes console logging faster and cleaning logs effortless.

## Features
- **Insert formatted console.log** (`betterLogs.insertConsoleLog`)
  - Uses the current selection or the word under the cursor as the expression.
  - Inserts `console.log("[<file>:<line>] <name>:", <name>);` on the next line with matching indentation.
- **Trim all console.log statements** (`betterLogs.trimConsoleLogs`)
  - Removes every `console.log(...)` line in the active file using a regex scan.
  - Shows a friendly message when no logs are found.

## Keybindings
- `Ctrl+Alt+L` (`Cmd+Alt+L` on macOS) — Insert formatted console.log
- `Ctrl+Alt+Shift+L` (`Cmd+Alt+Shift+L` on macOS) — Remove console.log statements

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
