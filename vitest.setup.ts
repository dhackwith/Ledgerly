// Node 26 defines global `localStorage` and `sessionStorage` that are undefined unless
// --localstorage-file is passed, and they shadow jsdom's. In jsdom test files, use jsdom's.
const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
if (dom) {
  for (const name of ["localStorage", "sessionStorage"] as const) {
    Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true, writable: true });
  }
}
