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
import {
  Layout,
  Card,
  Row,
  Col,
  Table,
  Tag,
  Space,
  Select,
  Button,
  Modal,
  Form,
  Input,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconMoneyExchangeStroked,
  IconArrowUp,
  IconEditStroked,
  IconDeleteStroked,
  IconPlusStroked,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../helpers';
import { StatusContext } from '../../context/Status';
import * as SupplierAPI from '../../services/supplier';

const { Header, Content, Sider } = Layout;
const { Text } = Typography;

// 格式化金额
const formatMoney = (value) => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
};

// 格式化费率
const formatRate = (value) => {
  if (!value && value !== 0) return '-';
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  }).format(value);
};

export default function FinanceSupplier() {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const isAdmin = statusState?.user?.is_admin === true;

  // 数据状态
  const [accounts, setAccounts] = useState([]);
  const [pricings, setPricings] = useState([]);
  const [vendors, setVendors] = useState([]);

  // 加载状态
  const [loading, setLoading] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [pricingsLoading, setPricingsLoading] = useState(false);

  // 筛选条件
  const [pricingVendorId, setPricingVendorId] = useState('');
  const [pricingKeyword, setPricingKeyword] = useState('');

  // 弹窗状态
  const [pricingModalVisible, setPricingModalVisible] = useState(false);
  const [pricingForm] = Form.useForm();
  const [isEditingPricing, setIsEditingPricing] = useState(false);
  const [rechargeModalVisible, setRechargeModalVisible] = useState(false);
  const [rechargeForm] = Form.useForm();
  const [currentVendorId, setCurrentVendorId] = useState(null);

  // 获取供应商列表
  const fetchVendors = async () => {
    try {
      const res = await API.get('/api/vendors/?page_size=1000');
      if (res.data.success) {
        setVendors(res.data.data?.items || res.data.data || []);
      }
    } catch (error) {
      console.error('获取供应商列表失败:', error);
    }
  };

  // 获取账户列表
  const fetchAccounts = async () => {
    setAccountsLoading(true);
    try {
      const res = await SupplierAPI.fetchSupplierAccounts({ page_size: 1000 });
      if (res.success) {
        // 后端返回格式: { success: true, data: [...], total: X }
        setAccounts(Array.isArray(res.data) ? res.data : []);
      }
    } catch (error) {
      console.error('获取账户列表失败:', error);
      showError('获取账户列表失败');
    } finally {
      setAccountsLoading(false);
    }
  };

  // 获取费率配置列表
  const fetchPricings = async () => {
    setPricingsLoading(true);
    try {
      const params = {
        page_size: 1000,
        vendor_id: pricingVendorId || undefined,
        keyword: pricingKeyword || undefined,
      };
      const res = await SupplierAPI.fetchSupplierPricings(params);
      if (res.success) {
        setPricings(res.data?.items || res.data || []);
      }
    } catch (error) {
      console.error('获取费率配置失败:', error);
      showError('获取费率配置失败');
    } finally {
      setPricingsLoading(false);
    }
  };

  // 加载数据
  useEffect(() => {
    fetchVendors();
    fetchAccounts();
    fetchPricings();
  }, [pricingVendorId, pricingKeyword]);

  // 打开新增费率弹窗
  const handleAddPricing = () => {
    pricingForm.reset();
    setPricingModalVisible(true);
  };

  // 打开编辑费率弹窗
  const handleEditPricing = async (record) => {
    try {
      const res = await SupplierAPI.getSupplierPricing(record.id);
      if (res.success) {
        setIsEditingPricing(true);
        pricingForm.setValues(res.data);
        setPricingModalVisible(true);
      }
    } catch (error) {
      showError('获取费率详情失败');
    }
  };

  // 保存费率配置
  const handleSavePricing = async () => {
    try {
      const values = await pricingForm.validate();
      let res;
      if (isEditingPricing || values.id) {
        res = await SupplierAPI.updateSupplierPricing(values);
      } else {
        res = await SupplierAPI.createSupplierPricing(values);
      }
      if (res.success) {
        showSuccess('保存成功');
        setIsEditingPricing(false);
        setPricingModalVisible(false);
        fetchPricings();
      }
    } catch (error) {
      showError('保存失败');
    }
  };

  // 删除费率配置
  const handleDeletePricing = async (id) => {
    try {
      const res = await SupplierAPI.deleteSupplierPricing(id);
      if (res.success) {
        showSuccess('删除成功');
        fetchPricings();
      }
    } catch (error) {
      showError('删除失败');
    }
  };

  // 打开充值弹窗
  const handleOpenRechargeModal = (vendorId) => {
    setCurrentVendorId(vendorId);
    rechargeForm.reset();
    setRechargeModalVisible(true);
  };

  // 执行充值
  const handleRecharge = async () => {
    try {
      const values = await rechargeForm.validate();
      const res = await SupplierAPI.rechargeSupplierAccount({
        vendor_id: currentVendorId,
        ...values,
      });
      if (res.success) {
        showSuccess('充值成功');
        setRechargeModalVisible(false);
        fetchAccounts();
      }
    } catch (error) {
      showError('充值失败');
    }
  };

  // 计费方式渲染
  const renderPricingMethod = (method) => {
    const config = {
      per_token: { text: '按Token计费', color: 'blue' },
      per_call: { text: '按次计费', color: 'purple' },
      per_second: { text: '按秒计费', color: 'orange' },
      per_image: { text: '按张计费', color: 'green' },
    };
    const item = config[method] || { text: method, color: 'default' };
    return <Tag color={item.color}>{item.text}</Tag>;
  };

  // 账户统计卡片数据
  const accountStats = {
    totalRecharge: accounts.reduce((sum, acc) => sum + (acc.total_recharge || 0), 0),
    totalConsumption: accounts.reduce((sum, acc) => sum + (acc.total_consumption || 0), 0),
    totalBalance: accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0),
  };

  // 费率配置表格列
  const pricingColumns = [
    {
      title: '供应商',
      dataIndex: 'vendor_name',
      key: 'vendor_name',
      width: 150,
      fixed: 'left',
    },
    {
      title: '模型',
      dataIndex: 'model_name',
      key: 'model_name',
      width: 180,
      fixed: 'left',
    },
    {
      title: '计费方式',
      dataIndex: 'pricing_method',
      key: 'pricing_method',
      width: 120,
      render: (method) => renderPricingMethod(method),
    },
    {
      title: '官方价格',
      key: 'official_price',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size="mini">
          <Text style={{ fontSize: 12 }}>输入: {formatRate(record.official_input_price)}</Text>
          <Text style={{ fontSize: 12 }}>输出: {formatRate(record.official_output_price)}</Text>
        </Space>
      ),
    },
    {
      title: '合作价格',
      key: 'actual_price',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size="mini">
          <Text style={{ fontSize: 12 }}>输入: {formatRate(record.actual_input_price)}</Text>
          <Text style={{ fontSize: 12 }}>输出: {formatRate(record.actual_output_price)}</Text>
        </Space>
      ),
    },
    {
      title: '折扣率',
      dataIndex: 'discount_rate',
      key: 'discount_rate',
      width: 100,
      render: (val) => (val ? `${(val * 100).toFixed(1)}%` : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'gray'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="tertiary"
            size="small"
            onClick={() => handleEditPricing(record)}
          >
            编辑
          </Button>
          <Button
            type="tertiary"
            size="small"
            theme="borderless"
            onClick={() => handleDeletePricing(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 账户管理表格列
  const accountColumns = [
    {
      title: '供应商',
      dataIndex: 'vendor_name',
      key: 'vendor_name',
      width: 150,
    },
    {
      title: '累计充值',
      dataIndex: 'total_recharge',
      key: 'total_recharge',
      width: 140,
      render: (val) => formatMoney(val),
    },
    {
      title: '累计消耗',
      dataIndex: 'total_consumption',
      key: 'total_consumption',
      width: 140,
      render: (val) => formatMoney(val),
    },
    {
      title: '剩余余额',
      dataIndex: 'balance',
      key: 'balance',
      width: 140,
      render: (val) => formatMoney(val),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'gray'}>
          {status === 'active' ? '正常' : '冻结'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          onClick={() => handleOpenRechargeModal(record.vendor_id)}
        >
          充值
        </Button>
      ),
    },
  ];

  return (
    <div>
      {/* 账户概览卡片 */}
      <Row gutter={24} style={{ marginBottom: 32 }}>
        <Col span={8}>
          <Card
            bodyStyle={{ padding: '24px' }}
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
          >
            <div style={{ textAlign: 'center' }}>
              <IconMoneyExchangeStroked size="large" style={{ color: '#1890ff', marginBottom: 12 }} />
              <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>累计充值</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#1890ff' }}>
                {formatMoney(accountStats.totalRecharge)}
              </div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            bodyStyle={{ padding: '24px' }}
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
          >
            <div style={{ textAlign: 'center' }}>
              <IconArrowUp size="large" style={{ color: '#fa8c16', marginBottom: 12 }} />
              <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>累计消耗</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#fa8c16' }}>
                {formatMoney(accountStats.totalConsumption)}
              </div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            bodyStyle={{ padding: '24px' }}
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
          >
            <div style={{ textAlign: 'center' }}>
              <IconMoneyExchangeStroked size="large" style={{ color: '#52c41a', marginBottom: 12 }} />
              <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>剩余余额</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#52c41a' }}>
                {formatMoney(accountStats.totalBalance)}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 账户管理表格 */}
      <Card
        title="账户管理"
        bodyStyle={{ padding: '20px' }}
        style={{ borderRadius: 12, marginBottom: 32 }}
      >
        <Table
          columns={accountColumns}
          dataSource={accounts}
          loading={accountsLoading}
          rowKey="id"
          pagination={false}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* 费率配置表格 */}
      <Card
        title="费率配置"
        bodyStyle={{ padding: '20px' }}
        style={{ borderRadius: 12 }}
      >
        {/* 筛选栏 */}
        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            value={pricingVendorId}
            onChange={setPricingVendorId}
            placeholder="选择供应商"
            style={{ width: 180 }}
            clearable
          >
            <Select.Option value="">全部供应商</Select.Option>
            {(Array.isArray(vendors) ? vendors : []).map((v) => (
              <Select.Option key={v.id} value={v.id}>
                {v.name}
              </Select.Option>
            ))}
          </Select>
          <Input
            value={pricingKeyword}
            onChange={setPricingKeyword}
            placeholder="搜索模型名称"
            style={{ width: 200 }}
            clearable
          />
          <Button theme="solid" onClick={fetchPricings}>
            查询
          </Button>
          <Button theme="solid" type="primary" onClick={handleAddPricing}>
            新增费率
          </Button>
        </Space>

        <Table
          columns={pricingColumns}
          dataSource={pricings}
          loading={pricingsLoading}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      {/* 新增/编辑费率弹窗 */}
      <Modal
        title={isEditingPricing ? '编辑费率配置' : '新增费率配置'}
        visible={pricingModalVisible}
        onOk={handleSavePricing}
        onCancel={() => {
          setIsEditingPricing(false);
          setPricingModalVisible(false);
        }}
        okText="保存"
        cancelText="取消"
        style={{ maxWidth: 800 }}
      >
        <Form form={pricingForm} layout="vertical">
          <Form.Select
            field="vendor_id"
            label="供应商"
            placeholder="请选择供应商"
            required
            validators={['required']}
            style={{ marginBottom: 16 }}
          >
            {(Array.isArray(vendors) ? vendors : []).map((v) => (
              <Select.Option key={v.id} value={v.id}>
                {v.name}
              </Select.Option>
            ))}
          </Form.Select>
          <Form.Input
            field="model_id"
            label="模型ID"
            placeholder="请输入模型ID"
            required
            validators={['required']}
            style={{ marginBottom: 16 }}
          />
          <Form.Input
            field="model_name"
            label="模型名称"
            placeholder="请输入模型名称"
            required
            validators={['required']}
            style={{ marginBottom: 16 }}
          />
          <Form.Input
            field="token_range"
            label="Token范围"
            placeholder="如：0<Token≤32K"
            style={{ marginBottom: 16 }}
          />
          <Form.Select
            field="pricing_method"
            label="计费方式"
            placeholder="请选择计费方式"
            required
            validators={['required']}
            style={{ marginBottom: 16 }}
          >
            <Select.Option value="per_token">按Token计费</Select.Option>
            <Select.Option value="per_call">按次计费</Select.Option>
            <Select.Option value="per_second">按秒计费</Select.Option>
            <Select.Option value="per_image">按张计费</Select.Option>
          </Form.Select>
          <Row gutter={16}>
            <Col span={12}>
              <Form.InputNumber
                field="official_input_price"
                label="官方输入单价"
                placeholder="元/每百万tokens"
                min={0}
                precision={6}
                style={{ width: '100%' }}
              />
            </Col>
            <Col span={12}>
              <Form.InputNumber
                field="official_output_price"
                label="官方输出单价"
                placeholder="元/每百万tokens"
                min={0}
                precision={6}
                style={{ width: '100%' }}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.InputNumber
                field="discount_rate"
                label="合作折扣"
                placeholder="如：0.35表示35%折扣"
                min={0}
                max={1}
                precision={4}
                style={{ width: '100%' }}
              />
            </Col>
            <Col span={12}>
              <Form.Input
                field="region"
                label="可用区"
                placeholder="如：中国大陆"
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.InputNumber
                field="tpm"
                label="TPM"
                placeholder="每分钟最大token数"
                min={0}
                style={{ width: '100%' }}
              />
            </Col>
            <Col span={12}>
              <Form.InputNumber
                field="rpm"
                label="RPM"
                placeholder="每分钟最大请求数"
                min={0}
                style={{ width: '100%' }}
              />
            </Col>
          </Row>
          <Form.TextArea
            field="notes"
            label="备注"
            placeholder="请输入备注信息"
            rows={3}
          />
        </Form>
      </Modal>

      {/* 充值弹窗 */}
      <Modal
        title="账户充值"
        visible={rechargeModalVisible}
        onOk={handleRecharge}
        onCancel={() => setRechargeModalVisible(false)}
        okText="确认充值"
        cancelText="取消"
      >
        <Form form={rechargeForm} layout="vertical">
          <Form.InputNumber
            field="amount"
            label="充值金额"
            placeholder="请输入充值金额"
            required
            validators={['required']}
            min={0}
            precision={2}
            style={{ width: '100%' }}
          />
          <Form.Select
            field="method"
            label="支付方式"
            placeholder="请选择支付方式"
            required
            validators={['required']}
          >
            <Select.Option value="bank_transfer">银行转账</Select.Option>
            <Select.Option value="alipay">支付宝</Select.Option>
            <Select.Option value="wechat">微信</Select.Option>
            <Select.Option value="other">其他</Select.Option>
          </Form.Select>
          <Form.TextArea
            field="remark"
            label="备注"
            placeholder="请输入备注信息"
            rows={3}
          />
        </Form>
      </Modal>
    </div>
  );
}
