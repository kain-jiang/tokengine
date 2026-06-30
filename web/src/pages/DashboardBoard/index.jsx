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

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as echarts from 'echarts';
import { VChart } from '@visactor/react-vchart';
import { Tabs, TabPane } from '@douyinfe/semi-ui';
import { API, showError, modelColorMap, renderNumber, renderQuota } from '../../helpers';
import { useTranslation } from 'react-i18next';

// 大屏样式 - 企业级专业风格
const boardStyles = {
  // 全屏容器 - 午夜蓝深色背景
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: '#010120',
    color: '#ffffff',
    fontFamily: "'The Future', Arial, sans-serif",
    overflow: 'hidden',
    zIndex: 9999,
  },
  // 头部样式 - 简洁企业风格
  header: {
    height: '70px',
    background: '#010120',
    borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 30px',
    position: 'relative',
  },
  headerTitle: {
    fontSize: '24px',
    fontWeight: 500,
    color: '#ffffff',
    letterSpacing: '-0.42px',
    flex: 1,
    textAlign: 'center',
  },
  headerMeta: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 1.8,
    fontFamily: "'PP Neue Montreal Mono', monospace",
    letterSpacing: '0.08px',
    textTransform: 'uppercase',
  },
  headerMetaVal: {
    color: '#ffffff',
    fontWeight: 500,
  },
  statusDot: {
    width: '8px',
    height: '8px',
    background: '#bdbbff',
    borderRadius: '4px',
  },
  // 主内容区
  main: {
    padding: '16px',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    height: 'calc(100vh - 70px)',
    overflow: 'auto',
  },
  // 面板样式 - 企业级卡片
  panel: {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '8px',
    position: 'relative',
    overflow: 'hidden',
  },
  panelTitle: {
    padding: '16px 20px 12px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#ffffff',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    letterSpacing: '-0.22px',
    fontFamily: "'The Future', Arial, sans-serif",
  },
  panelBody: {
    padding: '16px 20px',
  },
  // KPI卡片
  kpiMini: {
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '4px',
    padding: '12px 16px',
    textAlign: 'center',
  },
  bigNum: {
    fontWeight: 500,
    fontFamily: "'The Future', Arial, sans-serif",
    lineHeight: 1.1,
    letterSpacing: '-0.22px',
  },
  label: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: '4px',
    letterSpacing: '0.055px',
    fontFamily: "'PP Neue Montreal Mono', monospace",
    textTransform: 'uppercase',
  },
  // 颜色变量 - 企业级配色
  colors: {
    primary: '#bdbbff',
    secondary: '#ffffff',
    accent: '#ffffff',
    success: '#00c853',
    warning: '#ffc107',
    error: '#ff5252',
    white: '#ffffff',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.6)',
    textDim: 'rgba(255, 255, 255, 0.35)',
  },
  // 跨列设置
  span2: { gridColumn: 'span 2' },
  span3: { gridColumn: 'span 3' },
  span4: { gridColumn: 'span 4' },
  // Flex布局
  flexRow: {
    display: 'flex',
    gap: '12px',
  },
  flex1: { flex: 1 },
  flexCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
};

// 数字格式化函数
const formatNumber = (num, decimals = 2) => {
  if (num === undefined || num === null) return '--';
  if (num >= 1000000) return (num / 1000000).toFixed(decimals) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(decimals) + 'K';
  return num.toFixed(decimals);
};

// 配额转换为Token（假设每配额单位 = 500 token）
const quotaToToken = (quota) => {
  if (!quota) return 0;
  return Math.floor(quota / 500);
};

// 计算总配额
const getTotalQuota = (data) => {
  if (!data || !Array.isArray(data)) return 0;
  return data.reduce((sum, item) => sum + (item.RawQuota || item.quota || 0), 0);
};

// 计算总次数
const getTotalCount = (data) => {
  if (!data || !Array.isArray(data)) return 0;
  return data.reduce((sum, item) => sum + (item.Count || item.count || 0), 0);
};

// 计算用户总配额
const getTotalUserQuota = (data) => {
  if (!data || !Array.isArray(data)) return 0;
  return data.reduce((sum, item) => sum + (item.RawQuota || item.quota || 0), 0);
};

// 大屏页面组件
const DashboardBoard = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // 图表数据
  const [chartData, setChartData] = useState(null);
  const [activeChartTab, setActiveChartTab] = useState('1');

  // 图表引用
  const hourlyTrendChartRef = useRef(null);
  const dailyTrendChartRef = useRef(null);
  const topModelsChartRef = useRef(null);
  const topChannelsChartRef = useRef(null);
  const userGroupChartRef = useRef(null);

  // 图表实例
  const hourlyTrendChart = useRef(null);
  const dailyTrendChart = useRef(null);
  const topModelsChart = useRef(null);
  const topChannelsChart = useRef(null);
  const userGroupChart = useRef(null);

  // 获取统计数据
  const fetchStats = useCallback(async () => {
    try {
      const response = await API.get('/api/dashboard/board/stats');
      if (response.data.success) {
        setStats(response.data.data);
        setLoading(false);
      } else {
        showError(response.data.message);
      }
    } catch (error) {
      showError('获取大屏数据失败');
      console.error(error);
    }
  }, []);

  // 获取图表数据
  const fetchChartData = useCallback(async () => {
    try {
      // 获取近7天数据
      const now = new Date();
      const startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const response = await API.get('/api/dashboard/board/chart-data', {
        params: {
          start_timestamp: Math.floor(startTime.getTime() / 1000),
          end_timestamp: Math.floor(now.getTime() / 1000)
        }
      });
      if (response.data.success) {
        setChartData(response.data.data);
      } else {
        showError(response.data.message);
      }
    } catch (error) {
      showError('获取图表数据失败');
      console.error(error);
    }
  }, []);

  // 初始化和定时刷新
  useEffect(() => {
    fetchStats();
    fetchChartData();
    // 每30秒刷新数据
    const interval = setInterval(() => {
      fetchStats();
      fetchChartData();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchChartData]);

  // 更新时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 初始化图表
  useEffect(() => {
    if (!stats) return;

    // 小时趋势图
    if (hourlyTrendChartRef.current) {
      hourlyTrendChart.current = echarts.init(hourlyTrendChartRef.current);
      const hourlyOption = {
        tooltip: { trigger: 'axis' },
        grid: { left: '10%', right: '5%', top: '15%', bottom: '15%' },
        xAxis: {
          type: 'category',
          data: stats.hourly_trend?.map(h => `${h.hour}:00`) || [],
          axisLabel: { color: '#5b7daa', fontSize: 10 },
          axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.15)' } },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: '#5b7daa', fontSize: 10 },
          axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.15)' } },
          splitLine: { lineStyle: { color: '#0f2f5a', opacity: 0.3 } },
        },
        series: [
          {
            name: '请求次数',
            type: 'bar',
            data: stats.hourly_trend?.map(h => h.request_count) || [],
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#bdbbff' },
                { offset: 1, color: '#188df0' },
              ]),
            },
          },
        ],
      };
      hourlyTrendChart.current.setOption(hourlyOption);
    }

    // 每日趋势图
    if (dailyTrendChartRef.current) {
      dailyTrendChart.current = echarts.init(dailyTrendChartRef.current);
      const dailyOption = {
        tooltip: { trigger: 'axis' },
        legend: {
          data: ['请求次数', '新增用户', '充值金额'],
          textStyle: { color: '#5b7daa', fontSize: 10 },
          top: 5,
        },
        grid: { left: '10%', right: '5%', top: '20%', bottom: '15%' },
        xAxis: {
          type: 'category',
          data: stats.daily_trend?.map(d => d.date?.slice(5)) || [],
          axisLabel: { color: '#5b7daa', fontSize: 10 },
          axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.15)' } },
        },
        yAxis: [
          {
            type: 'value',
            name: '请求/用户',
            axisLabel: { color: '#5b7daa', fontSize: 10 },
            axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.15)' } },
            splitLine: { lineStyle: { color: '#0f2f5a', opacity: 0.3 } },
          },
          {
            type: 'value',
            name: '金额(元)',
            axisLabel: { color: '#5b7daa', fontSize: 10 },
            axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.15)' } },
          },
        ],
        series: [
          {
            name: '请求次数',
            type: 'line',
            smooth: true,
            data: stats.daily_trend?.map(d => d.request_count) || [],
            lineStyle: { color: '#bdbbff' },
            itemStyle: { color: '#bdbbff' },
          },
          {
            name: '新增用户',
            type: 'line',
            smooth: true,
            data: stats.daily_trend?.map(d => d.new_users) || [],
            lineStyle: { color: '#ffc107' },
            itemStyle: { color: '#ffc107' },
          },
          {
            name: '充值金额',
            type: 'line',
            smooth: true,
            yAxisIndex: 1,
            data: stats.daily_trend?.map(d => d.topup_amount) || [],
            lineStyle: { color: '#ffffff' },
            itemStyle: { color: '#ffffff' },
          },
        ],
      };
      dailyTrendChart.current.setOption(dailyOption);
    }

    // 热门模型饼图
    if (topModelsChartRef.current) {
      topModelsChart.current = echarts.init(topModelsChartRef.current);
      const modelsOption = {
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: {
          orient: 'vertical',
          right: 10,
          top: 'center',
          textStyle: { color: '#5b7daa', fontSize: 10 },
        },
        series: [
          {
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['40%', '50%'],
            data: stats.top_models?.map(m => ({ name: m.model_name, value: m.count })) || [],
            label: { show: false },
            itemStyle: {
              color: (params) => {
                const colors = ['#bdbbff', '#00c853', '#ffc107', '#ffffff', '#bdbbff'];
                return colors[params.dataIndex % colors.length];
              },
              borderColor: 'rgba(255, 255, 255, 0.15)',
              borderWidth: 1,
            },
          },
        ],
      };
      topModelsChart.current.setOption(modelsOption);
    }

    // 热门渠道饼图
    if (topChannelsChartRef.current) {
      topChannelsChart.current = echarts.init(topChannelsChartRef.current);
      const channelsOption = {
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: {
          orient: 'vertical',
          right: 10,
          top: 'center',
          textStyle: { color: '#5b7daa', fontSize: 10 },
        },
        series: [
          {
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['40%', '50%'],
            data: stats.top_channels?.map(c => ({ name: c.channel_name, value: c.count })) || [],
            label: { show: false },
            itemStyle: {
              color: (params) => {
                const colors = ['#ffc107', '#00c853', '#bdbbff', '#ffffff', '#bdbbff'];
                return colors[params.dataIndex % colors.length];
              },
              borderColor: 'rgba(255, 255, 255, 0.15)',
              borderWidth: 1,
            },
          },
        ],
      };
      topChannelsChart.current.setOption(channelsOption);
    }

    // 用户分组分布图
    if (userGroupChartRef.current) {
      userGroupChart.current = echarts.init(userGroupChartRef.current);
      const groupOption = {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '15%', right: '5%', top: '10%', bottom: '15%' },
        xAxis: {
          type: 'value',
          axisLabel: { color: '#5b7daa', fontSize: 10 },
          axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.15)' } },
          splitLine: { lineStyle: { color: '#0f2f5a', opacity: 0.3 } },
        },
        yAxis: {
          type: 'category',
          data: stats.user_group_distribution?.map(g => g.group_name) || [],
          axisLabel: { color: '#5b7daa', fontSize: 10 },
          axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.15)' } },
        },
        series: [
          {
            type: 'bar',
            data: stats.user_group_distribution?.map(g => g.user_count) || [],
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: '#00c853' },
                { offset: 1, color: '#bdbbff' },
              ]),
            },
          },
        ],
      };
      userGroupChart.current.setOption(groupOption);
    }

    // 窗口resize处理
    const handleResize = () => {
      hourlyTrendChart.current?.resize();
      dailyTrendChart.current?.resize();
      topModelsChart.current?.resize();
      topChannelsChart.current?.resize();
      userGroupChart.current?.resize();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      hourlyTrendChart.current?.dispose();
      dailyTrendChart.current?.dispose();
      topModelsChart.current?.dispose();
      topChannelsChart.current?.dispose();
      userGroupChart.current?.dispose();
    };
  }, [stats]);

  // 格式化时间
  const formatTime = (date) => {
    return date.toLocaleTimeString('zh-CN', { hour12: false });
  };

  const formatDate = (date) => {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`;
  };

  if (loading) {
    return (
      <div style={boardStyles.container}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', color: '#bdbbff', marginBottom: '20px' }}>加载中...</div>
            <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)' }}>正在获取大屏数据</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={boardStyles.container}>
      {/* 头部 */}
      <div style={boardStyles.header}>
        <div style={boardStyles.headerMeta}>
          <div>{formatTime(currentTime)}</div>
          <div>{formatDate(currentTime)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <span style={boardStyles.statusDot}></span>
            <span style={{ color: '#00c853', fontSize: '12px', fontFamily: "'PP Neue Montreal Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08px' }}>平台运行正常</span>
          </div>
        </div>
        <div style={boardStyles.headerTitle}>
          Tokengine运营数据大屏
        </div>
        <div style={{ ...boardStyles.headerMeta, textAlign: 'left' }}>
          <div>并发请求：<span style={boardStyles.headerMetaVal}>{formatNumber(stats?.concurrent_requests, 0)}</span></div>
          <div>服务可用率：<span style={boardStyles.headerMetaVal}>{stats?.service_availability?.toFixed(2)}%</span></div>
        </div>
      </div>

      {/* 主内容区 */}
      <div style={boardStyles.main}>
        {/* 第一行：核心经营指标 */}
        <div style={{ ...boardStyles.panel, ...boardStyles.span4 }}>
          <div style={boardStyles.panelTitle}>📊 核心经营指标 · 实时看板</div>
          <div style={boardStyles.panelBody}>
            <div style={{ ...boardStyles.flexRow, textAlign: 'center' }}>
              <div style={boardStyles.flex1}>
                <div style={boardStyles.kpiMini}>
                  <div style={{ ...boardStyles.bigNum, color: '#00c853', fontSize: '28px' }}>
                    ¥{formatNumber(stats?.today_revenue)}
                  </div>
                  <div style={boardStyles.label}>今日营收 (元)</div>
                </div>
              </div>
              <div style={boardStyles.flex1}>
                <div style={boardStyles.kpiMini}>
                  <div style={{ ...boardStyles.bigNum, color: '#bdbbff', fontSize: '28px' }}>
                    {formatNumber(quotaToToken(stats?.today_quota_used), 0)}
                  </div>
                  <div style={boardStyles.label}>今日消耗Token</div>
                </div>
              </div>
              <div style={boardStyles.flex1}>
                <div style={boardStyles.kpiMini}>
                  <div style={{ ...boardStyles.bigNum, color: '#ffc107', fontSize: '28px' }}>
                    {formatNumber(stats?.today_request_count, 0)}
                  </div>
                  <div style={boardStyles.label}>今日请求次数</div>
                </div>
              </div>
              <div style={boardStyles.flex1}>
                <div style={boardStyles.kpiMini}>
                  <div style={{ ...boardStyles.bigNum, color: '#ffc107', fontSize: '28px' }}>
                    {formatNumber(stats?.today_active_users, 0)}
                  </div>
                  <div style={boardStyles.label}>今日活跃用户</div>
                </div>
              </div>
              <div style={boardStyles.flex1}>
                <div style={boardStyles.kpiMini}>
                  <div style={{ ...boardStyles.bigNum, color: '#00c853', fontSize: '28px' }}>
                    ¥{formatNumber(stats?.month_revenue)}
                  </div>
                  <div style={boardStyles.label}>本月累计营收</div>
                </div>
              </div>
              <div style={boardStyles.flex1}>
                <div style={boardStyles.kpiMini}>
                  <div style={{ ...boardStyles.bigNum, color: '#bdbbff', fontSize: '28px' }}>
                    {formatNumber(stats?.today_topup_count, 0)}
                  </div>
                  <div style={boardStyles.label}>今日充值订单</div>
                </div>
              </div>
              <div style={boardStyles.flex1}>
                <div style={boardStyles.kpiMini}>
                  <div style={{ ...boardStyles.bigNum, color: '#ffffff', fontSize: '28px' }}>
                    ¥{formatNumber(stats?.today_topup_amount)}
                  </div>
                  <div style={boardStyles.label}>今日充值金额</div>
                </div>
              </div>
              <div style={boardStyles.flex1}>
                <div style={boardStyles.kpiMini}>
                  <div style={{ ...boardStyles.bigNum, color: '#bdbbff', fontSize: '28px' }}>
                    {formatNumber(stats?.active_channels, 0)}
                  </div>
                  <div style={boardStyles.label}>活跃渠道数</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 第二行：用户数据 */}
        <div style={{ ...boardStyles.panel, ...boardStyles.span4 }}>
          <div style={boardStyles.panelTitle}>👥 用户数据 · 全景看板</div>
          <div style={boardStyles.panelBody}>
            <div style={boardStyles.flexRow}>
              {/* 左侧核心指标 */}
              <div style={boardStyles.flex1}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  <div style={boardStyles.kpiMini}>
                    <div style={{ ...boardStyles.bigNum, color: '#bdbbff', fontSize: '20px' }}>{formatNumber(stats?.total_users, 0)}</div>
                    <div style={boardStyles.label}>注册用户总数</div>
                  </div>
                  <div style={boardStyles.kpiMini}>
                    <div style={{ ...boardStyles.bigNum, color: '#00c853', fontSize: '20px' }}>{formatNumber(stats?.today_new_users, 0)}</div>
                    <div style={boardStyles.label}>今日新增注册</div>
                  </div>
                  <div style={boardStyles.kpiMini}>
                    <div style={{ ...boardStyles.bigNum, color: '#bdbbff', fontSize: '20px' }}>{formatNumber(stats?.today_active_users, 0)}</div>
                    <div style={boardStyles.label}>日活用户 (DAU)</div>
                  </div>
                  <div style={boardStyles.kpiMini}>
                    <div style={{ ...boardStyles.bigNum, color: '#ffffff', fontSize: '20px' }}>{formatNumber(stats?.total_active_mau, 0)}</div>
                    <div style={boardStyles.label}>月活用户 (MAU)</div>
                  </div>
                  <div style={boardStyles.kpiMini}>
                    <div style={{ ...boardStyles.bigNum, color: '#00c853', fontSize: '18px' }}>{formatNumber(stats?.month_new_users, 0)}</div>
                    <div style={boardStyles.label}>本月新增注册</div>
                  </div>
                  <div style={boardStyles.kpiMini}>
                    <div style={{ ...boardStyles.bigNum, color: '#ffc107', fontSize: '18px' }}>{formatNumber(stats?.total_models, 0)}</div>
                    <div style={boardStyles.label}>模型总数</div>
                  </div>
                </div>
              </div>
              {/* 右侧图表 - 近30天趋势 */}
              <div style={{ ...boardStyles.flex1 }}>
                <div style={{ fontSize: '11px', color: '#ffffff', marginBottom: '8px', fontWeight: 500 }}>📊 近30天趋势</div>
                <div style={{ height: '160px' }} ref={dailyTrendChartRef}></div>
              </div>
            </div>
          </div>
        </div>

        {/* 第四行：成本利润 + 今日趋势 */}
        <div style={{ ...boardStyles.panel, ...boardStyles.span2 }}>
          <div style={boardStyles.panelTitle}>💰 成本与利润 · 核心指标</div>
          <div style={boardStyles.panelBody}>
            <div style={{ ...boardStyles.flexRow, textAlign: 'center' }}>
              <div style={boardStyles.flex1}>
                <div style={boardStyles.kpiMini}>
                  <div style={{ ...boardStyles.bigNum, color: '#00c853', fontSize: '24px' }}>¥{formatNumber(stats?.today_profit)}</div>
                  <div style={boardStyles.label}>今日毛利 (元)</div>
                </div>
              </div>
              <div style={boardStyles.flex1}>
                <div style={boardStyles.kpiMini}>
                  <div style={{ ...boardStyles.bigNum, color: '#ff5252', fontSize: '24px' }}>¥{formatNumber(stats?.today_cost)}</div>
                  <div style={boardStyles.label}>今日成本 (元)</div>
                </div>
              </div>
              <div style={boardStyles.flex1}>
                <div style={boardStyles.kpiMini}>
                  <div style={{ ...boardStyles.bigNum, color: '#bdbbff', fontSize: '24px' }}>{stats?.margin_rate?.toFixed(2)}%</div>
                  <div style={boardStyles.label}>毛利率</div>
                </div>
              </div>
              <div style={boardStyles.flex1}>
                <div style={boardStyles.kpiMini}>
                  <div style={{ ...boardStyles.bigNum, color: '#ffffff', fontSize: '24px' }}>¥{formatNumber(stats?.profit_per_thousand)}</div>
                  <div style={boardStyles.label}>千Token利润</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...boardStyles.panel, ...boardStyles.span2 }}>
          <div style={boardStyles.panelTitle}>📈 今日24小时趋势</div>
          <div style={boardStyles.panelBody}>
            <div style={{ height: '150px' }} ref={hourlyTrendChartRef}></div>
          </div>
        </div>

        {/* 第五行：模型数据分析 + 热门模型 */}
        <div style={{ ...boardStyles.panel, ...boardStyles.span2 }}>
          <div style={{ ...boardStyles.panelTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📊 模型数据分析</span>
            <Tabs
              type='slash'
              activeKey={activeChartTab}
              onChange={setActiveChartTab}
              style={{ marginBottom: 0 }}
            >
              <TabPane tab={<span style={{ fontSize: '10px', color: '#ffffff' }}>{t('消耗分布')}</span>} itemKey='1' />
              <TabPane tab={<span style={{ fontSize: '10px', color: '#ffffff' }}>{t('调用趋势')}</span>} itemKey='2' />
              <TabPane tab={<span style={{ fontSize: '10px', color: '#ffffff' }}>{t('调用次数分布')}</span>} itemKey='3' />
              <TabPane tab={<span style={{ fontSize: '10px', color: '#ffffff' }}>{t('调用次数排行')}</span>} itemKey='4' />
              <TabPane tab={<span style={{ fontSize: '10px', color: '#ffffff' }}>{t('用户消耗排行')}</span>} itemKey='5' />
              <TabPane tab={<span style={{ fontSize: '10px', color: '#ffffff' }}>{t('用户消耗趋势')}</span>} itemKey='6' />
            </Tabs>
          </div>
          <div style={{ ...boardStyles.panelBody, padding: '12px 20px' }}>
            <div style={{ height: '320px', width: '100%', position: 'relative' }}>
              {/* 1. 消耗分布 - 堆叠柱状图 */}
              {activeChartTab === '1' && chartData && (
                <VChart
                  spec={{
                    type: 'bar',
                    data: [{ id: 'barData', values: chartData.quota_distribution || [] }],
                    xField: 'time',
                    yField: 'raw_quota',
                    seriesField: 'model',
                    stack: true,
                    legends: { visible: true, orient: 'top', maxRow: 1, textStyle: { fontSize: 10, fill: '#5b7daa' } },
                    title: { visible: false },
                    bar: { state: { hover: { stroke: '#ffffff', lineWidth: 1 } } },
                    tooltip: {
                      mark: {
                        content: [
                          { key: (datum) => datum['model'], value: (datum) => renderQuota(datum['raw_quota'] || 0, 4) }
                        ]
                      }
                    },
                    color: { specified: modelColorMap },
                    background: '#010120',
                    animation: false,
                    axes: [
                      { orient: 'bottom', label: { style: { fill: '#5b7daa', fontSize: 10 } }, line: { style: { stroke: 'rgba(255,255,255,0.15)' } }, grid: { style: { stroke: '#0f2f5a', strokeOpacity: 0.3 } }, nice: true },
                      { orient: 'left', label: { style: { fill: '#5b7daa', fontSize: 10, formatMethod: (v) => renderQuota(v, 2) } }, line: { style: { stroke: 'rgba(255,255,255,0.15)' } }, grid: { style: { stroke: '#0f2f5a', strokeOpacity: 0.3 } } }
                    ],
                    style: {
                      paddingTop: 20,
                      paddingBottom: 40
                    }
                  }}
                  option={{ autoFit: true }}
                />
              )}
              {/* 2. 调用趋势 - 折线图 */}
              {activeChartTab === '2' && chartData && (
                <VChart
                  spec={{
                    type: 'line',
                    data: [{ id: 'lineData', values: chartData.call_trend || [] }],
                    xField: 'time',
                    yField: 'count',
                    seriesField: 'model',
                    legends: { visible: true, orient: 'top', maxRow: 1, textStyle: { fontSize: 10, fill: '#5b7daa' } },
                    title: { visible: false },
                    tooltip: {
                      mark: {
                        content: [{ key: (datum) => datum['model'], value: (datum) => renderNumber(datum['count']) }]
                      }
                    },
                    color: { specified: modelColorMap },
                    background: '#010120',
                    animation: false,
                    axes: [
                      { orient: 'bottom', label: { style: { fill: '#5b7daa', fontSize: 10 } }, line: { style: { stroke: 'rgba(255,255,255,0.15)' } }, grid: { style: { stroke: '#0f2f5a', strokeOpacity: 0.3 } }, nice: true },
                      { orient: 'left', label: { style: { fill: '#5b7daa', fontSize: 10 } }, line: { style: { stroke: 'rgba(255,255,255,0.15)' } }, grid: { style: { stroke: '#0f2f5a', strokeOpacity: 0.3 } } }
                    ],
                    style: {
                      paddingTop: 20,
                      paddingBottom: 40
                    }
                  }}
                  option={{ autoFit: true }}
                />
              )}
              {/* 3. 调用次数分布 - 饼图 */}
              {activeChartTab === '3' && chartData && (
                <VChart
                  spec={{
                    type: 'pie',
                    data: [{ id: 'id0', values: chartData.call_distribution || [] }],
                    outerRadius: 0.75,
                    innerRadius: 0.45,
                    padAngle: 0.6,
                    valueField: 'count',
                    categoryField: 'model',
                    legends: { visible: true, orient: 'right', textStyle: { fontSize: 10, fill: '#5b7daa' } },
                    label: { visible: true },
                    title: { visible: false },
                    tooltip: {
                      mark: {
                        content: [{ key: (datum) => datum['model'], value: (datum) => renderNumber(datum['count']) }]
                      }
                    },
                    color: { specified: modelColorMap },
                    background: '#010120',
                    animation: false,
                    pie: {
                      style: {
                        cornerRadius: 10
                      },
                      state: {
                        hover: { outerRadius: 0.8, stroke: '#ffffff', lineWidth: 1 },
                        selected: { outerRadius: 0.8, stroke: '#ffffff', lineWidth: 1 }
                      }
                    }
                  }}
                  option={{ autoFit: true }}
                />
              )}
              {/* 4. 调用次数排行 - 水平柱状图 */}
              {activeChartTab === '4' && chartData && (
                <VChart
                  spec={{
                    type: 'bar',
                    data: [{ id: 'rankData', values: (chartData.call_rank || []).sort((a, b) => b.count - a.count) }],
                    xField: 'count',
                    yField: 'model',
                    seriesField: 'model',
                    direction: 'horizontal',
                    legends: { visible: false },
                    title: { visible: false },
                    bar: { state: { hover: { stroke: '#ffffff', lineWidth: 1 } } },
                    label: {
                      visible: true,
                      position: 'outside',
                      formatMethod: (value) => renderNumber(value)
                    },
                    tooltip: {
                      mark: {
                        content: [{ key: (datum) => datum['model'], value: (datum) => renderNumber(datum['count']) }]
                      }
                    },
                    color: { specified: modelColorMap },
                    background: '#010120',
                    animation: false,
                    axes: [
                      { orient: 'left', label: { style: { fill: '#5b7daa', fontSize: 10 } }, line: { style: { stroke: 'rgba(255,255,255,0.15)' } }, grid: { style: { stroke: '#0f2f5a', strokeOpacity: 0.3 } } },
                      { orient: 'bottom', label: { style: { fill: '#5b7daa', fontSize: 10 } }, line: { style: { stroke: 'rgba(255,255,255,0.15)' } }, grid: { style: { stroke: '#0f2f5a', strokeOpacity: 0.3 } } }
                    ],
                    style: {
                      paddingLeft: 20,
                      paddingRight: 40
                    }
                  }}
                  option={{ autoFit: true }}
                />
              )}
              {/* 5. 用户消耗排行 - 水平柱状图 */}
              {activeChartTab === '5' && chartData && (
                <VChart
                  spec={{
                    type: 'bar',
                    data: [{ id: 'userRankData', values: chartData.user_quota_rank || [] }],
                    xField: 'raw_quota',
                    yField: 'user',
                    seriesField: 'user',
                    direction: 'horizontal',
                    legends: { visible: false },
                    title: { visible: false },
                    bar: { state: { hover: { stroke: '#ffffff', lineWidth: 1 } } },
                    label: {
                      visible: true,
                      position: 'outside',
                      formatMethod: (value, datum) => renderQuota(datum['raw_quota'] || 0, 2)
                    },
                    axes: [
                      { orient: 'left', type: 'band', label: { style: { fill: '#5b7daa', fontSize: 10 } }, line: { style: { stroke: 'rgba(255,255,255,0.15)' } }, grid: { style: { stroke: '#0f2f5a', strokeOpacity: 0.3 } } },
                      { orient: 'bottom', type: 'linear', visible: false }
                    ],
                    tooltip: {
                      mark: {
                        content: [{ key: (datum) => datum['user'], value: (datum) => renderQuota(datum['raw_quota'] || 0, 4) }]
                      }
                    },
                    color: { type: 'ordinal', range: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'] },
                    background: '#010120',
                    animation: false,
                    style: {
                      paddingLeft: 20,
                      paddingRight: 40
                    }
                  }}
                  option={{ autoFit: true }}
                />
              )}
              {/* 6. 用户消耗趋势 - 面积图 */}
              {activeChartTab === '6' && chartData && (
                <VChart
                  spec={{
                    type: 'area',
                    data: [{ id: 'userTrendData', values: chartData.user_quota_trend || [] }],
                    xField: 'time',
                    yField: 'raw_quota',
                    seriesField: 'user',
                    stack: false,
                    legends: { visible: true, orient: 'top', maxRow: 1, textStyle: { fontSize: 10, fill: '#5b7daa' } },
                    title: { visible: false },
                    axes: [{
                      orient: 'left',
                      label: { style: { fill: '#5b7daa', fontSize: 10 }, formatMethod: (value) => renderQuota(value, 2) },
                      line: { style: { stroke: 'rgba(255,255,255,0.15)' } },
                      grid: { style: { stroke: '#0f2f5a', strokeOpacity: 0.3 } }
                    }, {
                      orient: 'bottom',
                      label: { style: { fill: '#5b7daa', fontSize: 10 } },
                      line: { style: { stroke: 'rgba(255,255,255,0.15)' } },
                      grid: { style: { stroke: '#0f2f5a', strokeOpacity: 0.3 } },
                      nice: true
                    }],
                    area: { style: { fillOpacity: 0.15 } },
                    line: { style: { lineWidth: 2 } },
                    point: { visible: false },
                    tooltip: {
                      mark: {
                        content: [{ key: (datum) => datum['user'], value: (datum) => renderQuota(datum['raw_quota'] || 0, 4) }]
                      }
                    },
                    color: { type: 'ordinal', range: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'] },
                    background: '#010120',
                    animation: false,
                    style: {
                      paddingTop: 20,
                      paddingBottom: 40
                    }
                  }}
                  option={{ autoFit: true }}
                />
              )}
            </div>
          </div>
        </div>

        <div style={{ ...boardStyles.panel, ...boardStyles.span2 }}>
          <div style={boardStyles.panelTitle}>🏆 热门模型 TOP10</div>
          <div style={boardStyles.panelBody}>
            <div style={{ height: '150px' }} ref={topModelsChartRef}></div>
          </div>
        </div>

        {/* 第六行：热门渠道 + 告警 */}
        <div style={{ ...boardStyles.panel, ...boardStyles.span2 }}>
          <div style={boardStyles.panelTitle}>🔥 热门渠道 TOP10</div>
          <div style={boardStyles.panelBody}>
            <div style={{ height: '150px' }} ref={topChannelsChartRef}></div>
          </div>
        </div>

        <div style={{ ...boardStyles.panel, ...boardStyles.span2 }}>
          <div style={boardStyles.panelTitle}>🚨 系统告警</div>
          <div style={{ ...boardStyles.panelBody, maxHeight: '150px', overflow: 'auto' }}>
            {stats?.alerts?.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#5b7daa', padding: '20px' }}>
                暂无告警信息
              </div>
            ) : (
              stats?.alerts?.map((alert, index) => (
                <div
                  key={index}
                  style={{
                    padding: '7px 10px',
                    marginBottom: '4px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    background: alert.type === 'critical' ? 'rgba(255,61,90,0.08)' :
                      alert.type === 'warn' ? 'rgba(255,145,0,0.08)' : 'rgba(0,229,255,0.08)',
                    borderLeft: `3px solid ${
                      alert.type === 'critical' ? '#ff5252' :
                        alert.type === 'warn' ? '#ffc107' : '#bdbbff'
                    }`,
                  }}
                >
                  <span style={{ color: 'rgba(255, 255, 255, 0.35)', marginRight: '8px' }}>{alert.time}</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{alert.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 底部滚动条 */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '30px',
          background: 'rgba(3,18,40,0.95)',
          borderTop: '1px solid #0f2f5a',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '60px',
            whiteSpace: 'nowrap',
            animation: 'tickerScroll 30s linear infinite',
            fontSize: '11px',
            color: '#5b7daa',
          }}
        >
          <span style={{ padding: '0 30px', borderRight: '1px solid rgba(255,255,255,0.12)' }}>
            ⚡ 平台运行正常 · 全部服务在线
          </span>
          <span style={{ padding: '0 30px', borderRight: '1px solid rgba(255,255,255,0.12)' }}>
            👥 注册用户 {formatNumber(stats?.total_users, 0)} · 今日新增 {formatNumber(stats?.today_new_users, 0)} 人
          </span>
          <span style={{ padding: '0 30px', borderRight: '1px solid rgba(255,255,255,0.12)' }}>
            📊 今日请求 {formatNumber(stats?.today_request_count, 0)} 次 · Token消耗 {formatNumber(quotaToToken(stats?.today_quota_used), 0)}
          </span>
          <span style={{ padding: '0 30px', borderRight: '1px solid rgba(255,255,255,0.12)' }}>
            💰 今日营收 ¥{formatNumber(stats?.today_revenue)} · 充值订单 {formatNumber(stats?.today_topup_count, 0)} 笔
          </span>
          <span style={{ padding: '0 30px', borderRight: '1px solid rgba(255,255,255,0.12)' }}>
            🔥 活跃渠道 {formatNumber(stats?.active_channels, 0)} · 模型总数 {formatNumber(stats?.total_models, 0)}
          </span>
          <span style={{ padding: '0 30px', borderRight: '1px solid rgba(255,255,255,0.12)' }}>
            📈 毛利率 {stats?.margin_rate?.toFixed(2)}% · 千Token利润 ¥{formatNumber(stats?.profit_per_thousand)}
          </span>
        </div>
      </div>

      {/* CSS动画样式 */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { box-shadow: 0 0 4px rgba(0, 200, 83, 0.3); }
            50% { box-shadow: 0 0 8px rgba(0, 200, 83, 0.5); }
          }
          @keyframes tickerScroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}
      </style>
    </div>
  );
};

export default DashboardBoard;