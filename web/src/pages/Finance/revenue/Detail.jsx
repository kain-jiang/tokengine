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
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { API, showError } from '../../../helpers';
import { Button, Card, DatePicker, Toast, Typography } from '@douyinfe/semi-ui';
import { IconArrowLeft } from '@douyinfe/semi-icons';
import { VChart } from '@visactor/react-vchart';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { formatMoney, formatNumber } from '../utils';

const { Title, Text } = Typography;

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return [start, end];
}

export default function RevenueDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userId } = useParams();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [dateRange, setDateRange] = useState(getDefaultDateRange());

  const startDate = useMemo(() => {
    if (dateRange && dateRange.length === 2 && dateRange[0]) {
      return dateRange[0].toISOString().slice(0, 10);
    }
    return '';
  }, [dateRange]);

  const endDate = useMemo(() => {
    if (dateRange && dateRange.length === 2 && dateRange[1]) {
      return dateRange[1].toISOString().slice(0, 10);
    }
    return '';
  }, [dateRange]);

  const fetchDetail = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await API.get(`/api/finance/users/${userId}/revenue`, {
        params: {
          start_date: startDate,
          end_date: endDate,
        },
      });
      if (res.data?.success) {
        setDetail(res.data?.data || null);
      } else {
        Toast.error({ content: res.data?.message || t('加载失败') });
      }
    } catch (error) {
      console.error('获取用户营收详情失败:', error);
      showError(t('获取用户营收详情失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [userId, startDate, endDate]);

  const statsCards = detail ? (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(6, 1fr)', gap: 16, marginBottom: 24 }}>
      <Card style={{ padding: '16px 20px' }}>
        <Text type='tertiary'>{t('充值总额')}</Text>
        <Title heading={4} style={{ color: '#10b981' }}>{formatMoney(detail.total_topup_money)}</Title>
      </Card>
      <Card style={{ padding: '16px 20px' }}>
        <Text type='tertiary'>{t('使用总额')}</Text>
        <Title heading={4} style={{ color: '#f5222d' }}>{formatMoney(detail.total_used_money)}</Title>
      </Card>
      <Card style={{ padding: '16px 20px' }}>
        <Text type='tertiary'>{t('剩余总额')}</Text>
        <Title heading={4} style={{ color: '#8b5cf6' }}>{formatMoney(detail.total_remain_money)}</Title>
      </Card>
      <Card style={{ padding: '16px 20px' }}>
        <Text type='tertiary'>{t('用户总token')}</Text>
        <Title heading={4}>{formatNumber(detail.token_total)}</Title>
      </Card>
      <Card style={{ padding: '16px 20px' }}>
        <Text type='tertiary'>{t('使用token')}</Text>
        <Title heading={4}>{formatNumber(detail.token_used)}</Title>
      </Card>
      <Card style={{ padding: '16px 20px' }}>
        <Text type='tertiary'>{t('剩余token')}</Text>
        <Title heading={4}>{formatNumber(detail.token_remain)}</Title>
      </Card>
    </div>
  ) : null;

  const moneyPieSpec = useMemo(() => {
    if (!detail) return { type: 'pie', data: [{ id: 'data', values: [] }] };
    return {
      type: 'pie',
      data: [
        {
          id: 'data',
          values: [
            { type: t('使用总额'), value: detail.total_used_money },
            { type: t('剩余总额'), value: detail.total_remain_money },
          ],
        },
      ],
      categoryField: 'type',
      valueField: 'value',
      outerRadius: 0.8,
      innerRadius: 0.5,
      title: { visible: true, text: t('使用总额 / 剩余总额') },
      legends: { visible: true, orient: 'bottom' },
      label: { visible: true },
      tooltip: {
        mark: {
          content: [{ key: (datum) => datum['type'], value: (datum) => formatMoney(datum['value']) }],
        },
      },
    };
  }, [detail, t]);

  const tokenPieSpec = useMemo(() => {
    if (!detail) return { type: 'pie', data: [{ id: 'data', values: [] }] };
    return {
      type: 'pie',
      data: [
        {
          id: 'data',
          values: [
            { type: t('使用token'), value: detail.token_used },
            { type: t('剩余token'), value: detail.token_remain },
          ],
        },
      ],
      categoryField: 'type',
      valueField: 'value',
      outerRadius: 0.8,
      innerRadius: 0.5,
      title: { visible: true, text: t('使用token / 剩余token') },
      legends: { visible: true, orient: 'bottom' },
      label: { visible: true },
      tooltip: {
        mark: {
          content: [{ key: (datum) => datum['type'], value: (datum) => formatNumber(datum['value']) }],
        },
      },
    };
  }, [detail, t]);

  const trendLineSpec = useMemo(() => {
    if (!detail || !detail.trend) return { type: 'line', data: [{ id: 'data', values: [] }] };
    const values = detail.trend.map((item) => ({
      date: item.date,
      value: item.used_quota,
    }));
    return {
      type: 'line',
      data: [{ id: 'data', values }],
      xField: 'date',
      yField: 'value',
      legends: { visible: false },
      title: { visible: true, text: t('token额度消耗趋势') },
      tooltip: {
        mark: {
          content: [{ key: t('使用token'), value: (datum) => formatNumber(datum['value']) }],
        },
      },
    };
  }, [detail, t]);

  const modelBarSpec = useMemo(() => {
    if (!detail || !detail.model_consumption) return { type: 'bar', data: [{ id: 'data', values: [] }] };
    const values = detail.model_consumption.map((item) => ({
      model: item.model_name,
      quota: item.quota,
      count: item.count,
    }));
    return {
      type: 'bar',
      data: [{ id: 'data', values }],
      xField: 'model',
      yField: 'quota',
      seriesField: 'model',
      title: { visible: true, text: t('模型消耗量') },
      label: { visible: true },
      tooltip: {
        mark: {
          content: [
            { key: (datum) => datum['model'], value: (datum) => formatNumber(datum['quota']) },
            { key: t('调用次数'), value: (datum) => formatNumber(datum['count']) },
          ],
        },
      },
    };
  }, [detail, t]);

  const countLineSpec = useMemo(() => {
    if (!detail || !detail.trend) return { type: 'line', data: [{ id: 'data', values: [] }] };
    const values = detail.trend.map((item) => ({
      date: item.date,
      value: item.count || 0,
    }));
    return {
      type: 'line',
      data: [{ id: 'data', values }],
      xField: 'date',
      yField: 'value',
      legends: { visible: false },
      title: { visible: true, text: t('模型调用趋势') },
      line: {
        style: {
          stroke: '#FFB848',
        },
      },
      point: {
        style: {
          fill: '#FFB848',
        },
      },
      tooltip: {
        mark: {
          content: [{ key: t('调用次数'), value: (datum) => formatNumber(datum['value']) }],
        },
      },
    };
  }, [detail, t]);

  return (
    <div style={{ padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Button icon={<IconArrowLeft />} onClick={() => navigate('/console/finance/revenue')}>
          {t('返回')}
        </Button>
        <Title heading={4} style={{ margin: 0 }}>
          {t('用户大屏')}
        </Title>
        {detail && (
          <Text type='tertiary'>
            {detail.username} {detail.display_name ? `(${detail.display_name})` : ''}
          </Text>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <DatePicker
          type='dateRange'
          value={dateRange}
          onChange={(dates) => setDateRange(dates || [])}
          style={{ width: 280 }}
          placeholder={[t('开始日期'), t('结束日期')]}
        />
        <Button type='primary' onClick={fetchDetail} loading={loading}>
          {t('查询')}
        </Button>
      </div>

      {statsCards}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card loading={loading}>
          <div style={{ height: 360 }}>
            <VChart spec={moneyPieSpec} />
          </div>
        </Card>
        <Card loading={loading}>
          <div style={{ height: 360 }}>
            <VChart spec={tokenPieSpec} />
          </div>
        </Card>
      </div>

      <Card loading={loading} style={{ marginBottom: 24 }}>
        <div style={{ height: 360 }}>
          <VChart spec={trendLineSpec} />
        </div>
      </Card>

      <Card loading={loading} style={{ marginBottom: 24 }}>
        <div style={{ height: 360 }}>
          <VChart spec={countLineSpec} />
        </div>
      </Card>

      <Card loading={loading}>
        <div style={{ height: 360 }}>
          <VChart spec={modelBarSpec} />
        </div>
      </Card>
    </div>
  );
}
