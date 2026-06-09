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

import SubscriptionPlansCard from '../../components/topup/SubscriptionPlansCard';
import TransferModal from '../../components/topup/modals/TransferModal';
import PaymentConfirmModal from '../../components/topup/modals/PaymentConfirmModal';
import QRCodeModal from '../../components/topup/QRCodeModal';
import TopupHistoryModal from '../../components/topup/modals/TopupHistoryModal';
import InvitationPanel from '../../components/topup/InvitationPanel';

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

        {/* 订阅套餐卡片 - 跨两列占据全部宽度 */}
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
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyPlan;