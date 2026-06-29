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

import React, { useEffect, useState, useContext, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  API,
  showError,
  showInfo,
  showSuccess,
  renderQuota,
  renderQuotaWithAmount,
  copy,
  getQuotaPerUnit,
} from '../../helpers';
import { getCurrencyConfig } from '../../helpers/render';
import { Modal, Toast, Tabs, TabPane } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';

import RechargeCard from './RechargeCard';
import TransferModal from './modals/TransferModal';
import PaymentConfirmModal from './modals/PaymentConfirmModal';
import QRCodeModal from './QRCodeModal';
import TopupHistoryModal from './modals/TopupHistoryModal';
import EarIcon from './EarIcon';
import InvitationPanel from './InvitationPanel';
import QuotaPlanSection from './QuotaPlanSection';

const TopUp = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);

  const [redemptionCode, setRedemptionCode] = useState('');
  const [amount, setAmount] = useState(0.0);
  const [minTopUp, setMinTopUp] = useState(statusState?.status?.min_topup || 1);
  const [topUpCount, setTopUpCount] = useState(
    statusState?.status?.min_topup || 1,
  );
  const [topUpLink, setTopUpLink] = useState(
    statusState?.status?.top_up_link || '',
  );
  const [enableOnlineTopUp, setEnableOnlineTopUp] = useState(
    statusState?.status?.enable_online_topup || false,
  );
  const [priceRatio, setPriceRatio] = useState(statusState?.status?.price || 1);

  const [enableStripeTopUp, setEnableStripeTopUp] = useState(
    statusState?.status?.enable_stripe_topup || false,
  );
  const [statusLoading, setStatusLoading] = useState(true);

  // Creem 相关状态
  const [creemProducts, setCreemProducts] = useState([]);
  const [enableCreemTopUp, setEnableCreemTopUp] = useState(false);
  const [creemOpen, setCreemOpen] = useState(false);
  const [selectedCreemProduct, setSelectedCreemProduct] = useState(null);

  // Waffo 相关状态
  const [enableWaffoTopUp, setEnableWaffoTopUp] = useState(false);
  const [waffoPayMethods, setWaffoPayMethods] = useState([]);
  const [waffoMinTopUp, setWaffoMinTopUp] = useState(1);

  // 招商银行聚合支付相关状态
  // 招商银行聚合支付相关状态
  const [enableZsPayTopUp, setEnableZsPayTopUp] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeData, setQrCodeData] = useState({});

  // 合利宝支付相关状态
  const [enableHelipayTopUp, setEnableHelipayTopUp] = useState(false);
  const [helipayPolling, setHelipayPolling] = useState(false);
  const [helipayTradeNo, setHelipayTradeNo] = useState('');
  const helipayPollingRef = useRef(null);

  // 判断是否只启用了招行支付（是的话隐藏充值数量输入和支付方式选择）
  const onlyZsPayEnabled = enableZsPayTopUp && !enableOnlineTopUp && !enableStripeTopUp && !enableWaffoTopUp && !enableHelipayTopUp;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [payWay, setPayWay] = useState('');
  const [amountLoading, setAmountLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [payMethods, setPayMethods] = useState([]);

  const affFetchedRef = useRef(false);

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

  // 预设充值额度选项
  const [presetAmounts, setPresetAmounts] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);

  // 充值配置信息
  const [topupInfo, setTopupInfo] = useState({
    amount_options: [],
    discount: {},
  });

  const topUp = async () => {
    if (redemptionCode === '') {
      showInfo(t('请输入兑换码！'));
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await API.post('/api/user/topup', {
        key: redemptionCode,
      });
      const { success, message, data } = res.data;
      if (success) {
        showSuccess(t('兑换成功！'));
        Modal.success({
          title: t('兑换成功！'),
          content: t('成功兑换额度：') + renderQuota(data),
          centered: true,
        });
        if (userState.user) {
          const updatedUser = {
            ...userState.user,
            quota: userState.user.quota + data,
          };
          userDispatch({ type: 'login', payload: updatedUser });
        }
        setRedemptionCode('');
      } else {
        showError(message);
      }
    } catch (err) {
      showError(t('请求失败'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTopUpLink = () => {
    if (!topUpLink) {
      showError(t('超级管理员未设置充值链接！'));
      return;
    }
    window.open(topUpLink, '_blank');
  };

  const preTopUp = async (payment) => {
    if (payment === 'stripe') {
      if (!enableStripeTopUp) {
        showError(t('管理员未开启Stripe充值！'));
        return;
      }
    } else if (payment === 'zs_pay') {
      if (!enableZsPayTopUp) {
        showError(t('管理员未开启招商银行聚合支付！'));
        return;
      }
    } else if (payment === 'helipay') {
      if (!enableHelipayTopUp) {
        showError(t('管理员未开启合利宝支付！'));
        return;
      }
    } else {
      if (!enableOnlineTopUp) {
        showError(t('管理员未开启在线充值！'));
        return;
      }
    }

    setPayWay(payment);
    setPaymentLoading(true);
    try {
      // 当只启用招行支付时，使用选中的充值套餐金额或自定义输入金额
      // 因为自定义充值数量选项的值已经是当前币元，不需要后端计算
      if (payment === 'zs_pay' && onlyZsPayEnabled && selectedPreset) {
        // 使用选中的充值套餐金额，直接设置 topUpCount
        setTopUpCount(selectedPreset);
      }
      
      // 计算支付金额
      if (payment === 'stripe') {
        await getStripeAmount();
      } else if (payment === 'zs_pay') {
        // 招商银行聚合支付金额计算 - 支持预设套餐和自定义金额
        if (selectedPreset) {
          const preset = presetAmounts.find(p => p.value === selectedPreset);
          if (preset) {
            const discount = preset.discount || topupInfo.discount[selectedPreset] || 1.0;
            const discountedAmount = selectedPreset * discount;
            setAmount(discountedAmount);
          } else {
            setAmount(selectedPreset);
          }
        } else {
          // 自定义金额，直接使用 topUpCount
          setAmount(topUpCount);
        }
      } else if (payment === 'helipay') {
        // 合利宝支付金额计算 - 支持自定义金额和预设套餐
        if (selectedPreset) {
          const preset = presetAmounts.find(p => p.value === selectedPreset);
          if (preset) {
            const discount = preset.discount || topupInfo.discount[selectedPreset] || 1.0;
            const discountedAmount = selectedPreset * discount;
            setAmount(discountedAmount);
          } else {
            setAmount(selectedPreset);
          }
        } else {
          // 自定义金额，直接使用 topUpCount
          setAmount(topUpCount);
        }
      } else if (payment !== 'zs_pay' && payment !== 'helipay' && enableOnlineTopUp) {
        // 如果选择了自定义币元金额的预设选项，直接计算金额，不调用后端 API
        const selectedPresetObj = presetAmounts.find(p => p.value === selectedPreset);
        if (selectedPresetObj && selectedPresetObj.isCustomCurrencyAmount) {
          const discount = selectedPresetObj.discount || topupInfo.discount[selectedPreset] || 1.0;
          setAmount(selectedPreset * discount);
        } else {
          // 只有选择易支付（支付宝/微信/银行卡等）时才调用 getAmount
          await getAmount();
        }
      }

      if (topUpCount < minTopUp) {
        showError(t('充值数量不能小于') + minTopUp);
        return;
      }
      setOpen(true);
    } catch (error) {
      showError(t('获取金额失败'));
    } finally {
      setPaymentLoading(false);
    }
  };

  const onlineTopUp = async () => {
    if (payWay === 'stripe') {
      // Stripe 支付处理
      if (amount === 0) {
        await getStripeAmount();
      }
    } else if (payWay === 'zs_pay') {
      // 招商银行聚合支付处理 - 支持自定义金额和预设套餐
      if (!selectedPreset && topUpCount > 0) {
        // 自定义金额，直接计算
        setAmount(topUpCount);
      }
    } else if (payWay === 'helipay') {
      // 合利宝支付处理 - 支持自定义金额和预设套餐
      if (!selectedPreset && topUpCount > 0) {
        // 自定义金额，直接计算
        setAmount(topUpCount);
      }
    } else {
      // 易支付等普通支付处理
      if (amount === 0) {
        await getAmount();
      }
    }

    if (topUpCount < minTopUp) {
      showError(t('充值数量不能小于') + minTopUp);
      return;
    }
    setConfirmLoading(true);
    try {
      let res;
      if (payWay === 'stripe') {
        // Stripe 支付请求
        res = await API.post('/api/user/stripe/pay', {
          amount: parseFloat(topUpCount),
          payment_method: 'stripe',
        });
      } else if (payWay === 'zs_pay') {
        // 招商银行聚合支付请求 - 后端会处理折扣计算
        res = await API.post('/api/user/zs_pay/pay', {
          amount: parseFloat(topUpCount),
          payment_method: 'zs_pay',
        });
      } else if (payWay === 'helipay') {
        // 合利宝支付请求 - 后端会处理折扣计算
        res = await API.post('/api/user/helipay/pay', {
          amount: parseFloat(topUpCount),
          payment_method: 'helipay',
        });
      } else {
        // 普通支付请求
        res = await API.post('/api/user/pay', {
          amount: parseFloat(topUpCount),
          payment_method: payWay,
        });
      }

      if (res !== undefined) {
        const { message, data, qr_code_url, trade_no, amount, expire_at } = res.data;
        if (message === 'success') {
          if (payWay === 'stripe') {
            // Stripe 支付回调处理
            // 使用 <a> 标签方式避免浏览器拦截 popup
            const link = document.createElement('a');
            link.href = data.pay_link;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } else if (payWay === 'zs_pay') {
            // 招商银行聚合支付 - 显示二维码
            if (qr_code_url) {
              setQrCodeData({
                qrCodeUrl: qr_code_url,
                tradeNo: trade_no,
                amount: amount,
                expireAt: expire_at,
              });
              setShowQRCode(true);
            } else {
              showError(t('获取支付二维码失败'));
            }
          } else if (payWay === 'helipay') {
            // 合利宝支付 - 打开支付链接并轮询支付状态
            if (data && data.pay_link) {
              const orderId = data.order_id;
              // 保存 order_id 并开始轮询
              setHelipayTradeNo(orderId);
              setHelipayPolling(true);
              // 打开支付链接
              const link = document.createElement('a');
              link.href = data.pay_link;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              // 开始轮询支付状态
              startHelipayPolling(orderId);
            } else {
              showError(t('获取支付链接失败'));
            }
          } else {
            // 普通支付表单提交
            let params = data;
            let url = res.data.url;
            let form = document.createElement('form');
            form.action = url;
            form.method = 'POST';
            let isSafari =
              navigator.userAgent.indexOf('Safari') > -1 &&
              navigator.userAgent.indexOf('Chrome') < 1;
            if (!isSafari) {
              form.target = '_blank';
            }
            for (let key in params) {
              let input = document.createElement('input');
              input.type = 'hidden';
              input.name = key;
              input.value = params[key];
              form.appendChild(input);
            }
            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
          }
        } else {
          const errorMsg =
            typeof data === 'string' ? data : message || t('支付失败');
          showError(errorMsg);
        }
      } else {
        showError(res);
      }
    } catch (err) {
      showError(t('支付请求失败'));
    } finally {
      setOpen(false);
      setConfirmLoading(false);
    }
  };

  const creemPreTopUp = async (product) => {
    if (!enableCreemTopUp) {
      showError(t('管理员未开启 Creem 充值！'));
      return;
    }
    setSelectedCreemProduct(product);
    setCreemOpen(true);
  };

  const onlineCreemTopUp = async () => {
    if (!selectedCreemProduct) {
      showError(t('请选择产品'));
      return;
    }
    // Validate product has required fields
    if (!selectedCreemProduct.productId) {
      showError(t('产品配置错误，请联系管理员'));
      return;
    }
    setConfirmLoading(true);
    try {
      const res = await API.post('/api/user/creem/pay', {
        product_id: selectedCreemProduct.productId,
        payment_method: 'creem',
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          processCreemCallback(data);
        } else {
          const errorMsg =
            typeof data === 'string' ? data : message || t('支付失败');
          showError(errorMsg);
        }
      } else {
        showError(res);
      }
    } catch (err) {
      showError(t('支付请求失败'));
    } finally {
      setCreemOpen(false);
      setConfirmLoading(false);
    }
  };

  const waffoTopUp = async (payMethodIndex) => {
    try {
        if (topUpCount < waffoMinTopUp) {
            showError(t('充值数量不能小于') + waffoMinTopUp);
            return;
        }
        setPaymentLoading(true);
        const requestBody = {
            amount: parseFloat(topUpCount),
        };
        if (payMethodIndex != null) {
            requestBody.pay_method_index = payMethodIndex;
        }
        const res = await API.post('/api/user/waffo/pay', requestBody);
        if (res !== undefined) {
            const { message, data } = res.data;
            if (message === 'success' && data?.payment_url) {
                window.open(data.payment_url, '_blank');
            } else {
                showError(data || t('支付请求失败'));
            }
        } else {
            showError(res);
        }
    } catch (e) {
        showError(t('支付请求失败'));
    } finally {
        setPaymentLoading(false);
    }
  };

  const processCreemCallback = (data) => {
    // 与 Stripe 保持一致的实现方式
    window.open(data.checkout_url, '_blank');
  };

  const getUserQuota = async () => {
    let res = await API.get(`/api/user/self`);
    const { success, message, data } = res.data;
    if (success) {
      userDispatch({ type: 'login', payload: data });
    } else {
      showError(message);
    }
  };

  // 刷新二维码
  const handleRefreshQRCode = async () => {
    try {
      const res = await API.post('/api/user/zs_pay/pay', {
        amount: parseFloat(topUpCount),
        payment_method: 'zs_pay',
      });
      if (res.data?.message === 'success' && res.data.qr_code_url) {
        setQrCodeData({
          qrCodeUrl: res.data.qr_code_url,
          tradeNo: res.data.trade_no,
          amount: res.data.amount,
          expireAt: res.data.expire_at,
        });
      } else {
        showError(t('获取支付二维码失败'));
      }
    } catch (error) {
      showError(t('获取支付二维码失败'));
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

  // 获取充值配置信息
  const getTopupInfo = async () => {
    try {
      const res = await API.get('/api/user/topup/info');
      const { message, data, success } = res.data;
      if (success) {
        setTopupInfo({
          amount_options: data.amount_options || [],
          discount: data.discount || {},
        });

        // 处理支付方式
        let payMethods = data.pay_methods || [];
        try {
          if (typeof payMethods === 'string') {
            payMethods = JSON.parse(payMethods);
          }
          if (payMethods && payMethods.length > 0) {
            // 检查name和type是否为空
            payMethods = payMethods.filter((method) => {
              return method.name && method.type;
            });
            // 如果没有color，则设置默认颜色
            payMethods = payMethods.map((method) => {
              // 规范化最小充值数
              const normalizedMinTopup = Number(method.min_topup);
              method.min_topup = Number.isFinite(normalizedMinTopup)
                ? normalizedMinTopup
                : 0;

              // Stripe 的最小充值从后端字段回填
              if (
                method.type === 'stripe' &&
                (!method.min_topup || method.min_topup <= 0)
              ) {
                const stripeMin = Number(data.stripe_min_topup);
                if (Number.isFinite(stripeMin)) {
                  method.min_topup = stripeMin;
                }
              }

              if (!method.color) {
                if (method.type === 'alipay') {
                  method.color = 'rgba(var(--semi-blue-5), 1)';
                } else if (method.type === 'wxpay') {
                  method.color = 'rgba(var(--semi-green-5), 1)';
                } else if (method.type === 'stripe') {
                  method.color = 'rgba(var(--semi-purple-5), 1)';
                } else {
                  method.color = 'rgba(var(--semi-primary-5), 1)';
                }
              }
              return method;
            });
          } else {
            payMethods = [];
          }

          // 如果启用了 Stripe 支付，添加到支付方法列表
          // 这个逻辑现在由后端处理，如果 Stripe 启用，后端会在 pay_methods 中包含它

          setPayMethods(payMethods);
          const enableStripeTopUp = data.enable_stripe_topup || false;
          const enableOnlineTopUp = data.enable_online_topup || false;
          const enableCreemTopUp = data.enable_creem_topup || false;
          const enableZsPayTopUp = data.enable_zs_pay_topup || false;
          const enableHelipayTopUp = data.enable_helipay_topup || false;
          const minTopUpValue = enableOnlineTopUp
            ? data.min_topup
            : enableStripeTopUp
              ? data.stripe_min_topup
              : enableZsPayTopUp
                ? data.min_topup
                : data.enable_waffo_topup
                  ? data.waffo_min_topup
                  : enableHelipayTopUp
                    ? data.min_topup
                    : 1;
          setEnableOnlineTopUp(enableOnlineTopUp);
          setEnableStripeTopUp(enableStripeTopUp);
          setEnableCreemTopUp(enableCreemTopUp);
          setEnableZsPayTopUp(enableZsPayTopUp);
          setEnableHelipayTopUp(enableHelipayTopUp);
          const enableWaffoTopUp = data.enable_waffo_topup || false;
          setEnableWaffoTopUp(enableWaffoTopUp);
          setWaffoPayMethods(data.waffo_pay_methods || []);
          setWaffoMinTopUp(data.waffo_min_topup || 1);
          setMinTopUp(minTopUpValue);
          setTopUpCount(minTopUpValue);

          // 设置 Creem 产品
          try {
            const products = JSON.parse(data.creem_products || '[]');
            setCreemProducts(products);
          } catch (e) {
            setCreemProducts([]);
          }

          // 如果没有自定义充值数量选项，根据最小充值金额生成预设充值额度选项
          if (topupInfo.amount_options.length === 0) {
            setPresetAmounts(generatePresetAmounts(minTopUpValue));
          }

          // 只有在启用了易支付时才调用 /api/user/amount 接口
          // 招商银行支付有自己的金额计算逻辑，不依赖此接口
          if (enableOnlineTopUp) {
            getAmount(minTopUpValue);
          }
        } catch (e) {
          setPayMethods([]);
        }

        // 如果有自定义充值数量选项，使用它们替换默认的预设选项
        // 注意：自定义充值数量选项的值直接作为当前币元的金额，不需要汇率换算
        if (data.amount_options && data.amount_options.length > 0) {
          const customPresets = data.amount_options.map((amount) => ({
            value: amount,
            discount: data.discount[amount] || 1.0,
            isCustomCurrencyAmount: true, // 标记：此金额已是当前币元，无需汇率换算
          }));
          setPresetAmounts(customPresets);
        }
      } else {
        showError(data || t('获取充值配置失败'));
      }
    } catch (error) {
      showError(t('获取充值配置异常'));
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
    await copy(affLink);
    showSuccess(t('邀请链接已复制到剪切板'));
  };

  // URL 参数自动打开账单弹窗（支付回跳时触发）
  useEffect(() => {
    if (searchParams.get('show_history') === 'true') {
      setOpenHistory(true);
      searchParams.delete('show_history');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  useEffect(() => {
    // 始终获取最新用户数据，确保余额等统计信息准确
    getUserQuota().then();
    setTransferAmount(getQuotaPerUnit());
  }, []);

  useEffect(() => {
    if (affFetchedRef.current) return;
    affFetchedRef.current = true;
    getAffLink().then();
  }, []);

  // 在 statusState 可用时获取充值信息
  useEffect(() => {
    getTopupInfo().then();
    getSubscriptionPlans().then();
    getSubscriptionSelf().then();
  }, []);

  useEffect(() => {
    if (statusState?.status) {
      // const minTopUpValue = statusState.status.min_topup || 1;
      // setMinTopUp(minTopUpValue);
      // setTopUpCount(minTopUpValue);
      setTopUpLink(statusState.status.top_up_link || '');
      setPriceRatio(statusState.status.price || 1);

      setStatusLoading(false);
    }
  }, [statusState?.status]);

  // 组件卸载时清理合利宝轮询
  useEffect(() => {
    return () => {
      if (helipayPollingRef.current) {
        clearInterval(helipayPollingRef.current);
        helipayPollingRef.current = null;
      }
    };
  }, []);

  const renderAmount = () => {
    return amount + ' ' + t('元');
  };

  const getAmount = async (value) => {
    if (value === undefined) {
      value = topUpCount;
    }
    setAmountLoading(true);
    try {
      const res = await API.post('/api/user/amount', {
        amount: parseFloat(value),
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          setAmount(parseFloat(data));
        } else {
          setAmount(0);
          Toast.error({ content: '错误：' + data, id: 'getAmount' });
        }
      } else {
        showError(res);
      }
    } catch (err) {
      // amount fetch failed silently
    }
    setAmountLoading(false);
  };

  const getStripeAmount = async (value) => {
    if (value === undefined) {
      value = topUpCount;
    }
    setAmountLoading(true);
    try {
      const res = await API.post('/api/user/stripe/amount', {
        amount: parseFloat(value),
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          setAmount(parseFloat(data));
        } else {
          setAmount(0);
          Toast.error({ content: '错误：' + data, id: 'getAmount' });
        }
      } else {
        showError(res);
      }
    } catch (err) {
      // amount fetch failed silently
    } finally {
      setAmountLoading(false);
    }
  };

  const handleCancel = () => {
    // 停止合利宝轮询
    if (helipayPollingRef.current) {
      clearInterval(helipayPollingRef.current);
      helipayPollingRef.current = null;
    }
    setHelipayPolling(false);
    setHelipayTradeNo('');
    setOpen(false);
  };

  // 合利宝支付状态轮询
  const startHelipayPolling = (tradeNo) => {
    // 如果已有轮询，先清除
    if (helipayPollingRef.current) {
      clearInterval(helipayPollingRef.current);
    }
    let pollCount = 0;
    const maxPolls = 60; // 最多轮询60次（5分钟）
    helipayPollingRef.current = setInterval(async () => {
      pollCount++;
      try {
        const res = await API.get(`/api/user/helipay/status?order_id=${tradeNo}`);
        if (res.data?.message === 'success') {
          const status = res.data.data?.status;
          if (status === 'PAID') {
            // 支付成功
            clearInterval(helipayPollingRef.current);
            helipayPollingRef.current = null;
            setHelipayPolling(false);
            showSuccess(t('支付成功'));
            // 关闭弹窗
            setOpen(false);
            // 刷新用户配额
            getUserQuota();
          } else if (status === 'FAILED' || status === 'CANCELLED') {
            // 支付失败或取消
            clearInterval(helipayPollingRef.current);
            helipayPollingRef.current = null;
            setHelipayPolling(false);
            showError(status === 'CANCELLED' ? t('支付已取消') : t('支付失败'));
          }
        }
      } catch (e) {
        console.error('轮询支付状态失败:', e);
      }
      // 超时停止轮询
      if (pollCount >= maxPolls) {
        clearInterval(helipayPollingRef.current);
        helipayPollingRef.current = null;
        setHelipayPolling(false);
        showInfo(t('支付查询超时，请稍后手动检查支付状态'));
      }
    }, 5000); // 每5秒轮询一次
  };

  const handleTransferCancel = () => {
    setOpenTransfer(false);
  };

  const handleOpenHistory = () => {
    setOpenHistory(true);
  };

  const handleHistoryCancel = () => {
    setOpenHistory(false);
  };

  const handleCreemCancel = () => {
    setCreemOpen(false);
    setSelectedCreemProduct(null);
  };

  // 选择预设充值额度
  const selectPresetAmount = (preset) => {
    setSelectedPreset(preset.value);

    // 计算实际支付金额，考虑折扣
    const discount = preset.discount || topupInfo.discount[preset.value] || 1.0;
    // 如果是自定义币元金额（管理员直接设置的当前币元充值选项），不进行汇率换算
    const isCustomCurrencyAmount = preset.isCustomCurrencyAmount === true;
    const discountedAmount = isCustomCurrencyAmount
      ? preset.value * discount
      : preset.value * priceRatio * discount;

    // 根据币种计算显示值，确保与预设套餐卡片显示一致
    const { symbol, rate, type } = getCurrencyConfig();
    const statusStr = localStorage.getItem('status');
    let usdRate = 7;
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        usdRate = s?.usd_exchange_rate || 7;
      }
    } catch (e) {}

    let displayValue = preset.value;
    if (!isCustomCurrencyAmount) {
      if (type === 'USD') {
        displayValue = preset.value;
      } else if (type === 'CNY') {
        displayValue = preset.value * usdRate;
      } else if (type === 'CUSTOM') {
        displayValue = preset.value * rate;
      }
    }
    setTopUpCount(displayValue);
    setAmount(discountedAmount);
  };

  // 格式化大数字显示
  const formatLargeNumber = (num) => {
    return num.toString();
  };

  // 根据最小充值金额生成预设充值额度选项
  const generatePresetAmounts = (minAmount) => {
    const multipliers = [1, 5, 10, 30, 50, 100, 300, 500];
    return multipliers.map((multiplier) => ({
      value: minAmount * multiplier,
    }));
  };

  // Tab 状态管理
  const [activeTabKey, setActiveTabKey] = useState('topup');

  return (
    <div className='w-full max-w-7xl mx-auto relative min-h-screen lg:min-h-0 mt-[60px] px-2'>
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

      {/* 充值确认模态框 */}
      <PaymentConfirmModal
        t={t}
        open={open}
        onlineTopUp={onlineTopUp}
        handleCancel={handleCancel}
        confirmLoading={confirmLoading}
        topUpCount={topUpCount}
        renderQuotaWithAmount={renderQuotaWithAmount}
        amountLoading={amountLoading}
        renderAmount={renderAmount}
        payWay={payWay}
        payMethods={payMethods}
        amountNumber={amount}
        discountRate={topupInfo?.discount?.[topUpCount] || 1.0}
        // 充值数量文本框显示的就是全局币种（CNY），不需要再进行汇率转换
        isCustomCurrencyAmount={true}
      />

      {/* 充值账单模态框 */}
      <TopupHistoryModal
        visible={openHistory}
        onCancel={handleHistoryCancel}
        t={t}
      />

      {/* Creem 充值确认模态框 */}
      <Modal
        title={t('确定要充值 $')}
        visible={creemOpen}
        onOk={onlineCreemTopUp}
        onCancel={handleCreemCancel}
        maskClosable={false}
        size='small'
        centered
        confirmLoading={confirmLoading}
      >
        {selectedCreemProduct && (
          <>
            <p>
              {t('产品名称')}：{selectedCreemProduct.name}
            </p>
            <p>
              {t('价格')}：{selectedCreemProduct.currency === 'EUR' ? '€' : '$'}
              {selectedCreemProduct.price}
            </p>
            <p>
              {t('充值额度')}：{selectedCreemProduct.quota}
            </p>
            <p>{t('是否确认充值？')}</p>
          </>
        )}
      </Modal>

      {/* Tab 导航 */}
      <Tabs
        type="card"
        activeKey={activeTabKey}
        onChange={(key) => setActiveTabKey(key)}
      >
        <TabPane
          tab={t('额度充值')}
          itemKey="topup"
        >
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {/* 账户充值 */}
            <div className='lg:col-span-2'>
              <RechargeCard
                t={t}
                enableOnlineTopUp={enableOnlineTopUp}
                enableStripeTopUp={enableStripeTopUp}
                enableCreemTopUp={enableCreemTopUp}
                creemProducts={creemProducts}
                creemPreTopUp={creemPreTopUp}
                enableWaffoTopUp={enableWaffoTopUp}
                waffoTopUp={waffoTopUp}
                waffoPayMethods={waffoPayMethods}
                enableZsPayTopUp={enableZsPayTopUp}
                presetAmounts={presetAmounts}
                selectedPreset={selectedPreset}
                selectPresetAmount={selectPresetAmount}
                formatLargeNumber={formatLargeNumber}
                priceRatio={priceRatio}
                topUpCount={topUpCount}
                minTopUp={minTopUp}
                renderQuotaWithAmount={renderQuotaWithAmount}
                getAmount={getAmount}
                setTopUpCount={setTopUpCount}
                setSelectedPreset={setSelectedPreset}
                renderAmount={renderAmount}
                amountLoading={amountLoading}
                payMethods={payMethods}
                preTopUp={preTopUp}
                paymentLoading={paymentLoading}
                payWay={payWay}
                redemptionCode={redemptionCode}
                setRedemptionCode={setRedemptionCode}
                topUp={topUp}
                isSubmitting={isSubmitting}
                topUpLink={topUpLink}
                openTopUpLink={openTopUpLink}
                userState={userState}
                renderQuota={renderQuota}
                statusLoading={statusLoading}
                topupInfo={topupInfo}
                onOpenHistory={handleOpenHistory}
                onOpenInvitation={() => setShowInvitation(true)}
                enableHelipayTopUp={enableHelipayTopUp}
              />
            </div>
          </div>
        </TabPane>
        <TabPane
          tab={t('额度套餐')}
          itemKey="quotaPlan"
        >
          <QuotaPlanSection
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
            userQuota={userState?.user?.quota || 0}
          />
        </TabPane>
      </Tabs>

      {/* 招商银行聚合支付二维码弹窗 */}
      {showQRCode && (
        <QRCodeModal
          qrCodeUrl={qrCodeData.qrCodeUrl}
          tradeNo={qrCodeData.tradeNo}
          amount={qrCodeData.amount}
          expireAt={qrCodeData.expireAt}
          onSuccess={getUserQuota}
          onRefresh={handleRefreshQRCode}
          onClose={() => setShowQRCode(false)}
        />
      )}
    </div>
  );
};

export default TopUp;
