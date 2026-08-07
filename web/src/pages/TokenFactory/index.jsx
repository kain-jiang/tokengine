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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card, Spin, Tag, Tooltip, Typography } from '@douyinfe/semi-ui';
import { IconHelpCircle, IconRefresh } from '@douyinfe/semi-icons';
import * as echarts from 'echarts';
import { API } from '../../helpers';
import { useTranslation } from 'react-i18next';

const REFRESH_INTERVAL = 30000; // 30s 自动刷新
const RANGE = 60 * 60; // 曲线范围：近 1h
const STEP = 30; // 曲线步长 30s

// ---------- Prometheus 查询辅助 ----------
const queryInstant = async (query) => {
  const res = await API.get('/api/user/prometheus/query', {
    params: { query },
  });
  if (res.data?.status !== 'success' || !res.data?.data) {
    throw new Error('Prometheus 查询失败');
  }
  return res.data.data;
};

const queryRange = async (query, start, end, step) => {
  const res = await API.get('/api/user/prometheus/query_range', {
    params: { query, start, end, step },
  });
  if (res.data?.status !== 'success' || !res.data?.data) {
    throw new Error('Prometheus 查询失败');
  }
  return res.data.data;
};

// 取 vector 结果中第一个序列的值
const getVectorValue = (data) => {
  const result = data?.result || [];
  if (result.length === 0) return null;
  const val = parseFloat(result[0].value?.[1]);
  return Number.isFinite(val) ? val : null;
};

// matrix → ECharts 时间序列所需的 [timestamp_ms, value] 元组
const getSeries = (data) => {
  const result = data?.result || [];
  if (result.length === 0) return [];
  const values = result[0].values || [];
  return values
    .map(([ts, v]) => {
      const num = parseFloat(v);
      return Number.isFinite(num) ? [ts * 1000, num] : null;
    })
    .filter(Boolean);
};

// ---------- 格式化 ----------
const formatPercent = (v) => (v == null ? '--' : `${(v * 100).toFixed(1)}%`);

// 统计数值格式化：大数用 k/M/B，小数取整或保留 2 位小数
const formatStat = (v) => {
  if (v == null) return null;
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e4) return `${(v / 1e3).toFixed(1)}k`;
  if (Math.abs(v) >= 100) return v.toFixed(0);
  return v.toFixed(2);
};

// 延迟格式化：<1s 显示毫秒，否则显示秒
const formatSeconds = (v) => {
  if (v == null) return null;
  if (v < 1) return `${(v * 1000).toFixed(0)} ms`;
  return `${v.toFixed(2)} s`;
};

// ---------- 面板标题（含悬浮解释） ----------
const PanelTitle = ({ title, description }) => {
  return (
    <div className='flex items-center gap-1'>
      <Typography.Text type='tertiary' className='text-sm'>
        {title}
      </Typography.Text>
      {description && (
        <Tooltip position='top' content={description}>
          <IconHelpCircle
            size={14}
            className='cursor-help'
            style={{ color: 'var(--semi-color-text-3)', flexShrink: 0 }}
          />
        </Tooltip>
      )}
    </div>
  );
};

// ---------- 通用 Stat 面板 ----------
const StatPanel = ({ title, value, suffix, color, formatter, description }) => {
  return (
    <Card
      className='h-full'
      bodyStyle={{
        padding: '20px 22px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <PanelTitle title={title} description={description} />
      <div
        className='mt-auto pt-4'
        style={{
          display: 'flex',
          alignItems: 'baseline',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            fontSize: 30,
            fontWeight: 700,
            color,
            lineHeight: 1.2,
            textOverflow: 'ellipsis',
            overflow: 'hidden',
          }}
        >
          {value == null
            ? '--'
            : formatter
              ? formatter(value)
              : formatStat(value)}
        </span>
        {value != null && suffix && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              marginLeft: 6,
              color: 'var(--semi-color-text-2)',
              flexShrink: 0,
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </Card>
  );
};

// ---------- Gauge 面板（成功率） ----------
const GaugePanel = ({ title, value, color, description }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;
    chartInstance.current = echarts.init(chartRef.current);
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartInstance.current) return;
    chartInstance.current.setOption({
      series: [
        {
          type: 'gauge',
          min: 0,
          max: 1,
          radius: '46%',
          center: ['50%', '50%'],
          startAngle: 200,
          endAngle: -20,
          progress: {
            show: true,
            width: 12,
            roundCap: true,
            itemStyle: { color },
          },
          axisLine: {
            lineStyle: { width: 12, color: [[1, '#e5e6eb']] },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          title: { show: false },
          detail: { show: false },
          data: [{ value: value ?? 0 }],
        },
      ],
    });
  }, [value, color]);

  return (
    <Card
      className='h-full'
      bodyStyle={{
        padding: '20px 22px',
        height: '100%',
        display: 'flex',
      }}
    >
      <div className='flex flex-col justify-center flex-none mr-4' style={{ minWidth: 0 }}>
        <PanelTitle title={title} description={description} />
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            color,
            lineHeight: 1.2,
            marginTop: 8,
            whiteSpace: 'nowrap',
          }}
        >
          {formatPercent(value)}
        </div>
      </div>
      <div ref={chartRef} style={{ flex: 1, minWidth: 0, minHeight: 0 }} />
    </Card>
  );
};

// ---------- 吞吐曲线面板 ----------
const ThroughputPanel = ({ genSeries, inSeries, description }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!chartRef.current) return;
    chartInstance.current = echarts.init(chartRef.current);
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartInstance.current) return;
    chartInstance.current.setOption(
      {
        color: ['#1664FF', '#00B42A'],
        tooltip: { trigger: 'axis' },
        legend: { data: [t('生成 token/s'), t('输入 token/s')], top: 0 },
        grid: { left: 56, right: 20, top: 36, bottom: 28 },
        xAxis: { type: 'time' },
        yAxis: { type: 'value', name: 'tok/s' },
        series: [
          {
            name: t('生成 token/s'),
            type: 'line',
            smooth: true,
            showSymbol: false,
            connectNulls: true,
            lineStyle: { width: 2 },
            areaStyle: { opacity: 0.12 },
            data: genSeries,
          },
          {
            name: t('输入 token/s'),
            type: 'line',
            smooth: true,
            showSymbol: false,
            connectNulls: true,
            lineStyle: { width: 2 },
            data: inSeries,
          },
        ],
      },
      true,
    );
  }, [genSeries, inSeries, t]);

  return (
    <Card className='h-full' bodyStyle={{ padding: '16px 20px' }}>
      <PanelTitle title={t('实时 Token 吞吐曲线')} description={description} />
      <div ref={chartRef} style={{ height: 300 }} />
    </Card>
  );
};

const TokenFactory = () => {
  const { t } = useTranslation();
  const [data, setData] = useState({
    todayTokens: null,
    genThroughput: null,
    qps: null,
    successRate: null,
    errorRate: null,
    onlineEngines: null,
    preemption: null,
    avgLatency: null,
    kvUsage: null,
    runningRequests: null,
    waitingRequests: null,
    genSeries: [],
    inSeries: [],
  });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  const loadData = useCallback(async () => {
    const now = Math.floor(Date.now() / 1000);
    try {
      const [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, genRange, inRange] =
        await Promise.all([
          queryInstant(
            '(sum(increase(vllm:generation_tokens_total[24h])) + sum(increase(vllm:prompt_tokens_total[24h])))',
          ),
          queryInstant('sum(rate(vllm:generation_tokens_total[1m]))'),
          queryInstant(
            'sum(rate(vllm:request_success_total[1m])) + sum(rate(vllm:request_errors_total[1m]))',
          ),
          queryInstant(
            'sum(rate(vllm:request_success_total[5m])) / sum(rate(vllm:num_incoming_requests_total[5m]))',
          ),
          queryInstant(
            'sum(rate(vllm:request_errors_total[5m])) / sum(rate(vllm:num_incoming_requests_total[5m]))',
          ),
          queryInstant('count(up{job=~".*engine.*"} == 1)'),
          queryInstant('sum(rate(vllm:num_preemptions_total[1m]))'),
          queryInstant(
            'avg(vllm:e2e_request_latency_seconds_sum) / avg(vllm:e2e_request_latency_seconds_count)',
          ),
          queryInstant('avg(vllm:kv_cache_usage_perc) * 100'),
          queryInstant('sum(vllm:num_requests_running)'),
          queryInstant('sum(vllm:num_requests_waiting)'),
          queryRange(
            'sum(rate(vllm:generation_tokens_total[1m]))',
            now - RANGE,
            now,
            STEP,
          ),
          queryRange(
            'sum(rate(vllm:prompt_tokens_total[1m]))',
            now - RANGE,
            now,
            STEP,
          ),
        ]);

      if (!isMountedRef.current) return;
      setData({
        todayTokens: getVectorValue(p1),
        genThroughput: getVectorValue(p2),
        qps: getVectorValue(p3),
        successRate: getVectorValue(p4),
        errorRate: getVectorValue(p5),
        onlineEngines: getVectorValue(p6),
        preemption: getVectorValue(p7),
        avgLatency: getVectorValue(p8),
        kvUsage: getVectorValue(p9),
        runningRequests: getVectorValue(p10),
        waitingRequests: getVectorValue(p11),
        genSeries: getSeries(genRange),
        inSeries: getSeries(inRange),
      });
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      if (isMountedRef.current) {
        setError(e.message || '数据加载失败');
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadData();
    const timer = setInterval(loadData, REFRESH_INTERVAL);
    return () => {
      isMountedRef.current = false;
      clearInterval(timer);
    };
  }, [loadData]);

  // 成功率阈值配色（Stat 用 CSS 变量，Gauge 需具体色值）
  const successColor =
    data.successRate == null
      ? 'var(--semi-color-text-2)'
      : data.successRate >= 0.99
        ? 'var(--semi-color-success)'
        : data.successRate >= 0.95
          ? 'var(--semi-color-warning)'
          : 'var(--semi-color-danger)';

  const gaugeColor =
    data.successRate == null
      ? '#999999'
      : data.successRate >= 0.99
        ? '#00B42A'
        : data.successRate >= 0.95
          ? '#FFB400'
          : '#F53F3F';

  const errorColor =
    data.errorRate == null
      ? 'var(--semi-color-text-2)'
      : data.errorRate > 0.05
        ? 'var(--semi-color-danger)'
        : data.errorRate > 0.01
          ? 'var(--semi-color-warning)'
          : 'var(--semi-color-success)';

  const preemptionColor =
    data.preemption == null
      ? 'var(--semi-color-text-2)'
      : data.preemption > 5
        ? 'var(--semi-color-danger)'
        : data.preemption > 1
          ? 'var(--semi-color-warning)'
          : 'var(--semi-color-success)';

  const todayTokenColor =
    data.todayTokens == null
      ? 'var(--semi-color-text-2)'
      : data.todayTokens > 10e9
        ? 'var(--semi-color-success)'
        : data.todayTokens > 1e9
          ? 'var(--semi-color-primary)'
          : 'var(--semi-color-text-2)';

  const latencyColor =
    data.avgLatency == null
      ? 'var(--semi-color-text-2)'
      : data.avgLatency > 1
        ? 'var(--semi-color-danger)'
        : data.avgLatency > 0.5
          ? 'var(--semi-color-warning)'
          : 'var(--semi-color-success)';

  const kvColor =
    data.kvUsage == null
      ? 'var(--semi-color-text-2)'
      : data.kvUsage > 90
        ? 'var(--semi-color-danger)'
        : data.kvUsage > 70
          ? 'var(--semi-color-warning)'
          : 'var(--semi-color-success)';

  const waitingColor =
    data.waitingRequests == null
      ? 'var(--semi-color-text-2)'
      : data.waitingRequests > 100
        ? 'var(--semi-color-danger)'
        : data.waitingRequests > 10
          ? 'var(--semi-color-warning)'
          : 'var(--semi-color-success)';

  return (
    <div className='mt-[60px] px-2 h-full overflow-y-auto'>
      <div className='flex items-center justify-between mb-4 flex-wrap gap-2'>
        <div className='flex items-center gap-3'>
          <Typography.Title heading={5} className='!mb-0'>
            {t('Token 工厂总览')}
          </Typography.Title>
          <Tag color='blue'>{t('Prometheus 数据源')}</Tag>
        </div>
        <div className='flex items-center gap-3'>
          {lastRefresh && (
            <Typography.Text type='tertiary' className='text-xs'>
              {t('更新于')} {lastRefresh.toLocaleTimeString()}
            </Typography.Text>
          )}
          <Button
            size='small'
            icon={<IconRefresh />}
            loading={loading}
            onClick={loadData}
          >
            {t('刷新')}
          </Button>
        </div>
      </div>

      {error && (
        <div className='mb-4'>
          <Tag color='red' size='large'>
            {t('数据源连接失败')}：{error}
          </Tag>
        </div>
      )}

      {loading && data.todayTokens == null ? (
        <div className='flex justify-center py-20'>
          <Spin size='large' />
        </div>
      ) : (
        <>
          <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4'>
            <StatPanel
              title={t('今日总 Token 量')}
              value={data.todayTokens}
              color={todayTokenColor}
              description={t('近 24 小时生成与输入 token 的总量（含 prompt 与 completion），用于评估整体用量规模。')}
            />
            <StatPanel
              title={t('实时生成吞吐')}
              value={data.genThroughput}
              suffix='tok/s'
              color='var(--semi-color-primary)'
              description={t('近 1 分钟生成 token 的速率（tok/s），反映模型输出能力。')}
            />
            <StatPanel
              title={t('实时 QPS')}
              value={data.qps}
              suffix='req/s'
              color='var(--semi-color-primary)'
              description={t('近 1 分钟成功与失败请求之和（req/s），反映当前负载压力。')}
            />
            <GaugePanel
              title={t('成功率')}
              value={data.successRate}
              color={gaugeColor}
              description={t('近 5 分钟成功请求 / 总入站请求的比例。≥99% 健康，95%~99% 预警，<95% 告警。')}
            />
          </div>

          <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4'>
            <StatPanel
              title={t('平均 e2e 延迟')}
              value={data.avgLatency}
              formatter={formatSeconds}
              color={latencyColor}
              description={t('近 5 分钟所有已完成请求的平均端到端延迟（按请求数加权）。>1s 告警，>0.5s 预警。')}
            />
            <StatPanel
              title={t('KV 缓存使用率')}
              value={data.kvUsage}
              formatter={(v) => v.toFixed(1)}
              suffix='%'
              color={kvColor}
              description={t('所有引擎 KV 缓存使用率的平均值。>90% 告警，>70% 预警，接近 100% 时易发生抢占。')}
            />
            <StatPanel
              title={t('运行中请求')}
              value={data.runningRequests}
              formatter={(v) => Math.round(v)}
              suffix={t('个')}
              color='var(--semi-color-primary)'
              description={t('当前正在推理（running）的请求总数。')}
            />
            <StatPanel
              title={t('排队请求')}
              value={data.waitingRequests}
              formatter={(v) => Math.round(v)}
              suffix={t('个')}
              color={waitingColor}
              description={t('当前排队等待（waiting）的请求总数。>100 告警，>10 预警。')}
            />
          </div>

          <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4'>
            <StatPanel
              title={t('错误率')}
              value={data.errorRate}
              formatter={formatPercent}
              color={errorColor}
              description={t('近 5 分钟失败请求 / 总入站请求的比例。>5% 告警，>1% 预警。')}
            />
            <StatPanel
              title={t('在线引擎数')}
              value={data.onlineEngines}
              formatter={(v) => Math.round(v)}
              suffix={t('个')}
              color='var(--semi-color-primary)'
              description={t('当前被 Prometheus 正常抓取（up==1）的 vLLM 引擎数量。')}
            />
            <StatPanel
              title={t('Preemption 速率')}
              value={data.preemption}
              suffix='/s'
              color={preemptionColor}
              description={t('近 1 分钟每秒抢占次数。>5/s 表示 KV 缓存压力大，请求易排队，建议扩容。')}
            />
            <Card
              className='h-full'
              bodyStyle={{
                padding: '18px 20px',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Typography.Text type='tertiary' className='text-sm'>
                {t('自动刷新')}：{REFRESH_INTERVAL / 1000}s
                <br />
                {t('曲线范围')}：{t('近 1 小时')}
              </Typography.Text>
            </Card>
          </div>

          <ThroughputPanel
            genSeries={data.genSeries}
            inSeries={data.inSeries}
            description={t('近 1 小时生成 / 输入 token 的速率曲线（30s 步长），直观观察吞吐变化趋势。')}
          />
        </>
      )}
    </div>
  );
};

export default TokenFactory;
