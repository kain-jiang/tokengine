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
  Button,
  Select,
  Modal,
  Form,
  Tag,
} from '@douyinfe/semi-ui';
import {
  IconMoneyExchangeStroked,
  IconDownloadStroked,
  IconPlusStroked,
  IconRefresh,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../helpers';
import { StatusContext } from '../../context/Status';
import * as SupplierAPI from '../../services/supplier';
import CardPro from '../../components/common/ui/CardPro';
import { formatMoney, formatNumber, getStatusTag } from './utils';
import { createCardProPagination } from '../../helpers/utils';
import { useIsMobile } from '../../hooks/common/useIsMobile';

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

const renderStatusTag = (status, statusMap) => {
  const info = statusMap[status] || { text: status, color: 'gray' };
  return <Tag color={info.color} size="small">{info.text}</Tag>;
};

export default function SupplierSettlement() {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const isMobile = useIsMobile();
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
      const params = { page: currentPage, page_size: pageSize };
      if (filterVendorId) params.vendor_id = filterVendorId;
      if (filterModelId) params.model_id = filterModelId;
      if (filterStatus) params.status = filterStatus;

      const res = await SupplierAPI.fetchSupplierSettlementAggregation(params);
      if (res.success) {
        setSettlements(res.data || []);
        const countRes = await API.get('/api/supplier/settlement/aggregation', {
          params: { ...params, page: 1, page_size: 1 },
        });
        if (countRes.data.success) {
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
      const params = { page: currentPage, page_size: pageSize };
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
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '供应商名称', dataIndex: 'vendor_name', width: 150 },
    { title: '渠道', dataIndex: 'channel', width: 100 },
    { title: '模型', dataIndex: 'model', width: 120 },
    { title: '官网价格', dataIndex: 'official_input_price', width: 100, render: (v) => formatMoney(v) },
    { title: '额度', dataIndex: 'quota', width: 100, render: (v) => formatMoney(v) },
    { title: 'Token', dataIndex: 'tokens', width: 80, render: (v) => formatNumber(v) },
    { title: '计费方式', dataIndex: 'pricing_method', width: 100 },
    { title: '平台消耗Token', dataIndex: 'platform_consumed_tokens', width: 120, render: (v) => formatNumber(v) },
    { title: '平台花费', dataIndex: 'platform_cost', width: 100, render: (v) => formatMoney(v) },
    { title: '平台剩余Token', dataIndex: 'platform_remaining_tokens', width: 120, render: (v) => formatNumber(v) },
    { title: '平台剩余金额', dataIndex: 'platform_remaining_amount', width: 120, render: (v) => formatMoney(v) },
    { title: '供应商返点额度', dataIndex: 'rebate_amount', width: 120, render: (v) => formatMoney(v) },
    { title: '状态', dataIndex: 'status', width: 80, render: (v) => renderStatusTag(v, settlementStatusMap) },
    { title: '周期', dataIndex: 'period', width: 100 },
    {
      title: '创建时间', dataIndex: 'create_time', width: 160,
      render: (v) => v ? new Date(v * 1000).toLocaleString('zh-CN') : '-',
    },
  ];

  // 返点侧表格列
  const rebateColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '供应商名称', dataIndex: 'vendor_name', width: 150 },
    { title: '周期', dataIndex: 'period', width: 100 },
    { title: '返点类型', dataIndex: 'rebate_type', width: 100 },
    { title: '返点金额', dataIndex: 'rebate_amount', width: 120, render: (v) => formatMoney(v) },
    { title: '返点Token', dataIndex: 'rebate_tokens', width: 100, render: (v) => formatNumber(v) },
    { title: '状态', dataIndex: 'status', width: 90, render: (v) => renderStatusTag(v, rebateStatusMap) },
    { title: '来源', dataIndex: 'source', width: 80 },
    { title: '备注', dataIndex: 'remark', width: 150 },
    {
      title: '创建时间', dataIndex: 'create_time', width: 160,
      render: (v) => v ? new Date(v * 1000).toLocaleString('zh-CN') : '-',
    },
  ];

  // 渲染表格
  const renderTable = (columns, data, loading) => {
    const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr style={{ backgroundColor: '#fafafa' }}>
              {columns.map((col) => (
                <th
                  key={col.dataIndex}
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
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
            {data.map((row, idx) => (
              <tr
                key={row.id || idx}
                style={{ borderBottom: '1px solid #f0f0f0', transition: 'background-color 0.2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {columns.map((col) => (
                  <td
                    key={`${row.id || idx}-${col.dataIndex}`}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      color: 'rgba(0, 0, 0, 0.65)',
                      whiteSpace: 'nowrap',
                      maxWidth: col.width,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {col.render ? col.render(row[col.dataIndex], row) : row[col.dataIndex]}
                  </td>
                ))}
              </tr>
            ))}
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={columns.length} style={{ padding: '40px 16px', textAlign: 'center', color: '#999' }}>
                  {t('暂无数据')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // Tabs 区域
  const tabsArea = (
    <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #f0f0f0', marginBottom: 0 }}>
      {['supplier', 'user'].map((key) => (
        <button
          key={key}
          onClick={() => setActiveTab(key)}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderBottom: activeTab === key ? '2px solid #1677ff' : '2px solid transparent',
            backgroundColor: 'transparent',
            fontSize: 14,
            fontWeight: activeTab === key ? 600 : 400,
            color: activeTab === key ? '#1677ff' : 'rgba(0, 0, 0, 0.65)',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {key === 'supplier' ? t('供应商侧') : t('用户侧')}
        </button>
      ))}
    </div>
  );

  // 搜索筛选区域
  const searchArea = (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      {/* 供应商筛选 */}
      <Select
        placeholder={t('选择供应商')}
        value={filterVendorId}
        onChange={(val) => { setFilterVendorId(val || ''); setCurrentPage(1); }}
        style={{ width: 180 }}
        size="small"
        showClear
      >
        {vendors.map(vendor => (
          <Select.Option key={vendor.id} value={vendor.id}>
            {vendor.name}
          </Select.Option>
        ))}
      </Select>

      {/* 模型筛选（仅供应商侧） */}
      {activeTab === 'supplier' && (
        <Select
          placeholder={t('选择模型')}
          value={filterModelId}
          onChange={(val) => { setFilterModelId(val || ''); setCurrentPage(1); }}
          style={{ width: 180 }}
          size="small"
          showClear
        >
          {models.map(model => (
            <Select.Option key={model.id} value={model.id}>
              {model.name}
            </Select.Option>
          ))}
        </Select>
      )}

      {/* 状态筛选 */}
      {activeTab === 'supplier' ? (
        <Select
          placeholder={t('结算状态')}
          value={filterStatus}
          onChange={(val) => { setFilterStatus(val || ''); setCurrentPage(1); }}
          style={{ width: 140 }}
          size="small"
          showClear
        >
          {Object.entries(settlementStatusMap).map(([key, value]) => (
            <Select.Option key={key} value={key}>{value.text}</Select.Option>
          ))}
        </Select>
      ) : (
        <Select
          placeholder={t('返点状态')}
          value={filterRebateStatus}
          onChange={(val) => { setFilterRebateStatus(val || ''); setCurrentPage(1); }}
          style={{ width: 140 }}
          size="small"
          showClear
        >
          {Object.entries(rebateStatusMap).map(([key, value]) => (
            <Select.Option key={key} value={key}>{value.text}</Select.Option>
          ))}
        </Select>
      )}

      {/* 刷新按钮 */}
      <button
        onClick={() => {
          if (activeTab === 'supplier') fetchSettlements();
          else { fetchRebates(); fetchRebateStatistics(); }
        }}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          height: 32, padding: '0 12px',
          border: '1px solid #d9d9d9', borderRadius: 6,
          fontSize: 12, backgroundColor: '#fff', cursor: 'pointer',
        }}
      >
        <IconRefresh style={{ fontSize: 14, marginRight: 4 }} />
        {t('刷新')}
      </button>

      {/* 分隔 */}
      <div style={{ flex: 1 }} />

      {/* 操作按钮 */}
      {activeTab === 'supplier' && (
        <>
          <button
            onClick={() => setManualSettlementModalVisible(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              height: 32, padding: '0 16px',
              backgroundColor: '#1677ff', color: '#fff',
              border: '1px solid #1677ff', borderRadius: 6,
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <IconPlusStroked style={{ fontSize: 14, marginRight: 4 }} />
            {t('新增结算')}
          </button>
          <button
            onClick={handleExportSettlements}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              height: 32, padding: '0 12px',
              border: '1px solid #d9d9d9', borderRadius: 6,
              fontSize: 12, backgroundColor: '#fff', cursor: 'pointer',
            }}
          >
            <IconDownloadStroked style={{ fontSize: 14, marginRight: 4 }} />
            {t('导出')}
          </button>
        </>
      )}
      {activeTab === 'user' && (
        <>
          <button
            onClick={() => setManualRebateModalVisible(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              height: 32, padding: '0 16px',
              backgroundColor: '#1677ff', color: '#fff',
              border: '1px solid #1677ff', borderRadius: 6,
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <IconPlusStroked style={{ fontSize: 14, marginRight: 4 }} />
            {t('新增返点')}
          </button>
          <button
            onClick={handleExportRebates}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              height: 32, padding: '0 12px',
              border: '1px solid #d9d9d9', borderRadius: 6,
              fontSize: 12, backgroundColor: '#fff', cursor: 'pointer',
            }}
          >
            <IconDownloadStroked style={{ fontSize: 14, marginRight: 4 }} />
            {t('导出')}
          </button>
        </>
      )}
    </div>
  );

  // 返点统计卡片（仅用户侧）
  const rebateStatsArea = activeTab === 'user' && rebateStatistics ? (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
      {[
        { label: '返点总数', value: rebateStatistics.total_rebates || 0, color: '#1890ff' },
        { label: '返点总额', value: formatMoney(rebateStatistics.total_rebate_amount || 0), color: '#52c41a' },
        { label: '成功', value: formatNumber(rebateStatistics.successed_rebates || 0), color: '#52c41a' },
        { label: '失败', value: rebateStatistics.failed_rebates || 0, color: '#ff4d4f' },
      ].map((stat, idx) => (
        <div
          key={idx}
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: '16px 24px',
            flex: 1,
            minWidth: 140,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 600, color: stat.color }}>{stat.value}</div>
          <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{stat.label}</div>
        </div>
      ))}
    </div>
  ) : null;

  // 分页
  const currentTotal = activeTab === 'supplier' ? totalSettlements : totalRebates;
  const paginationArea = createCardProPagination({
    currentPage,
    pageSize,
    total: currentTotal,
    onPageChange: setCurrentPage,
    onPageSizeChange: (size) => { setPageSize(size); setCurrentPage(1); },
    isMobile,
    t,
  });

  return (
    <>
      <CardPro
        type='type3'
        descriptionArea={null}
        tabsArea={tabsArea}
        searchArea={searchArea}
        paginationArea={paginationArea}
        t={t}
      >
        {/* 返点统计卡片 */}
        {rebateStatsArea}

        {/* 数据表格 */}
        {activeTab === 'supplier' ? (
          settlementsLoading && settlements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{
                width: 32, height: 32,
                border: '3px solid #f0f0f0',
                borderTopColor: '#1677ff',
                borderRadius: '50%',
                animation: 'semi-spin 0.6s infinite linear',
                margin: '0 auto',
              }} />
            </div>
          ) : (
            renderTable(settlementColumns, settlements, settlementsLoading)
          )
        ) : (
          rebatesLoading && rebates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{
                width: 32, height: 32,
                border: '3px solid #f0f0f0',
                borderTopColor: '#1677ff',
                borderRadius: '50%',
                animation: 'semi-spin 0.6s infinite linear',
                margin: '0 auto',
              }} />
            </div>
          ) : (
            renderTable(rebateColumns, rebates, rebatesLoading)
          )
        )}
      </CardPro>

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
          <Form.Input field="vendor_id" title="供应商ID" placeholder="请输入供应商ID" required initialValue={filterVendorId || undefined} />
          <Form.Input field="vendor_name" title="供应商名称" placeholder="请输入供应商名称" required />
          <Form.Input field="period" title="结算周期" placeholder="例如: 2024-01" required />
          <Form.Input field="channel" title="渠道" placeholder="例如: openai" />
          <Form.Input field="model" title="模型" placeholder="例如: gpt-4" />
          <Form.Input field="quota" title="额度" placeholder="请输入额度" type="number" step="0.01" />
          <Form.Input field="tokens" title="Token数量" placeholder="请输入Token数量" type="number" />
          <Form.Input field="pricing_method" title="计费方式" placeholder="例如: token, call" />
          <Form.Input field="status" title="状态" placeholder="例如: pending" initialValue="pending" />
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
          <Form.Input field="vendor_id" title="供应商ID" placeholder="请输入供应商ID" required initialValue={filterVendorId || undefined} />
          <Form.Input field="vendor_name" title="供应商名称" placeholder="请输入供应商名称" required />
          <Form.Input field="period" title="返点周期" placeholder="例如: 2024-01" required />
          <Form.Select field="rebate_type" title="返点类型" placeholder="请选择返点类型" required initialValue="manual">
            <Select.Option value="manual">手动</Select.Option>
            <Select.Option value="automatic">自动</Select.Option>
            <Select.Option value="promotion">活动返点</Select.Option>
          </Form.Select>
          <Form.Input field="rebate_amount" title="返点金额" placeholder="请输入返点金额" type="number" step="0.01" required />
          <Form.Input field="rebate_tokens" title="返点Token" placeholder="请输入返点Token数量" type="number" />
          <Form.Input field="source" title="来源" placeholder="例如: manual" initialValue="manual" />
          <Form.TextArea field="remark" title="备注" placeholder="请输入备注" style={{ minHeight: 80 }} />
        </Form>
      </Modal>
    </>
  );
}
