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
    writeFile(uri: Uri, content: Uint8Array): Promise<void> {
      writtenFiles.set(uri.fsPath, content);
      return Promise.resolve();
    },
  },
  getConfiguration(_section?: string) {
    return { get: <T>(_key: string, fallback: T): T => fallback, update: () => Promise.resolve() };
  },
};

export const statusBarMessages: string[] = [];

/** workspace.fs.writeFile 寫出去的檔案：路徑 → 內容。 */
export const writtenFiles = new Map<string, Uint8Array>();

/** 送進假 Webview 的訊息，跟建立過的假面板。 */
export const webviewMessages: Array<{ type: string; [key: string]: unknown }> = [];
export const createdPanels: Array<{ receive(message: unknown): void }> = [];

/** QuickPick 要選哪一個：依 label 找；沒設定就選第一個。 */
export const quickPickChoices: string[] = [];

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
  showErrorMessage(message: string) {
    shownMessages.push(message);
    return Promise.resolve(undefined);
  },
  showQuickPick(items: unknown[]) {
    const wanted = quickPickChoices.shift();
    if (wanted === undefined) return Promise.resolve(items[0]);
    return Promise.resolve(
      items.find((item) => (typeof item === "string" ? item : (item as { label: string }).label) === wanted),
    );
  },
  /** 存檔對話框：直接接受預設路徑。 */
  showSaveDialog(options: { defaultUri?: Uri }) {
    return Promise.resolve(options.defaultUri);
  },
  openDialogResult: undefined as Uri[] | undefined,
  showOpenDialog() {
    return Promise.resolve(window.openDialogResult);
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
  /** 假的 Preview 面板：記下送進 Webview 的訊息；收到 exportImage 時像真的 Webview 一樣回傳圖片。 */
  createWebviewPanel() {
    let receive: (message: unknown) => void = () => {};
    const panel = {
      title: "",
      webview: {
        html: "",
        cspSource: "vscode-resource:",
        asWebviewUri: (uri: Uri) => uri,
        onDidReceiveMessage(listener: (message: unknown) => void) {
          receive = listener;
          return noopDisposable;
        },
        postMessage(message: { type: string; requestId?: number; format?: string }) {
          webviewMessages.push(message);
          if (message.type === "exportImage") {
            const dataUrl =
              message.format === "png"
                ? `data:image/png;base64,${Buffer.from("PNGDATA").toString("base64")}`
                : `data:image/svg+xml;charset=utf-8,${encodeURIComponent("<svg>圖</svg>")}`;
            queueMicrotask(() => receive({ type: "imageExported", requestId: message.requestId, dataUrl }));
          }
          return Promise.resolve(true);
        },
      },
      reveal() {},
      onDidDispose() {
        return noopDisposable;
      },
      /** 測試用：模擬 Webview 送訊息給 Extension。 */
      receive: (message: unknown) => receive(message),
    };
    createdPanels.push(panel);
    return panel;
  },
};

export function resetStub(): void {
  for (const emitter of Object.values(events)) emitter.clear();
  disk.clear();
  writtenFiles.clear();
  webviewMessages.length = 0;
  createdPanels.length = 0;
  quickPickChoices.length = 0;
  window.openDialogResult = undefined;
  statusBarMessages.length = 0;
  collections.length = 0;
  registeredCommands.clear();
  shownMessages.length = 0;
  openedDocuments.length = 0;
  window.shownEditors.length = 0;
  workspace.textDocuments = [];
  window.activeTextEditor = undefined;
}

/** VS Code 的顯示語言；i18n 在 dbschema.language = auto 時看這個。 */
export const env = { language: "en" };

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}
