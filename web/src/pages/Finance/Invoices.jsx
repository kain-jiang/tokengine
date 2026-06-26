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
import {
  NativeCard,
  NativeRow,
  NativeCol,
  NativeSpace,
  NativeButton,
  NativeTable,
  NativeTag,
  NativeInput,
  NativeSelect,
  NativeModal,
  NativePopconfirm,
  NativeTextArea,
} from './NativeLayout';

const formatMoney = (value) => {
  if (!value && value !== 0) return '-';
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatTimestamp = (ts) => {
  if (!ts) return '-';
  return new Date(ts * 1000).toLocaleString('zh-CN');
};

export default function Invoices() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
        // 后端返回 { success: true, data: [...], total: 123 }
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

  // 发票状态标签
  const getStatusTag = (status) => {
    const statusMap = {
      pending: { color: 'orange', text: t('待审核') },
      approved: { color: 'blue', text: t('已通过') },
      rejected: { color: 'red', text: t('已拒绝') },
      issued: { color: 'green', text: t('已开具') },
    };
    const config = statusMap[status] || { color: 'gray', text: status };
    return <NativeTag color={config.color}>{config.text}</NativeTag>;
  };

  // 发票类型标签
  const getTypeTag = (type) => {
    const typeMap = {
      electronic: { color: 'purple', text: t('电子发票') },
      paper: { color: 'cyan', text: t('纸质发票') },
    };
    const config = typeMap[type] || { color: 'gray', text: type };
    return <NativeTag color={config.color}>{config.text}</NativeTag>;
  };

  // 发票列表列定义
  const columns = [
    {
      title: t('发票号'),
      dataIndex: 'invoice_no',
      width: 180,
    },
    {
      title: t('用户'),
      dataIndex: 'username',
      render: (username) => username || '-',
    },
    {
      title: t('类型'),
      dataIndex: 'type',
      width: 120,
      render: (type) => getTypeTag(type),
    },
    {
      title: t('抬头'),
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: t('金额'),
      dataIndex: 'amount',
      width: 120,
      render: (value) => formatMoney(value),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 100,
      render: (status) => getStatusTag(status),
    },
    {
      title: t('申请时间'),
      dataIndex: 'created_at',
      width: 180,
      render: (ts) => formatTimestamp(ts),
    },
    {
      title: t('操作'),
      width: 120,
      render: (_, record) => (
        <NativeSpace size={8}>
          {record.status === 'pending' && (
            <NativePopconfirm
              content={t('确定要撤销此申请吗？')}
              onConfirm={() => {
                // TODO: 实现撤销功能
              }}
            >
              <NativeButton type="danger" size="small" theme="borderless">
                {t('撤销')}
              </NativeButton>
            </NativePopconfirm>
          )}
        </NativeSpace>
      ),
    },
  ];

  // 状态选项
  const statusOptions = [
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

  return (
    <div>
      {/* 筛选和操作栏 */}
      <NativeCard style={{ marginBottom: 24 }}>
        <NativeSpace wrap size={12}>
          <NativeSelect
            placeholder={t('状态筛选')}
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
            style={{ width: 150 }}
            clearable
          />
          <NativeInput
            placeholder={t('搜索发票号或抬头')}
            value={keyword}
            onChange={setKeyword}
            style={{ width: 250 }}
            onSearch={() => {
              setPage(1);
              fetchInvoices();
            }}
            clearable
          />
          <NativeButton
            type="primary"
            theme="solid"
            onClick={() => setShowApplyModal(true)}
          >
            {t('申请发票')}
          </NativeButton>
        </NativeSpace>
      </NativeCard>

      {/* 发票列表 */}
      <NativeCard>
        <NativeTable
          columns={columns}
          dataSource={invoiceList}
          loading={loading}
          rowKey="invoice_id"
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            onChange: (page) => setPage(page),
            showTotal: (total) => `共 ${total} 条`,
            pageSizeActions: [10, 20, 50],
          }}
        />
      </NativeCard>

      {/* 申请发票弹窗 */}
      <NativeModal
        title={t('申请发票')}
        visible={showApplyModal}
        onOk={handleApplyInvoice}
        onCancel={() => {
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
        width={600}
        okText={t('提交')}
        cancelText={t('取消')}
        loading={formLoading}
      >
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('发票类型')}</div>
          <NativeSelect
            value={formData.type}
            onChange={(val) => setFormData({ ...formData, type: val })}
            options={typeOptions}
            style={{ width: '100%', marginBottom: 16 }}
          />

          <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('发票金额')} *</div>
          <NativeInput
            value={formData.amount}
            onChange={(val) => setFormData({ ...formData, amount: val })}
            placeholder={t('请输入发票金额')}
            prefix="¥"
            style={{ marginBottom: 16 }}
          />

          <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('发票抬头')} *</div>
          <NativeInput
            value={formData.title}
            onChange={(val) => setFormData({ ...formData, title: val })}
            placeholder={t('请输入发票抬头')}
            style={{ marginBottom: 16 }}
          />

          <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('税号')}</div>
          <NativeInput
            value={formData.tax_number}
            onChange={(val) => setFormData({ ...formData, tax_number: val })}
            placeholder={t('请输入税号（选填）')}
            style={{ marginBottom: 16 }}
          />

          <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('开户银行')}</div>
          <NativeInput
            value={formData.bank}
            onChange={(val) => setFormData({ ...formData, bank: val })}
            placeholder={t('请输入开户银行（选填）')}
            style={{ marginBottom: 16 }}
          />

          <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('银行账号')}</div>
          <NativeInput
            value={formData.bank_account}
            onChange={(val) => setFormData({ ...formData, bank_account: val })}
            placeholder={t('请输入银行账号（选填）')}
            style={{ marginBottom: 16 }}
          />

          <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('注册地址')}</div>
          <NativeInput
            value={formData.address}
            onChange={(val) => setFormData({ ...formData, address: val })}
            placeholder={t('请输入注册地址（选填）')}
            style={{ marginBottom: 16 }}
          />

          <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('联系电话')}</div>
          <NativeInput
            value={formData.phone}
            onChange={(val) => setFormData({ ...formData, phone: val })}
            placeholder={t('请输入联系电话（选填）')}
            style={{ marginBottom: 16 }}
          />

          <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('备注')}</div>
          <NativeTextArea
            value={formData.remark}
            onChange={(val) => setFormData({ ...formData, remark: val })}
            placeholder={t('请输入备注（选填）')}
            rows={3}
          />
        </div>
      </NativeModal>
    </div>
  );
}
