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

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  DatePicker, Table, Typography, Button, Tabs, TabPane, Input,
  Spin, Empty,
} from '@douyinfe/semi-ui';
import {
  IconCoinMoneyStroked, IconMoneyExchangeStroked, IconTickCircle,
  IconClockStroked, IconDownloadStroked,
} from '@douyinfe/semi-icons';
import { IllustrationNoResult, IllustrationNoResultDark } from '@douyinfe/semi-illustrations';
import { API, timestamp2string, showError, showSuccess, renderQuota } from '../../helpers';
import { formatMoney } from './utils';
import { createCardProPagination } from '../../helpers/utils';
import { useIsMobile } from '../../hooks/common/useIsMobile';

const { Text } = Typography;

// StatCard 组件（遵循 DESIGN.md 样式）
const StatCard = ({ children, icon, color, title }) => (
  <div style={{
    backgroundColor: '#ffffff',
    borderRadius: 4,
    padding: '20px',
    flex: 1,
    minWidth: 150,
    border: '1px solid rgba(0, 0, 0, 0.08)',
    boxShadow: 'rgba(1, 1, 32, 0.1) 0px 4px 10px',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{
          color: 'rgba(0, 0, 0, 0.4)',
          fontSize: 12,
          fontFamily: 'PP Neue Montreal Mono, Georgia, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: '0.055px',
          marginBottom: 8
        }}>{title}</div>
        <div style={{
          fontSize: 20,
          fontWeight: 500,
          color,
          lineHeight: 1.25,
          letterSpacing: '-0.16px'
        }}>{children}</div>
      </div>
      {icon && <div style={{ color: 'rgba(0, 0, 0, 0.4)' }}>{icon}</div>}
    </div>
  </div>
);

export default function RevenueManagement() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // ===== 搜索条件 =====
  const [keyword, setKeyword] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  // ===== 日期范围（默认上个月 00:00:00 至今天） =====
  const [dateRange, setDateRange] = useState({
    startDate: null,
    endDate: null,
  });

  // 统计数据
  const [stats, setStats] = useState({
    consume_user_count: 0,
    pay_as_you_go_amount: 0,
    subscription_amount: 0,
    subscription_count: 0,
    top_subscription: '-',
  });
  const [statsLoading, setStatsLoading] = useState(false);

  // 视图切换
  const [revenueTab, setRevenueTab] = useState('payg');
  const [tableKey, setTableKey] = useState(0); // 用于强制表格重新渲染

  // 按量付费数据
  const [payAsYouGoData, setPayAsYouGoData] = useState({ items: [], total: 0 });
  const [payAsYouGoPage, setPayAsYouGoPage] = useState(1);
  const [payAsYouGoPageSize, setPayAsYouGoPageSize] = useState(10);
  const [paygLoading, setPaygLoading] = useState(false);

  // 订阅套餐数据
  const [subscriptionData, setSubscriptionData] = useState({ items: [], total: 0 });
  const [subscriptionPage, setSubscriptionPage] = useState(1);
  const [subscriptionPageSize, setSubscriptionPageSize] = useState(10);
  const [subLoading, setSubLoading] = useState(false);

  const [exportLoading, setExportLoading] = useState(false);

  // ===== 时间戳计算 =====
  const startTime = useMemo(() => {
    if (dateRange.startDate) {
      return Math.floor(dateRange.startDate.getTime() / 1000);
    }
    return 0;
  }, [dateRange]);

  const endTime = useMemo(() => {
    if (dateRange.endDate) {
      return Math.ceil(dateRange.endDate.getTime() / 1000);
    }
    return 0;
  }, [dateRange]);

  // ===== 查询处理 =====
  const handleSearch = () => {
    setSearchKeyword(keyword);
    setPayAsYouGoPage(1);
    setSubscriptionPage(1);
  };

  const handleClearSearch = () => {
    setKeyword('');
    setSearchKeyword('');
    setPayAsYouGoPage(1);
    setSubscriptionPage(1);
  };

  // ===== 初始化默认时间（上个月同一天 00:00:00 至今日） =====
  useEffect(() => {
    const endDate = new Date();
    const startDate = new Date();
    // 设置为上个月的同一天 00:00:00
    startDate.setMonth(startDate.getMonth() - 1);
    startDate.setHours(0, 0, 0, 0);
    setDateRange({ startDate, endDate });
  }, []);

  // ===== 获取统计数据 =====
  const fetchStats = async () => {
    if (startTime === 0 || endTime === 0) return;
    setStatsLoading(true);
    try {
      const res = await API.get('/api/finance/revenue-management/stats', {
        params: { start_time: startTime, end_time: endTime },
      });
      if (res.data.success) {
        setStats(res.data.data || {
          consume_user_count: 0,
          pay_as_you_go_amount: 0,
          subscription_amount: 0,
          subscription_count: 0,
          top_subscription: '-',
        });
      }
    } catch (error) {
      console.error('获取营收管理统计失败:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // ===== 获取按量付费数据 =====
  const fetchPayAsYouGo = async () => {
    if (startTime === 0 || endTime === 0) return;
    setPaygLoading(true);
    try {
      const res = await API.get('/api/finance/pay-as-you-go-by-user', {
        params: {
          start_time: startTime,
          end_time: endTime,
          p: payAsYouGoPage,
          page_size: payAsYouGoPageSize,
        },
      });
      if (res.data.success) {
        setPayAsYouGoData({
          items: res.data.data || [],
          total: res.data.total || 0,
        });
      }
    } catch (error) {
      console.error('获取按量付费数据失败:', error);
    } finally {
      setPaygLoading(false);
    }
  };

  // ===== 获取订阅套餐数据 =====
  const fetchSubscriptionOrders = async () => {
    if (startTime === 0 || endTime === 0) return;
    setSubLoading(true);
    try {
      const params = {
        start_time: startTime,
        end_time: endTime,
        p: subscriptionPage,
        page_size: subscriptionPageSize,
      };
      if (searchKeyword) {
        params.keyword = searchKeyword;
      }
      console.log('[RevenueManagement] 请求订阅套餐数据:', params);
      const res = await API.get('/api/finance/subscription-orders', { params });
      console.log('[RevenueManagement] 订阅套餐响应 (完整):', JSON.stringify(res.data, null, 2));
      console.log('[RevenueManagement] res.data.success:', res.data.success);
      console.log('[RevenueManagement] res.data.data:', res.data.data);
      console.log('[RevenueManagement] res.data.total:', res.data.total);
      if (res.data.success) {
        const items = res.data.data || [];
        console.log('[RevenueManagement] 设置 items:', items.length, '条记录');
        setSubscriptionData({
          items: items,
          total: res.data.total || 0,
        });
      }
    } catch (error) {
      console.error('获取订阅套餐数据失败:', error);
    } finally {
      setSubLoading(false);
    }
  };

  // ===== 数据加载 =====
  useEffect(() => {
    fetchStats();
  }, [startTime, endTime]);

  // 切换视图时重置当前 tab 的页码和强制表格重新渲染
  useEffect(() => {
    if (revenueTab === 'payg') {
      setPayAsYouGoPage(1);
    } else {
      setSubscriptionPage(1);
    }
    // 强制表格重新渲染，清除旧 tab 的数据
    setTableKey(prev => prev + 1);
  }, [revenueTab]);

  // 获取数据（当时间范围、页码或 tab 变化时）
  useEffect(() => {
    if (revenueTab === 'payg') {
      fetchPayAsYouGo();
    } else {
      fetchSubscriptionOrders();
    }
  }, [startTime, endTime, revenueTab, payAsYouGoPage, payAsYouGoPageSize, subscriptionPage, subscriptionPageSize]);

  // ===== 导出 CSV =====
  const handleExportCsv = async () => {
    if (startTime === 0 || endTime === 0) return;
    setExportLoading(true);
    try {
      const res = await API.get('/api/finance/revenue-management/export-csv', {
        params: { start_time: startTime, end_time: endTime },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `revenue_management_${new Date().toISOString().slice(0, 10)}.csv`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showSuccess(t('导出成功'));
    } catch (error) {
      console.error('导出CSV失败:', error);
      showError(t('导出失败'));
    } finally {
      setExportLoading(false);
    }
  };

  // ===== 表格列定义：按量付费 =====
  const payAsYouGoColumns = useMemo(() => [
    {
      title: t('用户名'),
      dataIndex: 'username',
      key: 'username',
      width: 180,
      render: (text) => (
        <Text
          type='primary'
          style={{ cursor: 'pointer' }}
          onClick={() => {
            if (text) {
              navigate('/console/log', {
                state: {
                  filterUsername: text,
                  startTime: startTime,
                  endTime: endTime,
                  logType: '2',
                },
              });
            }
          }}
        >
          {text || '-'}
        </Text>
      ),
    },
    {
      title: t('金额'),
      dataIndex: 'amount',
      key: 'amount',
      width: 160,
      render: (val) => <Text type='primary'>{formatMoney(val)}</Text>,
    },
  ], [t, navigate, startTime, endTime]);

  // 格式化额度显示：根据套餐类型区分
  // 使用 renderQuota 与 MyPlan 保持一致（quota → USD → CNY 汇率转换）
  const renderQuotaOrTokens = (val, planType) => {
    if (!val || val <= 0) return '-';
    if (planType === 'tokens') {
      return <Text type='primary'>{val.toLocaleString()} Tokens</Text>;
    }
    return <Text type='primary'>{renderQuota(val)}</Text>;
  };

  // 格式化已用额度显示
  const renderUsedQuota = (used, total, planType) => {
    if (total <= 0 || used <= 0) return '-';
    const percent = Math.round((used / total) * 100);
    if (planType === 'tokens') {
      return <span>{used.toLocaleString()} Tokens ({percent}%)</span>;
    }
    return <span>{renderQuota(used)} ({percent}%)</span>;
  };

  // 格式化剩余额度显示
  const renderRemainQuota = (total, used, planType) => {
    if (total <= 0) return '-';
    const remain = Math.max(0, total - used);
    if (planType === 'tokens') {
      return <Text type='warning'>{remain.toLocaleString()} Tokens</Text>;
    }
    return <Text type='warning'>{renderQuota(remain)}</Text>;
  };

  // ===== 表格列定义：订阅套餐 =====
  const subscriptionColumns = useMemo(() => [
    {
      title: t('用户名'),
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (text) => (
        <Text
          type='primary'
          style={{ cursor: 'pointer' }}
          onClick={() => {
            if (text) {
              navigate('/console/log', {
                state: {
                  filterUsername: text,
                  startTime: startTime,
                  endTime: endTime,
                  logType: '2',
                },
              });
            }
          }}
        >
          {text || '-'}
        </Text>
      ),
    },
    {
      title: t('套餐类型'),
      dataIndex: 'plan_type',
      key: 'plan_type',
      width: 100,
      render: (val) => (
        <Text type={val === 'tokens' ? 'warning' : 'tertiary'}>
          {val === 'tokens' ? t('tokens') : t('额度')}
        </Text>
      ),
    },
    {
      title: t('套餐名称'),
      dataIndex: 'plan_name',
      key: 'plan_name',
      width: 200,
      ellipsis: true,
      render: (text, record) => (
        <span title={`${text} · ${t('订阅')} #${record.user_id}`}>
          {text ? `${text} · ${t('订阅')} #${record.user_id}` : '-'}
        </span>
      ),
    },
    {
      title: t('来源'),
      dataIndex: 'source',
      key: 'source',
      width: 100,
    },
    {
      title: t('订阅时间'),
      dataIndex: 'subscribe_time',
      key: 'subscribe_time',
      width: 160,
      render: (val) => <span>{val ? timestamp2string(val) : '-'}</span>,
    },
    {
      title: t('到期时间'),
      dataIndex: 'expire_time',
      key: 'expire_time',
      width: 160,
      render: (val) => <span>{val > 0 ? timestamp2string(val) : '-'}</span>,
    },
    {
      title: t('实收金额'),
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      width: 120,
      render: (val) => <Text type='success'>{formatMoney(val)}</Text>,
    },
    {
      title: t('实得价值'),
      dataIndex: 'amount_total',
      key: 'amount_total',
      width: 150,
      render: (val, record) => {
        // 优先使用 amount_total，如果没有则使用 tokens_amount
        const total = (val && val > 0) ? val : (record.tokens_amount || 0);
        return renderQuotaOrTokens(total, record.plan_type);
      },
    },
    {
      title: t('已用额度'),
      dataIndex: 'amount_used',
      key: 'amount_used',
      width: 150,
      render: (val, record) => {
        const total = (record.amount_total && record.amount_total > 0)
          ? record.amount_total
          : (record.tokens_amount || 0);
        const used = record.tokens_used && record.plan_type === 'tokens'
          ? record.tokens_used
          : (val || 0);
        return renderUsedQuota(used, total, record.plan_type);
      },
    },
    {
      title: t('剩余额度'),
      key: 'remain_quota',
      width: 150,
      render: (_, record) => {
        const total = (record.amount_total && record.amount_total > 0)
          ? record.amount_total
          : (record.tokens_amount || 0);
        const used = record.tokens_used && record.plan_type === 'tokens'
          ? record.tokens_used
          : (record.amount_used || 0);
        return renderRemainQuota(total, used, record.plan_type);
      },
    },
  ], [t, navigate, startTime, endTime]);

  // ===== 渲染 =====
  return (
    <div>
      {/* 头部统计卡片（5个指标） */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <StatCard
          title={t('消费用户数')}
          color="#1890ff"
          icon={<IconCoinMoneyStroked style={{ fontSize: 24 }} />}
        >
          {statsLoading ? <Spin size="small" /> : stats.consume_user_count?.toLocaleString() || 0}
        </StatCard>
        <StatCard
          title={t('按量付费金额')}
          color="#52c41a"
          icon={<IconMoneyExchangeStroked style={{ fontSize: 24 }} />}
        >
          {statsLoading ? <Spin size="small" /> : formatMoney(stats.pay_as_you_go_amount)}
        </StatCard>
        <StatCard
          title={t('订阅付费金额')}
          color="#722ed1"
          icon={<IconTickCircle style={{ fontSize: 24 }} />}
        >
          {statsLoading ? <Spin size="small" /> : formatMoney(stats.subscription_amount)}
        </StatCard>
        <StatCard
          title={t('订阅付费次数')}
          color="#fa8c16"
          icon={<IconClockStroked style={{ fontSize: 24 }} />}
        >
          {statsLoading ? <Spin size="small" /> : stats.subscription_count?.toLocaleString() || 0}
        </StatCard>
        <StatCard
          title={t('热门订阅')}
          color="#eb2f96"
          icon={<IconMoneyExchangeStroked style={{ fontSize: 24 }} />}
        >
          {statsLoading ? <Spin size="small" /> : stats.top_subscription || '-'}
        </StatCard>
      </div>

      {/* 时间控件 + 搜索 + 导出按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <DatePicker
            type='dateTime'
            placeholder={t('开始时间')}
            value={dateRange.startDate}
            onChange={(value) => {
              setDateRange((prev) => ({ ...prev, startDate: value }));
            }}
            maxDate={dateRange.endDate || new Date()}
            disabledDate={(date) => date > new Date()}
            style={{ minWidth: '220px' }}
          />
          <span style={{ color: 'rgba(0, 0, 0, 0.4)' }}>~</span>
          <DatePicker
            type='dateTime'
            placeholder={t('结束时间')}
            value={dateRange.endDate}
            onChange={(value) => {
              setDateRange((prev) => ({ ...prev, endDate: value }));
            }}
            minDate={dateRange.startDate}
            maxDate={new Date()}
            style={{ minWidth: '220px' }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
           
            <Input
              placeholder={t('请输入用户名')}
              value={keyword}
              onChange={(val) => setKeyword(val)}
              style={{ width: 180 }}
              onPressEnter={handleSearch}
            />
            <Button type='primary' onClick={handleSearch}>
              {t('查询')}
            </Button>
            <Button onClick={handleClearSearch}>
              {t('重置')}
            </Button>
          </div>
        </div>
        <Button
          icon={<IconDownloadStroked />}
          type='primary'
          loading={exportLoading}
          onClick={handleExportCsv}
        >
          {t('导出 CSV')}
        </Button>
      </div>

      {/* 表格区域 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 4,
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: 'rgba(1, 1, 32, 0.1) 0px 4px 10px',
        padding: '16px',
      }}>
        {/* 标题 + 视图切换 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'rgba(0, 0, 0, 0.85)',
            letterSpacing: 0.055,
          }}>{t('营收明细')}</div>
          <Tabs
            type='card'
            activeTab={revenueTab}
            onChange={(tab) => setRevenueTab(tab)}
          >
            <TabPane tab={t('按量付费')} itemKey='payg' />
            <TabPane tab={t('订阅套餐')} itemKey='subscription' />
          </Tabs>
        </div>

        {/* 表格 */}
        <Table
          key={tableKey}
          columns={revenueTab === 'payg' ? payAsYouGoColumns : subscriptionColumns}
          dataSource={revenueTab === 'payg' ? (payAsYouGoData.items || []) : (subscriptionData.items || [])}
          loading={revenueTab === 'payg' ? paygLoading : subLoading}
          rowKey={(record) => revenueTab === 'payg'
            ? `payg-${record.user_id}-${record.username}`
            : `sub-${record.user_id}-${record.subscribe_time}`}
          pagination={false}
          size='small'
          empty={
            <Empty
              image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
              darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
              description={t('暂无数据')}
              style={{ padding: 30 }}
            />
          }
        />

        {/* 分页 */}
        <div className='flex w-full pt-4 border-t justify-between items-center'
             style={{ borderColor: 'rgba(0, 0, 0, 0.08)', borderTopWidth: 1, marginTop: 16 }}>
          {revenueTab === 'payg' ? (
            createCardProPagination({
              currentPage: payAsYouGoPage,
              pageSize: payAsYouGoPageSize,
              total: payAsYouGoData.total || 0,
              onPageChange: (page) => setPayAsYouGoPage(page),
              onPageSizeChange: (size) => { setPayAsYouGoPageSize(size); setPayAsYouGoPage(1); },
              isMobile: isMobile,
              t: t,
            })
          ) : (
            createCardProPagination({
              currentPage: subscriptionPage,
              pageSize: subscriptionPageSize,
              total: subscriptionData.total || 0,
              onPageChange: (page) => setSubscriptionPage(page),
              onPageSizeChange: (size) => { setSubscriptionPageSize(size); setSubscriptionPage(1); },
              isMobile: isMobile,
              t: t,
            })
          )}
        </div>
      </div>
    </div>
  );
}
