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
import {
  NativeRow,
  NativeCol,
  NativeCard,
  NativeSpace,
  NativeTag,
  NativeSelect,
  NativeTable,
  NativeSpin,
  NativeText,
} from './NativeLayout';

// 日期范围预设
const DATE_RANGES = [
  { label: '最近7天', value: '7d' },
  { label: '最近30天', value: '30d' },
  { label: '最近90天', value: '90d' },
  { label: '本月', value: 'current_month' },
  { label: '上月', value: 'last_month' },
];

const formatMoney = (value) => {
  if (!value && value !== 0) return '-';
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export default function Revenue() {
  const { t } = useTranslation();
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
        // 后端直接返回 trend 数组：[ { date, revenue, topup }, ... ]
        const trendArray = res.data?.data || [];
        setTrendData(trendArray);
        // 计算总营收
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
        // 后端返回 { success: true, data: [...], total: 123 }
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

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        {/* 日期范围选择 */}
        <NativeCard style={{ marginBottom: 24 }}>
          <NativeSpace>
            <NativeText>{t('时间范围')}:</NativeText>
            <NativeSelect
              value={dateRange}
              onChange={setDateRange}
              options={DATE_RANGES}
              style={{ width: 150 }}
            />
          </NativeSpace>
        </NativeCard>

        {/* 统计卡片 */}
        {revenueData && (
          <NativeRow gutter={24} style={{ marginBottom: 24 }}>
            <NativeCol span={6}>
              <NativeCard bodyStyle={{ padding: '20px' }}>
                <div style={{ color: '#10b981', fontSize: 24, fontWeight: 'bold' }}>
                  {formatMoney(revenueData?.total_revenue)}
                </div>
                <div style={{ color: '#999', fontSize: 14 }}>{t('总营收')}</div>
              </NativeCard>
            </NativeCol>
            <NativeCol span={6}>
              <NativeCard bodyStyle={{ padding: '20px' }}>
                <div style={{ color: '#3b82f6', fontSize: 24, fontWeight: 'bold' }}>
                  {formatMoney(revenueData?.today_revenue)}
                </div>
                <div style={{ color: '#999', fontSize: 14 }}>{t('今日营收')}</div>
              </NativeCard>
            </NativeCol>
            <NativeCol span={6}>
              <NativeCard bodyStyle={{ padding: '20px' }}>
                <div style={{ color: '#8b5cf6', fontSize: 24, fontWeight: 'bold' }}>
                  {formatMoney(revenueData?.month_revenue)}
                </div>
                <div style={{ color: '#999', fontSize: 14 }}>{t('本月营收')}</div>
              </NativeCard>
            </NativeCol>
            <NativeCol span={6}>
              <NativeCard bodyStyle={{ padding: '20px' }}>
                <div style={{ color: '#f59e0b', fontSize: 24, fontWeight: 'bold' }}>
                  {revenueData?.total_orders || 0}
                </div>
                <div style={{ color: '#999', fontSize: 14 }}>{t('订单数')}</div>
              </NativeCard>
            </NativeCol>
          </NativeRow>
        )}

        {/* 营收趋势图表 */}
        <NativeCard title={t('营收趋势')} style={{ marginBottom: 24 }}>
          {trendData.length > 0 ? (
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
              <NativeText type="tertiary">{t('暂无数据')}</NativeText>
            </div>
          )}
        </NativeCard>

        {/* 营收报表列表 */}
        <NativeCard title={t('营收报表详情')}>
          <NativeTable
            columns={[
              {
                title: t('日期'),
                dataIndex: 'report_date',
                render: (date) => new Date(date * 1000).toLocaleDateString('zh-CN'),
              },
              {
                title: t('订单数'),
                dataIndex: 'order_count',
              },
              {
                title: t('总营收'),
                dataIndex: 'total_revenue',
                render: (value) => formatMoney(value),
              },
              {
                title: t('平均订单金额'),
                dataIndex: 'avg_order_amount',
                render: (value) => formatMoney(value),
              },
              {
                title: t('支付方式分布'),
                dataIndex: 'payment_methods',
                render: (methods) => {
                  if (!methods) return '-';
                  return Object.entries(methods).map(([key, value]) => (
                    <NativeTag key={key} color="blue" style={{ margin: '2px 4px 2px 0' }}>
                      {key}: {formatMoney(value)}
                    </NativeTag>
                  ));
                },
              },
            ]}
            dataSource={reportData}
            loading={loading}
            pagination={{
              current: reportPage,
              pageSize: reportPageSize,
              total: reportTotal,
              onChange: (page) => setReportPage(page),
              showTotal: (total) => `共 ${total} 条`,
              pageSizeActions: [10, 20, 50],
            }}
          />
        </NativeCard>
      </div>
    </div>
  );
}
