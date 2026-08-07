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
import React, { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Card, Empty, Spin, Table } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import { initVChartSemiTheme } from '@visactor/vchart-semi-theme';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Trophy,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API, getLobeHubIcon, showError } from '../../helpers';

const PERIODS = [
  { value: 'today', label: '近 24 小时' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'year', label: '本年' },
];

const CHART_COLORS = [
  '#4f7cff',
  '#7f6df2',
  '#35a67b',
  '#d18b35',
  '#d45f75',
  '#4ba3a3',
  '#8f6b52',
  '#6f8b45',
  '#8d72c7',
  '#8391a5',
  '#a1a8b3',
];

const formatTokens = (value) =>
  new Intl.NumberFormat(undefined, {
    notation: Number(value) >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(Number(value) || 0);

const formatGrowth = (value) => {
  const numeric = Number(value) || 0;
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(1)}%`;
};

const formatVendorName = (vendor, t) =>
  vendor === 'Unknown' || !vendor ? t('未知供应商') : vendor;

const renderModelIcon = (row, size = 32) => {
  const iconName = row?.icon || row?.vendor_icon;
  const displayName = row?.model_name || row?.vendor || '';
  const iconSize = Math.max(size - 8, 16);

  return (
    <div
      className='flex shrink-0 items-center justify-center rounded-lg border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-1)]'
      style={{ width: size, height: size }}
      aria-hidden='true'
    >
      {iconName ? (
        getLobeHubIcon(iconName, iconSize)
      ) : (
        <Avatar
          size='extra-extra-small'
          style={{
            background: 'var(--semi-color-fill-1)',
            color: 'var(--semi-color-text-2)',
          }}
        >
          {(displayName.slice(0, 2) || 'AI').toUpperCase()}
        </Avatar>
      )}
    </div>
  );
};

const Rankings = () => {
  const { t } = useTranslation();
  const [period, setPeriod] = useState('week');
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initVChartSemiTheme({ isWatchingThemeSwitch: true });
  }, []);

  useEffect(() => {
    let active = true;
    const loadRankings = async () => {
      setLoading(true);
      try {
        const response = await API.get('/api/rankings', {
          params: { period, _ts: Date.now() },
          headers: { 'Cache-Control': 'no-cache' },
          skipErrorHandler: true,
        });
        if (!response.data?.success) {
          throw new Error(response.data?.message || t('排行榜加载失败'));
        }
        if (active) {
          setSnapshot(response.data.data);
        }
      } catch (error) {
        if (active) {
          setSnapshot(null);
          showError(
            error?.response?.data?.message ||
              error.message ||
              t('排行榜加载失败'),
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    loadRankings();
    return () => {
      active = false;
    };
  }, [period, t]);

  const historySpec = useMemo(() => {
    const points = snapshot?.models_history?.points || [];
    if (points.length === 0) return null;
    return {
      type: 'bar',
      data: [{ id: 'ranking-history', values: points }],
      xField: 'label',
      yField: 'tokens',
      seriesField: 'model',
      stack: true,
      color: CHART_COLORS,
      legends: { visible: false },
      axes: [
        {
          orient: 'bottom',
          label: { autoHide: true, autoLimit: true },
          tick: { visible: false },
        },
        {
          orient: 'left',
          label: { formatMethod: (value) => formatTokens(value) },
          grid: { visible: true, style: { lineDash: [3, 3] } },
        },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum?.model || '',
              value: (datum) => formatTokens(datum?.tokens),
            },
          ],
        },
        dimension: {
          content: [
            {
              key: (datum) => datum?.model || '',
              value: (datum) => formatTokens(datum?.tokens),
            },
          ],
        },
      },
      animationAppear: { duration: 350 },
    };
  }, [snapshot]);

  const modelColumns = useMemo(
    () => [
      {
        title: t('排名'),
        dataIndex: 'rank',
        width: 64,
        render: (rank) => (
          <span className='text-sm font-normal text-[var(--semi-color-text-2)]'>
            {String(rank).padStart(2, '0')}
          </span>
        ),
      },
      {
        title: t('模型'),
        dataIndex: 'model_name',
        render: (name, row) => (
          <div className='flex min-w-0 items-center gap-3'>
            {renderModelIcon(row)}
            <div className='min-w-0'>
              <div className='truncate font-medium text-[var(--semi-color-text-0)]'>
                {name}
              </div>
              <div className='mt-0.5 truncate text-xs text-[var(--semi-color-text-2)]'>
                {formatVendorName(row.vendor, t)}
              </div>
            </div>
          </div>
        ),
      },
      {
        title: t('Token 用量'),
        dataIndex: 'total_tokens',
        align: 'right',
        width: 132,
        render: (value) => (
          <span className='text-sm font-normal'>{formatTokens(value)}</span>
        ),
      },
      {
        title: t('占比'),
        dataIndex: 'share',
        align: 'right',
        width: 104,
        render: (value) => (
          <span className='text-sm font-normal'>
            {((Number(value) || 0) * 100).toFixed(1) + '%'}
          </span>
        ),
      },
      {
        title: t('较上一周期'),
        dataIndex: 'growth_pct',
        align: 'right',
        width: 148,
        render: (value) => {
          const positive = Number(value) >= 0;
          return (
            <span
              className={`inline-flex items-center gap-1 text-sm font-normal ${
                positive ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {positive ? (
                <ArrowUpRight size={13} />
              ) : (
                <ArrowDownRight size={13} />
              )}
              {formatGrowth(value)}
            </span>
          );
        },
      },
    ],
    [t],
  );

  const models = snapshot?.models || [];
  const vendors = snapshot?.vendors || [];

  return (
    <div className='min-h-full overflow-y-auto px-4 pb-6 pt-[88px] sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-[1280px]'>
        <header className='mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <h1 className='m-0 text-2xl font-semibold tracking-tight text-[var(--semi-color-text-0)]'>
              {t('排行榜')}
            </h1>
            <p className='mb-0 mt-2 text-sm text-[var(--semi-color-text-2)]'>
              {t('探索平台使用最多的模型和增长中的供应商')}
            </p>
          </div>
          <div className='flex items-center rounded-lg border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-1)] p-1'>
            {PERIODS.map((item) => (
              <Button
                key={item.value}
                theme={period === item.value ? 'solid' : 'borderless'}
                type={period === item.value ? 'primary' : 'tertiary'}
                size='small'
                onClick={() => setPeriod(item.value)}
              >
                {t(item.label)}
              </Button>
            ))}
          </div>
        </header>

        <Spin spinning={loading} size='large'>
          {!loading && !snapshot ? (
            <Card className='card-new'>
              <Empty title={t('暂无排行数据')} description={t('请稍后重试')} />
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className='grid grid-cols-1 gap-4 xl:grid-cols-3'>
                <Card
                  className='card-new xl:col-span-2'
                  title={
                    <div className='flex items-center gap-2'>
                      <BarChart3 size={17} />
                      <span>{t('模型用量趋势')}</span>
                    </div>
                  }
                  headerLine
                  bordered
                >
                  <div className='h-[320px]'>
                    {historySpec ? (
                      <VChart
                        spec={historySpec}
                        option={{ mode: 'desktop-browser' }}
                      />
                    ) : (
                      <Empty title={t('暂无趋势数据')} />
                    )}
                  </div>
                </Card>

                <Card
                  className='card-new'
                  title={
                    <div className='flex items-center gap-2'>
                      <Building2 size={17} />
                      <span>{t('供应商份额')}</span>
                    </div>
                  }
                  headerLine
                  bordered
                >
                  {vendors.length === 0 ? (
                    <Empty title={t('暂无供应商数据')} />
                  ) : (
                    <div className='space-y-4'>
                      {vendors.slice(0, 8).map((vendor, index) => (
                        <div
                          key={vendor.vendor}
                          className='grid grid-cols-[20px_30px_minmax(0,1fr)] grid-rows-[30px_6px] items-center gap-x-2 gap-y-1.5'
                        >
                          <span className='row-span-2 text-sm font-normal text-[var(--semi-color-text-2)]'>
                            {vendor.rank}.
                          </span>
                          <div className='row-span-2 flex items-center'>
                            {renderModelIcon(vendor, 30)}
                          </div>
                          <div className='flex min-w-0 items-center justify-between gap-3 text-sm'>
                            <span className='truncate font-medium'>
                              {vendor.vendor === 'Unknown'
                                ? t('未知供应商')
                                : vendor.vendor}
                            </span>
                            <span className='shrink-0 text-sm font-normal text-[var(--semi-color-text-1)]'>
                              {(vendor.share * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className='h-1.5 overflow-hidden rounded-full bg-[var(--semi-color-fill-0)]'>
                            <div
                              className='h-full rounded-full'
                              style={{
                                width: Math.max(vendor.share * 100, 1) + '%',
                                backgroundColor:
                                  CHART_COLORS[index % CHART_COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              <Card
                className='card-new ranking-table-card'
                title={
                  <div className='flex items-center gap-2'>
                    <Trophy size={17} />
                    <span>{t('热门模型')}</span>
                  </div>
                }
                headerLine
                bordered
                bodyStyle={{ padding: 0 }}
              >
                <Table
                  className='ranking-model-table'
                  columns={modelColumns}
                  dataSource={models}
                  rowKey='model_name'
                  pagination={false}
                  empty={<Empty title={t('暂无趋势数据')} />}
                />
              </Card>

              <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
                <MoverCard
                  title={t('上升最快')}
                  rows={snapshot?.top_movers || []}
                  intent='up'
                  emptyText={t('本周期暂无明显上升模型')}
                  t={t}
                />
                <MoverCard
                  title={t('下降最快')}
                  rows={snapshot?.top_droppers || []}
                  intent='down'
                  emptyText={t('本周期暂无明显下降模型')}
                  t={t}
                />
              </div>
            </div>
          )}
        </Spin>
      </div>
    </div>
  );
};

const MoverCard = ({ title, rows, intent, emptyText, t }) => (
  <Card
    className='card-new'
    title={
      <div className='flex items-center gap-2'>
        {intent === 'up' ? (
          <ArrowUpRight size={17} className='text-emerald-600' />
        ) : (
          <ArrowDownRight size={17} className='text-rose-600' />
        )}
        <span>{title}</span>
      </div>
    }
    headerLine
    bordered
  >
    {rows.length === 0 ? (
      <Empty title={emptyText} />
    ) : (
      <div className='divide-y divide-[var(--semi-color-border)]'>
        {rows.map((row) => (
          <div
            key={row.model_name}
            className='flex items-center gap-3 py-3 first:pt-0 last:pb-0'
          >
            {renderModelIcon(row, 30)}
            <div className='min-w-0 flex-1'>
              <div className='truncate text-sm font-medium'>
                {row.model_name}
              </div>
              <div className='mt-1 text-xs text-[var(--semi-color-text-2)]'>
                #{row.current_rank} · {formatVendorName(row.vendor, t)}
              </div>
            </div>
            <span
              className={`font-mono text-sm font-semibold tabular-nums ${
                intent === 'up' ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {intent === 'up' ? '+' : ''}
              {row.rank_delta}
            </span>
          </div>
        ))}
      </div>
    )}
  </Card>
);

export default Rankings;
