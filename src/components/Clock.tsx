import { useClock } from '../hooks/useClock';

export function Clock() {
  const time = useClock();
  return <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 500 }}>{time}</span>;
}
