// Deep-clone JSON-serializable data. Safe for Vue reactive proxies (unlike
// structuredClone, which rejects Proxy objects).
export function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
