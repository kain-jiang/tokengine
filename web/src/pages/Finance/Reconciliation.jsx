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
import CardPro from '../../components/common/ui/CardPro';
import { formatTimestamp, getStatusTag } from './utils';
import { createCardProPagination } from '../../helpers/utils';
import { useIsMobile } from '../../hooks/common/useIsMobile';

// 对账状态映射
const reconcileStatusMap = {
  matched: { text: '已匹配', color: 'green' },
  unmatched: { text: '未匹配', color: 'red' },
  partial: { text: '部分匹配', color: 'orange' },
  processing: { text: '处理中', color: 'blue' },
};

// 对账类型映射
const reconcileTypeMap = {
  upstream: { text: '上游', color: 'blue' },
  downstream: { text: '下游', color: 'purple' },
  cross: { text: '交叉', color: 'cyan' },
};

export default function Reconciliation() {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const isMobile = useIsMobile();
  const isAdmin = statusState?.user?.is_admin === true;

  // 数据状态
  const [reconciliations, setReconciliations] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [autoReconcileLoading, setAutoReconcileLoading] = useState(false);

  // 筛选条件
  const [reconcileType, setReconcileType] = useState('');
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
          ...(statusFilter && { status: statusFilter }),
        },
      });
      if (res.data?.success) {
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
  }, [page, pageSize, reconcileType, statusFilter]);

  // 自动对账
  const handleAutoReconcile = async (periodValue) => {
    setAutoReconcileLoading(true);
    try {
      const res = await API.post('/api/finance/reconcile', { period: periodValue });
      if (res.data?.success) {
        showSuccess(t('自动对账成功'));
        fetchReconciliations();
      } else {
        showError(res.data?.message || t('自动对账失败'));
      }
    } catch (error) {
      console.error('自动对账失败:', error);
      showError(t('自动对账失败'));
    } finally {
      setAutoReconcileLoading(false);
    }
  };

  // 是否仅管理员可访问
  if (!isAdmin) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
        {t('仅管理员可访问对账管理功能')}
      </div>
    );
  }

  // 快捷对账周期
  const quickPeriods = [
    { label: t('今天'), value: 'today' },
    { label: t('昨天'), value: 'yesterday' },
    { label: t('最近7天'), value: 'last_7d' },
    { label: t('本月'), value: 'current_month' },
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

  // 操作区域 - 快捷对账按钮
  const actionsArea = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0, 0, 0, 0.65)', marginRight: 4 }}>
        {t('快捷对账')}:
      </span>
      {quickPeriods.map((period) => (
        <button
          key={period.value}
          onClick={() => handleAutoReconcile(period.value)}
          disabled={autoReconcileLoading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 32,
            padding: '0 12px',
            border: '1px solid #1677ff',
            borderRadius: 6,
            fontSize: 12,
            backgroundColor: '#fff',
            color: '#1677ff',
            cursor: autoReconcileLoading ? 'not-allowed' : 'pointer',
            opacity: autoReconcileLoading ? 0.6 : 1,
          }}
        >
          {period.label}
        </button>
      ))}
    </div>
  );

  // 搜索区域
  const searchArea = (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      {/* 类型筛选 */}
      <select
        value={reconcileType}
        onChange={(e) => {
          setReconcileType(e.target.value);
          setPage(1);
        }}
        style={{
          height: 32,
          padding: '0 12px',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          fontSize: 12,
          backgroundColor: '#fff',
          minWidth: 120,
          outline: 'none',
        }}
      >
        {typeOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* 状态筛选 */}
      <select
        value={statusFilter}
        onChange={(e) => {
          setStatusFilter(e.target.value);
          setPage(1);
        }}
        style={{
          height: 32,
          padding: '0 12px',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          fontSize: 12,
          backgroundColor: '#fff',
          minWidth: 120,
          outline: 'none',
        }}
      >
        {statusOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* 查询按钮 */}
      <button
        onClick={fetchReconciliations}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 32,
          padding: '0 16px',
          backgroundColor: '#1677ff',
          color: '#fff',
          border: '1px solid #1677ff',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        {t('查询')}
      </button>
    </div>
  );

  // 对账记录表格列
  const columns = [
    { title: t('对账周期'), dataIndex: 'period', width: 120 },
    {
      title: t('类型'), dataIndex: 'type', width: 100,
      render: (type) => getStatusTag(type, reconcileTypeMap, t),
    },
    {
      title: t('状态'), dataIndex: 'status', width: 120,
      render: (status) => getStatusTag(status, reconcileStatusMap, t),
    },
    {
      title: t('上游金额'), dataIndex: 'upstream_amount', width: 120,
      render: (val) => val ? `¥${parseFloat(val).toFixed(2)}` : '-',
    },
    {
      title: t('下游金额'), dataIndex: 'downstream_amount', width: 120,
      render: (val) => val ? `¥${parseFloat(val).toFixed(2)}` : '-',
    },
    {
      title: t('差异金额'), dataIndex: 'difference', width: 120,
      render: (val) => {
        if (val == null) return '-';
        const color = val > 0 ? 'red' : val < 0 ? 'orange' : 'green';
        return <span style={{ color }}>{val > 0 ? '+' : ''}¥{parseFloat(val).toFixed(2)}</span>;
      },
    },
    { title: t('交易笔数'), dataIndex: 'transaction_count', width: 100, render: (val) => val || 0 },
    { title: t('对账时间'), dataIndex: 'reconciled_at', width: 180, render: (ts) => formatTimestamp(ts) },
  ];

  // 表格
  const tableContent = (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ backgroundColor: '#fafafa' }}>
            {columns.map((col) => (
              <th
                key={col.dataIndex}
                style={{
                  padding: '12px 16px',
                  textAlign: col.dataIndex === 'upstream_amount' || col.dataIndex === 'downstream_amount' || col.dataIndex === 'difference' || col.dataIndex === 'transaction_count' ? 'right' : 'left',
                  borderBottom: '1px solid #f0f0f0',
                  fontWeight: 600,
                  color: 'rgba(0, 0, 0, 0.88)',
                  whiteSpace: 'nowrap',
                }}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reconciliations.map((record) => (
            <tr
              key={record.id}
              style={{ borderBottom: '1px solid #f0f0f0', transition: 'background-color 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {columns.map((col) => (
                <td
                  key={`${record.id}-${col.dataIndex}`}
                  style={{
                    padding: '12px 16px',
                    textAlign: col.dataIndex === 'upstream_amount' || col.dataIndex === 'downstream_amount' || col.dataIndex === 'difference' || col.dataIndex === 'transaction_count' ? 'right' : 'left',
                    color: 'rgba(0, 0, 0, 0.65)',
                  }}
                >
                  {col.render ? col.render(record[col.dataIndex], record) : record[col.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
          {reconciliations.length === 0 && !loading && (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: '40px 16px', textAlign: 'center', color: '#999' }}
              >
                {t('暂无数据')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  // 分页
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
    <CardPro
      type='type2'
      actionsArea={actionsArea}
      searchArea={searchArea}
      paginationArea={paginationArea}
      t={t}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid #f0f0f0',
              borderTopColor: '#1677ff',
              borderRadius: '50%',
              animation: 'semi-spin 0.6s infinite linear',
              margin: '0 auto',
            }}
          />
        </div>
      ) : (
        tableContent
      )}
    </CardPro>
  );
}
