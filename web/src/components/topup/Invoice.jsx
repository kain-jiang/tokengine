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
import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Table,
  Badge,
  Typography,
  Toast,
  Empty,
  Button,
  Input,
  Form,
  Radio,
  Tabs,
  Space,
  RadioGroup,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { IconSearch, IconEdit, IconDownload } from '@douyinfe/semi-icons';
import { FileText } from 'lucide-react';

import { API, timestamp2string, renderQuota } from '../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const PAYMENT_METHOD_MAP = {
  stripe: 'Stripe',
  creem: 'Creem',
  waffo: 'Waffo',
  alipay: '支付宝',
  wxpay: '微信',
  zs_pay: '招商银行聚合支付',
  helipay: '合利宝支付',
};

const INVOICE_STATUS_MAP = {
  pending: { type: 'warning', key: '开票中' },
  completed: { type: 'success', key: '开票完成' },
  failed: { type: 'danger', key: '开票失败' },
};

const INVOICE_TYPE_MAP = {
  GENERAL_INVOICE: '普通发票',
  SPECIAL_INVOICE: '增值税专用发票',
};

const INVOICE_TITLE_TYPE_MAP = {
  personal: '个人',
  company: '企业',
};

const Invoice = () => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState('topup');
  const [showInvoiceTitleModal, setShowInvoiceTitleModal] = useState(false);

  const [topupLoading, setTopupLoading] = useState(false);
  const [topups, setTopups] = useState([]);
  const [topupTotal, setTopupTotal] = useState(0);
  const [topupPage, setTopupPage] = useState(1);
  const [topupPageSize, setTopupPageSize] = useState(10);
  const [topupKeyword, setTopupKeyword] = useState('');

  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoicePageSize, setInvoicePageSize] = useState(10);

  const [invoiceTitle, setInvoiceTitle] = useState(null);
  const [titleLoading, setTitleLoading] = useState(false);

  const [formData, setFormData] = useState({
    type: 'personal',
    title: '',
    uscc: '',
    company_address: '',
    company_phone: '',
    bank_name: '',
    bank_account: '',
    email: '',
  });

  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const loadTopups = async (currentPage, currentPageSize) => {
    setTopupLoading(true);
    try {
      let qs = `p=${currentPage}&page_size=${currentPageSize}`;
      if (topupKeyword) {
        qs += `&keyword=${encodeURIComponent(topupKeyword)}`;
      }
      const res = await API.get(`/api/user/topup/self?${qs}`);
      const { success, message, data } = res.data;
      if (success) {
        setTopups(data.items || []);
        setTopupTotal(data.total || 0);
      } else {
        Toast.error({ content: message || t('加载失败') });
      }
    } catch (error) {
      Toast.error({ content: t('加载充值记录失败') });
    } finally {
      setTopupLoading(false);
    }
  };

  const loadInvoices = async (currentPage, currentPageSize) => {
    setInvoiceLoading(true);
    try {
      let qs = `p=${currentPage}&page_size=${currentPageSize}`;
      const res = await API.get(`/api/user/invoice/records?${qs}`);
      const { success, message, data } = res.data;
      if (success) {
        setInvoices(data.items || []);
        setInvoiceTotal(data.total || 0);
      } else {
        Toast.error({ content: message || t('加载失败') });
      }
    } catch (error) {
      Toast.error({ content: t('加载开票记录失败') });
    } finally {
      setInvoiceLoading(false);
    }
  };

  const loadInvoiceTitle = async () => {
    setTitleLoading(true);
    try {
      const res = await API.get('/api/user/invoice/title');
      const { success, message, data } = res.data;
      if (success) {
        setInvoiceTitle(data);
        if (data) {
          setFormData({
            type: data.type || 'personal',
            title: data.title || '',
            uscc: data.uscc || '',
            company_address: data.company_address || '',
            company_phone: data.company_phone || '',
            bank_name: data.bank_name || '',
            bank_account: data.bank_account || '',
            email: data.email || '',
          });
        }
      } else if (message !== 'record not found') {
        Toast.error({ content: message || t('加载失败') });
      }
    } catch (error) {
      Toast.error({ content: t('加载开票信息失败') });
    } finally {
      setTitleLoading(false);
    }
  };

  useEffect(() => {
    loadTopups(topupPage, topupPageSize);
  }, [topupPage, topupPageSize, topupKeyword]);

  useEffect(() => {
    loadInvoices(invoicePage, invoicePageSize);
  }, [invoicePage, invoicePageSize]);

  useEffect(() => {
    loadInvoiceTitle();
  }, []);

  const handleTopupPageChange = (currentPage) => {
    setTopupPage(currentPage);
  };

  const handleTopupPageSizeChange = (currentPageSize) => {
    setTopupPageSize(currentPageSize);
    setTopupPage(1);
  };

  const handleInvoicePageChange = (currentPage) => {
    setInvoicePage(currentPage);
  };

  const handleInvoicePageSizeChange = (currentPageSize) => {
    setInvoicePageSize(currentPageSize);
    setInvoicePage(1);
  };

  const handleApplyInvoice = (orderId) => {
    setSelectedOrderId(orderId);
    setShowInvoiceTitleModal(true);
    if (!invoiceTitle) {
      setFormData({
        type: 'personal',
        title: '',
        uscc: '',
        company_address: '',
        company_phone: '',
        bank_name: '',
        bank_account: '',
        email: '',
      });
    }
  };

  const handleSaveInvoiceTitle = async () => {
    if (!formData.title) {
      Toast.error({ content: t('请填写发票抬头') });
      return;
    }
    if (!formData.email) {
      Toast.error({ content: t('请填写接收邮箱') });
      return;
    }
    if (formData.type === 'company' && !formData.uscc) {
      Toast.error({ content: t('请填写纳税人识别号') });
      return;
    }

    try {
      const res = await API.post('/api/user/invoice/title', formData);
      const { success, message } = res.data;
      if (success) {
        Toast.success({ content: t('保存成功') });
        await loadInvoiceTitle();
      } else {
        Toast.error({ content: message || t('保存失败') });
      }
    } catch (error) {
      Toast.error({ content: t('保存失败') });
    }
  };

  const handleSubmitInvoice = async () => {
    if (!formData.title) {
      Toast.error({ content: t('请填写发票抬头') });
      return;
    }
    if (!formData.email) {
      Toast.error({ content: t('请填写接收邮箱') });
      return;
    }
    if (formData.type === 'company' && !formData.uscc) {
      Toast.error({ content: t('请填写纳税人识别号') });
      return;
    }

    if (selectedOrderIds.length === 0) {
      Toast.error({ content: t('请选择要开票的订单') });
      return;
    }

    try {
      await API.post('/api/user/invoice/title', formData);

      const res = await API.post('/api/user/invoice/apply', {
        order_ids: selectedOrderIds,
      });
      const { success, message } = res.data;
      if (success) {
        Toast.success({ content: t('开票申请成功') });
        setShowInvoiceTitleModal(false);
        setSelectedOrderIds([]);
        setAllSelected(false);
        await loadInvoices(invoicePage, invoicePageSize);
        await loadTopups(topupPage, topupPageSize);
      } else {
        Toast.error({ content: message || t('开票申请失败') });
      }
    } catch (error) {
      Toast.error({ content: t('开票申请失败') });
    }
  };

  const handleViewInvoice = (invoice) => {
    if (invoice.invoice_url) {
      window.open(invoice.invoice_url, '_blank');
    }
  };

  const handleDownloadInvoice = (invoice) => {
    if (invoice.invoice_url) {
      const link = document.createElement('a');
      link.href = invoice.invoice_url;
      link.download = `invoice_${invoice.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const renderPaymentMethod = (pm) => {
    const displayName = PAYMENT_METHOD_MAP[pm];
    return <Text>{displayName ? t(displayName) : pm || '-'}</Text>;
  };

  const renderInvoiceStatus = (status) => {
    const config = INVOICE_STATUS_MAP[status] || { type: 'primary', key: status };
    return (
      <span className='flex items-center gap-2'>
        <Badge dot type={config.type} />
        <span>{t(config.key)}</span>
      </span>
    );
  };

  const renderInvoiceType = (type) => {
    const displayName = INVOICE_TYPE_MAP[type];
    return <Text>{displayName ? t(displayName) : type || '-'}</Text>;
  };

  const topupColumns = useMemo(
    () => [
      {
        title: t('订单号'),
        dataIndex: 'trade_no',
        key: 'trade_no',
        render: (text) => <Text copyable>{text}</Text>,
      },
      {
        title: t('支付方式'),
        dataIndex: 'payment_method',
        key: 'payment_method',
        render: renderPaymentMethod,
      },
      {
        title: t('充值额度'),
        dataIndex: 'amount',
        key: 'amount',
        render: (amount) => renderQuota(amount),
      },
      {
        title: t('支付金额'),
        dataIndex: 'money',
        key: 'money',
        render: (money) => <Text type='danger'>¥{money.toFixed(2)}</Text>,
      },
      {
        title: t('开票状态'),
        key: 'invoice',
        render: (_, record) => {
          if (record.status !== 'success') {
            return <Text type='tertiary'>{t('未完成')}</Text>;
          }
          switch (record.invoice_status) {
            case 'uninvoiced':
              return (
                <Button
                  size='small'
                  type='primary'
                  theme='outline'
                  onClick={() => handleApplyInvoice(record.id)}
                >
                  {t('开票')}
                </Button>
              );
            case 'pending':
            case 'running':
              return (
                <span className='flex items-center gap-2'>
                  <Badge dot type='warning' />
                  <span>{t('开票中')}</span>
                </span>
              );
            case 'completed':
              return (
                <span className='flex items-center gap-2'>
                  <Badge dot type='success' />
                  <span>{t('已开票')}</span>
                </span>
              );
            case 'failed':
              return (
                <span className='flex items-center gap-2'>
                  <Badge dot type='danger' />
                  <span>{t('开票失败')}</span>
                </span>
              );
            default:
              return <Text type='tertiary'>{t('未开票')}</Text>;
          }
        },
      },
      {
        title: t('充值时间'),
        dataIndex: 'create_time',
        key: 'create_time',
        render: (time) => timestamp2string(time),
      },
    ],
    [t],
  );

  const invoiceColumns = useMemo(() => [
    {
      title: t('开票金额'),
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => renderQuota(amount),
    },
    {
      title: t('发票抬头'),
      dataIndex: 'invoice_title_info',
      key: 'invoice_title_info',
      render: (info) => {
        try {
          const parsed = JSON.parse(info);
          return <Text>{parsed.title || '-'}</Text>;
        } catch {
          return <Text>{info || '-'}</Text>;
        }
      },
    },
    {
      title: t('发票类型'),
      dataIndex: 'invoice_type',
      key: 'invoice_type',
      render: renderInvoiceType,
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      render: renderInvoiceStatus,
    },
    {
      title: t('申请时间'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => timestamp2string(time),
    },
    {
      title: t('操作'),
      key: 'action',
      render: (_, record) => (
        <Space>
          {record.status === 'completed' && record.invoice_url && (
            <>
              <Button
                size='small'
                icon={<FileText size={14} />}
                onClick={() => handleViewInvoice(record)}
              >
                {t('查看')}
              </Button>
              <Button
                size='small'
                icon={<IconDownload size={14} />}
                onClick={() => handleDownloadInvoice(record)}
              >
                {t('下载')}
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ], [t]);

  const selectInvoiceType = (e) => {
    console.log(e.target.value);
    setFormData((prev) => ({ ...prev, type: e.target.value }));
  };
  return (
    <div className='w-full max-w-7xl mx-auto px-2'>
      <div
        className='flex items-center justify-between mb-4'
        style={{ marginTop: '16px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
          <FileText size={18} color='#1768ef' />
          <span
            className='text-xl font-semibold'
            style={{ fontSize: '15px', color: '#1c1f23' }}
          >
            {t('充值开票')}
          </span>
        </div>
        <Button
          style={{ fontSize: '12px', width: '100px' }}
          type='primary'
          icon={<IconEdit size={16} />}
          onClick={() => setShowInvoiceTitleModal(true)}
        >
          {t('开票信息')}
        </Button>
      </div>

      <div
        className='border rounded-lg overflow-hidden'
        style={{ border: '1px solid #F0F1F5', padding: '24px' }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          type='line'
        >
          <Tabs.TabPane tab={t('充值记录')} itemKey='topup'>
            <div
              className='flex justify-between items-center gap-3 mb-4'
              style={{ marginTop: '10px' }}
            >
              <div>
                <Input
                  prefix={<IconSearch />}
                  placeholder={t('订单号')}
                  value={topupKeyword}
                  onChange={(value) => {
                    setTopupKeyword(value);
                    setTopupPage(1);
                  }}
                  showClear
                  style={{ width: '300px' }}
                />
                <Button
                  size='small'
                  type='tertiary'
                  onClick={() => {
                    setTopupPage(1);
                  }}
                  style={{ marginLeft: '10px' }}
                >
                  {t('查询')}
                </Button>
                <Button
                  size='small'
                  type='tertiary'
                  onClick={() => {
                    setTopupKeyword('');
                    setTopupPage(1);
                  }}
                  style={{ marginLeft: '10px' }}
                >
                  {t('重置')}
                </Button>
              </div>
              <div>
                <Button type='tertiary' size='small'>
                  {t('批量开票')}
                </Button>
                <Button type='primary' theme='solid' size='small' style={{ marginLeft: '10px' }}>
                  {t('全部开票')}
                </Button>
              </div>
            </div>

            <Table
              columns={topupColumns}
              dataSource={topups}
              loading={topupLoading}
              rowKey='id'
              pagination={{
                currentPage: topupPage,
                pageSize: topupPageSize,
                total: topupTotal,
                showSizeChanger: true,
                pageSizeOpts: [10, 20, 50, 100],
                onPageChange: handleTopupPageChange,
                onPageSizeChange: handleTopupPageSizeChange,
              }}
              size='small'
              empty={
                <Empty
                  image={
                    <IllustrationNoResult style={{ width: 150, height: 150 }} />
                  }
                  darkModeImage={
                    <IllustrationNoResultDark
                      style={{ width: 150, height: 150 }}
                    />
                  }
                  description={t('暂无充值记录')}
                  style={{ padding: 30 }}
                />
              }
            />
          </Tabs.TabPane>

          <Tabs.TabPane tab={t('开票记录')} itemKey='invoice'>
            <Table
              columns={invoiceColumns}
              dataSource={invoices}
              loading={invoiceLoading}
              rowKey='id'
              pagination={{
                currentPage: invoicePage,
                pageSize: invoicePageSize,
                total: invoiceTotal,
                showSizeChanger: true,
                pageSizeOpts: [10, 20, 50, 100],
                onPageChange: handleInvoicePageChange,
                onPageSizeChange: handleInvoicePageSizeChange,
              }}
              size='small'
              empty={
                <Empty
                  image={
                    <IllustrationNoResult style={{ width: 150, height: 150 }} />
                  }
                  darkModeImage={
                    <IllustrationNoResultDark
                      style={{ width: 150, height: 150 }}
                    />
                  }
                  description={t('暂无开票记录')}
                  style={{ padding: 30 }}
                />
              }
            />
          </Tabs.TabPane>
        </Tabs>
      </div>

      <Modal
        title={selectedOrderId ? t('申请开票') : t('开票信息')}
        visible={showInvoiceTitleModal}
        onCancel={() => {
          setShowInvoiceTitleModal(false);
          setSelectedOrderId(null);
        }}
        footer={null}
        width={600}
        centered
      >
        <Form className='space-y-4'>
          <div className='flex items-center gap-2'>
            <Text strong>{t('抬头类型')}</Text>
            <span style={{ color: '#d93026' }}>*</span>
          </div>
          <RadioGroup value={formData.type} onChange={selectInvoiceType}>
            <Radio value='personal'>{t('个人')}</Radio>
            <Radio value='company'>{t('企业')}</Radio>
          </RadioGroup>
          <div className='space-y-3'>
            <Form.Input
              field='title'
              label={
                <span className='flex items-center gap-1'>
                  {t('发票抬头')}
                  <span style={{ color: '#d93026' }}>*</span>
                </span>
              }
              placeholder={t('请填写发票抬头')}
              value={formData.title}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, title: value }))
              }
            />

            {formData.type === 'company' && (
              <>
                <Form.Input
                  field='uscc'
                  label={
                    <span className='flex items-center gap-1'>
                      {t('纳税人识别号')}
                      <span style={{ color: '#d93026' }}>*</span>
                    </span>
                  }
                  placeholder={t('请填写纳税人识别号')}
                  value={formData.uscc}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, uscc: value }))
                  }
                />
                <Form.Input
                  field='company_address'
                  label={t('公司地址')}
                  placeholder={t('请填写公司地址')}
                  value={formData.company_address}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, company_address: value }))
                  }
                />
                <Form.Input
                  field='company_phone'
                  label={t('公司电话')}
                  placeholder={t('请填写公司电话')}
                  value={formData.company_phone}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, company_phone: value }))
                  }
                />
                <Form.Input
                  field='bank_name'
                  label={t('开户银行')}
                  placeholder={t('请填写开户银行')}
                  value={formData.bank_name}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, bank_name: value }))
                  }
                />
                <Form.Input
                  field='bank_account'
                  label={t('银行账户')}
                  placeholder={t('请填写银行账户')}
                  value={formData.bank_account}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, bank_account: value }))
                  }
                />
              </>
            )}

            <Form.Input
              field='email'
              label={
                <span className='flex items-center gap-1'>
                  {t('接收邮箱')}
                  <span style={{ color: '#d93026' }}>*</span>
                </span>
              }
              placeholder={t('请填写接收邮箱')}
              value={formData.email}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, email: value }))
              }
            />
          </div>

          <div
            className='flex justify-end gap-3 mt-6'
            style={{ marginBottom: '20px' }}
          >
            <Button
              onClick={() => {
                setShowInvoiceTitleModal(false);
                setSelectedOrderId(null);
              }}
            >
              {t('取消')}
            </Button>
            <Button
              type='primary'
              theme='solid'
              onClick={() => {
                if (selectedOrderId) {
                  handleSubmitInvoice();
                } else {
                  handleSaveInvoiceTitle();
                }
              }}
              loading={titleLoading}
            >
              {selectedOrderId ? t('提交开票') : t('保存')}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Invoice;
