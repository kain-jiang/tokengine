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
import { ShieldCheck } from 'lucide-react';
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

  // 未实名认证，显示提示
  const buttonText = t('当前账号未认证，去认证');

  const handleClick = () => {
    navigate('/console/personal?tab=realname');
  };

  return (
    <Button
      theme='solid'
      type='primary'
      onClick={handleClick}
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        border: 'none',
        fontWeight: 'bold',
        fontSize: '13px',
        padding: '0 16px',
        height: '36px',
        borderRadius: '18px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
      }}
    >
      <ShieldCheck size={16} />
      <span>{buttonText}</span>
    </Button>
  );
};

export default RealNameAuthPrompt;
