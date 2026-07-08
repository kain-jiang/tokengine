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
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';
import CardPro from '../../components/common/ui/CardPro';
import { formatMoney } from './utils';
import { createCardProPagination } from '../../helpers/utils';
import { useIsMobile } from '../../hooks/common/useIsMobile';

// 日期范围预设
const DATE_RANGES = [
  { label: '最近7天', value: '7d' },
  { label: '最近30天', value: '30d' },
  { label: '最近90天', value: '90d' },
  { label: '本月', value: 'current_month' },
  { label: '上月', value: 'last_month' },
];

export default function Revenue() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [revenueData, setRevenueData] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [dateRange, setDateRange] = useState('30d');
  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(10);
  const [reportTotal, setReportTotal] = useState(0);

  // 获取营收概览数据
  const fetchRevenueTrend = async () => {
    try {
      setLoading(true);
      const res = await API.get('/api/finance/trend', {
        params: { days: parseInt(dateRange.replace('d', '')) || 30 },
      });
      if (res.data?.success) {
        const trendArray = res.data?.data || [];
        setTrendData(trendArray);
        const totalRevenue = trendArray.reduce((sum, item) => sum + (item.revenue || 0), 0);
        setRevenueData({
          total_revenue: totalRevenue,
          today_revenue: trendArray.length > 0 ? trendArray[trendArray.length - 1]?.revenue || 0 : 0,
          total_orders: 0,
        });
      }
    } catch (error) {
      console.error('获取营收趋势失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取营收报表列表
  const fetchRevenueReports = async () => {
    try {
      const res = await API.get('/api/finance/reports', {
        params: {
          p: reportPage,
          page_size: reportPageSize,
        },
      });
      if (res.data?.success) {
        setReportData(res.data?.data || []);
        setReportTotal(res.data?.total || 0);
      }
    } catch (error) {
      console.error('获取营收报表失败:', error);
    }
  };

  useEffect(() => {
    fetchRevenueTrend();
  }, [dateRange]);

  useEffect(() => {
    fetchRevenueReports();
  }, [reportPage, reportPageSize]);

  // 统计区域 - 营收统计卡片
  const statsArea = (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 0 }}>
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: '20px',
          flex: 1,
          minWidth: 180,
        }}
      >
        <div style={{ color: '#999', fontSize: 14, marginBottom: 8 }}>{t('总营收')}</div>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: '#10b981' }}>
          {revenueData ? formatMoney(revenueData.total_revenue) : '-'}
        </div>
      </div>
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: '20px',
          flex: 1,
          minWidth: 180,
        }}
      >
        <div style={{ color: '#999', fontSize: 14, marginBottom: 8 }}>{t('今日营收')}</div>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: '#3b82f6' }}>
          {revenueData ? formatMoney(revenueData.today_revenue) : '-'}
        </div>
      </div>
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: '20px',
          flex: 1,
          minWidth: 180,
        }}
      >
        <div style={{ color: '#999', fontSize: 14, marginBottom: 8 }}>{t('本月营收')}</div>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: '#8b5cf6' }}>
          {revenueData ? formatMoney(revenueData.month_revenue) : '-'}
        </div>
      </div>
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: '20px',
          flex: 1,
          minWidth: 180,
        }}
      >
        <div style={{ color: '#999', fontSize: 14, marginBottom: 8 }}>{t('订单数')}</div>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: '#f59e0b' }}>
          {revenueData?.total_orders || 0}
        </div>
      </div>
    </div>
  );

  // 搜索区域 - 时间范围选择器
  const searchArea = (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: 14, color: 'rgba(0, 0, 0, 0.65)' }}>{t('时间范围')}:</span>
      <select
        value={dateRange}
        onChange={(e) => setDateRange(e.target.value)}
        style={{
          height: 32,
          padding: '0 12px',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          fontSize: 12,
          backgroundColor: '#fff',
          minWidth: 150,
          outline: 'none',
        }}
      >
        {DATE_RANGES.map((range) => (
          <option key={range.value} value={range.value}>{range.label}</option>
        ))}
      </select>
    </div>
  );

  // 营收趋势图表
  const revenueTrendChart = trendData.length > 0 ? (
    <div style={{ height: 300, display: 'flex', alignItems: 'flex-end', gap: 4, padding: '20px 0' }}>
      {trendData.map((item) => {
        const maxRevenue = Math.max(...trendData.map((r) => r.revenue || 0), 1);
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
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <span style={{ color: '#999' }}>{t('暂无数据')}</span>
    </div>
  );

  // 营收报表表格列
  const reportColumns = [
    {
      title: t('日期'),
      dataIndex: 'report_date',
      key: 'report_date',
      render: (date) => new Date(date * 1000).toLocaleDateString('zh-CN'),
    },
    {
      title: t('订单数'),
      dataIndex: 'order_count',
      key: 'order_count',
    },
    {
      title: t('总营收'),
      dataIndex: 'total_revenue',
      key: 'total_revenue',
      render: (value) => formatMoney(value),
    },
    {
      title: t('平均订单金额'),
      dataIndex: 'avg_order_amount',
      key: 'avg_order_amount',
      render: (value) => formatMoney(value),
    },
    {
      title: t('支付方式分布'),
      dataIndex: 'payment_methods',
      key: 'payment_methods',
      render: (methods) => {
        if (!methods) return '-';
        return Object.entries(methods).map(([key, value]) => (
          <span
            key={key}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: 12,
              backgroundColor: '#e6f4ff',
              color: '#1677ff',
              borderColor: '#91caff',
              border: '1px solid',
              margin: '2px 4px 2px 0',
            }}
          >
            {key}: {formatMoney(value)}
          </span>
        ));
      },
    },
  ];

  // 营收报表表格
  const reportTable = (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#fafafa' }}>
            {reportColumns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: '12px 16px',
                  textAlign: col.key === 'total_revenue' || col.key === 'avg_order_amount' ? 'right' : 'left',
                  borderBottom: '1px solid #f0f0f0',
                  fontWeight: 600,
                  color: 'rgba(0, 0, 0, 0.88)',
                  whiteSpace: 'nowrap',
                }}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reportData.map((report, index) => (
            <tr
              key={index}
              style={{ borderBottom: '1px solid #f0f0f0', transition: 'background-color 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {reportColumns.map((col) => (
                <td
                  key={`${index}-${col.key}`}
                  style={{
                    padding: '12px 16px',
                    textAlign: col.key === 'total_revenue' || col.key === 'avg_order_amount' ? 'right' : 'left',
                    color: 'rgba(0, 0, 0, 0.65)',
                  }}
                >
                  {col.render ? col.render(report[col.dataIndex], report) : report[col.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
          {reportData.length === 0 && !loading && (
            <tr>
              <td
                colSpan={reportColumns.length}
                style={{
                  padding: '40px 16px',
                  textAlign: 'center',
                  color: '#999',
                }}
              >
                {t('暂无数据')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  // 分页
  const paginationArea = createCardProPagination({
    currentPage: reportPage,
    pageSize: reportPageSize,
    total: reportTotal,
    onPageChange: setReportPage,
    onPageSizeChange: (size) => {
      setReportPageSize(size);
      setReportPage(1);
    },
    isMobile: isMobile,
    t: t,
  });

  return (
    <CardPro
      type='type2'
      statsArea={statsArea}
      searchArea={searchArea}
      paginationArea={paginationArea}
      t={t}
    >
      {/* 营收趋势图表 */}
      <div
        style={{
          marginBottom: 16,
          padding: 20,
          backgroundColor: '#fafafa',
          borderRadius: 8,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          {t('营收趋势')}
        </div>
        {loading && trendData.length === 0 ? (
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

      {/* 营收报表详情 */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          {t('营收报表详情')}
        </div>
        {loading && reportData.length === 0 ? (
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
          reportTable
        )}
      </div>
    </CardPro>
  );
}
