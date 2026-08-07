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
import { Card, Spin, Table } from '@douyinfe/semi-ui';
import * as echarts from 'echarts';
import { useTranslation } from 'react-i18next';
import {
  queryInstant,
  getLabelValues,
  formatModelName,
  formatSeconds,
  formatStat,
  PanelTitle,
} from './shared';

const REFRESH_INTERVAL = 30000; // 30s 自动刷新

const MAX_LABEL_LEN = 18;

// 截断 y 轴 job 标签
const truncateLabel = (v) =>
  v.length > MAX_LABEL_LEN ? `${v.slice(0, MAX_LABEL_LEN - 1)}…` : v;

// ---------- 横向排行条形图 ----------
const BarRankPanel = ({ title, data, valueFormatter, colorByValue, description }) => {
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
    const sorted = [...data].sort((a, b) => b.value - a.value);
    chartInstance.current.setOption(
      {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          valueFormatter,
        },
        grid: { left: 8, right: 24, top: 6, bottom: 6, containLabel: true },
        xAxis: { type: 'value' },
        yAxis: {
          type: 'category',
          inverse: true,
          data: sorted.map((d) => truncateLabel(d.name)),
          axisLabel: { fontSize: 12, interval: 0 },
        },
        series: [
          {
            type: 'bar',
            barWidth: 13,
            data: sorted.map((d) => ({
              value: d.value,
              itemStyle: {
                color: colorByValue ? colorByValue(d.value) : '#1664FF',
                borderRadius: [0, 5, 5, 0],
              },
            })),
          },
        ],
      },
      true,
    );
  }, [data, valueFormatter, colorByValue, t]);

  const height = Math.max(200, (data.length || 1) * 28 + 48);

  return (
    <Card className='h-full' bodyStyle={{ padding: '16px 20px' }}>
      <PanelTitle title={title} description={description} />
      <div ref={chartRef} style={{ height, marginTop: 4 }} />
    </Card>
  );
};

// ---------- 排行表格 ----------
const RankTable = ({ title, data, valueFormatter, description, sort = true }) => {
  const { t } = useTranslation();
  const rows = sort ? [...data].sort((a, b) => b.value - a.value) : data;

  const columns = [
    {
      title: t('模型'),
      dataIndex: 'name',
      render: (v, row) => (
        <span
          title={row.full || row.name}
          style={{
            fontSize: 13,
            display: 'block',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.name}
        </span>
      ),
    },
    {
      title: t('数值'),
      dataIndex: 'value',
      width: 100,
      align: 'right',
      render: (v) => (
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {valueFormatter ? valueFormatter(v) : formatStat(v)}
        </span>
      ),
    },
  ];

  return (
    <Card className='h-full' bodyStyle={{ padding: '16px 20px' }}>
      <PanelTitle title={title} description={description} />
      <Table
        size='small'
        pagination={false}
        columns={columns}
        dataSource={rows}
        rowKey='name'
        style={{ marginTop: 8 }}
      />
    </Card>
  );
};

const Ranking = ({ refreshSignal, onLoadingChange, onLastRefresh, onError }) => {
  const { t } = useTranslation();
  const [data, setData] = useState({
    qps: [],
    e2eP50: [],
    e2eP95: [],
    tokenOut: [],
    kv: [],
    running: [],
    waiting: [],
    preemption: [],
  });
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    onLoadingChange?.(true);
    try {
      const [q1, q2, q3, q4, q5, q6, q7, q8] = await Promise.all([
        queryInstant(
          'topk(10, sum by (model)(rate(vllm:num_incoming_requests_total[5m])))',
        ),
        queryInstant(
          'histogram_quantile(0.5, sum by (le, model_name)(rate(vllm:e2e_request_latency_seconds_bucket[5m])))',
        ),
        queryInstant(
          'histogram_quantile(0.95, sum by (le, model_name)(rate(vllm:e2e_request_latency_seconds_bucket[5m])))',
        ),
        queryInstant(
          'sum by (model_name)(rate(vllm:generation_tokens_total[5m]))',
        ),
        queryInstant('avg by (model_name)(vllm:kv_cache_usage_perc) * 100'),
        queryInstant(
          'sum by (model_name)(vllm:num_requests_running{model_name!=""})',
        ),
        queryInstant(
          'sum by (model_name)(vllm:num_requests_waiting{model_name!=""})',
        ),
        queryInstant(
          'topk(5, sum by (model_name)(rate(vllm:num_preemptions_total[5m])))',
        ),
      ]);

      if (!isMountedRef.current) return;
      // 模型名面板：去掉组织前缀展示，全名保留在 full 用于悬浮提示
      const model = (arr) =>
        arr.map((d) => ({
          ...d,
          name: formatModelName(d.name),
          full: d.name,
        }));
      setData({
        qps: model(getLabelValues(q1, 'model')),
        e2eP50: model(getLabelValues(q2, 'model_name')),
        e2eP95: model(getLabelValues(q3, 'model_name')),
        tokenOut: model(getLabelValues(q4, 'model_name')),
        kv: model(getLabelValues(q5, 'model_name')),
        running: model(getLabelValues(q6, 'model_name')),
        waiting: model(getLabelValues(q7, 'model_name')),
        preemption: model(getLabelValues(q8, 'model_name')),
      });
      onError?.(null);
      onLastRefresh?.(new Date());
    } catch (e) {
      if (isMountedRef.current) {
        onError?.(e.message || '数据加载失败');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        onLoadingChange?.(false);
      }
    }
  }, [onLoadingChange, onLastRefresh, onError]);

  useEffect(() => {
    isMountedRef.current = true;
    loadData();
    const timer = setInterval(loadData, REFRESH_INTERVAL);
    return () => {
      isMountedRef.current = false;
      clearInterval(timer);
    };
  }, [loadData]);

  // 手动刷新（Tab 栏刷新按钮）
  useEffect(() => {
    if (refreshSignal > 0) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  const kvColor = (v) => (v > 90 ? '#F53F3F' : v > 70 ? '#FFB400' : '#00B42A');
  const waitingColor = (v) =>
    v > 100 ? '#F53F3F' : v > 10 ? '#FFB400' : '#00B42A';

  const allEmpty = data.qps.length === 0;

  return (
    <div>
      {loading && allEmpty ? (
        <div className='flex justify-center py-20'>
          <Spin size='large' />
        </div>
      ) : (
        <>
          <div className='grid grid-cols-12 gap-4 mb-4'>
            <div className='col-span-12 lg:col-span-8'>
              <BarRankPanel
                title={t('各模型 Token 产出')}
                data={data.tokenOut}
                valueFormatter={(v) => `${formatStat(v)} tok/s`}
                description={t('近 5 分钟各模型生成 token 速率（tok/s），降序。')}
              />
            </div>
            <div className='col-span-12 lg:col-span-4'>
              <BarRankPanel
                title={t('各模型 QPS 排行')}
                data={data.qps}
                valueFormatter={(v) => `${formatStat(v)} req/s`}
                description={t('近 5 分钟各模型入站请求速率（req/s），降序 Top 10。')}
              />
            </div>
          </div>

          <div className='grid grid-cols-12 gap-4 mb-4'>
            <div className='col-span-12 lg:col-span-4'>
              <BarRankPanel
                title={t('各模型 KV 缓存使用率')}
                data={data.kv}
                valueFormatter={(v) => `${v.toFixed(1)}%`}
                colorByValue={kvColor}
                description={t('各模型 KV 缓存平均使用率。>90% 红，>70% 黄。')}
              />
            </div>
            <div className='col-span-12 lg:col-span-4'>
              <BarRankPanel
                title={t('各模型运行中请求')}
                data={data.running}
                valueFormatter={(v) => `${formatStat(v)}`}
                description={t('当前各模型正在推理（running）的请求数。')}
              />
            </div>
            <div className='col-span-12 lg:col-span-4'>
              <BarRankPanel
                title={t('各模型排队请求')}
                data={data.waiting}
                valueFormatter={(v) => `${formatStat(v)}`}
                colorByValue={waitingColor}
                description={t('当前各模型排队等待（waiting）的请求数。>100 红，>10 黄。')}
              />
            </div>
          </div>

          <div className='grid grid-cols-12 gap-4 mb-4'>
            <div className='col-span-12 lg:col-span-4'>
              <RankTable
                title={t('各模型 e2e 延迟 p50')}
                data={data.e2eP50}
                valueFormatter={formatSeconds}
                description={t('近 5 分钟各模型端到端延迟的 p50 分位数。')}
              />
            </div>
            <div className='col-span-12 lg:col-span-4'>
              <RankTable
                title={t('各模型 e2e 延迟 p95')}
                data={data.e2eP95}
                valueFormatter={formatSeconds}
                description={t('近 5 分钟各模型端到端延迟的 p95 分位数，反映尾部延迟。')}
              />
            </div>
            <div className='col-span-12 lg:col-span-4'>
              <RankTable
                title={t('Preemption Top5')}
                data={data.preemption}
                valueFormatter={(v) => `${v.toFixed(2)} /s`}
                description={t('近 5 分钟抢占速率最高的 5 个模型（job）。')}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Ranking;
