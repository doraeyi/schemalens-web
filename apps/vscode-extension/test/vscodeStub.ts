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
  readonly scheme = "file";

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
  isDirty?: boolean;
  getText(): string;
}

export function makeDocument(
  text: string,
  path = "database.dbschema",
  languageId = "dbschema",
  isDirty = false,
): TextDocument {
  return { uri: Uri.file(path), languageId, isDirty, getText: () => text };
}

/** 最小的 EventEmitter：註冊的 listener 用 fire() 手動觸發，模擬 VS Code 送出事件。 */
class StubEvent<T> {
  private listeners: Array<(value: T) => void> = [];
  readonly event = (listener: (value: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => (this.listeners = this.listeners.filter((l) => l !== listener)) };
  };
  fire(value: T): void {
    for (const listener of this.listeners) listener(value);
  }
  clear(): void {
    this.listeners = [];
  }
}

/** 模擬 VS Code 送出的 workspace 事件，測試用 `events.xxx.fire(...)` 觸發。 */
export const events = {
  open: new StubEvent<TextDocument>(),
  save: new StubEvent<TextDocument>(),
  close: new StubEvent<TextDocument>(),
  change: new StubEvent<{ document: TextDocument }>(),
  diskChange: new StubEvent<Uri>(),
  diskCreate: new StubEvent<Uri>(),
  diskDelete: new StubEvent<Uri>(),
};

/** 假的磁碟：路徑 → 內容。 */
export const disk = new Map<string, string>();

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
  onDidOpenTextDocument: events.open.event,
  onDidSaveTextDocument: events.save.event,
  onDidCloseTextDocument: events.close.event,
  onDidChangeTextDocument: events.change.event,
  createFileSystemWatcher(_glob: string) {
    return {
      onDidChange: events.diskChange.event,
      onDidCreate: events.diskCreate.event,
      onDidDelete: events.diskDelete.event,
      dispose(): void {},
    };
  },
  findFiles(_include: string, _exclude?: string, _max?: number): Promise<Uri[]> {
    return Promise.resolve([...disk.keys()].map((path) => Uri.file(path)));
  },
  fs: {
    readFile(uri: Uri): Promise<Uint8Array> {
      const text = disk.get(uri.fsPath);
      if (text === undefined) return Promise.reject(new Error(`ENOENT ${uri.fsPath}`));
      return Promise.resolve(new TextEncoder().encode(text));
    },
    writeFile(): Promise<void> {
      return Promise.resolve();
    },
  },
  getConfiguration(_section?: string) {
    return { get: <T>(_key: string, fallback: T): T => fallback, update: () => Promise.resolve() };
  },
};

export const statusBarMessages: string[] = [];

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
  setStatusBarMessage(message: string) {
    statusBarMessages.push(message);
    return noopDisposable;
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
  for (const emitter of Object.values(events)) emitter.clear();
  disk.clear();
  statusBarMessages.length = 0;
  collections.length = 0;
  registeredCommands.clear();
  shownMessages.length = 0;
  openedDocuments.length = 0;
  window.shownEditors.length = 0;
  workspace.textDocuments = [];
  window.activeTextEditor = undefined;
}
