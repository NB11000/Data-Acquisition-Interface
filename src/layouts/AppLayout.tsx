import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { AutoDiscoverModal } from '../components/modals/AutoDiscoverModal';
import { ManualAddModal } from '../components/modals/ManualAddModal';
import { useMqttConnect } from '../hooks/useMqttConnect';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const [autoDiscoverOpen, setAutoDiscoverOpen] = useState(false);
  const [manualAddOpen, setManualAddOpen] = useState(false);

  useMqttConnect();

  return (
    <div className={styles.layout}>
      <Navbar />
      <div className={styles.body}>
        <Sidebar
          onAutoDiscover={() => setAutoDiscoverOpen(true)}
          onManualAdd={() => setManualAddOpen(true)}
        />
        <Outlet />
      </div>
      <AutoDiscoverModal
        open={autoDiscoverOpen}
        onClose={() => setAutoDiscoverOpen(false)}
      />
      <ManualAddModal
        open={manualAddOpen}
        onClose={() => setManualAddOpen(false)}
      />
    </div>
  );
}
