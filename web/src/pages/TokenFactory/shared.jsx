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

import React from 'react';
import { Card, Tooltip, Typography } from '@douyinfe/semi-ui';
import { IconHelpCircle } from '@douyinfe/semi-icons';
import * as echarts from 'echarts';
import { API } from '../../helpers';

// ---------- Prometheus 查询辅助 ----------
export const queryInstant = async (query) => {
  const res = await API.get('/api/user/prometheus/query', {
    params: { query },
  });
  if (res.data?.status !== 'success' || !res.data?.data) {
    throw new Error('Prometheus 查询失败');
  }
  return res.data.data;
};

export const queryRange = async (query, start, end, step) => {
  const res = await API.get('/api/user/prometheus/query_range', {
    params: { query, start, end, step },
  });
  if (res.data?.status !== 'success' || !res.data?.data) {
    throw new Error('Prometheus 查询失败');
  }
  return res.data.data;
};

// 取 vector 结果中第一个序列的值
export const getVectorValue = (data) => {
  const result = data?.result || [];
  if (result.length === 0) return null;
  const val = parseFloat(result[0].value?.[1]);
  return Number.isFinite(val) ? val : null;
};

// 取 vector 结果所有序列的 [label 值]（用于按 job 聚合的排行）
export const getLabelValues = (data, label = 'job') => {
  const result = data?.result || [];
  return result
    .map((r) => {
      const val = parseFloat(r.value?.[1]);
      return Number.isFinite(val) ? { name: r.metric?.[label] || '', value: val } : null;
    })
    .filter(Boolean);
};

// matrix → ECharts 时间序列所需的 [timestamp_ms, value] 元组
export const getSeries = (data) => {
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
export const formatPercent = (v) =>
  v == null ? '--' : `${(v * 100).toFixed(1)}%`;

// 统计数值格式化：大数用 k/M/B，小数取整或保留 2 位小数
export const formatStat = (v) => {
  if (v == null) return null;
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e4) return `${(v / 1e3).toFixed(1)}k`;
  if (Math.abs(v) >= 100) return v.toFixed(0);
  return v.toFixed(2);
};

// 延迟格式化：<1s 显示毫秒，否则显示秒
export const formatSeconds = (v) => {
  if (v == null) return null;
  if (v < 1) return `${(v * 1000).toFixed(0)} ms`;
  return `${v.toFixed(2)} s`;
};

// 缩短 job 名：去掉 engine-service 后缀、纯数字段与连续重复段
export const shortenJob = (job) => {
  if (!job) return '';
  let name = job.replace(/-engine-service$/, '');
  name = name
    .split('-')
    .filter((seg) => !/^\d+[bB]?$/.test(seg))
    .join('-');
  const parts = name.split('-');
  return parts.filter((p, i) => p !== parts[i - 1]).join('-');
};

// 模型名展示：去掉组织前缀，如 "deepseek-ai/DeepSeek-V4-Flash" -> "DeepSeek-V4-Flash"
export const formatModelName = (name) => {
  if (!name) return '';
  const idx = name.lastIndexOf('/');
  return idx >= 0 ? name.slice(idx + 1) : name;
};

// ---------- 面板标题（含悬浮解释） ----------
export const PanelTitle = ({ title, description }) => {
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
export const StatPanel = ({ title, value, suffix, color, formatter, description }) => {
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

// ---------- Gauge 面板（左右布局：数值 + 进度环） ----------
export const GaugePanel = ({ title, value, color, description }) => {
  const chartRef = React.useRef(null);
  const chartInstance = React.useRef(null);

  React.useEffect(() => {
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

  React.useEffect(() => {
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
      <div
        className='flex flex-col justify-center flex-none mr-4'
        style={{ minWidth: 0 }}
      >
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
