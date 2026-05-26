import { ConfigProvider, theme } from 'antd';
import AppLayout from './components/layout/AppLayout';

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <AppLayout />
    </ConfigProvider>
  );
}
