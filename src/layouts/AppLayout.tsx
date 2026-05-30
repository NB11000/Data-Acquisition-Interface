import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { AddDeviceModal } from '../components/modals/AddDeviceModal';
import { useMqttConnect } from '../hooks/useMqttConnect';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const [addDeviceOpen, setAddDeviceOpen] = useState(false);

  useMqttConnect();

  return (
    <div className={styles.layout}>
      <Navbar />
      <div className={styles.body}>
        <Sidebar
          onAddDevice={() => setAddDeviceOpen(true)}
          onEditDevice={() => {}}
        />
        <Outlet />
      </div>
      <AddDeviceModal
        open={addDeviceOpen}
        onClose={() => setAddDeviceOpen(false)}
      />
    </div>
  );
}
