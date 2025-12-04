import { strict as assert } from 'assert';
import { getConsoleLogSpans } from './extension';

function applyTrims(text: string): string {
  const spans = getConsoleLogSpans(text).sort((a, b) => b.start - a.start);
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

    assert.equal(output, `const value = {\n  nested: true,\n};\nconst keep = true;\n`);
  });

  it('handles console.log without semicolon', () => {
    const input = `console.log('no semicolon')\nconst x = 1;\n`;

    const output = applyTrims(input);

    assert.equal(output, `const x = 1;\n`);
  });

  it('removes trailing inline comments', () => {
    const input = `const before = true;\n  console.log('debug'); // remove this log\nconst after = false;\n`;

    const output = applyTrims(input);

    assert.equal(output, `const before = true;\nconst after = false;\n`);
  });
});
