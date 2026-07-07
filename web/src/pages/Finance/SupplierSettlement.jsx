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
  Tabs,
} from '@douyinfe/semi-ui';
import {
  IconMoneyExchangeStroked,
  IconEditStroked,
  IconDownloadStroked,
  IconPlusStroked,
  IconRefresh,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../helpers';
import { StatusContext } from '../../context/Status';
import * as SupplierAPI from '../../services/supplier';

const { Header, Content } = Layout;
const { Text } = Typography;

// 格式化金额
const formatMoney = (value) => {
  if (!value && value !== 0) return '-';
  return new Intl.NumberFormat('zh-CN', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// 格式化数字
const formatNumber = (value) => {
  if (!value && value !== 0) return '-';
  return new Intl.NumberFormat('zh-CN').format(value);
};

// 状态标签映射
const settlementStatusMap = {
  pending: { text: '待确认', color: 'orange' },
  confirmed: { text: '已确认', color: 'blue' },
  paid: { text: '已支付', color: 'green' },
  cancelled: { text: '已取消', color: 'red' },
};

const rebateStatusMap = {
  pending: { text: '待同步', color: 'orange' },
  successed: { text: '同步成功', color: 'green' },
  failed: { text: '同步失败', color: 'red' },
};

export default function SupplierSettlement() {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const isAdmin = statusState?.user?.is_admin === true;

  // Tab状态
  const [activeTab, setActiveTab] = useState('supplier');

  // 供应商侧数据
  const [settlements, setSettlements] = useState([]);
  const [settlementsLoading, setSettlementsLoading] = useState(false);
  const [totalSettlements, setTotalSettlements] = useState(0);
  const [vendors, setVendors] = useState([]);
  const [models, setModels] = useState([]);

  // 用户侧返点数据
  const [rebates, setRebates] = useState([]);
  const [rebatesLoading, setRebatesLoading] = useState(false);
  const [totalRebates, setTotalRebates] = useState(0);
  const [rebateStatistics, setRebateStatistics] = useState(null);

  // 筛选条件
  const [filterVendorId, setFilterVendorId] = useState('');
  const [filterModelId, setFilterModelId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRebateStatus, setFilterRebateStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 弹窗状态
  const [manualSettlementModalVisible, setManualSettlementModalVisible] = useState(false);
  const [settlementForm] = Form.useForm();

  const [manualRebateModalVisible, setManualRebateModalVisible] = useState(false);
  const [rebateForm] = Form.useForm();

  // 获取供应商列表
  const fetchVendors = async () => {
    try {
      const res = await API.get('/api/vendors/?page_size=1000');
      if (res.data.success) {
        setVendors(res.data.data?.vendors || []);
      }
    } catch (error) {
      console.error('获取供应商列表失败:', error);
    }
  };

  // 获取模型列表
  const fetchModels = async () => {
    try {
      const res = await API.get('/api/models/?page_size=1000');
      if (res.data.success) {
        setModels(res.data.data?.models || []);
      }
    } catch (error) {
      console.error('获取模型列表失败:', error);
    }
  };

  // 获取供应商结算列表
  const fetchSettlements = async () => {
    setSettlementsLoading(true);
    try {
      const params = {
        page: currentPage,
        page_size: pageSize,
      };
      if (filterVendorId) params.vendor_id = filterVendorId;
      if (filterModelId) params.model_id = filterModelId;
      if (filterStatus) params.status = filterStatus;

      const res = await SupplierAPI.fetchSupplierSettlementAggregation(params);
      if (res.success) {
        setSettlements(res.data || []);
        // 获取总数
        const countRes = await API.get('/api/supplier/settlement/aggregation', {
          params: { ...params, page: 1, page_size: 1 },
        });
        if (countRes.data.success) {
          // 使用聚合接口的总数
          setTotalSettlements(res.data?.length || 0);
        }
      }
    } catch (error) {
      showError('获取结算列表失败: ' + (error.message || '未知错误'));
    } finally {
      setSettlementsLoading(false);
    }
  };

  // 获取返点列表
  const fetchRebates = async () => {
    setRebatesLoading(true);
    try {
      const params = {
        page: currentPage,
        page_size: pageSize,
      };
      if (filterVendorId) params.vendor_id = filterVendorId;
      if (filterRebateStatus) params.status = filterRebateStatus;

      const res = await SupplierAPI.fetchRebateList(params);
      if (res.success) {
        setRebates(res.data?.list || []);
        setTotalRebates(res.data?.total || 0);
      }
    } catch (error) {
      showError('获取返点列表失败: ' + (error.message || '未知错误'));
    } finally {
      setRebatesLoading(false);
    }
  };

  // 获取返点统计
  const fetchRebateStatistics = async () => {
    try {
      const params = {};
      if (filterVendorId) params.vendor_id = filterVendorId;

      const res = await SupplierAPI.getRebateStatistics(params);
      if (res.success) {
        setRebateStatistics(res.data);
      }
    } catch (error) {
      console.error('获取返点统计失败:', error);
    }
  };

  // 导出结算列表
  const handleExportSettlements = async () => {
    try {
      const params = {};
      if (filterVendorId) params.vendor_id = filterVendorId;
      if (filterModelId) params.model_id = filterModelId;
      if (filterStatus) params.status = filterStatus;

      const res = await SupplierAPI.exportSupplierSettlementList(params);
      if (res.success) {
        handleDownloadCSV(res.data, 'supplier_settlement');
        showSuccess('导出成功');
      }
    } catch (error) {
      showError('导出失败: ' + (error.message || '未知错误'));
    }
  };

  // 导出返点列表
  const handleExportRebates = async () => {
    try {
      const params = {};
      if (filterVendorId) params.vendor_id = filterVendorId;
      if (filterRebateStatus) params.status = filterRebateStatus;

      const res = await SupplierAPI.exportRebateList(params);
      if (res.success) {
        handleDownloadCSV(res.data, 'supplier_rebate');
        showSuccess('导出成功');
      }
    } catch (error) {
      showError('导出失败: ' + (error.message || '未知错误'));
    }
  };

  // 下载CSV
  const handleDownloadCSV = (data, filename) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      showError('没有可导出的数据');
      return;
    }

    const headers = activeTab === 'supplier'
      ? ['ID', '供应商名称', '渠道', '模型', '官网价格', '额度', 'Token', '计费方式', '平台消耗Token', '平台花费', '平台剩余Token', '平台剩余金额', '供应商返点额度', '状态', '周期', '创建时间', '更新时间']
      : ['ID', '供应商名称', '周期', '返点类型', '返点金额', '返点Token', '状态', '来源', '备注', '创建时间', '更新时间'];

    const keys = activeTab === 'supplier'
      ? ['id', 'vendor_name', 'channel', 'model', 'official_input_price', 'quota', 'tokens', 'pricing_method', 'platform_consumed_tokens', 'platform_cost', 'platform_remaining_tokens', 'platform_remaining_amount', 'rebate_amount', 'status', 'period', 'create_time', 'update_time']
      : ['id', 'vendor_name', 'period', 'rebate_type', 'rebate_amount', 'rebate_tokens', 'status', 'source', 'remark', 'create_time', 'update_time'];

    let csvContent = '\uFEFF' + headers.join(',') + '\n';
    
    data.forEach(item => {
      const row = keys.map(key => {
        let value = item[key];
        if (value === null || value === undefined) value = '';
        // 处理包含逗号或换行符的值
        value = String(value).replace(/"/g, '""');
        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
          return `"${value}"`;
        }
        return value;
      });
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // 手动创建结算单
  const handleCreateManualSettlement = async () => {
    try {
      const values = await settlementForm.validate();
      const res = await SupplierAPI.createManualSettlement(values);
      if (res.success) {
        showSuccess('创建成功');
        setManualSettlementModalVisible(false);
        settlementForm.reset();
        fetchSettlements();
      } else {
        showError(res.message || '创建失败');
      }
    } catch (error) {
      showError('创建失败: ' + (error.message || '参数错误'));
    }
  };

  // 手动创建返点记录
  const handleCreateManualRebate = async () => {
    try {
      const values = await rebateForm.validate();
      const res = await SupplierAPI.createManualRebate(values);
      if (res.success) {
        showSuccess('创建成功');
        setManualRebateModalVisible(false);
        rebateForm.reset();
        fetchRebates();
        fetchRebateStatistics();
      } else {
        showError(res.message || '创建失败');
      }
    } catch (error) {
      showError('创建失败: ' + (error.message || '参数错误'));
    }
  };

  // 初始化数据
  useEffect(() => {
    fetchVendors();
    fetchModels();
  }, []);

  // Tab切换时重置筛选
  useEffect(() => {
    setCurrentPage(1);
    setFilterVendorId('');
    setFilterModelId('');
    setFilterStatus('');
    setFilterRebateStatus('');
  }, [activeTab]);

  // 数据加载
  useEffect(() => {
    if (activeTab === 'supplier') {
      fetchSettlements();
    } else {
      fetchRebates();
      fetchRebateStatistics();
    }
  }, [activeTab, currentPage, pageSize, filterVendorId, filterModelId, filterStatus, filterRebateStatus]);

  // 供应商侧表格列
  const settlementColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: '供应商名称',
      dataIndex: 'vendor_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '渠道',
      dataIndex: 'channel',
      width: 100,
    },
    {
      title: '模型',
      dataIndex: 'model',
      width: 120,
      ellipsis: true,
    },
    {
      title: '官网价格',
      dataIndex: 'official_input_price',
      width: 100,
      render: (value) => formatMoney(value),
    },
    {
      title: '额度',
      dataIndex: 'quota',
      width: 100,
      render: (value) => formatMoney(value),
    },
    {
      title: 'Token',
      dataIndex: 'tokens',
      width: 80,
      render: (value) => formatNumber(value),
    },
    {
      title: '计费方式',
      dataIndex: 'pricing_method',
      width: 100,
    },
    {
      title: '平台消耗Token',
      dataIndex: 'platform_consumed_tokens',
      width: 120,
      render: (value) => formatNumber(value),
    },
    {
      title: '平台花费',
      dataIndex: 'platform_cost',
      width: 100,
      render: (value) => formatMoney(value),
    },
    {
      title: '平台剩余Token',
      dataIndex: 'platform_remaining_tokens',
      width: 120,
      render: (value) => formatNumber(value),
    },
    {
      title: '平台剩余金额',
      dataIndex: 'platform_remaining_amount',
      width: 120,
      render: (value) => formatMoney(value),
    },
    {
      title: '供应商返点额度',
      dataIndex: 'rebate_amount',
      width: 120,
      render: (value) => formatMoney(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (value) => {
        const statusInfo = settlementStatusMap[value] || { text: value, color: 'gray' };
        return <Tag color={statusInfo.color} size="small">{statusInfo.text}</Tag>;
      },
    },
    {
      title: '周期',
      dataIndex: 'period',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'create_time',
      width: 160,
      render: (value) => {
        if (!value) return '-';
        return new Date(value * 1000).toLocaleString('zh-CN');
      },
    },
  ];

  // 返点侧表格列
  const rebateColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: '供应商名称',
      dataIndex: 'vendor_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '周期',
      dataIndex: 'period',
      width: 100,
    },
    {
      title: '返点类型',
      dataIndex: 'rebate_type',
      width: 100,
    },
    {
      title: '返点金额',
      dataIndex: 'rebate_amount',
      width: 120,
      render: (value) => formatMoney(value),
    },
    {
      title: '返点Token',
      dataIndex: 'rebate_tokens',
      width: 100,
      render: (value) => formatNumber(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value) => {
        const statusInfo = rebateStatusMap[value] || { text: value, color: 'gray' };
        return <Tag color={statusInfo.color} size="small">{statusInfo.text}</Tag>;
      },
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 80,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 150,
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'create_time',
      width: 160,
      render: (value) => {
        if (!value) return '-';
        return new Date(value * 1000).toLocaleString('zh-CN');
      },
    },
  ];

  return (
    <Layout style={{ height: '100%', background: '#f5f5f5' }}>
      <Header style={{
        background: '#fff',
        padding: '12px 24px',
        borderBottom: '1px solid #e8e8e8',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
              <IconMoneyExchangeStroked style={{ marginRight: '8px' }} />
              供应商结算管理
            </h2>
            <Text type="tertiary" style={{ fontSize: '12px' }}>
              管理供应商结算记录和返点信息
            </Text>
          </div>
          <Space>
            {activeTab === 'supplier' && (
              <>
                <Button
                  icon={<IconPlusStroked />}
                  theme="solid"
                  onClick={() => setManualSettlementModalVisible(true)}
                >
                  新增结算
                </Button>
                <Button
                  icon={<IconDownloadStroked />}
                  onClick={handleExportSettlements}
                >
                  导出
                </Button>
              </>
            )}
            {activeTab === 'user' && (
              <>
                <Button
                  icon={<IconPlusStroked />}
                  theme="solid"
                  onClick={() => setManualRebateModalVisible(true)}
                >
                  新增返点
                </Button>
                <Button
                  icon={<IconDownloadStroked />}
                  onClick={handleExportRebates}
                >
                  导出
                </Button>
              </>
            )}
          </Space>
        </div>
      </Header>

      <Content style={{ padding: '24px', height: 'calc(100% - 60px)', overflow: 'auto' }}>
        <Card>
          {/* Tab标签 */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            type="card"
            style={{ marginBottom: '16px' }}
          >
            <Tabs.TabPane tab="供应商侧" itemKey="supplier" />
            <Tabs.TabPane tab="用户侧" itemKey="user" />
          </Tabs>

          {/* 筛选条件 */}
          <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
            <Col span={6}>
              <Select
                placeholder="选择供应商"
                value={filterVendorId}
                onChange={setFilterVendorId}
                style={{ width: '100%' }}
                clearable
              >
                {vendors.map(vendor => (
                  <Select.Option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </Select.Option>
                ))}
              </Select>
            </Col>
            
            {activeTab === 'supplier' && (
              <>
                <Col span={6}>
                  <Select
                    placeholder="选择模型"
                    value={filterModelId}
                    onChange={setFilterModelId}
                    style={{ width: '100%' }}
                    clearable
                  >
                    {models.map(model => (
                      <Select.Option key={model.id} value={model.id}>
                        {model.name}
                      </Select.Option>
                    ))}
                  </Select>
                </Col>
                <Col span={6}>
                  <Select
                    placeholder="结算状态"
                    value={filterStatus}
                    onChange={setFilterStatus}
                    style={{ width: '100%' }}
                    clearable
                  >
                    {Object.entries(settlementStatusMap).map(([key, value]) => (
                      <Select.Option key={key} value={key}>
                        {value.text}
                      </Select.Option>
                    ))}
                  </Select>
                </Col>
              </>
            )}

            {activeTab === 'user' && (
              <Col span={6}>
                <Select
                  placeholder="返点状态"
                  value={filterRebateStatus}
                  onChange={setFilterRebateStatus}
                  style={{ width: '100%' }}
                  clearable
                >
                  {Object.entries(rebateStatusMap).map(([key, value]) => (
                    <Select.Option key={key} value={key}>
                      {value.text}
                    </Select.Option>
                  ))}
                </Select>
              </Col>
            )}

            <Col span={6}>
              <Button
                icon={<IconRefresh />}
                onClick={() => {
                  if (activeTab === 'supplier') {
                    fetchSettlements();
                  } else {
                    fetchRebates();
                    fetchRebateStatistics();
                  }
                }}
              >
                刷新
              </Button>
            </Col>
          </Row>

          {/* 返点统计（仅用户侧Tab显示） */}
          {activeTab === 'user' && rebateStatistics && (
            <Row gutter={16} style={{ marginBottom: '16px' }}>
              <Col span={6}>
                <Card hoverable style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '600', color: '#1890ff' }}>
                    {rebateStatistics.total_rebates || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>返点总数</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card hoverable style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '600', color: '#52c41a' }}>
                    {formatMoney(rebateStatistics.total_rebate_amount || 0)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>返点总额</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card hoverable style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '600', color: '#52c41a' }}>
                    {formatNumber(rebateStatistics.successed_rebates || 0)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>成功</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card hoverable style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '600', color: '#ff4d4f' }}>
                    {rebateStatistics.failed_rebates || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>失败</div>
                </Card>
              </Col>
            </Row>
          )}

          {/* 数据表格 */}
          {activeTab === 'supplier' ? (
            <Table
              columns={settlementColumns}
              dataSource={settlements}
              loading={settlementsLoading}
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: totalSettlements,
                onChange: (page) => setCurrentPage(page),
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
              }}
              rowKey="id"
              size="middle"
            />
          ) : (
            <Table
              columns={rebateColumns}
              dataSource={rebates}
              loading={rebatesLoading}
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: totalRebates,
                onChange: (page) => setCurrentPage(page),
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
              }}
              rowKey="id"
              size="middle"
            />
          )}
        </Card>
      </Content>

      {/* 手动创建结算单弹窗 */}
      <Modal
        title="手动创建结算单"
        visible={manualSettlementModalVisible}
        onOk={handleCreateManualSettlement}
        onCancel={() => {
          setManualSettlementModalVisible(false);
          settlementForm.reset();
        }}
        width={600}
      >
        <Form form={settlementForm} labelPosition="left">
          <Form.Input
            field="vendor_id"
            title="供应商ID"
            placeholder="请输入供应商ID"
            required
            initialValue={filterVendorId || undefined}
          />
          <Form.Input
            field="vendor_name"
            title="供应商名称"
            placeholder="请输入供应商名称"
            required
          />
          <Form.Input
            field="period"
            title="结算周期"
            placeholder="例如: 2024-01"
            required
          />
          <Form.Input
            field="channel"
            title="渠道"
            placeholder="例如: openai"
          />
          <Form.Input
            field="model"
            title="模型"
            placeholder="例如: gpt-4"
          />
          <Form.Input
            field="quota"
            title="额度"
            placeholder="请输入额度"
            type="number"
            step="0.01"
          />
          <Form.Input
            field="tokens"
            title="Token数量"
            placeholder="请输入Token数量"
            type="number"
          />
          <Form.Input
            field="pricing_method"
            title="计费方式"
            placeholder="例如: token, call"
          />
          <Form.Input
            field="status"
            title="状态"
            placeholder="例如: pending"
            initialValue="pending"
          />
        </Form>
      </Modal>

      {/* 手动创建返点记录弹窗 */}
      <Modal
        title="手动创建返点记录"
        visible={manualRebateModalVisible}
        onOk={handleCreateManualRebate}
        onCancel={() => {
          setManualRebateModalVisible(false);
          rebateForm.reset();
        }}
        width={600}
      >
        <Form form={rebateForm} labelPosition="left">
          <Form.Input
            field="vendor_id"
            title="供应商ID"
            placeholder="请输入供应商ID"
            required
            initialValue={filterVendorId || undefined}
          />
          <Form.Input
            field="vendor_name"
            title="供应商名称"
            placeholder="请输入供应商名称"
            required
          />
          <Form.Input
            field="period"
            title="返点周期"
            placeholder="例如: 2024-01"
            required
          />
          <Form.Select
            field="rebate_type"
            title="返点类型"
            placeholder="请选择返点类型"
            required
            initialValue="manual"
          >
            <Select.Option value="manual">手动</Select.Option>
            <Select.Option value="automatic">自动</Select.Option>
            <Select.Option value="promotion">活动返点</Select.Option>
          </Form.Select>
          <Form.Input
            field="rebate_amount"
            title="返点金额"
            placeholder="请输入返点金额"
            type="number"
            step="0.01"
            required
          />
          <Form.Input
            field="rebate_tokens"
            title="返点Token"
            placeholder="请输入返点Token数量"
            type="number"
          />
          <Form.Input
            field="source"
            title="来源"
            placeholder="例如: manual"
            initialValue="manual"
          />
          <Form.TextArea
            field="remark"
            title="备注"
            placeholder="请输入备注"
            style={{ minHeight: 80 }}
          />
        </Form>
      </Modal>
    </Layout>
  );
}
