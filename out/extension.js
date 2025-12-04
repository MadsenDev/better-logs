"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConsoleLogSpans = getConsoleLogSpans;
exports.activate = activate;
exports.deactivate = deactivate;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const ts = __importStar(require("typescript"));
function getExpression(editor) {
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
function getInsertionDetails(editor) {
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
function createConsoleLog(editor, template = 'log') {
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
async function insertConsoleLog(template = 'log') {
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
async function insertConsoleLogWithTemplate() {
    const templateOptions = [
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
async function trimConsoleLogs() {
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
            const range = new vscode.Range(document.positionAt(span.start), document.positionAt(span.end));
            editBuilder.delete(range);
        }
    });
}
async function toggleConsoleLogsMuted() {
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
    const spanLines = spans.map((span) => {
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
    const processedLines = new Set();
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
                        editBuilder.delete(new vscode.Range(new vscode.Position(line, commentIndex), new vscode.Position(line, commentIndex + deleteLength)));
                    }
                }
                else {
                    editBuilder.insert(new vscode.Position(line, commentIndex), '// ');
                }
            }
        }
    });
}
function getConsoleLogSpans(text) {
    const sourceFile = ts.createSourceFile('file.ts', text, ts.ScriptTarget.Latest, true);
    const spans = [];
    const isConsoleLog = (node) => {
        if (!ts.isPropertyAccessExpression(node.expression)) {
            return false;
        }
        const { expression, name } = node.expression;
        return name.text === 'log' && ts.isIdentifier(expression) && expression.text === 'console';
    };
    const getEnclosingStatement = (node) => {
        let current = node;
        while (current && !ts.isSourceFile(current)) {
            if (ts.isStatement(current)) {
                return current;
            }
            current = current.parent;
        }
        return node;
    };
    const extendToTrailingTrivia = (node) => {
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
    const visit = (node) => {
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
function activate(context) {
    const insertDisposable = vscode.commands.registerCommand('betterLogs.insertConsoleLog', insertConsoleLog);
    const templatedInsertDisposable = vscode.commands.registerCommand('betterLogs.insertConsoleLogWithTemplate', insertConsoleLogWithTemplate);
    const trimDisposable = vscode.commands.registerCommand('betterLogs.trimConsoleLogs', trimConsoleLogs);
    const toggleMuteDisposable = vscode.commands.registerCommand('betterLogs.toggleConsoleLogsMuted', toggleConsoleLogsMuted);
    context.subscriptions.push(insertDisposable, templatedInsertDisposable, trimDisposable, toggleMuteDisposable);
}
function deactivate() {
    // No-op
}
//# sourceMappingURL=extension.js.map