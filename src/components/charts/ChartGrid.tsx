import { Card } from 'antd';

function PlaceholderCard({
  title,
  borderColor,
}: {
  title: string;
  borderColor: string;
}) {
  return (
    <Card
      title={title}
      size="small"
      style={{
        height: '100%',
        borderTop: `3px solid ${borderColor}`,
      }}
      styles={{
        body: {
          padding: 8,
          height: 'calc(100% - 38px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--app-text-hint)',
          fontSize: 14,
        },
      }}
    >
      数据暂不可用
    </Card>
  );
}

export default function ChartGrid() {
  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 16,
        padding: 16,
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      <PlaceholderCard title="📈 双通道电压波形 (CH1/CH2)" borderColor="#1890ff" />
      <PlaceholderCard title="📉 Vis 能见度" borderColor="#52c41a" />
      <PlaceholderCard title="📊 多参数六要素" borderColor="#faad14" />
      <PlaceholderCard title="📉 Cn² 折射率" borderColor="#722ed1" />
    </div>
  );
}
