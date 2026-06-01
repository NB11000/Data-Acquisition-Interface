import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs, Switch, Avatar } from 'antd';
import { DashboardOutlined, BellOutlined, HistoryOutlined, SettingOutlined, FileTextOutlined, UserOutlined } from '@ant-design/icons';
import styles from './Navbar.module.css';

const tabs = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '数据中心' },
  { key: '/alerts', icon: <BellOutlined />, label: '告警中心' },
  { key: '/history', icon: <HistoryOutlined />, label: '历史数据' },
  { key: '/settings', icon: <SettingOutlined />, label: '设备管理' },
  { key: '/logs', icon: <FileTextOutlined />, label: '日志查看' },
];

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeKey = '/' + location.pathname.split('/')[1] || '/dashboard';

  const handleToggleDark = (checked: boolean) => {
    document.body.classList.toggle('dark-theme', checked);
  };

  return (
    <div className={styles.navbar}>
      <div className={styles.logo} onClick={() => navigate('/dashboard')}>
        <DashboardOutlined />
        <span>数据采集与检测系统 V2.0</span>
      </div>
      <div className={styles.tabs}>
        <Tabs
          activeKey={activeKey}
          items={tabs.map((t) => ({ key: t.key, label: t.label, icon: t.icon }))}
          onChange={(key) => navigate(key)}
        />
      </div>
      <div className={styles.right}>
        <span>☀️</span>
        <Switch size="small" onChange={handleToggleDark} />
        <span>🌙</span>
        <Avatar size="small" icon={<UserOutlined />} />
      </div>
    </div>
  );
}
