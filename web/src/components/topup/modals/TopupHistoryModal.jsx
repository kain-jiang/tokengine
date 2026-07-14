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
import {
  Modal,
  Table,
  Badge,
  Typography,
  Toast,
  Empty,
  Button,
  Input,
  Tag,
  Select,
  DatePicker,
  Popconfirm,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { Coins, Download } from 'lucide-react';
import { IconSearch } from '@douyinfe/semi-icons';
import { API, timestamp2string } from '../../../helpers';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
const { Text } = Typography;

// 状态映射配置
const STATUS_CONFIG = {
  success: { type: 'success', key: '成功' },
  pending: { type: 'warning', key: '待支付' },
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

const TopupHistoryModal = ({ visible, onCancel, t }) => {
  const [loading, setLoading] = useState(false);
  const [topups, setTopups] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: null,
    endDate: null,
  });
  const isMobile = useIsMobile();

  // 初始化默认查询最近1个月
  useEffect(() => {
    if (visible && !dateRange.startDate && !dateRange.endDate) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      setDateRange({ startDate, endDate });
    }
  }, [visible]);

  // 计算半年前的日期（最大导出范围）
  const getMaxStartDate = () => {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    return sixMonthsAgo;
  };

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
      const endpoint = `/api/user/topup/self?${qs}`;
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
    // 验证日期范围
    if (dateRange.startDate && dateRange.endDate) {
      const diffDays = Math.floor((dateRange.endDate - dateRange.startDate) / (1000 * 60 * 60 * 24));
      if (diffDays > 180) {
        Toast.error({ content: t('导出时间范围不能超过半年（180天）') });
        return;
      }
    }

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
      const endpoint = qs ? `/api/user/topup/self/export?${qs}` : '/api/user/topup/self/export';

      const res = await API.get(endpoint, {
        responseType: 'blob',
      });

      // 检查返回的 blob 是否是 JSON 错误响应
      const contentType = res.headers['content-type'];
      if (contentType && contentType.includes('application/json')) {
        // 将 blob 转换为文本并解析 JSON
        const text = await res.data.text();
        const json = JSON.parse(text);
        Toast.error({ content: json.message || t('导出失败') });
        return;
      }

      // 创建下载链接
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `topup_history_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      Toast.success({ content: t('导出成功') });
    } catch (error) {
      Toast.error({ content: error.response?.data?.message || t('导出失败') });
    } finally {
      setExportLoading(false);
    }
  };

  // 取消待支付订单
  const handleCancelTopup = async (record) => {
    try {
      const res = await API.post(`/user/topup/helipay/cancel?trade_no=${record.trade_no}`);
      if (res.data.success) {
        Toast.success({ content: t('订单已取消') });
        loadTopups(page, pageSize);
      } else {
        Toast.error({ content: res.data.data || t('取消失败') });
      }
    } catch (error) {
      Toast.error({ content: t('取消失败') });
    }
  };

  // 清除日期筛选
  const clearDateFilter = () => {
    setDateRange({ startDate: null, endDate: null });
    setPage(1);
  };

  // 查询按钮点击处理
  const handleSearch = () => {
    setPage(1);
  };

  useEffect(() => {
    if (visible) {
      loadTopups(page, pageSize);
    }
  }, [visible, page, pageSize, keyword, statusFilter, dateRange]);

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
    return <Text>{displayName ? t(displayName) : pm || '-'}</Text>;
  };

  const isSubscriptionTopup = (record) => {
    const tradeNo = (record?.trade_no || '').toLowerCase();
    return Number(record?.amount || 0) === 0 && tradeNo.startsWith('sub');
  };

  const columns = useMemo(() => [
    {
      title: t('订单号'),
      dataIndex: 'trade_no',
      key: 'trade_no',
      render: (text) => <Text copyable>{text}</Text>,
    },
    {
      title: t('支付方式'),
      dataIndex: 'payment_method',
      key: 'payment_method',
      render: renderPaymentMethod,
    },
    {
      title: t('充值额度'),
      dataIndex: 'amount',
      key: 'amount',
      render: (amount, record) => {
        if (isSubscriptionTopup(record)) {
          return (
            <Tag color='purple' shape='circle' size='small'>
              {t('订阅套餐')}
            </Tag>
          );
        }
        return (
          <span className='flex items-center gap-1'>
            <Coins size={16} />
            <Text>{amount}</Text>
          </span>
        );
      },
    },
    {
      title: t('支付金额'),
      dataIndex: 'money',
      key: 'money',
      render: (money) => <Text type='danger'>¥{money.toFixed(2)}</Text>,
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      render: renderStatusBadge,
    },
    {
      title: t('创建时间'),
      dataIndex: 'create_time',
      key: 'create_time',
      render: (time) => timestamp2string(time),
    },
    {
      title: t('操作'),
      key: 'action',
      width: 100,
      render: (_, record) => {
        // 仅 pending 状态显示取消按钮
        if (record.status === 'pending') {
          return (
            <Popconfirm
              content={t('确定要取消该订单吗？取消后无法恢复。')}
              onConfirm={() => handleCancelTopup(record)}
              okText={t('确认')}
              cancelText={t('取消')}
              position='top'
            >
              <Button size='small' theme='solid' type='danger'>
                {t('取消')}
              </Button>
            </Popconfirm>
          );
        }
        return null;
      },
    },
  ], [t]);

  return (
    <Modal
      title={t('充值账单')}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      size={isMobile ? 'full-width' : 'large'}
      closeOnEsc={true}
      maskClosable={false}
    >
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
            disabledDate={(date) => date > new Date() || date < getMaxStartDate()}
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
            <Select.Option value='pending'>{t('待支付')}</Select.Option>
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
          placeholder={t('订单号')}
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
      <Table
        columns={columns}
        dataSource={topups}
        loading={loading}
        rowKey='id'
        pagination={{
          currentPage: page,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          pageSizeOpts: [10, 20, 50, 100],
          onPageChange: handlePageChange,
          onPageSizeChange: handlePageSizeChange,
        }}
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
    </Modal>
  );
};

export default TopupHistoryModal;
