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
  DatePicker, Table, Typography, Button, Select, Input, Badge, Space, Spin, Empty, Tabs, TabPane,
} from '@douyinfe/semi-ui';
import {
  IconMoneyExchangeStroked, IconCoinMoneyStroked, IconTickCircle, IconClockStroked, IconDownloadStroked,
} from '@douyinfe/semi-icons';
import { IllustrationNoResult, IllustrationNoResultDark } from '@douyinfe/semi-illustrations';
import { API, timestamp2string, showError, showSuccess, modelColorMap, modelToColor, renderQuota, renderNumber } from '../../helpers';
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

// 格式化日期为 MM-DD 或 MM-DD HH:MM（保留小时信息）
const formatDateLabel = (dateStr) => {
  if (!dateStr) return '';
  if (dateStr.includes('T')) {
    dateStr = dateStr.split('T')[0];
  }
  // 检查是否包含小时信息（如 "2024-01-15 14:00"）
  const spaceParts = dateStr.split(' ');
  if (spaceParts.length === 2) {
    // 有小时信息，返回 MM-DD HH:MM
    const dateParts = spaceParts[0].split('-');
    return `${dateParts[1]}-${dateParts[2]} ${spaceParts[1]}`;
  }
  // 只有日期，返回 MM-DD
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
  // 营收分析双视图切换：payg=按量付费，subscription=订阅套餐
  const [revenueTab, setRevenueTab] = useState('payg'); // 'payg' | 'subscription'
  const [payAsYouGoData, setPayAsYouGoData] = useState({ items: [], total: 0 });
  const [payAsYouGoPage, setPayAsYouGoPage] = useState(1);
  const [payAsYouGoPageSize, setPayAsYouGoPageSize] = useState(10);
  const [subscriptionData, setSubscriptionData] = useState({ items: [], total: 0 });
  const [subscriptionPage, setSubscriptionPage] = useState(1);
  const [subscriptionPageSize, setSubscriptionPageSize] = useState(10);
  const [paymentModeRevenueDist, setPaymentModeRevenueDist] = useState({ pay_as_you_go: 0, subscription: 0 });
  const [supplierTrend, setSupplierTrend] = useState([]);
  const [supplierDist, setSupplierDist] = useState({ items: [] });

  // 有效充值趋势指标切换
  const [trendMetric, setTrendMetric] = useState('amount'); // 'amount' | 'count' | 'cumulative'

  // 注册用户趋势指标切换
  const [usersTrendMetric, setUsersTrendMetric] = useState('daily'); // 'daily' | 'cumulative'

  // 渠道消费趋势指标切换
  const [supplierTrendMetric, setSupplierTrendMetric] = useState('tokens'); // 'tokens' | 'count' | 'cost' | 'cumulative'

  // 消费趋势 Tabs（模型数据分析）
  const [activeChartTab, setActiveChartTab] = useState('1');

  // 模型数据分析图表数据（来自 /api/dashboard/board/chart-data）
  const [chartData, setChartData] = useState(null);

  const [chartLoading, setChartLoading] = useState(false);

  // 累计金额状态
  const [cumulativeTopup, setCumulativeTopup] = useState(0);
  const [cumulativeConsumption, setCumulativeConsumption] = useState(0);

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

  // 模型数据分析图表引用（6 个子图表）
  const quotaDistChartRef = useRef(null);        // 1. 消耗分布 - 堆叠柱状图
  const callTrendChartRef = useRef(null);         // 2. 调用趋势 - 折线图
  const callDistChartRef = useRef(null);          // 3. 调用次数分布 - 环形饼图
  const callRankChartRef = useRef(null);          // 4. 调用次数排行 - 水平柱状图
  const userQuotaRankChartRef = useRef(null);     // 5. 用户消耗排行 - 水平柱状图
  const userQuotaTrendChartRef = useRef(null);    // 6. 用户消耗趋势 - 面积图

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
    // 模型数据分析图表
    quotaDist: null,
    callTrend: null,
    callDist: null,
    callRank: null,
    userQuotaRank: null,
    userQuotaTrend: null,
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

      // 获取模型数据分析数据（来自 dashboard board）
      const dashboardBoardRes = await API.get('/api/dashboard/board/chart-data', {
        params: {
          start_timestamp: startTime,
          end_timestamp: endTime,
        },
      });
      if (dashboardBoardRes.data?.success) setChartData(dashboardBoardRes.data?.data || null);
    } catch (error) {
      console.error('获取图表数据失败:', error);
      showError(t('获取图表数据失败'));
    } finally {
      setChartLoading(false);
    }
  };

  // 获取按量付费（消费记录）营收分析数据
  const fetchPayAsYouGo = async () => {
    try {
      const res = await API.get('/api/finance/pay-as-you-go-by-user', {
        params: {
          start_time: startTime,
          end_time: endTime,
          p: payAsYouGoPage,
          page_size: payAsYouGoPageSize,
        },
      });
      if (res.data?.success) {
        setPayAsYouGoData({ items: res.data?.data || [], total: res.data?.total || 0 });
      }
    } catch (error) {
      console.error('获取按量付费营收分析失败:', error);
    }
  };

  // 获取订阅套餐营收分析数据
  const fetchSubscriptionOrders = async () => {
    try {
      const res = await API.get('/api/finance/subscription-orders', {
        params: {
          start_time: startTime,
          end_time: endTime,
          p: subscriptionPage,
          page_size: subscriptionPageSize,
        },
      });
      if (res.data?.success) {
        setSubscriptionData({ items: res.data?.data || [], total: res.data?.total || 0 });
      }
    } catch (error) {
      console.error('获取订阅套餐营收分析失败:', error);
    }
  };

  // 初始化默认日期范围：最近一个月
  useEffect(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    startDate.setHours(0, 0, 0, 0);
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

  // 营收分析双视图数据加载（按量付费 / 订阅套餐）
  useEffect(() => {
    if (startTime > 0 && endTime > 0) {
      if (revenueTab === 'payg') {
        fetchPayAsYouGo();
      } else {
        fetchSubscriptionOrders();
      }
    }
  }, [startTime, endTime, revenueTab, payAsYouGoPage, payAsYouGoPageSize, subscriptionPage, subscriptionPageSize]);

  // 切换视图时重置对应分页为第 1 页
  useEffect(() => {
    setPayAsYouGoPage(1);
    setSubscriptionPage(1);
  }, [revenueTab]);

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
    // 检查数据
    if (!data?.length) {
      // 如果数据为空，销毁实例
      if (chartsInstance.current[chartName]) {
        chartsInstance.current[chartName].dispose();
        chartsInstance.current[chartName] = null;
      }
      return;
    }
    
    // 检查 DOM 元素
    if (!domElement) {
      return;
    }
    
    // 如果 DOM 尺寸为零，延迟初始化等待布局计算完成
    if (domElement.clientWidth === 0 || domElement.clientHeight === 0) {
      setTimeout(() => {
        if (chartsInstance.current[chartName]) {
          chartsInstance.current[chartName].resize();
        } else {
          renderLineChart(chartName, domElement, data, title, valueKey, unit, valueLabel);
        }
      }, 100);
      return;
    }
    
    // 销毁旧实例（如果 DOM 已变化）
    if (chartsInstance.current[chartName]) {
      try {
        const currentDom = chartsInstance.current[chartName].getDom();
        if (currentDom !== domElement) {
          chartsInstance.current[chartName].dispose();
          chartsInstance.current[chartName] = null;
        }
      } catch (e) {
        // 实例可能已失效，重新创建
        chartsInstance.current[chartName] = null;
      }
    }
    
    // 初始化新实例
    if (!chartsInstance.current[chartName]) {
      try {
        chartsInstance.current[chartName] = echarts.init(domElement);
      } catch (e) {
        console.error(`Failed to init chart: ${chartName}`, e);
        return;
      }
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
        bottom: 0,
        left: 'center',
        data: pieData.map(item => item.name),
        textStyle: {
          fontSize: 12,
          color: 'rgba(0, 0, 0, 0.4)',
        },
        padding: [0, 0, 0, 0],
      },
      series: [{
        name: title,
        type: 'pie',
        radius: ['35%', '65%'],
        center: ['50%', '45%'],
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
    const valueLabel = usersTrendMetric === 'daily' ? t('新增用户') : t('累计用户');
    let dataToRender = usersTrend;
    if (usersTrendMetric === 'cumulative') {
      dataToRender = usersTrend.reduce((acc, item, index) => {
        const cumulative = index === 0 ? item.count : acc[index - 1].count + item.count;
        acc.push({ ...item, count: cumulative });
        return acc;
      }, []);
    }
    renderLineChart('usersTrend', usersTrendChartRef.current, dataToRender, t('注册用户趋势'), 'count', '', valueLabel);
  }, [usersTrend, t, usersTrendMetric]);

  useEffect(() => {
    const authData = [
      { name: t('未认证'), value: usersAuthDist.unverified || 0 },
      { name: t('个人用户'), value: usersAuthDist.individual || 0 },
      { name: t('企业用户'), value: usersAuthDist.enterprise || 0 },
    ].filter(item => item.value > 0);
    renderPieChart('authDist', authDistChartRef.current, authData, t('用户认证占比'));
  }, [usersAuthDist, t]);

  // 计算累计充值金额
  useEffect(() => {
    if (topupTrend.length > 0) {
      const total = topupTrend.reduce((sum, item) => sum + (item.amount || 0), 0);
      setCumulativeTopup(total);
    } else {
      setCumulativeTopup(0);
    }
  }, [topupTrend]);

  // 计算累计消费金额（来自 supplierTrend，按日期聚合后求和）
  useEffect(() => {
    if (supplierTrend.length > 0) {
      // 按日期聚合所有渠道的消费金额
      const dateCostMap = {};
      supplierTrend.forEach(item => {
        const date = item.date;
        if (!dateCostMap[date]) {
          dateCostMap[date] = 0;
        }
        dateCostMap[date] += (item.cost || 0);
      });
      // 对所有日期的聚合值求和
      const total = Object.values(dateCostMap).reduce((sum, cost) => sum + cost, 0);
      setCumulativeConsumption(total);
    } else {
      setCumulativeConsumption(0);
    }
  }, [supplierTrend]);

  // 计算有效充值累计趋势数据
  const cumulativeTopupTrend = useMemo(() => {
    if (topupTrend.length === 0) return [];
    return topupTrend.reduce((acc, item, index) => {
      const cumulative = index === 0 ? item.amount : acc[index - 1].amount + item.amount;
      acc.push({ ...item, amount: cumulative });
      return acc;
    }, []);
  }, [topupTrend]);

  useEffect(() => {
    let dataToRender = topupTrend;
    let valueKey = 'amount';
    let unit = '¥';
    let valueLabel = t('充值金额');
    
    if (trendMetric === 'count') {
      valueKey = 'count';
      unit = '';
      valueLabel = t('订单数');
    } else if (trendMetric === 'cumulative') {
      dataToRender = cumulativeTopupTrend;
      valueKey = 'amount';
      unit = '¥';
      valueLabel = t('累计充值金额');
    }
    
    renderLineChart('topupTrend', topupTrendChartRef.current, dataToRender, t('有效充值趋势'), valueKey, unit, valueLabel);
  }, [topupTrend, cumulativeTopupTrend, t, trendMetric]);

  useEffect(() => {
    const distData = [
      { name: t('未认证用户'), value: topupUserTypeDist.unverified || 0 },
      { name: t('个人用户'), value: topupUserTypeDist.individual || 0 },
      { name: t('企业用户'), value: topupUserTypeDist.enterprise || 0 },
    ].filter(item => item.value > 0);
    renderPieChart('topupDist', topupDistChartRef.current, distData, t('用户充值分布'));
  }, [topupUserTypeDist, t]);

  // 使用 forceRefresh 强制刷新图表
  const [forceRefresh, setForceRefresh] = useState(0);
  
  useEffect(() => {
    // 组件挂载时和消费趋势数据变化时刷新图表
    setForceRefresh(prev => prev + 1);
  }, [consumptionTrend]);
  
  useEffect(() => {
    // 使用 requestAnimationFrame 确保 DOM 已渲染
    requestAnimationFrame(() => {
      if (consumptionTrendChartRef.current && consumptionTrend?.length > 0) {
        renderLineChart('consumptionTrend', consumptionTrendChartRef.current, consumptionTrend, t('消费趋势'), 'cost', '¥');
      }
    });
  }, [consumptionTrend, t, forceRefresh]);

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

  // 渠道消费趋势：按渠道分组的消费数据（多系列折线图）或累计折线图
  useEffect(() => {
    if (!supplierTrend?.length) {
      if (chartsInstance.current.supplierTrend) {
        chartsInstance.current.supplierTrend.setOption({ series: [{ data: [] }] });
      }
      return;
    }
    
    if (!supplierTrendChartRef.current) return;
    if (!chartsInstance.current.supplierTrend) {
      chartsInstance.current.supplierTrend = echarts.init(supplierTrendChartRef.current);
    }
    
    // 累计消费模式：按渠道分别计算累计消费金额，每个渠道一条折线
    if (supplierTrendMetric === 'cumulative') {
      // 按日期和渠道聚合
      const dateChannelMap = {};
      const channelSet = new Set();
      supplierTrend.forEach(item => {
        const date = item.date;
        const channel = item.supplier || '未知';
        channelSet.add(channel);
        if (!dateChannelMap[date]) {
          dateChannelMap[date] = {};
        }
        if (!dateChannelMap[date][channel]) {
          dateChannelMap[date][channel] = 0;
        }
        dateChannelMap[date][channel] += (item.cost || 0);
      });
      
      const dates = Object.keys(dateChannelMap).sort();
      const channels = Array.from(channelSet).sort();
      
      // 为每个渠道计算累计值
      const cumulativeDataByChannel = {};
      channels.forEach(channel => {
        cumulativeDataByChannel[channel] = dates.reduce((acc, date, index) => {
          const dailyCost = dateChannelMap[date][channel] || 0;
          const cumulative = index === 0 ? dailyCost : acc[index - 1] + dailyCost;
          acc.push(cumulative);
          return acc;
        }, []);
      });
      
      const option = {
        title: {
          text: t('渠道消费趋势'),
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
            if (!params || !params.length) return '';
            let result = `<strong>${formatDateLabel(params[0].name)}</strong><br/>`;
            params.forEach(p => {
              result += `${p.marker}${p.seriesName}: ¥${p.value.toFixed(2)}<br/>`;
            });
            return result;
          },
        },
        legend: {
          orient: 'horizontal',
          bottom: '5%',
          left: 'center',
          data: channels,
          textStyle: {
            fontSize: 12,
            color: 'rgba(0, 0, 0, 0.4)',
          },
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '15%',
          top: 45,
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: dates.map(date => formatDateLabel(date)),
          axisLabel: {
            rotate: dates.length > 15 ? 45 : 0,
            interval: 0,
          },
        },
        yAxis: {
          type: 'value',
          name: t('累计消费金额'),
          position: 'left',
          axisLabel: {
            formatter: '¥{value}',
          },
        },
        series: channels.map((channel, index) => ({
          name: channel,
          type: 'line',
          smooth: true,
          data: cumulativeDataByChannel[channel],
          itemStyle: {
            color: modelColorMap?.[channel] || pieColors[index % pieColors.length],
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: (modelColorMap?.[channel] || pieColors[index % pieColors.length]) + '4D' },
              { offset: 1, color: (modelColorMap?.[channel] || pieColors[index % pieColors.length]) + '0D' },
            ]),
          },
        })),
      };
      
      chartsInstance.current.supplierTrend.setOption(option, true);
      return;
    }
    
    // 非累计模式：按渠道分组的折线图（多系列）
    // 按日期和渠道聚合
    const dateChannelMap = {};
    const channelSet = new Set();
    supplierTrend.forEach(item => {
      if (!dateChannelMap[item.date]) {
        dateChannelMap[item.date] = {};
      }
      const channel = item.supplier || '未知';
      channelSet.add(channel);
      if (!dateChannelMap[item.date][channel]) {
        dateChannelMap[item.date][channel] = { cost: 0, tokens: 0, request_count: 0 };
      }
      dateChannelMap[item.date][channel].cost += item.cost || 0;
      dateChannelMap[item.date][channel].tokens += item.tokens || 0;
      dateChannelMap[item.date][channel].request_count += item.request_count || 0;
    });
    
    const dates = Object.keys(dateChannelMap).sort();
    const channels = Array.from(channelSet).sort();
    
    let valueLabel, dataKey, yAxisName;
    if (supplierTrendMetric === 'tokens') {
      valueLabel = t('消耗Tokens');
      dataKey = 'tokens';
      yAxisName = 'Tokens';
    } else if (supplierTrendMetric === 'count') {
      valueLabel = t('请求次数');
      dataKey = 'request_count';
      yAxisName = '次数';
    } else {
      valueLabel = t('消费金额');
      dataKey = 'cost';
      yAxisName = '金额 (¥)';
    }
    
    const option = {
      title: {
        text: t('渠道消费趋势'),
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
          if (!params || !params.length) return '';
          let result = `<strong>${params[0].name}</strong><br/>`;
          const isCost = supplierTrendMetric === 'cost';
          params.forEach(p => {
            result += `${p.marker}${p.seriesName}: ${isCost ? '¥' + p.value.toFixed(2) : p.value.toFixed(0)}<br/>`;
          });
          return result;
        },
      },
      legend: {
        orient: 'horizontal',
        bottom: '5%',
        left: 'center',
        data: channels,
        textStyle: {
          fontSize: 12,
          color: 'rgba(0, 0, 0, 0.4)',
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: 45,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          formatter: function(value) {
            if (value.includes('T')) value = value.split('T')[0];
            const parts = value.split('-');
            if (parts.length === 3) return `${parts[1]}-${parts[2]}`;
            return value;
          },
          rotate: dates.length > 15 ? 45 : 0,
          interval: 0,
        },
      },
      yAxis: {
        type: 'value',
        name: valueLabel,
        position: 'left',
        axisLabel: {
          formatter: '{value}',
        },
      },
      series: channels.map((channel, index) => ({
        name: channel,
        type: 'line',
        smooth: true,
        data: dates.map(date => dateChannelMap[date][channel]?.[dataKey] || 0),
        itemStyle: {
          color: modelColorMap?.[channel] || pieColors[index % pieColors.length],
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: (modelColorMap?.[channel] || pieColors[index % pieColors.length]) + '4D' },
            { offset: 1, color: (modelColorMap?.[channel] || pieColors[index % pieColors.length]) + '0D' },
          ]),
        },
      })),
    };
    
    chartsInstance.current.supplierTrend.setOption(option);
  }, [supplierTrend, t, supplierTrendMetric]);

  useEffect(() => {
    const distData = (supplierDist.items || []).map(item => ({
      name: item.supplier || '未知',
      value: item.cost || 0,
    })).filter(item => item.value > 0);
    renderPieChart('supplierDist', supplierDistChartRef.current, distData, t('渠道消费占比'));
  }, [supplierDist, t]);

  // ========== 模型数据分析 - 6 个子图表渲染 ==========

  // 切换 Tab 时清理离开图表的实例（避免 DOM 卸载后 ECharts 实例仍绑定旧 DOM 的问题）
  useEffect(() => {
    const tabInstanceMap = {
      '1': 'quotaDist',
      '2': 'callTrend',
      '3': 'callDist',
      '4': 'callRank',
      '5': 'userQuotaRank',
      '6': 'userQuotaTrend',
    };
    Object.entries(tabInstanceMap).forEach(([tabKey, instanceKey]) => {
      if (tabKey !== activeChartTab && chartsInstance.current[instanceKey]) {
        try {
          chartsInstance.current[instanceKey].dispose();
        } catch (e) {
          // ignore dispose errors
        }
        chartsInstance.current[instanceKey] = null;
      }
    });
  }, [activeChartTab]);

  // 1. 消耗分布 - 堆叠柱状图
  useEffect(() => {
    if (!chartData?.quota_distribution?.length || activeChartTab !== '1') {
      if (chartsInstance.current.quotaDist) {
        chartsInstance.current.quotaDist.setOption({ series: [{ data: [] }] });
      }
      return;
    }

    const data = chartData.quota_distribution;
    // 提取所有唯一模型
    const modelSet = new Set();
    data.forEach(item => item.model && modelSet.add(item.model));
    const modelList = Array.from(modelSet);

    // 构建每个模型的时间序列数据（将 raw_quota 转换为显示值）
    // model/dashboard_board.go 中除以 500000
    const quotaDivisor = 500000;
    const modelData = {};
    modelList.forEach(model => { modelData[model] = {}; });
    data.forEach(item => {
      if (!modelData[item.model]) { modelData[item.model] = {}; }
      // 转换 raw_quota 为显示单位（金额）
      modelData[item.model][item.time] = (item.raw_quota || 0) / quotaDivisor;
    });

    // 提取所有唯一时间点并排序
    const timeSet = new Set();
    data.forEach(item => timeSet.add(item.time));
    const times = Array.from(timeSet).sort();

    // 获取消耗标签
    const statusStr = localStorage.getItem('status');
    let symbol = '$';
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        const quotaDisplayType = localStorage.getItem('quota_display_type') || 'USD';
        if (quotaDisplayType === 'CNY') symbol = '¥';
        else if (quotaDisplayType === 'CUSTOM') symbol = s?.custom_currency_symbol || '¤';
      }
    } catch (e) {}

    if (!chartsInstance.current.quotaDist) {
      chartsInstance.current.quotaDist = echarts.init(quotaDistChartRef.current);
    }

    // 图例配置 - 底部水平滚动布局
    const legendConfig = {
      type: 'scroll',
      orient: 'horizontal',
      bottom: 10,
      left: 'center',
      data: modelList,
      textStyle: { fontSize: 10, color: 'rgba(0, 0, 0, 0.5)' },
      pageTextStyle: { fontSize: 10, color: 'rgba(0, 0, 0, 0.5)' },
      pageIconColor: '#1890ff',
      pageIconInactiveColor: '#b0b5b9',
      pageIconSize: 12,
      pageFormatter: '{current}/{total}',
      pageButtonGap: 5,
      pageButtonPosition: 'right',
      pageButtonStyle: {
        backgroundColor: '#1890ff',
        borderColor: '#1890ff',
        borderRadius: 2,
      },
    };

    const gridConfig = { left: '3%', right: '4%', bottom: '18%', top: 35, containLabel: true };

    chartsInstance.current.quotaDist.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function(params) {
          if (!params || !params.length) return '';
          let result = `<strong>${formatDateLabel(params[0].name)}</strong><br/>`;
          params.forEach(p => {
            result += `${p.marker}${p.seriesName}: ${symbol}${p.value.toFixed(2)}<br/>`;
          });
          return result;
        }
      },
      legend: legendConfig,
      grid: gridConfig,
      xAxis: {
        type: 'category',
        data: times.map(formatDateLabel),
        axisLabel: { rotate: 45, fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        name: `消耗 (${symbol})`,
        axisLabel: {
          fontSize: 10,
          formatter: (value) => value.toFixed(2)
        }
      },
      series: modelList.map(model => ({
        name: model,
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: times.map(time => modelData[model][time] || 0),
        itemStyle: { color: modelToColor(model) },
      })),
    });
  }, [chartData?.quota_distribution, activeChartTab]);

  // 2. 调用趋势 - 折线图
  useEffect(() => {
    if (!chartData?.call_trend?.length || activeChartTab !== '2') {
      if (chartsInstance.current.callTrend) {
        chartsInstance.current.callTrend.setOption({ series: [{ data: [] }] });
      }
      return;
    }

    const data = chartData.call_trend;
    const dates = data.map(item => formatDateLabel(item.time));
    const counts = data.map(item => item.count || 0);

    if (!chartsInstance.current.callTrend) {
      chartsInstance.current.callTrend = echarts.init(callTrendChartRef.current);
    }

    chartsInstance.current.callTrend.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 15, containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { rotate: 45, fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10 }
      },
      series: [{
        type: 'line',
        smooth: true,
        data: counts,
        itemStyle: { color: '#1890ff' },
        areaStyle: { opacity: 0.3 },
      }],
    });
  }, [chartData?.call_trend, activeChartTab]);

  // 3. 调用次数分布 - 环形饼图
  useEffect(() => {
    if (!chartData?.call_distribution?.length || activeChartTab !== '3') {
      if (chartsInstance.current.callDist) {
        chartsInstance.current.callDist.setOption({ series: [{ data: [] }] });
      }
      return;
    }

    const data = chartData.call_distribution;
    const pieData = data.map(item => ({ name: item.model, value: item.count || 0 }));

    if (!chartsInstance.current.callDist) {
      chartsInstance.current.callDist = echarts.init(callDistChartRef.current);
    }

    chartsInstance.current.callDist.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: {
        type: 'scroll',
        orient: 'horizontal',
        bottom: 10,
        left: 'center',
        textStyle: { fontSize: 12 },
        pageTextStyle: { fontSize: 12 },
        pageIconColor: '#1890ff',
        pageIconInactiveColor: '#b0b5b9',
        pageIconSize: 12,
        pageFormatter: '{current}/{total}',
        pageButtonGap: 5,
        pageButtonPosition: 'right',
      },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        labelLine: { show: false },
        data: pieData,
        color: data.map((_, i) => pieColors[i % pieColors.length]),
      }],
    });
  }, [chartData?.call_distribution, activeChartTab]);

  // 4. 调用次数排行 - 水平柱状图
  useEffect(() => {
    if (!chartData?.call_rank?.length || activeChartTab !== '4') {
      if (chartsInstance.current.callRank) {
        chartsInstance.current.callRank.setOption({ series: [{ data: [] }] });
      }
      return;
    }

    const data = [...chartData.call_rank].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 10);

    if (!chartsInstance.current.callRank) {
      chartsInstance.current.callRank = echarts.init(callRankChartRef.current);
    }

    chartsInstance.current.callRank.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '10%', bottom: '3%', top: 10, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, formatter: v => renderNumber(v) }
      },
      yAxis: {
        type: 'category',
        data: data.map(item => item.model),
        axisLabel: { fontSize: 10 }
      },
      series: [{
        type: 'bar',
        data: data.map((item, i) => ({
          value: item.count || 0,
          itemStyle: { color: pieColors[i % pieColors.length] },
        })),
        label: { show: true, position: 'right', fontSize: 10, formatter: v => renderNumber(v.value) },
      }],
    });
  }, [chartData?.call_rank, activeChartTab]);

  // 5. 用户消耗排行 - 水平柱状图
  useEffect(() => {
    if (!chartData?.user_quota_rank?.length || activeChartTab !== '5') {
      if (chartsInstance.current.userQuotaRank) {
        chartsInstance.current.userQuotaRank.setOption({ series: [{ data: [] }] });
      }
      return;
    }

    // 获取货币配置（与 renderQuota 逻辑一致）
    const quotaPerUnit = parseFloat(localStorage.getItem('quota_per_unit')) || 1;
    const quotaDisplayType = localStorage.getItem('quota_display_type') || 'USD';
    const statusStr = localStorage.getItem('status');
    let symbol = '$';
    let rate = 1;
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        if (quotaDisplayType === 'CNY') {
          symbol = '¥';
          rate = s?.usd_exchange_rate || 1;
        } else if (quotaDisplayType === 'CUSTOM') {
          symbol = s?.custom_currency_symbol || '¤';
          rate = s?.custom_currency_exchange_rate || 1;
        }
      }
    } catch (e) {}

    // 将 raw_quota 转换为显示金额（与 /console 页面的 renderQuota 一致）
    const convertQuotaToAmount = (rawQuota) => {
      const usdAmount = rawQuota / quotaPerUnit;
      if (quotaDisplayType === 'CNY') {
        return usdAmount * rate;
      } else if (quotaDisplayType === 'CUSTOM') {
        return usdAmount * rate;
      }
      return usdAmount;
    };

    const data = [...chartData.user_quota_rank].sort((a, b) => (b.raw_quota || 0) - (a.raw_quota || 0)).slice(0, 10);

    if (!chartsInstance.current.userQuotaRank) {
      chartsInstance.current.userQuotaRank = echarts.init(userQuotaRankChartRef.current);
    }

    chartsInstance.current.userQuotaRank.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: params => {
          const p = params[0];
          return `${p.name}<br/>${symbol}${(p.value || 0).toFixed(4)}`;
        }
      },
      grid: { left: '3%', right: '10%', bottom: '3%', top: 10, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, formatter: v => `${symbol}${v.toFixed(2)}` }
      },
      yAxis: {
        type: 'category',
        data: data.map(item => item.user || item.username || '未知用户'),
        axisLabel: { fontSize: 10 }
      },
      series: [{
        type: 'bar',
        data: data.map((item, i) => ({
          value: convertQuotaToAmount(item.raw_quota || 0),
          name: item.user || item.username,
          itemStyle: { color: pieColors[i % pieColors.length] },
        })),
        label: { show: true, position: 'right', fontSize: 10, formatter: params => `${symbol}${(params.value || 0).toFixed(4)}` },
      }],
    });
  }, [chartData?.user_quota_rank, activeChartTab]);

  // 6. 用户消耗趋势 - 面积图
  useEffect(() => {
    if (!chartData?.user_quota_trend?.length || activeChartTab !== '6') {
      if (chartsInstance.current.userQuotaTrend) {
        chartsInstance.current.userQuotaTrend.setOption({ series: [{ data: [] }] });
      }
      return;
    }

    // 获取货币配置（与 renderQuota 逻辑一致）
    const quotaPerUnit = parseFloat(localStorage.getItem('quota_per_unit')) || 1;
    const quotaDisplayType = localStorage.getItem('quota_display_type') || 'USD';
    const statusStr = localStorage.getItem('status');
    let symbol = '$';
    let rate = 1;
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        if (quotaDisplayType === 'CNY') {
          symbol = '¥';
          rate = s?.usd_exchange_rate || 1;
        } else if (quotaDisplayType === 'CUSTOM') {
          symbol = s?.custom_currency_symbol || '¤';
          rate = s?.custom_currency_exchange_rate || 1;
        }
      }
    } catch (e) {}

    // 将 raw_quota 转换为显示金额（与 /console 页面的 renderQuota 一致）
    const convertQuotaToAmount = (rawQuota) => {
      const usdAmount = rawQuota / quotaPerUnit;
      if (quotaDisplayType === 'CNY') {
        return usdAmount * rate;
      } else if (quotaDisplayType === 'CUSTOM') {
        return usdAmount * rate;
      }
      return usdAmount;
    };

    const data = chartData.user_quota_trend;
    
    // 按用户分组（存储转换后的金额）
    const userMap = {};
    data.forEach(item => {
      if (!userMap[item.user]) { userMap[item.user] = {}; }
      userMap[item.user][item.time] = convertQuotaToAmount(item.raw_quota || 0);
    });

    const users = Object.keys(userMap).slice(0, 5); // 最多显示前5个用户
    const timeSet = new Set();
    data.forEach(item => timeSet.add(item.time));
    const times = Array.from(timeSet).sort();

    if (!chartsInstance.current.userQuotaTrend) {
      chartsInstance.current.userQuotaTrend = echarts.init(userQuotaTrendChartRef.current);
    }

    chartsInstance.current.userQuotaTrend.setOption({
      tooltip: {
        trigger: 'axis',
        formatter: params => {
          let res = `${formatDateLabel(params[0].name)}<br/>`;
          params.forEach(p => { res += `${p.marker}${p.seriesName}: ${symbol}${p.value.toFixed(4)}<br/>`; });
          return res;
        }
      },
      legend: { data: users, top: 5, textStyle: { fontSize: 10 } },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 35, containLabel: true },
      xAxis: {
        type: 'category',
        data: times.map(formatDateLabel),
        axisLabel: { rotate: 45, fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        name: `消耗 (${symbol})`,
        axisLabel: { fontSize: 10, formatter: v => `${symbol}${v.toFixed(2)}` }
      },
      series: users.map((user, i) => ({
        name: user,
        type: 'line',
        smooth: true,
        data: times.map(time => userMap[user][time] || 0),
        itemStyle: { color: pieColors[i % pieColors.length] },
        areaStyle: { opacity: 0.2 },
      })),
    });
  }, [chartData?.user_quota_trend, activeChartTab]);

  // 修复：页面返回时重新渲染所有图表
  // 使用 Visibility API 检测页面可见性变化
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 页面变为可见时，强制重新渲染所有图表
        setTimeout(() => {
          // 触发所有图表重新渲染
          setConsumptionTrend(prev => [...prev]);
          setUsersTrend(prev => [...prev]);
          setTopupTrend(prev => [...prev]);
          setSupplierTrend(prev => [...prev]);
          setUsersAuthDist(prev => ({...prev}));
          setTopupUserTypeDist(prev => ({...prev}));
          setPaymentModeTokensDist(prev => ({...prev}));
          setPaymentModeRevenueDist(prev => ({...prev}));
          setSupplierDist(prev => ({...prev}));
          // 刷新模型数据分析图表
          if (chartData) {
            setChartData(prev => ({...prev}));
          }
        }, 100);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [chartData]);

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

  // 导出营收分析表格为 CSV（根据当前视图切换）
  const handleExportRevenueCsv = async () => {
    try {
      let csvContent = '';
      let filename = '';
      if (revenueTab === 'payg') {
        csvContent = '用户名,金额\n';
        payAsYouGoData.items.forEach((item) => {
          const username = (item.username || '').replace(/,/g, '，');
          csvContent += `${username},${item.amount}\n`;
        });
        filename = `pay_as_you_go_${new Date().toISOString().slice(0, 10)}.csv`;
      } else {
        csvContent = '用户名,套餐类型,套餐名,订阅时间,到期时间,实收金额,实得金额(Tokens数量)\n';
        subscriptionData.items.forEach((item) => {
          const username = (item.username || '').replace(/,/g, '，');
          const planName = (item.plan_name || '').replace(/,/g, '，');
          const planType = item.plan_type === 'tokens' ? t('tokens') : t('quota');
          const subscribeTime = item.subscribe_time ? timestamp2string(item.subscribe_time) : '';
          const expireTime = item.expire_time ? timestamp2string(item.expire_time) : '';
          csvContent += `${username},${planType},${planName},${subscribeTime},${expireTime},${item.paid_amount},${item.tokens_amount}\n`;
        });
        filename = `subscription_orders_${new Date().toISOString().slice(0, 10)}.csv`;
      }
      // 添加 BOM 头，Excel 正确识别 UTF-8
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showSuccess(t('导出成功'));
    } catch (error) {
      console.error('导出CSV失败:', error);
      showError(t('导出失败'));
    }
  };

  // 表格列定义：按量付费（消费记录金额）
  const payAsYouGoColumns = useMemo(() => [
    {
      title: t('用户名'),
      dataIndex: 'username',
      key: 'username',
      width: 180,
      render: (text) => (
        <Typography.Text
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
        </Typography.Text>
      ),
    },
    {
      title: t('金额'),
      dataIndex: 'amount',
      key: 'amount',
      width: 160,
      render: (val) => <Typography.Text type='primary'>{formatMoney(val)}</Typography.Text>,
    },
  ], [t, startTime, endTime]);

  // 表格列定义：订阅套餐
  const subscriptionColumns = useMemo(() => [
    {
      title: t('用户名'),
      dataIndex: 'username',
      key: 'username',
      width: 140,
      render: (text) => (
        <Typography.Text type='primary' style={{ cursor: 'pointer' }}>
          {text || '-'}
        </Typography.Text>
      ),
    },
    {
      title: t('套餐类型'),
      dataIndex: 'plan_type',
      key: 'plan_type',
      width: 110,
      render: (val) => (
        <Typography.Text type={val === 'tokens' ? 'warning' : 'tertiary'}>
          {val === 'tokens' ? t('tokens') : t('quota')}
        </Typography.Text>
      ),
    },
    {
      title: t('套餐名'),
      dataIndex: 'plan_name',
      key: 'plan_name',
      width: 160,
      render: (text) => <span>{text || '-'}</span>,
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
      render: (val) => <span>{val ? timestamp2string(val) : '-'}</span>,
    },
    {
      title: t('实收金额'),
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      width: 130,
      render: (val) => <Typography.Text type='success'>{formatMoney(val)}</Typography.Text>,
    },
    {
      title: t('实得金额（Tokens数量）'),
      dataIndex: 'tokens_amount',
      key: 'tokens_amount',
      width: 180,
      render: (val) => <Typography.Text type='primary'>{val ? val.toLocaleString() : '-'}</Typography.Text>,
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
          type='dateTime'
          placeholder={t('开始时间')}
          value={dateRange.startDate}
          onChange={(value) => {
            setDateRange((prev) => ({ ...prev, startDate: value }));
            setRevenueByUserPage(1);
          }}
          maxDate={dateRange.endDate || new Date()}
          disabledDate={(date) => date > new Date()}
          style={{ minWidth: '220px', borderRadius: 4 }}
        />
        <span className='text-gray-400'>~</span>
        <DatePicker
          type='dateTime'
          placeholder={t('结束时间')}
          value={dateRange.endDate}
          onChange={(value) => {
            setDateRange((prev) => ({ ...prev, endDate: value }));
            setRevenueByUserPage(1);
          }}
          minDate={dateRange.startDate}
          maxDate={new Date()}
          style={{ minWidth: '220px', borderRadius: 4 }}
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
              <Button
                size='small'
                theme={trendMetric === 'cumulative' ? 'solid' : 'light'}
                type='primary'
                onClick={() => setTrendMetric('cumulative')}
                style={{ borderRadius: 4, fontSize: 12, padding: '4px 8px' }}
              >
                {t('累计充值')}
              </Button>
            </div>
            <div ref={topupTrendChartRef} style={{ width: '100%', height: 240 }} />
          </div>
        ) : leftTitle === '注册用户趋势' ? (
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', right: 16, top: 8, zIndex: 10, display: 'flex', gap: 2 }}>
              <Button
                size='small'
                theme={usersTrendMetric === 'daily' ? 'solid' : 'light'}
                type='primary'
                onClick={() => setUsersTrendMetric('daily')}
                style={{ borderRadius: 4, fontSize: 12, padding: '4px 8px' }}
              >
                {t('每日注册用户数')}
              </Button>
              <Button
                size='small'
                theme={usersTrendMetric === 'cumulative' ? 'solid' : 'light'}
                type='primary'
                onClick={() => setUsersTrendMetric('cumulative')}
                style={{ borderRadius: 4, fontSize: 12, padding: '4px 8px' }}
              >
                {t('累计注册用户数')}
              </Button>
            </div>
            <div ref={usersTrendChartRef} style={{ width: '100%', height: 240 }} />
          </div>
        ) : leftTitle === '渠道消费趋势' ? (
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', right: 16, top: 8, zIndex: 10, display: 'flex', gap: 2 }}>
              <Button
                size='small'
                theme={supplierTrendMetric === 'tokens' ? 'solid' : 'light'}
                type='primary'
                onClick={() => setSupplierTrendMetric('tokens')}
                style={{ borderRadius: 4, fontSize: 12, padding: '4px 8px' }}
              >
                {t('消耗Tokens')}
              </Button>
              <Button
                size='small'
                theme={supplierTrendMetric === 'count' ? 'solid' : 'light'}
                type='primary'
                onClick={() => setSupplierTrendMetric('count')}
                style={{ borderRadius: 4, fontSize: 12, padding: '4px 8px' }}
              >
                {t('请求次数')}
              </Button>
              <Button
                size='small'
                theme={supplierTrendMetric === 'cost' ? 'solid' : 'light'}
                type='primary'
                onClick={() => setSupplierTrendMetric('cost')}
                style={{ borderRadius: 4, fontSize: 12, padding: '4px 8px' }}
              >
                {t('消费金额')}
              </Button>
              <Button
                size='small'
                theme={supplierTrendMetric === 'cumulative' ? 'solid' : 'light'}
                type='primary'
                onClick={() => setSupplierTrendMetric('cumulative')}
                style={{ borderRadius: 4, fontSize: 12, padding: '4px 8px' }}
              >
                {t('累计消费')}
              </Button>
            </div>
            <div ref={supplierTrendChartRef} style={{ width: '100%', height: 240 }} />
          </div>
        ) : (
          <div ref={leftTitle === '消费趋势' ? consumptionTrendChartRef : null}
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
                       rightTitle === '用户充值分布' ? topupDistChartRef :
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
        t('用户充值分布'), null
      )}

      {/* 第三排：消费趋势（含 Tabs 的 6 个子图表）+ 付费方式 Tokens 分布 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        {/* 左侧：消费趋势 Tabs（3/4 宽度） */}
        <div style={{
          flex: 3,
          backgroundColor: '#ffffff',
          borderRadius: 4,
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: 'rgba(1, 1, 32, 0.1) 0px 4px 10px',
          padding: '16px',
          minHeight: 400,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{
              fontSize: 14,
              fontWeight: 400,
              color: 'rgba(0, 0, 0, 0.4)',
              fontFamily: 'PP Neue Montreal Mono, Georgia, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: 0.055,
            }}>{t('消费趋势')}</div>
            <Tabs
              type='slash'
              activeKey={activeChartTab}
              onChange={setActiveChartTab}
              style={{ fontSize: 12 }}
            >
              <TabPane tab={t('消耗分布')} itemKey='1' />
              <TabPane tab={t('调用趋势')} itemKey='2' />
              <TabPane tab={t('调用次数分布')} itemKey='3' />
              <TabPane tab={t('调用次数排行')} itemKey='4' />
              <TabPane tab={t('用户消耗排行')} itemKey='5' />
              <TabPane tab={t('用户消耗趋势')} itemKey='6' />
            </Tabs>
          </div>
          <div style={{ height: 320, width: '100%', position: 'relative' }}>
            {/* 1. 消耗分布 - 堆叠柱状图 */}
            {activeChartTab === '1' && (
              <div ref={quotaDistChartRef} style={{ width: '100%', height: '100%' }} />
            )}
            {/* 2. 调用趋势 - 折线图 */}
            {activeChartTab === '2' && (
              <div ref={callTrendChartRef} style={{ width: '100%', height: '100%' }} />
            )}
            {/* 3. 调用次数分布 - 环形饼图 */}
            {activeChartTab === '3' && (
              <div ref={callDistChartRef} style={{ width: '100%', height: '100%' }} />
            )}
            {/* 4. 调用次数排行 - 水平柱状图 */}
            {activeChartTab === '4' && (
              <div ref={callRankChartRef} style={{ width: '100%', height: '100%' }} />
            )}
            {/* 5. 用户消耗排行 - 水平柱状图 */}
            {activeChartTab === '5' && (
              <div ref={userQuotaRankChartRef} style={{ width: '100%', height: '100%' }} />
            )}
            {/* 6. 用户消耗趋势 - 面积图 */}
            {activeChartTab === '6' && (
              <div ref={userQuotaTrendChartRef} style={{ width: '100%', height: '100%' }} />
            )}
            {/* 暂无数据提示 */}
            {activeChartTab && chartData && !(() => {
              const dataMap = {
                '1': chartData.quota_distribution,
                '2': chartData.call_trend,
                '3': chartData.call_distribution,
                '4': chartData.call_rank,
                '5': chartData.user_quota_rank,
                '6': chartData.user_quota_trend,
              };
              return !dataMap[activeChartTab]?.length;
            })() ? null : (
              <Empty
                image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
                darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
                description={t('暂无数据')}
                style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
              />
            )}
          </div>
        </div>
        {/* 右侧：付费方式 Tokens 分布饼图（1/4 宽度） */}
        <div style={{
          flex: 1,
          backgroundColor: '#ffffff',
          borderRadius: 4,
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: 'rgba(1, 1, 32, 0.1) 0px 4px 10px',
          padding: '16px',
          minHeight: 400,
        }}>
          <div ref={paymentModeTokensChartRef} style={{ width: '100%', height: 240 }} />
        </div>
      </div>

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
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <div style={{
              fontSize: 14,
              fontWeight: 400,
              color: 'rgba(0, 0, 0, 0.4)',
              fontFamily: 'PP Neue Montreal Mono, Georgia, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: 0.055,
            }}>{t('营收分析')}</div>
            <div style={{ display: 'flex', gap: 2 }}>
              <Button
                size='small'
                theme={revenueTab === 'payg' ? 'solid' : 'light'}
                type='primary'
                onClick={() => setRevenueTab('payg')}
                style={{ borderRadius: 4, fontSize: 12, padding: '4px 8px' }}
              >
                {t('按量付费')}
              </Button>
              <Button
                size='small'
                theme={revenueTab === 'subscription' ? 'solid' : 'light'}
                type='primary'
                onClick={() => setRevenueTab('subscription')}
                style={{ borderRadius: 4, fontSize: 12, padding: '4px 8px' }}
              >
                {t('订阅套餐')}
              </Button>
            </div>
          </div>
          <Table
            columns={revenueTab === 'payg' ? payAsYouGoColumns : subscriptionColumns}
            dataSource={revenueTab === 'payg' ? (payAsYouGoData.items || []) : (subscriptionData.items || [])}
            loading={chartLoading}
            rowKey={(record) => revenueTab === 'payg' ? `payg-${record.user_id}-${record.username}` : `sub-${record.user_id}-${record.plan_name}-${record.subscribe_time}`}
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
            <Button
              icon={<IconDownloadStroked />}
              type='primary'
              size='small'
              onClick={handleExportRevenueCsv}
              style={{ marginLeft: 12 }}
            >
              {t('导出 CSV')}
            </Button>
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

