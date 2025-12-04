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
exports.activate = activate;
exports.deactivate = deactivate;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
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
function createConsoleLog(editor) {
    const expression = getExpression(editor);
    const fileName = path.basename(editor.document.fileName);
    const lineNumber = editor.selection.active.line + 1;
    return `console.log("[${fileName}:${lineNumber}] ${expression}:", ${expression});`;
}
async function insertConsoleLog() {
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
async function trimConsoleLogs() {
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
function activate(context) {
    const insertDisposable = vscode.commands.registerCommand('betterLogs.insertConsoleLog', insertConsoleLog);
    const trimDisposable = vscode.commands.registerCommand('betterLogs.trimConsoleLogs', trimConsoleLogs);
    context.subscriptions.push(insertDisposable, trimDisposable);
}
function deactivate() {
    // No-op
}
//# sourceMappingURL=extension.js.map