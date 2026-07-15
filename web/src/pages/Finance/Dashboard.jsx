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

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as echarts from 'echarts';
import {
  DatePicker, Table, Typography, Button, Select, Input, Badge, Space, Spin, Empty,
} from '@douyinfe/semi-ui';
import {
  IconMoneyExchangeStroked, IconCoinMoneyStroked, IconTickCircle, IconClockStroked,
} from '@douyinfe/semi-icons';
import { IllustrationNoResult, IllustrationNoResultDark } from '@douyinfe/semi-illustrations';
import { API, timestamp2string, showError } from '../../helpers';
import { formatMoney } from './utils';
import { createCardProPagination } from '../../helpers/utils';
import { useIsMobile } from '../../hooks/common/useIsMobile';

// StatCard 组件
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

// 格式化日期为 MM-DD
const formatDateLabel = (dateStr) => {
  if (!dateStr) return '';
  if (dateStr.includes('T')) {
    dateStr = dateStr.split('T')[0];
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[1]}-${parts[2]}`;
  }
  return dateStr;
};

export default function FinanceDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // 日期范围
  const [dateRange, setDateRange] = useState({
    startDate: null,
    endDate: null,
  });
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);

  // 统计数据
  const [dashboardStats, setDashboardStats] = useState({
    total_users: 0,
    total_effective_topup: 0,
    success_order_count: 0,
    total_token_calls: 0,
    week_topup_amount: 0,
    week_token_calls: 0,
    week_revenue: 0,
    top_model_name: '',
    top_model_call_count: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);

  // 图表数据状态
  const [usersTrend, setUsersTrend] = useState([]);
  const [usersAuthDist, setUsersAuthDist] = useState({ unverified: 0, individual: 0, enterprise: 0, total: 0 });
  const [topupTrend, setTopupTrend] = useState([]);
  const [topupUserTypeDist, setTopupUserTypeDist] = useState({ unverified: 0, individual: 0, enterprise: 0 });
  const [consumptionTrend, setConsumptionTrend] = useState([]);
  const [paymentModeTokensDist, setPaymentModeTokensDist] = useState({ pay_as_you_go: 0, subscription: 0 });
  const [revenueByUser, setRevenueByUser] = useState({ items: [], total: 0 });
  const [revenueByUserPage, setRevenueByUserPage] = useState(1);
  const [revenueByUserPageSize, setRevenueByUserPageSize] = useState(10);
  const [paymentModeRevenueDist, setPaymentModeRevenueDist] = useState({ pay_as_you_go: 0, subscription: 0 });
  const [supplierTrend, setSupplierTrend] = useState([]);
  const [supplierDist, setSupplierDist] = useState({ items: [] });

  // 有效充值趋势指标切换
  const [trendMetric, setTrendMetric] = useState('amount'); // 'amount' | 'count'

  const [chartLoading, setChartLoading] = useState(false);

  // 图表实例引用
  const usersTrendChartRef = useRef(null);
  const authDistChartRef = useRef(null);
  const topupTrendChartRef = useRef(null);
  const topupDistChartRef = useRef(null);
  const consumptionTrendChartRef = useRef(null);
  const paymentModeTokensChartRef = useRef(null);
  const revenuePieChartRef = useRef(null);
  const supplierTrendChartRef = useRef(null);
  const supplierDistChartRef = useRef(null);

  const chartsInstance = useRef({
    usersTrend: null,
    authDist: null,
    topupTrend: null,
    topupDist: null,
    consumptionTrend: null,
    paymentModeTokens: null,
    revenuePie: null,
    supplierTrend: null,
    supplierDist: null,
  });

  // DOM 引用映射：将图表名称映射到对应的 DOM ref
  const chartDomMap = {
    usersTrend: usersTrendChartRef,
    authDist: authDistChartRef,
    topupTrend: topupTrendChartRef,
    topupDist: topupDistChartRef,
    consumptionTrend: consumptionTrendChartRef,
    paymentModeTokens: paymentModeTokensChartRef,
    revenuePie: revenuePieChartRef,
    supplierTrend: supplierTrendChartRef,
    supplierDist: supplierDistChartRef,
  };

  // 获取星期一开始的时间戳
  const getWeekStart = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return Math.floor(weekStart.getTime() / 1000);
  };

  // 获取统计数据
  const fetchDashboardStats = async () => {
    setStatsLoading(true);
    try {
      const res = await API.get('/api/finance/dashboard/stats', {
        params: { start_time: startTime, end_time: endTime },
      });
      if (res.data?.success) {
        setDashboardStats(res.data?.data || {});
      }
    } catch (error) {
      console.error('获取统计指标失败:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // 获取所有图表数据
  const fetchChartData = async () => {
    setChartLoading(true);
    try {
      const params = { start_time: startTime, end_time: endTime };

      // 并发请求所有数据
      const [
        usersTrendRes,
        usersAuthDistRes,
        topupTrendRes,
        topupUserTypeDistRes,
        consumptionTrendRes,
        paymentModeTokensDistRes,
        revenueByUserRes,
        paymentModeRevenueDistRes,
        supplierTrendRes,
        supplierDistRes,
      ] = await Promise.all([
        API.get('/api/finance/users/trend', { params }),
        API.get('/api/finance/users/auth-distribution', { params: {} }),
        API.get('/api/finance/topup/trend', { params }),
        API.get('/api/finance/topup/user-type-dist', { params }),
        API.get('/api/finance/consumption/trend', { params }),
        API.get('/api/finance/payment-mode-tokens-dist', { params }),
        API.get('/api/finance/revenue-by-user', { params: { ...params, p: revenueByUserPage, page_size: revenueByUserPageSize } }),
        API.get('/api/finance/payment-mode-revenue-dist', { params }),
        API.get('/api/finance/supplier/trend', { params }),
        API.get('/api/finance/supplier-dist', { params }),
      ]);

      if (usersTrendRes.data?.success) setUsersTrend(usersTrendRes.data?.data || []);
      if (usersAuthDistRes.data?.success) setUsersAuthDist(usersAuthDistRes.data?.data || {});
      if (topupTrendRes.data?.success) setTopupTrend(topupTrendRes.data?.data || []);
      if (topupUserTypeDistRes.data?.success) setTopupUserTypeDist(topupUserTypeDistRes.data?.data || {});
      if (consumptionTrendRes.data?.success) setConsumptionTrend(consumptionTrendRes.data?.data || []);
      if (paymentModeTokensDistRes.data?.success) setPaymentModeTokensDist(paymentModeTokensDistRes.data?.data || {});
      if (revenueByUserRes.data?.success) {
        setRevenueByUser({ items: revenueByUserRes.data?.data || [], total: revenueByUserRes.data?.total || 0 });
      }
      if (paymentModeRevenueDistRes.data?.success) setPaymentModeRevenueDist(paymentModeRevenueDistRes.data?.data || {});
      if (supplierTrendRes.data?.success) setSupplierTrend(supplierTrendRes.data?.data || []);
      if (supplierDistRes.data?.success) setSupplierDist(supplierDistRes.data?.data || { items: [] });
    } catch (error) {
      console.error('获取图表数据失败:', error);
      showError(t('获取图表数据失败'));
    } finally {
      setChartLoading(false);
    }
  };

  // 初始化默认日期范围：最近一个月
  useEffect(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    setDateRange({ startDate, endDate });
    setStartTime(Math.floor(startDate.getTime() / 1000));
    setEndTime(Math.floor(endDate.getTime() / 1000));
  }, []);

  // 日期范围变化时重新获取数据
  useEffect(() => {
    if (dateRange.startDate && dateRange.endDate) {
      setStartTime(Math.floor(dateRange.startDate.getTime() / 1000));
      setEndTime(Math.floor(dateRange.endDate.getTime() / 1000));
    }
  }, [dateRange]);

  // 时间范围变化时重新获取数据
  useEffect(() => {
    if (startTime > 0 && endTime > 0) {
      fetchDashboardStats();
      fetchChartData();
    }
  }, [startTime, endTime, revenueByUserPage, revenueByUserPageSize]);

  // ECharts 配色
  const lineColor = '#1890ff';
  const areaGradient = [
    { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
    { offset: 1, color: 'rgba(24, 144, 255, 0.05)' },
  ];
  const pieColors = ['#E8A87C', '#f5c542', '#1890ff', '#52c41a', '#fa8c16', '#722ed1'];

  // 渲染折线图通用配置
  // 参数: chartName=图表名称(用于存储实例), domElement=DOM元素, data=数据, title=标题, valueKey=值字段, unit=单位, valueLabel=Y轴标签文本
  const renderLineChart = (chartName, domElement, data, title, valueKey, unit = '', valueLabel = '') => {
    if (!domElement || !data?.length) return;
    
    if (!chartsInstance.current[chartName]) {
      chartsInstance.current[chartName] = echarts.init(domElement);
    }
    
    const dates = data.map(item => formatDateLabel(item.date));
    const values = data.map(item => item[valueKey] || 0);

    const option = {
      title: {
        text: title,
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
          return `${formatDateLabel(data.name)}<br/>${valueLabel || title}: ${unit}${data.value.toLocaleString()}`;
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
          rotate: dates.length > 15 ? 45 : 0,
          interval: 0,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: unit === '¥' ? '¥{value}' : '{value}',
        },
      },
      series: [{
        name: title,
        type: 'line',
        smooth: true,
        data: values,
        itemStyle: { color: lineColor },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, areaGradient),
        },
      }],
    };
    chartsInstance.current[chartName].setOption(option);
  };

  // 渲染饼图通用配置
  // 参数: chartName=图表名称(用于存储实例), domElement=DOM元素, data=数据, title=标题
  const renderPieChart = (chartName, domElement, data, title) => {
    if (!domElement || !data?.length) return;
    
    if (!chartsInstance.current[chartName]) {
      chartsInstance.current[chartName] = echarts.init(domElement);
    }
    
    const pieData = data.map(item => ({ name: item.name, value: item.value }));

    const option = {
      title: {
        text: title,
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
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'horizontal',
        bottom: '5%',
        data: pieData.map(item => item.name),
        textStyle: {
          fontSize: 12,
          color: 'rgba(0, 0, 0, 0.4)',
        },
      },
      series: [{
        name: title,
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '55%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: { label: { show: false } },
        labelLine: { show: false },
        data: pieData,
        color: pieColors,
      }],
    };
    chartsInstance.current[chartName].setOption(option);
  };

  // 渲染各图表
  useEffect(() => {
    renderLineChart('usersTrend', usersTrendChartRef.current, usersTrend, t('注册用户趋势'), 'count');
  }, [usersTrend, t]);

  useEffect(() => {
    const authData = [
      { name: t('未认证'), value: usersAuthDist.unverified || 0 },
      { name: t('个人用户'), value: usersAuthDist.individual || 0 },
      { name: t('企业用户'), value: usersAuthDist.enterprise || 0 },
    ].filter(item => item.value > 0);
    renderPieChart('authDist', authDistChartRef.current, authData, t('用户认证占比'));
  }, [usersAuthDist, t]);

  useEffect(() => {
    const isCount = trendMetric === 'count';
    renderLineChart('topupTrend', topupTrendChartRef.current, topupTrend, t('有效充值趋势'), isCount ? 'count' : 'amount', isCount ? '' : '¥', isCount ? t('订单数') : t('充值金额'));
  }, [topupTrend, t, trendMetric]);

  useEffect(() => {
    const distData = [
      { name: t('未认证用户'), value: topupUserTypeDist.unverified || 0 },
      { name: t('个人用户'), value: topupUserTypeDist.individual || 0 },
      { name: t('企业用户'), value: topupUserTypeDist.enterprise || 0 },
    ].filter(item => item.value > 0);
    renderPieChart('topupDist', topupDistChartRef.current, distData, t('三类用户充值分布'));
  }, [topupUserTypeDist, t]);

  useEffect(() => {
    renderLineChart('consumptionTrend', consumptionTrendChartRef.current, consumptionTrend, t('消费趋势'), 'cost', '¥');
  }, [consumptionTrend, t]);

  useEffect(() => {
    const tokensData = [
      { name: t('按量付费'), value: paymentModeTokensDist.pay_as_you_go || 0 },
      { name: t('订阅'), value: paymentModeTokensDist.subscription || 0 },
    ].filter(item => item.value > 0);
    renderPieChart('paymentModeTokens', paymentModeTokensChartRef.current, tokensData, t('付费方式tokens分布'));
  }, [paymentModeTokensDist, t]);

  useEffect(() => {
    const revenueData = [
      { name: t('按量付费'), value: paymentModeRevenueDist.pay_as_you_go || 0 },
      { name: t('订阅'), value: paymentModeRevenueDist.subscription || 0 },
    ].filter(item => item.value > 0);
    renderPieChart('revenuePie', revenuePieChartRef.current, revenueData, t('付费方式收入占比'));
  }, [paymentModeRevenueDist, t]);

  // 渠道消费趋势：需要按日期聚合（同一日期可能有多个渠道）
  useEffect(() => {
    if (!supplierTrend?.length) {
      if (chartsInstance.current.supplierTrend) {
        chartsInstance.current.supplierTrend.setOption({ series: [{ data: [] }] });
      }
      return;
    }
    // 按日期聚合总消费
    const dateMap = {};
    supplierTrend.forEach(item => {
      if (!dateMap[item.date]) {
        dateMap[item.date] = { date: item.date, cost: 0, tokens: 0, request_count: 0 };
      }
      dateMap[item.date].cost += item.cost || 0;
      dateMap[item.date].tokens += item.tokens || 0;
      dateMap[item.date].request_count += item.request_count || 0;
    });
    const aggregatedTrend = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
    renderLineChart('supplierTrend', supplierTrendChartRef.current, aggregatedTrend, t('渠道消费趋势'), 'cost', '¥');
  }, [supplierTrend, t]);

  useEffect(() => {
    const distData = (supplierDist.items || []).map(item => ({
      name: item.supplier || '未知',
      value: item.cost || 0,
    })).filter(item => item.value > 0);
    renderPieChart('supplierDist', supplierDistChartRef.current, distData, t('渠道消费占比'));
  }, [supplierDist, t]);

  // 窗口大小变化时调整图表
  useEffect(() => {
    const handleResize = () => {
      Object.values(chartsInstance.current).forEach(chart => {
        if (chart?.resize) chart.resize();
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 清理图表实例
  useEffect(() => {
    return () => {
      Object.values(chartsInstance.current).forEach(chart => {
        if (chart?.dispose) chart.dispose();
      });
    };
  }, []);

  // 表格列定义
  const revenueColumns = useMemo(() => [
    {
      title: t('用户ID'),
      dataIndex: 'user_id',
      key: 'user_id',
      width: 80,
    },
    {
      title: t('用户名'),
      dataIndex: 'username',
      key: 'username',
      width: 150,
      render: (text) => <Typography.Text>{text || '-'}</Typography.Text>,
    },
    {
      title: t('按量付费'),
      dataIndex: 'pay_as_you_go',
      key: 'pay_as_you_go',
      width: 120,
      render: (val) => <Typography.Text type='primary'>{formatMoney(val)}</Typography.Text>,
    },
    {
      title: t('订阅'),
      dataIndex: 'subscription',
      key: 'subscription',
      width: 120,
      render: (val) => <Typography.Text type='success'>{formatMoney(val)}</Typography.Text>,
    },
    {
      title: t('总计'),
      dataIndex: 'total',
      key: 'total',
      width: 120,
      render: (val) => <Typography.Text type='danger'>{formatMoney(val)}</Typography.Text>,
    },
  ], [t]);

  // 顶部统计卡片（9个指标）
  const statsCards = (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <StatCard
        title={t('用户数量')}
        color="#1890ff"
        icon={<IconCoinMoneyStroked style={{ fontSize: 24 }} />}
      >
        {statsLoading ? <Spin size="small" /> : dashboardStats.total_users?.toLocaleString() || 0}
      </StatCard>
      <StatCard
        title={t('有效充值金额')}
        color="#52c41a"
        icon={<IconMoneyExchangeStroked style={{ fontSize: 24 }} />}
      >
        {statsLoading ? <Spin size="small" /> : formatMoney(dashboardStats.total_effective_topup)}
      </StatCard>
      <StatCard
        title={t('成功订单数')}
        color="#1890ff"
        icon={<IconTickCircle style={{ fontSize: 24 }} />}
      >
        {statsLoading ? <Spin size="small" /> : (dashboardStats.success_order_count?.toLocaleString() || 0)}
      </StatCard>
      <StatCard
        title={t('模型请求次数')}
        color="#722ed1"
        icon={<IconClockStroked style={{ fontSize: 24 }} />}
      >
        {statsLoading ? <Spin size="small" /> : (dashboardStats.total_token_calls?.toLocaleString() || 0)}
      </StatCard>
      <StatCard
        title={t('本周充值金额')}
        color="#52c41a"
        icon={<IconMoneyExchangeStroked style={{ fontSize: 24 }} />}
      >
        {statsLoading ? <Spin size="small" /> : formatMoney(dashboardStats.week_topup_amount)}
      </StatCard>
      <StatCard
        title={t('本周模型请求次数')}
        color="#722ed1"
        icon={<IconClockStroked style={{ fontSize: 24 }} />}
      >
        {statsLoading ? <Spin size="small" /> : (dashboardStats.week_token_calls?.toLocaleString() || 0)}
      </StatCard>
      <StatCard
        title={t('本周营业收入')}
        color="#1890ff"
        icon={<IconCoinMoneyStroked style={{ fontSize: 24 }} />}
      >
        {statsLoading ? <Spin size="small" /> : formatMoney(dashboardStats.week_revenue)}
      </StatCard>
      <StatCard
        title={t('本周调用最多模型')}
        color="#fa8c16"
      >
        <div style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {statsLoading ? <Spin size="small" /> : (dashboardStats.top_model_name || '-')}
        </div>
      </StatCard>
    </div>
  );

  // 筛选栏
  const filterBar = (
    <div style={{
      padding: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.02)',
      borderRadius: 4,
      border: '1px solid rgba(0, 0, 0, 0.08)',
      marginBottom: 16,
    }}>
      <div className='flex flex-wrap items-center gap-2'>
        <DatePicker
          type='date'
          placeholder={t('开始日期')}
          value={dateRange.startDate}
          onChange={(value) => {
            setDateRange((prev) => ({ ...prev, startDate: value }));
            setRevenueByUserPage(1);
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
            setRevenueByUserPage(1);
          }}
          minDate={dateRange.startDate}
          maxDate={new Date()}
          style={{ minWidth: '150px', borderRadius: 4 }}
        />
        <Button
          type='primary'
          theme='solid'
          onClick={() => { fetchDashboardStats(); fetchChartData(); }}
          loading={statsLoading || chartLoading}
          style={{ borderRadius: 4 }}
        >
          {t('查询')}
        </Button>
      </div>
    </div>
  );

  // 渲染图表行（3:1 双列布局）
  const renderChartRow = (leftTitle, leftData, leftValueKey, leftUnit, rightTitle, rightData, rightIsPie = true) => (
    <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
      <div style={{
        flex: 3,
        backgroundColor: '#ffffff',
        borderRadius: 4,
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: 'rgba(1, 1, 32, 0.1) 0px 4px 10px',
        padding: '16px',
        minHeight: 280,
      }}>
        {leftTitle === '有效充值趋势' ? (
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', right: 16, top: 8, zIndex: 10, display: 'flex', gap: 2 }}>
              <Button
                size='small'
                theme={trendMetric === 'amount' ? 'solid' : 'light'}
                type='primary'
                onClick={() => setTrendMetric('amount')}
                style={{ borderRadius: 4, fontSize: 12, padding: '4px 8px' }}
              >
                {t('充值金额')}
              </Button>
              <Button
                size='small'
                theme={trendMetric === 'count' ? 'solid' : 'light'}
                type='primary'
                onClick={() => setTrendMetric('count')}
                style={{ borderRadius: 4, fontSize: 12, padding: '4px 8px' }}
              >
                {t('订单数')}
              </Button>
            </div>
            <div ref={topupTrendChartRef} style={{ width: '100%', height: 240 }} />
          </div>
        ) : (
          <div ref={leftTitle === '注册用户趋势' ? usersTrendChartRef :
                         leftTitle === '消费趋势' ? consumptionTrendChartRef :
                         leftTitle === '渠道消费趋势' ? supplierTrendChartRef : null}
                style={{ width: '100%', height: 240 }} />
        )}
      </div>
      <div style={{
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 4,
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: 'rgba(1, 1, 32, 0.1) 0px 4px 10px',
        padding: '16px',
        minHeight: 280,
      }}>
        <div ref={rightTitle === '用户认证占比' ? authDistChartRef :
                       rightTitle === '三类用户充值分布' ? topupDistChartRef :
                       rightTitle === '付费方式tokens分布' ? paymentModeTokensChartRef :
                       rightTitle === '付费方式收入占比' ? revenuePieChartRef :
                       rightTitle === '渠道消费占比' ? supplierDistChartRef : null}
              style={{ width: '100%', height: 240 }} />
      </div>
    </div>
  );

  // 加载状态
  const loadingOverlay = (statsLoading || chartLoading) && (
    <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
      <Spin size="large" />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 顶部统计卡片 */}
      {statsCards}

      {/* 筛选栏 */}
      {filterBar}

      {/* 第一排：用户分析 */}
      {renderChartRow(
        t('注册用户趋势'), usersTrend, 'count', '',
        t('用户认证占比'), null
      )}

      {/* 第二排：充值分析 */}
      {renderChartRow(
        t('有效充值趋势'), topupTrend, 'amount', '¥',
        t('三类用户充值分布'), null
      )}

      {/* 第三排：消费分析 */}
      {renderChartRow(
        t('消费趋势'), consumptionTrend, 'cost', '¥',
        t('付费方式tokens分布'), null
      )}

      {/* 第四排：营收分析（表格 + 饼图） */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        {/* 营收分析表格 */}
        <div style={{
          flex: 3,
          backgroundColor: '#ffffff',
          borderRadius: 4,
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: 'rgba(1, 1, 32, 0.1) 0px 4px 10px',
          padding: '16px',
        }}>
          <div style={{
            fontSize: 14,
            fontWeight: 400,
            color: 'rgba(0, 0, 0, 0.4)',
            fontFamily: 'PP Neue Montreal Mono, Georgia, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: 0.055,
            marginBottom: 16,
          }}>{t('营收分析')}</div>
          <Table
            columns={revenueColumns}
            dataSource={revenueByUser.items || []}
            loading={chartLoading}
            rowKey='user_id'
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
          <div className='flex w-full pt-4 border-t justify-between items-center'
               style={{ borderColor: 'rgba(0, 0, 0, 0.08)', borderTopWidth: 1, marginTop: 16 }}>
            {createCardProPagination({
              currentPage: revenueByUserPage,
              pageSize: revenueByUserPageSize,
              total: revenueByUser.total || 0,
              onPageChange: (page) => setRevenueByUserPage(page),
              onPageSizeChange: (size) => { setRevenueByUserPageSize(size); setRevenueByUserPage(1); },
              isMobile: isMobile,
              t: t,
            })}
          </div>
        </div>
        {/* 付费方式收入占比饼图 */}
        <div style={{
          flex: 1,
          backgroundColor: '#ffffff',
          borderRadius: 4,
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: 'rgba(1, 1, 32, 0.1) 0px 4px 10px',
          padding: '16px',
          minHeight: 280,
        }}>
          <div ref={revenuePieChartRef} style={{ width: '100%', height: 240 }} />
        </div>
      </div>

      {/* 第五排：渠道消费 */}
      {renderChartRow(
        t('渠道消费趋势'), null, null, null,
        t('渠道消费占比'), null
      )}
    </div>
  );
}
