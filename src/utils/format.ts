export function formatTimestamp(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function formatVis(vis: number): string {
  return `${vis.toFixed(2)} km`;
}

export function formatCn2(cn2: number): string {
  if (cn2 === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(cn2)));
  const mantissa = cn2 / Math.pow(10, exp);
  return `${mantissa.toFixed(2)}e${exp}`;
}

export function formatVoltage(v: number): string {
  return `${v.toFixed(4)} V`;
}
