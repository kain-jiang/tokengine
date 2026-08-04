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

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as echarts from 'echarts';
import {
  DatePicker, Typography, Button, Select, Input, Badge, Space, Spin, Empty, Tabs, TabPane,
} from '@douyinfe/semi-ui';
import {
  IconMoneyExchangeStroked, IconCoinMoneyStroked, IconTickCircle, IconClockStroked,
} from '@douyinfe/semi-icons';
import { IllustrationNoResult, IllustrationNoResultDark } from '@douyinfe/semi-illustrations';
import { API, showError, modelColorMap, modelToColor, renderQuota, renderNumber } from '../../helpers';
import { formatMoney } from './utils';
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

// 格式化日期为 YYYY-MM-DD 或 YYYY-MM-DD HH:MM（保留小时信息）
const formatDateLabel = (dateStr) => {
  if (!dateStr) return '';
  if (dateStr.includes('T')) {
    dateStr = dateStr.split('T')[0];
  }
  // 检查是否包含小时信息（如 "2024-01-15 14:00"）
  const spaceParts = dateStr.split(' ');
  if (spaceParts.length === 2) {
    // 有小时信息，返回 YYYY-MM-DD HH:MM
    return spaceParts[0] + ' ' + spaceParts[1];
  }
  // 只有日期，返回 YYYY-MM-DD
  return dateStr;
};

export default function FinanceDashboard() {
  const { t } = useTranslation();
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
    avg_rpm: 0,
    avg_tpm: 0,
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
  const [userAgentDist, setUserAgentDist] = useState([]);
  
  // 营收趋势（全局折线图）
  const [revenueTrend, setRevenueTrend] = useState({ pay_as_you_go: [], subscription: [] });

  // 各数据区块独立加载状态（用于显示"数据加载中"占位）
  const [userLoading, setUserLoading] = useState(false);       // 用户分析（第一排）
  const [topupLoading, setTopupLoading] = useState(false);     // 充值分析（第二排）
  const [consumptionLoading, setConsumptionLoading] = useState(false); // 消费趋势（第三排）
  const [revenueLoading, setRevenueLoading] = useState(false); // 营收趋势（第四排）
  const [supplierLoading, setSupplierLoading] = useState(false); // 渠道消费（第五排）

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

  // 大屏模式状态
  const [isDashboardMode, setIsDashboardMode] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [dataFlash, setDataFlash] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

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
  const revenueTrendChartRef = useRef(null); // 营收趋势（按量付费 + 订阅套餐）

  // 模型数据分析图表引用（6 个子图表）
  const quotaDistChartRef = useRef(null);        // 1. 消耗分布 - 堆叠柱状图
  const callTrendChartRef = useRef(null);         // 2. 调用趋势 - 折线图
  const callDistChartRef = useRef(null);          // 3. 调用次数分布 - 环形饼图
  const callRankChartRef = useRef(null);          // 4. 调用次数排行 - 水平柱状图
  const userQuotaRankChartRef = useRef(null);     // 5. 用户消耗排行 - 水平柱状图
  const userQuotaTrendChartRef = useRef(null);    // 6. 用户消耗趋势 - 面积图

  // 大屏模式专用图表引用
  const dashboardChartsRef = useRef({
    usersTrend: null,
    authDist: null,
    topupTrend: null,
    topupDist: null,
    consumptionTrend: null,
    paymentModeTokens: null,
    revenuePie: null,
    supplierTrend: null,
    supplierDist: null,
    revenueTrend: null,
    quotaDist: null,
    callTrend: null,
    callDist: null,
    callRank: null,
    userQuotaRank: null,
    userQuotaTrend: null,
  });

  const chartsInstance = useRef({
    usersTrend: null,
    authDist: null,
    topupTrend: null,
    topupDist: null,
    consumptionTrend: null,
    paymentModeTokens: null,
    revenuePie: null, // 付费方式收入对比饼图
    supplierTrend: null,
    supplierDist: null,
    revenueTrend: null, // 营收趋势（按量付费 + 订阅套餐合并）
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
    revenueTrend: revenueTrendChartRef, // 营收趋势（按量付费 + 订阅套餐合并）
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

  // 获取所有图表数据（按优先级串行请求，上部分优先加载）
  const fetchChartData = async () => {
    setChartLoading(true);
    
    // 设置所有区块为加载中状态
    setUserLoading(true);
    setTopupLoading(true);
    setConsumptionLoading(true);
    setRevenueLoading(true);
    setSupplierLoading(true);
    
    try {
      const params = { start_time: startTime, end_time: endTime };

      // ========== 第一排：用户分析（最高优先级） ==========
      try {
        const [usersTrendRes, usersAuthDistRes] = await Promise.all([
          API.get('/api/finance/users/trend', { params }),
          API.get('/api/finance/users/auth-distribution', { params: {} }),
        ]);
        if (usersTrendRes.data?.success) setUsersTrend(usersTrendRes.data?.data || []);
        if (usersAuthDistRes.data?.success) setUsersAuthDist(usersAuthDistRes.data?.data || {});
      } catch (error) {
        console.error('获取用户分析数据失败:', error);
      } finally {
        setUserLoading(false);
      }

      // 短暂延迟，让浏览器先渲染第一排
      await new Promise(resolve => setTimeout(resolve, 50));

      // ========== 第二排：充值分析（高优先级） ==========
      try {
        const [topupTrendRes, topupUserTypeDistRes] = await Promise.all([
          API.get('/api/finance/topup/trend', { params }),
          API.get('/api/finance/topup/user-type-dist', { params }),
        ]);
        if (topupTrendRes.data?.success) setTopupTrend(topupTrendRes.data?.data || []);
        if (topupUserTypeDistRes.data?.success) setTopupUserTypeDist(topupUserTypeDistRes.data?.data || {});
      } catch (error) {
        console.error('获取充值分析数据失败:', error);
      } finally {
        setTopupLoading(false);
      }

      // 短暂延迟，让浏览器渲染第二排
      await new Promise(resolve => setTimeout(resolve, 50));

      // ========== 第三排：消费趋势（中优先级） ==========
      try {
        const [consumptionTrendRes, paymentModeTokensDistRes, revenueByUserRes, userAgentDistRes] = await Promise.all([
          API.get('/api/finance/consumption/trend', { params }),
          API.get('/api/finance/payment-mode-tokens-dist', { params }),
          API.get('/api/finance/revenue-by-user', { params: { ...params, p: revenueByUserPage, page_size: revenueByUserPageSize } }),
          API.get('/api/finance/user-agent-dist', { params }),
        ]);
        if (consumptionTrendRes.data?.success) setConsumptionTrend(consumptionTrendRes.data?.data || []);
        if (paymentModeTokensDistRes.data?.success) setPaymentModeTokensDist(paymentModeTokensDistRes.data?.data || {});
        if (revenueByUserRes.data?.success) {
          setRevenueByUser({ items: revenueByUserRes.data?.data || [], total: revenueByUserRes.data?.total || 0 });
        }
        if (userAgentDistRes.data?.success) setUserAgentDist(userAgentDistRes.data?.data || []);
      } catch (error) {
        console.error('获取消费趋势数据失败:', error);
      } finally {
        setConsumptionLoading(false);
      }

      // 短暂延迟，让浏览器渲染第三排
      await new Promise(resolve => setTimeout(resolve, 50));

      // ========== 第四排：营收趋势（中低优先级） ==========
      try {
        const [revenueTrendRes, paymentModeRevenueDistRes] = await Promise.all([
          API.get('/api/finance/revenue/trend', { params }),
          API.get('/api/finance/payment-mode-revenue-dist', { params }),
        ]);
        if (revenueTrendRes.data?.success) setRevenueTrend(revenueTrendRes.data?.data || { pay_as_you_go: [], subscription: [] });
        if (paymentModeRevenueDistRes.data?.success) setPaymentModeRevenueDist(paymentModeRevenueDistRes.data?.data || {});
      } catch (error) {
        console.error('获取营收趋势数据失败:', error);
      } finally {
        setRevenueLoading(false);
      }

      // 短暂延迟，让浏览器渲染第四排
      await new Promise(resolve => setTimeout(resolve, 50));

      // ========== 第五排：渠道消费（低优先级） ==========
      try {
        const [supplierTrendRes, supplierDistRes] = await Promise.all([
          API.get('/api/finance/supplier/trend', { params }),
          API.get('/api/finance/supplier-dist', { params }),
        ]);
        if (supplierTrendRes.data?.success) setSupplierTrend(supplierTrendRes.data?.data || []);
        if (supplierDistRes.data?.success) setSupplierDist(supplierDistRes.data?.data || { items: [] });
      } catch (error) {
        console.error('获取渠道消费数据失败:', error);
      } finally {
        setSupplierLoading(false);
      }

      // 获取模型数据分析数据（来自 dashboard board，最低优先级）
      try {
        const dashboardBoardRes = await API.get('/api/dashboard/board/chart-data', {
          params: {
            start_timestamp: startTime,
            end_timestamp: endTime,
          },
        });
        if (dashboardBoardRes.data?.success) setChartData(dashboardBoardRes.data?.data || null);
      } catch (error) {
        console.error('获取模型数据分析数据失败:', error);
      }
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
  }, [startTime, endTime]);

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
    
    // 截断过长的名称用于图例显示（最多 40 字符）
    const MAX_LEGEND_LENGTH = 40;
    const pieData = data.map(item => ({
      name: item.name.length > MAX_LEGEND_LENGTH
        ? item.name.slice(0, MAX_LEGEND_LENGTH) + '...'
        : item.name,
      value: item.value,
      originalName: item.name // 保存原始完整名称用于 tooltip
    }));

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
        formatter: (params) => {
          const originalName = params.data?.originalName || params.name;
          return `${originalName}<br/>${params.marker}${params.value} (${params.percent}%)`;
        },
      },
      legend: {
        orient: 'horizontal',
        bottom: 0,
        left: 'center',
        data: pieData.map(item => item.name),
        textStyle: {
          fontSize: 12,
          color: 'rgba(0, 0, 0, 0.4)',
          width: 360,
          overflow: 'truncate',
        },
        padding: [0, 0, 0, 0],
        formatter: (name) => {
          // 查找对应的原始数据，截断显示
          const item = pieData.find(p => p.name === name);
          if (item && item.originalName && item.originalName !== name) {
            return name.length > 25 ? name.slice(0, 25) + '...' : name;
          }
          return name;
        },
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

  // 渲染付费方式收入对比饼图
  // 参数: domElement=DOM元素, payAsYouGo=按量付费金额, subscription=订阅金额
  const renderRevenuePieChart = (domElement, payAsYouGo, subscription) => {
    if (!domElement) return;
    
    const total = payAsYouGo + subscription;
    if (total === 0) {
      if (chartsInstance.current.revenuePie) {
        chartsInstance.current.revenuePie.setOption({ series: [{ data: [] }] });
      }
      return;
    }

    if (!chartsInstance.current.revenuePie) {
      chartsInstance.current.revenuePie = echarts.init(domElement);
    }

    const pieData = [
      { name: t('按量付费'), value: payAsYouGo },
      { name: t('订阅'), value: subscription },
    ].filter(item => item.value > 0);

    const option = {
      title: {
        text: t('付费方式收入对比'),
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
        name: t('付费方式收入对比'),
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
    chartsInstance.current.revenuePie.setOption(option);
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
    // 客户端 User-Agent 分布饼图（来自 user_agent_dist API）
    const uaData = userAgentDist.map(item => ({
      name: item.user_agent || '未知客户端',
      value: item.count || 0,
    })).filter(item => item.value > 0).slice(0, 10); // 最多显示前 10 个
    renderPieChart('paymentModeTokens', paymentModeTokensChartRef.current, uaData, t('客户端分布'));
  }, [userAgentDist, t]);

  useEffect(() => {
    // 渲染付费方式收入对比饼图
    renderRevenuePieChart(
      revenuePieChartRef.current,
      paymentModeRevenueDist.pay_as_you_go || 0,
      paymentModeRevenueDist.subscription || 0
    );
  }, [paymentModeRevenueDist, t]);

  // 工具函数：四舍五入到两位小数
  const mathRound = (val) => Math.round(val * 100) / 100;

  // 计算营收统计指标
  const revenueStats = useMemo(() => {
    let totalPayAsYouGo = 0;
    let totalSubscription = 0;
    revenueTrend?.pay_as_you_go?.forEach(item => { totalPayAsYouGo += (item.amount || 0); });
    revenueTrend?.subscription?.forEach(item => { totalSubscription += (item.amount || 0); });
    return {
      total: mathRound(totalPayAsYouGo + totalSubscription),
      pay_as_you_go: mathRound(totalPayAsYouGo),
      subscription: mathRound(totalSubscription),
    };
  }, [revenueTrend]);

  // 营收趋势折线图（按量付费 + 订阅套餐，双折线图例）
  useEffect(() => {
    const hasData = (revenueTrend?.pay_as_you_go?.length > 0) || (revenueTrend?.subscription?.length > 0);
    if (!hasData) {
      if (chartsInstance.current.revenueTrend) {
        chartsInstance.current.revenueTrend.setOption({ series: [{ data: [] }, { data: [] }] });
      }
      return;
    }
    if (!revenueTrendChartRef.current) {
      requestAnimationFrame(() => {
        renderRevenueTrendChart();
      });
      return;
    }
    renderRevenueTrendChart();
  }, [revenueTrend]);

  const renderRevenueTrendChart = () => {
    if (!revenueTrendChartRef.current) return;
    
    // 合并所有日期（去重后排序）
    const dateSet = new Set();
    revenueTrend?.pay_as_you_go?.forEach(item => dateSet.add(item.date));
    revenueTrend?.subscription?.forEach(item => dateSet.add(item.date));
    const allDates = Array.from(dateSet).sort();
    
    // 构建按量付费和订阅套餐的金额映射
    const paygMap = {};
    revenueTrend?.pay_as_you_go?.forEach(item => { paygMap[item.date] = item.amount; });
    const subMap = {};
    revenueTrend?.subscription?.forEach(item => { subMap[item.date] = item.amount; });
    
    // 构建图表数据
    const paygData = allDates.map(date => paygMap[date] || 0);
    const subData = allDates.map(date => subMap[date] || 0);
    
    if (!chartsInstance.current.revenueTrend) {
      chartsInstance.current.revenueTrend = echarts.init(revenueTrendChartRef.current);
    }
    chartsInstance.current.revenueTrend.setOption({
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: 'rgba(0, 0, 0, 0.08)',
        borderWidth: 1,
        textStyle: { color: '#000000', fontSize: 14 },
        formatter: function(params) {
          if (!params || params.length === 0) return '';
          const dateStr = formatDateLabel(params[0].name);
          let content = `<div style="font-weight:500;margin-bottom:6px">${dateStr}</div>`;
          params.forEach(p => {
            content += `<div style="display:flex;justify-content:gap:8px;align-items:center">
              <span>${p.marker}</span>
              <span style="color:rgba(0,0,0,0.6)">${p.seriesName}:</span>
              <span style="font-weight:500">¥${p.value.toLocaleString()}</span>
            </div>`;
          });
          return content;
        }
      },
      legend: {
        data: [t('按量付费'), t('订阅套餐')],
        top: 0,
        right: 0,
        itemWidth: 16,
        itemHeight: 8,
        itemGap: 16,
        textStyle: {
          fontSize: 14,
          fontWeight: 400,
          color: 'rgba(0, 0, 0, 0.6)',
          fontFamily: 'PP Neue Montreal Mono, Georgia, sans-serif',
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: 40,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: allDates.map(formatDateLabel),
        boundaryGap: false,
        axisLine: { lineStyle: { color: 'rgba(0, 0, 0, 0.08)' } },
        axisTick: { show: false },
        axisLabel: {
          rotate: allDates.length > 15 ? 45 : 0,
          interval: 0,
          fontSize: 10,
          color: 'rgba(0, 0, 0, 0.4)',
          fontFamily: 'PP Neue Montreal Mono, Georgia, sans-serif',
        }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(0, 0, 0, 0.04)' } },
        axisLabel: {
          formatter: '¥{value}',
          fontSize: 10,
          color: 'rgba(0, 0, 0, 0.4)',
          fontFamily: 'PP Neue Montreal Mono, Georgia, sans-serif',
        }
      },
      series: [
        {
          name: t('按量付费'),
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2 },
          data: paygData,
          itemStyle: { color: '#52c41a' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(82, 196, 26, 0.25)' },
              { offset: 1, color: 'rgba(82, 196, 26, 0.02)' }
            ])
          }
        },
        {
          name: t('订阅套餐'),
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2 },
          data: subData,
          itemStyle: { color: '#722ed1' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(114, 46, 209, 0.25)' },
              { offset: 1, color: 'rgba(114, 46, 209, 0.02)' }
            ])
          }
        }
      ]
    });
  };

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
            fontSize: 12,
            fontWeight: 500,
            color: 'rgba(0, 0, 0, 0.4)',
            fontFamily: 'PP Neue Montreal Mono, Georgia, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.055px',
            marginBottom: 20,
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
          fontSize: 12,
          fontWeight: 500,
          color: 'rgba(0, 0, 0, 0.4)',
          fontFamily: 'PP Neue Montreal Mono, Georgia, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: '0.055px',
        },
      },
      tooltip: {
        show: true,
        trigger: 'axis',
        formatter: function(params) {
          if (!params || !params.length) return '';
          let result = `<strong>${formatDateLabel(params[0].name)}</strong><br/>`;
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

  // 大屏模式：定时刷新逻辑
  useEffect(() => {
    if (!isDashboardMode) return;

    // 进入时立即刷新一次
    const refreshData = () => {
      fetchDashboardStats();
      fetchChartData();
      setLastUpdateTime(new Date());
      setDataFlash(true);
      setTimeout(() => setDataFlash(false), 600);
    };

    refreshData();

    // 30 秒定时刷新
    const refreshTimer = setInterval(refreshData, 30000);

    // 倒计时
    const countdownTimer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return 30;
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(refreshTimer);
      clearInterval(countdownTimer);
    };
  }, [isDashboardMode]);

  // ESC 键退出大屏模式
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isDashboardMode) {
        setIsDashboardMode(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isDashboardMode]);

  // 大屏模式：实时时钟更新
  useEffect(() => {
    if (!isDashboardMode) return;
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [isDashboardMode]);

  // 大屏模式：图表渲染（使用独立的 ref 和图表实例）
  const renderDashboardChart = useCallback(() => {
    if (!isDashboardMode) return;

    const ref = dashboardChartsRef.current;

    // 辅助函数：获取 DOM 元素
    const getDom = (id) => {
      const dom = document.getElementById(id);
      if (!dom) {
        console.warn(`[Dashboard] DOM not found: ${id}`);
        return null;
      }
      return dom;
    };

    // 辅助函数：初始化或更新图表（自动处理 DOM 变化）
    const initOrUpdate = (key, dom, option) => {
      if (!dom) return;
      // 如果已有实例但 DOM 已变化（被 React 重新创建），则销毁旧实例
      if (ref[key] && ref[key].getDom && ref[key].getDom() !== dom) {
        ref[key].dispose();
        ref[key] = null;
      }
      if (!ref[key] || ref[key].isDisposed()) {
        ref[key] = echarts.init(dom);
      }
      ref[key].setOption(option, true);
    };

    // 1. 注册用户趋势（支持每日/累计指标切换）
    if (usersTrend?.length) {
      const dom = getDom('dashboard-usersTrend');
      // 根据指标切换计算数据
      let usersData = usersTrend;
      let yAxisFormatter = '{value}';
      if (usersTrendMetric === 'cumulative') {
        usersData = usersTrend.reduce((acc, item, index) => {
          const cumulative = index === 0 ? item.count : acc[index - 1].count + item.count;
          acc.push({ ...item, count: cumulative });
          return acc;
        }, []);
      }
      initOrUpdate('usersTrend', dom, {
        backgroundColor: 'transparent',
        title: { text: usersTrendMetric === 'cumulative' ? t('累计注册用户趋势') : t('注册用户趋势'), textStyle: { color: 'rgba(255,255,255,0.8)', fontSize: 16 }, left: 'center' },
        tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,14,39,0.9)', borderColor: 'rgba(30,144,255,0.3)', textStyle: { color: '#fff' } },
        grid: { left: '3%', right: '4%', bottom: '3%', top: 40, containLabel: true },
        xAxis: { type: 'category', data: usersData.map(i => formatDateLabel(i.date)), axisLabel: { color: 'rgba(255,255,255,0.6)' }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
        yAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.6)', formatter: yAxisFormatter }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
        series: [{ type: 'line', smooth: true, data: usersData.map(i => i.count), itemStyle: { color: '#1e90ff' }, areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(30,144,255,0.4)'},{offset:1,color:'rgba(30,144,255,0.05)'}]) } }]
      });
    }

    // 2. 用户认证占比
    const authData = [
      { name: t('未认证'), value: usersAuthDist.unverified || 0 },
      { name: t('个人用户'), value: usersAuthDist.individual || 0 },
      { name: t('企业用户'), value: usersAuthDist.enterprise || 0 },
    ].filter(i => i.value > 0);
    if (authData.length) {
      initOrUpdate('authDist', getDom('dashboard-authDist'), {
        backgroundColor: 'transparent',
        title: { text: t('用户认证占比'), textStyle: { color: 'rgba(255,255,255,0.8)', fontSize: 16 }, left: 'center' },
        tooltip: { trigger: 'item', backgroundColor: 'rgba(10,14,39,0.9)', borderColor: 'rgba(30,144,255,0.3)', textStyle: { color: '#fff' } },
        legend: { orient: 'horizontal', bottom: 0, textStyle: { color: 'rgba(255,255,255,0.6)' } },
        series: [{ type: 'pie', radius: ['35%', '65%'], center: ['50%', '45%'], itemStyle: { borderRadius: 4, borderColor: '#0a0e27', borderWidth: 2 }, label: { show: false }, labelLine: { show: false }, data: authData, color: ['#1e90ff', '#52c41a', '#722ed1'] }]
      });
    }

    // 3. 有效充值趋势（支持金额/订单数/累计指标切换）
    if (topupTrend?.length) {
      let topupData = topupTrend;
      let valueKey = 'amount';
      let unit = '¥';
      let titleText = t('有效充值趋势');
      let yAxisFormatter = '¥{value}';
      if (trendMetric === 'count') {
        valueKey = 'count';
        unit = '';
        titleText = t('有效充值订单趋势');
        yAxisFormatter = '{value}';
      } else if (trendMetric === 'cumulative') {
        topupData = topupTrend.reduce((acc, item, index) => {
          const cumulative = index === 0 ? item.amount : acc[index - 1].amount + item.amount;
          acc.push({ ...item, amount: cumulative });
          return acc;
        }, []);
        valueKey = 'amount';
        unit = '¥';
        titleText = t('累计有效充值趋势');
        yAxisFormatter = '¥{value}';
      }
      initOrUpdate('topupTrend', getDom('dashboard-topupTrend'), {
        backgroundColor: 'transparent',
        title: { text: titleText, textStyle: { color: 'rgba(255,255,255,0.8)', fontSize: 16 }, left: 'center' },
        tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,14,39,0.9)', borderColor: 'rgba(30,144,255,0.3)', textStyle: { color: '#fff' } },
        grid: { left: '3%', right: '4%', bottom: '3%', top: 40, containLabel: true },
        xAxis: { type: 'category', data: topupData.map(i => formatDateLabel(i.date)), axisLabel: { color: 'rgba(255,255,255,0.6)' }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
        yAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.6)', formatter: yAxisFormatter }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
        series: [{ type: 'line', smooth: true, data: topupData.map(i => i[valueKey]), itemStyle: { color: '#52c41a' }, areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(82,196,26,0.4)'},{offset:1,color:'rgba(82,196,26,0.05)'}]) } }]
      });
    }

    // 4. 用户充值分布
    const topupDistData = [
      { name: t('未认证用户'), value: topupUserTypeDist.unverified || 0 },
      { name: t('个人用户'), value: topupUserTypeDist.individual || 0 },
      { name: t('企业用户'), value: topupUserTypeDist.enterprise || 0 },
    ].filter(i => i.value > 0);
    if (topupDistData.length) {
      initOrUpdate('topupDist', getDom('dashboard-topupDist'), {
        backgroundColor: 'transparent',
        title: { text: t('用户充值分布'), textStyle: { color: 'rgba(255,255,255,0.8)', fontSize: 16 }, left: 'center' },
        tooltip: { trigger: 'item', backgroundColor: 'rgba(10,14,39,0.9)', borderColor: 'rgba(30,144,255,0.3)', textStyle: { color: '#fff' } },
        legend: { orient: 'horizontal', bottom: 0, textStyle: { color: 'rgba(255,255,255,0.6)' } },
        series: [{ type: 'pie', radius: ['35%', '65%'], center: ['50%', '45%'], itemStyle: { borderRadius: 4, borderColor: '#0a0e27', borderWidth: 2 }, label: { show: false }, labelLine: { show: false }, data: topupDistData, color: ['#1e90ff', '#52c41a', '#722ed1'] }]
      });
    }

    // 5. 消费趋势
    if (consumptionTrend?.length) {
      initOrUpdate('consumptionTrend', getDom('dashboard-consumptionTrend'), {
        backgroundColor: 'transparent',
        title: { text: t('消费趋势'), textStyle: { color: 'rgba(255,255,255,0.8)', fontSize: 16 }, left: 'center' },
        tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,14,39,0.9)', borderColor: 'rgba(30,144,255,0.3)', textStyle: { color: '#fff' } },
        grid: { left: '3%', right: '4%', bottom: '3%', top: 40, containLabel: true },
        xAxis: { type: 'category', data: consumptionTrend.map(i => formatDateLabel(i.date)), axisLabel: { color: 'rgba(255,255,255,0.6)' }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
        yAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.6)', formatter: '¥{value}' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
        series: [{ type: 'line', smooth: true, data: consumptionTrend.map(i => i.cost), itemStyle: { color: '#722ed1' }, areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(114,46,209,0.4)'},{offset:1,color:'rgba(114,46,209,0.05)'}]) } }]
      });
    }

    // 6. 客户端分布
    const uaData = userAgentDist.map(i => ({ name: i.user_agent || '未知客户端', value: i.count || 0 })).filter(i => i.value > 0).slice(0, 10);
    if (uaData.length) {
      // 截断过长的图例名称（最多 30 字符）
      const MAX_LEGEND_LENGTH = 30;
      const legendData = uaData.map(item => ({
        name: item.name.length > MAX_LEGEND_LENGTH
          ? item.name.slice(0, MAX_LEGEND_LENGTH) + '...'
          : item.name,
        value: item.value,
        originalName: item.name
      }));
      
      initOrUpdate('paymentModeTokens', getDom('dashboard-paymentModeTokens'), {
        backgroundColor: 'transparent',
        title: { text: t('客户端分布'), textStyle: { color: 'rgba(255,255,255,0.8)', fontSize: 16 }, left: 'center' },
        tooltip: {
          trigger: 'item',
          backgroundColor: 'rgba(10,14,39,0.9)',
          borderColor: 'rgba(30,144,255,0.3)',
          textStyle: { color: '#fff' },
          formatter: (params) => {
            const originalName = params.data?.originalName || params.name;
            return `${originalName}<br/>${params.marker}${params.value} (${params.percent}%)`;
          }
        },
        legend: {
          orient: 'vertical',
          right: '5%',
          top: 'center',
          textStyle: {
            color: 'rgba(255,255,255,0.6)',
            fontSize: 11,
            width: 120,
            overflow: 'truncate'
          },
          padding: [0, 0, 0, 0],
          itemWidth: 12,
          itemHeight: 8,
          itemGap: 12,
          data: legendData.map(item => item.name)
        },
        series: [{
          type: 'pie',
          radius: ['35%', '60%'],
          center: ['38%', '50%'],
          itemStyle: { borderRadius: 4, borderColor: '#0a0e27', borderWidth: 2 },
          label: { show: false },
          labelLine: { show: false },
          data: legendData,
          color: pieColors
        }]
      });
    }

    // 7. 营收趋势
    const hasData = (revenueTrend?.pay_as_you_go?.length > 0) || (revenueTrend?.subscription?.length > 0);
    if (hasData) {
      const dateSet = new Set();
      revenueTrend?.pay_as_you_go?.forEach(i => dateSet.add(i.date));
      revenueTrend?.subscription?.forEach(i => dateSet.add(i.date));
      const allDates = Array.from(dateSet).sort();
      const paygMap = {}, subMap = {};
      revenueTrend?.pay_as_you_go?.forEach(i => { paygMap[i.date] = i.amount; });
      revenueTrend?.subscription?.forEach(i => { subMap[i.date] = i.amount; });
      initOrUpdate('revenueTrend', getDom('dashboard-revenueTrend'), {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,14,39,0.9)', borderColor: 'rgba(30,144,255,0.3)', textStyle: { color: '#fff' } },
        legend: { data: [t('按量付费'), t('订阅套餐')], top: 0, textStyle: { color: 'rgba(255,255,255,0.6)' } },
        grid: { left: '3%', right: '4%', bottom: '3%', top: 40, containLabel: true },
        xAxis: { type: 'category', data: allDates.map(formatDateLabel), axisLabel: { color: 'rgba(255,255,255,0.6)', rotate: allDates.length > 15 ? 45 : 0 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
        yAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.6)', formatter: '¥{value}' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
        series: [
          { name: t('按量付费'), type: 'line', smooth: true, data: allDates.map(d => paygMap[d] || 0), itemStyle: { color: '#52c41a' }, areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(82,196,26,0.4)'},{offset:1,color:'rgba(82,196,26,0.05)'}]) } },
          { name: t('订阅套餐'), type: 'line', smooth: true, data: allDates.map(d => subMap[d] || 0), itemStyle: { color: '#722ed1' }, areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(114,46,209,0.4)'},{offset:1,color:'rgba(114,46,209,0.05)'}]) } }
        ]
      });
    }

    // 8. 付费方式收入占比
    const total = (paymentModeRevenueDist.pay_as_you_go || 0) + (paymentModeRevenueDist.subscription || 0);
    if (total > 0) {
      initOrUpdate('revenuePie', getDom('dashboard-revenuePie'), {
        backgroundColor: 'transparent',
        title: { text: t('付费方式收入占比'), textStyle: { color: 'rgba(255,255,255,0.8)', fontSize: 16 }, left: 'center' },
        tooltip: { trigger: 'item', backgroundColor: 'rgba(10,14,39,0.9)', borderColor: 'rgba(30,144,255,0.3)', textStyle: { color: '#fff' } },
        legend: { orient: 'horizontal', bottom: 0, textStyle: { color: 'rgba(255,255,255,0.6)' } },
        series: [{ type: 'pie', radius: ['35%', '65%'], center: ['50%', '45%'], itemStyle: { borderRadius: 4, borderColor: '#0a0e27', borderWidth: 2 }, label: { show: false }, labelLine: { show: false }, data: [{ name: t('按量付费'), value: paymentModeRevenueDist.pay_as_you_go || 0 }, { name: t('订阅套餐'), value: paymentModeRevenueDist.subscription || 0 }], color: ['#52c41a', '#722ed1'] }]
      });
    }

    // 9. 渠道消费趋势（支持 Tokens/请求次数/消费金额/累计 指标切换）
    if (supplierTrend?.length) {
      // 按日期和渠道聚合（同时聚合 cost/tokens/request_count）
      const dateChannelMap = {};
      const channelSet = new Set();
      supplierTrend.forEach(item => {
        const date = item.date;
        const channel = item.supplier || '未知';
        channelSet.add(channel);
        if (!dateChannelMap[date]) dateChannelMap[date] = {};
        if (!dateChannelMap[date][channel]) dateChannelMap[date][channel] = { cost: 0, tokens: 0, request_count: 0 };
        dateChannelMap[date][channel].cost += item.cost || 0;
        dateChannelMap[date][channel].tokens += item.tokens || 0;
        dateChannelMap[date][channel].request_count += item.request_count || 0;
      });
      const dates = Object.keys(dateChannelMap).sort();
      const channels = Array.from(channelSet).sort();

      // 根据指标切换确定数据键、单位、标题
      let dataKey = 'cost';
      let yAxisFormatter = '¥{value}';
      let titleText = t('渠道消费趋势');
      let isCost = true;
      if (supplierTrendMetric === 'tokens') {
        dataKey = 'tokens';
        yAxisFormatter = '{value}';
        titleText = t('渠道消耗Tokens趋势');
        isCost = false;
      } else if (supplierTrendMetric === 'count') {
        dataKey = 'request_count';
        yAxisFormatter = '{value}';
        titleText = t('渠道请求次数趋势');
        isCost = false;
      } else if (supplierTrendMetric === 'cumulative') {
        dataKey = 'cost';
        yAxisFormatter = '¥{value}';
        titleText = t('渠道累计消费趋势');
        isCost = true;
      } else {
        dataKey = 'cost';
        yAxisFormatter = '¥{value}';
        titleText = t('渠道消费趋势');
        isCost = true;
      }

      // 累计模式：按渠道分别计算累计值
      let seriesDataBuilder;
      if (supplierTrendMetric === 'cumulative') {
        const cumulativeByChannel = {};
        channels.forEach(ch => {
          cumulativeByChannel[ch] = dates.reduce((acc, date, index) => {
            const daily = dateChannelMap[date][ch]?.cost || 0;
            const cumulative = index === 0 ? daily : acc[index - 1] + daily;
            acc.push(cumulative);
            return acc;
          }, []);
        });
        seriesDataBuilder = (ch) => cumulativeByChannel[ch];
      } else {
        seriesDataBuilder = (ch) => dates.map(d => dateChannelMap[d][ch]?.[dataKey] || 0);
      }

      initOrUpdate('supplierTrend', getDom('dashboard-supplierTrend'), {
        backgroundColor: 'transparent',
        title: { text: titleText, textStyle: { color: 'rgba(255,255,255,0.8)', fontSize: 16 }, left: 'center' },
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(10,14,39,0.9)',
          borderColor: 'rgba(30,144,255,0.3)',
          textStyle: { color: '#fff' },
          formatter: function(params) {
            if (!params || !params.length) return '';
            let result = `<strong>${formatDateLabel(params[0].name)}</strong><br/>`;
            params.forEach(p => {
              result += `${p.marker}${p.seriesName}: ${isCost ? '¥' + p.value.toFixed(2) : p.value.toFixed(0)}<br/>`;
            });
            return result;
          }
        },
        legend: { type: 'scroll', orient: 'horizontal', bottom: 0, data: channels, textStyle: { color: 'rgba(255,255,255,0.6)' } },
        grid: { left: '3%', right: '4%', bottom: '15%', top: 40, containLabel: true },
        xAxis: { type: 'category', data: dates.map(formatDateLabel), axisLabel: { color: 'rgba(255,255,255,0.6)', rotate: 45 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
        yAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.6)', formatter: yAxisFormatter }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
        series: channels.map((ch, idx) => ({
          name: ch,
          type: 'line',
          smooth: true,
          data: seriesDataBuilder(ch),
          itemStyle: { color: pieColors[idx % pieColors.length] },
          areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:pieColors[idx % pieColors.length]+'66'},{offset:1,color:pieColors[idx % pieColors.length]+'0D'}]) }
        }))
      });
    }

    // 10. 渠道消费占比
    const distData = (supplierDist.items || []).map(i => ({ name: i.supplier || '未知', value: i.cost || 0 })).filter(i => i.value > 0);
    if (distData.length) {
      initOrUpdate('supplierDist', getDom('dashboard-supplierDist'), {
        backgroundColor: 'transparent',
        title: { text: t('渠道消费占比'), textStyle: { color: 'rgba(255,255,255,0.8)', fontSize: 16 }, left: 'center' },
        tooltip: { trigger: 'item', backgroundColor: 'rgba(10,14,39,0.9)', borderColor: 'rgba(30,144,255,0.3)', textStyle: { color: '#fff' } },
        legend: { orient: 'horizontal', bottom: 0, textStyle: { color: 'rgba(255,255,255,0.6)', width: 200, overflow: 'truncate' } },
        series: [{ type: 'pie', radius: ['35%', '65%'], center: ['50%', '45%'], itemStyle: { borderRadius: 4, borderColor: '#0a0e27', borderWidth: 2 }, label: { show: false }, labelLine: { show: false }, data: distData, color: pieColors }]
      });
    }

    // 11-16. 模型数据分析（6 个 Tab 图表）
    if (chartData) {
      // 1. 消耗分布
      if (activeChartTab === '1' && chartData.quota_distribution?.length) {
        const modelSet = new Set();
        chartData.quota_distribution.forEach(i => i.model && modelSet.add(i.model));
        const modelList = Array.from(modelSet);
        const quotaDivisor = 500000;
        const modelData = {};
        modelList.forEach(m => { modelData[m] = {}; });
        chartData.quota_distribution.forEach(i => { if (!modelData[i.model]) modelData[i.model] = {}; modelData[i.model][i.time] = (i.raw_quota || 0) / quotaDivisor; });
        const timeSet = new Set();
        chartData.quota_distribution.forEach(i => timeSet.add(i.time));
        const times = Array.from(timeSet).sort();
        initOrUpdate('quotaDist', getDom('dashboard-quotaDist'), {
          backgroundColor: 'transparent',
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(10,14,39,0.9)', borderColor: 'rgba(30,144,255,0.3)', textStyle: { color: '#fff' } },
          legend: { type: 'scroll', orient: 'horizontal', bottom: 10, data: modelList, textStyle: { color: 'rgba(255,255,255,0.6)' } },
          grid: { left: '3%', right: '4%', bottom: '18%', top: 35, containLabel: true },
          xAxis: { type: 'category', data: times.map(formatDateLabel), axisLabel: { color: 'rgba(255,255,255,0.6)', rotate: 45 } },
          yAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.6)' } },
          series: modelList.map(m => ({ name: m, type: 'bar', stack: 'total', data: times.map(t => modelData[m][t] || 0), itemStyle: { color: modelToColor(m) } }))
        });
      }
      // 2. 调用趋势
      if (activeChartTab === '2' && chartData.call_trend?.length) {
        initOrUpdate('callTrend', getDom('dashboard-callTrend'), {
          backgroundColor: 'transparent',
          tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,14,39,0.9)', borderColor: 'rgba(30,144,255,0.3)', textStyle: { color: '#fff' } },
          grid: { left: '3%', right: '4%', bottom: '3%', top: 35, containLabel: true },
          xAxis: { type: 'category', data: chartData.call_trend.map(i => formatDateLabel(i.time)), axisLabel: { color: 'rgba(255,255,255,0.6)', rotate: 45 } },
          yAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.6)' } },
          series: [{ type: 'line', smooth: true, data: chartData.call_trend.map(i => i.count || 0), itemStyle: { color: '#1e90ff' }, areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(30,144,255,0.4)'},{offset:1,color:'rgba(30,144,255,0.05)'}]) } }]
        });
      }
      // 3. 调用次数分布
      if (activeChartTab === '3' && chartData.call_distribution?.length) {
        initOrUpdate('callDist', getDom('dashboard-callDist'), {
          backgroundColor: 'transparent',
          tooltip: { trigger: 'item', backgroundColor: 'rgba(10,14,39,0.9)', borderColor: 'rgba(30,144,255,0.3)', textStyle: { color: '#fff' } },
          legend: { orient: 'horizontal', bottom: 10, textStyle: { color: 'rgba(255,255,255,0.6)' } },
          series: [{ type: 'pie', radius: ['35%', '65%'], center: ['50%', '45%'], itemStyle: { borderRadius: 4, borderColor: '#0a0e27', borderWidth: 2 }, label: { show: false }, labelLine: { show: false }, data: chartData.call_distribution.map(i => ({ name: i.model, value: i.count || 0 })), color: pieColors }]
        });
      }
      // 4. 调用次数排行
      if (activeChartTab === '4' && chartData.call_rank?.length) {
        const data = [...chartData.call_rank].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 10);
        initOrUpdate('callRank', getDom('dashboard-callRank'), {
          backgroundColor: 'transparent',
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(10,14,39,0.9)', borderColor: 'rgba(30,144,255,0.3)', textStyle: { color: '#fff' } },
          grid: { left: '3%', right: '10%', bottom: '3%', top: 10, containLabel: true },
          xAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.6)' } },
          yAxis: { type: 'category', data: data.map(i => i.model), axisLabel: { color: 'rgba(255,255,255,0.6)' } },
          series: [{ type: 'bar', data: data.map((i, idx) => ({ value: i.count || 0, itemStyle: { color: pieColors[idx % pieColors.length] } })) }]
        });
      }
      // 5. 用户消耗排行
      if (activeChartTab === '5' && chartData.user_quota_rank?.length) {
        const data = [...chartData.user_quota_rank].sort((a, b) => (b.raw_quota || 0) - (a.raw_quota || 0)).slice(0, 10);
        initOrUpdate('userQuotaRank', getDom('dashboard-userQuotaRank'), {
          backgroundColor: 'transparent',
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(10,14,39,0.9)', borderColor: 'rgba(30,144,255,0.3)', textStyle: { color: '#fff' } },
          grid: { left: '3%', right: '10%', bottom: '3%', top: 10, containLabel: true },
          xAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.6)' } },
          yAxis: { type: 'category', data: data.map(i => i.user || i.username || '未知用户'), axisLabel: { color: 'rgba(255,255,255,0.6)' } },
          series: [{ type: 'bar', data: data.map((i, idx) => ({ value: i.raw_quota || 0, itemStyle: { color: pieColors[idx % pieColors.length] } })) }]
        });
      }
      // 6. 用户消耗趋势
      if (activeChartTab === '6' && chartData.user_quota_trend?.length) {
        const userMap = {};
        chartData.user_quota_trend.forEach(i => { if (!userMap[i.user]) userMap[i.user] = {}; userMap[i.user][i.time] = i.raw_quota || 0; });
        const users = Object.keys(userMap).slice(0, 5);
        const timeSet = new Set();
        chartData.user_quota_trend.forEach(i => timeSet.add(i.time));
        const times = Array.from(timeSet).sort();
        initOrUpdate('userQuotaTrend', getDom('dashboard-userQuotaTrend'), {
          backgroundColor: 'transparent',
          tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,14,39,0.9)', borderColor: 'rgba(30,144,255,0.3)', textStyle: { color: '#fff' } },
          legend: { data: users, top: 5, textStyle: { color: 'rgba(255,255,255,0.6)' } },
          grid: { left: '3%', right: '4%', bottom: '3%', top: 35, containLabel: true },
          xAxis: { type: 'category', data: times.map(formatDateLabel), axisLabel: { color: 'rgba(255,255,255,0.6)', rotate: 45 } },
          yAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.6)' } },
          series: users.map((u, idx) => ({ name: u, type: 'line', smooth: true, data: times.map(t => userMap[u][t] || 0), itemStyle: { color: pieColors[idx % pieColors.length] }, areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:pieColors[idx % pieColors.length]+'66'},{offset:1,color:pieColors[idx % pieColors.length]+'0D'}]) } }))
        });
      }
    }

    // 调整所有图表尺寸
    Object.values(ref).forEach(chart => { if (chart?.resize) chart.resize(); });
  }, [isDashboardMode, usersTrend, usersAuthDist, topupTrend, topupUserTypeDist, consumptionTrend, userAgentDist, revenueTrend, paymentModeRevenueDist, supplierTrend, supplierDist, chartData, activeChartTab, t, usersTrendMetric, trendMetric, supplierTrendMetric]);

  // 大屏模式激活时渲染图表
  useEffect(() => {
    if (!isDashboardMode) return;
    // 等待 DOM 渲染完成
    const timer = setTimeout(() => {
      renderDashboardChart();
    }, 200);
    return () => clearTimeout(timer);
  }, [isDashboardMode, renderDashboardChart]);

  // 数据变化时重新渲染大屏图表
  useEffect(() => {
    if (!isDashboardMode) return;
    const timer = setTimeout(() => {
      renderDashboardChart();
    }, 100);
    return () => clearTimeout(timer);
  }, [usersTrend, usersAuthDist, topupTrend, topupUserTypeDist, consumptionTrend, userAgentDist, revenueTrend, paymentModeRevenueDist, supplierTrend, supplierDist, chartData, activeChartTab, renderDashboardChart]);

  // 退出大屏模式时清理图表实例
  useEffect(() => {
    if (isDashboardMode) return;
    const ref = dashboardChartsRef.current;
    Object.values(ref).forEach(chart => { if (chart?.dispose) chart.dispose(); });
    Object.keys(ref).forEach(k => { ref[k] = null; });
  }, [isDashboardMode]);

  // 窗口大小变化时调整大屏图表
  useEffect(() => {
    if (!isDashboardMode) return;
    const handleResize = () => {
      const ref = dashboardChartsRef.current;
      Object.values(ref).forEach(chart => { if (chart?.resize) chart.resize(); });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isDashboardMode]);

  // 性能指标文字（右上角独立显示）
  const performanceIndicatorsText = (
    <div style={{
      display: 'flex',
      gap: 16,
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginBottom: 12,
      fontSize: 13,
    }}>
      <span style={{
        color: 'rgba(0, 0, 0, 0.5)',
        fontSize: 12,
      }}>{t('平均RPM')}:</span>
      <span style={{
        fontSize: 18,
        fontWeight: 600,
        color: '#6366f1',
      }}>
        {statsLoading ? <Spin size="small" /> : (dashboardStats.avg_rpm?.toFixed(2) || '0')}
      </span>
      <span style={{
        color: 'rgba(0, 0, 0, 0.35)',
        fontSize: 12,
      }}>{t('请求/分钟')}</span>
      <span style={{
        color: 'rgba(0, 0, 0, 0.2)',
        margin: '0 8px',
      }}>|</span>
      <span style={{
        color: 'rgba(0, 0, 0, 0.5)',
        fontSize: 12,
      }}>{t('平均TPM')}:</span>
      <span style={{
        fontSize: 18,
        fontWeight: 600,
        color: '#f97316',
      }}>
        {statsLoading ? <Spin size="small" /> : (dashboardStats.avg_tpm?.toFixed(2) || '0')}
      </span>
      <span style={{
        color: 'rgba(0, 0, 0, 0.35)',
        fontSize: 12,
      }}>{t('Tokens/分钟')}</span>
    </div>
  );

  // 顶部统计卡片（8个指标）
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
        title={t('最近7天充值金额')}
        color="#52c41a"
        icon={<IconMoneyExchangeStroked style={{ fontSize: 24 }} />}
      >
        {statsLoading ? <Spin size="small" /> : formatMoney(dashboardStats.week_topup_amount)}
      </StatCard>
      <StatCard
        title={t('最近7天模型请求次数')}
        color="#722ed1"
        icon={<IconClockStroked style={{ fontSize: 24 }} />}
      >
        {statsLoading ? <Spin size="small" /> : (dashboardStats.week_token_calls?.toLocaleString() || 0)}
      </StatCard>
      <StatCard
        title={t('最近7天营业收入')}
        color="#1890ff"
        icon={<IconCoinMoneyStroked style={{ fontSize: 24 }} />}
      >
        {statsLoading ? <Spin size="small" /> : formatMoney(dashboardStats.week_revenue)}
      </StatCard>
      <StatCard
        title={t('最近7天调用次数最多模型')}
        color="#722ed1"
        icon={<IconClockStroked style={{ fontSize: 24 }} />}
      >
        <div style={{ marginBottom: 4 }}>
          <div style={{
            fontSize: 16,
            fontWeight: 500,
            color: '#722ed1',
          }}>
            {statsLoading ? <Spin size="small" /> : (dashboardStats.top_model_name || '-')}
          </div>
          <div style={{
            fontSize: 11,
            color: 'rgba(0, 0, 0, 0.35)',
          }}>
            {t('调用次数')}: {statsLoading ? <Spin size="small" /> : (dashboardStats.top_model_call_count?.toLocaleString() || 0)}
          </div>
        </div>
      </StatCard>
    </div>
  );

  // 最近7天调用次数最多模型面板
  const topModelCard = (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius: 4,
      padding: '20px',
      flex: 1,
      minWidth: 200,
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
            marginBottom: 8,
          }}>{t('最近7天调用次数最多模型')}</div>
          <div style={{
            fontSize: 20,
            fontWeight: 500,
            color: '#722ed1',
            lineHeight: 1.25,
            letterSpacing: '-0.16px',
            marginBottom: 4,
          }}>
            {statsLoading ? <Spin size="small" /> : (dashboardStats.top_model_name || '-')}
          </div>
          <div style={{
            color: 'rgba(0, 0, 0, 0.3)',
            fontSize: 11,
          }}>
            {t('调用次数')}: {statsLoading ? <Spin size="small" /> : (dashboardStats.top_model_call_count?.toLocaleString() || 0)}
          </div>
        </div>
      </div>
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
        <Button
          type='secondary'
          theme='solid'
          onClick={() => setIsDashboardMode(true)}
          style={{
            borderRadius: 4,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            color: '#fff',
          }}
        >
          🖥️ {t('大屏模式')}
        </Button>
      </div>
    </div>
  );

  // 大屏模式：暗色主题指标切换按钮组
  // options: [{ key, label }], activeKey: 当前选中项, onSelect: 切换回调
  const renderDashboardMetricSwitch = (options, activeKey, onSelect) => (
    <div style={{
      position: 'absolute',
      right: 16,
      top: 12,
      zIndex: 10,
      display: 'flex',
      gap: 4,
      background: 'rgba(10, 14, 39, 0.6)',
      border: '1px solid rgba(30, 144, 255, 0.2)',
      borderRadius: 6,
      padding: 3,
      backdropFilter: 'blur(8px)',
    }}>
      {options.map(opt => (
        <button
          key={opt.key}
          onClick={() => onSelect(opt.key)}
          style={{
            background: activeKey === opt.key
              ? 'linear-gradient(135deg, rgba(30, 144, 255, 0.9) 0%, rgba(0, 191, 255, 0.9) 100%)'
              : 'transparent',
            border: 'none',
            color: activeKey === opt.key ? '#fff' : 'rgba(255, 255, 255, 0.55)',
            fontSize: 11,
            fontWeight: activeKey === opt.key ? 600 : 400,
            padding: '4px 10px',
            borderRadius: 4,
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            boxShadow: activeKey === opt.key ? '0 0 12px rgba(30, 144, 255, 0.4)' : 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  // 数据加载中占位组件
  const LoadingPlaceholder = ({ loading, title }) => {
    if (!loading) return null;
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 240,
        color: 'rgba(0, 0, 0, 0.35)',
        fontSize: 14,
        gap: 12,
      }}>
        <Spin size="small" />
        <span>{t('数据加载中')}</span>
      </div>
    );
  };

  // 渲染图表行（3:1 双列布局）
  const renderChartRow = (leftTitle, leftData, leftValueKey, leftUnit, rightTitle, rightData, rightIsPie = true) => {
    // 判断左侧是否需要显示加载占位
    const leftLoading =
      (leftTitle === '注册用户趋势' && userLoading) ||
      (leftTitle === '有效充值趋势' && topupLoading) ||
      (leftTitle === '渠道消费趋势' && supplierLoading);
    
    // 判断右侧是否需要显示加载占位
    const rightLoading =
      (rightTitle === '用户认证占比' && userLoading) ||
      (rightTitle === '用户充值分布' && topupLoading) ||
      (rightTitle === '渠道消费占比' && supplierLoading);

    return (
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{
          flex: 3,
          backgroundColor: '#ffffff',
          borderRadius: 4,
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: 'rgba(1, 1, 32, 0.1) 0px 4px 10px',
          padding: '16px',
          minHeight: 280,
          position: 'relative',
        }}>
          {leftTitle === '有效充值趋势' ? (
            <div style={{ position: 'relative' }}>
              <LoadingPlaceholder loading={topupLoading} title={leftTitle} />
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
              <LoadingPlaceholder loading={userLoading} title={leftTitle} />
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
              <LoadingPlaceholder loading={supplierLoading} title={leftTitle} />
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
          position: 'relative',
        }}>
          <LoadingPlaceholder loading={rightLoading} title={rightTitle} />
          <div ref={rightTitle === '用户认证占比' ? authDistChartRef :
                         rightTitle === '用户充值分布' ? topupDistChartRef :
                         rightTitle === '付费方式tokens分布' ? paymentModeTokensChartRef :
                         rightTitle === '付费方式收入占比' ? revenuePieChartRef :
                         rightTitle === '渠道消费占比' ? supplierDistChartRef : null}
                style={{ width: '100%', height: 240 }} />
        </div>
      </div>
    );
  };

  // 加载状态
  const loadingOverlay = (statsLoading || chartLoading) && (
    <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
      <Spin size="large" />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 性能指标文字（右上角独立显示） */}
      {performanceIndicatorsText}

      {/* 顶部统计卡片（8个指标） */}
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
            {/* 加载占位 */}
            {consumptionLoading && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'rgba(0, 0, 0, 0.35)',
                fontSize: 14,
                gap: 12,
              }}>
                <Spin size="small" />
                <span>{t('数据加载中')}</span>
              </div>
            )}
            {/* 1. 消耗分布 - 堆叠柱状图 */}
            {activeChartTab === '1' && !consumptionLoading && (
              <div ref={quotaDistChartRef} style={{ width: '100%', height: '100%' }} />
            )}
            {/* 2. 调用趋势 - 折线图 */}
            {activeChartTab === '2' && !consumptionLoading && (
              <div ref={callTrendChartRef} style={{ width: '100%', height: '100%' }} />
            )}
            {/* 3. 调用次数分布 - 环形饼图 */}
            {activeChartTab === '3' && !consumptionLoading && (
              <div ref={callDistChartRef} style={{ width: '100%', height: '100%' }} />
            )}
            {/* 4. 调用次数排行 - 水平柱状图 */}
            {activeChartTab === '4' && !consumptionLoading && (
              <div ref={callRankChartRef} style={{ width: '100%', height: '100%' }} />
            )}
            {/* 5. 用户消耗排行 - 水平柱状图 */}
            {activeChartTab === '5' && !consumptionLoading && (
              <div ref={userQuotaRankChartRef} style={{ width: '100%', height: '100%' }} />
            )}
            {/* 6. 用户消耗趋势 - 面积图 */}
            {activeChartTab === '6' && !consumptionLoading && (
              <div ref={userQuotaTrendChartRef} style={{ width: '100%', height: '100%' }} />
            )}
            {/* 暂无数据提示 */}
            {!consumptionLoading && activeChartTab && chartData && !(() => {
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
        {/* 右侧：客户端 User-Agent 分布饼图（1/4 宽度） */}
        <div style={{
          flex: 1,
          backgroundColor: '#ffffff',
          borderRadius: 4,
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: 'rgba(1, 1, 32, 0.1) 0px 4px 10px',
          padding: '16px',
          minHeight: 400,
          position: 'relative',
        }}>
          {/* 加载占位 */}
          {consumptionLoading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 320,
              color: 'rgba(0, 0, 0, 0.35)',
              fontSize: 14,
              gap: 12,
            }}>
              <Spin size="small" />
              <span>{t('数据加载中')}</span>
            </div>
          )}
          {!consumptionLoading && <div ref={paymentModeTokensChartRef} style={{ width: '100%', height: 320 }} />}
          {/* 暂无数据提示 */}
          {!consumptionLoading && userAgentDist.length === 0 && !chartLoading && (
            <Empty
              image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
              darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
              description={t('暂无客户端数据')}
              style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
            />
          )}
        </div>
      </div>

      {/* 第四排：营收趋势（含统计指标 + 折线图） + 饼图 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        {/* 营收趋势（按量付费 + 订阅套餐） */}
        <div style={{
          flex: 3,
          backgroundColor: '#ffffff',
          borderRadius: 4,
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: 'rgba(1, 1, 32, 0.1) 0px 4px 10px',
          padding: '24px',
          position: 'relative',
        }}>
          {/* 加载占位 */}
          {revenueLoading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 300,
              color: 'rgba(0, 0, 0, 0.35)',
              fontSize: 14,
              gap: 12,
            }}>
              <Spin size="small" />
              <span>{t('数据加载中')}</span>
            </div>
          )}
          {/* 板块标签 */}
          {!revenueLoading && <div style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'rgba(0, 0, 0, 0.4)',
            fontFamily: 'PP Neue Montreal Mono, Georgia, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.055px',
            marginBottom: 20,
          }}>{t('营收趋势')}</div>}
          
          {/* 营收统计指标 */}
          {!revenueLoading && <div style={{
            display: 'flex',
            gap: 24,
            marginBottom: 20,
            flexWrap: 'wrap',
          }}>
            <div>
              <div style={{
                fontSize: 10,
                fontWeight: 500,
                color: 'rgba(0, 0, 0, 0.4)',
                fontFamily: 'PP Neue Montreal Mono, Georgia, sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.05px',
                marginBottom: 4,
              }}>{t('总收入')}</div>
              <div style={{
                fontSize: 28,
                fontWeight: 400,
                color: '#000000',
                fontFamily: 'The Future, Arial, sans-serif',
                lineHeight: 1.1,
                letterSpacing: '-0.42px',
              }}>¥{revenueStats.total.toLocaleString()}</div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(0, 0, 0, 0.08)', paddingLeft: 24 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 500,
                color: 'rgba(0, 0, 0, 0.4)',
                fontFamily: 'PP Neue Montreal Mono, Georgia, sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.05px',
                marginBottom: 4,
              }}>{t('按量付费')}</div>
              <div style={{
                fontSize: 20,
                fontWeight: 400,
                color: '#52c41a',
                fontFamily: 'The Future, Arial, sans-serif',
                lineHeight: 1.2,
                letterSpacing: '-0.16px',
              }}>¥{revenueStats.pay_as_you_go.toLocaleString()}</div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(0, 0, 0, 0.08)', paddingLeft: 24 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 500,
                color: 'rgba(0, 0, 0, 0.4)',
                fontFamily: 'PP Neue Montreal Mono, Georgia, sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.05px',
                marginBottom: 4,
              }}>{t('订阅套餐')}</div>
              <div style={{
                fontSize: 20,
                fontWeight: 400,
                color: '#722ed1',
                fontFamily: 'The Future, Arial, sans-serif',
                lineHeight: 1.2,
                letterSpacing: '-0.16px',
              }}>¥{revenueStats.subscription.toLocaleString()}</div>
            </div>
          </div>}
          
          {/* 折线图 */}
          {!revenueLoading && <div ref={revenueTrendChartRef} style={{ width: '100%', height: 240 }} />}
        </div>
        {/* 付费方式收入对比柱状图 */}
        <div style={{
          flex: 1,
          backgroundColor: '#ffffff',
          borderRadius: 4,
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: 'rgba(1, 1, 32, 0.1) 0px 4px 10px',
          padding: '24px',
          minHeight: 400,
          position: 'relative',
        }}>
          {/* 加载占位 */}
          {revenueLoading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 320,
              color: 'rgba(0, 0, 0, 0.35)',
              fontSize: 14,
              gap: 12,
            }}>
              <Spin size="small" />
              <span>{t('数据加载中')}</span>
            </div>
          )}
          {!revenueLoading && <div ref={revenuePieChartRef} style={{ width: '100%', height: 320 }} />}
        </div>
      </div>

      {/* 第五排：渠道消费 */}
      {renderChartRow(
        t('渠道消费趋势'), null, null, null,
        t('渠道消费占比'), null
      )}

      {/* ========== 大屏模式覆盖层 ========== */}
      {isDashboardMode && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          background: 'linear-gradient(135deg, #0a0e27 0%, #1a1c3a 40%, #0f1429 100%)',
          zIndex: 10000,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'dashboard-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {/* 粒子背景 */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'hidden',
          }}>
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                width: `${2 + Math.random() * 3}px`,
                height: `${2 + Math.random() * 3}px`,
                background: `rgba(${30 + Math.random() * 30}, ${144 + Math.random() * 30}, ${255}, ${0.3 + Math.random() * 0.4})`,
                borderRadius: '50%',
                left: `${Math.random() * 100}%`,
                animation: `float-up ${8 + Math.random() * 12}s linear infinite`,
                animationDelay: `${-Math.random() * 20}s`,
              }} />
            ))}
          </div>

          {/* 网格背景 */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundImage: `
              linear-gradient(rgba(30, 144, 255, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(30, 144, 255, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
            pointerEvents: 'none',
          }} />

          {/* 顶部栏 */}
          <div style={{
            position: 'relative',
            zIndex: 100,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 40px',
            background: 'linear-gradient(180deg, rgba(10, 14, 39, 0.95) 0%, rgba(10, 14, 39, 0) 100%)',
            borderBottom: '1px solid rgba(30, 144, 255, 0.2)',
          }}>
            <div style={{
              fontSize: '28px',
              fontWeight: '600',
              background: 'linear-gradient(90deg, #1e90ff, #00bfff, #1e90ff)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'text-shine 3s linear infinite',
              letterSpacing: '3px',
            }}>
              📊 {t('财务运营数据大屏')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{
                fontSize: '16px',
                color: 'rgba(255, 255, 255, 0.7)',
                fontFamily: "'Courier New', monospace",
              }}>
                {currentTime.toLocaleTimeString('zh-CN', { hour12: false })}
              </div>
              {/* 性能指标：平均 RPM / TPM */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '6px 16px',
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '20px',
                fontSize: '13px',
              }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>{t('平均RPM')}</span>
                <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#818cf8', textShadow: '0 0 10px rgba(99, 102, 241, 0.5)' }}>
                  {dashboardStats.avg_rpm?.toFixed(2) || '0'}
                </span>
                <span style={{ color: 'rgba(255, 255, 255, 0.35)', fontSize: 11 }}>{t('请求/分钟')}</span>
                <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>|</span>
                <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>{t('平均TPM')}</span>
                <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#fb923c', textShadow: '0 0 10px rgba(249, 115, 22, 0.5)' }}>
                  {dashboardStats.avg_tpm?.toFixed(2) || '0'}
                </span>
                <span style={{ color: 'rgba(255, 255, 255, 0.35)', fontSize: 11 }}>{t('Tokens/分钟')}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px',
                background: 'rgba(30, 144, 255, 0.1)',
                border: '1px solid rgba(30, 144, 255, 0.3)',
                borderRadius: '20px',
                color: '#1e90ff',
                fontSize: '13px',
              }}>
                <span>{t('自动刷新')}</span>
                <span style={{
                  fontWeight: 'bold',
                  fontSize: '16px',
                  minWidth: '24px',
                  textAlign: 'center',
                }}>{countdown}</span>
                <span>{t('秒')}</span>
              </div>
            </div>
          </div>

          {/* 内容区域 */}
          <div style={{
            position: 'relative',
            zIndex: 10,
            flex: 1,
            padding: '20px 40px',
            overflowY: 'auto',
          }}>
            {/* 全局指标 - 放大版 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '20px',
              marginBottom: '24px',
            }}>
              {[
                { label: t('总用户数'), value: dashboardStats.total_users?.toLocaleString() || 0, color: '#1e90ff' },
                { label: t('有效充值金额'), value: formatMoney(dashboardStats.total_effective_topup), color: '#52c41a' },
                { label: t('成功订单数'), value: dashboardStats.success_order_count?.toLocaleString() || 0, color: '#1e90ff' },
                { label: t('模型请求次数'), value: dashboardStats.total_token_calls?.toLocaleString() || 0, color: '#722ed1' },
                { label: t('最近7天充值'), value: formatMoney(dashboardStats.week_topup_amount), color: '#52c41a' },
                { label: t('最近7天请求'), value: dashboardStats.week_token_calls?.toLocaleString() || 0, color: '#722ed1' },
                { label: t('最近7天营收'), value: formatMoney(dashboardStats.week_revenue), color: '#1e90ff' },
                { label: t('热门模型'), value: dashboardStats.top_model_name || '-', color: '#722ed1' },
              ].map((item, i) => (
                <div key={i} style={{
                  position: 'relative',
                  background: 'rgba(20, 24, 52, 0.7)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(30, 144, 255, 0.15)',
                  borderRadius: '12px',
                  padding: '24px',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(30, 144, 255, 0.4)';
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(30, 144, 255, 0.15), inset 0 0 30px rgba(30, 144, 255, 0.05)';
                  e.currentTarget.style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(30, 144, 255, 0.15)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: 'linear-gradient(90deg, #1e90ff, #00bfff, #722ed1)',
                  }} />
                  <div style={{
                    position: 'absolute',
                    top: '-100px',
                    right: '-100px',
                    width: '200px',
                    height: '200px',
                    background: 'radial-gradient(circle, rgba(30, 144, 255, 0.08) 0%, transparent 70%)',
                    pointerEvents: 'none',
                  }} />
                  <div style={{
                    fontSize: '13px',
                    color: 'rgba(255, 255, 255, 0.5)',
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                  }}>{item.label}</div>
                  <div style={{
                    fontSize: '36px',
                    fontWeight: '700',
                    color: '#fff',
                    textShadow: `0 0 20px ${item.color}80`,
                    transition: 'all 0.3s',
                    className: dataFlash ? 'data-flash' : '',
                  }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* 图表区域 - 使用独立 DOM id */}
            {/* 第一排：用户趋势 + 用户认证占比 */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              <div style={{ flex: 3, position: 'relative', background: 'rgba(20, 24, 52, 0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(30, 144, 255, 0.15)', borderRadius: '12px', padding: '24px', minHeight: '350px' }}>
                {renderDashboardMetricSwitch(
                  [
                    { key: 'daily', label: t('每日注册用户数') },
                    { key: 'cumulative', label: t('累计注册用户数') },
                  ],
                  usersTrendMetric,
                  setUsersTrendMetric
                )}
                <div id="dashboard-usersTrend" style={{ width: '100%', height: '300px' }} />
              </div>
              <div style={{ flex: 1, background: 'rgba(20, 24, 52, 0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(30, 144, 255, 0.15)', borderRadius: '12px', padding: '24px', minHeight: '350px' }}>
                <div id="dashboard-authDist" style={{ width: '100%', height: '300px' }} />
              </div>
            </div>

            {/* 第二排：充值趋势 + 用户充值分布 */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              <div style={{ flex: 3, position: 'relative', background: 'rgba(20, 24, 52, 0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(30, 144, 255, 0.15)', borderRadius: '12px', padding: '24px', minHeight: '350px' }}>
                {renderDashboardMetricSwitch(
                  [
                    { key: 'amount', label: t('充值金额') },
                    { key: 'count', label: t('订单数') },
                    { key: 'cumulative', label: t('累计充值') },
                  ],
                  trendMetric,
                  setTrendMetric
                )}
                <div id="dashboard-topupTrend" style={{ width: '100%', height: '300px' }} />
              </div>
              <div style={{ flex: 1, background: 'rgba(20, 24, 52, 0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(30, 144, 255, 0.15)', borderRadius: '12px', padding: '24px', minHeight: '350px' }}>
                <div id="dashboard-topupDist" style={{ width: '100%', height: '300px' }} />
              </div>
            </div>

            {/* 第三排：消费趋势 Tabs + 客户端分布 */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              <div style={{ flex: 3, position: 'relative', background: 'rgba(20, 24, 52, 0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(30, 144, 255, 0.15)', borderRadius: '12px', padding: '24px', minHeight: '450px' }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontFamily: "'PP Neue Montreal Mono', Georgia, sans-serif",
                  textTransform: 'uppercase',
                  letterSpacing: '0.055px',
                  marginBottom: '16px',
                }}>{t('消费趋势')}</div>
                {renderDashboardMetricSwitch(
                  [
                    { key: '1', label: t('消耗分布') },
                    { key: '2', label: t('调用趋势') },
                    { key: '3', label: t('调用次数分布') },
                    { key: '4', label: t('调用次数排行') },
                    { key: '5', label: t('用户消耗排行') },
                    { key: '6', label: t('用户消耗趋势') },
                  ],
                  activeChartTab,
                  setActiveChartTab
                )}
                <div style={{ height: '410px', width: '100%', position: 'relative' }}>
                  {activeChartTab === '1' && <div id="dashboard-quotaDist" style={{ width: '100%', height: '100%' }} />}
                  {activeChartTab === '2' && <div id="dashboard-callTrend" style={{ width: '100%', height: '100%' }} />}
                  {activeChartTab === '3' && <div id="dashboard-callDist" style={{ width: '100%', height: '100%' }} />}
                  {activeChartTab === '4' && <div id="dashboard-callRank" style={{ width: '100%', height: '100%' }} />}
                  {activeChartTab === '5' && <div id="dashboard-userQuotaRank" style={{ width: '100%', height: '100%' }} />}
                  {activeChartTab === '6' && <div id="dashboard-userQuotaTrend" style={{ width: '100%', height: '100%' }} />}
                </div>
              </div>
              <div style={{ flex: 1, background: 'rgba(20, 24, 52, 0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(30, 144, 255, 0.15)', borderRadius: '12px', padding: '24px', minHeight: '450px' }}>
                <div id="dashboard-paymentModeTokens" style={{ width: '100%', height: '410px' }} />
              </div>
            </div>

            {/* 第四排：营收趋势 + 付费方式收入对比 */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              <div style={{ flex: 3, background: 'rgba(20, 24, 52, 0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(30, 144, 255, 0.15)', borderRadius: '12px', padding: '24px' }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontFamily: "'PP Neue Montreal Mono', Georgia, sans-serif",
                  textTransform: 'uppercase',
                  letterSpacing: '0.055px',
                  marginBottom: '16px',
                }}>{t('营收趋势')}</div>
                <div id="dashboard-revenueTrend" style={{ width: '100%', height: '300px' }} />
              </div>
              <div style={{ flex: 1, background: 'rgba(20, 24, 52, 0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(30, 144, 255, 0.15)', borderRadius: '12px', padding: '24px', minHeight: '400px' }}>
                <div id="dashboard-revenuePie" style={{ width: '100%', height: '320px' }} />
              </div>
            </div>

            {/* 第五排：渠道消费趋势 + 渠道消费占比 */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              <div style={{ flex: 3, position: 'relative', background: 'rgba(20, 24, 52, 0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(30, 144, 255, 0.15)', borderRadius: '12px', padding: '24px', minHeight: '350px' }}>
                {renderDashboardMetricSwitch(
                  [
                    { key: 'tokens', label: t('消耗Tokens') },
                    { key: 'count', label: t('请求次数') },
                    { key: 'cost', label: t('消费金额') },
                    { key: 'cumulative', label: t('累计消费') },
                  ],
                  supplierTrendMetric,
                  setSupplierTrendMetric
                )}
                <div id="dashboard-supplierTrend" style={{ width: '100%', height: '300px' }} />
              </div>
              <div style={{ flex: 1, background: 'rgba(20, 24, 52, 0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(30, 144, 255, 0.15)', borderRadius: '12px', padding: '24px', minHeight: '350px' }}>
                <div id="dashboard-supplierDist" style={{ width: '100%', height: '300px' }} />
              </div>
            </div>
          </div>

          {/* 刷新提示 */}
          {dataFlash && (
            <div style={{
              position: 'fixed',
              top: '70px',
              right: '220px',
              zIndex: 10001,
              padding: '10px 20px',
              background: 'rgba(82, 196, 26, 0.15)',
              border: '1px solid rgba(82, 196, 26, 0.4)',
              borderRadius: '8px',
              color: '#52c41a',
              fontSize: '14px',
              animation: 'fadeInOut 1s ease-out',
              backdropFilter: 'blur(10px)',
            }}>
              ✓ {t('数据已刷新')}
            </div>
          )}

          {/* 动画样式 */}
          <style>{`
            @keyframes dashboard-enter {
              0% { opacity: 0; transform: scale(0.92); filter: blur(10px); }
              100% { opacity: 1; transform: scale(1); filter: blur(0); }
            }
            @keyframes float-up {
              0% { transform: translateY(100vh) translateX(0) scale(0); opacity: 0; }
              10% { opacity: 1; transform: translateY(90vh) translateX(10px) scale(1); }
              90% { opacity: 0.8; }
              100% { transform: translateY(-10vh) translateX(-20px) scale(0.5); opacity: 0; }
            }
            @keyframes text-shine {
              0% { background-position: 0% center; }
              100% { background-position: 200% center; }
            }
            @keyframes flash {
              0% { text-shadow: 0 0 30px rgba(30, 144, 255, 0.9); filter: brightness(1.5); }
              100% { text-shadow: none; filter: brightness(1); }
            }
            @keyframes fadeInOut {
              0% { opacity: 0; transform: translateX(20px); }
              20% { opacity: 1; transform: translateX(0); }
              80% { opacity: 1; transform: translateX(0); }
              100% { opacity: 0; transform: translateX(20px); }
            }
            .data-flash {
              animation: flash 0.6s ease-out;
            }
            /* 自定义滚动条 */
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.03); }
            ::-webkit-scrollbar-thumb { background: rgba(30, 144, 255, 0.3); border-radius: 3px; }
            ::-webkit-scrollbar-thumb:hover { background: rgba(30, 144, 255, 0.5); }
          `}</style>
        </div>
      )}
    </div>
  );
}

