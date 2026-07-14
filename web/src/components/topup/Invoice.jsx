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
  TextArea,
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
  pending: { type: 'warning', key: '开票中', color: '#FF9C01' },
  completed: { type: 'success', key: '已开票', color: '#00B42A'},
  failed: { type: 'danger', key: '失败', color: '#FF0000' },
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

  const [invoiceTitles, setInvoiceTitles] = useState(null);
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

  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [allSelected, setAllSelected] = useState(false);

  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyFormData, setApplyFormData] = useState({
    title_type: 'personal',
    invoice_type: 'general',
    remark: '',
  });

  const loadTopups = async (currentPage, currentPageSize) => {
    setTopupLoading(true);
    try {
      let qs = `p=${currentPage}&page_size=${currentPageSize}&status=success`;
      if (topupKeyword) {
        qs += `&keyword=${encodeURIComponent(topupKeyword)}`;
      }
      const res = await API.get(`/api/user/topup/self?${qs}`);
      const { success, message, data } = res.data;
      if (success) {
        setTopups(data.items || []);
        setTopupTotal(data.total || 0);
        return data.items
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
        return data.items
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
        setInvoiceTitles(data);
        if (data.length > 0) {
          setFormData({
            type: data[0].type || 'personal',
            title: data[0].title || '',
            uscc: data[0].uscc || '',
            company_address: data[0].company_address || '',
            company_phone: data[0].company_phone || '',
            bank_name: data[0].bank_name || '',
            bank_account: data[0].bank_account || '',
            email: data[0].email || '',
          });
        }
      } else {
        console.warn({ content: message || t('加载失败') });
      }
    } catch (error) {
      Toast.error({ content: t('加载开票信息失败') });
    } finally {
      setTitleLoading(false);
    }
  };

  const loadData = async () => {
    const [topupData, invoiceData] = await Promise.all([
      loadTopups(topupPage, topupPageSize),
      loadInvoices(invoicePage, invoicePageSize),
    ]);
    if (topupData.length > 0) {
      injectInvoiceStatus(topupData, invoiceData);
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

  useEffect(() => {
    loadData();
  }, [topupPage, topupPageSize, topupKeyword]);

  // 为订单注入开票状态
  const injectInvoiceStatus = (topups, invoices) => {
    if (!topups.length) return;
    // 为订单里添加字段invoice_status
    const array = topups.map((item) => {
      const dic = { ...item };
      let found = false;

      // 遍历发票记录
      for (const record of invoices) {
        if (record.order_ids) {
          const ids = record.order_ids.split(',').map((id) => id.trim());
          // 注意：这里用 String() 转换类型
          if (ids.includes(String(item.id))) {
            dic.invoice_status = record.status;
            found = true;
            break;
          }
        }
      }

      // 如果没有找到，设置为未开票
      if (!found) {
        dic.invoice_status = 'uninvoiced';
      }
      return dic;
    });

    setTopups(array);
  };

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
        setShowInvoiceTitleModal(false);
        await loadInvoiceTitle();
      } else {
        Toast.error({ content: message || t('保存失败') });
      }
    } catch (error) {
      Toast.error({ content: t('保存失败') });
    }
  };

  const handleSubmitInvoice = async () => {

    if (selectedOrderIds.length === 0) {
      Toast.error({ content: t('请选择要开票的订单') });
      return;
    }
    if (!applyFormData.title_type) {
      Toast.error({ content: t('请选择发票抬头类型') });
      return;
    }
    if (!applyFormData.invoice_type) {
      Toast.error({ content: t('请选择发票类型') });
      return;
    }

    try {
      let reqBody = {
        order_ids: selectedOrderIds,
        title_type: applyFormData.title_type,
        invoice_type: applyFormData.invoice_type,
        remark: applyFormData.remark,
      };
      const res = await API.post('/api/user/invoice/apply', reqBody);
      const { success, message } = res.data;
      if (success) {
        setShowApplyModal(false);
        Toast.success({ content: t('开票申请成功') });
        setShowInvoiceTitleModal(false);
        setSelectedOrderIds([]);
        setAllSelected(false);
        // await loadInvoices(invoicePage, invoicePageSize);
        await loadData();

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
      <span className='flex items-center' style={{ color: config.color }}>
        <span>{t(config.key)}</span>
      </span>
    );
  };

  const renderInvoiceType = (type) => {
    const displayName = INVOICE_TYPE_MAP[type];
    return <Text>{displayName ? t(displayName) : type || '-'}</Text>;
  };

  const rowSelection = useMemo(() => ({
    selectedRowKeys: selectedOrderIds,
    onChange: (selectedRowKeys) => {
      setSelectedOrderIds(selectedRowKeys);
      const uninvoicedIds = topups
        .filter((item) => item.status === 'success' && item.invoice_status === 'uninvoiced')
        .map((item) => item.id);
      setAllSelected(selectedRowKeys.length === uninvoicedIds.length && uninvoicedIds.length > 0);
    },
  }), [selectedOrderIds, topups]);

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
        render: (amount) => <Text>¥{amount.toFixed(2)}</Text>,
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
              return <Text type='tertiary'>{t('未开票')}</Text>;
            case 'pending':
            case 'running':
              return <span style={{ color: '#FF9C01' }}>{t('开票中')}</span>;
            case 'completed':
              return <span style={{ color: '#00B42A' }}>{t('已开票')}</span>;
            case 'failed':
              return <span style={{ color: '#FF0000' }}>{t('失败')}</span>;
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
    [t, selectedOrderIds, allSelected, topups],
  );

  const invoiceColumns = useMemo(
    () => [
      {
        title: t('序号'),
        key: 'index',
        render: (_, __, index) => <Text>{(invoicePage - 1) * invoicePageSize + index + 1}</Text>,
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
        title: t('开票金额'),
        dataIndex: 'amount',
        key: 'amount',
        render: (money) => <Text type='danger'>¥{money.toFixed(2)}</Text>,
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
        render: (time) => <Text>{time}</Text>,
      },
      {
        title: t('操作'),
        key: 'action',
        render: (_, record) => (
          <Space>
            <>
              <Button
                size='small'
                onClick={() => handleViewInvoice(record)}
                disabled={record.status !== 'completed'}
              >
                {t('查看')}
              </Button>
              <Button
                size='small'
                onClick={() => handleDownloadInvoice(record)}
                disabled={record.status !== 'completed'}
              >
                {t('下载')}
              </Button>
            </>
          </Space>
        ),
      },
    ],
    [t],
  );

  const selectInvoiceType = (e) => {
    if(invoiceTitles && invoiceTitles.length > 0) {
      for (const item of invoiceTitles) {
        if (item.type === e.target.value) {
          setFormData({
            title: item.title,
            type: item.type,
            uscc: item.uscc,
            company_address: item.company_address,
            company_phone: item.company_phone,
            bank_name: item.bank_name,
            bank_account: item.bank_account,
            email: item.email,
          })
          break
        } else {
          setFormData((prev) => ({ ...prev, type: e.target.value }));
        }
      }
    } else {
      setFormData((prev) => ({ ...prev, type: e.target.value }));
    }

  };

  const toSetInvoiceTitle = () => {

    setShowInvoiceTitleModal(true);
  };

  const toApplyInvoice = (_type) => {
    if(invoiceTitles &&  invoiceTitles.length > 0) {
      // 全部开票
      if (_type === 'all') {
        const invoiceableIds = topups
          .filter(
            (item) =>
              item.status === 'success' &&
              (item.invoice_status === 'uninvoiced' ||
                item.invoice_status === 'failed'),
          )
          .map((item) => item.id);
        if (invoiceableIds.length === 0) {
          Toast.warning({ content: t('无可开票的订单') });
          return;
        }
        setSelectedOrderIds(invoiceableIds);
        setAllSelected(true);
      } else {
        // TODO 过滤掉已经开了票的或正在开票的
        const invoiceableIds = topups
          .filter(
            (item) =>
              selectedOrderIds.includes(item.id) &&
              item.status === 'success' &&
              (item.invoice_status === 'uninvoiced' ||
                item.invoice_status === 'failed'),
          )
          .map((item) => item.id);
        if (invoiceableIds.length === 0) {
          Toast.warning({ content: t('所选订单无可开票的订单') });
          return;
        }
        setSelectedOrderIds(invoiceableIds);
      }
      setApplyFormData({
        title_type: invoiceTitles[0]?.type || 'personal',
        invoice_type: 'general',
        remark: '',
      });
      setShowApplyModal(true);
    } else {
      Toast.warning(t('请先完善开票信息'));
    }
  };
  return (
    <div className='w-full max-w-7xl mx-auto px-2'>
      <div className='flex items-center justify-end'>
        <Button
          style={{ fontSize: '12px', width: '100px' }}
          type='primary'
          icon={<IconEdit size={16} />}
          onClick={() => toSetInvoiceTitle()}
        >
          {t('开票信息')}
        </Button>
      </div>

      <div>
        <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key)}>
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
                <Button
                  type='primary'
                  size='small'
                  disabled={selectedOrderIds.length === 0}
                  onClick={() => toApplyInvoice('batch')}
                >
                  {t('批量开票')}
                </Button>
                <Button
                  type='primary'
                  theme='solid'
                  size='small'
                  style={{ marginLeft: '10px' }}
                  onClick={() => toApplyInvoice('all')}
                >
                  {t('全部开票')}
                </Button>
              </div>
            </div>

            <Table
              columns={topupColumns}
              dataSource={topups}
              loading={topupLoading}
              rowKey='id'
              rowSelection={rowSelection}
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
        title={t('开票信息设置')}
        visible={showInvoiceTitleModal}
        onCancel={() => {
          setShowInvoiceTitleModal(false);
        }}
        footer={null}
        width={600}
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
            <div className='flex items-center gap-2'>
              <Text strong>{t('发票抬头')}</Text>
              <span style={{ color: '#d93026' }}>*</span>
            </div>
            <Input
              placeholder={t('请填写发票抬头')}
              value={formData.title}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, title: value }))
              }
            />

            {formData.type === 'company' && (
              <>
                <div className='flex items-center gap-2'>
                  <Text strong>{t('纳税人识别号')}</Text>
                  <span style={{ color: '#d93026' }}>*</span>
                </div>
                <Input
                  field='uscc'
                  placeholder={t('请填写纳税人识别号')}
                  value={formData.uscc}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, uscc: value }))
                  }
                />
                <div className='flex items-center gap-2'>
                  <Text strong>{t('公司地址')}</Text>
                </div>
                <Input
                  field='company_address'
                  label={t('公司地址')}
                  placeholder={t('请填写公司地址')}
                  value={formData.company_address}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, company_address: value }))
                  }
                />
                <div className='flex items-center gap-2'>
                  <Text strong>{t('公司电话')}</Text>
                </div>
                <Input
                  field='company_phone'
                  placeholder={t('请填写公司电话')}
                  value={formData.company_phone}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, company_phone: value }))
                  }
                />
                <div className='flex items-center gap-2'>
                  <Text strong>{t('开户银行')}</Text>
                </div>
                <Input
                  field='bank_name'
                  placeholder={t('请填写开户银行')}
                  value={formData.bank_name}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, bank_name: value }))
                  }
                />
                <div className='flex items-center gap-2'>
                  <Text strong>{t('银行账户')}</Text>
                </div>
                <Input
                  field='bank_account'
                  placeholder={t('请填写银行账户')}
                  value={formData.bank_account}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, bank_account: value }))
                  }
                />
              </>
            )}

            <div className='flex items-center gap-2'>
              <Text strong>{t('接收邮箱')}</Text>
            </div>
            <Input
              field='email'
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
              }}
            >
              {t('取消')}
            </Button>
            <Button
              type='primary'
              theme='solid'
              onClick={() => {
                handleSaveInvoiceTitle();
              }}
              loading={titleLoading}
            >
              {t('保存')}
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal
        title={t('申请开票')}
        visible={showApplyModal}
        onCancel={() => {
          setShowApplyModal(false);
        }}
        footer={null}
        width={600}
      >
        <div className='space-y-4'>
          <div
            className='flex justify-between items-center'
            style={{
              padding: '12px 16px',
              background: 'var(--semi-color-primary-light-default)',
              borderRadius: '8px',
              border: '1px solid var(--semi-color-primary-light-active)',
            }}
          >
            <div>
              <span className='semi-typography semi-typography-tertiary semi-typography-small'>
                {t('已选充值记录')}
              </span>
              <span
                className='semi-typography semi-typography-primary semi-typography-normal'
                style={{ marginLeft: '8px' }}
              >
                <strong>
                  {selectedOrderIds.length}
                  {t('条')}
                </strong>
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className='semi-typography semi-typography-tertiary semi-typography-small semi-typography-normal'>
                {t('开票金额')}
              </span>
              <span
                className='semi-typography semi-typography-danger semi-typography-normal'
                style={{ marginLeft: '8px', fontSize: '20px' }}
              >
                <strong>
                  ¥
                  {topups
                    .filter((item) => selectedOrderIds.includes(item.id))
                    .reduce((sum, item) => sum + item.money, 0)
                    .toFixed(2)}
                </strong>
              </span>
            </div>
          </div>

          <div className='space-y-4'>
            <div>
              <Text strong>{t('开票抬头')}</Text>
            </div>
            <RadioGroup
              value={applyFormData.title_type}
              onChange={(e) =>
                setApplyFormData((prev) => ({
                  ...prev,
                  title_type: e.target.value,
                }))
              }
            >
              <Radio value='personal'>{t('个人')}</Radio>
              <Radio value='company'>{t('企业')}</Radio>
            </RadioGroup>

            <div>
              <Text strong>{t('发票类型')}</Text>
            </div>
            <RadioGroup
              value={applyFormData.invoice_type}
              onChange={(e) =>
                setApplyFormData((prev) => ({
                  ...prev,
                  invoice_type: e.target.value,
                }))
              }
            >
              <Radio value='general'>{t('增值税普通发票')}</Radio>
              <Radio
                value='special'
                disabled={applyFormData.title_type === 'personal'}
              >
                {t('增值税专用发票')}
              </Radio>
            </RadioGroup>

            <div>
              <Text strong>{t('备注')}</Text>
            </div>

            <TextArea
              placeholder={t('请输入备注')}
              value={applyFormData.remark}
              onChange={(value) =>
                setApplyFormData((prev) => ({ ...prev, remark: value }))
              }
            />
          </div>

          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--semi-color-fill-0)',
              borderRadius: '8px',
            }}
          >
            <span className='semi-typography semi-typography-tertiary semi-typography-small semi-typography-normal'>
              提交后将自动读取您设置的开票信息，如需修改请先更新开票信息设置。
            </span>
          </div>

          <div
            className='flex justify-end gap-3 mt-6'
            style={{ marginBottom: '20px' }}
          >
            <Button onClick={() => setShowApplyModal(false)}>
              {t('取消')}
            </Button>
            <Button
              type='primary'
              theme='solid'
              onClick={() => handleSubmitInvoice()}
              loading={titleLoading}
            >
              {t('开票')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Invoice;
