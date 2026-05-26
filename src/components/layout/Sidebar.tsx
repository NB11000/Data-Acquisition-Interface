export default function Sidebar() {
  return (
    <aside
      style={{
        width: 250,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--app-sidebar-bg)',
        borderRight: '1px solid var(--app-sidebar-border)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* 搜索框 + 设备统计 */}
      <div style={{ padding: '12px 12px 0' }}>
        <div
          style={{
            background: 'var(--app-bg-color)',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 13,
            color: 'var(--app-text-secondary)',
          }}
        >
          🔍 搜索设备...
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: 'var(--app-text-secondary)',
          }}
        >
          设备总数: 0 / 在线: 0
        </div>
      </div>

      {/* 设备列表占位 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--app-text-hint)',
          fontSize: 13,
        }}
      >
        暂无设备
      </div>

      {/* 底部操作按钮 */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: 12,
          borderTop: '1px solid var(--app-sidebar-border)',
        }}
      >
        <button
          style={{
            flex: 1,
            height: 32,
            border: '1px solid var(--app-card-border)',
            borderRadius: 6,
            background: 'var(--app-card-bg)',
            color: 'var(--app-text-primary)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          🔍 自动发现
        </button>
        <button
          style={{
            flex: 1,
            height: 32,
            border: '1px solid var(--app-card-border)',
            borderRadius: 6,
            background: 'var(--app-card-bg)',
            color: 'var(--app-text-primary)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          ➕ 手动添加
        </button>
      </div>
    </aside>
  );
}
