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
import { API, showError } from '../../helpers';
import { useTranslation } from 'react-i18next';
import CardPro from '../../components/common/ui/CardPro';
import { formatMoney, formatTimestamp, getStatusTag, getTypeTag } from './utils';
import { createCardProPagination } from '../../helpers/utils';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { DatePicker, Empty, Table, Typography, Modal, Tag } from '@douyinfe/semi-ui';
import { IllustrationNoResult, IllustrationNoResultDark } from '@douyinfe/semi-illustrations';

const { Text } = Typography;

// 发票状态映射
const invoiceStatusMap = {
  pending: { text: '待开票', color: 'orange' },
  running: { text: '开票中', color: 'blue' },
  completed: { text: '已开票', color: 'green' },
  failed: { text: '开票失败', color: 'red' },
};

// 发票类型映射
const invoiceTypeMap = {
  GENERAL_INVOICE: { text: '增值税普通发票', color: 'purple' },
  SPECIAL_INVOICE: { text: '增值税专用发票', color: 'cyan' },
};

export default function Invoices() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [invoiceList, setInvoiceList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 筛选条件
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [dateRange, setDateRange] = useState([]);

  // 详情弹窗
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);

  // 更新弹窗
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [updateForm, setUpdateForm] = useState({
    status: '',
    invoice_url: '',
    remark: '',
  });
  const fileInputRef = React.createRef();

  // 获取发票列表
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = {
        p: page,
        page_size: pageSize,
        ...(statusFilter && { status: statusFilter }),
        ...(keyword && { keyword }),
      };
      if (dateRange && dateRange.length === 2) {
        params.start_date = dateRange[0].toISOString().slice(0, 10);
        params.end_date = dateRange[1].toISOString().slice(0, 10);
      }
      const res = await API.get('/api/finance/invoices', { params });
      if (res.data?.success) {
        const data = res.data.data;
        setInvoiceList(data.items || []);
        setTotal(data.total || 0);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, statusFilter]);

  // 获取发票详情
  const fetchInvoiceDetail = async (id) => {
    try {
      setDetailLoading(true);
      const res = await API.get(`/api/finance/invoice/${id}`);
      if (res.data?.success) {
        setDetailData(res.data.data);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('获取发票详情失败:', error);
      showError(t('获取发票详情失败'));
    } finally {
      setDetailLoading(false);
    }
  };

  // 打开更新弹窗
  const openUpdateModal = (record) => {
    setCurrentInvoice(record);
    setUpdateForm({
      status: record.status || '',
      invoice_url: record.invoice_url || '',
      remark: record.error_msg || '',
    });
    setShowUpdateModal(true);
  };

  // 提交更新
  const handleUpdateSubmit = async () => {
    if (!updateForm.status) {
      showError(t('请选择状态'));
      return;
    }
    try {
      setUpdateLoading(true);
      let invoiceUrl = updateForm.invoice_url;
      if (updateForm.invoice_url && updateForm.invoice_url.startsWith('data:')) {
        const blob = await fetch(updateForm.invoice_url).then(res => res.blob());
        const formData = new FormData();
        formData.append('file', blob, 'invoice.pdf');
        const uploadRes = await API.post('/api/user/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (uploadRes.data?.success) {
          invoiceUrl = uploadRes.data.data.url;
        } else {
          showError(uploadRes.data?.message || t('文件上传失败'));
          setUpdateLoading(false);
          return;
        }
      }
      const res = await API.put(`/api/finance/invoice/${currentInvoice.id}`, {
        status: updateForm.status,
        remark: updateForm.remark,
        invoice_url: invoiceUrl,
      });
      if (res.data?.success) {
        setShowUpdateModal(false);
        fetchInvoices();
      } else {
        showError(res.data?.message || t('更新失败'));
      }
    } catch (error) {
      console.error('更新发票失败:', error);
      showError(t('更新失败'));
    } finally {
      setUpdateLoading(false);
    }
  };

  // 状态选项
  const statusOptions = [
    { value: '', label: t('全部') },
    { value: 'pending', label: t('待开票') },
    { value: 'running', label: t('开票中') },
    { value: 'completed', label: t('已开票') },
    { value: 'failed', label: t('开票失败') },
  ];

  const handleInvoicePageChange = (currentPage) => {
    setPage(currentPage);
  };

  const handleInvoicePageSizeChange = (currentPageSize) => {
    setPageSize(currentPageSize);
    setPage(1);
  };

  const handleSearch = () => {
    setPage(1);
    fetchInvoices();
  };

  const handleReset = () => {
    setStatusFilter('');
    setKeyword('');
    setDateRange([]);
    setPage(1);
  };

  // 格式化时间（兼容 ISO 字符串和 Unix 时间戳）
  const renderTime = (ts) => {
    if (!ts) return '-';
    let d;
    if (typeof ts === 'number') {
      d = new Date(ts * 1000);
    } else {
      d = new Date(ts);
    }
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  // 搜索区域
  const searchArea = (
    <div
      style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
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
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
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
          placeholder={t('搜索发票抬头或用户')}
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
              handleSearch();
            }
          }}
        />
        {keyword && (
          <button
            onClick={() => {
              setKeyword('');
            }}
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

      {/*日期搜索*/}
      <DatePicker
        type='dateRange'
        style={{ width: 240 }}
        value={dateRange}
        onChange={(dates) => setDateRange(dates || [])}
      />

      {/* 查询按钮 */}
      <button
        onClick={handleSearch}
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

      {/* 重置按钮 */}
      <button
        onClick={handleReset}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 32,
          padding: '0 16px',
          backgroundColor: '#fff',
          color: '#666',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        {t('重置')}
      </button>
    </div>
  );

  // 表格列定义
  const columns = [
    {
      title: t('用户'),
      dataIndex: 'username',
      key: 'username',
      render: (username) => username || '-',
    },
    {
      title: t('发票抬头'),
      dataIndex: 'invoice_title_info',
      key: 'invoice_title_info',
      render: (title_info) => JSON.parse(title_info).title,
    },
    {
      title: t('发票类型'),
      dataIndex: 'invoice_type',
      key: 'invoice_type',
      render: (type) => invoiceTypeMap[type].text,
    },
    {
      title: t('金额'),
      dataIndex: 'amount',
      key: 'amount',
      render: (money) => <Text type='danger'>¥{money.toFixed(2)}</Text>,
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={invoiceStatusMap[status].color}>
          {t(invoiceStatusMap[status].text)}
        </Tag>
      ),
    },
    {
      title: t('申请时间'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (ts) => renderTime(ts),
    },
    {
      title: t('操作'),
      key: 'action',
      width: 120,
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => fetchInvoiceDetail(record.id)}
            style={{
              border: 'none',
              background: 'none',
              color: '#1677ff',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {t('详情')}
          </button>

          <button
            onClick={() => openUpdateModal(record)}
            style={{
              border: 'none',
              background: 'none',
              color: '#1677ff',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {t('更新')}
          </button>
        </div>
      ),
    },
  ];

  // 关联订单表格列
  const orderColumns = [
    {
      title: t('订单号'),
      dataIndex: 'trade_no',
      key: 'trade_no',
      render: (text) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Text copyable>{text}</Text>
        </div>
      ),
    },
    {
      title: t('支付金额'),
      dataIndex: 'money',
      key: 'money',
      render: (money) => <Text type='danger'>¥{money.toFixed(2)}</Text>,
    },
    {
      title: t('支付方式'),
      dataIndex: 'payment_method',
      key: 'payment_method',
      render: (method) => renderPaymentMethod(method),
    },
    {
      title: t('充值时间'),
      dataIndex: 'create_time',
      key: 'create_time',
      render: (ts) => renderTime(ts),
    },
  ];

  // 发票列表表格
  const invoiceTable = (
    <div>
      <Table
        columns={columns}
        dataSource={invoiceList}
        loading={loading}
        rowKey='id'
        pagination={{
          currentPage: page,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          pageSizeOpts: [10, 20, 50, 100],
          onPageChange: handleInvoicePageChange,
          onPageSizeChange: handleInvoicePageSizeChange,
        }}
        size='small'
        empty={
          <Empty
            image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
            darkModeImage={
              <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
            }
            description={t('暂无发票记录')}
            style={{ padding: 30 }}
          />
        }
      />
    </div>
  );

  const PAYMENT_METHOD_MAP = {
    stripe: 'Stripe',
    creem: 'Creem',
    waffo: 'Waffo',
    alipay: '支付宝',
    wxpay: '微信',
    zs_pay: '招商银行聚合支付',
    helipay: '合利宝支付',
  };

  const renderPaymentMethod = (pm) => {
    const displayName = PAYMENT_METHOD_MAP[pm];
    return <Text>{displayName ? t(displayName) : pm || '-'}</Text>;
  };

  // 详情弹窗内容
  const detailModalContent = () => {
    if (!detailData) return null;
    const titleInfo = detailData.invoice_title_info || {};
    const invoiceTypeText = (invoiceTypeMap[detailData.invoice_type] || { text: detailData.invoice_type }).text;
    // const statusTag = getStatusTag(detailData.status, invoiceStatusMap, t);
    const statusTag = (
      <Tag color={invoiceStatusMap[detailData.status].color}>
        {t(invoiceStatusMap[detailData.status].text)}
      </Tag>
    );
    const authTypeText = titleInfo.type === 'company' ? '(企业)' : '(个人)';

    return (
      <div>
        {/* 顶部信息栏 */}
        <div
          style={{
            display: 'flex',
            padding: '16px',
            backgroundColor: '#fafafa',
            borderRadius: '8px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              borderRight: '1px solid #e8e8e8',
            }}
          >
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
              {t('用户名')}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>
              <strong>{detailData.username || '-'}</strong>
            </div>
          </div>
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              borderRight: '1px solid #e8e8e8',
            }}
          >
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
              {t('开票金额')}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#d93026' }}>
              ¥{detailData.amount?.toFixed(2) || '0.00'}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
              {t('状态')}
            </div>
            <div>{statusTag}</div>
          </div>
        </div>

        {/* 发票信息 */}
        <div style={{ marginBottom: '16px', padding: '0 8px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: '12px' }}>
            {t('发票信息')}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              fontSize: 13,
            }}
          >
            <div>
              <span style={{ color: '#888', marginRight: '8px' }}>
                {t('发票抬头')}:
              </span>
              <span>{titleInfo.title || '-'}</span>
            </div>
            <div>
              <span style={{ color: '#888', marginRight: '8px' }}>
                {t('税号')}:
              </span>
              <span>{titleInfo.uscc || '-'}</span>
            </div>
            <div>
              <span style={{ color: '#888', marginRight: '8px' }}>
                {t('发票类型')}:
              </span>
              <span>
                {authTypeText} {invoiceTypeText}
              </span>
            </div>
            <div>
              <span style={{ color: '#888', marginRight: '8px' }}>
                {t('邮箱')}:
              </span>
              <span>{titleInfo.email || '-'}</span>
            </div>
            {titleInfo.company_address && (
              <div>
                <span style={{ color: '#888', marginRight: '8px' }}>
                  {t('公司地址')}:
                </span>
                <span>{titleInfo.company_address}</span>
              </div>
            )}
            {titleInfo.company_phone && (
              <div>
                <span style={{ color: '#888', marginRight: '8px' }}>
                  {t('公司电话')}:
                </span>
                <span>{titleInfo.company_phone}</span>
              </div>
            )}
            {titleInfo.bank_name && (
              <div>
                <span style={{ color: '#888', marginRight: '8px' }}>
                  {t('开户银行')}:
                </span>
                <span>{titleInfo.bank_name}</span>
              </div>
            )}
            {titleInfo.bank_account && (
              <div>
                <span style={{ color: '#888', marginRight: '8px' }}>
                  {t('银行账号')}:
                </span>
                <span>{titleInfo.bank_account}</span>
              </div>
            )}
          </div>
        </div>

        {/* 关联充值记录 */}
        <div>
          <div
            style={{
              fontSize: 14,
              marginBottom: '12px',
              paddingLeft: '8px',
              fontWeight: 600,
            }}
          >
            {t('关联充值记录')}
          </div>
          <div style={{marginBottom: "15px"}}>
            <Table
              columns={orderColumns}
              dataSource={detailData.orders || []}
              rowKey='id'
              pagination={false}
              size='small'
              empty={
                <Empty
                  description={t('暂无关联充值记录')}
                  style={{ padding: 20 }}
                />
              }
            />
          </div>
        </div>
      </div>
    );
  };

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
    <>
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
      </CardPro>

      {/* 详情弹窗 */}
      <Modal
        title={t('开票详情')}
        visible={showDetailModal}
        onCancel={() => setShowDetailModal(false)}
        footer={null}
        width={700}
        bodyStyle={{ maxHeight: '600px', overflow: 'auto' }}
      >
        {detailLoading ? (
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
          detailModalContent()
        )}
      </Modal>

      {/* 更新弹窗 */}
      <Modal
        title={t('更新发票')}
        visible={showUpdateModal}
        onCancel={() => setShowUpdateModal(false)}
        onOk={handleUpdateSubmit}
        confirmLoading={updateLoading}
        width={500}
        bodyStyle={{ padding: '20px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 状态更新 */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, marginBottom: '8px', display: 'block' }}>
              {t('状态更新')}
            </label>
            <select
              value={updateForm.status}
              onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
              style={{
                width: '100%',
                height: 36,
                padding: '0 12px',
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                fontSize: 13,
                backgroundColor: '#fff',
                outline: 'none',
              }}
            >
              <option value="pending">{t('待开票')}</option>
              <option value="running">{t('开票中')}</option>
              <option value="completed">{t('已开票')}</option>
              <option value="failed">{t('开票失败')}</option>
            </select>
          </div>

          {/* 上传发票 */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, marginBottom: '8px', display: 'block' }}>
              {t('上传发票')}
            </label>
            <div
              style={{
                border: '2px dashed #d9d9d9',
                borderRadius: 6,
                padding: '20px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: '#fafafa',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1677ff')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#d9d9d9')}
              onClick={() => fileInputRef.current?.click()}
            >
              {updateForm.invoice_url ? (
                <div style={{ fontSize: 12, color: '#1677ff' }}>
                  {t('已上传')}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 24, marginBottom: '8px' }}>📁</div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {t('点击或拖拽上传发票文件')}
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      setUpdateForm({ ...updateForm, invoice_url: event.target.result });
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </div>
          </div>

          {/* 开票失败原因 */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, marginBottom: '8px', display: 'block' }}>
              {t('开票失败原因')}
            </label>
            <textarea
              value={updateForm.remark}
              onChange={(e) => setUpdateForm({ ...updateForm, remark: e.target.value })}
              placeholder={t('请填写开票失败的原因')}
              style={{
                width: '100%',
                height: 80,
                padding: '10px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                fontSize: 13,
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
