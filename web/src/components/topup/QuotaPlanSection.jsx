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

import React, { useState, useMemo } from 'react';
import {
  Card,
  Tag,
  Select,
  Button,
  Table,
  Divider,
  Tooltip,
  Badge,
} from '@douyinfe/semi-ui';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import { RefreshCw } from 'lucide-react';
import { renderQuota } from '../../helpers';
import SubscriptionPlansCard from './SubscriptionPlansCard';

// 格式化额度值为带单位的显示格式
function formatQuotaAmount(quota) {
  if (quota <= 0) return '0 Tokens';
  
  const locale = localStorage.getItem('locale') || 'zh-CN';
  const isChinese = locale.includes('zh') || locale.includes('ZH');
  
  let value = Math.abs(quota);
  let suffix = '';
  
  if (isChinese) {
    if (value >= 100000000) {
      value = value / 100000000;
      suffix = '亿 Tokens';
    } else if (value >= 10000) {
      value = value / 10000;
      suffix = '万 Tokens';
    } else {
      suffix = ' Tokens';
    }
  } else {
    const units = ['', 'K', 'M', 'B', 'T'];
    let unitIndex = 0;
    
    while (value >= 1000 && unitIndex < units.length - 1) {
      value /= 1000;
      unitIndex++;
    }
    
    suffix = units[unitIndex] + ' Tokens';
  }
  
  let formattedValue;
  if (value >= 100) {
    formattedValue = value.toFixed(0);
  } else if (value >= 10) {
    formattedValue = value.toFixed(1);
  } else {
    formattedValue = value.toFixed(2);
  }
  
  return formattedValue + suffix;
}

// 额度套餐子组件 - 包含订阅套餐卡片和我的订阅表格
const QuotaPlanSection = ({
  t,
  loading,
  plans,
  payMethods,
  enableOnlineTopUp,
  enableStripeTopUp,
  enableCreemTopUp,
  billingPreference,
  onChangeBillingPreference,
  activeSubscriptions,
  allSubscriptions,
  reloadSubscriptionSelf,
  userQuota,
}) => {
  // 过滤只显示 quota 类型的套餐
  const quotaPlans = useMemo(() => {
    return (plans || []).filter(plan => plan.plan?.plan_type === 'quota' || !plan.plan?.plan_type);
  }, [plans]);

  return (
    <div className='space-y-6'>
      {/* 热门套餐卡片 */}
      <div className='card-wrapper'>
        <SubscriptionPlansCard
          t={t}
          loading={loading}
          plans={quotaPlans}
          payMethods={payMethods}
          enableOnlineTopUp={enableOnlineTopUp}
          enableStripeTopUp={enableStripeTopUp}
          enableCreemTopUp={enableCreemTopUp}
          billingPreference={billingPreference}
          onChangeBillingPreference={onChangeBillingPreference}
          activeSubscriptions={activeSubscriptions}
          allSubscriptions={allSubscriptions}
          reloadSubscriptionSelf={reloadSubscriptionSelf}
          withCard={true}
          userQuota={userQuota}
          subtitle={t('企业/个人灵活搭配，丰俭由人')}
        />
      </div>

      {/* 我的订阅板块 */}
      <MySubscriptionSection
        t={t}
        activeSubscriptions={activeSubscriptions}
        allSubscriptions={allSubscriptions}
        billingPreference={billingPreference}
        onChangeBillingPreference={onChangeBillingPreference}
        reloadSubscriptionSelf={reloadSubscriptionSelf}
        plans={plans}
      />
    </div>
  );
};

// 我的订阅子组件
const MySubscriptionSection = ({
  t,
  activeSubscriptions,
  allSubscriptions,
  billingPreference,
  onChangeBillingPreference,
  reloadSubscriptionSelf,
  plans,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const hasActiveSubscription = activeSubscriptions.length > 0;
  const hasAnySubscription = allSubscriptions.length > 0;
  const disableSubscriptionPreference = !hasActiveSubscription;
  const isSubscriptionPreference =
    billingPreference === 'subscription_first' ||
    billingPreference === 'subscription_only';
  const displayBillingPreference =
    disableSubscriptionPreference && isSubscriptionPreference
      ? 'wallet_first'
      : billingPreference;
  const subscriptionPreferenceLabel =
    billingPreference === 'subscription_only' ? t('仅用订阅') : t('优先订阅');

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await reloadSubscriptionSelf?.();
    } finally {
      setRefreshing(false);
    }
  };

  // 计算单个订阅的剩余天数
  const getRemainingDays = (sub) => {
    if (!sub?.subscription?.end_time) return 0;
    const now = Date.now() / 1000;
    const remaining = sub.subscription.end_time - now;
    return Math.max(0, Math.ceil(remaining / 86400));
  };

  // 计算单个订阅的使用进度
  const getUsagePercent = (sub) => {
    const total = Number(sub?.subscription?.amount_total || 0);
    const used = Number(sub?.subscription?.amount_used || 0);
    if (total <= 0) return 0;
    return Math.round((used / total) * 100);
  };

  // 创建 planMap 用于通过 plan_id 获取正确的 total_amount
  const planMap = useMemo(() => {
    const map = new Map();
    (plans || []).forEach((p) => {
      const plan = p?.plan;
      if (plan?.id) {
        map.set(plan.id, plan);
      }
    });
    return map;
  }, [plans]);

  const planTitleMap = useMemo(() => {
    const map = new Map();
    (plans || []).forEach((p) => {
      const plan = p?.plan;
      if (plan?.id) {
        map.set(plan.id, plan.title || '');
      }
    });
    return map;
  }, [plans]);

  // 构建表格数据 - 只展示 quota 类型的套餐，过滤掉 tokens 类型
  const quotaSubscriptions = useMemo(() => {
    return (allSubscriptions || [])
      .map((sub) => {
        const subscription = sub.subscription;
        const planFromMap = planMap.get(subscription?.plan_id);
        // 过滤掉 tokens 类型的套餐
        if (planFromMap?.plan_type === 'tokens') {
          return null;
        }
        return sub;
      })
      .filter(Boolean);
  }, [allSubscriptions, planMap]);

  const quotaActiveSubscriptions = useMemo(() => {
    const now = Date.now() / 1000;
    return quotaSubscriptions.filter((sub) => {
      const subscription = sub?.subscription;
      if (!subscription) return false;
      const isExpired = (subscription?.end_time || 0) < now;
      const isCancelled = subscription?.status === 'cancelled';
      return subscription?.status === 'active' && !isExpired;
    });
  }, [quotaSubscriptions]);

  // 渲染适用模型
  const renderApplicableModels = (models) => {
    if (!models || models.trim() === '') {
      return <Text type='tertiary'>{t('全部模型')}</Text>;
    }
    const modelList = models.split(',').map(m => m.trim()).filter(Boolean);
    if (modelList.length === 0) {
      return <Text type='tertiary'>{t('全部模型')}</Text>;
    }
    if (modelList.length > 3) {
      return (
        <Tooltip content={modelList.join(', ')}>
          <Text type='secondary'>{modelList.slice(0, 3).join(', ')}...</Text>
        </Tooltip>
      );
    }
    return <Text type='secondary'>{modelList.join(', ')}</Text>;
  };

  const tableData = useMemo(() => {
    return quotaSubscriptions.map((sub) => {
      const subscription = sub.subscription;
      const planFromMap = planMap.get(subscription?.plan_id);
      const totalAmount = Number(planFromMap?.total_amount || subscription?.amount_total || 0);
      const usedAmount = Number(subscription?.amount_used || 0);
      const remainAmount = totalAmount > 0 ? Math.max(0, totalAmount - usedAmount) : 0;
      const planTitle = planTitleMap.get(subscription?.plan_id) || '';
      const applicableModels = planFromMap?.applicable_models || '';
      const remainDays = getRemainingDays(sub);
      const usagePercent = getUsagePercent(sub);
      const now = Date.now() / 1000;
      const isExpired = (subscription?.end_time || 0) < now;
      const isCancelled = subscription?.status === 'cancelled';
      const isActive = subscription?.status === 'active' && !isExpired;

      return {
        key: subscription?.id,
        planName: planTitle ? `${planTitle} · ${t('订阅')} #${subscription?.id}` : `${t('订阅')} #${subscription?.id}`,
        status: isActive ? (
          <Tag color='white' size='small' shape='circle' prefixIcon={<Badge dot type='success' />}>
            {t('生效')}
          </Tag>
        ) : isCancelled ? (
          <Tag color='white' size='small' shape='circle'>{t('已作废')}</Tag>
        ) : (
          <Tag color='white' size='small' shape='circle'>{t('已过期')}</Tag>
        ),
        createTime: new Date((subscription?.start_time || 0) * 1000).toLocaleString(),
        endTime: new Date((subscription?.end_time || 0) * 1000).toLocaleString(),
        source: subscription?.source || '-',
        applicableModels: renderApplicableModels(applicableModels),
        totalQuota: totalAmount > 0 ? (
          <Tooltip content={`${t('原生额度')}：${usedAmount}/${totalAmount} · ${t('剩余')} ${remainAmount}`}>
            <span>{formatQuotaAmount(totalAmount)}</span>
          </Tooltip>
        ) : t('不限'),
        usedQuota: totalAmount > 0 ? `${renderQuota(usedAmount)} (${usagePercent}%)` : '-',
        remainQuota: totalAmount > 0 ? renderQuota(remainAmount) : '-',
        remainDays: isActive ? `${remainDays} ${t('天')}` : '-',
      };
    });
  }, [quotaSubscriptions, planMap, planTitleMap, t]);

  const columns = [
    {
      title: t('套餐名称'),
      dataIndex: 'planName',
      width: 180,
      ellipsis: true,
      headerCellStyle: { minWidth: 320 },
      cellStyle: { minWidth: 320 },
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 100,
    },
    {
      title: t('订阅时间'),
      dataIndex: 'createTime',
      width: 170,
    },
    {
      title: t('到期时间'),
      dataIndex: 'endTime',
      width: 170,
    },
    {
      title: t('来源'),
      dataIndex: 'source',
      width: 100,
    },
    {
      title: t('适用模型'),
      dataIndex: 'applicableModels',
      width: 220,
      ellipsis: true,
    },
    {
      title: t('已用额度'),
      dataIndex: 'usedQuota',
      width: 150,
    },
    {
      title: t('剩余额度'),
      dataIndex: 'remainQuota',
      width: 150,
    },
    {
      title: t('剩余天数'),
      dataIndex: 'remainDays',
      width: 100,
    },
  ];

  return (
    <Card className='!rounded-xl w-full' bodyStyle={{ padding: '12px' }}>
      <div className='flex items-center justify-between mb-2 gap-3'>
        <div className='flex items-center gap-2 flex-1 min-w-0'>
          <Text strong>{t('我的订阅')}</Text>
          {quotaActiveSubscriptions.length > 0 ? (
            <Tag
              color='white'
              size='small'
              shape='circle'
              prefixIcon={<Badge dot type='success' />}
            >
              {quotaActiveSubscriptions.length} {t('个生效中')}
            </Tag>
          ) : (
            <Tag color='white' size='small' shape='circle'>
              {t('无生效')}
            </Tag>
          )}
          {quotaSubscriptions.length > quotaActiveSubscriptions.length && (
            <Tag color='white' size='small' shape='circle'>
              {quotaSubscriptions.length - quotaActiveSubscriptions.length}{' '}
              {t('个已过期')}
            </Tag>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <Select
            value={displayBillingPreference}
            onChange={onChangeBillingPreference}
            size='small'
            optionList={[
              {
                value: 'subscription_first',
                label: disableSubscriptionPreference
                  ? `${t('优先订阅')} (${t('无生效')})`
                  : t('优先订阅'),
                disabled: disableSubscriptionPreference,
              },
              { value: 'wallet_first', label: t('优先钱包') },
              {
                value: 'subscription_only',
                label: disableSubscriptionPreference
                  ? `${t('仅用订阅')} (${t('无生效')})`
                  : t('仅用订阅'),
                disabled: disableSubscriptionPreference,
              },
              { value: 'wallet_only', label: t('仅用钱包') },
            ]}
          />
          <Button
            size='small'
            theme='light'
            type='tertiary'
            icon={
              <RefreshCw
                size={12}
                className={refreshing ? 'animate-spin' : ''}
              />
            }
            onClick={handleRefresh}
            loading={refreshing}
          />
        </div>
      </div>
      {disableSubscriptionPreference && isSubscriptionPreference && (
        <Text type='tertiary' size='small'>
          {t('已保存偏好为')}
          {subscriptionPreferenceLabel}
          {t('，当前无生效订阅，将自动使用钱包')}
        </Text>
      )}

      {hasAnySubscription ? (
        <>
          <Divider margin={8} />
          <Table
            columns={columns}
            dataSource={tableData}
            size='small'
            pagination={false}
            bordered
          />
        </>
      ) : (
        <div className='text-xs text-gray-500'>
          {t('购买套餐后即可享受模型权益')}
        </div>
      )}
    </Card>
  );
};

export default QuotaPlanSection;
