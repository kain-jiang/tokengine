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

import React, { useState, useEffect } from 'react';
import { Button } from '@douyinfe/semi-ui';
import { AlertCircle } from 'lucide-react';
import { API, showError } from '../../../helpers';

const RealNameAuthPrompt = ({ userState, navigate, t }) => {
  const [authInfo, setAuthInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userState.user) {
      loadAuthInfo();
    } else {
      setLoading(false);
    }
  }, [userState.user]);

  const loadAuthInfo = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/user/realname/auth');
      if (res.data.success) {
        setAuthInfo(res.data.data);
      }
    } catch (error) {
      // 如果获取失败，不显示提示
      console.error('获取实名认证信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 如果正在加载或未登录，不显示提示
  if (loading || !userState.user) {
    return null;
  }

  // 如果没有实名认证记录(authInfo为null)，说明未认证，显示提示
  // 如果审核拒绝，也显示提示
  const isUnauthorized = !authInfo || authInfo.status === 'AuditRejected';
  if (!isUnauthorized) {
    return null;
  }

  const handleClick = () => {
    navigate('/console/personal?tab=realname');
  };

  return (
    <Button
      onClick={handleClick}
      style={{
        background: '#FFF7E6',
        border: 'none',
        fontWeight: '500',
        fontSize: '14px',
        color: '#FF8C00',
        padding: '0 12px 0 8px',
        height: '36px',
        borderRadius: '18px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        boxShadow: 'none',
        cursor: 'pointer',
      }}
    >
      <AlertCircle size={18} color='#FF8C00' />
      <span>未认证</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF8C00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Button>
  );
};

export default RealNameAuthPrompt;
