import ThemeSwitch from '../common/ThemeSwitch';

export default function Navbar() {
  return (
    <header
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: 'var(--app-nav-bg)',
        color: 'var(--app-nav-text)',
        flexShrink: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: 1 }}>
          数据采集与检测系统 V2.0
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ThemeSwitch />
      </div>
    </header>
  );
}
