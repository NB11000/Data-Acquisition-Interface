import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { AutoDiscoverModal } from '../components/modals/AutoDiscoverModal';
import { ManualAddModal } from '../components/modals/ManualAddModal';
import { useMqttConnect } from '../hooks/useMqttConnect';
import type { Device } from '../stores/deviceStore';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const [autoDiscoverOpen, setAutoDiscoverOpen] = useState(false);
  const [manualAddOpen, setManualAddOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  useMqttConnect();

  return (
    <div className={styles.layout}>
      <Navbar />
      <div className={styles.body}>
        <Sidebar
          onAutoDiscover={() => setAutoDiscoverOpen(true)}
          onManualAdd={() => setManualAddOpen(true)}
          onEditDevice={(d) => setEditingDevice(d)}
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
      <ManualAddModal
        open={!!editingDevice}
        editingDevice={editingDevice ?? undefined}
        onClose={() => setEditingDevice(null)}
      />
    </div>
  );
}
