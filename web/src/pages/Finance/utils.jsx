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

/**
 * 财务模块共享工具函数
 */

/**
 * 格式化金额
 * @param {number} value - 金额数值
 * @returns {string} 格式化后的金额字符串
 */
export const formatMoney = (value) => {
  if (!value && value !== 0) return '-';
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * 格式化金额（无货币符号）
 * @param {number} value - 金额数值
 * @returns {string} 格式化后的金额字符串
 */
export const formatMoneyPlain = (value) => {
  if (!value && value !== 0) return '-';
  return `¥${parseFloat(value).toFixed(2)}`;
};

/**
 * 格式化时间戳
 * @param {number} ts - 时间戳（秒）
 * @returns {string} 格式化后的时间字符串
 */
export const formatTimestamp = (ts) => {
  if (!ts) return '-';
  return new Date(ts * 1000).toLocaleString('zh-CN');
};

/**
 * 格式化日期
 * @param {number} ts - 时间戳（秒）
 * @returns {string} 格式化后的日期字符串
 */
export const formatDate = (ts) => {
  if (!ts) return '-';
  return new Date(ts * 1000).toLocaleDateString('zh-CN');
};

/**
 * 格式化数字
 * @param {number} value - 数值
 * @returns {string} 格式化后的数字字符串
 */
export const formatNumber = (value) => {
  if (!value && value !== 0) return '-';
  return new Intl.NumberFormat('zh-CN').format(value);
};

/**
 * 生成状态标签
 * @param {string} status - 状态值
 * @param {Object} statusMap - 状态映射表 { status: { color, text } }
 * @param {Object} t - 国际化函数
 * @returns {JSX.Element} StatusTag 组件
 */
export const getStatusTag = (status, statusMap, t) => {
  const config = statusMap[status] || { color: 'gray', text: status };
  const text = t?.(config.text) || config.text;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: 12,
        backgroundColor: `${config.color}14`,
        color: config.color,
        borderColor: `${config.color}40`,
        border: '1px solid',
      }}
    >
      {text}
    </span>
  );
};

/**
 * 生成类型标签
 * @param {string} type - 类型值
 * @param {Object} typeMap - 类型映射表 { type: { color, text } }
 * @param {Object} t - 国际化函数
 * @returns {JSX.Element} TypeTag 组件
 */
export const getTypeTag = (type, typeMap, t) => {
  const config = typeMap[type] || { color: 'gray', text: type };
  const text = t?.(config.text) || config.text;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: 12,
        backgroundColor: `${config.color}14`,
        color: config.color,
        borderColor: `${config.color}40`,
        border: '1px solid',
      }}
    >
      {text}
    </span>
  );
};

/**
 * 创建筛选器选项数组
 * @param {Object} t - 国际化函数
 * @param {Array} baseOptions - 基础选项 [{ value, label }]
 * @param {Object} optionMap - 选项映射表 { key: { label } }
 * @returns {Array} 完整的筛选器选项数组
 */
export const createFilterOptions = (t, baseOptions, optionMap = {}) => {
  return [
    { value: '', label: t('全部') },
    ...baseOptions.map((opt) => ({
      ...opt,
      label: t(optionMap[opt.value]?.label || opt.label),
    })),
  ];
};
