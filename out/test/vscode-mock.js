"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const module_1 = __importDefault(require("module"));
const originalRequire = module_1.default.prototype.require;
class Position {
    constructor(line, character) {
        this.line = line;
        this.character = character;
    }
}
class Range {
    constructor(start, end) {
        this.start = start;
        this.end = end;
    }
}
module_1.default.prototype.require = function patchedRequire(request, ...args) {
    if (request === 'vscode') {
        return {
            window: {
                activeTextEditor: undefined,
                showInformationMessage: () => undefined,
            },
            commands: {
                registerCommand: () => ({ dispose() { return undefined; } }),
            },
            Position,
            Range,
        };
    }
    return originalRequire.apply(this, [request, ...args]);
};
//# sourceMappingURL=vscode-mock.js.map