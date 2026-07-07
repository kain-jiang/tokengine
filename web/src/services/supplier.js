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

import { API } from '../helpers';

// ============================================
// 供应商费率管理 API
// ============================================

// 获取所有费率配置
export const fetchSupplierPricings = async (params = {}) => {
  const res = await API.get('/api/supplier/pricing', { params });
  return res.data;
};

// 搜索费率配置
export const searchSupplierPricings = async (keyword, vendorId, modelId, params = {}) => {
  const searchParams = { keyword, vendor_id: vendorId, model_id: modelId, ...params };
  const res = await API.get('/api/supplier/pricing/search', { params: searchParams });
  return res.data;
};

// 获取费率详情
export const getSupplierPricing = async (id) => {
  const res = await API.get(`/api/supplier/pricing/${id}`);
  return res.data;
};

// 创建费率配置
export const createSupplierPricing = async (data) => {
  const res = await API.post('/api/supplier/pricing', data);
  return res.data;
};

// 更新费率配置
export const updateSupplierPricing = async (data) => {
  const res = await API.put('/api/supplier/pricing', data);
  return res.data;
};

// 删除费率配置
export const deleteSupplierPricing = async (id) => {
  const res = await API.delete(`/api/supplier/pricing/${id}`);
  return res.data;
};

// 批量导入费率（CSV）
export const importSupplierPricings = async (formData) => {
  const res = await API.post('/api/supplier/pricing/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

// 批量更新费率
export const batchUpdateSupplierPricings = async (data) => {
  const res = await API.post('/api/supplier/pricing/batch', data);
  return res.data;
};

// ============================================
// 供应商结算管理 API
// ============================================

// 获取所有结算单
export const fetchSupplierSettlements = async (params = {}) => {
  const res = await API.get('/api/supplier/settlement', { params });
  return res.data;
};

// 获取结算单详情
export const getSupplierSettlement = async (id) => {
  const res = await API.get(`/api/supplier/settlement/${id}`);
  return res.data;
};

// 获取结算单明细
export const getSupplierSettlementDetails = async (id) => {
  const res = await API.get(`/api/supplier/settlement/${id}/details`);
  return res.data;
};

// 生成结算单
export const generateSupplierSettlement = async (data) => {
  const res = await API.post('/api/supplier/settlement/generate', data);
  return res.data;
};

// 批量生成结算单
export const generateAllSupplierSettlements = async (data) => {
  const res = await API.post('/api/supplier/settlement/generate-all', data);
  return res.data;
};

// 确认结算单
export const confirmSupplierSettlement = async (id) => {
  const res = await API.put(`/api/supplier/settlement/${id}/confirm`);
  return res.data;
};

// 标记已付款
export const markSupplierSettlementPaid = async (id) => {
  const res = await API.put(`/api/supplier/settlement/${id}/paid`);
  return res.data;
};

// 取消结算单
export const cancelSupplierSettlement = async (id) => {
  const res = await API.put(`/api/supplier/settlement/${id}/cancel`);
  return res.data;
};

// 导出结算单
export const exportSupplierSettlements = async (params = {}) => {
  const res = await API.get('/api/supplier/settlement/export', { params });
  return res.data;
};

// ============================================
// 供应商账户管理 API
// ============================================

// 获取所有账户
export const fetchSupplierAccounts = async (params = {}) => {
  const res = await API.get('/api/supplier/account', { params });
  return res.data;
};

// 获取供应商账户
export const getSupplierAccount = async (vendorId) => {
  const res = await API.get(`/api/supplier/account/${vendorId}`);
  return res.data;
};

// 充值
export const rechargeSupplierAccount = async (data) => {
  const res = await API.post('/api/supplier/account/recharge', data);
  return res.data;
};

// 获取账户统计
export const getSupplierAccountStatistics = async (vendorId) => {
  const res = await API.get(`/api/supplier/account/${vendorId}/statistics`);
  return res.data;
};

// ============================================
// 供应商充值记录 API
// ============================================

// 获取所有充值记录
export const fetchSupplierRecharges = async (params = {}) => {
  const res = await API.get('/api/supplier/recharge', { params });
  return res.data;
};

// 获取充值记录详情
export const getSupplierRecharge = async (id) => {
  const res = await API.get(`/api/supplier/recharge/${id}`);
  return res.data;
};

// 导出充值记录
export const exportSupplierRecharges = async (params = {}) => {
  const res = await API.get('/api/supplier/recharge/export', { params });
  return res.data;
};

// ============================================
// 供应商结算聚合查询 API（增强功能）
// ============================================

// 获取供应商结算聚合列表
export const fetchSupplierSettlementAggregation = async (params = {}) => {
  const res = await API.get('/api/supplier/settlement/aggregation', { params });
  return res.data;
};

// 手动创建结算单
export const createManualSettlement = async (data) => {
  const res = await API.post('/api/supplier/settlement/manual', data);
  return res.data;
};

// 导出供应商结算列表
export const exportSupplierSettlementList = async (params = {}) => {
  const res = await API.get('/api/supplier/settlement/export', { params });
  return res.data;
};

// ============================================
// 供应商返点管理 API
// ============================================

// 获取返点列表
export const fetchRebateList = async (params = {}) => {
  const res = await API.get('/api/supplier/rebates', { params });
  return res.data;
};

// 获取返点统计
export const getRebateStatistics = async (params = {}) => {
  const res = await API.get('/api/supplier/rebates/statistics', { params });
  return res.data;
};

// 获取返点详情
export const getRebateById = async (id) => {
  const res = await API.get(`/api/supplier/rebates/${id}`);
  return res.data;
};

// 手动创建返点记录
export const createManualRebate = async (data) => {
  const res = await API.post('/api/supplier/rebates', data);
  return res.data;
};

// 更新返点记录
export const updateRebate = async (id, data) => {
  const res = await API.put(`/api/supplier/rebates/${id}`, data);
  return res.data;
};

// 更新返点状态
export const updateRebateStatus = async (id, status, remark) => {
  const res = await API.put(`/api/supplier/rebates/${id}/status`, { status, remark });
  return res.data;
};

// 删除返点记录
export const deleteRebate = async (id) => {
  const res = await API.delete(`/api/supplier/rebates/${id}`);
  return res.data;
};

// 导出返点列表
export const exportRebateList = async (params = {}) => {
  const res = await API.get('/api/supplier/rebates/export', { params });
  return res.data;
};

// ============================================
// 返点接口配置管理 API
// ============================================

// 获取返点配置列表
export const fetchRebateConfigList = async (params = {}) => {
  const res = await API.get('/api/supplier/rebate-configs', { params });
  return res.data;
};

// 创建返点配置
export const createRebateConfig = async (data) => {
  const res = await API.post('/api/supplier/rebate-configs', data);
  return res.data;
};

// 更新返点配置
export const updateRebateConfig = async (id, data) => {
  const res = await API.put(`/api/supplier/rebate-configs/${id}`, data);
  return res.data;
};

// 删除返点配置
export const deleteRebateConfig = async (id) => {
  const res = await API.delete(`/api/supplier/rebate-configs/${id}`);
  return res.data;
};

// 切换返点配置启用状态
export const toggleRebateConfig = async (id, syncEnabled) => {
  const res = await API.put(`/api/supplier/rebate-configs/${id}/toggle`, { sync_enabled: syncEnabled });
  return res.data;
};
