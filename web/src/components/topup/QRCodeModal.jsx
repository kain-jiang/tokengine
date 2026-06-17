/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, showError, showInfo, showSuccess } from '../../helpers';
import QRCode from 'qrcode';

const QRCodeModal = ({ qrCodeUrl, tradeNo, amount, expireAt, onSuccess, onRefresh, onClose }) => {
  const { t } = useTranslation();
  
  // 核心状态
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isPaid, setIsPaid] = useState(false);
  const [isManualChecking, setIsManualChecking] = useState(false);
  const [isManualCheckCooldown, setIsManualCheckCooldown] = useState(false);
  const [autoPollingStarted, setAutoPollingStarted] = useState(false);
  
  // 二维码相关
  const [generatedQRCode, setGeneratedQRCode] = useState('');
  
  // 定时器引用
  const countdownTimerRef = useRef(null);
  const pollingTimerRef = useRef(null);
  const autoPollingTimeoutRef = useRef(null);
  
  // 判断是否为 URL
  const isUrl = (str) => {
    if (!str) return false;
    return str.startsWith('http://') || str.startsWith('https://');
  };
  
  // 生成二维码图片
  const generateQRCode = useCallback(async (url) => {
    if (!url || !isUrl(url)) return;
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        errorCorrectionLevel: 'M'
      });
      setGeneratedQRCode(dataUrl);
    } catch (error) {
      console.error('生成二维码失败:', error);
    }
  }, []);
  
  // 格式化倒计时
  const formatCountdown = (seconds) => {
    if (seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // 计算剩余时间
  const calculateRemaining = useCallback(() => {
    if (!expireAt) return 0;
    const expireTime = new Date(expireAt).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((expireTime - now) / 1000));
  }, [expireAt]);
  
  // 开始倒计时
  const startCountdown = useCallback(() => {
    stopCountdown();
    setRemainingSeconds(calculateRemaining());
    
    countdownTimerRef.current = setInterval(() => {
      const remaining = calculateRemaining();
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        stopCountdown();
        stopPolling();
      }
    }, 1000);
  }, [calculateRemaining]);
  
  // 停止倒计时
  const stopCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);
  
  // 单次查询支付状态
  const checkPaymentStatus = useCallback(async () => {
    if (!tradeNo || remainingSeconds <= 0 || isPaid) {
      return false;
    }
    
    try {
      const res = await API.get(`/api/user/zs_pay/status?trade_no=${tradeNo}`);
      if (res.data?.message === 'success') {
        const status = res.data?.status;
        // PAID = 已支付
        if (status === 'PAID') {
          setIsPaid(true);
          stopPolling();
          stopCountdown();
          stopAutoPollingTimeout();
          // 2秒后自动关闭弹窗
          setTimeout(() => {
            showSuccess(t('支付成功！'));
            if (onClose) {
              onClose();
            }
          }, 2000);
          return true;
        }
        // CLOSED = 已关闭, REFUNDED = 已退款
        if (status === 'CLOSED' || status === 'REFUNDED') {
          stopPolling();
          return false;
        }
      }
    } catch (error) {
      console.error('查询支付状态失败:', error);
    }
    return false;
  }, [tradeNo, remainingSeconds, isPaid, onSuccess, t]);
  
  // 用户点击「我已支付」按钮
  const handleManualCheck = useCallback(async () => {
    if (isManualChecking || isManualCheckCooldown || isPaid || remainingSeconds <= 0) return;
    
    setIsManualChecking(true);
    const paid = await checkPaymentStatus();
    setIsManualChecking(false);
    
    // 只查询一次，如果未支付则提示用户
    if (!paid && !isPaid) {
      showInfo(t('暂未查询到支付结果，请确认已完成支付'));
      
      // 开启3秒冷却
      setIsManualCheckCooldown(true);
      setTimeout(() => {
        setIsManualCheckCooldown(false);
      }, 3000);
    }
  }, [isManualChecking, isManualCheckCooldown, isPaid, remainingSeconds, checkPaymentStatus, t]);
  
  // 开始轮询支付状态
  const startPolling = useCallback(() => {
    stopPolling();
    
    pollingTimerRef.current = setInterval(async () => {
      if (!tradeNo || remainingSeconds <= 0 || isPaid) {
        stopPolling();
        return;
      }
      await checkPaymentStatus();
    }, 5000); // 每5秒轮询一次
  }, [tradeNo, remainingSeconds, isPaid, checkPaymentStatus]);
  
  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);
  
  // 停止自动轮询延迟定时器
  const stopAutoPollingTimeout = useCallback(() => {
    if (autoPollingTimeoutRef.current) {
      clearTimeout(autoPollingTimeoutRef.current);
      autoPollingTimeoutRef.current = null;
    }
  }, []);
  
  // 刷新二维码
  const handleRefresh = useCallback(() => {
    setIsPaid(false);
    setAutoPollingStarted(false);
    setIsManualChecking(false);
    setIsManualCheckCooldown(false);
    // 重新开始倒计时
    startCountdown();
    // 重新设置自动轮询定时器
    stopAutoPollingTimeout();
    autoPollingTimeoutRef.current = setTimeout(() => {
      setAutoPollingStarted(true);
      startPolling();
    }, 60 * 1000);
    if (onRefresh) {
      onRefresh();
    }
  }, [onRefresh, startCountdown, startPolling]);
  
  // 取消支付
  const handleCancel = useCallback(async () => {
    try {
      const res = await API.post(`/api/user/zs_pay/cancel?trade_no=${tradeNo}`);
      if (res.data?.message === 'success') {
        showInfo(t('订单已取消'));
      } else {
        showError(res.data?.data || t('取消订单失败'));
      }
    } catch (error) {
      showError(t('取消订单失败'));
    }
    if (onClose) {
      onClose();
    }
  }, [tradeNo, onClose, t]);
  
  // 关闭弹窗
  const handleClose = useCallback(() => {
    stopCountdown();
    stopPolling();
    stopAutoPollingTimeout();
    if (onClose) {
      onClose();
    }
  }, [stopCountdown, stopPolling, stopAutoPollingTimeout, onClose]);
  
  // 监听二维码URL变化，生成二维码
  useEffect(() => {
    if (isUrl(qrCodeUrl)) {
      generateQRCode(qrCodeUrl);
    } else {
      // 如果不是URL，直接使用（可能是base64或data URI）
      if (qrCodeUrl) {
        if (qrCodeUrl.startsWith('data:')) {
          setGeneratedQRCode(qrCodeUrl);
        } else {
          setGeneratedQRCode(`data:image/png;base64,${qrCodeUrl}`);
        }
      }
    }
  }, [qrCodeUrl, generateQRCode]);
  
  // 监听弹窗显示
  useEffect(() => {
    // 初始化状态
    setIsPaid(false);
    setAutoPollingStarted(false);
    setIsManualChecking(false);
    setIsManualCheckCooldown(false);
    startCountdown();
    
    // 5秒后自动开始轮询（如果用户未点击「我已支付」）
    stopAutoPollingTimeout();
    autoPollingTimeoutRef.current = setTimeout(() => {
      if (!isPaid && remainingSeconds > 0 && !autoPollingStarted) {
        setAutoPollingStarted(true);
        startPolling();
      }
    }, 5 * 1000);
    
    return () => {
      stopCountdown();
      stopPolling();
      stopAutoPollingTimeout();
    };
  }, []);
  
  const isExpired = remainingSeconds <= 0;
  
  const renderFooter = () => {
    if (isPaid) return null;
    return (
      <>
        <Button types="danger" onClick={handleCancel}>
          {t('取消支付')}
        </Button>
        <Button
          types="primary"
          loading={isManualChecking}
          disabled={isManualChecking || isManualCheckCooldown || isExpired}
          onClick={handleManualCheck}
        >
          {t('我已支付')}
        </Button>
      </>
    );
  };

  return (
    <Modal
      title={t('扫码支付')}
      visible
      centered
      footer={renderFooter()}
    >
      <div style={{ textAlign: 'center', padding: '24px' }}>
        {/* 金额信息 */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
            {t('支付金额')}
          </p>
          <p style={{ marginBottom: '20px', fontSize: '32px', fontWeight: 'bold', color: '#e53935' }}>
            ¥{(amount || 0).toFixed(2)}
          </p>
        </div>
        
        {/* 二维码区域 */}
        {!isExpired && !isPaid && (
          <div style={{ marginBottom: '20px', backgroundColor: '#f5f5f5', padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {generatedQRCode ? (
              <img
                src={generatedQRCode}
                alt={t('支付二维码')}
                style={{ width: '200px', height: '200px' }}
              />
            ) : (
              <div style={{ width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
                <p style={{ color: '#999', fontSize: '14px' }}>{t('生成中...')}</p>
              </div>
            )}
            <p style={{ marginBottom: '10px', marginTop: '15px', fontSize: '14px' }}>
              {t('请使用微信/支付宝/银联扫码支付')}
            </p>
          </div>
        )}
        
        {/* 过期提示 */}
        {isExpired && !isPaid && (
          <div style={{ marginBottom: '20px', backgroundColor: '#fff3e0', padding: '20px', borderRadius: '8px' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>⏰</div>
            <p style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>{t('二维码已过期')}</p>
            <button
              onClick={handleRefresh}
              style={{
                padding: '8px 24px',
                backgroundColor: '#e53935',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {t('重新获取二维码')}
            </button>
          </div>
        )}
        
        {/* 支付成功 */}
        {isPaid && (
          <div style={{ marginBottom: '20px', backgroundColor: '#e8f5e9', padding: '20px', borderRadius: '8px' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>✓</div>
            <p style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>{t('支付成功')}</p>
            <p style={{ fontSize: '14px', color: '#666' }}>{t('即将跳转到充值记录...')}</p>
          </div>
        )}
        
        {/* 倒计时 */}
        {!isExpired && !isPaid && (
          <p style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
            {t('二维码有效期')}：
            <span style={{ color: '#e53935', fontWeight: 'bold' }}>
              {formatCountdown(remainingSeconds)}
            </span>
          </p>
        )}
        
        {/* 订单信息 */}
        <p style={{ marginBottom: '20px', fontSize: '14px' }}>
          {t('订单号')}：{tradeNo}
        </p>
        
        {/* 自动轮询提示 */}
        {autoPollingStarted && !isPaid && !isExpired && (
          <p style={{ fontSize: '12px', color: '#999' }}>
            {t('正在自动查询支付状态...')}
          </p>
        )}
        
        {/* 提示信息 */}
        {!isPaid && (
          <p style={{ fontSize: '12px', color: '#999' }}>
            {t('支付完成后，系统会自动处理您的充值')}
          </p>
        )}
      </div>
    </Modal>
  );
};

export default QRCodeModal;
