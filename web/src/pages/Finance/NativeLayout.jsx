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

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// ==================== Layout Components ====================

/**
 * 原生 Row 组件 - 替代 Semi-UI Row
 */
export const NativeRow = ({ children, gutter = 0, align, justify, style, ...props }) => (
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      margin: `0 -${gutter / 2}px`,
      alignItems: align === 'middle' ? 'center' : align === 'top' ? 'flex-start' : align === 'bottom' ? 'flex-end' : 'center',
      justifyContent: justify || 'flex-start',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

/**
 * 原生 Col 组件 - 替代 Semi-UI Col
 */
export const NativeCol = ({ children, span = 24, offset = 0, style, ...props }) => {
  const width = (span / 24) * 100;
  const marginLeft = (offset / 24) * 100;
  
  return (
    <div
      style={{
        width: `calc(${width}% - 10px)`,
        marginLeft: offset > 0 ? `${marginLeft}%` : undefined,
        paddingRight: '10px',
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * 原生 Space 组件 - 替代 Semi-UI Space
 */
export const NativeSpace = ({ children, direction = 'horizontal', wrap = false, size = 8, style, ...props }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: direction === 'vertical' ? 'column' : 'row',
      flexWrap: wrap ? 'wrap' : 'nowrap',
      gap: size,
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

// ==================== Form Components ====================

/**
 * 原生 Button 组件 - 替代 Semi-UI Button
 */
export const NativeButton = ({ 
  children, 
  type = 'default', 
  theme = 'light', 
  size = 'default', 
  onClick, 
  loading,
  disabled,
  theme: themeProp, 
  style, 
  ...props 
}) => {
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #d9d9d9',
    borderRadius: '6px',
    cursor: loading || disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    fontSize: size === 'small' ? 12 : 14,
    padding: size === 'small' ? '4px 12px' : '6px 16px',
    height: size === 'small' ? 32 : 40,
    minWidth: size === 'small' ? 32 : 40,
    outline: 'none',
    fontWeight: 500,
    opacity: loading || disabled ? 0.6 : 1,
    pointerEvents: loading || disabled ? 'none' : 'auto',
    ...style,
  };

  const typeStyles = {
    default: {
      light: { backgroundColor: '#fff', color: 'rgba(0, 0, 0, 0.88)', borderColor: '#d9d9d9' },
      solid: { backgroundColor: 'rgba(0, 0, 0, 0.04)', color: 'rgba(0, 0, 0, 0.88)', borderColor: 'transparent' },
      borderless: { backgroundColor: 'transparent', color: 'rgba(0, 0, 0, 0.88)', borderColor: 'transparent' },
    },
    primary: {
      light: { backgroundColor: '#fff', color: '#1677ff', borderColor: '#1677ff' },
      solid: { backgroundColor: '#1677ff', color: '#fff', borderColor: '#1677ff' },
      borderless: { backgroundColor: 'transparent', color: '#1677ff', borderColor: 'transparent' },
    },
    danger: {
      light: { backgroundColor: '#fff', color: '#ff4d4f', borderColor: '#ff4d4f' },
      solid: { backgroundColor: '#ff4d4f', color: '#fff', borderColor: '#ff4d4f' },
      borderless: { backgroundColor: 'transparent', color: '#ff4d4f', borderColor: 'transparent' },
    },
  };

  return (
    <button
      style={{ ...baseStyle, ...typeStyles[type]?.[themeProp || 'light'] }}
      onClick={onClick}
      disabled={loading || disabled}
      {...props}
    >
      {loading && (
        <span style={{ marginRight: 4 }}>
          <NativeSpin size="small" />
        </span>
      )}
      {children}
    </button>
  );
};

/**
 * 原生 Spin 组件 - 替代 Semi-UI Spin
 */
export const NativeSpin = ({ size = 'default', style, ...props }) => (
  <div style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', ...style }} {...props}>
    <div
      style={{
        width: size === 'large' ? 40 : size === 'small' ? 24 : 32,
        height: size === 'large' ? 40 : size === 'small' ? 24 : 32,
        border: `3px solid #f0f0f0`,
        borderTopColor: '#1677ff',
        borderRadius: '50%',
        animation: 'semi-spin 0.6s infinite linear',
      }}
    />
    <style>
      {`
        @keyframes semi-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}
    </style>
  </div>
);

/**
 * 原生 Tag 组件 - 替代 Semi-UI Tag
 */
export const NativeTag = ({ children, color = 'default', style, ...props }) => {
  const colors = {
    default: { backgroundColor: '#fafafa', color: 'rgba(0, 0, 0, 0.88)', borderColor: '#d9d9d9' },
    blue: { backgroundColor: '#e6f4ff', color: '#1677ff', borderColor: '#91caff' },
    green: { backgroundColor: '#f6ffed', color: '#52c41a', borderColor: '#b7eb8f' },
    orange: { backgroundColor: '#fff7e6', color: '#fa8c16', borderColor: '#ffd591' },
    purple: { backgroundColor: '#f9f0ff', color: '#722ed1', borderColor: '#d3adf7' },
    red: { backgroundColor: '#fff1f0', color: '#ff4d4f', borderColor: '#ffccc7' },
    gold: { backgroundColor: '#fcffe6', color: '#faad14', borderColor: '#ffea7c' },
    gray: { backgroundColor: '#f5f5f5', color: 'rgba(0, 0, 0, 0.45)', borderColor: '#d9d9d9' },
    cyan: { backgroundColor: '#e6fffb', color: '#13c2c2', borderColor: '#5cdbd3' },
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: 12,
        lineHeight: '20px',
        border: '1px solid',
        ...colors[color],
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  );
};

/**
 * 原生 Input 组件 - 替代 Semi-UI Input
 */
export const NativeInput = ({ 
  value, 
  onChange, 
  placeholder, 
  type = 'text', 
  prefix,
  suffix,
  style, 
  onPressEnter,
  onSearch,
  clearable,
  ...props 
}) => {
  const [focused, setFocused] = useState(false);
  const [internalValue, setInternalValue] = useState(value);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleChange = (e) => {
    const val = e.target.value;
    setInternalValue(val);
    onChange?.(val);
  };

  const handleClear = () => {
    setInternalValue('');
    onChange?.('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(internalValue);
    }
    if (onPressEnter) {
      onPressEnter(e);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%', ...style }}>
      {prefix && (
        <span style={{ position: 'absolute', left: 12, color: '#999', fontSize: 14 }}>{prefix}</span>
      )}
      <input
        type={type}
        value={internalValue || ''}
        placeholder={placeholder}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          height: 40,
          padding: prefix ? '0 12px 0 32px' : '0 12px',
          border: `1px solid ${focused ? '#1677ff' : '#d9d9d9'}`,
          borderRadius: '6px',
          fontSize: 14,
          outline: 'none',
          transition: 'border-color 0.2s',
          boxSizing: 'border-box',
          width: '100%',
          backgroundColor: 'transparent',
        }}
        {...props}
      />
      {clearable && internalValue && (
        <span 
          onClick={handleClear}
          style={{ 
            position: 'absolute', 
            right: 8, 
            cursor: 'pointer', 
            color: '#999',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          ×
        </span>
      )}
    </div>
  );
};

/**
 * NativeTextArea - 替代 Semi-UI Input.TextArea
 */
export const NativeTextArea = ({ 
  value, 
  onChange, 
  placeholder, 
  rows = 3, 
  style, 
  ...props 
}) => (
  <textarea
    value={value || ''}
    placeholder={placeholder}
    rows={rows}
    onChange={(e) => onChange?.(e.target.value)}
    style={{
      padding: '8px 12px',
      border: '1px solid #d9d9d9',
      borderRadius: '6px',
      fontSize: 14,
      outline: 'none',
      resize: 'vertical',
      boxSizing: 'border-box',
      width: '100%',
      fontFamily: 'inherit',
      ...style,
    }}
    {...props}
  />
);

/**
 * 原生 Select 组件 - 替代 Semi-UI Select
 */
export const NativeSelect = ({ 
  value, 
  onChange, 
  options = [], 
  placeholder, 
  style, 
  clearable,
  ...props 
}) => {
  const [focused, setFocused] = useState(false);
  
  return (
    <div style={{ position: 'relative', ...style }}>
      <select
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          height: 40,
          padding: `0 ${clearable ? 56 : 32}px 0 12px`,
          border: `1px solid ${focused ? '#1677ff' : '#d9d9d9'}`,
          borderRadius: '6px',
          fontSize: 14,
          outline: 'none',
          backgroundColor: '#fff',
          cursor: 'pointer',
          boxSizing: 'border-box',
          width: '100%',
          appearance: 'auto',
        }}
        {...props}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {clearable && value && (
        <span 
          onClick={() => onChange?.('')}
          style={{ 
            position: 'absolute', 
            right: 8, 
            top: '50%',
            transform: 'translateY(-50%)',
            cursor: 'pointer', 
            color: '#999',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'auto',
          }}
        >
          ×
        </span>
      )}
    </div>
  );
};

/**
 * 原生 DatePicker - 替代 Semi-UI DatePicker
 */
export const NativeDatePicker = ({ value, onChange, style, ...props }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 同步外部 value 到内部状态（支持 0 个、1 个或 2 个日期）
  useEffect(() => {
    if (!value || value.length === 0) {
      setStartDate('');
      setEndDate('');
    } else {
      // 处理单个或两个日期（兼容原生 input type="date" 返回的字符串和 moment.js 对象）
      const newStart = value[0]?.format?.('YYYY-MM-DD') || value[0] || '';
      const newEnd = value[1]?.format?.('YYYY-MM-DD') || value[1] || '';
      setStartDate(newStart);
      setEndDate(newEnd);
    }
  }, [value]);

  const handleStartChange = (val) => {
    setStartDate(val);
    // 传递完整的日期数组（包含空字符串），由父组件处理
    const newDates = val && endDate ? [val, endDate] : [val, endDate];
    onChange?.(newDates);
  };

  const handleEndChange = (val) => {
    setEndDate(val);
    // 传递完整的日期数组（包含空字符串），由父组件处理
    const newDates = startDate && val ? [startDate, val] : [startDate, val];
    onChange?.(newDates);
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', ...style }} {...props}>
      <input
        type="date"
        value={startDate}
        onChange={(e) => handleStartChange(e.target.value)}
        style={{
          height: 40,
          padding: '0 8px',
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <span style={{ color: '#999' }}>至</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => handleEndChange(e.target.value)}
        style={{
          height: 40,
          padding: '0 8px',
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
};

NativeDatePicker.RangePicker = NativeDatePicker;

// ==================== Data Display Components ====================

/**
 * 原生 Table 组件 - 替代 Semi-UI Table
 */
export const NativeTable = ({ 
  columns = [], 
  dataSource = [], 
  loading = false, 
  pagination = false, 
  rowKey = 'id',
  style,
  ...props 
}) => {
  const pageSize = pagination?.pageSize || 10;
  const total = dataSource.length;
  const totalPages = Math.ceil(total / pageSize);
  
  const [currentPage, setCurrentPage] = useState(1);
  
  const paginatedData = useMemo(() => {
    if (!pagination) return dataSource;
    return dataSource.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [dataSource, currentPage, pageSize, pagination]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <NativeSpin />
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', ...style }} {...props}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 14,
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
            {columns.map((col, idx) => (
              <th
                key={idx}
                style={{
                  padding: '12px 16px',
                  textAlign: col.align || 'left',
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
          {paginatedData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ textAlign: 'center', padding: '40px', color: '#999' }}
              >
                暂无数据
              </td>
            </tr>
          ) : (
            paginatedData.map((record) => (
              <tr
                key={record[rowKey]}
                style={{ borderBottom: '1px solid #f0f0f0', transition: 'background-color 0.2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fafafa')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
              >
                {columns.map((col, idx) => (
                  <td
                    key={idx}
                    style={{
                      padding: '12px 16px',
                      textAlign: col.align || 'left',
                      color: 'rgba(0, 0, 0, 0.65)',
                    }}
                  >
                    {col.render ? col.render(record[col.dataIndex], record, idx) : record[col.dataIndex]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {pagination && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '16px 0', gap: 8 }}>
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '4px 12px',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage === 1 ? 0.5 : 1,
            }}
          >
            上一页
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((page) => {
              if (totalPages <= 7) return true;
              if (page === 1 || page === totalPages) return true;
              if (Math.abs(page - currentPage) <= 1) return true;
              return false;
            })
            .map((page, idx, arr) => (
              <React.Fragment key={page}>
                {idx > 0 && arr[idx - 1] !== page - 1 && (
                  <span style={{ padding: '4px 8px', color: '#999' }}>...</span>
                )}
                <button
                  onClick={() => setCurrentPage(page)}
                  style={{
                    padding: '4px 12px',
                    border: page === currentPage ? '1px solid #1677ff' : '1px solid #d9d9d9',
                    borderRadius: '4px',
                    backgroundColor: page === currentPage ? '#1677ff' : '#fff',
                    color: page === currentPage ? '#fff' : 'rgba(0, 0, 0, 0.88)',
                    cursor: 'pointer',
                  }}
                >
                  {page}
                </button>
              </React.Fragment>
            ))}
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '4px 12px',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage === totalPages ? 0.5 : 1,
            }}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
};

// ==================== Modal & Overlay Components ====================

/**
 * 原生 Modal 组件 - 替代 Semi-UI Modal
 */
export const NativeModal = ({ 
  title, 
  visible, 
  onOk, 
  onCancel, 
  width = 520, 
  okText = '确定', 
  cancelText = '取消',
  loading,
  children,
  ...props 
}) => {
  if (!visible) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
      {/* Backdrop */}
      <div 
        onClick={onCancel}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Modal Content */}
        <div 
          style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            width: width,
            maxWidth: '90vw',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
          }}
          onClick={(e) => e.stopPropagation()}
          {...props}
        >
          {/* Header */}
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'rgba(0, 0, 0, 0.88)' }}>{title}</span>
            <span 
              onClick={onCancel}
              style={{ 
                cursor: 'pointer', 
                fontSize: 20, 
                color: '#999',
                lineHeight: 1,
                padding: '0 4px',
              }}
            >
              ×
            </span>
          </div>
          
          {/* Body */}
          <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
            {children}
          </div>
          
          {/* Footer */}
          <div style={{ padding: '16px 24px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <NativeButton onClick={onCancel}>{cancelText}</NativeButton>
            <NativeButton type="primary" theme="solid" loading={loading} onClick={onOk}>{okText}</NativeButton>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 原生 Popconfirm 组件 - 替代 Semi-UI Popconfirm
 */
export const NativePopconfirm = ({ children, content, onConfirm }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div 
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        {children}
      </div>
      {visible && (
        <div 
          style={{ 
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            backgroundColor: '#fff',
            borderRadius: '6px',
            padding: '8px 12px',
            boxShadow: '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08)',
            whiteSpace: 'nowrap',
            fontSize: 14,
            color: 'rgba(0, 0, 0, 0.88)',
          }}
        >
          <div style={{ marginBottom: 8 }}>{content}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <NativeButton size="small" onClick={() => setVisible(false)}>取消</NativeButton>
            <NativeButton size="small" type="primary" theme="solid" onClick={() => { onConfirm?.(); setVisible(false); }}>确定</NativeButton>
          </div>
          {/* Arrow */}
          <div style={{ 
            position: 'absolute', 
            top: '100%', 
            left: '50%', 
            transform: 'translateX(-50%)',
            width: 0, 
            height: 0, 
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '6px solid #fff',
          }} />
        </div>
      )}
      {/* Click outside handler overlay */}
      {visible && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
          onClick={() => setVisible(false)}
        />
      )}
    </div>
  );
};

// ==================== Typography Components ====================

/**
 * 原生 Typography 组件 - 替代 Semi-UI Typography
 */
export const NativeTitle = ({ children, heading = 3, style, ...props }) => {
  const sizes = {
    1: { fontSize: 38, lineHeight: '46px' },
    2: { fontSize: 30, lineHeight: '38px' },
    3: { fontSize: 24, lineHeight: '32px' },
    4: { fontSize: 20, lineHeight: '28px' },
    5: { fontSize: 16, lineHeight: '24px' },
  };
  
  const Tag = `h${heading}`;
  return (
    <Tag 
      style={{ 
        margin: 0, 
        fontWeight: 600,
        ...sizes[heading],
        ...style,
      }}
      {...props}
    >
      {children}
    </Tag>
  );
};

export const NativeText = ({ children, style, type, secondary, strong, ...props }) => {
  const colors = {
    secondary: 'rgba(0, 0, 0, 0.45)',
    tertiary: 'rgba(0, 0, 0, 0.35)',
    special: '#fa541c',
  };
  
  return (
    <span 
      style={{ 
        color: type ? colors[type] : (secondary ? colors.secondary : 'rgba(0, 0, 0, 0.65)'),
        fontWeight: strong ? 600 : 400,
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  );
};

export const NativeTypography = {
  Title: NativeTitle,
  Text: NativeText,
};

// ==================== Card Components ====================

/**
 * 原生 Card 组件 - 替代 Semi-UI Card
 */
export const NativeCard = ({ children, title, bodyStyle, className, style, ...props }) => (
  <div
    style={{
      borderRadius: '8px',
      backgroundColor: '#fff',
      border: '1px solid #f0f0f0',
      marginBottom: '16px',
      ...style,
    }}
    {...props}
  >
    {title && (
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', fontSize: '16px', fontWeight: 'bold' }}>
        {title}
      </div>
    )}
    <div style={bodyStyle || { padding: '20px' }}>
      {children}
    </div>
  </div>
);

/**
 * 带渐变背景的 Header Card
 */
export const HeaderCard = ({ children, style, ...props }) => (
  <div
    style={{
      borderRadius: '12px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#fff',
      marginBottom: '24px',
      padding: '20px 24px',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

// ==================== Layout Components (Extended) ====================

/**
 * 原生 Layout 组件 - 替代 Semi-UI Layout
 */
const NativeLayout = ({ children, style, className, ...props }) => (
  <div style={{ ...style }} className={className} {...props}>
    {children}
  </div>
);

/**
 * 原生 Layout.Header 组件
 */
const NativeLayoutHeader = ({ children, style, className, ...props }) => (
  <header
    style={{
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      background: '#fff',
      ...style,
    }}
    className={className}
    {...props}
  >
    {children}
  </header>
);

/**
 * 原生 Layout.Content 组件
 */
const NativeLayoutContent = ({ children, style, className, ...props }) => (
  <main
    style={{
      flex: 1,
      ...style,
    }}
    className={className}
    {...props}
  >
    {children}
  </main>
);

/**
 * 原生 Layout.Sider 组件
 */
const NativeLayoutSider = ({ children, width = 200, style, className, ...props }) => (
  <aside
    style={{
      width: `${width}px`,
      background: '#fff',
      ...style,
    }}
    className={className}
    {...props}
  >
    {children}
  </aside>
);

// Attach nested components to NativeLayout
NativeLayout.Header = NativeLayoutHeader;
NativeLayout.Content = NativeLayoutContent;
NativeLayout.Sider = NativeLayoutSider;

// ==================== Menu Component ====================

/**
 * 原生 Menu 组件 - 替代 Semi-UI Menu
 */
const NativeMenu = ({ items = [], selectedKeys = [], onClickMenu, style, className, ...props }) => {
  const [hoveredKey, setHoveredKey] = useState(null);
  
  const handleItemClick = useCallback((key) => {
    if (onClickMenu) {
      onClickMenu(key);
    }
  }, [onClickMenu]);
  
  return (
    <div
      style={{ ...style }}
      className={className}
      {...props}
    >
      {items.map((item, index) => {
        const isSelected = selectedKeys.includes(item.key);
        const isHovered = hoveredKey === item.key;
        return (
          <div
            key={item.key + '-' + index}
            onClick={() => handleItemClick(item.key)}
            onMouseEnter={() => setHoveredKey(item.key)}
            onMouseLeave={() => setHoveredKey(null)}
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: isSelected ? '#1890ff' : (isHovered ? '#1890ff' : '#333'),
              background: isSelected ? '#e6f7ff' : (isHovered ? '#f5f5f5' : 'transparent'),
              borderLeft: '3px solid #1890ff',
              fontWeight: isSelected ? '500' : 'normal',
              margin: '2px 0',
              borderRadius: '0 4px 4px 0',
              transition: 'all 0.2s',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
              backgroundColor: isSelected ? '#e6f7ff' : (isHovered ? '#f5f5f5' : 'transparent'),
            }}
          >
            <div style={{ pointerEvents: 'none', flexShrink: 0 }}>{item.icon && item.icon}</div>
            <div style={{ pointerEvents: 'none', flex: 1 }}>{item.text}</div>
          </div>
        );
      })}
    </div>
  );
};

// ==================== Export All Components ====================

export const Typography = NativeTypography;

export {
  NativeLayout,
  NativeLayoutHeader,
  NativeLayoutContent,
  NativeLayoutSider,
  NativeMenu,
};

export default {
  NativeRow,
  NativeCol,
  NativeSpace,
  NativeButton,
  NativeSpin,
  NativeTag,
  NativeInput,
  NativeTextArea,
  NativeSelect,
  NativeDatePicker,
  NativeTable,
  NativeModal,
  NativePopconfirm,
  NativeTitle,
  NativeText,
  NativeTypography,
  NativeCard,
  HeaderCard,
  NativeLayout,
  NativeLayoutHeader,
  NativeLayoutContent,
  NativeLayoutSider,
  NativeMenu,
};
