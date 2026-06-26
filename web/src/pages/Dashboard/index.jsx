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
import { Modal, Button } from '@douyinfe/semi-ui';
import { API } from '../../helpers';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Dashboard from '../../components/dashboard';

const Detail = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkRealNameAuth();
  }, []);

  const checkRealNameAuth = async () => {
    try {
      const res = await API.get('/api/user/realname/auth');
      if (res.data.success) {
        // 用户已认证，不需要弹窗
        setAuthChecked(true);
      }
    } catch (error) {
      // 接口失败，可能是未认证
    } finally {
      setAuthChecked(true);
    }
  };

  // 当检查完成且未认证时显示弹窗
  useEffect(() => {
    if (authChecked) {
      // 再次检查认证状态（如果之前没有返回数据）
      checkShowModal();
    }
  }, [authChecked]);

  const checkShowModal = async () => {
    try {
      const res = await API.get('/api/user/realname/auth');
      if (!res.data.success || !res.data.data) {
        setShowAuthModal(true);
      }
    } catch (error) {
      setShowAuthModal(true);
    }
  };

  const handleGoAuth = () => {
    setShowAuthModal(false);
    navigate('/console/personal?tab=realname');
  };

  return (
    <>
      <div className='mt-[60px] px-2'>
        <Dashboard />
      </div>

      <Modal
        title={t('需要完成实名认证')}
        visible={showAuthModal}
        onCancel={() => setShowAuthModal(false)}
        footer={
          <div className='flex justify-end gap-2'>
            <Button
              onClick={() => setShowAuthModal(false)}
              theme='outline'
              type='tertiary'
            >
              {t('取消')}
            </Button>
            <Button type='primary' onClick={handleGoAuth} theme='solid'>
              {t('前往认证')}
            </Button>
          </div>
        }
      >
        <p>{t('您尚未进行实名认证，实名认证后，赠送500万额度')}</p>
      </Modal>
    </>
  );
};

export default Detail;
