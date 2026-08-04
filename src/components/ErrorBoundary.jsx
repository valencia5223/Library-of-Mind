import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Error Boundary Caught An Error:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '2.5rem',
            maxWidth: '500px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <AlertTriangle size={48} style={{ color: '#ef4444', marginBottom: '1rem' }} />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              화면을 불러오는 중 잠시 오류가 발생했습니다
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              서비스 연결 또는 데이터 동기화 과정에서 일시적 문제가 발생했습니다. 아래 버튼을 눌러 새로고침해 주세요.
            </p>
            {this.state.error && (
              <details style={{ textAlign: 'left', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.75rem', color: '#fca5a5' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', outline: 'none' }}>🔍 상세 오류 메세지 확인 (개발용)</summary>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: '0.5rem', fontFamily: 'monospace' }}>
                  {this.state.error.toString()}
                  {'\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '10px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              <RefreshCw size={18} /> 다시 시도하기 (새로고침)
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
