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

  // 实名认证通过后不再提示
  if (authInfo && authInfo.status === 'AuditPassed') {
    return null;
  }

  // 待认证：已选择用户类型（user_type 1/2）但尚未实名认证通过
  // 未认证：尚未选择用户类型（user_type 0）
  const userType = userState?.user?.user_type;
  const hasSelectedType = userType === 1 || userType === 2;
  const isPending = hasSelectedType;
  const isUnauthorized = !hasSelectedType;

  const handleClick = () => {
    navigate('/console/personal?tab=realname');
  };

  // 待认证：蓝色；未认证：橙色
  const fgColor = isPending ? '#1677ff' : '#FF8C00';
  const bgColor = isPending ? '#EBF4FF' : '#FFF7E6';

  return (
    <Button
      onClick={handleClick}
      theme='borderless'
      style={{
        background: bgColor,
        fontWeight: 500,
        fontSize: '13px',
        color: fgColor,
        padding: '0 12px 0 4px',
        height: '32px',
        borderRadius: '999px',
        boxShadow: 'none',
        cursor: 'pointer',
      }}
      icon={<AlertCircle size={15} color={fgColor} />}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {isPending ? t('待认证') : t('未认证')}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={fgColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </span>
    </Button>
  );
};

export default RealNameAuthPrompt;
