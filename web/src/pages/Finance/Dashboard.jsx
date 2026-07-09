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
import { useNavigate } from 'react-router-dom';
import {
  IconMoneyExchangeStroked,
  IconCoinMoneyStroked,
  IconArrowUp,
  IconClockStroked,
  IconCursorStroked,
} from '@douyinfe/semi-icons';
import { API, showError } from '../../helpers';
import { StatusContext } from '../../context/Status';
import CardPro from '../../components/common/ui/CardPro';
import { formatMoney } from './utils';
import { createCardProPagination } from '../../helpers/utils';
import { useIsMobile } from '../../hooks/common/useIsMobile';

// 统计卡片组件
const StatCard = ({ children, icon, color, title, onClick }) => (
  <div
    style={{
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: '20px',
      flex: 1,
      minWidth: 200,
      cursor: onClick ? 'pointer' : 'default',
    }}
    onClick={onClick}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ color: '#999', fontSize: 14, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 24, fontWeight: 'bold', color }}>{children}</div>
      </div>
      {icon && (
        <div style={{ color }}>
          {icon}
        </div>
      )}
    </div>
  </div>
);

export default function FinanceDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [statusState] = useContext(StatusContext);
  const isMobile = useIsMobile();

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
    const newStart = dates[0]?.format?.('YYYY-MM-DD') || dates[0] || '';
    const newEnd = dates[1]?.format?.('YYYY-MM-DD') || dates[1] || '';
    setStartDate(newStart);
    setEndDate(newEnd);
    setDateRange(dates);
  };

  // 统计区域 - 4 个统计卡片
  const statsArea = (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 0 }}>
      <StatCard
        title={t('总消耗')}
        color="#1890ff"
        icon={<IconMoneyExchangeStroked style={{ fontSize: 24 }} />}
        onClick={() => navigate('/console/finance/revenue')}
      >
        {dashboardData ? formatMoney(dashboardData.total_revenue) : '-'}
      </StatCard>
      <StatCard
        title={t('总充值')}
        color="#52c41a"
        icon={<IconCoinMoneyStroked style={{ fontSize: 24 }} />}
        onClick={() => navigate('/console/finance/revenue')}
      >
        {dashboardData ? formatMoney(dashboardData.total_topup) : '-'}
      </StatCard>
      <StatCard
        title={t('今日消耗')}
        color="#722ed1"
        icon={<IconArrowUp style={{ fontSize: 24 }} />}
        onClick={() => navigate('/console/finance/revenue')}
      >
        {dashboardData ? formatMoney(dashboardData.today_revenue) : '-'}
      </StatCard>
      <StatCard
        title={t('订单数')}
        color="#fa8c16"
        icon={<IconClockStroked style={{ fontSize: 24 }} />}
        onClick={() => navigate('/console/finance/orders')}
      >
        {dashboardData?.order_count || 0}
      </StatCard>
    </div>
  );

  // 搜索区域 - 日期范围选择器 + 查询按钮
  const searchArea = (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          padding: '0 12px',
          height: 40,
          minWidth: 280,
          backgroundColor: '#fff',
        }}
      >
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={{
            border: 'none',
            outline: 'none',
            fontSize: 14,
            flex: 1,
            backgroundColor: 'transparent',
          }}
          placeholder={t('开始日期')}
        />
        <span style={{ color: '#999', margin: '0 8px' }}>至</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          style={{
            border: 'none',
            outline: 'none',
            fontSize: 14,
            flex: 1,
            backgroundColor: 'transparent',
          }}
          placeholder={t('结束日期')}
        />
      </div>
      <button
        onClick={() => { fetchDashboard(); fetchRevenueTrend(); }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 40,
          padding: '0 16px',
          backgroundColor: '#1677ff',
          color: '#fff',
          border: '1px solid #1677ff',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 500,
          cursor: dashboardLoading ? 'not-allowed' : 'pointer',
          opacity: dashboardLoading ? 0.6 : 1,
        }}
        disabled={dashboardLoading}
      >
        {t('查询')}
      </button>
    </div>
  );

  // 营收趋势图表
  const revenueTrendChart = revenueTrend.length > 0 ? (
    <div style={{ height: 300, display: 'flex', alignItems: 'flex-end', gap: 4, padding: '20px 0' }}>
      {revenueTrend.map((item) => {
        const maxRevenue = Math.max(...revenueTrend.map((r) => r.revenue || 0), 1);
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
  );

  return (
    <CardPro
      type='type2'
      statsArea={statsArea}
      searchArea={searchArea}
      t={t}
    >
      {/* 营收趋势 */}
      <div
        style={{
          marginBottom: 16,
          padding: 20,
          backgroundColor: '#fafafa',
          borderRadius: 8,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          {t('近30天营收趋势')}
        </div>
        {dashboardLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: '3px solid #f0f0f0',
                borderTopColor: '#1677ff',
                borderRadius: '50%',
                animation: 'semi-spin 0.6s infinite linear',
                margin: '0 auto',
              }}
            />
          </div>
        ) : (
          revenueTrendChart
        )}
      </div>
    </CardPro>
  );
}
