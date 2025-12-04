import Module from 'module';

const originalRequire = Module.prototype.require;

class Position {
  constructor(public line: number, public character: number) {}
}

class Range {
  constructor(public start: Position, public end: Position) {}
}

Module.prototype.require = function patchedRequire(request: string, ...args: unknown[]) {
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

  return (originalRequire as unknown as (...invokeArgs: unknown[]) => unknown).apply(this, [request, ...args]);
};
