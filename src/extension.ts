import * as path from 'path';
import * as vscode from 'vscode';

function getExpression(editor: vscode.TextEditor): string {
  const { selection, document } = editor;

  if (!selection.isEmpty) {
    const selected = document.getText(selection).trim();
    return selected.length > 0 ? selected : 'value';
  }

  const wordRange = document.getWordRangeAtPosition(selection.active);
  if (wordRange) {
    return document.getText(wordRange);
  }

  return 'value';
}

function getInsertionDetails(editor: vscode.TextEditor): { position: vscode.Position; indentation: string } {
  const { selection, document } = editor;
  const targetLine = Math.min(selection.end.line, document.lineCount - 1);
  const insertionLine = selection.end.line + 1;
  const currentLineIndent = document.lineAt(targetLine).firstNonWhitespaceCharacterIndex;
  const indentation = document.lineAt(targetLine).text.slice(0, currentLineIndent);

  if (insertionLine > document.lineCount) {
    return { position: new vscode.Position(document.lineCount, 0), indentation };
  }

  const insertionColumn = indentation.length;

  return { position: new vscode.Position(insertionLine, insertionColumn), indentation };
}

function createConsoleLog(editor: vscode.TextEditor): string {
  const expression = getExpression(editor);
  const fileName = path.basename(editor.document.fileName);
  const lineNumber = editor.selection.active.line + 1;

  return `console.log("[${fileName}:${lineNumber}] ${expression}:", ${expression});`;
}

async function insertConsoleLog(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const logStatement = createConsoleLog(editor);
  const { position, indentation } = getInsertionDetails(editor);
  const textToInsert = `${indentation}${logStatement}\n`;

  await editor.edit((editBuilder) => {
    editBuilder.insert(position, textToInsert);
  });
}

async function trimConsoleLogs(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  const text = document.getText();
  const logRegex = /^\s*console\.log\([^;]*\);\s*$(\r?\n)?/gm;

  if (!logRegex.test(text)) {
    void vscode.window.showInformationMessage('No console.log statements found.');
    return;
  }

  const trimmedText = text.replace(logRegex, '');
  const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(text.length));

  await editor.edit((editBuilder) => {
    editBuilder.replace(fullRange, trimmedText);
  });
}

export function activate(context: vscode.ExtensionContext): void {
  const insertDisposable = vscode.commands.registerCommand('betterLogs.insertConsoleLog', insertConsoleLog);
  const trimDisposable = vscode.commands.registerCommand('betterLogs.trimConsoleLogs', trimConsoleLogs);

  context.subscriptions.push(insertDisposable, trimDisposable);
}

export function deactivate(): void {
  // No-op
}
