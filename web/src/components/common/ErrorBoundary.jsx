import React from 'react';
import { withTranslation } from 'react-i18next';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { t } = this.props;
      // 使用原生HTML而不是Semi-UI组件，确保即使Semi-UI有问题也能正常显示
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          padding: '32px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <div style={{
            fontSize: '16px',
            color: '#666',
            marginBottom: '24px',
            textAlign: 'center',
          }}>
            {t('页面渲染出错，请刷新页面重试')}
          </div>
          {this.state.error && (
            <div style={{
              fontSize: '12px',
              color: '#999',
              marginBottom: '24px',
              padding: '12px',
              background: '#f5f5f5',
              borderRadius: '4px',
              maxWidth: '600px',
              overflow: 'auto',
              maxHeight: '200px',
            }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {this.state.error.toString()}
              </pre>
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 24px',
              background: '#1890ff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {t('刷新页面')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default withTranslation()(ErrorBoundary);
