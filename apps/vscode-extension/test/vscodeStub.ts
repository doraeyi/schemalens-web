/**
 * 最小的 `vscode` 模組替身。
 *
 * VS Code API 只有在 Extension Host 裡才存在，但 Extension 端的邏輯
 * （診斷轉換、命令註冊、Preview 訊息）值得單獨測。
 * 這個 stub 只實作被用到的部分，行為刻意與真實 API 對齊：
 * Position / Range 是 0-based。
 */

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
}

export class Position {
  constructor(
    readonly line: number,
    readonly character: number,
  ) {}
}

export class Range {
  readonly start: Position;
  readonly end: Position;

  constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number) {
    this.start = new Position(startLine, startCharacter);
    this.end = new Position(endLine, endCharacter);
  }
}

export class Selection extends Range {
  constructor(start: Position, end: Position) {
    super(start.line, start.character, end.line, end.character);
  }
}

export enum TextEditorRevealType {
  Default = 0,
  InCenter = 1,
  InCenterIfOutsideViewport = 2,
}

export class Diagnostic {
  code?: string | number;
  source?: string;

  constructor(
    readonly range: Range,
    readonly message: string,
    readonly severity: DiagnosticSeverity = DiagnosticSeverity.Error,
  ) {}
}

export class Uri {
  private constructor(readonly fsPath: string) {}

  static file(path: string): Uri {
    return new Uri(path);
  }

  static joinPath(base: Uri, ...segments: string[]): Uri {
    return new Uri([base.fsPath, ...segments].join("/"));
  }

  toString(): string {
    return this.fsPath;
  }
}

export interface TextDocument {
  uri: Uri;
  languageId: string;
  getText(): string;
}

export function makeDocument(text: string, path = "database.dbschema", languageId = "dbschema"): TextDocument {
  return { uri: Uri.file(path), languageId, getText: () => text };
}

class DiagnosticCollection {
  readonly entries = new Map<string, Diagnostic[]>();

  set(uri: Uri, diagnostics: Diagnostic[]): void {
    this.entries.set(uri.toString(), diagnostics);
  }

  delete(uri: Uri): void {
    this.entries.delete(uri.toString());
  }

  dispose(): void {
    this.entries.clear();
  }
}

export const collections: DiagnosticCollection[] = [];

const noopDisposable = { dispose(): void {} };

export const languages = {
  createDiagnosticCollection(_name: string): DiagnosticCollection {
    const collection = new DiagnosticCollection();
    collections.push(collection);
    return collection;
  },
};

export const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();

export const commands = {
  registerCommand(name: string, handler: (...args: unknown[]) => unknown) {
    registeredCommands.set(name, handler);
    return noopDisposable;
  },
  executeCommand(name: string, ...args: unknown[]): unknown {
    return registeredCommands.get(name)?.(...args);
  },
};

export const openedDocuments: string[] = [];

export const workspace = {
  textDocuments: [] as TextDocument[],
  openTextDocument(uri: Uri): Promise<TextDocument> {
    openedDocuments.push(uri.toString());
    return Promise.resolve(makeDocument("", uri.fsPath));
  },
  onDidOpenTextDocument: () => noopDisposable,
  onDidSaveTextDocument: () => noopDisposable,
  onDidCloseTextDocument: () => noopDisposable,
  onDidChangeTextDocument: () => noopDisposable,
};

export const shownMessages: string[] = [];

export const window = {
  activeTextEditor: undefined as { document: TextDocument } | undefined,
  showInformationMessage(message: string) {
    shownMessages.push(message);
    return Promise.resolve(undefined);
  },
  showWarningMessage(message: string) {
    shownMessages.push(message);
    return Promise.resolve(undefined);
  },
  showQuickPick(items: unknown[]) {
    return Promise.resolve(items[0]);
  },
  shownEditors: [] as Array<{ document: TextDocument; selection?: Range }>,
  showTextDocument(document: TextDocument) {
    const editor = {
      document,
      selection: undefined as Range | undefined,
      revealedRange: undefined as Range | undefined,
      revealRange(range: Range) {
        editor.revealedRange = range;
      },
    };
    window.shownEditors.push(editor);
    return Promise.resolve(editor);
  },
  createWebviewPanel() {
    throw new Error("createWebviewPanel 未在 stub 中實作");
  },
};

export function resetStub(): void {
  collections.length = 0;
  registeredCommands.clear();
  shownMessages.length = 0;
  openedDocuments.length = 0;
  window.shownEditors.length = 0;
  workspace.textDocuments = [];
  window.activeTextEditor = undefined;
}
