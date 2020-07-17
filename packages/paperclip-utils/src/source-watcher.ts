import * as chokidar from "chokidar";
import * as path from "path";
import { EventEmitter } from "events";
import { PaperclipConfig } from "./config";
import { paperclipSourceGlobPattern } from "./utils";

export enum ChangeKind {
  Removed,
  Added,
  Changed
}

const CHOKIDAR_EVENT_MAP = {
  add: ChangeKind.Added,
  unlink: ChangeKind.Removed,
  change: ChangeKind.Changed
};

export class PaperclipSourceWatcher {
  private _em: EventEmitter;
  private _watcher: chokidar.FSWatcher;
  constructor(readonly config: PaperclipConfig, readonly cwd: string) {
    this._em = new EventEmitter();
    this._init();
  }
  onChange(listener: (changeKind: ChangeKind, filePath: string) => void) {
    this._em.on("change", listener);
    return () => this._em.off("change", listener);
  }
  dispose() {
    this._watcher.close();
  }
  private _init() {
    const watcher = (this._watcher = chokidar.watch(
      paperclipSourceGlobPattern(this.config.sourceDirectory),
      { cwd: this.cwd, ignoreInitial: true }
    ));
    watcher.on("all", (eventName, relativePath) => {
      const filePath =
        relativePath.charAt(0) !== "/"
          ? path.join(this.cwd, relativePath)
          : relativePath;
      const changeKind = CHOKIDAR_EVENT_MAP[eventName];
      if (changeKind) {
        this._em.emit("change", changeKind, "file://" + filePath);
      }
    });
  }
}
