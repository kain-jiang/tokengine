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

import React, { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Divider,
  Select,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
  Table,
  Avatar,
} from '@douyinfe/semi-ui';
import i18next from 'i18next';
import { API, showError, showSuccess, renderQuota, getQuotaPerUnit } from '../../helpers';
import { Modal } from '@douyinfe/semi-ui';
import { getCurrencyConfig } from '../../helpers/render';
import { RefreshCw, Sparkles, Package } from 'lucide-react';
import SubscriptionPurchaseModal from './modals/SubscriptionPurchaseModal';
import {
  formatSubscriptionDuration,
  formatSubscriptionResetPeriod,
} from '../../helpers/subscriptionFormat';

const { Text } = Typography;

// 格式化额度值为带单位的显示格式
function formatQuotaAmount(quota) {
  if (quota <= 0) return '0 Tokens';
  
  const locale = localStorage.getItem('locale') || i18next?.language || 'zh-CN';
  const isChinese = locale.includes('zh') || locale.includes('ZH');
  
  let value = Math.abs(quota);
  let suffix = '';
  
  if (isChinese) {
    // 中文格式：使用万、亿等单位
    if (value >= 100000000) {
      // 亿
      value = value / 100000000;
      suffix = '亿 Tokens';
    } else if (value >= 10000) {
      // 万
      value = value / 10000;
      suffix = '万 Tokens';
    } else {
      suffix = ' Tokens';
    }
  } else {
    // 英文格式：使用 K、M、B 等单位
    const units = ['', 'K', 'M', 'B', 'T'];
    let unitIndex = 0;
    
    while (value >= 1000 && unitIndex < units.length - 1) {
      value /= 1000;
      unitIndex++;
    }
    
    suffix = units[unitIndex] + ' Tokens';
  }
  
  // 根据数值大小决定小数位数
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

// 过滤易支付方式
function getEpayMethods(payMethods = []) {
  return (payMethods || []).filter(
    (m) => m?.type && m.type !== 'stripe' && m.type !== 'creem',
  );
}

// 提交易支付表单
function submitEpayForm({ url, params }) {
  const form = document.createElement('form');
  form.action = url;
  form.method = 'POST';
  const isSafari =
    navigator.userAgent.indexOf('Safari') > -1 &&
    navigator.userAgent.indexOf('Chrome') < 1;
  if (!isSafari) form.target = '_blank';
  Object.keys(params || {}).forEach((key) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = params[key];
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

const SubscriptionPlansCard = ({
  t,
  loading = false,
  plans = [],
  payMethods = [],
  enableOnlineTopUp = false,
  enableStripeTopUp = false,
  enableCreemTopUp = false,
  billingPreference,
  onChangeBillingPreference,
  activeSubscriptions = [],
  allSubscriptions = [],
  reloadSubscriptionSelf,
  withCard = true,
  userQuota = 0,
  subtitle,
}) => {
  const [open, setOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paying, setPaying] = useState(false);
  const [selectedEpayMethod, setSelectedEpayMethod] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const epayMethods = useMemo(() => getEpayMethods(payMethods), [payMethods]);

  const openBuy = (p) => {
    setSelectedPlan(p);
    setSelectedEpayMethod(epayMethods?.[0]?.type || '');
    setOpen(true);
  };

  const closeBuy = () => {
    setOpen(false);
    setSelectedPlan(null);
    setPaying(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await reloadSubscriptionSelf?.();
    } finally {
      setRefreshing(false);
    }
  };

  const payStripe = async () => {
    if (!selectedPlan?.plan?.stripe_price_id) {
      showError(t('该套餐未配置 Stripe'));
      return;
    }
    setPaying(true);
    try {
      const res = await API.post('/api/subscription/stripe/pay', {
        plan_id: selectedPlan.plan.id,
      });
      if (res.data?.message === 'success') {
        // 使用 <a> 标签方式避免浏览器拦截 popup
        const payLink = res.data.data?.pay_link;
        if (payLink) {
          const link = document.createElement('a');
          link.href = payLink;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showSuccess(t('已打开支付页面'));
        }
        closeBuy();
      } else {
        const errorMsg =
          typeof res.data?.data === 'string'
            ? res.data.data
            : res.data?.message || t('支付失败');
        showError(errorMsg);
      }
    } catch (e) {
      showError(t('支付请求失败'));
    } finally {
      setPaying(false);
    }
  };

  const payCreem = async () => {
    if (!selectedPlan?.plan?.creem_product_id) {
      showError(t('该套餐未配置 Creem'));
      return;
    }
    setPaying(true);
    try {
      const res = await API.post('/api/subscription/creem/pay', {
        plan_id: selectedPlan.plan.id,
      });
      if (res.data?.message === 'success') {
        window.open(res.data.data?.checkout_url, '_blank');
        showSuccess(t('已打开支付页面'));
        closeBuy();
      } else {
        const errorMsg =
          typeof res.data?.data === 'string'
            ? res.data.data
            : res.data?.message || t('支付失败');
        showError(errorMsg);
      }
    } catch (e) {
      showError(t('支付请求失败'));
    } finally {
      setPaying(false);
    }
  };

  const payEpay = async () => {
    if (!selectedEpayMethod) {
      showError(t('请选择支付方式'));
      return;
    }
    setPaying(true);
    try {
      const res = await API.post('/api/subscription/epay/pay', {
        plan_id: selectedPlan.plan.id,
        payment_method: selectedEpayMethod,
      });
      if (res.data?.message === 'success') {
        submitEpayForm({ url: res.data.url, params: res.data.data });
        showSuccess(t('已发起支付'));
        closeBuy();
      } else {
        const errorMsg =
          typeof res.data?.data === 'string'
            ? res.data.data
            : res.data?.message || t('支付失败');
        showError(errorMsg);
      }
    } catch (e) {
      showError(t('支付请求失败'));
    } finally {
      setPaying(false);
    }
  };

  const payWallet = async () => {
    // 前端预检查余额是否足够
    const plan = selectedPlan?.plan;
    if (!plan) return;
    
    const priceAmount = Number(plan.price_amount || 0);
    const quotaPerUnit = getQuotaPerUnit();
    const requiredQuota = priceAmount * quotaPerUnit;
    const currentQuota = userQuota || 0;
    
    if (currentQuota < requiredQuota) {
      // 余额不足，显示简洁提示并引导充值
      Modal.warning({
        title: t('余额不足'),
        content: (
          <div>
            <p>{t('钱包余额不足，请先充值后再试。')}</p>
          </div>
        ),
        centered: true,
        maskClosable: true,
        okText: t('去充值'),
        onOk: () => {
          window.location.href = '/console/topup';
        },
      });
      return;
    }
    
    setPaying(true);
    try {
      const res = await API.post('/api/subscription/wallet/pay', {
        plan_id: selectedPlan.plan.id,
      });
      if (res.data?.success) {
        showSuccess(res.data?.message || t('购买成功'));
        closeBuy();
        // 刷新订阅状态
        reloadSubscriptionSelf?.();
      } else {
        showError(res.data?.message || t('支付失败'));
      }
    } catch (e) {
      showError(t('支付请求失败'));
    } finally {
      setPaying(false);
    }
  };

  // 当前订阅信息 - 支持多个订阅
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

  const planPurchaseCountMap = useMemo(() => {
    const map = new Map();
    (allSubscriptions || []).forEach((sub) => {
      const planId = sub?.subscription?.plan_id;
      if (!planId) return;
      map.set(planId, (map.get(planId) || 0) + 1);
    });
    return map;
  }, [allSubscriptions]);

  const planTitleMap = useMemo(() => {
    const map = new Map();
    (plans || []).forEach((p) => {
      const plan = p?.plan;
      if (!plan?.id) return;
      map.set(plan.id, plan.title || '');
    });
    return map;
  }, [plans]);

  const getPlanPurchaseCount = (planId) =>
    planPurchaseCountMap.get(planId) || 0;

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

  const cardContent = (
    <>
      {/* 卡片头部 */}
      {loading ? (
        <div className='space-y-4'>
          {/* 我的订阅骨架屏 */}
          <Card className='!rounded-xl w-full' bodyStyle={{ padding: '12px' }}>
            <div className='flex items-center justify-between mb-3'>
              <Skeleton.Title active style={{ width: 100, height: 20 }} />
              <Skeleton.Button active style={{ width: 24, height: 24 }} />
            </div>
            <div className='space-y-2'>
              <Skeleton.Paragraph active rows={2} />
            </div>
          </Card>
          {/* 套餐列表骨架屏 */}
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 w-full px-1'>
            {[1, 2, 3].map((i) => (
              <Card
                key={i}
                className='!rounded-xl w-full h-full'
                bodyStyle={{ padding: 16 }}
              >
                <Skeleton.Title
                  active
                  style={{ width: '60%', height: 24, marginBottom: 8 }}
                />
                <Skeleton.Paragraph
                  active
                  rows={1}
                  style={{ marginBottom: 12 }}
                />
                <div className='text-center py-4'>
                  <Skeleton.Title
                    active
                    style={{ width: '40%', height: 32, margin: '0 auto' }}
                  />
                </div>
                <Skeleton.Paragraph active rows={3} style={{ marginTop: 12 }} />
                <Skeleton.Button
                  active
                  block
                  style={{ marginTop: 16, height: 32 }}
                />
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Space vertical style={{ width: '100%' }} spacing={8}>
          {/* 可购买套餐 - 标准定价卡片 - 移到上方 */}
          {plans.length > 0 ? (
            <div>
              <div className='flex items-center mb-4'>
                <Avatar size='small' color='purple' className='mr-3 shadow-md'>
                  <Package size={16} />
                </Avatar>
                <div>
                  <Typography.Text className='text-lg font-medium'>
                    {t('热门套餐')}
                  </Typography.Text>
                  {subtitle && <div className='text-xs'>{subtitle}</div>}
                </div>
              </div>
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 w-full px-1'>
                {plans.map((p, index) => {
                  const plan = p?.plan;
                  const totalAmount = Number(plan?.total_amount || 0);
                  const { symbol, rate } = getCurrencyConfig();
                  const price = Number(plan?.price_amount || 0);
                  const convertedPrice = price * rate;
                  const displayPrice = convertedPrice.toFixed(
                    Number.isInteger(convertedPrice) ? 0 : 2,
                  );
                  const isPopular = index === 0 && plans.length > 1;
                  const limit = Number(plan?.max_purchase_per_user || 0);
                  const limitLabel = limit > 0 ? `${t('限购')} ${limit}` : null;
                  const totalLabel =
                    totalAmount > 0
                      ? `${t('总额度')}: ${formatQuotaAmount(totalAmount)}`
                      : `${t('总额度')}: ${t('不限')}`;
                  const upgradeLabel = plan?.upgrade_group
                    ? `${t('升级分组')}: ${plan.upgrade_group}`
                    : null;
                  const resetLabel =
                    formatSubscriptionResetPeriod(plan, t) === t('不重置')
                      ? null
                      : `${t('额度重置')}: ${formatSubscriptionResetPeriod(plan, t)}`;
                  const planBenefits = [
                    {
                      label: `${t('有效期')}: ${formatSubscriptionDuration(plan, t)}`,
                    },
                    resetLabel ? { label: resetLabel } : null,
                    totalAmount > 0
                      ? {
                          label: totalLabel,
                          tooltip: `${t('原生额度')}：${totalAmount}`,
                        }
                      : { label: totalLabel },
                    limitLabel ? { label: limitLabel } : null,
                    upgradeLabel ? { label: upgradeLabel } : null,
                  ].filter(Boolean);

                  return (
                    <Card
                      key={plan?.id}
                      className={`!rounded-xl transition-all hover:shadow-lg w-full h-full ${
                        isPopular ? 'ring-2 ring-purple-500' : ''
                      }`}
                      bodyStyle={{ padding: 0 }}
                    >
                      <div className='p-4 h-full flex flex-col relative'>
                        {/* 推荐标签 - 移动到右上角 */}
                        {isPopular && (
                          <div className='absolute top-4 right-4 z-10'>
                            <Tag color='purple' shape='circle' size='small'>
                              <Sparkles size={10} className='mr-1' />
                              {t('推荐')}
                            </Tag>
                          </div>
                        )}
                        {/* 套餐名称 */}
                        <div className='mb-3'>
                          <Typography.Title
                            heading={5}
                            ellipsis={{ rows: 1, showTooltip: true }}
                            style={{ margin: 0 }}
                          >
                            {plan?.title || t('订阅套餐')}
                          </Typography.Title>
                          {plan?.subtitle && (
                            <Text
                              type='tertiary'
                              size='small'
                              ellipsis={{ rows: 1, showTooltip: true }}
                              style={{ display: 'block' }}
                            >
                              {plan.subtitle}
                            </Text>
                          )}
                          {plan?.description && (
                            <Text
                              type='tertiary'
                              size='small'
                              ellipsis={{ rows: 2, showTooltip: true }}
                              style={{ display: 'block', marginTop: 4 }}
                            >
                              {plan.description}
                            </Text>
                          )}
                        </div>

                        {/* 价格区域 - 根据全局币种换算显示 */}
                        <div className='py-2'>
                          <div className='flex items-baseline justify-start'>
                            <span className='text-xl font-bold text-purple-600'>
                              {symbol}
                            </span>
                            <span className='text-3xl font-bold text-purple-600'>
                              {displayPrice}
                            </span>
                          </div>
                        </div>

                        {/* 套餐权益描述 */}
                        <div className='flex flex-col items-start gap-1 pb-2'>
                          {planBenefits.map((item) => {
                            const content = (
                              <div className='flex items-center gap-2 text-xs text-gray-500'>
                                <Badge dot type='tertiary' />
                                <span>{item.label}</span>
                              </div>
                            );
                            if (!item.tooltip) {
                              return (
                                <div
                                  key={item.label}
                                  className='w-full flex justify-start'
                                >
                                  {content}
                                </div>
                              );
                            }
                            return (
                              <Tooltip key={item.label} content={item.tooltip}>
                                <div className='w-full flex justify-start'>
                                  {content}
                                </div>
                              </Tooltip>
                            );
                          })}
                        </div>

                        <div className='mt-auto'>
                          <Divider margin={12} />

                          {/* 购买按钮 */}
                          {(() => {
                            const count = getPlanPurchaseCount(p?.plan?.id);
                            const reached = limit > 0 && count >= limit;
                            const tip = reached
                              ? t('已达到购买上限') + ` (${count}/${limit})`
                              : '';
                            const buttonEl = (
                              <Button
                                theme='outline'
                                type='primary'
                                block
                                disabled={reached}
                                onClick={() => {
                                  if (!reached) openBuy(p);
                                }}
                              >
                                {reached ? t('已达上限') : t('立即订阅')}
                              </Button>
                            );
                            return reached ? (
                              <Tooltip content={tip} position='top'>
                                {buttonEl}
                              </Tooltip>
                            ) : (
                              buttonEl
                            );
                          })()}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className='text-center text-gray-400 text-sm py-4'>
              {t('暂无可购买套餐')}
            </div>
          )}
        </Space>
      )}
    </>
  );

  return (
    <>
      {withCard ? (
        <Card className='!rounded-2xl shadow-sm border-0'>{cardContent}</Card>
      ) : (
        <div className='space-y-3'>{cardContent}</div>
      )}

      {/* 购买确认弹窗 */}
      <SubscriptionPurchaseModal
        t={t}
        visible={open}
        onCancel={closeBuy}
        selectedPlan={selectedPlan}
        paying={paying}
        selectedEpayMethod={selectedEpayMethod}
        setSelectedEpayMethod={setSelectedEpayMethod}
        epayMethods={epayMethods}
        enableOnlineTopUp={enableOnlineTopUp}
        enableStripeTopUp={enableStripeTopUp}
        enableCreemTopUp={enableCreemTopUp}
        purchaseLimitInfo={
          selectedPlan?.plan?.id
            ? {
                limit: Number(selectedPlan?.plan?.max_purchase_per_user || 0),
                count: getPlanPurchaseCount(selectedPlan?.plan?.id),
              }
            : null
        }
        onPayStripe={payStripe}
        onPayCreem={payCreem}
        onPayEpay={payEpay}
        onPayWallet={payWallet}
        userQuota={userQuota}
      />
    </>
  );
};

export default SubscriptionPlansCard;
