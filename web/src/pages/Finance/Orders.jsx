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
import {
  Table,
  Badge,
  Typography,
  Toast,
  Empty,
  Button,
  Input,
  Select,
  DatePicker,
  Modal,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { Coins, Download } from 'lucide-react';
import { IconSearch } from '@douyinfe/semi-icons';
import {
  IconMoneyExchangeStroked,
  IconCoinMoneyStroked,
  IconClockStroked,
  IconTickCircle,
} from '@douyinfe/semi-icons';
import { API, timestamp2string } from '../../helpers';
import CardPro from '../../components/common/ui/CardPro';
import { formatMoney } from './utils';
import { createCardProPagination } from '../../helpers/utils';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { isAdmin } from '../../helpers/utils';

// 状态映射配置
const STATUS_CONFIG = {
  success: { type: 'success', key: '成功' },
  pending: { type: 'warning', key: '待处理' },
  failed: { type: 'danger', key: '失败' },
  expired: { type: 'danger', key: '已过期' },
  cancelled: { type: 'default', key: '已取消' },
};

// 支付方式映射
const PAYMENT_METHOD_MAP = {
  stripe: 'Stripe',
  creem: 'Creem',
  waffo: 'Waffo',
  alipay: '支付宝',
  wxpay: '微信',
  zs_pay: '招商银行聚合支付',
  helipay: '合利宝支付',
};

export default function FinanceOrders() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const userIsAdmin = useMemo(() => isAdmin(), []);

  // 数据状态
  const [topups, setTopups] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // 筛选条件
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: null,
    endDate: null,
  });

  // 统计数据
  const [orderStats, setOrderStats] = useState({
    total_amount: 0,
    success_count: 0,
    pending_count: 0,
    failed_count: 0,
    total_refund: 0,
    refund_count: 0,
    today_amount: 0,
    today_count: 0,
    month_amount: 0,
    month_count: 0,
  });

  // 获取统计数据
  const fetchOrderStatistics = async () => {
    try {
      const res = await API.get('/api/finance/orders/statistics');
      if (res.data?.success) {
        setOrderStats(res.data?.data || {});
      }
    } catch (error) {
      console.error('获取订单统计失败:', error);
    }
  };

  // 加载充值记录
  const loadTopups = async (currentPage, currentPageSize) => {
    setLoading(true);
    try {
      let qs = `p=${currentPage}&page_size=${currentPageSize}`;
      if (keyword) {
        qs += `&keyword=${encodeURIComponent(keyword)}`;
      }
      if (statusFilter) {
        qs += `&status=${encodeURIComponent(statusFilter)}`;
      }
      if (dateRange.startDate) {
        qs += `&start_time=${Math.floor(dateRange.startDate.getTime() / 1000)}`;
      }
      if (dateRange.endDate) {
        qs += `&end_time=${Math.floor(dateRange.endDate.getTime() / 1000)}`;
      }
      const endpoint = `/api/user/topup?${qs}`;
      const res = await API.get(endpoint);
      const { success, message, data } = res.data;
      if (success) {
        setTopups(data.items || []);
        setTotal(data.total || 0);
      } else {
        Toast.error({ content: message || t('加载失败') });
      }
    } catch (error) {
      Toast.error({ content: t('加载账单失败') });
    } finally {
      setLoading(false);
    }
  };

  // 导出充值账单
  const handleExport = async () => {
    setExportLoading(true);
    try {
      let qs = '';
      if (keyword) {
        qs += `keyword=${encodeURIComponent(keyword)}`;
      }
      if (statusFilter) {
        qs += qs ? '&' : '';
        qs += `status=${encodeURIComponent(statusFilter)}`;
      }
      if (dateRange.startDate) {
        qs += qs ? '&' : '';
        qs += `start_time=${Math.floor(dateRange.startDate.getTime() / 1000)}`;
      }
      if (dateRange.endDate) {
        qs += qs ? '&' : '';
        qs += `end_time=${Math.floor(dateRange.endDate.getTime() / 1000)}`;
      }
      const endpoint = qs ? `/api/user/topup/export?${qs}` : '/api/user/topup/export';

      const res = await API.get(endpoint, {
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_history_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      Toast.success({ content: t('导出成功') });
    } catch (error) {
      Toast.error({ content: t('导出失败') });
    } finally {
      setExportLoading(false);
    }
  };

  // 查询按钮点击处理
  const handleSearch = () => {
    setPage(1);
  };

  // 初始化默认查询最近1个月
  useEffect(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    setDateRange({ startDate, endDate });
  }, []);

  // 加载数据
  useEffect(() => {
    fetchOrderStatistics();
    if (dateRange.startDate && dateRange.endDate) {
      loadTopups(page, pageSize);
    }
  }, [page, pageSize, keyword, statusFilter, dateRange]);

  // 管理员补单
  const handleAdminCompleteTopup = async (record) => {
    try {
      const res = await API.post('/admin/user/topup/complete', {
        trade_no: record.trade_no,
      });
      if (res.data.success) {
        Toast.success({ content: t('补单成功') });
        loadTopups(page, pageSize);
      } else {
        Toast.error({ content: res.data.message || t('补单失败') });
      }
    } catch (error) {
      Toast.error({ content: t('补单失败') });
    }
  };

  const handleStatusChange = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handlePageChange = (currentPage) => {
    setPage(currentPage);
  };

  const handlePageSizeChange = (currentPageSize) => {
    setPageSize(currentPageSize);
    setPage(1);
  };

  const handleKeywordChange = (value) => {
    setKeyword(value);
    setPage(1);
  };

  // 渲染状态徽章
  const renderStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || { type: 'primary', key: status };
    return (
      <span className='flex items-center gap-2'>
        <Badge dot type={config.type} />
        <span>{t(config.key)}</span>
      </span>
    );
  };

  // 渲染支付方式
  const renderPaymentMethod = (pm) => {
    const displayName = PAYMENT_METHOD_MAP[pm];
    return <Typography.Text>{displayName ? t(displayName) : pm || '-'}</Typography.Text>;
  };

  // 统计卡片组件
  const StatCard = ({ children, icon, color, title }) => (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: '20px',
        flex: 1,
        minWidth: 180,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: '#999', fontSize: 14, marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 22, fontWeight: 'bold', color }}>{children}</div>
        </div>
        {icon && (
          <div style={{ color }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );

  // 统计区域 - 6 个统计卡片
  const statsArea = (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 0 }}>
      <StatCard
        title={t('有效充值金额')}
        color="#1890ff"
        icon={<IconMoneyExchangeStroked style={{ fontSize: 24 }} />}
      >
        {formatMoney(orderStats.total_amount)}
      </StatCard>
      <StatCard
        title={t('退款金额')}
        color="#f5222d"
        icon={<IconClockStroked style={{ fontSize: 24 }} />}
      >
        {formatMoney(orderStats.total_refund)}
      </StatCard>
      <StatCard
        title={t('成功订单数')}
        color="#52c41a"
        icon={<IconTickCircle style={{ fontSize: 24 }} />}
      >
        {orderStats.success_count}
      </StatCard>
      <StatCard
        title={t('待处理订单')}
        color="#fa8c16"
        icon={<IconClockStroked style={{ fontSize: 24 }} />}
      >
        {orderStats.pending_count}
      </StatCard>
      <StatCard
        title={t('今日充值')}
        color="#722ed1"
        icon={<IconCoinMoneyStroked style={{ fontSize: 24 }} />}
      >
        {formatMoney(orderStats.today_amount)}
      </StatCard>
      <StatCard
        title={t('本月充值')}
        color="#13c2c2"
        icon={<IconCoinMoneyStroked style={{ fontSize: 24 }} />}
      >
        {formatMoney(orderStats.month_amount)}
      </StatCard>
    </div>
  );

  const columns = useMemo(() => {
    const baseColumns = [
      {
        title: t('用户'),
        dataIndex: 'username',
        key: 'username',
        width: 120,
        render: (username) => <Typography.Text>{username || '-'}</Typography.Text>,
      },
      {
        title: t('订单号'),
        dataIndex: 'trade_no',
        key: 'trade_no',
        width: 200,
        render: (text) => <Typography.Text copyable>{text}</Typography.Text>,
      },
      {
        title: t('支付方式'),
        dataIndex: 'payment_method',
        key: 'payment_method',
        width: 140,
        render: renderPaymentMethod,
      },
      {
        title: t('充值额度'),
        dataIndex: 'amount',
        key: 'amount',
        width: 120,
        render: (amount) => {
          return (
            <span className='flex items-center gap-1'>
              <Coins size={16} />
              <Typography.Text>{amount}</Typography.Text>
            </span>
          );
        },
      },
      {
        title: t('支付金额'),
        dataIndex: 'money',
        key: 'money',
        width: 120,
        render: (money) => <Typography.Text type='danger'>¥{money.toFixed(2)}</Typography.Text>,
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: renderStatusBadge,
      },
      {
        title: t('创建时间'),
        dataIndex: 'create_time',
        key: 'create_time',
        width: 180,
        render: (time) => timestamp2string(time),
      },
    ];

    // 管理员操作列
    if (userIsAdmin) {
      baseColumns.push({
        title: t('操作'),
        key: 'action',
        width: 100,
        fixed: 'right',
        render: (_, record) => {
          // 仅 pending 状态显示补单按钮
          if (record.status === 'pending') {
            return (
              <Button
                size='small'
                theme='solid'
                type='warning'
                onClick={() => handleAdminCompleteTopup(record)}
              >
                {t('补单')}
              </Button>
            );
          }
          return null;
        },
      });
    }

    return baseColumns;
  }, [t, userIsAdmin]);

  return (
    <CardPro
      type='type2'
      searchArea={
        <>
          {/* 日期范围和状态筛选 */}
          <div className='mb-3 p-3 bg-gray-50 rounded-lg'>
            <div className='flex flex-wrap items-center gap-2'>
              <DatePicker
                type='date'
                placeholder={t('开始日期')}
                value={dateRange.startDate}
                onChange={(value) => {
                  setDateRange((prev) => ({ ...prev, startDate: value }));
                  setPage(1);
                }}
                maxDate={dateRange.endDate || new Date()}
                disabledDate={(date) => date > new Date()}
                style={{ minWidth: '150px' }}
              />
              <span className='text-gray-400'>~</span>
              <DatePicker
                type='date'
                placeholder={t('结束日期')}
                value={dateRange.endDate}
                onChange={(value) => {
                  setDateRange((prev) => ({ ...prev, endDate: value }));
                  setPage(1);
                }}
                minDate={dateRange.startDate}
                maxDate={new Date()}
                style={{ minWidth: '150px' }}
              />
              <Select
                placeholder={t('全部状态')}
                value={statusFilter}
                onChange={handleStatusChange}
                style={{ width: 120 }}
              >
                <Select.Option value=''>{t('全部状态')}</Select.Option>
                <Select.Option value='pending'>{t('待处理')}</Select.Option>
                <Select.Option value='success'>{t('成功')}</Select.Option>
                <Select.Option value='failed'>{t('失败')}</Select.Option>
                <Select.Option value='expired'>{t('已过期')}</Select.Option>
                <Select.Option value='cancelled'>{t('已取消')}</Select.Option>
              </Select>
            </div>
          </div>

          {/* 搜索和导出 */}
          <div className='flex flex-wrap items-center gap-2 mb-3'>
            <Input
              prefix={<IconSearch />}
              placeholder={t('订单号或用户名')}
              value={keyword}
              onChange={handleKeywordChange}
              showClear
              onPressEnter={handleSearch}
              style={{ flex: 1, minWidth: '200px' }}
            />
            <Button
              type='primary'
              theme='solid'
              onClick={handleSearch}
            >
              {t('查询')}
            </Button>
            <Button
              type='primary'
              theme='solid'
              onClick={handleExport}
              loading={exportLoading}
              icon={<Download size={16} />}
            >
              {t('导出')}
            </Button>
          </div>
        </>
      }
      statsArea={statsArea}
      paginationArea={
        <div className='flex w-full pt-4 border-t justify-between items-center' style={{ borderColor: 'var(--semi-color-border)' }}>
          {createCardProPagination({
            currentPage: page,
            pageSize: pageSize,
            total: total,
            onPageChange: handlePageChange,
            onPageSizeChange: handlePageSizeChange,
            isMobile: isMobile,
            t: t,
          })}
        </div>
      }
      t={t}
    >
      <Table
        columns={columns}
        dataSource={topups}
        loading={loading}
        rowKey='id'
        pagination={false}
        size='small'
        empty={
          <Empty
            image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
            darkModeImage={
              <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
            }
            description={t('暂无充值记录')}
            style={{ padding: 30 }}
          />
        }
      />
    </CardPro>
  );
}
