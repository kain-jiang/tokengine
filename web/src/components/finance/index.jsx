/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by theFree Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useState, useEffect, useMemo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Layout,
  Card,
  Row,
  Col,
  Table,
  Tag,
  Space,
  DatePicker,
  Input,
  Select,
  Button,
  Tabs,
  Spin,
  Descriptions,
  Modal,
  Form,
  InputNumber,
} from '@douyinfe/semi-ui';
import {
  IconMoneyExchangeStroked,
  IconCoinMoneyStroked,
  IconHistogram,
  IconFile,
  IconCheckCircleStroked,
  IconClockStroked,
  IconArrowUp,
  IconShoppingBagStroked,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../helpers';
import { StatusContext } from '../../context/Status';

const { Header, Content, Sider } = Layout;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

// 格式化金额
const formatMoney = (value) => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
};

// 格式化时间
const formatTimestamp = (ts) => {
  if (!ts) return '-';
  return new Date(ts * 1000).toLocaleString('zh-CN');
};

export default function Finance() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [statusState] = useContext(StatusContext);
  const isAdmin = statusState?.user?.is_admin === true;

  // 当前激活的tab
  const [activeTab, setActiveTab] = useState('dashboard');

  // 日期范围
  const [dateRange, setDateRange] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 数据状态
  const [dashboardData, setDashboardData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [invoicesTotal, setInvoicesTotal] = useState(0);
  const [revenueReports, setRevenueReports] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);

  // 加载状态
  const [loading, setLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // 分页
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(10);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [invoicesPageSize, setInvoicesPageSize] = useState(10);

  // 筛选条件
  const [orderStatus, setOrderStatus] = useState('');
  const [orderType, setOrderType] = useState('');
  const [orderKeyword, setOrderKeyword] = useState('');

  const [invoiceStatus, setInvoiceStatus] = useState('');
  const [invoiceKeyword, setInvoiceKeyword] = useState('');

  // 发票申请弹窗
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [invoiceForm] = Form.useForm();

  // 获取路由参数
  const tabFromRoute = useMemo(() => {
    const path = location.pathname.split('/').pop();
    if (['dashboard', 'orders', 'revenue', 'invoices', 'supplier'].includes(path)) {
      return path;
    }
    return 'dashboard';
  }, [location.pathname]);

  useEffect(() => {
    setActiveTab(tabFromRoute);
  }, [tabFromRoute]);

  // 获取财务概览数据
  const fetchDashboard = async () => {
    setDashboardLoading(true);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await API.get('/api/finance/dashboard', { params });
      if (res.data.success) {
        setDashboardData(res.data.data);
      }
    } catch (error) {
      console.error('获取财务概览失败:', error);
    } finally {
      setDashboardLoading(false);
    }
  };

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
      const res = await API.get('/api/finance/orders', { params });
      if (res.data.success) {
        setOrders(res.data.data.items || []);
        setOrdersTotal(res.data.data.total || 0);
      }
    } catch (error) {
      console.error('获取订单列表失败:', error);
    } finally {
      setOrdersLoading(false);
    }
  };

  // 获取营收趋势
  const fetchRevenueTrend = async () => {
    try {
      const days = 30;
      const res = await API.get('/api/finance/trend', {
        params: { days },
      });
      if (res.data.success) {
        setRevenueTrend(res.data.data || []);
      }
    } catch (error) {
      console.error('获取营收趋势失败:', error);
    }
  };

  // 获取发票列表
  const fetchInvoices = async () => {
    setInvoicesLoading(true);
    try {
      const params = {
        status: invoiceStatus,
        start_date: startDate,
        end_date: endDate,
        keyword: invoiceKeyword,
        p: invoicesPage,
        page_size: invoicesPageSize,
      };
      const res = await API.get('/api/finance/invoices', { params });
      if (res.data.success) {
        setInvoices(res.data.data.items || []);
        setInvoicesTotal(res.data.data.total || 0);
      }
    } catch (error) {
      console.error('获取发票列表失败:', error);
    } finally {
      setInvoicesLoading(false);
    }
  };

  // 获取营收报表
  const fetchRevenueReports = async () => {
    try {
      const params = {
        report_type: 'daily',
        start_date: startDate,
        end_date: endDate,
      };
      const res = await API.get('/api/finance/reports', { params });
      if (res.data.success) {
        setRevenueReports(res.data.data.items || []);
      }
    } catch (error) {
      console.error('获取营收报表失败:', error);
    }
  };

  // 加载数据
  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboard();
      fetchRevenueTrend();
    } else if (activeTab === 'orders') {
      fetchOrders();
    } else if (activeTab === 'revenue') {
      fetchRevenueReports();
    } else if (activeTab === 'invoices') {
      fetchInvoices();
    }
  }, [
    activeTab,
    startDate,
    endDate,
    ordersPage,
    ordersPageSize,
    invoicesPage,
    invoicesPageSize,
    orderStatus,
    orderType,
    orderKeyword,
    invoiceStatus,
    invoiceKeyword,
  ]);

  // 设置日期范围
  const handleDateRangeChange = (dates) => {
    if (dates && dates.length === 2) {
      setStartDate(dates[0].format('YYYY-MM-DD'));
      setEndDate(dates[1].format('YYYY-MM-DD'));
      setDateRange(dates);
    } else {
      setStartDate('');
      setEndDate('');
      setDateRange([]);
    }
  };

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
        const item = config[type] || { text: type, color: 'default' };
        return <Tag color={item.color}>{item.text}</Tag>;
      },
    },
    {
      title: t('支付方式'),
      dataIndex: 'payment_method',
      key: 'payment_method',
      width: 100,
      render: (method) => {
        const config = {
          alipay: { text: t('支付宝'), color: 'blue' },
          wxpay: { text: t('微信'), color: 'green' },
          stripe: { text: t('Stripe'), color: 'purple' },
          wallet: { text: t('钱包'), color: 'orange' },
        };
        const item = config[method] || { text: method, color: 'default' };
        return <Tag color={item.color}>{item.text}</Tag>;
      },
    },
    {
      title: t('金额'),
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (amount) => formatMoney(amount),
    },
    {
      title: t('额度'),
      dataIndex: 'quota',
      key: 'quota',
      width: 120,
      render: (quota) => `${(quota / 10000).toFixed(2)}万`,
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const config = {
          pending: { text: t('待处理'), color: 'amber' },
          success: { text: t('成功'), color: 'green' },
          failed: { text: t('失败'), color: 'red' },
          cancelled: { text: t('已取消'), color: 'gray' },
        };
        const item = config[status] || { text: status, color: 'default' };
        return <Tag color={item.color}>{item.text}</Tag>;
      },
    },
    {
      title: t('创建时间'),
      dataIndex: 'create_time',
      key: 'create_time',
      width: 180,
      render: (time) => formatTimestamp(time),
    },
  ];

  // 发票表格列
  const invoiceColumns = [
    {
      title: t('发票号'),
      dataIndex: 'invoice_no',
      key: 'invoice_no',
      width: 150,
    },
    {
      title: t('用户'),
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: t('类型'),
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type) => (
        <Tag color={type === 'electronic' ? 'blue' : 'purple'}>
          {type === 'electronic' ? t('电子发票') : t('纸质发票')}
        </Tag>
      ),
    },
    {
      title: t('抬头'),
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('金额'),
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (amount) => formatMoney(amount),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const config = {
          pending: { text: t('待审核'), color: 'amber' },
          approved: { text: t('已通过'), color: 'green' },
          rejected: { text: t('已拒绝'), color: 'red' },
          issued: { text: t('已开具'), color: 'blue' },
        };
        const item = config[status] || { text: status, color: 'default' };
        return <Tag color={item.color}>{item.text}</Tag>;
      },
    },
    {
      title: t('申请时间'),
      dataIndex: 'create_time',
      key: 'create_time',
      width: 180,
      render: (time) => formatTimestamp(time),
    },
  ];

  // 营收报表表格列
  const revenueReportColumns = [
    {
      title: t('周期'),
      dataIndex: 'period',
      key: 'period',
      width: 120,
    },
    {
      title: t('类型'),
      dataIndex: 'report_type',
      key: 'report_type',
      width: 100,
      render: (type) => {
        const config = {
          daily: t('日报'),
          monthly: t('月报'),
          yearly: t('年报'),
        };
        return config[type] || type;
      },
    },
    {
      title: t('总消耗'),
      dataIndex: 'total_revenue',
      key: 'total_revenue',
      width: 120,
      render: (val) => formatMoney(val),
    },
    {
      title: t('总充值'),
      dataIndex: 'total_topup',
      key: 'total_topup',
      width: 120,
      render: (val) => formatMoney(val),
    },
    {
      title: t('订阅收入'),
      dataIndex: 'total_subscription',
      key: 'total_subscription',
      width: 120,
      render: (val) => formatMoney(val),
    },
    {
      title: t('总消费'),
      dataIndex: 'total_consumption',
      key: 'total_consumption',
      width: 120,
      render: (val) => formatMoney(val),
    },
    {
      title: t('净营收'),
      dataIndex: 'net_revenue',
      key: 'net_revenue',
      width: 120,
      render: (val) => formatMoney(val),
    },
  ];

  // 申请发票
  const handleApplyInvoice = async () => {
    try {
      const values = await invoiceForm.validate();
      const res = await API.post('/api/finance/invoice', {
        ...values,
      });
      if (res.data.success) {
        showSuccess(t('发票申请已提交'));
        setInvoiceModalVisible(false);
        invoiceForm.reset();
        fetchInvoices();
      }
    } catch (error) {
      console.error('申请发票失败:', error);
    }
  };

  // 侧边栏菜单项
  const menuItems = [
    {
      itemKey: 'dashboard',
      text: t('财务概览'),
      to: '/finance',
      icon: <IconMoneyExchangeStroked />,
    },
    {
      itemKey: 'orders',
      text: t('订单管理'),
      to: '/finance/orders',
      icon: <IconShoppingBagStroked />,
    },
    {
      itemKey: 'revenue',
      text: t('营收分析'),
      to: '/finance/revenue',
      icon: <IconArrowUp />,
    },
    {
      itemKey: 'invoices',
      text: t('发票管理'),
      to: '/finance/invoices',
      icon: <IconFile />,
    },
    ...(isAdmin
      ? [
          {
            itemKey: 'supplier',
            text: t('供应商结算'),
            to: '/console/finance/supplier-settlement',
            icon: <IconMoneyExchangeStroked />,
          },
        ]
      : []),
  ];

  // 渲染概览页面
  const renderDashboard = () => {
    if (dashboardLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size='large' />
        </div>
      );
    }

    return (
      <div>
        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card
              bodyStyle={{ padding: '20px' }}
              style={{ borderRadius: 12 }}
            >
              <Descriptions
                data={[
                  {
                    label: t('总消耗'),
                    value: dashboardData
                      ? formatMoney(dashboardData.total_revenue)
                      : '-',
                  },
                ]}
                style={{ marginBottom: 12 }}
              />
              <IconMoneyExchangeStroked
                size='large'
                style={{ color: '#1890ff', float: 'right' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card
              bodyStyle={{ padding: '20px' }}
              style={{ borderRadius: 12 }}
            >
              <Descriptions
                data={[
                  {
                    label: t('总充值'),
                    value: dashboardData
                      ? formatMoney(dashboardData.total_topup)
                      : '-',
                  },
                ]}
                style={{ marginBottom: 12 }}
              />
              <IconCoinMoneyStroked
                size='large'
                style={{ color: '#52c41a', float: 'right' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card
              bodyStyle={{ padding: '20px' }}
              style={{ borderRadius: 12 }}
            >
              <Descriptions
                data={[
                  {
                    label: t('今日消耗'),
                    value: dashboardData
                      ? formatMoney(dashboardData.today_revenue)
                      : '-',
                  },
                ]}
                style={{ marginBottom: 12 }}
              />
              <IconArrowUp
                size='large'
                style={{ color: '#722ed1', float: 'right' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card
              bodyStyle={{ padding: '20px' }}
              style={{ borderRadius: 12 }}
            >
              <Descriptions
                data={[
                  {
                    label: t('待审核发票'),
                    value: dashboardData?.invoice_pending || 0,
                  },
                ]}
                style={{ marginBottom: 12 }}
              />
              <IconClockStroked
                size='large'
                style={{ color: '#fa8c16', float: 'right' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 营收趋势 */}
        <Card
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
                      {item.date.slice(5)}
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
        </Card>
      </div>
    );
  };

  // 渲染订单管理页面
  const renderOrders = () => (
    <div>
      {/* 筛选栏 */}
      <Card
        bodyStyle={{ padding: '16px 20px' }}
        style={{ borderRadius: 12, marginBottom: 16 }}
      >
        <Space wrap>
          <RangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            style={{ width: 280 }}
          />
          <Select
            value={orderStatus}
            onChange={setOrderStatus}
            placeholder={t('状态')}
            style={{ width: 120 }}
            clearable
          >
            <Select.Option value=''>{t('全部')}</Select.Option>
            <Select.Option value='pending'>{t('待处理')}</Select.Option>
            <Select.Option value='success'>{t('成功')}</Select.Option>
            <Select.Option value='failed'>{t('失败')}</Select.Option>
            <Select.Option value='cancelled'>{t('已取消')}</Select.Option>
          </Select>
          <Select
            value={orderType}
            onChange={setOrderType}
            placeholder={t('订单类型')}
            style={{ width: 120 }}
            clearable
          >
            <Select.Option value=''>{t('全部')}</Select.Option>
            <Select.Option value='topup'>{t('充值')}</Select.Option>
            <Select.Option value='subscription'>{t('订阅')}</Select.Option>
          </Select>
          <Input
            value={orderKeyword}
            onChange={setOrderKeyword}
            placeholder={t('搜索订单号/用户名')}
            style={{ width: 200 }}
            clearable
          />
          <Button theme='solid' onClick={fetchOrders}>
            {t('查询')}
          </Button>
        </Space>
      </Card>

      {/* 订单表格 */}
      <Card
        bodyStyle={{ padding: '0 20px 20px' }}
        style={{ borderRadius: 12 }}
      >
        <Table
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
            pageSizeOptions: ['10', '20', '50'],
          }}
        />
      </Card>
    </div>
  );

  // 渲染营收分析页面
  const renderRevenue = () => (
    <div>
      {/* 筛选栏 */}
      <Card
        bodyStyle={{ padding: '16px 20px' }}
        style={{ borderRadius: 12, marginBottom: 16 }}
      >
        <Space wrap>
          <RangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            style={{ width: 280 }}
          />
          <Select
            placeholder={t('报表类型')}
            style={{ width: 120 }}
            clearable
          >
            <Select.Option value='daily'>{t('日报')}</Select.Option>
            <Select.Option value='monthly'>{t('月报')}</Select.Option>
            <Select.Option value='yearly'>{t('年报')}</Select.Option>
          </Select>
          <Button theme='solid' onClick={fetchRevenueReports}>
            {t('查询')}
          </Button>
        </Space>
      </Card>

      {/* 营收报表表格 */}
      <Card
        bodyStyle={{ padding: '0 20px 20px' }}
        style={{ borderRadius: 12 }}
      >
        <Table
          columns={revenueReportColumns}
          dataSource={revenueReports}
          rowKey='id'
          pagination={false}
        />
      </Card>
    </div>
  );

  // 渲染发票管理页面
  const renderInvoices = () => (
    <div>
      {/* 筛选栏 */}
      <Card
        bodyStyle={{ padding: '16px 20px' }}
        style={{ borderRadius: 12, marginBottom: 16 }}
      >
        <Space wrap>
          <RangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            style={{ width: 280 }}
          />
          <Select
            value={invoiceStatus}
            onChange={setInvoiceStatus}
            placeholder={t('状态')}
            style={{ width: 120 }}
            clearable
          >
            <Select.Option value=''>{t('全部')}</Select.Option>
            <Select.Option value='pending'>{t('待审核')}</Select.Option>
            <Select.Option value='approved'>{t('已通过')}</Select.Option>
            <Select.Option value='rejected'>{t('已拒绝')}</Select.Option>
            <Select.Option value='issued'>{t('已开具')}</Select.Option>
          </Select>
          <Input
            value={invoiceKeyword}
            onChange={setInvoiceKeyword}
            placeholder={t('搜索发票号/用户名')}
            style={{ width: 200 }}
            clearable
          />
          <Button theme='solid' onClick={fetchInvoices}>
            {t('查询')}
          </Button>
          <Button
            theme='solid'
            type='primary'
            onClick={() => setInvoiceModalVisible(true)}
          >
            {t('申请发票')}
          </Button>
        </Space>
      </Card>

      {/* 发票表格 */}
      <Card
        bodyStyle={{ padding: '0 20px 20px' }}
        style={{ borderRadius: 12 }}
      >
        <Table
          columns={invoiceColumns}
          dataSource={invoices}
          loading={invoicesLoading}
          rowKey='id'
          pagination={{
            current: invoicesPage,
            pageSize: invoicesPageSize,
            total: invoicesTotal,
            onChange: (page) => setInvoicesPage(page),
            onPageSizeChange: (size) => {
              setInvoicesPageSize(size);
              setInvoicesPage(1);
            },
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
          }}
        />
      </Card>

      {/* 发票申请弹窗 */}
      <Modal
        title={t('申请发票')}
        visible={invoiceModalVisible}
        onOk={handleApplyInvoice}
        onCancel={() => {
          setInvoiceModalVisible(false);
          invoiceForm.reset();
        }}
        okText={t('提交')}
        cancelText={t('取消')}
        style={{ maxWidth: 600 }}
      >
        <Form form={invoiceForm} layout='vertical'>
          <Form.Select
            field='type'
            label={t('发票类型')}
            placeholder={t('请选择发票类型')}
            required
            validators={['required']}
          >
            <Select.Option value='electronic'>{t('电子发票')}</Select.Option>
            <Select.Option value='paper'>{t('纸质发票')}</Select.Option>
          </Form.Select>
          <Form.Input
            field='title'
            label={t('发票抬头')}
            placeholder={t('请输入发票抬头')}
            required
            validators={['required']}
          />
          <Form.Input
            field='tax_number'
            label={t('税号')}
            placeholder={t('请输入税号')}
          />
          <Form.Input
            field='contact_name'
            label={t('联系人')}
            placeholder={t('请输入联系人姓名')}
            required
            validators={['required']}
          />
          <Form.Input
            field='contact_phone'
            label={t('联系电话')}
            placeholder={t('请输入联系电话')}
            required
            validators={['required']}
          />
          <Form.Input
            field='address'
            label={t('地址')}
            placeholder={t('请输入公司地址')}
          />
          <Form.Input
            field='bank_name'
            label={t('开户行')}
            placeholder={t('请输入开户行名称')}
          />
          <Form.Input
            field='bank_account'
            label={t('银行账号')}
            placeholder={t('请输入银行账号')}
          />
          <Form.InputNumber
            field='amount'
            label={t('发票金额')}
            placeholder={t('请输入金额')}
            required
            validators={['required']}
            min={0}
            precision={2}
            style={{ width: '100%' }}
          />
          <Form.TextArea
            field='remark'
            label={t('备注')}
            placeholder={t('请输入备注信息')}
          />
        </Form>
      </Modal>
    </div>
  );

  // 渲染对账管理页面
  const renderReconciliation = () => (
    <div>
      <Card
        bodyStyle={{ padding: '40px' }}
        style={{ borderRadius: 12, textAlign: 'center' }}
      >
        <IconCheckCircleStroked
          size='xlarge'
          style={{ color: '#52c41a', marginBottom: 16 }}
        />
        <h3>{t('对账管理')}</h3>
        <p style={{ color: '#999' }}>{t('功能开发中，敬请期待')}</p>
      </Card>
    </div>
  );

  // 根据当前tab渲染对应内容
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      case 'orders':
        return renderOrders();
      case 'revenue':
        return renderRevenue();
      case 'invoices':
        return renderInvoices();
      default:
        return renderDashboard();
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Content>
        <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
          <h2 style={{ marginBottom: 24, fontSize: 24 }}>
            {t('财务运营')}
          </h2>
          {renderContent()}
        </div>
      </Content>
    </Layout>
  );
}
