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

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, showError, showInfo, showSuccess } from '../../helpers';
import QRCode from 'qrcode';

const QRCodeModal = ({ qrCodeUrl, tradeNo, amount, expireAt, onSuccess, onClose }) => {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState('');
  const [generatedQRCode, setGeneratedQRCode] = useState('');
  const timerRef = useRef(null);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 生成二维码图片
  const generateQRCodeImage = async (url) => {
    if (!url) return;
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
  };

  useEffect(() => {
    // 生成二维码
    generateQRCodeImage(qrCodeUrl);
  }, [qrCodeUrl]);

  useEffect(() => {
    const expireTime = new Date(expireAt).getTime();
    const now = Date.now();
    let remaining = Math.max(0, Math.floor((expireTime - now) / 1000));
    setCountdown(formatTime(remaining));

    timerRef.current = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      setCountdown(formatTime(remaining));
      if (remaining === 0) {
        clearInterval(timerRef.current);
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [expireAt]);

  const handleOk = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    try {
      const res = await API.get(`/api/user/zs_pay/status?trade_no=${tradeNo}`);
      if (res.data?.message === 'success') {
        const status = res.data?.status;
        if (status === 'PAID') {
          showSuccess(t('支付成功！'));
          if (onSuccess) {
            onSuccess();
          }
        } else {
          showInfo(t('支付状态') + '：' + status);
        }
      } else {
        showError(t('查询支付状态失败'));
      }
    } catch (error) {
      showError(t('查询支付状态失败'));
    }
  };

  const handleCancel = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
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
  };

  return (
    <Modal
      title={t('扫码支付')}
      visible
      centered
      okText={t('我已支付')}
      cancelText={t('取消支付')}
      onOk={handleOk}
      onCancel={handleCancel}
    >
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <p style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
            {t('支付金额')}
          </p>
          <p
            style={{
              marginBottom: '20px',
              fontSize: '32px',
              fontWeight: 'bold',
              color: '#e53935',
            }}
          >
            ¥{(amount || 0).toFixed(2)}
          </p>
        </div>
        <div
          style={{
            marginBottom: '20px',
            backgroundColor: '#f5f5f5',
            padding: '20px',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
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
          <p
            style={{
              marginBottom: '10px',
              marginTop: '15px',
              fontSize: '14px',
            }}
          >
            {t('请使用微信/支付宝/银联扫码支付')}
          </p>
        </div>
        <p style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
          {t('二维码有效期')}：
          <span style={{ color: '#e53935', fontWeight: 'bold' }}>
            {countdown}
          </span>
        </p>
        <p style={{ marginBottom: '20px', fontSize: '14px' }}>
          {t('订单号')}：{tradeNo}
        </p>
        <p style={{ fontSize: '12px', color: '#999' }}>
          {t('支付完成后，系统会自动处理您的充值')}
        </p>
      </div>
    </Modal>
  );
};

export default QRCodeModal;
