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
import { useNavigate } from 'react-router-dom';
import { API, showError } from '../../../helpers';
import { Button, DatePicker, Input, Table, Toast, Typography } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { Download } from 'lucide-react';
import CardPro from '../../../components/common/ui/CardPro';
import { createCardProPagination } from '../../../helpers/utils';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { formatMoney, formatNumber } from '../utils';

const { Text } = Typography;

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return [start, end];
}

export default function RevenueList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [stats, setStats] = useState({ totalTopup: 0, totalUsed: 0, totalRemain: 0 });

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

  const fetchData = async (currentPage, currentPageSize) => {
    setLoading(true);
    try {
      const res = await API.get('/api/finance/reports', {
        params: {
          p: currentPage,
          page_size: currentPageSize,
          keyword: keyword,
          start_date: startDate,
          end_date: endDate,
        },
      });
      if (res.data?.success) {
        setData(res.data?.data || []);
        setTotal(res.data?.total || 0);
        setStats(res.data?.stats || { total_topup_money: 0, total_used_money: 0, total_remain_money: 0 });
      } else {
        Toast.error({ content: res.data?.message || t('加载失败') });
      }
    } catch (error) {
      console.error('获取用户分析数据列表失败:', error);
      showError(t('获取用户分析数据列表失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(page, pageSize);
  }, [page, pageSize, keyword, startDate, endDate]);

  const handleSearch = () => {
    setPage(1);
    setKeyword(searchValue);
  };

  const handleReset = () => {
    setSearchValue('');
    setKeyword('');
    setDateRange(getDefaultDateRange());
    setPage(1);
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res = await API.get('/api/finance/reports/export', {
        params: { keyword, start_date: startDate, end_date: endDate },
        responseType: 'blob',
      });
      // 检查返回的 blob 是否是 JSON 错误响应
      const contentType = res.headers['content-type'];
      if (contentType && contentType.includes('application/json')) {
        // 将 blob 转换为文本并解析 JSON
        const text = await res.data.text();
        const json = JSON.parse(text);
        Toast.error({ content: json.message || t('导出失败') });
        return;
      }
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `revenue_users_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      Toast.success({ content: t('导出成功') });
    } catch (error) {
      console.error('导出失败:', error);
      Toast.error({ content: t('导出失败') });
    } finally {
      setExportLoading(false);
    }
  };

  const handleViewDetail = (record) => {
    navigate(`/console/finance/revenue/detail/${record.id}`);
  };

  const statsArea = (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, flex: 1, minWidth: 180 }}>
        <div style={{ color: '#999', fontSize: 14, marginBottom: 8 }}>{t('用户总数')}</div>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1677ff' }}>{formatNumber(total)}</div>
      </div>
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, flex: 1, minWidth: 180 }}>
        <div style={{ color: '#999', fontSize: 14, marginBottom: 8 }}>{t('充值总额')}</div>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: '#10b981' }}>{formatMoney(stats.total_topup_money)}</div>
      </div>
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, flex: 1, minWidth: 180 }}>
        <div style={{ color: '#999', fontSize: 14, marginBottom: 8 }}>{t('使用总额')}</div>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: '#f5222d' }}>{formatMoney(stats.total_used_money)}</div>
      </div>
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, flex: 1, minWidth: 180 }}>
        <div style={{ color: '#999', fontSize: 14, marginBottom: 8 }}>{t('剩余总额')}</div>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: '#8b5cf6' }}>{formatMoney(stats.total_remain_money)}</div>
      </div>
    </div>
  );

  const searchArea = (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <Input
        prefix={<IconSearch />}
        placeholder={t('搜索用户名')}
        value={searchValue}
        onChange={(value) => setSearchValue(value)}
        onEnterPress={handleSearch}
        style={{ width: 280 }}
      />
      <DatePicker
        type='dateRange'
        value={dateRange}
        onChange={(dates) => setDateRange(dates || [])}
        style={{ width: 280 }}
        placeholder={[t('开始日期'), t('结束日期')]}
      />
      <Button type='primary' onClick={handleSearch}>
        {t('查询')}
      </Button>
      <Button onClick={handleReset}>
        {t('重置')}
      </Button>
      <Button icon={<Download size={16} />} loading={exportLoading} onClick={handleExport}>
        {t('导出')}
      </Button>
    </div>
  );

  const columns = [
    {
      title: t('序号'),
      key: 'id',
      width: 80,
      render: (_, __, index) => (page - 1) * pageSize + index + 1,
    },
    {
      title: t('用户名'),
      dataIndex: 'username',
      key: 'username',
      render: (text, record) => (
        <div>
          <div>{text}</div>
        </div>
      ),
    },
    { title: t('充值总额'), dataIndex: 'total_topup_money', key: 'total_topup_money', render: (v) => formatMoney(v) },
    { title: t('使用总额'), dataIndex: 'total_used_money', key: 'total_used_money', render: (v) => formatMoney(v) },
    { title: t('剩余总额'), dataIndex: 'total_remain_money', key: 'total_remain_money', render: (v) => formatMoney(v) },
    { title: t('token剩余额度'), dataIndex: 'token_remain', key: 'token_remain', render: (v) => formatNumber(v) },
    { title: t('token使用额度'), dataIndex: 'token_used', key: 'token_used', render: (v) => formatNumber(v) },
    {
      title: t('操作'),
      key: 'action',
      width: 160,
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type='primary' size='small' onClick={() => handleViewDetail(record)}>
            {t('详情')}
          </Button>
          <Button size='small' disabled>
            {t('返点')}
          </Button>
        </div>
      ),
    },
  ];

  const paginationArea = createCardProPagination({
    currentPage: page,
    pageSize: pageSize,
    total: total,
    onPageChange: setPage,
    onPageSizeChange: (size) => {
      setPageSize(size);
      setPage(1);
    },
    isMobile: isMobile,
    t: t,
  });

  return (
    <CardPro type='type2' statsArea={statsArea} searchArea={searchArea} paginationArea={paginationArea} t={t}>
      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
        empty={t('暂无数据')}
        rowKey='id'
      />
    </CardPro>
  );
}
