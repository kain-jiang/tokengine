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
import { API, showError } from '../../helpers';
import { StatusContext } from '../../context/Status';
import CardPro from '../../components/common/ui/CardPro';
import { formatMoney, formatNumber, formatTimestamp, getStatusTag, getTypeTag } from './utils';
import { createCardProPagination } from '../../helpers/utils';
import { useIsMobile } from '../../hooks/common/useIsMobile';

// 订单类型映射
const orderTypeMap = {
  topup: { text: '充值', color: 'blue' },
  subscription: { text: '订阅', color: 'purple' },
};

// 支付方式映射
const paymentMethodMap = {
  alipay: { text: '支付宝', color: 'blue' },
  wxpay: { text: '微信支付', color: 'green' },
  stripe: { text: 'Stripe', color: 'purple' },
  wallet: { text: '钱包', color: 'orange' },
};

// 订单状态映射
const orderStatusMap = {
  pending: { text: '待处理', color: 'orange' },
  success: { text: '成功', color: 'green' },
  failed: { text: '失败', color: 'red' },
  cancelled: { text: '已取消', color: 'gray' },
};

export default function FinanceOrders() {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const isMobile = useIsMobile();
  const isAdmin = statusState?.user?.is_admin === true;

  // 日期范围
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
        p: ordersPage,
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

  // 状态选项
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

  // 搜索区域
  const searchArea = (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      {/* 日期范围 */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          padding: '0 12px',
          height: 32,
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
            fontSize: 12,
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
            fontSize: 12,
            flex: 1,
            backgroundColor: 'transparent',
          }}
          placeholder={t('结束日期')}
        />
      </div>

      {/* 状态筛选 */}
      <select
        value={orderStatus}
        onChange={(e) => setOrderStatus(e.target.value)}
        style={{
          height: 32,
          padding: '0 12px',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          fontSize: 12,
          backgroundColor: '#fff',
          minWidth: 120,
          outline: 'none',
        }}
      >
        {statusOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* 类型筛选 */}
      <select
        value={orderType}
        onChange={(e) => setOrderType(e.target.value)}
        style={{
          height: 32,
          padding: '0 12px',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          fontSize: 12,
          backgroundColor: '#fff',
          minWidth: 120,
          outline: 'none',
        }}
      >
        {typeOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* 关键词搜索 */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          height: 32,
          minWidth: 200,
          backgroundColor: '#fff',
        }}
      >
        <input
          value={orderKeyword}
          onChange={(e) => setOrderKeyword(e.target.value)}
          placeholder={t('搜索订单号/用户名')}
          style={{
            border: 'none',
            outline: 'none',
            fontSize: 12,
            padding: '0 12px',
            flex: 1,
            backgroundColor: 'transparent',
          }}
        />
        {orderKeyword && (
          <button
            onClick={() => setOrderKeyword('')}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 14,
              color: '#999',
              padding: '0 8px',
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* 查询按钮 */}
      <button
        onClick={fetchOrders}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 32,
          padding: '0 16px',
          backgroundColor: '#1677ff',
          color: '#fff',
          border: '1px solid #1677ff',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        {t('查询')}
      </button>
    </div>
  );

  // 表格列定义
  const columns = [
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
      render: (type) => getTypeTag(type, orderTypeMap, t),
    },
    {
      title: t('支付方式'),
      dataIndex: 'payment_method',
      key: 'payment_method',
      width: 120,
      render: (method) => getTypeTag(method, paymentMethodMap, t),
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
        return formatNumber(val);
      },
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => getStatusTag(status, orderStatusMap, t),
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

  // 表格
  const tableContent = (
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
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: '12px 16px',
                  textAlign: col.dataIndex === 'amount' || col.dataIndex === 'quota' ? 'right' : 'left',
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
          {orders.map((order) => (
            <tr
              key={order.id}
              style={{ borderBottom: '1px solid #f0f0f0', transition: 'background-color 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {columns.map((col) => (
                <td
                  key={`${order.id}-${col.key}`}
                  style={{
                    padding: '12px 16px',
                    textAlign: col.dataIndex === 'amount' || col.dataIndex === 'quota' ? 'right' : 'left',
                    color: 'rgba(0, 0, 0, 0.65)',
                  }}
                >
                  {col.render
                    ? col.render(order[col.dataIndex], order)
                    : order[col.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
          {orders.length === 0 && !ordersLoading && (
            <tr>
              <td
                colSpan={columns.length}
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
    currentPage: ordersPage,
    pageSize: ordersPageSize,
    total: ordersTotal,
    onPageChange: setOrdersPage,
    onPageSizeChange: (size) => {
      setOrdersPageSize(size);
      setOrdersPage(1);
    },
    isMobile: isMobile,
    t: t,
  });

  return (
    <CardPro
      type='type2'
      searchArea={searchArea}
      paginationArea={paginationArea}
      t={t}
    >
      {ordersLoading ? (
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
        tableContent
      )}
    </CardPro>
  );
}
