import Navbar from './Navbar';
import Sidebar from './Sidebar';
import StatusControlBar from '../control/StatusControlBar';
import ChartGrid from '../charts/ChartGrid';

export default function AppLayout() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Navbar />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar />

        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--app-content-bg)',
            paddingTop: 16,
            paddingBottom: 16,
          }}
        >
          <StatusControlBar />
          <ChartGrid />
        </main>
      </div>
    </div>
  );
}
