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

import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
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

  // 图表切换状态
  const [trendMetric, setTrendMetric] = useState('amount'); // 'amount' | 'count'

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

  // 图表数据状态
  const [chartData, setChartData] = useState({
    trend: [],
    user_type_distribution: [],
  });
  const trendChartRef = useRef(null);
  const pieChartRef = useRef(null);
  const trendChartInstance = useRef(null);
  const pieChartInstance = useRef(null);

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

  // 获取图表数据 - 图表只显示"成功"状态的充值记录，且只受时间控件控制
  const fetchChartData = async () => {
    try {
      let qs = 'status=success';
      if (dateRange.startDate) {
        qs += `&start_time=${Math.floor(dateRange.startDate.getTime() / 1000)}`;
      }
      if (dateRange.endDate) {
        qs += `&end_time=${Math.floor(dateRange.endDate.getTime() / 1000)}`;
      }
      const endpoint = `/api/finance/orders/chart-data?${qs}`;
      console.log('[Orders] 请求图表数据:', endpoint);
      const res = await API.get(endpoint);
      console.log('[Orders] 图表数据响应:', res.data);
      if (res.data?.success) {
        const data = res.data?.data || { trend: [], user_type_distribution: [] };
        console.log('[Orders] 图表数据:', data);
        setChartData(data);
      } else {
        console.error('[Orders] 获取图表数据失败:', res.data?.message);
      }
    } catch (error) {
      console.error('[Orders] 获取图表数据异常:', error);
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
    fetchChartData();
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

  // 切换折线图指标
  const handleTrendMetricChange = (metric) => {
    setTrendMetric(metric);
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

  // 统计卡片组件 - Design System: 锐利圆角(4px), 深蓝调阴影, 白色背景
  const StatCard = ({ children, icon, color, title }) => (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 4,
        padding: '20px',
        flex: 1,
        minWidth: 180,
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: 'rgba(1, 1, 32, 0.1) 0px 4px 10px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: 'rgba(0, 0, 0, 0.4)', fontSize: 14, marginBottom: 8, fontFamily: 'PP Neue Montreal Mono, Georgia, sans-serif', textTransform: 'uppercase', letterSpacing: '0.055px' }}>{title}</div>
          <div style={{ fontSize: 22, fontWeight: 500, color, lineHeight: 1.25, letterSpacing: '-0.16px' }}>{children}</div>
        </div>
        {icon && (
          <div style={{ color: 'rgba(0, 0, 0, 0.4)' }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );

  // 渲染折线图
  useEffect(() => {
    if (!trendChartRef.current) return;
    
    if (!trendChartInstance.current) {
      trendChartInstance.current = echarts.init(trendChartRef.current);
    }
    
    const trend = chartData.trend || [];
    const dates = trend.map(item => item.date);
    const amounts = trend.map(item => item.amount);
    const counts = trend.map(item => item.count || 0);
    
    // 格式化日期为 MM-DD
    const formatDate = (dateStr) => {
      if (dateStr.includes('T')) {
        dateStr = dateStr.split('T')[0];
      }
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[1]}-${parts[2]}`;
      }
      return dateStr;
    };
    
    const isAmount = trendMetric === 'amount';
    
    const option = {
      title: {
        text: t('有效充值趋势'),
        left: 'center',
        top: 8,
        textStyle: {
          fontSize: 14,
          fontWeight: 400,
          color: 'rgba(0, 0, 0, 0.4)',
          fontFamily: 'PP Neue Montreal Mono, Georgia, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: 0.055,
        },
      },
      tooltip: {
        show: true,
        trigger: 'axis',
        formatter: function(params) {
          const data = params[0];
          const formattedDate = formatDate(data.name);
          if (isAmount) {
            return `${formattedDate}<br/>充值金额：¥${data.value.toFixed(2)}`;
          } else {
            const trendItem = trend[data.data];
            const count = trendItem ? trendItem.count : 0;
            return `${formattedDate}<br/>订单数：${count}`;
          }
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: 45,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          formatter: function(value) {
            let dateStr = value;
            if (dateStr.includes('T')) {
              dateStr = dateStr.split('T')[0];
            }
            const parts = dateStr.split('-');
            if (parts.length === 3) {
              return `${parts[1]}-${parts[2]}`;
            }
            return value;
          },
          rotate: dates.length > 15 ? 45 : 0,
          interval: 0,
        },
      },
      yAxis: {
        type: 'value',
        name: isAmount ? '充值金额' : '订单数',
        position: 'left',
        axisLabel: {
          formatter: isAmount ? '¥{value}' : '{value}',
        },
      },
      series: [
        {
          name: isAmount ? '充值金额' : '订单数',
          type: 'line',
          smooth: true,
          yAxisIndex: 0,
          data: isAmount ? amounts : counts,
          itemStyle: {
            color: '#1890ff',
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
              { offset: 1, color: 'rgba(24, 144, 255, 0.05)' },
            ]),
          },
        },
      ],
    };
    
    trendChartInstance.current.setOption(option);
    
    return () => {};
  }, [chartData, t, trendMetric]);

  // 渲染饼图
  useEffect(() => {
    if (!pieChartRef.current) return;
    
    if (!pieChartInstance.current) {
      pieChartInstance.current = echarts.init(pieChartRef.current);
    }
    
    const distribution = chartData.user_type_distribution || [];
    const pieData = distribution.map(item => ({
      name: item.label,
      value: item.value,
    }));
    
    // Design System: 锐利圆角(4px), 权重500而非bold
    const option = {
      tooltip: {
        show: true,
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'horizontal',
        bottom: '5%',
        data: pieData.map(item => item.name),
        textStyle: {
          fontSize: 14,
          fontWeight: 500,
          color: 'rgba(0, 0, 0, 0.4)',
          fontFamily: 'PP Neue Montreal Mono, Georgia, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: 0.055,
        },
      },
      series: [
        {
          name: '充值金额',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: false,
            },
          },
          labelLine: {
            show: false,
          },
          data: pieData,
          color: ['#E8A87C', '#f5c542', '#1890ff'],
        },
      ],
    };
    
    pieChartInstance.current.setOption(option);
  }, [chartData, t]);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      if (trendChartInstance.current) {
        trendChartInstance.current.resize();
      }
      if (pieChartInstance.current) {
        pieChartInstance.current.resize();
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 图表区域 - 3:1 布局（折线图占75%，饼图占25%）- Design System: 锐利圆角(4px), 深蓝调阴影
  const chartArea = (
    <div style={{ display: 'flex', gap: 16, marginBottom: 16, overflow: 'hidden' }}>
      <div
        style={{
          flex: 3,
          backgroundColor: '#ffffff',
          borderRadius: 4,
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: 'rgba(1, 1, 32, 0.1) 0px 4px 10px',
          padding: '16px',
          minHeight: 280,
          position: 'relative',
        }}
      >
        {/* 切换按钮 */}
        <div style={{ position: 'absolute', right: 16, top: 8, zIndex: 10, display: 'flex', gap: 2 }}>
          <Button
            size='small'
            theme={trendMetric === 'amount' ? 'solid' : 'light'}
            type='primary'
            onClick={() => handleTrendMetricChange('amount')}
            style={{ borderRadius: 4, fontSize: 12, padding: '4px 8px' }}
          >
            {t('充值金额')}
          </Button>
          <Button
            size='small'
            theme={trendMetric === 'count' ? 'solid' : 'light'}
            type='primary'
            onClick={() => handleTrendMetricChange('count')}
            style={{ borderRadius: 4, fontSize: 12, padding: '4px 8px' }}
          >
            {t('订单数')}
          </Button>
        </div>
        <div ref={trendChartRef} style={{ width: '100%', height: 240 }} />
      </div>
      <div
        style={{
          flex: 1,
          backgroundColor: '#ffffff',
          borderRadius: 4,
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: 'rgba(1, 1, 32, 0.1) 0px 4px 10px',
          padding: '16px',
          minHeight: 280,
        }}
      >
        <div ref={pieChartRef} style={{ width: '100%', height: 240 }} />
      </div>
    </div>
  );

  const columns = useMemo(() => {
    const baseColumns = [
      {
        title: t('用户'),
        dataIndex: 'username',
        key: 'username',
        width: 100,
        ellipsis: true,
        render: (username) => <Typography.Text>{username || '-'}</Typography.Text>,
      },
      {
        title: t('订单号'),
        dataIndex: 'trade_no',
        key: 'trade_no',
        width: 180,
        ellipsis: true,
        render: (text) => <Typography.Text copyable>{text}</Typography.Text>,
      },
      {
        title: t('支付方式'),
        dataIndex: 'payment_method',
        key: 'payment_method',
        width: 120,
        ellipsis: true,
        render: renderPaymentMethod,
      },
      {
        title: t('充值额度'),
        dataIndex: 'amount',
        key: 'amount',
        width: 100,
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
        width: 100,
        render: (money) => <Typography.Text type='danger'>¥{money.toFixed(2)}</Typography.Text>,
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        key: 'status',
        width: 90,
        render: renderStatusBadge,
      },
      {
        title: t('创建时间'),
        dataIndex: 'create_time',
        key: 'create_time',
        width: 160,
        render: (time) => timestamp2string(time),
      },
    ];

    // 管理员操作列（移除 fixed: 'right' 以避免右侧滚动条）
    if (userIsAdmin) {
      baseColumns.push({
        title: t('操作'),
        key: 'action',
        width: 80,
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

  // 全局视角 - 6个统计卡片
  const globalStats = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
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

  // 筛选栏
  const filterBar = (
    <div style={{ padding: 12, backgroundColor: 'rgba(0, 0, 0, 0.02)', borderRadius: 4, border: '1px solid rgba(0, 0, 0, 0.08)', marginBottom: 16 }}>
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
          style={{ minWidth: '150px', borderRadius: 4 }}
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
          style={{ minWidth: '150px', borderRadius: 4 }}
        />
        <Select
          placeholder={t('全部状态')}
          value={statusFilter}
          onChange={handleStatusChange}
          style={{ width: 120, borderRadius: 4 }}
        >
          <Select.Option value=''>{t('全部状态')}</Select.Option>
          <Select.Option value='pending'>{t('待处理')}</Select.Option>
          <Select.Option value='success'>{t('成功')}</Select.Option>
          <Select.Option value='failed'>{t('失败')}</Select.Option>
          <Select.Option value='expired'>{t('已过期')}</Select.Option>
          <Select.Option value='cancelled'>{t('已取消')}</Select.Option>
        </Select>
        <Input
          prefix={<IconSearch />}
          placeholder={t('订单号或用户名')}
          value={keyword}
          onChange={handleKeywordChange}
          showClear
          onPressEnter={handleSearch}
          style={{ flex: 1, minWidth: '200px', borderRadius: 4 }}
        />
        <Button
          type='primary'
          theme='solid'
          onClick={handleSearch}
          style={{ borderRadius: 4 }}
        >
          {t('查询')}
        </Button>
        <Button
          type='primary'
          theme='solid'
          onClick={handleExport}
          loading={exportLoading}
          icon={<Download size={16} />}
          style={{ borderRadius: 4 }}
        >
          {t('导出')}
        </Button>
      </div>
    </div>
  );

  // 表格区域 - 自然展开，无固定高度
  const tableArea = (
    <div style={{ backgroundColor: '#ffffff', borderRadius: 4, border: '1px solid rgba(0, 0, 0, 0.08)', boxShadow: 'rgba(1, 1, 32, 0.1) 0px 4px 10px', padding: '16px' }}>
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
      <div className='flex w-full pt-4 border-t justify-between items-center' style={{ borderColor: 'rgba(0, 0, 0, 0.08)', borderTopWidth: 1, marginTop: 16 }}>
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
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 第一块：全局视角 - 6个统计卡片 */}
      {globalStats}
      
      {/* 第二块：细节查询 - 筛选 + 图表 + 表格 */}
      {/* 筛选栏 */}
      {filterBar}
      {/* 图表区域 - 3:1 布局，自适应高度 */}
      {chartArea}
      {/* 表格区域 - 自然展开 */}
      {tableArea}
    </div>
  );
}
