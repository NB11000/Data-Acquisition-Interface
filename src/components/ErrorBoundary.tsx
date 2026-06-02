import { Component, type ReactNode } from 'react';
import { Empty, Button } from 'antd';

interface Props {
  children: ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
}

export class ChartErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[ErrorBoundary] Chart error caught:', error.message);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', background: 'var(--app-card-bg)', borderRadius: 6,
          borderTop: '3px solid var(--app-chart-card-border-top)', padding: 8
        }}>
          <Empty description={this.props.title || '图表加载失败'}>
            <Button size="small" onClick={this.handleRetry}>重试</Button>
          </Empty>
        </div>
      );
    }
    return this.props.children;
  }
}
