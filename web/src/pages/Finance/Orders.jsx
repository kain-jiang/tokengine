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
import { API, showError, showSuccess } from '../../helpers';
import { StatusContext } from '../../context/Status';
import {
  NativeRow,
  NativeCol,
  NativeCard,
  NativeSpace,
  NativeButton,
  NativeTag,
  NativeInput,
  NativeSelect,
  NativeDatePicker,
  NativeTable,
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

// 格式化时间
const formatTimestamp = (ts) => {
  if (!ts) return '-';
  return new Date(ts * 1000).toLocaleString('zh-CN');
};

export default function FinanceOrders() {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const isAdmin = statusState?.user?.is_admin === true;

  // 日期范围
  const [dateRange, setDateRange] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 数据状态
  const [orders, setOrders] = useState([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // 分页
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(10);

  // 筛选条件
  const [orderStatus, setOrderStatus] = useState('');
  const [orderType, setOrderType] = useState('');
  const [orderKeyword, setOrderKeyword] = useState('');

  // 获取订单列表
  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const params = {
        start_date: startDate,
        end_date: endDate,
        status: orderStatus,
        order_type: orderType,
        keyword: orderKeyword,
        p: ordersPage,           // 后端使用 'p' 作为页码参数
        page_size: ordersPageSize,
      };
      console.log('[Orders] 请求参数:', params);
      const res = await API.get('/api/finance/orders', { params });
      console.log('[Orders] 响应数据:', res.data);
      if (res.data?.success) {
        const items = res.data?.data?.items || [];
        const total = res.data?.data?.total || 0;
        console.log('[Orders] 解析结果 - items:', items.length, 'total:', total);
        setOrders(items);
        setOrdersTotal(total);
      }
    } catch (error) {
      console.error('获取订单列表失败:', error);
      showError(t('获取订单列表失败'));
    } finally {
      setOrdersLoading(false);
    }
  };

  // 加载数据
  useEffect(() => {
    fetchOrders();
  }, [
    startDate,
    endDate,
    ordersPage,
    ordersPageSize,
    orderStatus,
    orderType,
    orderKeyword,
  ]);

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

  // 订单状态选项
  const statusOptions = [
    { value: '', label: t('全部') },
    { value: 'pending', label: t('待处理') },
    { value: 'success', label: t('成功') },
    { value: 'failed', label: t('失败') },
    { value: 'cancelled', label: t('已取消') },
  ];

  // 订单类型选项
  const typeOptions = [
    { value: '', label: t('全部') },
    { value: 'topup', label: t('充值') },
    { value: 'subscription', label: t('订阅') },
  ];

  // 订单表格列
  const orderColumns = [
    {
      title: t('订单号'),
      dataIndex: 'order_id',
      key: 'order_id',
      width: 200,
    },
    {
      title: t('用户'),
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: t('类型'),
      dataIndex: 'order_type',
      key: 'order_type',
      width: 100,
      render: (type) => {
        const config = {
          topup: { text: t('充值'), color: 'blue' },
          subscription: { text: t('订阅'), color: 'purple' },
        };
        const item = config[type] || { text: type, color: 'gray' };
        return <NativeTag color={item.color}>{item.text}</NativeTag>;
      },
    },
    {
      title: t('支付方式'),
      dataIndex: 'payment_method',
      key: 'payment_method',
      width: 120,
      render: (method) => {
        const config = {
          alipay: { text: '支付宝', color: 'blue' },
          wxpay: { text: '微信支付', color: 'green' },
          stripe: { text: 'Stripe', color: 'purple' },
          wallet: { text: '钱包', color: 'orange' },
        };
        const item = config[method] || { text: method, color: 'gray' };
        return <NativeTag color={item.color}>{item.text}</NativeTag>;
      },
    },
    {
      title: t('金额'),
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (val) => formatMoney(val),
    },
    {
      title: t('额度'),
      dataIndex: 'quota',
      key: 'quota',
      width: 150,
      render: (val) => {
        if (val == null) return '-';
        return new Intl.NumberFormat('zh-CN').format(val);
      },
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const config = {
          pending: { text: t('待处理'), color: 'orange' },
          success: { text: t('成功'), color: 'green' },
          failed: { text: t('失败'), color: 'red' },
          cancelled: { text: t('已取消'), color: 'gray' },
        };
        const item = config[status] || { text: status, color: 'gray' };
        return <NativeTag color={item.color}>{item.text}</NativeTag>;
      },
    },
    {
      title: t('创建时间'),
      dataIndex: 'create_time',
      key: 'create_time',
      width: 180,
      render: (ts) => formatTimestamp(ts),
    },
    {
      title: t('完成时间'),
      dataIndex: 'complete_time',
      key: 'complete_time',
      width: 180,
      render: (ts) => formatTimestamp(ts),
    },
  ];

  return (
    <div>
      {/* 筛选栏 */}
      <NativeCard
        bodyStyle={{ padding: '16px 20px' }}
        style={{ borderRadius: 12, marginBottom: 16 }}
      >
        <NativeSpace wrap size={12}>
          <NativeDatePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            style={{ width: 280 }}
          />
          <NativeSelect
            value={orderStatus}
            onChange={setOrderStatus}
            options={statusOptions}
            style={{ width: 120 }}
            clearable
          />
          <NativeSelect
            value={orderType}
            onChange={setOrderType}
            options={typeOptions}
            style={{ width: 120 }}
            clearable
          />
          <NativeInput
            value={orderKeyword}
            onChange={setOrderKeyword}
            placeholder={t('搜索订单号/用户名')}
            style={{ width: 200 }}
            clearable
          />
          <NativeButton 
            theme='solid' 
            type='primary'
            onClick={fetchOrders}
          >
            {t('查询')}
          </NativeButton>
        </NativeSpace>
      </NativeCard>

      {/* 订单表格 */}
      <NativeCard
        bodyStyle={{ padding: '0 20px 20px' }}
        style={{ borderRadius: 12 }}
      >
        <NativeTable
          columns={orderColumns}
          dataSource={orders}
          loading={ordersLoading}
          rowKey='id'
          pagination={{
            current: ordersPage,
            pageSize: ordersPageSize,
            total: ordersTotal,
            onChange: (page) => setOrdersPage(page),
            onPageSizeChange: (size) => {
              setOrdersPageSize(size);
              setOrdersPage(1);
            },
            showSizeChanger: true,
            pageSizeActions: [10, 20, 50],
          }}
        />
      </NativeCard>
    </div>
  );
}
