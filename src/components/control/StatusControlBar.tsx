export default function StatusControlBar() {
  return (
    <div
      style={{
        margin: '0 16px',
        padding: '12px 16px',
        background: 'var(--app-control-bar-bg)',
        border: '1px solid var(--app-control-bar-border)',
        borderRadius: 8,
        boxShadow: 'var(--app-control-bar-shadow)',
        flexShrink: 0,
      }}
    >
      {/* 第一行：设备信息 + 状态指示灯 + 时钟 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            未选择设备
          </span>
          <span style={{ fontSize: 12, color: 'var(--app-text-secondary)' }}>
            ---
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <StatusDot color="var(--app-text-hint)" label="MQTT: 未连接" />
          <StatusDot color="var(--app-text-hint)" label="采集: ---" />
          <StatusDot color="var(--app-text-hint)" label="激光: ---" />
        </div>

        <div
          style={{
            fontSize: 14,
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--app-text-secondary)',
          }}
        >
          --:--:--
        </div>
      </div>

      {/* 第二行：操作按钮组 */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--app-text-secondary)' }}>
            采集卡:
          </span>
          <button style={btnStyle} disabled>
            打开设备
          </button>
          <button style={btnStyle} disabled>
            开始采集
          </button>
        </div>
        <div style={{ width: 1, background: 'var(--app-card-border)' }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--app-text-secondary)' }}>
            激光器:
          </span>
          <button style={btnStyle} disabled>
            连接激光
          </button>
          <button style={btnStyle} disabled>
            开启激光
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
        }}
      />
      {label}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  height: 28,
  padding: '0 12px',
  border: '1px solid var(--app-card-border)',
  borderRadius: 4,
  background: 'var(--app-card-bg)',
  color: 'var(--app-text-primary)',
  cursor: 'pointer',
  fontSize: 12,
};
