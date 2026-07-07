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

import React, { useContext, useMemo } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IconMoneyExchangeStroked,
  IconShoppingBagStroked,
  IconArrowUp,
  IconFile,
  IconCheckCircleStroked,
} from '@douyinfe/semi-icons';
import { StatusContext } from '../../context/Status';
import {
  NativeLayout,
  NativeLayoutHeader,
  NativeLayoutContent,
  NativeLayoutSider,
  NativeMenu,
  NativeRow,
  NativeCol,
  NativeSpace,
  NativeButton,
} from './NativeLayout';

// 菜单项配置
const getMenuItems = (isAdmin, t) => {
  const items = [
    {
      key: '/console/finance',
      text: t('财务概览'),
      icon: <IconMoneyExchangeStroked />,
    },
    {
      key: '/console/finance/orders',
      text: t('订单管理'),
      icon: <IconShoppingBagStroked />,
    },
    {
      key: '/console/finance/revenue',
      text: t('营收分析'),
      icon: <IconArrowUp />,
    },
    {
      key: '/console/finance/invoices',
      text: t('发票管理'),
      icon: <IconFile />,
    },
  ];

  // 供应商结算仅管理员可见
  if (isAdmin) {
    items.push({
      key: '/console/finance/supplier-settlement',
      text: t('供应商结算'),
      icon: <IconMoneyExchangeStroked />,
    });
  }

  return items;
};

// 页面标题映射
const pageTitles = {
  '/console/finance': '财务概览',
  '/console/finance/orders': '订单管理',
  '/console/finance/revenue': '营收分析',
  '/console/finance/invoices': '发票管理',
  '/console/finance/supplier-settlement': '供应商结算',
};

// 页面描述映射
const pageDescriptions = {
  '/console/finance': '查看财务数据和统计概览',
  '/console/finance/orders': '管理充值和订阅订单',
  '/console/finance/revenue': '查看营收趋势和详细报表',
  '/console/finance/invoices': '管理发票申请和开具状态',
  '/console/finance/supplier-settlement': '管理供应商结算和返点记录',
};

// 渐变色配置
const gradientColors = {
  '/console/finance': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  '/console/finance/orders': 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
  '/console/finance/revenue': 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
  '/console/finance/invoices': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  '/console/finance/supplier-settlement': 'linear-gradient(135deg, #fa8c16 0%, #ffd666 100%)',
};

export default function FinanceLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [statusState] = useContext(StatusContext);
  
  const isAdmin = useMemo(() => statusState?.user?.is_admin === true, [statusState?.user?.is_admin]);
  const menuItems = useMemo(() => getMenuItems(isAdmin, t), [isAdmin, t]);
  
  // 获取当前激活的菜单项
  const activeKey = useMemo(() => {
    const path = location.pathname;
    // 检查是否是财务相关页面
    if (path.startsWith('/console/finance')) {
      return path;
    }
    return '/console/finance';
  }, [location.pathname]);
  
  // 获取当前页面标题
  const currentPageTitle = pageTitles[activeKey] || t('财务运营');
  
  // 获取当前页面描述
  const currentPageDesc = pageDescriptions[activeKey] || '';
  
  // 获取当前渐变色
  const currentGradient = gradientColors[activeKey] || gradientColors['/console/finance'];

  return (
    <div style={{ paddingTop: '64px' }}>
      {/* 顶部导航栏 */}
      <div
        style={{
          background: currentGradient,
          color: '#fff',
          padding: '20px 24px',
        }}
      >
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div>
            <div style={{
              fontSize: 22,
              fontWeight: '600',
              margin: 0,
            }}>
              {currentPageTitle}
            </div>
            {currentPageDesc && (
              <div style={{
                fontSize: 14,
                opacity: 0.85,
                marginTop: 6,
              }}>
                {currentPageDesc}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 页面内容区域 */}
      <div style={{
        padding: '24px',
        maxWidth: 1400,
        margin: '0 auto',
      }}>
        <Outlet />
      </div>
    </div>
  );
}
