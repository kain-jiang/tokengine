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

import React, { useEffect, useState, useContext, useRef, useMemo } from 'react';
import {
  API,
  showError,
  showSuccess,
  renderQuota,
  getQuotaPerUnit,
} from '../../helpers';
import { useTranslation } from 'react-i18next';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
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
import SubscriptionPlansCard from '../../components/topup/SubscriptionPlansCard';
import TransferModal from '../../components/topup/modals/TransferModal';
import PaymentConfirmModal from '../../components/topup/modals/PaymentConfirmModal';
import QRCodeModal from '../../components/topup/QRCodeModal';
import TopupHistoryModal from '../../components/topup/modals/TopupHistoryModal';
import InvitationPanel from '../../components/topup/InvitationPanel';

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

const MyPlan = () => {
  const { t } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);

  const [priceRatio, setPriceRatio] = useState(statusState?.status?.price || 1);
  const [statusLoading, setStatusLoading] = useState(true);

  // 邀请相关状态
  const [affLink, setAffLink] = useState('');
  const [openTransfer, setOpenTransfer] = useState(false);
  const [transferAmount, setTransferAmount] = useState(0);

  // 邀请面板显示状态
  const [showInvitation, setShowInvitation] = useState(false);

  // 账单Modal状态
  const [openHistory, setOpenHistory] = useState(false);

  // 订阅相关
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [billingPreference, setBillingPreference] =
    useState('subscription_first');
  const [activeSubscriptions, setActiveSubscriptions] = useState([]);
  const [allSubscriptions, setAllSubscriptions] = useState([]);

  // 支付相关状态
  const [payMethods, setPayMethods] = useState([]);
  const [enableOnlineTopUp, setEnableOnlineTopUp] = useState(false);
  const [enableStripeTopUp, setEnableStripeTopUp] = useState(false);
  const [enableCreemTopUp, setEnableCreemTopUp] = useState(false);
  const [creemProducts, setCreemProducts] = useState([]);

  const affFetchedRef = useRef(false);

  const getUserQuota = async () => {
    let res = await API.get(`/api/user/self`);
    const { success, message, data } = res.data;
    if (success) {
      userDispatch({ type: 'login', payload: data });
    } else {
      showError(message);
    }
  };

  const getSubscriptionPlans = async () => {
    setSubscriptionLoading(true);
    try {
      const res = await API.get('/api/subscription/plans');
      if (res.data?.success) {
        setSubscriptionPlans(res.data.data || []);
      }
    } catch (e) {
      setSubscriptionPlans([]);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const getSubscriptionSelf = async () => {
    try {
      const res = await API.get('/api/subscription/self');
      if (res.data?.success) {
        setBillingPreference(
          res.data.data?.billing_preference || 'subscription_first',
        );
        // Active subscriptions
        const activeSubs = res.data.data?.subscriptions || [];
        setActiveSubscriptions(activeSubs);
        // All subscriptions (including expired)
        const allSubs = res.data.data?.all_subscriptions || [];
        setAllSubscriptions(allSubs);
      }
    } catch (e) {
      // ignore
    }
  };

  const updateBillingPreference = async (pref) => {
    const previousPref = billingPreference;
    setBillingPreference(pref);
    try {
      const res = await API.put('/api/subscription/self/preference', {
        billing_preference: pref,
      });
      if (res.data?.success) {
        showSuccess(t('更新成功'));
        const normalizedPref =
          res.data?.data?.billing_preference || pref || previousPref;
        setBillingPreference(normalizedPref);
      } else {
        showError(res.data?.message || t('更新失败'));
        setBillingPreference(previousPref);
      }
    } catch (e) {
      showError(t('请求失败'));
      setBillingPreference(previousPref);
    }
  };

  // 获取充值配置信息（用于获取支付方式）
  const getTopupInfo = async () => {
    try {
      const res = await API.get('/api/user/topup/info');
      const { message, data, success } = res.data;
      if (success) {
        // 处理支付方式
        let payMethods = data.pay_methods || [];
        try {
          if (typeof payMethods === 'string') {
            payMethods = JSON.parse(payMethods);
          }
          if (payMethods && payMethods.length > 0) {
            payMethods = payMethods.filter((method) => {
              return method.name && method.type;
            });
          } else {
            payMethods = [];
          }
        } catch (e) {
          payMethods = [];
        }

        setPayMethods(payMethods);
        setEnableStripeTopUp(data.enable_stripe_topup || false);
        setEnableOnlineTopUp(data.enable_online_topup || false);
        setEnableCreemTopUp(data.enable_creem_topup || false);

        // 设置 Creem 产品
        try {
          const products = JSON.parse(data.creem_products || '[]');
          setCreemProducts(products);
        } catch (e) {
          setCreemProducts([]);
        }
      }
    } catch (error) {
      // ignore
    }
  };

  // 获取邀请链接
  const getAffLink = async () => {
    const res = await API.get('/api/user/aff');
    const { success, message, data } = res.data;
    if (success) {
      let link = `${window.location.origin}/register?aff=${data}`;
      setAffLink(link);
    } else {
      showError(message);
    }
  };

  // 划转邀请额度
  const transfer = async () => {
    if (transferAmount < getQuotaPerUnit()) {
      showError(t('划转金额最低为') + ' ' + renderQuota(getQuotaPerUnit()));
      return;
    }
    const res = await API.post(`/api/user/aff_transfer`, {
      quota: transferAmount,
    });
    const { success, message } = res.data;
    if (success) {
      showSuccess(message);
      setOpenTransfer(false);
      getUserQuota().then();
    } else {
      showError(message);
    }
  };

  // 复制邀请链接
  const handleAffLinkClick = async () => {
    await navigator.clipboard.writeText(affLink);
    showSuccess(t('邀请链接已复制到剪切板'));
  };

  useEffect(() => {
    // 始终获取最新用户数据
    getUserQuota().then();
    setTransferAmount(getQuotaPerUnit());
  }, []);

  useEffect(() => {
    if (affFetchedRef.current) return;
    affFetchedRef.current = true;
    getAffLink().then();
  }, []);

  useEffect(() => {
    getTopupInfo().then();
    getSubscriptionPlans().then();
    getSubscriptionSelf().then();
  }, []);

  useEffect(() => {
    if (statusState?.status) {
      setPriceRatio(statusState.status.price || 1);
      setStatusLoading(false);
    }
  }, [statusState?.status]);

  const handleTransferCancel = () => {
    setOpenTransfer(false);
  };

  const handleOpenHistory = () => {
    setOpenHistory(true);
  };

  const handleHistoryCancel = () => {
    setOpenHistory(false);
  };

  return (
    <div className='w-full max-w-7xl mx-auto relative min-h-screen lg:min-h-0 mt-[60px] px-2'>
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* 邀请好友弹出面板 */}
        <InvitationPanel
          visible={showInvitation}
          onClose={() => setShowInvitation(false)}
          t={t}
          userState={userState}
          renderQuota={renderQuota}
          setOpenTransfer={setOpenTransfer}
          affLink={affLink}
          handleAffLinkClick={handleAffLinkClick}
        />

        {/* 划转模态框 */}
        <TransferModal
          t={t}
          openTransfer={openTransfer}
          transfer={transfer}
          handleTransferCancel={handleTransferCancel}
          userState={userState}
          renderQuota={renderQuota}
          getQuotaPerUnit={getQuotaPerUnit}
          transferAmount={transferAmount}
          setTransferAmount={setTransferAmount}
        />

        {/* 充值账单模态框 */}
        <TopupHistoryModal
          visible={openHistory}
          onCancel={handleHistoryCancel}
          t={t}
        />

        {/* 热门套餐卡片 - 跨两列占据全部宽度 */}
        <div className='lg:col-span-2'>
          <div className='card-wrapper'>
            <SubscriptionPlansCard
              t={t}
              loading={subscriptionLoading}
              plans={subscriptionPlans}
              payMethods={payMethods}
              enableOnlineTopUp={enableOnlineTopUp}
              enableStripeTopUp={enableStripeTopUp}
              enableCreemTopUp={enableCreemTopUp}
              billingPreference={billingPreference}
              onChangeBillingPreference={updateBillingPreference}
              activeSubscriptions={activeSubscriptions}
              allSubscriptions={allSubscriptions}
              reloadSubscriptionSelf={getSubscriptionSelf}
              withCard={true}
              userQuota={userState?.user?.quota || 0}
              subtitle={t('企业/个人灵活搭配，丰俭由人')}
            />
          </div>
        </div>

        {/* 我的订阅板块 */}
        <div className='lg:col-span-2'>
          <MySubscriptionSection
            t={t}
            activeSubscriptions={activeSubscriptions}
            allSubscriptions={allSubscriptions}
            billingPreference={billingPreference}
            onChangeBillingPreference={updateBillingPreference}
            reloadSubscriptionSelf={getSubscriptionSelf}
            plans={subscriptionPlans}
          />
        </div>
      </div>
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

  // 构建表格数据
  const tableData = useMemo(() => {
    return allSubscriptions.map((sub) => {
      const subscription = sub.subscription;
      const planFromMap = planMap.get(subscription?.plan_id);
      const totalAmount = Number(planFromMap?.total_amount || subscription?.amount_total || 0);
      const usedAmount = Number(subscription?.amount_used || 0);
      const remainAmount = totalAmount > 0 ? Math.max(0, totalAmount - usedAmount) : 0;
      const planTitle = planTitleMap.get(subscription?.plan_id) || '';
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
        group: subscription?.upgrade_group || '-',
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
  }, [allSubscriptions, planMap, planTitleMap, t]);

  const columns = [
    {
      title: t('套餐名称'),
      dataIndex: 'planName',
      ellipsis: true,
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 100,
    },
    {
      title: t('订阅时间'),
      dataIndex: 'createTime',
      width: 180,
    },
    {
      title: t('到期时间'),
      dataIndex: 'endTime',
      width: 180,
    },
    {
      title: t('分组'),
      dataIndex: 'group',
      width: 120,
    },
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
          {hasActiveSubscription ? (
            <Tag
              color='white'
              size='small'
              shape='circle'
              prefixIcon={<Badge dot type='success' />}
            >
              {activeSubscriptions.length} {t('个生效中')}
            </Tag>
          ) : (
            <Tag color='white' size='small' shape='circle'>
              {t('无生效')}
            </Tag>
          )}
          {allSubscriptions.length > activeSubscriptions.length && (
            <Tag color='white' size='small' shape='circle'>
              {allSubscriptions.length - activeSubscriptions.length}{' '}
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

export default MyPlan;