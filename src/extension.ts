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

type LogTemplate = 'log' | 'warn' | 'error' | 'json' | 'timestamp';

function createConsoleLog(editor: vscode.TextEditor, template: LogTemplate = 'log'): string {
  const expression = getExpression(editor);
  const fileName = path.basename(editor.document.fileName);
  const lineNumber = editor.selection.active.line + 1;
  const label = `[${fileName}:${lineNumber}] ${expression}:`;

  switch (template) {
    case 'warn':
      return `console.warn("${label}", ${expression});`;
    case 'error':
      return `console.error("${label}", ${expression});`;
    case 'json':
      return `console.log("${label}", JSON.stringify(${expression}, null, 2));`;
    case 'timestamp':
      return `console.log(\`[\${new Date().toISOString()}] ${label}\`, ${expression});`;
    case 'log':
    default:
      return `console.log("${label}", ${expression});`;
  }
}

async function insertConsoleLog(template: LogTemplate = 'log'): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const logStatement = createConsoleLog(editor, template);
  const { position, indentation } = getInsertionDetails(editor);
  const newline = editor.document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
  const textToInsert = `${indentation}${logStatement}${newline}`;

  await editor.edit((editBuilder) => {
    editBuilder.insert(position, textToInsert);
  });
}

async function insertConsoleLogWithTemplate(): Promise<void> {
  const templateOptions: Array<vscode.QuickPickItem & { template: LogTemplate }> = [
    { label: 'Standard log', description: 'console.log', template: 'log' },
    { label: 'Warning log', description: 'console.warn', template: 'warn' },
    { label: 'Error log', description: 'console.error', template: 'error' },
    { label: 'JSON log', description: 'console.log(JSON.stringify(...))', template: 'json' },
    { label: 'Timestamped log', description: 'console.log with ISO timestamp', template: 'timestamp' },
  ];

  const selection = await vscode.window.showQuickPick(templateOptions, {
    placeHolder: 'Choose a console log template',
  });

  if (!selection) {
    return;
  }

  await insertConsoleLog(selection.template);
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

async function toggleConsoleLogsMuted(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const { document } = editor;
  const spans = getConsoleLogSpans(document.getText());

  if (spans.length === 0) {
    void vscode.window.showInformationMessage('No console.log statements found.');
    return;
  }

  type SpanLines = { startLine: number; endLine: number; isMuted: boolean };

  const spanLines: SpanLines[] = spans.map((span) => {
    const start = document.positionAt(span.start);
    const end = document.positionAt(span.end);

    const startLine = start.line;
    const endLine = end.character === 0 && end.line > startLine ? end.line - 1 : end.line;

    const isMuted = (() => {
      for (let line = startLine; line <= endLine; line += 1) {
        const text = document.lineAt(line).text;
        if (!text.trimStart().startsWith('//')) {
          return false;
        }
      }

      return true;
    })();

    return { startLine, endLine, isMuted };
  });

  const processedLines = new Set<number>();

  await editor.edit((editBuilder) => {
    for (const spanLine of spanLines) {
      const { startLine, endLine, isMuted } = spanLine;

      for (let line = startLine; line <= endLine; line += 1) {
        if (processedLines.has(line)) {
          continue;
        }

        processedLines.add(line);
        const lineText = document.lineAt(line).text;
        const indentLength = lineText.length - lineText.trimStart().length;
        const commentIndex = indentLength;

        if (isMuted) {
          if (lineText.startsWith('//', commentIndex)) {
            let deleteLength = 2;
            if (lineText.charAt(commentIndex + 2) === ' ') {
              deleteLength += 1;
            }

            editBuilder.delete(
              new vscode.Range(
                new vscode.Position(line, commentIndex),
                new vscode.Position(line, commentIndex + deleteLength),
              ),
            );
          }
        } else {
          editBuilder.insert(new vscode.Position(line, commentIndex), '// ');
        }
      }
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
  const supportedLanguages = ['javascript', 'javascriptreact', 'typescript', 'typescriptreact'];

  const isSupportedLanguage = (document: vscode.TextDocument): boolean =>
    supportedLanguages.includes(document.languageId);

  const isTrimOnSaveEnabled = (document: vscode.TextDocument): boolean =>
    vscode.workspace.getConfiguration('betterLogs', document.uri).get<boolean>('trimOnSave', false);

  const insertDisposable = vscode.commands.registerCommand('betterLogs.insertConsoleLog', insertConsoleLog);
  const templatedInsertDisposable = vscode.commands.registerCommand(
    'betterLogs.insertConsoleLogWithTemplate',
    insertConsoleLogWithTemplate,
  );
  const trimDisposable = vscode.commands.registerCommand('betterLogs.trimConsoleLogs', trimConsoleLogs);
  const toggleMuteDisposable = vscode.commands.registerCommand(
    'betterLogs.toggleConsoleLogsMuted',
    toggleConsoleLogsMuted,
  );

  const onWillSaveDisposable = vscode.workspace.onWillSaveTextDocument((event) => {
    if (!isSupportedLanguage(event.document)) {
      return;
    }

    if (!isTrimOnSaveEnabled(event.document)) {
      return;
    }

    const hasMatchingEditor = vscode.window.visibleTextEditors.some(
      (textEditor) => textEditor.document === event.document,
    );
    if (!hasMatchingEditor) {
      return;
    }

    const trimPromise = (async () => {
      if (vscode.window.activeTextEditor?.document !== event.document) {
        await vscode.window.showTextDocument(event.document, { preview: false, preserveFocus: false });
      }

      await trimConsoleLogs();
    })();

    event.waitUntil(trimPromise);
  });

  context.subscriptions.push(
    insertDisposable,
    templatedInsertDisposable,
    trimDisposable,
    toggleMuteDisposable,
    onWillSaveDisposable,
  );
}

export function deactivate(): void {
  // No-op
}
