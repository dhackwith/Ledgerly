// Node 26 defines a global `localStorage` that is undefined unless --localstorage-file is
// passed, and it shadows jsdom's. Tests that need storage call this to use jsdom's instead.
export function installLocalStorage(): void {
  const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
  if (!dom) throw new Error("installLocalStorage needs the jsdom test environment");
  Object.defineProperty(globalThis, "localStorage", { value: dom.window.localStorage, configurable: true, writable: true });
}
