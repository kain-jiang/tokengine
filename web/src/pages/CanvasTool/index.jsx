import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API, showError } from '../../helpers';

const DraggableExitButton = ({ onClose }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const btnRef = useRef(null);

  useEffect(() => {
    const updatePosition = () => {
      setPosition({
        x: window.innerWidth - 60,
        y: 80,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, []);

  const handlePointerDown = useCallback((e) => {
    setDragging(true);
    setHasMoved(false);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [position]);

  const handlePointerMove = useCallback((e) => {
    if (!dragging) return;
    setHasMoved(true);
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    const maxX = window.innerWidth - 40;
    const maxY = window.innerHeight - 40;
    setPosition({
      x: Math.max(0, Math.min(maxX, newX)),
      y: Math.max(0, Math.min(maxY, newY)),
    });
  }, [dragging, dragStart]);

  const handlePointerUp = useCallback((e) => {
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
  }, []);

  const handleClick = useCallback(() => {
    if (!hasMoved) {
      onClose();
    }
  }, [hasMoved, onClose]);

  return (
    <div
      ref={btnRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: dragging ? 'grabbing' : 'grab',
        zIndex: 10001,
        userSelect: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        transition: dragging ? 'none' : 'background-color 0.2s',
      }}
      onMouseEnter={(e) => {
        if (!dragging) e.target.style.backgroundColor = 'rgba(220, 38, 38, 1)';
      }}
      onMouseLeave={(e) => {
        if (!dragging) e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.9)';
      }}
      title='拖拽移动，点击退出'
    >
      <svg
        width='20'
        height='20'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <line x1='18' y1='6' x2='6' y2='18' />
        <line x1='6' y1='6' x2='18' y2='18' />
      </svg>
    </div>
  );
};

const CanvasTool = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [iframeUrl, setIframeUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await API.get('/api/user/zefeng/oauth/token');
        const { success, data, message } = res.data;
        if (success && data && data.access_token) {
          // 使用相对路径，通过 Vite proxy 或 nginx 反代访问 carbot
          const url = `/carbot/#/?ck=${data.access_token}`;
          setIframeUrl(url);
        } else {
          setError(message || t('获取画布工具令牌失败'));
          showError(message || t('获取画布工具令牌失败'));
        }
      } catch (err) {
        const msg = err.response?.data?.message || err.message;
        setError(msg);
        showError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchToken();
  }, [t]);

  const handleClose = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen((prev) => !prev);
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: '400px',
          color: '#999',
        }}
      >
        {t('正在加载画布工具...')}
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: '400px',
          gap: '16px',
        }}
      >
        <div style={{ color: '#ef4444', fontSize: '16px' }}>
          {t('画布工具加载失败')}: {error}
        </div>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '8px 24px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            backgroundColor: '#fff',
            cursor: 'pointer',
          }}
        >
          {t('返回首页')}
        </button>
      </div>
    );
  }

  const containerStyle = isFullScreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 10000,
      }
    : {
        width: '100%',
        height: '100%',
      };

  return (
    <div style={containerStyle}>
      <iframe
        src={iframeUrl}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        title={t('画布工具')}
        allow='fullscreen'
      />
      <div
        style={{
          position: 'absolute',
          top: isFullScreen ? '12px' : '12px',
          right: '60px',
          zIndex: 10001,
        }}
      >
        <button
          onClick={toggleFullScreen}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            backgroundColor: 'rgba(0,0,0,0.5)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={isFullScreen ? t('退出全屏') : t('全屏')}
        >
          {isFullScreen ? (
            <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M8 3v3a2 2 0 0 1-2 2H3' />
              <path d='M21 8h-3a2 2 0 0 1-2-2V3' />
              <path d='M3 16h3a2 2 0 0 1 2 2v3' />
              <path d='M16 21v-3a2 2 0 0 1 2-2h3' />
            </svg>
          ) : (
            <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M3 8V5a2 2 0 0 1 2-2h3' />
              <path d='M21 8V5a2 2 0 0 0-2-2h-3' />
              <path d='M3 16v3a2 2 0 0 0 2 2h3' />
              <path d='M21 16v3a2 2 0 0 1-2 2h-3' />
            </svg>
          )}
        </button>
      </div>
      <DraggableExitButton onClose={handleClose} />
    </div>
  );
};

export default CanvasTool;
