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

import React, { useEffect, useState } from 'react';
import { Card, Spin, Collapse } from '@douyinfe/semi-ui';
import SettingsGeneralPayment from '../../pages/Setting/Payment/SettingsGeneralPayment';
import SettingsPaymentGateway from '../../pages/Setting/Payment/SettingsPaymentGateway';
import SettingsPaymentGatewayStripe from '../../pages/Setting/Payment/SettingsPaymentGatewayStripe';
import SettingsPaymentGatewayCreem from '../../pages/Setting/Payment/SettingsPaymentGatewayCreem';
import SettingsPaymentGatewayWaffo from '../../pages/Setting/Payment/SettingsPaymentGatewayWaffo';
import SettingsPaymentGatewayZS from '../../pages/Setting/Payment/SettingsPaymentGatewayZS';
import SettingsPaymentGatewayHelipay from '../../pages/Setting/Payment/SettingsPaymentGatewayHelipay';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { API, showError, toBoolean } from '../../helpers';
import { useTranslation } from 'react-i18next';

const PaymentSetting = () => {
  const { t } = useTranslation();
  let [inputs, setInputs] = useState({
    ServerAddress: '',
    PayAddress: '',
    StripeApiSecret: '',
    StripeWebhookSecret: '',
    StripePriceId: '',
    StripeUnitPrice: 8.0,
    StripeMinTopUp: 1,
    StripePromotionCodesEnabled: false,

    CreemApiKey: '',
    CreemWebhookSecret: '',
    CreemProducts: '[]',
    CreemTestMode: false,

    WaffoEnabled: false,
    WaffoApiKey: '',
    WaffoPrivateKey: '',
    WaffoPublicCert: '',
    WaffoSandboxPublicCert: '',
    WaffoSandboxApiKey: '',
    WaffoSandboxPrivateKey: '',
    WaffoSandbox: false,
    WaffoMerchantId: '',
    WaffoCurrency: 'USD',
    WaffoUnitPrice: 1.0,
    WaffoMinTopUp: 1,
    WaffoNotifyUrl: '',
    WaffoReturnUrl: '',
    WaffoPayMethods: '',

    EpayId: '',
    EpayKey: '',
    Price: 7.3,
    MinTopUp: 1,
    TopupGroupRatio: '',
    CustomCallbackAddress: '',
    PayMethods: '',
    AmountOptions: '',
    AmountDiscount: '',

    ZSPayEnabled: false,
    ZSPayMerID: '',
    ZSPayBaseURL: 'https://api.cmburl.cn:8065',
    ZSPayNotifyPath: '/api/user/zs_pay/notify',
    ZSPayPayValidTime: '1800',

    HelipayEnabled: false,
    HelipayTransactionApi: 'https://api.helipay.com/api/v1/trade/preorder',
    HelipayQueryApi: 'https://api.helipay.com/api/v1/trade/query',
    HelipayNotifyPath: '/api/user/helipay/notify',
    HelipayPayValidTime: '1800',
  });

  let [loading, setLoading] = useState(false);
  // 控制各个支付方式的折叠状态（默认全部折叠）
  const [collapsedSections, setCollapsedSections] = useState({
    epay: true,
    stripe: true,
    creem: true,
    waffo: true,
    zs: true,
    helipay: true,
  });

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = { ...inputs }; // 基于现有状态进行更新
      data.forEach((item) => {
        switch (item.key) {
          case 'TopupGroupRatio':
            try {
              newInputs[item.key] = JSON.stringify(
                JSON.parse(item.value),
                null,
                2,
              );
            } catch (error) {
              newInputs[item.key] = item.value;
            }
            break;
          case 'payment_setting.amount_options':
            try {
              newInputs['AmountOptions'] = JSON.stringify(
                JSON.parse(item.value),
                null,
                2,
              );
            } catch (error) {
              newInputs['AmountOptions'] = item.value;
            }
            break;
          case 'payment_setting.amount_discount':
            try {
              newInputs['AmountDiscount'] = JSON.stringify(
                JSON.parse(item.value),
                null,
                2,
              );
            } catch (error) {
              newInputs['AmountDiscount'] = item.value;
            }
            break;
          case 'Price':
          case 'MinTopUp':
          case 'StripeUnitPrice':
          case 'StripeMinTopUp':
          case 'WaffoUnitPrice':
          case 'WaffoMinTopUp':
            newInputs[item.key] = parseFloat(item.value);
            break;
          case 'CreemTestMode':
          case 'WaffoEnabled':
          case 'WaffoSandbox':
            newInputs[item.key] = toBoolean(item.value);
            break;
          case 'zs_payment.Enabled':
            newInputs['ZSPayEnabled'] = toBoolean(item.value);
            break;
          case 'zs_payment.MerID':
            newInputs['ZSPayMerID'] = item.value;
            break;
          case 'zs_payment.BaseURL':
            newInputs['ZSPayBaseURL'] = item.value;
            break;
          case 'zs_payment.NotifyPath':
            newInputs['ZSPayNotifyPath'] = item.value;
            break;
          case 'zs_payment.PayValidTime':
            newInputs['ZSPayPayValidTime'] = item.value;
            break;
          case 'helipay.TransactionApi':
            newInputs['HelipayTransactionApi'] = item.value;
            break;
          case 'helipay.QueryApi':
            newInputs['HelipayQueryApi'] = item.value;
            break;
          case 'helipay.NotifyPath':
            newInputs['HelipayNotifyPath'] = item.value;
            break;
          case 'helipay.PayValidTime':
            newInputs['HelipayPayValidTime'] = item.value;
            break;
          default:
            if (item.key.endsWith('Enabled')) {
              newInputs[item.key] = toBoolean(item.value);
            } else {
              newInputs[item.key] = item.value;
            }
            break;
        }
      });

      setInputs(newInputs);
    } else {
      showError(t(message));
    }
  };

  async function onRefresh() {
    try {
      setLoading(true);
      await getOptions();
    } catch (error) {
      showError(t('刷新失败'));
    } finally {
      setLoading(false);
    }
  }

  // 组件挂载时加载配置
  useEffect(() => {
    onRefresh();
  }, []);

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getSectionIcon = (section) => {
    return collapsedSections[section] ? (
      <ChevronDown size={16} />
    ) : (
      <ChevronUp size={16} />
    );
  };

  return (
    <>
      <Spin spinning={loading} size='large'>
        {/* 通用设置 */}
        <Card style={{ marginTop: '10px' }}>
          <SettingsGeneralPayment options={inputs} refresh={onRefresh} />
        </Card>

        {/* 易支付配置 */}
        <Card style={{ marginTop: '10px' }}>
          <div 
            onClick={() => toggleSection('epay')}
            style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: collapsedSections.epay ? 0 : 16
            }}
          >
            <h4 style={{ margin: 0 }}>
              {t('易支付配置')}
            </h4>
            {getSectionIcon('epay')}
          </div>
          {!collapsedSections.epay && (
            <SettingsPaymentGateway options={inputs} refresh={onRefresh} />
          )}
        </Card>

        {/* 招商银行聚合支付配置 */}
        <Card style={{ marginTop: '10px' }}>
          <div 
            onClick={() => toggleSection('zs')}
            style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: collapsedSections.zs ? 0 : 16
            }}
          >
            <h4 style={{ margin: 0 }}>
              {t('招商银行聚合支付配置')}
            </h4>
            {getSectionIcon('zs')}
          </div>
          {!collapsedSections.zs && (
            <SettingsPaymentGatewayZS options={inputs} refresh={onRefresh} />
          )}
        </Card>

        {/* 合利宝支付配置 */}
        <Card style={{ marginTop: '10px' }}>
          <div 
            onClick={() => toggleSection('helipay')}
            style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: collapsedSections.helipay ? 0 : 16
            }}
          >
            <h4 style={{ margin: 0 }}>
              {t('合利宝支付配置')}
            </h4>
            {getSectionIcon('helipay')}
          </div>
          {!collapsedSections.helipay && (
            <SettingsPaymentGatewayHelipay options={inputs} refresh={onRefresh} />
          )}
        </Card>

        {/* Stripe 配置 */}
        <Card style={{ marginTop: '10px' }}>
          <div 
            onClick={() => toggleSection('stripe')}
            style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: collapsedSections.stripe ? 0 : 16
            }}
          >
            <h4 style={{ margin: 0 }}>
              {t('Stripe 配置')}
            </h4>
            {getSectionIcon('stripe')}
          </div>
          {!collapsedSections.stripe && (
            <SettingsPaymentGatewayStripe options={inputs} refresh={onRefresh} />
          )}
        </Card>

        {/* Creem 配置 */}
        <Card style={{ marginTop: '10px' }}>
          <div 
            onClick={() => toggleSection('creem')}
            style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: collapsedSections.creem ? 0 : 16
            }}
          >
            <h4 style={{ margin: 0 }}>
              {t('Creem 配置')}
            </h4>
            {getSectionIcon('creem')}
          </div>
          {!collapsedSections.creem && (
            <SettingsPaymentGatewayCreem options={inputs} refresh={onRefresh} />
          )}
        </Card>

        {/* Waffo 配置 */}
        <Card style={{ marginTop: '10px' }}>
          <div 
            onClick={() => toggleSection('waffo')}
            style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: collapsedSections.waffo ? 0 : 16
            }}
          >
            <h4 style={{ margin: 0 }}>
              {t('Waffo 配置')}
            </h4>
            {getSectionIcon('waffo')}
          </div>
          {!collapsedSections.waffo && (
            <SettingsPaymentGatewayWaffo options={inputs} refresh={onRefresh} />
          )}
        </Card>
      </Spin>
    </>
  );
};

export default PaymentSetting;
