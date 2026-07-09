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

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, showError, showSuccess } from '../../helpers';
import { useTranslation } from 'react-i18next';
import CardPro from '../../components/common/ui/CardPro';
import { formatMoney, formatTimestamp, getStatusTag, getTypeTag } from './utils';
import { createCardProPagination } from '../../helpers/utils';
import { useIsMobile } from '../../hooks/common/useIsMobile';

// 发票状态映射
const invoiceStatusMap = {
  pending: { text: '待审核', color: 'orange' },
  approved: { text: '已通过', color: 'blue' },
  rejected: { text: '已拒绝', color: 'red' },
  issued: { text: '已开具', color: 'green' },
};

// 发票类型映射
const invoiceTypeMap = {
  electronic: { text: '电子发票', color: 'purple' },
  paper: { text: '纸质发票', color: 'cyan' },
};

export default function Invoices() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [invoiceList, setInvoiceList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // 筛选条件
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');

  // 表单数据
  const [formData, setFormData] = useState({
    type: 'electronic',
    amount: '',
    title: '',
    tax_number: '',
    bank: '',
    bank_account: '',
    address: '',
    phone: '',
    remark: '',
  });

  // 获取发票列表
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await API.get('/api/finance/invoices', {
        params: {
          p: page,
          page_size: pageSize,
          ...(statusFilter && { status: statusFilter }),
          ...(keyword && { keyword }),
        },
      });
      if (res.data?.success) {
        setInvoiceList(res.data?.data || []);
        setTotal(res.data?.total || 0);
      }
    } catch (error) {
      console.error('获取发票列表失败:', error);
      showError(t('获取发票列表失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [page, pageSize, statusFilter]);

  // 申请发票
  const handleApplyInvoice = async () => {
    if (!formData.amount || !formData.title) {
      showError(t('请填写必填字段'));
      return;
    }
    try {
      setFormLoading(true);
      const res = await API.post('/api/finance/invoice', formData);
      if (res.data?.success) {
        showSuccess(t('发票申请已提交'));
        setShowApplyModal(false);
        setFormData({
          type: 'electronic',
          amount: '',
          title: '',
          tax_number: '',
          bank: '',
          bank_account: '',
          address: '',
          phone: '',
          remark: '',
        });
        fetchInvoices();
      } else {
        showError(res.data?.message || t('申请失败'));
      }
    } catch (error) {
      console.error('申请发票失败:', error);
      showError(t('申请发票失败'));
    } finally {
      setFormLoading(false);
    }
  };

  // 状态选项
  const statusOptions = [
    { value: '', label: t('全部') },
    { value: 'pending', label: t('待审核') },
    { value: 'approved', label: t('已通过') },
    { value: 'rejected', label: t('已拒绝') },
    { value: 'issued', label: t('已开具') },
  ];

  // 发票类型选项
  const typeOptions = [
    { value: 'electronic', label: t('电子发票') },
    { value: 'paper', label: t('纸质发票') },
  ];

  // 搜索区域
  const searchArea = (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
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
          minWidth: 150,
          outline: 'none',
        }}
      >
        {statusOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* 关键词搜索 */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          height: 32,
          minWidth: 250,
          backgroundColor: '#fff',
        }}
      >
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={t('搜索发票号或抬头')}
          style={{
            border: 'none',
            outline: 'none',
            fontSize: 12,
            padding: '0 12px',
            flex: 1,
            backgroundColor: 'transparent',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1);
              fetchInvoices();
            }
          }}
        />
        {keyword && (
          <button
            onClick={() => { setKeyword(''); setPage(1); }}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 14,
              color: '#999',
              padding: '0 8px',
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* 申请发票按钮 */}
      <button
        onClick={() => setShowApplyModal(true)}
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
        {t('申请发票')}
      </button>
    </div>
  );

  // 表格列定义
  const columns = [
    {
      title: t('发票号'),
      dataIndex: 'invoice_no',
      key: 'invoice_no',
      width: 180,
    },
    {
      title: t('用户'),
      dataIndex: 'username',
      key: 'username',
      render: (username) => username || '-',
    },
    {
      title: t('类型'),
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type) => getTypeTag(type, invoiceTypeMap, t),
    },
    {
      title: t('抬头'),
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: t('金额'),
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (value) => formatMoney(value),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => getStatusTag(status, invoiceStatusMap, t),
    },
    {
      title: t('申请时间'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (ts) => formatTimestamp(ts),
    },
    {
      title: t('操作'),
      key: 'action',
      width: 120,
      render: (_, record) => (
        record.status === 'pending' ? (
          <button
            onClick={() => {
              // TODO: 实现撤销功能
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 12px',
              border: 'none',
              background: 'none',
              color: '#ff4d4f',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {t('撤销')}
          </button>
        ) : null
      ),
    },
  ];

  // 发票列表表格
  const invoiceTable = (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#fafafa' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: '12px 16px',
                  textAlign: col.key === 'amount' ? 'right' : 'left',
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
          {invoiceList.map((invoice) => (
            <tr
              key={invoice.invoice_id}
              style={{ borderBottom: '1px solid #f0f0f0', transition: 'background-color 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {columns.map((col) => (
                <td
                  key={`${invoice.invoice_id}-${col.key}`}
                  style={{
                    padding: '12px 16px',
                    textAlign: col.key === 'amount' ? 'right' : 'left',
                    color: 'rgba(0, 0, 0, 0.65)',
                  }}
                >
                  {col.render ? col.render(invoice, invoice) : invoice[col.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
          {invoiceList.length === 0 && !loading && (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: '40px 16px',
                  textAlign: 'center',
                  color: '#999',
                }}
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

  // 申请发票弹窗
  const applyModal = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={() => !formLoading && setShowApplyModal(false)}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 8,
          width: '90%',
          maxWidth: 600,
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>
          {t('申请发票')}
        </div>

        {/* 表单 */}
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 14 }}>{t('发票类型')}</div>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, marginBottom: 16, outline: 'none' }}
          >
            {typeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 14 }}>{t('发票金额')} *</div>
          <input
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            placeholder={t('请输入发票金额')}
            style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, marginBottom: 16, outline: 'none', boxSizing: 'border-box' }}
          />

          <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 14 }}>{t('发票抬头')} *</div>
          <input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder={t('请输入发票抬头')}
            style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, marginBottom: 16, outline: 'none', boxSizing: 'border-box' }}
          />

          <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 14 }}>{t('税号')}</div>
          <input
            value={formData.tax_number}
            onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
            placeholder={t('请输入税号（选填）')}
            style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, marginBottom: 16, outline: 'none', boxSizing: 'border-box' }}
          />

          <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 14 }}>{t('开户银行')}</div>
          <input
            value={formData.bank}
            onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
            placeholder={t('请输入开户银行（选填）')}
            style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, marginBottom: 16, outline: 'none', boxSizing: 'border-box' }}
          />

          <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 14 }}>{t('银行账号')}</div>
          <input
            value={formData.bank_account}
            onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
            placeholder={t('请输入银行账号（选填）')}
            style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, marginBottom: 16, outline: 'none', boxSizing: 'border-box' }}
          />

          <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 14 }}>{t('注册地址')}</div>
          <input
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder={t('请输入注册地址（选填）')}
            style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, marginBottom: 16, outline: 'none', boxSizing: 'border-box' }}
          />

          <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 14 }}>{t('联系电话')}</div>
          <input
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder={t('请输入联系电话（选填）')}
            style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, marginBottom: 16, outline: 'none', boxSizing: 'border-box' }}
          />

          <div style={{ marginBottom: 16, fontWeight: 500, fontSize: 14 }}>{t('备注')}</div>
          <textarea
            value={formData.remark}
            onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
            placeholder={t('请输入备注（选填）')}
            rows={3}
            style={{ width: '100%', padding: '12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, marginBottom: 20, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
          />

          {/* 按钮 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button
              onClick={() => {
                setShowApplyModal(false);
                setFormData({
                  type: 'electronic',
                  amount: '',
                  title: '',
                  tax_number: '',
                  bank: '',
                  bank_account: '',
                  address: '',
                  phone: '',
                  remark: '',
                });
              }}
              disabled={formLoading}
              style={{
                height: 40,
                padding: '0 20px',
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                fontSize: 14,
                backgroundColor: '#fff',
                cursor: formLoading ? 'not-allowed' : 'pointer',
                opacity: formLoading ? 0.6 : 1,
              }}
            >
              {t('取消')}
            </button>
            <button
              onClick={handleApplyInvoice}
              disabled={formLoading}
              style={{
                height: 40,
                padding: '0 20px',
                border: '1px solid #1677ff',
                borderRadius: 6,
                fontSize: 14,
                backgroundColor: '#1677ff',
                color: '#fff',
                cursor: formLoading ? 'not-allowed' : 'pointer',
                opacity: formLoading ? 0.6 : 1,
              }}
            >
              {t('提交')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <CardPro
      type='type2'
      searchArea={searchArea}
      paginationArea={paginationArea}
      t={t}
    >
      {loading && invoiceList.length === 0 ? (
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
        invoiceTable
      )}

      {showApplyModal && applyModal}
    </CardPro>
  );
}
