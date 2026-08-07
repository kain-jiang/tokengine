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

import React, { useEffect, useState } from 'react';
import { Card, Spin, Typography } from '@douyinfe/semi-ui';
import { IconUser, IconGlobe } from '@douyinfe/semi-icons';
import { API, showError, showSuccess, setUserData } from '../../helpers';
import { useTranslation } from 'react-i18next';

const UserTypeSelectCard = ({ userState, userDispatch }) => {
  const { t } = useTranslation();
  const [loadingType, setLoadingType] = useState(null);

  const userType = userState?.user?.user_type;

  // 老会话可能缺少 user_type 字段，拉取一次 self 补齐
  useEffect(() => {
    if (userType === undefined && userState?.user) {
      API.get('/api/user/self')
        .then((res) => {
          if (res.data.success) {
            userDispatch({ type: 'login', payload: res.data.data });
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (userType !== 0) {
    return null;
  }

  const handleSelect = async (type) => {
    setLoadingType(type);
    try {
      const res = await API.put('/api/user/self/user-type', {
        user_type: type,
      });
      if (res.data.success) {
        const nextUser = { ...userState?.user, user_type: type };
        userDispatch({ type: 'login', payload: nextUser });
        setUserData(nextUser);
        showSuccess(t('账号类型设置成功'));
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(
        error.response?.data?.message || error.message || t('设置失败'),
      );
    } finally {
      setLoadingType(null);
    }
  };

  const options = [
    {
      type: 1,
      icon: <IconUser size={28} />,
      title: t('个人用户'),
      desc: t('个人开发与学习使用，按量计费，即充即用'),
    },
    {
      type: 2,
      icon: <IconGlobe size={28} />,
      title: t('企业用户'),
      desc: t('企业级团队与商用场景，支持发票与私有化方案'),
    },
  ];

  return (
    <Card className='mb-4' bodyStyle={{ padding: '24px' }}>
      <div className='flex items-center justify-between mb-4'>
        <div>
          <Typography.Title heading={5} className='!mb-1'>
            {t('选择账号类型')}
          </Typography.Title>
          <Typography.Text type='tertiary' className='text-sm'>
            {t('请选择您的账号类型，用于财务与发票管理，后续可在个人设置中修改')}
          </Typography.Text>
        </div>
      </div>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        {options.map((option) => (
          <button
            key={option.type}
            onClick={() => handleSelect(option.type)}
            disabled={loadingType !== null}
            className='group flex items-start gap-4 p-5 rounded-xl border border-semi-color-border bg-semi-color-bg-1 text-left transition-all duration-200 hover:border-semi-color-primary hover:shadow-[0_10px_30px_-10px_rgba(84,87,232,0.35)] disabled:opacity-60 disabled:cursor-not-allowed'
          >
            <div className='w-12 h-12 rounded-xl flex items-center justify-center text-semi-color-primary bg-semi-color-primary-light-default flex-none transition-transform duration-200 group-hover:scale-105'>
              {option.icon}
            </div>
            <div className='min-w-0'>
              <div className='flex items-center gap-2'>
                <Typography.Title heading={6} className='!mb-0.5'>
                  {option.title}
                </Typography.Title>
                {loadingType === option.type && <Spin size='small' />}
              </div>
              <Typography.Text type='tertiary' className='text-sm'>
                {option.desc}
              </Typography.Text>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
};

export default UserTypeSelectCard;
