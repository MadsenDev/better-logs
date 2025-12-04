import * as path from 'path';
import * as vscode from 'vscode';
import * as ts from 'typescript';

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
  const spans = getConsoleLogSpans(text);

  if (spans.length === 0) {
    void vscode.window.showInformationMessage('No console.log statements found.');
    return;
  }

  const sortedSpans = [...spans].sort((a, b) => b.start - a.start);

  await editor.edit((editBuilder) => {
    for (const span of sortedSpans) {
      const range = new vscode.Range(
        document.positionAt(span.start),
        document.positionAt(span.end),
      );

      editBuilder.delete(range);
    }
  });
}

export function getConsoleLogSpans(text: string): Array<{ start: number; end: number }> {
  const sourceFile = ts.createSourceFile('file.ts', text, ts.ScriptTarget.Latest, true);
  const spans: Array<{ start: number; end: number }> = [];

  const isConsoleLog = (node: ts.CallExpression): boolean => {
    if (!ts.isPropertyAccessExpression(node.expression)) {
      return false;
    }

    const { expression, name } = node.expression;
    return name.text === 'log' && ts.isIdentifier(expression) && expression.text === 'console';
  };

  const getEnclosingStatement = (node: ts.Node): ts.Node => {
    let current: ts.Node | undefined = node;

    while (current && !ts.isSourceFile(current)) {
      if (ts.isStatement(current)) {
        return current;
      }

      current = current.parent;
    }

    return node;
  };

  const extendToTrailingTrivia = (node: ts.Node): { start: number; end: number } => {
    const startOfNode = node.getStart(sourceFile, true);
    let start = startOfNode;

    while (start > 0) {
      const previousChar = text[start - 1];

      if (previousChar === '\n') {
        break;
      }

      if (previousChar === '\r') {
        start -= 1;
        break;
      }

      if (previousChar === ' ' || previousChar === '\t') {
        start -= 1;
        continue;
      }

      break;
    }
    let end = node.getEnd();

    const trailingComments = ts.getTrailingCommentRanges(text, end);
    if (trailingComments && trailingComments.length > 0) {
      end = Math.max(end, ...trailingComments.map((comment) => comment.end));
    }

    let newlineConsumed = false;
    while (end < text.length) {
      const char = text[end];

      if (char === ' ' || char === '\t' || char === '\r') {
        end += 1;
        continue;
      }

      if (char === '\n') {
        if (newlineConsumed) {
          break;
        }

        newlineConsumed = true;
        end += 1;
        continue;
      }

      break;
    }

    return { start, end };
  };

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isConsoleLog(node)) {
      const targetNode = getEnclosingStatement(node);
      spans.push(extendToTrailingTrivia(targetNode));
      return;
    }

    node.forEachChild(visit);
  };

  sourceFile.forEachChild(visit);

  return spans;
}

export function activate(context: vscode.ExtensionContext): void {
  const insertDisposable = vscode.commands.registerCommand('betterLogs.insertConsoleLog', insertConsoleLog);
  const trimDisposable = vscode.commands.registerCommand('betterLogs.trimConsoleLogs', trimConsoleLogs);

  context.subscriptions.push(insertDisposable, trimDisposable);
}

export function deactivate(): void {
  // No-op
}
