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

import React, { useEffect, useState, useMemo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Button,
  Tag,
  Typography,
  Space,
  Tooltip,
  Modal,
  Spin,
  Select,
  Badge,
  Avatar,
  Divider,
} from '@douyinfe/semi-ui';
import {
  API,
  showError,
  showSuccess,
  copy,
  getQuotaPerUnit,
} from '../../helpers';
import { getCurrencyConfig } from '../../helpers/render';
import { getServerAddress } from '../../helpers/token';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import {
  Sparkles,
  Package,
  Key,
  ArrowRight,
  RefreshCw,
  ChevronRight,
  Circle,
  CheckCircle2,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import SubscriptionPurchaseModal from '../../components/topup/modals/SubscriptionPurchaseModal';
import i18next from 'i18next';

const { Text } = Typography;

function formatTokensAmount(tokens) {
  if (tokens <= 0) return '0 Tokens';
  
  const locale = localStorage.getItem('locale') || i18next?.language || 'zh-CN';
  const isChinese = locale.includes('zh') || locale.includes('ZH');
  
  let value = Math.abs(tokens);
  let suffix = '';
  
  if (isChinese) {
    if (value >= 100000000) {
      value = value / 100000000;
      suffix = '亿';
    } else if (value >= 10000) {
      value = value / 10000;
      suffix = '万';
    } else {
      suffix = '';
    }
  } else {
    const units = ['', 'K', 'M', 'B', 'T'];
    let unitIndex = 0;
    while (value >= 1000 && unitIndex < units.length - 1) {
      value /= 1000;
      unitIndex++;
    }
    suffix = units[unitIndex];
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

function getEpayMethods(payMethods = []) {
  return (payMethods || []).filter(
    (m) => m?.type && m.type !== 'stripe' && m.type !== 'creem',
  );
}

const TokenPlan = () => {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [activeSubscription, setActiveSubscription] = useState(null);
  const [allSubscriptions, setAllSubscriptions] = useState([]);
  
  const [openBuyModal, setOpenBuyModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paying, setPaying] = useState(false);
  const [selectedEpayMethod, setSelectedEpayMethod] = useState('');
  
  const [payMethods, setPayMethods] = useState([]);
  const [enableOnlineTopUp, setEnableOnlineTopUp] = useState(false);
  const [enableStripeTopUp, setEnableStripeTopUp] = useState(false);
  const [enableCreemTopUp, setEnableCreemTopUp] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [subscriptionApiKey, setSubscriptionApiKey] = useState('');
  const [apiKeyLoading, setApiKeyLoading] = useState(true);
  
  const epayMethods = useMemo(() => getEpayMethods(payMethods), [payMethods]);
  
  const tokenPlans = useMemo(() => {
    return (plans || []).filter(p => p?.plan?.plan_type === 'tokens');
  }, [plans]);
  
  const hasActiveTokenPlan = useMemo(() => {
    return activeSubscription !== null && activeSubscription !== undefined;
  }, [activeSubscription]);
  
  const getPlanPurchaseCount = (planId) => {
    return (allSubscriptions || []).filter(s => s?.subscription?.plan_id === planId).length;
  };
  
  const getRemainingDays = (sub) => {
    if (!sub?.end_time) return 0;
    const now = Date.now() / 1000;
    const remaining = sub.end_time - now;
    return Math.max(0, Math.ceil(remaining / 86400));
  };
  
  const getUsagePercent = (sub) => {
    const total = Number(sub?.tokens_limit || 0);
    const used = Number(sub?.tokens_used || 0);
    if (total <= 0) return 0;
    return Math.min(100, Math.round((used / total) * 100));
  };
  
  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/subscription/plans');
      if (res.data?.success) {
        setPlans(res.data.data || []);
      }
    } catch (e) {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchSubscriptionSelf = async () => {
    try {
      const res = await API.get('/api/subscription/self');
      if (res.data?.success) {
        const subs = res.data.data?.subscriptions || [];
        const allSubs = res.data.data?.all_subscriptions || [];
        setAllSubscriptions(allSubs);
        
        const tokenSub = subs.find(s => s?.plan?.plan_type === 'tokens');
        
        if (tokenSub) {
          setActiveSubscription(tokenSub);
        } else {
          setActiveSubscription(null);
        }
      }
    } catch (e) {
      // ignore
    }
  };
  
  const fetchTopupInfo = async () => {
    try {
      const res = await API.get('/api/user/topup/info');
      const { data, success } = res.data;
      if (success) {
        let payMethods = data.pay_methods || [];
        if (typeof payMethods === 'string') {
          payMethods = JSON.parse(payMethods);
        }
        setPayMethods(payMethods);
        setEnableOnlineTopUp(data.enable_online_topup || false);
        setEnableStripeTopUp(data.enable_stripe_topup || false);
        setEnableCreemTopUp(data.enable_creem_topup || false);
      }
    } catch (e) {
      // ignore
    }
  };
  
  const fetchApiKeys = async () => {
    try {
      const res = await API.get('/api/user/token/subscription');
      if (res.data?.success) {
        const key = res.data.data?.key || '';
        setSubscriptionApiKey(key);
      } else {
        setSubscriptionApiKey('');
      }
    } catch (e) {
      showError('获取 API Key 失败，请刷新页面重试');
      setSubscriptionApiKey('');
    } finally {
      setApiKeyLoading(false);
    }
  };
  
  useEffect(() => {
    fetchPlans();
    fetchSubscriptionSelf();
    fetchTopupInfo();
    fetchApiKeys();
  }, [hasActiveTokenPlan]);
  
  const openBuy = (p) => {
    // Check if user already has an active token plan
    if (hasActiveTokenPlan) {
      Modal.warning({
        title: t('购买限制'),
        content: (
          <div>
            <p>{t('每个用户同时只能购买一个套餐，您已存在生效中的套餐。')}</p>
            <p className='mt-2 text-gray-500'>{t('如需更换套餐，请等待当前套餐到期或联系客服。')}</p>
          </div>
        ),
        centered: true,
        maskClosable: true,
        okText: t('我知道了'),
      });
      return;
    }
    
    setSelectedPlan(p);
    setSelectedEpayMethod(epayMethods?.[0]?.type || '');
    setOpenBuyModal(true);
  };
  
  const closeBuy = () => {
    setOpenBuyModal(false);
    setSelectedPlan(null);
    setPaying(false);
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
        fetchSubscriptionSelf();
      } else {
        const errorMsg = typeof res.data?.data === 'string'
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
        fetchSubscriptionSelf();
      } else {
        const errorMsg = typeof res.data?.data === 'string'
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
        const form = document.createElement('form');
        form.action = res.data.url;
        form.method = 'POST';
        const isSafari = navigator.userAgent.indexOf('Safari') > -1 && navigator.userAgent.indexOf('Chrome') < 1;
        if (!isSafari) form.target = '_blank';
        Object.keys(res.data.data || {}).forEach((key) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = res.data.data[key];
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
        showSuccess(t('已发起支付'));
        closeBuy();
        fetchSubscriptionSelf();
      } else {
        const errorMsg = typeof res.data?.data === 'string'
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
    const plan = selectedPlan?.plan;
    if (!plan) return;
    
    const priceAmount = Number(plan.price_amount || 0);
    const quotaPerUnit = getQuotaPerUnit();
    const requiredQuota = priceAmount * quotaPerUnit;
    const currentQuota = userState?.user?.quota || 0;
    
    if (currentQuota < requiredQuota) {
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
        fetchSubscriptionSelf();
        fetchApiKeys();
      } else {
        showError(res.data?.message || t('支付失败'));
      }
    } catch (e) {
      showError(t('支付请求失败'));
    } finally {
      setPaying(false);
    }
  };
  
  const handleRefresh = () => {
    fetchSubscriptionSelf();
  };
  
  const handleCopyKey = async (key) => {
    await copy(key);
    showSuccess(t('复制成功'));
  };
  
  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleString();
  };
  
  const renderSteps = (currentStep) => {
    const steps = [
      { key: 1, title: t('购买编码套餐'), desc: t('选择心仪方案并完成支付') },
      { key: 2, title: t('获得专属App Key'), desc: t('购买成功后获取') },
      { key: 3, title: t('接入AI工具'), desc: t('了解如何接入') },
      { key: 4, title: t('开启编码'), desc: t('解锁使用') },
    ];
    
    return (
      <div className='flex items-center justify-center gap-4 mb-8'>
        {steps.map((step, index) => {
          const isActive = step.key <= currentStep;
          const isCompleted = step.key < currentStep;
          
          return (
            <div key={step.key} className='flex items-center'>
              <div className='flex flex-col items-center'>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isCompleted ? 'bg-green-500 text-white' : 
                  isActive ? 'bg-blue-500 text-white' : 
                  'bg-gray-100 text-gray-400'
                }`}>
                  <Text strong>{step.key}</Text>
                </div>
                <Text size='small' className={`mt-2 ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>
                  {step.title}
                </Text>
                <Text size='small' type='tertiary' className='mt-1 text-xs'>
                  {step.desc}
                </Text>
              </div>
              {index < steps.length - 1 && (
                <ArrowRight size={16} className={`mx-4 ${isActive ? 'text-blue-500' : 'text-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    );
  };
  
  const renderPlanCards = () => {
    const { symbol, rate } = getCurrencyConfig();
    
    return (
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
        {tokenPlans.map((p, index) => {
          const plan = p?.plan;
          const price = Number(plan?.price_amount || 0);
          const convertedPrice = price * rate;
          const displayPrice = convertedPrice.toFixed(Number.isInteger(convertedPrice) ? 0 : 2);
          const tokensLimit = Number(plan?.tokens_limit || 0);
          const isPopular = index === 0 && tokenPlans.length > 1;
          const limit = Number(plan?.max_purchase_per_user || 0);
          const count = getPlanPurchaseCount(plan?.id);
          const reached = limit > 0 && count >= limit;
          
          return (
            <Card
              key={plan?.id}
              className={`!rounded-xl transition-all hover:shadow-lg h-full ${isPopular ? 'ring-2 ring-purple-500' : ''}`}
              bodyStyle={{ padding: 0 }}
            >
              <div className='p-5 h-full flex flex-col relative'>
                <div className='absolute top-4 right-4 z-10 flex flex-row gap-1'>
                  {isPopular && (
                    <Tag color='purple' shape='circle' size='small'>
                      <Sparkles size={10} className='mr-1' />
                      {t('推荐')}
                    </Tag>
                  )}
                </div>
                
                <div className='mb-4 pr-16'>
                  <Typography.Title heading={5} style={{ margin: 0 }}>
                    {plan?.title || t('Token套餐')}
                  </Typography.Title>
                  {plan?.subtitle && (
                    <Text type='tertiary' size='small' style={{ display: 'block', marginTop: 2 }}>
                      {plan.subtitle}
                    </Text>
                  )}
                  {plan?.description && (
                    <Text type='tertiary' size='small' style={{ display: 'block', marginTop: 4 }}>
                      {plan.description}
                    </Text>
                  )}
                </div>
                
                <div className='py-3'>
                  <div className='flex items-baseline'>
                    <span className='text-xl font-bold text-purple-600'>{symbol}</span>
                    <span className='text-4xl font-bold text-purple-600'>{displayPrice}</span>
                    <span className='text-gray-400 ml-1'>/月</span>
                  </div>
                </div>
                
                <div className='flex flex-col items-start gap-2 flex-1'>
                  <div className='flex items-center gap-2 text-sm text-gray-600'>
                    <Badge dot type='tertiary' />
                    <span>{t('用量')} {formatTokensAmount(tokensLimit)} Tokens</span>
                  </div>
                  {plan?.applicable_models && (
                    <div className='flex items-center gap-2 text-sm text-gray-600'>
                      <Badge dot type='tertiary' />
                      <span>{t('模型')} {plan.applicable_models}</span>
                    </div>
                  )}
                  <div className='flex items-center gap-2 text-sm text-gray-600'>
                    <Badge dot type='tertiary' />
                    <span>{t('工具')} OpenClaw、Claude Code 等主流编程工具</span>
                  </div>
                </div>
                
                <div className='mt-auto pt-4'>
                  <Button
                    theme='outline'
                    type='primary'
                    block
                    disabled={reached || hasActiveTokenPlan}
                    onClick={() => {
                      if (!reached && !hasActiveTokenPlan) openBuy(p);
                    }}
                  >
                    {hasActiveTokenPlan ? t('已订阅') : reached ? t('已达上限') : t('立即购买')}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };
  
  const renderSubscriptionDetail = () => {
    if (!activeSubscription) return null;
    
    const sub = activeSubscription?.subscription;
    const plan = activeSubscription?.plan;
    const { symbol, rate } = getCurrencyConfig();
    const price = Number(plan?.price_amount || 0);
    const convertedPrice = price * rate;
    const displayPrice = convertedPrice.toFixed(Number.isInteger(convertedPrice) ? 0 : 2);
    const tokensLimit = Number(sub?.tokens_limit || 0);
    const tokensUsed = Number(sub?.tokens_used || 0);
    const tokensRemaining = tokensLimit - tokensUsed;
    const usagePercent = getUsagePercent(sub);
    const remainingDays = getRemainingDays(sub);
    
    // Get applicable models from plan
    const applicableModels = plan?.applicable_models || '';
    const modelList = applicableModels.split(',').filter(m => m.trim());
    
    // Get API Key from subscription token
    const apiKey = subscriptionApiKey;
    const appId = userState?.user?.id || '-';
    const maskedKey = apiKey ? (apiKey.length > 10 ? apiKey.substring(0, 10) + '****************************' : apiKey) : '';
    
    // Request URLs using server address from system settings
    const serverAddress = getServerAddress();
    const openaiUrl = `${serverAddress}/v1/chat/completions`;
    const anthropicUrl = `${serverAddress}/v1/messages`;
    
    // Coding tools list
    const codingTools = ['OpenClaw', 'Claude Code', 'OpenCode', 'Codex', 'Cursor', 'Cline'];
    
    return (
      <div className='space-y-6'>
        {/* Top Grid: Plan Info + Usage */}
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {/* Left: Plan Info Card */}
          <Card className='!rounded-xl lg:col-span-1'>
            <div className='flex items-center gap-3 mb-6'>
              <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg'>
                <Package size={24} className='text-white' />
              </div>
              <div>
                <Typography.Title heading={5} style={{ margin: 0 }}>
                  {plan?.title || t('Token套餐')}
                </Typography.Title>
              </div>
            </div>
            
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-1'>
                  <Text type='tertiary' size='small'>{t('剩余天数')}</Text>
                </div>
                <div className='flex items-baseline gap-1'>
                  <Text strong className='text-3xl text-blue-600'>{remainingDays}</Text>
                  <Text type='tertiary' size='small'>{t('天')}</Text>
                </div>
              </div>
              
              <div className='flex items-center justify-between'>
                <Text type='tertiary' size='small'>{t('状态')}</Text>
                <div className='flex items-center gap-1'>
                  <div className='w-2 h-2 rounded-full bg-green-500'></div>
                  <Text strong className='text-green-600'>{t('使用中')}</Text>
                </div>
              </div>
              
              <Divider margin={12} />
              
              <div className='grid grid-cols-2 gap-4 text-sm'>
                <div>
                  <Text type='tertiary' size='small' className='block mb-1'>{t('开始时间')}</Text>
                  <Text size='small'>{formatDate(sub?.start_time)}</Text>
                </div>
                <div>
                  <Text type='tertiary' size='small' className='block mb-1'>{t('结束时间')}</Text>
                  <Text size='small'>{formatDate(sub?.end_time)}</Text>
                </div>
              </div>
              
              <div>
                <Text type='tertiary' size='small' className='block mb-1'>{t('资源ID')}</Text>
                <Text size='small' className='font-mono'>{sub?.id || '-'}</Text>
              </div>
            </div>
            
            <div className='mt-6 flex gap-3'>
              {/* TODO: 实现续订功能
              <Button theme='solid' type='primary' size='small' className='flex-1'>
                {t('续订')}
              </Button>
              */}
              <Tooltip content={t('每个用户同时只能购买一个套餐，您已存在生效中的套餐。如需更换套餐，请等待当前套餐到期或联系客服。')}>
                <Button theme='outline' size='small' className='flex-1' disabled>{t('重新选购')}</Button>
              </Tooltip>
            </div>
          </Card>
          
          {/* Right: Usage Card */}
          <Card className='!rounded-xl lg:col-span-2'>
            <div className='flex items-center justify-between mb-6'>
              <Typography.Title heading={5} style={{ margin: 0 }}>
                {t('套餐用量')}
              </Typography.Title>
              <Button
                theme='borderless'
                type='tertiary'
                size='small'
                icon={<RefreshCw size={16} />}
                onClick={handleRefresh}
              />
            </div>
            
            <div className='flex flex-col sm:flex-row items-center gap-8'>
              {/* Semi-circle Gauge */}
              <div className='relative w-48 h-28'>
                <svg viewBox='0 0 200 110' className='w-full h-full'>
                  {/* Background arc */}
                  <path
                    d='M 20 100 A 80 80 0 0 1 180 100'
                    fill='none'
                    stroke='var(--semi-color-border)'
                    strokeWidth='12'
                    strokeLinecap='round'
                  />
                  {/* Progress arc */}
                  <path
                    d='M 20 100 A 80 80 0 0 1 180 100'
                    fill='none'
                    stroke='url(#gaugeGradient)'
                    strokeWidth='12'
                    strokeLinecap='round'
                    strokeDasharray={`${usagePercent * 2.51} 251`}
                    style={{ 
                      transition: 'stroke-dasharray 0.5s ease',
                      transformOrigin: '100px 100px',
                      transform: 'rotate(180deg)'
                    }}
                  />
                  <defs>
                    <linearGradient id='gaugeGradient' x1='0%' y1='0%' x2='100%' y2='0%'>
                      <stop offset='0%' stopColor='#8B5CF6' />
                      <stop offset='100%' stopColor='#3B82F6' />
                    </linearGradient>
                  </defs>
                </svg>
                <div className='absolute bottom-0 left-0 right-0 flex flex-col items-center'>
                  <Text strong className='text-2xl text-gray-800'>{usagePercent}%</Text>
                  <Text size='small' type='tertiary'>{t('使用进度')}</Text>
                </div>
              </div>
              
              <div className='flex-1 grid grid-cols-3 gap-4 w-full'>
                <div className='text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl'>
                  <Text type='tertiary' size='small' className='block mb-1'>{t('剩余额度')}</Text>
                  <Text strong className='text-lg text-green-600'>
                    {formatTokensAmount(tokensRemaining)} Tokens
                  </Text>
                </div>
                <div className='text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl'>
                  <Text type='tertiary' size='small' className='block mb-1'>{t('已用额度')}</Text>
                  <Text strong className='text-lg text-orange-600'>
                    {formatTokensAmount(tokensUsed)} Tokens
                  </Text>
                </div>
                <div className='text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl'>
                  <Text type='tertiary' size='small' className='block mb-1'>{t('总额度')}</Text>
                  <Text strong className='text-lg text-blue-600'>
                    {formatTokensAmount(tokensLimit)} Tokens
                  </Text>
                </div>
              </div>
            </div>
          </Card>
        </div>
        
        {/* Traffic Notice Banner */}
        <div className='bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 flex items-start gap-3'>
          <AlertTriangle size={18} className='text-amber-500 mt-0.5 flex-shrink-0' />
          <div>
            <Text strong className='text-amber-700 dark:text-amber-400 block mb-1'>
              {t('流量说明')}
            </Text>
            <Text size='small' className='text-amber-600 dark:text-amber-500'>
              {t('受限于资源紧张，高峰期(09:00-18:00)可能会出现调用400错误等提示，该情况不属于服务不可用。如遇上述问题，请在非高峰期或选用其他模型重试。')}
            </Text>
          </div>
        </div>
        
        {/* API Info Card */}
        <Card className='!rounded-xl'>
          <div className='flex items-center gap-3 mb-6'>
            <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg'>
              <Key size={20} className='text-white' />
            </div>
            <div>
              <Typography.Title heading={5} style={{ margin: 0 }}>
                {t('调用信息')}
              </Typography.Title>
            </div>
          </div>
          
          <div className='space-y-6'>
            {/* API Key Section */}
            <div>
              <Text strong className='block mb-3'>{t('专属App Key')}</Text>
              <div className='flex flex-col sm:flex-row items-start sm:items-center gap-3'>
                <Card className='!border-0 bg-slate-50 dark:bg-slate-800 flex-1 w-full'>
                  <div className='flex items-center justify-between gap-4'>
                    {apiKeyLoading ? (
                      <Text type='tertiary' className='font-mono text-sm'>加载中...</Text>
                    ) : apiKey ? (
                      <Text strong className='font-mono text-sm truncate'>
                        {showApiKey ? apiKey : maskedKey}
                      </Text>
                    ) : (
                      <Text type='warning' className='font-mono text-sm'>
                        {t('暂无 API Key，请先购买套餐')}
                      </Text>
                    )}
                    <div className='flex items-center gap-2 flex-shrink-0'>
                      <Button
                        theme='borderless'
                        type='tertiary'
                        size='small'
                        icon={showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                        onClick={() => setShowApiKey(!showApiKey)}
                      />
                      <Button
                        theme='borderless'
                        type='tertiary'
                        size='small'
                        icon={<Copy size={14} />}
                        onClick={() => handleCopyKey(apiKey)}
                      />
                    </div>
                  </div>
                </Card>
                <div className='flex items-center gap-2 flex-shrink-0'>
                  <Text type='tertiary' size='small'>{t('App ID')}</Text>
                  <Text strong size='small' className='font-mono'>{appId}</Text>
                  <Button
                    theme='borderless'
                    type='tertiary'
                    size='small'
                    icon={<Copy size={14} />}
                    onClick={() => handleCopyKey(appId)}
                  />
                </div>
              </div>
            </div>
            
            {/* Request URLs */}
            <div>
              <Text strong className='block mb-3'>{t('专属请求地址')}</Text>
              <div className='space-y-2'>
                <Card className='!border-0 bg-slate-50 dark:bg-slate-800'>
                  <div className='flex items-center justify-between gap-4'>
                    <div className='flex items-center gap-3 min-w-0'>
                      <Tag color='blue' size='small'>{t('OpenAI协议')}</Tag>
                      <Text size='small' className='font-mono truncate'>
                        {openaiUrl}
                      </Text>
                    </div>
                    <Button
                      theme='borderless'
                      type='tertiary'
                      size='small'
                      icon={<Copy size={14} />}
                      onClick={() => handleCopyKey(openaiUrl)}
                    />
                  </div>
                </Card>
                <Card className='!border-0 bg-slate-50 dark:bg-slate-800'>
                  <div className='flex items-center justify-between gap-4'>
                    <div className='flex items-center gap-3 min-w-0'>
                      <Tag color='purple' size='small'>{t('Anthropic协议')}</Tag>
                      <Text size='small' className='font-mono truncate'>
                        {anthropicUrl}
                      </Text>
                    </div>
                    <Button
                      theme='borderless'
                      type='tertiary'
                      size='small'
                      icon={<Copy size={14} />}
                      onClick={() => handleCopyKey(anthropicUrl)}
                    />
                  </div>
                </Card>
              </div>
            </div>
            
            {/* Models */}
            {modelList.length > 0 && (
              <div>
                <Text strong className='block mb-3'>{t('可调用模型')}</Text>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  {modelList.map((model, idx) => (
                    <Card key={idx} className='!border-0 bg-slate-50 dark:bg-slate-800 p-4'>
                      <div className='flex items-center gap-3'>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          idx % 2 === 0 
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                            : 'bg-gradient-to-br from-purple-500 to-purple-600'
                        }`}>
                          <Text className='text-white text-xs font-bold'>
                            {model.substring(0, 2).toUpperCase()}
                          </Text>
                        </div>
                        <div className='min-w-0'>
                          <Text strong className='block truncate'>{model.trim()}</Text>
                          <Text type='tertiary' size='small' className='block truncate'>
                            {t('支持标准API格式')}
                          </Text>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            
            {/* Coding Tools */}
            <div>
              <Text strong className='block mb-3'>{t('支持接入的编码工具')}</Text>
              <div className='flex flex-wrap gap-2'>
                {codingTools.map((tool) => (
                  <Tag key={tool} color='blue' shape='circle' size='small'>
                    {tool}
                  </Tag>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  };
  
  return (
    <div className='w-full max-w-7xl mx-auto relative min-h-screen lg:min-h-0 mt-[60px] px-2'>
      <div className='mb-8'>
        <div>
          <Typography.Title heading={2} style={{ margin: 0 }}>
            {t('编程Token Plan')}
          </Typography.Title>
          <Text type='tertiary' className='mt-1 block'>
            {t('专为AI编码场景设计，支持主流AI开发工具，畅享热门模型，获得便捷、稳定、流畅的编码体验')}
          </Text>
        </div>
        
        {renderSteps(hasActiveTokenPlan ? 2 : 1)}
      </div>
      
      <Spin spinning={loading}>
        {hasActiveTokenPlan ? (
          renderSubscriptionDetail()
        ) : (
          <Card className='!rounded-2xl shadow-sm border-0'>
            <div className='flex items-center mb-4'>
              <Avatar size='small' color='purple' className='mr-3 shadow-md'>
                <Package size={16} />
              </Avatar>
              <div>
                <Typography.Text className='text-lg font-medium'>
                  {t('选择套餐')}
                </Typography.Text>
              </div>
            </div>
            {tokenPlans.length > 0 ? (
              renderPlanCards()
            ) : (
              <div className='text-center text-gray-400 py-12'>
                {t('暂无可购买的Token套餐')}
              </div>
            )}
          </Card>
        )}
      </Spin>
      
      <SubscriptionPurchaseModal
        t={t}
        visible={openBuyModal}
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
        userQuota={userState?.user?.quota || 0}
      />
    </div>
  );
};

export default TokenPlan;