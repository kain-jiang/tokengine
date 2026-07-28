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
import * as XLSX from 'xlsx';
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

  // ===== 获取统计数据（全局统计，不受时间控件控制） =====
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      // 不传时间参数，获取全局统计
      const res = await API.get('/api/finance/revenue-management/stats');
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
      const params = {
        start_time: startTime,
        end_time: endTime,
        p: payAsYouGoPage,
        page_size: payAsYouGoPageSize,
      };
      if (searchKeyword) {
        params.keyword = searchKeyword;
      }
      const res = await API.get('/api/finance/pay-as-you-go-by-user', { params });
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
  // 顶部统计卡片：只在组件挂载时加载一次全局统计，不受时间控件控制
  useEffect(() => {
    fetchStats();
  }, []);

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

  // 获取数据（当时间范围、页码、搜索关键词或 tab 变化时）
    useEffect(() => {
      if (revenueTab === 'payg') {
        fetchPayAsYouGo();
      } else {
        fetchSubscriptionOrders();
      }
    }, [startTime, endTime, revenueTab, payAsYouGoPage, payAsYouGoPageSize, subscriptionPage, subscriptionPageSize, searchKeyword]);

  // ===== 导出 Excel（一个文件，两个 sheet） =====
  const handleExportCsv = async () => {
    if (startTime === 0 || endTime === 0) return;
    setExportLoading(true);
    try {
      const params = { start_time: startTime, end_time: endTime };
      const dateStr = new Date().toISOString().slice(0, 10);

      // 1. 获取按量付费数据
      const paygRes = await API.get('/api/finance/pay-as-you-go-by-user', {
        params: {
          ...params,
          p: 1,
          page_size: 10000, // 获取所有数据
          keyword: searchKeyword || '',
        },
        responseType: 'json',
      });

      // 2. 获取订阅套餐数据
      const subRes = await API.get('/api/finance/subscription-orders', {
        params: {
          ...params,
          p: 1,
          page_size: 10000, // 获取所有数据
          keyword: searchKeyword || '',
        },
        responseType: 'json',
      });

      // 3. 创建工作簿
      const wb = XLSX.utils.book_new();

      // 4. 转换按量付费数据为 sheet
      if (paygRes.data.success && paygRes.data.data && paygRes.data.data.length > 0) {
        const paygData = paygRes.data.data.map(row => {
          const item = {};
          payAsYouGoColumns.forEach(col => {
            item[col.title] = row[col.dataIndex] || '';
          });
          return item;
        });
        const ws1 = XLSX.utils.json_to_sheet(paygData);
        XLSX.utils.book_append_sheet(wb, ws1, '按量付费');
      }

      // 5. 转换订阅套餐数据为 sheet
      if (subRes.data.success && subRes.data.data && subRes.data.data.length > 0) {
        const subData = subRes.data.data.map(row => {
          const item = {};
          subscriptionColumns.forEach(col => {
            item[col.title] = row[col.dataIndex] || '';
          });
          return item;
        });
        const ws2 = XLSX.utils.json_to_sheet(subData);
        XLSX.utils.book_append_sheet(wb, ws2, '订阅套餐');
      }

      // 6. 导出文件
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `revenue_management_${dateStr}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSuccess(t('导出成功'));
    } catch (error) {
      console.error('导出Excel失败:', error);
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
      render: (text) => text || '-',
    },
    {
      title: t('订阅时间'),
      dataIndex: 'subscribe_time',
      key: 'subscribe_time',
      width: 160,
      render: (val) => val ? timestamp2string(val) : '-',
    },
    {
      title: t('开始时间'),
      dataIndex: 'start_time',
      key: 'start_time',
      width: 160,
      render: (val) => val ? timestamp2string(val) : '-',
    },
    {
      title: t('到期时间'),
      dataIndex: 'expire_time',
      key: 'expire_time',
      width: 160,
      render: (val) => val ? timestamp2string(val) : '-',
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (val) => {
        const statusMap = {
          'active': t('生效中'),
          'expired': t('已过期'),
          'cancelled': t('已取消'),
          'refunded': t('已退款'),
        };
        return <Text type={val === 'active' ? 'success' : 'secondary'}>{statusMap[val] || val || '-'}</Text>;
      },
    },
    {
      title: t('金额'),
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      width: 120,
      render: (val, record) => (
        <Text type='primary'>{formatMoney(val)} {record.currency || 'CNY'}</Text>
      ),
    },
    {
      title: t('额度类型'),
      dataIndex: 'amount_total',
      key: 'amount_total',
      width: 150,
      render: (val, record) => renderQuotaOrTokens(val, record.plan_type),
    },
    {
      title: t('已用额度'),
      dataIndex: 'amount_used',
      key: 'amount_used',
      width: 150,
      render: (val, record) => renderUsedQuota(val, record.amount_total, record.plan_type),
    },
    {
      title: t('剩余额度'),
      dataIndex: 'remain',
      key: 'remain',
      width: 150,
      render: (_, record) => renderRemainQuota(record.amount_total, record.amount_used, record.plan_type),
    },
    {
      title: t('Tokens 额度'),
      dataIndex: 'tokens_amount',
      key: 'tokens_amount',
      width: 130,
      render: (val, record) => {
        if (record.plan_type !== 'tokens') return '-';
        return renderQuotaOrTokens(val, record.plan_type);
      },
    },
    {
      title: t('已用 Tokens'),
      dataIndex: 'tokens_used',
      key: 'tokens_used',
      width: 130,
      render: (val, record) => {
        if (record.plan_type !== 'tokens') return '-';
        return renderUsedQuota(val, record.tokens_amount, record.plan_type);
      },
    },
    {
      title: t('剩余 Tokens'),
      dataIndex: 'tokens_remain',
      key: 'tokens_remain',
      width: 130,
      render: (_, record) => {
        if (record.plan_type !== 'tokens') return '-';
        return renderRemainQuota(record.tokens_amount, record.tokens_used, record.plan_type);
      },
    },
  ], [t, navigate, startTime, endTime, renderQuotaOrTokens, renderUsedQuota, renderRemainQuota]);

  // ===== 渲染 =====
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 顶部统计卡片（5 个指标） */}
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
