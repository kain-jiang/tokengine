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

import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';
import { StatusContext } from '../../context/Status';
import {
  NativeRow,
  NativeCol,
  NativeCard,
  NativeSpace,
  NativeButton,
  NativeTable,
  NativeTag,
  NativeSelect,
  NativeDatePicker,
  NativeText,
  NativeSpin,
} from './NativeLayout';

// 格式化时间
const formatTimestamp = (ts) => {
  if (!ts) return '-';
  return new Date(ts * 1000).toLocaleString('zh-CN');
};

export default function Reconciliation() {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const isAdmin = statusState?.user?.is_admin === true;

  // 数据状态
  const [reconciliations, setReconciliations] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // 筛选条件
  const [reconcileType, setReconcileType] = useState('');
  const [period, setPeriod] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 获取对账记录列表
  const fetchReconciliations = async () => {
    try {
      setLoading(true);
      const res = await API.get('/api/finance/reconciliations', {
        params: {
          p: page,
          page_size: pageSize,
          ...(reconcileType && { type: reconcileType }),
          ...(period && { period }),
          ...(statusFilter && { status: statusFilter }),
        },
      });
      if (res.data?.success) {
        // 后端返回 { success: true, data: [...], total: 123 }
        setReconciliations(res.data?.data || []);
        setTotal(res.data?.total || 0);
      }
    } catch (error) {
      console.error('获取对账记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReconciliations();
  }, [page, pageSize, reconcileType, period, statusFilter]);

  // 自动对账
  const handleAutoReconcile = async (period) => {
    try {
      const res = await API.post('/api/finance/reconcile', { period });
      if (res.data?.success) {
        showSuccess(t('自动对账成功'));
        fetchReconciliations();
      } else {
        showError(res.data?.message || t('自动对账失败'));
      }
    } catch (error) {
      console.error('自动对账失败:', error);
      showError(t('自动对账失败'));
    }
  };

  // 对账状态标签
  const getStatusTag = (status) => {
    const statusMap = {
      matched: { color: 'green', text: t('已匹配') },
      unmatched: { color: 'red', text: t('未匹配') },
      partial: { color: 'orange', text: t('部分匹配') },
      processing: { color: 'blue', text: t('处理中') },
    };
    const config = statusMap[status] || { color: 'gray', text: status };
    return <NativeTag color={config.color}>{config.text}</NativeTag>;
  };

  // 对账类型标签
  const getTypeTag = (type) => {
    const typeMap = {
      upstream: { color: 'blue', text: t('上游') },
      downstream: { color: 'purple', text: t('下游') },
      cross: { color: 'cyan', text: t('交叉') },
    };
    const config = typeMap[type] || { color: 'gray', text: type };
    return <NativeTag color={config.color}>{config.text}</NativeTag>;
  };

  // 对账记录表格列
  const columns = [
    {
      title: t('对账周期'),
      dataIndex: 'period',
      width: 120,
    },
    {
      title: t('类型'),
      dataIndex: 'type',
      width: 100,
      render: (type) => getTypeTag(type),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 120,
      render: (status) => getStatusTag(status),
    },
    {
      title: t('上游金额'),
      dataIndex: 'upstream_amount',
      width: 120,
      render: (val) => val ? `¥${parseFloat(val).toFixed(2)}` : '-',
    },
    {
      title: t('下游金额'),
      dataIndex: 'downstream_amount',
      width: 120,
      render: (val) => val ? `¥${parseFloat(val).toFixed(2)}` : '-',
    },
    {
      title: t('差异金额'),
      dataIndex: 'difference',
      width: 120,
      render: (val) => {
        if (val == null) return '-';
        const color = val > 0 ? 'red' : val < 0 ? 'orange' : 'green';
        return <span style={{ color }}>{val > 0 ? '+' : ''}¥{parseFloat(val).toFixed(2)}</span>;
      },
    },
    {
      title: t('交易笔数'),
      dataIndex: 'transaction_count',
      width: 100,
      render: (val) => val || 0,
    },
    {
      title: t('对账时间'),
      dataIndex: 'reconciled_at',
      width: 180,
      render: (ts) => formatTimestamp(ts),
    },
  ];

  // 对账类型选项
  const typeOptions = [
    { value: '', label: t('全部') },
    { value: 'upstream', label: t('上游') },
    { value: 'downstream', label: t('下游') },
    { value: 'cross', label: t('交叉') },
  ];

  // 状态选项
  const statusOptions = [
    { value: '', label: t('全部') },
    { value: 'matched', label: t('已匹配') },
    { value: 'unmatched', label: t('未匹配') },
    { value: 'partial', label: t('部分匹配') },
    { value: 'processing', label: t('处理中') },
  ];

  // 快捷对账周期
  const quickPeriods = [
    { label: t('今天'), value: 'today' },
    { label: t('昨天'), value: 'yesterday' },
    { label: t('最近7天'), value: 'last_7d' },
    { label: t('本月'), value: 'current_month' },
  ];

  if (!isAdmin) {
    return (
      <NativeCard bodyStyle={{ padding: '40px' }} style={{ borderRadius: 12, textAlign: 'center' }}>
        <NativeText type="tertiary">{t('仅管理员可访问对账管理功能')}</NativeText>
      </NativeCard>
    );
  }

  return (
    <div>
      {/* 快捷对账 */}
      <NativeCard title={t('快捷对账')} style={{ marginBottom: 16 }}>
        <NativeSpace wrap size={12}>
          {quickPeriods.map((period) => (
            <NativeButton
              key={period.value}
              type="primary"
              theme="light"
              onClick={() => handleAutoReconcile(period.value)}
              size="small"
            >
              {period.label}
            </NativeButton>
          ))}
        </NativeSpace>
      </NativeCard>

      {/* 筛选栏 */}
      <NativeCard bodyStyle={{ padding: '16px 20px' }} style={{ borderRadius: 12, marginBottom: 16 }}>
        <NativeSpace wrap size={12}>
          <NativeSelect
            value={reconcileType}
            onChange={setReconcileType}
            options={typeOptions}
            style={{ width: 120 }}
            clearable
          />
          <NativeSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
            style={{ width: 120 }}
            clearable
          />
          <NativeButton
            theme="solid"
            type="primary"
            onClick={fetchReconciliations}
          >
            {t('查询')}
          </NativeButton>
        </NativeSpace>
      </NativeCard>

      {/* 对账记录表格 */}
      <NativeCard bodyStyle={{ padding: '0 20px 20px' }} style={{ borderRadius: 12 }}>
        <NativeTable
          columns={columns}
          dataSource={reconciliations}
          loading={loading}
          rowKey="id"
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            onChange: (page) => setPage(page),
            onPageSizeChange: (size) => {
              setPageSize(size);
              setPage(1);
            },
            showSizeChanger: true,
            pageSizeActions: [10, 20, 50],
          }}
        />
      </NativeCard>
    </div>
  );
}
