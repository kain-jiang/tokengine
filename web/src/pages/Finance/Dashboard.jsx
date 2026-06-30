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

import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IconMoneyExchangeStroked,
  IconCoinMoneyStroked,
  IconArrowUp,
  IconClockStroked,
} from '@douyinfe/semi-icons';
import { API, showError } from '../../helpers';
import { StatusContext } from '../../context/Status';
import {
  NativeRow,
  NativeCol,
  NativeCard,
  NativeSpace,
  NativeButton,
  NativeSpin,
  NativeDatePicker,
  NativeText,
} from './NativeLayout';

// 格式化金额
const formatMoney = (value) => {
  if (!value && value !== 0) return '-';
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// 统计卡片组件
const StatCard = ({ children, icon, color, title }) => (
  <NativeCard bodyStyle={{ padding: '20px' }} style={{ borderRadius: 12 }}>
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: '#999', fontSize: 14, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold', color }}>{children}</div>
    </div>
    {icon && (
      <div style={{ float: 'right' }}>
        {icon}
      </div>
    )}
  </NativeCard>
);

export default function FinanceDashboard() {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);

  // 日期范围
  const [dateRange, setDateRange] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 数据状态
  const [dashboardData, setDashboardData] = useState(null);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // 获取财务概览数据
  const fetchDashboard = async () => {
    setDashboardLoading(true);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await API.get('/api/finance/dashboard', { params });
      if (res.data?.success) {
        setDashboardData(res.data?.data);
      }
    } catch (error) {
      console.error('获取财务概览失败:', error);
      showError(t('获取财务概览失败'));
    } finally {
      setDashboardLoading(false);
    }
  };

  // 获取营收趋势
  const fetchRevenueTrend = async () => {
    try {
      const days = 30;
      const res = await API.get('/api/finance/trend', {
        params: { days },
      });
      if (res.data?.success) {
        setRevenueTrend(res.data?.data || []);
      }
    } catch (error) {
      console.error('获取营收趋势失败:', error);
    }
  };

  // 加载数据
  useEffect(() => {
    fetchDashboard();
    fetchRevenueTrend();
  }, [startDate, endDate]);

  // 设置日期范围
  const handleDateRangeChange = (dates) => {
    if (!dates || dates.length === 0) {
      setStartDate('');
      setEndDate('');
      setDateRange([]);
      return;
    }
    // 处理单个或两个日期（兼容原生 input type="date" 返回的字符串和 moment.js 对象）
    const newStart = dates[0]?.format?.('YYYY-MM-DD') || dates[0] || '';
    const newEnd = dates[1]?.format?.('YYYY-MM-DD') || dates[1] || '';
    setStartDate(newStart);
    setEndDate(newEnd);
    setDateRange(dates);
  };

  // 渲染概览页面
  if (dashboardLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <NativeSpin size='large' />
      </div>
    );
  }

  return (
    <div>
      {/* 筛选栏 */}
      <NativeCard
        bodyStyle={{ padding: '16px 20px' }}
        style={{ borderRadius: 12, marginBottom: 16 }}
      >
        <NativeSpace size={12}>
          <NativeDatePicker
            value={dateRange}
            onChange={handleDateRangeChange}
          />
          <NativeButton 
            theme='solid' 
            type='primary'
            onClick={() => { fetchDashboard(); fetchRevenueTrend(); }}
          >
            {t('查询')}
          </NativeButton>
        </NativeSpace>
      </NativeCard>

      {/* 统计卡片 */}
      <NativeRow gutter={16} style={{ marginBottom: 24 }}>
        <NativeCol span={6}>
          <StatCard 
            title={t('总营收')} 
            color="#1890ff"
            icon={<IconMoneyExchangeStroked size='large' style={{ color: '#1890ff', float: 'right' }} />}
          >
            {dashboardData ? formatMoney(dashboardData.total_revenue) : '-'}
          </StatCard>
        </NativeCol>
        <NativeCol span={6}>
          <StatCard 
            title={t('总充值')} 
            color="#52c41a"
            icon={<IconCoinMoneyStroked size='large' style={{ color: '#52c41a', float: 'right' }} />}
          >
            {dashboardData ? formatMoney(dashboardData.total_topup) : '-'}
          </StatCard>
        </NativeCol>
        <NativeCol span={6}>
          <StatCard 
            title={t('今日营收')} 
            color="#722ed1"
            icon={<IconArrowUp size='large' style={{ color: '#722ed1', float: 'right' }} />}
          >
            {dashboardData ? formatMoney(dashboardData.today_revenue) : '-'}
          </StatCard>
        </NativeCol>
        <NativeCol span={6}>
          <StatCard 
            title={t('订单数')} 
            color="#fa8c16"
            icon={<IconClockStroked size='large' style={{ color: '#fa8c16', float: 'right' }} />}
          >
            {dashboardData?.order_count || 0}
          </StatCard>
        </NativeCol>
      </NativeRow>

      {/* 营收趋势 */}
      <NativeCard
        title={t('近30天营收趋势')}
        bodyStyle={{ padding: '20px' }}
        style={{ borderRadius: 12 }}
      >
        {revenueTrend.length > 0 ? (
          <div style={{ height: 300, display: 'flex', alignItems: 'flex-end', gap: 4, padding: '20px 0' }}>
            {revenueTrend.map((item) => {
              const maxRevenue = Math.max(
                ...revenueTrend.map((r) => r.revenue || 0),
                1
              );
              const height = Math.max((item.revenue / maxRevenue) * 250, 4);
              return (
                <div
                  key={item.date}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 40,
                      height,
                      background: 'linear-gradient(180deg, #1890ff 0%, #69c0ff 100%)',
                      borderRadius: '4px 4px 0 0',
                    }}
                  />
                  <span style={{ fontSize: 10, color: '#999', writingMode: 'vertical-rl' }}>
                    {item.date?.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            {t('暂无数据')}
          </div>
        )}
      </NativeCard>
    </div>
  );
}
