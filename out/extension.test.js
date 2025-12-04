"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const extension_1 = require("./extension");
function applyTrims(text) {
    const spans = (0, extension_1.getConsoleLogSpans)(text).sort((a, b) => b.start - a.start);
    let result = text;
    for (const span of spans) {
        result = result.slice(0, span.start) + result.slice(span.end);
    }
    return result;
}
describe('getConsoleLogSpans', () => {
    it('removes multi-line console.log calls', () => {
        const input = `const value = {\n  nested: true,\n};\nconsole.log(\n  'value',\n  value\n);\nconst keep = true;\n`;
        const output = applyTrims(input);
        assert_1.strict.equal(output, `const value = {\n  nested: true,\n};\nconst keep = true;\n`);
    });
    it('handles console.log without semicolon', () => {
        const input = `console.log('no semicolon')\nconst x = 1;\n`;
        const output = applyTrims(input);
        assert_1.strict.equal(output, `const x = 1;\n`);
    });
    it('removes trailing inline comments', () => {
        const input = `const before = true;\n  console.log('debug'); // remove this log\nconst after = false;\n`;
        const output = applyTrims(input);
        assert_1.strict.equal(output, `const before = true;\nconst after = false;\n`);
    });
});
//# sourceMappingURL=extension.test.js.map