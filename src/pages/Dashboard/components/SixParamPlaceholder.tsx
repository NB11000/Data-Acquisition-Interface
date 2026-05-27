import { Empty } from 'antd';
import styles from './ChartCard.module.css';

export function SixParamPlaceholder() {
  return (
    <div className={styles.container}>
      <div className={styles.title}>📊 多参数 (六要素)</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="六要素数据暂不可用" />
      </div>
    </div>
  );
}
