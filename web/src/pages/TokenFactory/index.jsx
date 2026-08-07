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

import React, { useContext, useState } from 'react';
import { Button, Empty, Tabs, Tag, Typography } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../context/Status';
import Overview from './Overview';
import Ranking from './Ranking';

const TokenFactory = () => {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [error, setError] = useState(null);

  const prometheusEnabled = statusState?.status?.prometheus_enabled === true;

  const tabTitle =
    activeTab === 'overview'
      ? t('Token 工厂总览')
      : t('模型 × 引擎 调用排行');

  const handleTabChange = (key) => {
    setActiveTab(key);
    setError(null);
  };

  const commonProps = {
    refreshSignal,
    onLoadingChange: setLoading,
    onLastRefresh: setLastRefresh,
    onError: setError,
  };

  if (!prometheusEnabled) {
    return (
      <div className='mt-[60px] px-2'>
        <Empty
          description={t('Prometheus 数据源未配置，请在环境变量 PROMETHEUS_URL 中配置后重启服务')}
          style={{ paddingTop: 80 }}
        />
      </div>
    );
  }

  return (
    <div className='mt-[60px] px-2 h-full overflow-y-auto'>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        type='line'
        lazyRender
        className='mb-0'
        tabBarExtraContent={
          <div className='flex items-center gap-3 pr-2'>
            <Typography.Text strong>{tabTitle}</Typography.Text>
            <Tag color='blue'>{t('Prometheus 数据源')}</Tag>
            {error && (
              <Tag color='red' size='large'>
                {t('数据源连接失败')}：{error}
              </Tag>
            )}
            {lastRefresh && (
              <Typography.Text type='tertiary' className='text-xs'>
                {t('更新于')} {lastRefresh.toLocaleTimeString()}
              </Typography.Text>
            )}
            <Button
              size='small'
              icon={<IconRefresh />}
              loading={loading}
              onClick={() => setRefreshSignal((s) => s + 1)}
            >
              {t('刷新')}
            </Button>
          </div>
        }
      >
        <Tabs.TabPane tab={t('总览')} itemKey='overview'>
          <div className='pt-5'>
            <Overview {...commonProps} />
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('模型排行')} itemKey='ranking'>
          <div className='pt-5'>
            <Ranking {...commonProps} />
          </div>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default TokenFactory;
