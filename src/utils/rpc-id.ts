export function generateRpcId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(4);
    crypto.getRandomValues(arr);
    return Array.from(arr, (n) => n.toString(36)).join('-');
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
