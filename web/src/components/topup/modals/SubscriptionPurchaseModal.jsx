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

import React from 'react';
import {
  Banner,
  Modal,
  Typography,
  Card,
  Button,
  Select,
  Divider,
  Tooltip,
} from '@douyinfe/semi-ui';
import { Crown, CalendarClock, Package } from 'lucide-react';
import { SiStripe } from 'react-icons/si';
import { IconCreditCard } from '@douyinfe/semi-icons';
import { renderQuota, getQuotaPerUnit } from '../../../helpers';
import { getCurrencyConfig } from '../../../helpers/render';
import {
  formatSubscriptionDuration,
  formatSubscriptionResetPeriod,
} from '../../../helpers/subscriptionFormat';
import i18next from 'i18next';

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

const SubscriptionPurchaseModal = ({
  t,
  visible,
  onCancel,
  selectedPlan,
  paying,
  selectedEpayMethod,
  setSelectedEpayMethod,
  epayMethods = [],
  enableOnlineTopUp = false,
  enableStripeTopUp = false,
  enableCreemTopUp = false,
  purchaseLimitInfo = null,
  onPayStripe,
  onPayCreem,
  onPayEpay,
  onPayWallet,
  userQuota = 0,
}) => {
  const plan = selectedPlan?.plan;
  const totalAmount = Number(plan?.total_amount || 0);
  const { symbol, rate } = getCurrencyConfig();
  const price = plan ? Number(plan.price_amount || 0) : 0;
  
  // 计算实得价值（将额度转换为美元价值）
  const quotaPerUnit = getQuotaPerUnit();
  const actualValueUSD = quotaPerUnit > 0 ? totalAmount / quotaPerUnit : 0;
  const actualValueDisplay = actualValueUSD > 0
    ? `${symbol}${(actualValueUSD * rate).toFixed(2)}`
    : t('不限');
  const convertedPrice = price * rate;
  const displayPrice = convertedPrice.toFixed(
    Number.isInteger(convertedPrice) ? 0 : 2,
  );
  // 只有当管理员开启支付网关 AND 套餐配置了对应的支付ID时才显示
  const hasStripe = enableStripeTopUp && !!plan?.stripe_price_id;
  const hasCreem = enableCreemTopUp && !!plan?.creem_product_id;
  // 易支付
  const hasEpay = enableOnlineTopUp && epayMethods.length > 0;
  // 钱包支付始终可用（余额足够时）
  const hasWallet = true;
  const hasAnyPayment = hasStripe || hasCreem || hasEpay || hasWallet;
  const purchaseLimit = Number(purchaseLimitInfo?.limit || 0);
  const purchaseCount = Number(purchaseLimitInfo?.count || 0);
  const purchaseLimitReached =
    purchaseLimit > 0 && purchaseCount >= purchaseLimit;

  return (
    <Modal
      title={
        <div className='flex items-center'>
          <Crown className='mr-2' size={18} />
          {t('购买订阅套餐')}
        </div>
      }
      visible={visible}
      onCancel={onCancel}
      footer={null}
      size='small'
      centered
    >
      {plan ? (
        <div className='space-y-4 pb-10'>
          {/* 套餐信息 */}
          <Card className='!rounded-xl !border-0 bg-slate-50 dark:bg-slate-800'>
            <div className='space-y-3'>
              <div className='flex justify-between items-center'>
                <Text strong className='text-slate-700 dark:text-slate-200'>
                  {t('套餐名称')}：
                </Text>
                <Typography.Text
                  ellipsis={{ rows: 1, showTooltip: true }}
                  className='text-slate-900 dark:text-slate-100'
                  style={{ maxWidth: 200 }}
                >
                  {plan.title}
                </Typography.Text>
              </div>
              <div className='flex justify-between items-center'>
                <Text strong className='text-slate-700 dark:text-slate-200'>
                  {t('有效期')}：
                </Text>
                <div className='flex items-center'>
                  <CalendarClock size={14} className='mr-1 text-slate-500' />
                  <Text className='text-slate-900 dark:text-slate-100'>
                    {formatSubscriptionDuration(plan, t)}
                  </Text>
                </div>
              </div>
              {formatSubscriptionResetPeriod(plan, t) !== t('不重置') && (
                <div className='flex justify-between items-center'>
                  <Text strong className='text-slate-700 dark:text-slate-200'>
                    {t('重置周期')}：
                  </Text>
                  <Text className='text-slate-900 dark:text-slate-100'>
                    {formatSubscriptionResetPeriod(plan, t)}
                  </Text>
                </div>
              )}
              <div className='flex justify-between items-center'>
                <Text strong className='text-slate-700 dark:text-slate-200'>
                  {t('实得价值')}：
                </Text>
                <div className='flex items-center'>
                  <Package size={14} className='mr-1 text-slate-500' />
                  {totalAmount > 0 ? (
                    <Tooltip content={`${t('原生额度')}：${totalAmount}`}>
                      <Text className='text-slate-900 dark:text-slate-100'>
                        {actualValueDisplay}
                      </Text>
                    </Tooltip>
                  ) : (
                    <Text className='text-slate-900 dark:text-slate-100'>
                      {t('不限')}
                    </Text>
                  )}
                </div>
                {values.plan?.plan_type === 'tokens' && plan?.applicable_models ? (
                  <div className='flex justify-between items-center'>
                    <Text strong className='text-slate-700 dark:text-slate-200'>
                      {t('模型')}：
                    </Text>
                    <Tooltip content={plan.applicable_models}>
                      <Text className='text-slate-900 dark:text-slate-100 max-w-[200px] truncate'>
                        {plan.applicable_models}
                      </Text>
                    </Tooltip>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <div className='flex justify-between items-center'>
                  <Text strong className='text-slate-700 dark:text-slate-200'>
                    {t('实得价值')}：
                  </Text>
                  <div className='flex items-center'>
                    <Package size={14} className='mr-1 text-slate-500' />
                    {totalAmount > 0 ? (
                      <Tooltip content={`${t('原生额度')}：${totalAmount}`}>
                        <Text className='text-slate-900 dark:text-slate-100'>
                          {actualValueDisplay}
                        </Text>
                      </Tooltip>
                    ) : (
                      <Text className='text-slate-900 dark:text-slate-100'>
                        {t('不限')}
                      </Text>
                    )}
                  </div>
                </div>
                {plan?.upgrade_group ? (
                  <div className='flex justify-between items-center'>
                    <Text strong className='text-slate-700 dark:text-slate-200'>
                      {t('升级分组')}：
                    </Text>
                    <Text className='text-slate-900 dark:text-slate-100'>
                      {plan.upgrade_group}
                    </Text>
                  </div>
                ) : null}
              </>
            )}
            <Divider margin={8} />
              <div className='flex justify-between items-center'>
                <Text strong className='text-slate-700 dark:text-slate-200'>
                  {t('应付金额')}：
                </Text>
                <Text strong className='text-xl text-purple-600'>
                  {symbol}
                  {displayPrice}
                </Text>
              </div>
            </div>
          </Card>

          {/* 支付方式 */}
          {purchaseLimitReached && (
            <Banner
              type='warning'
              description={`${t('已达到购买上限')} (${purchaseCount}/${purchaseLimit})`}
              className='!rounded-xl'
              closeIcon={null}
            />
          )}

          {hasAnyPayment ? (
            <div className='space-y-3'>
              <Text size='small' type='tertiary'>
                {t('选择支付方式')}：
              </Text>

              {/* Stripe / Creem */}
              {(hasStripe || hasCreem) && (
                <div className='flex gap-2'>
                  {hasStripe && (
                    <Button
                      theme='light'
                      className='flex-1'
                      icon={<SiStripe size={14} color='#635BFF' />}
                      onClick={onPayStripe}
                      loading={paying}
                      disabled={purchaseLimitReached}
                    >
                      Stripe
                    </Button>
                  )}
                  {hasCreem && (
                    <Button
                      theme='light'
                      className='flex-1'
                      icon={<IconCreditCard />}
                      onClick={onPayCreem}
                      loading={paying}
                      disabled={purchaseLimitReached}
                    >
                      Creem
                    </Button>
                  )}
                </div>
              )}

              {/* 易支付 */}
              {hasEpay && (
                <div className='flex gap-2'>
                  <Select
                    value={selectedEpayMethod}
                    onChange={setSelectedEpayMethod}
                    style={{ flex: 1 }}
                    size='default'
                    placeholder={t('选择支付方式')}
                    optionList={epayMethods.map((m) => ({
                      value: m.type,
                      label: m.name || m.type,
                    }))}
                    disabled={purchaseLimitReached}
                  />
                  <Button
                    theme='solid'
                    type='primary'
                    onClick={onPayEpay}
                    loading={paying}
                    disabled={!selectedEpayMethod || purchaseLimitReached}
                  >
                    {t('支付')}
                  </Button>
                </div>
              )}

              {/* 钱包余额支付 */}
              {hasWallet && (
                <Button
                  theme='solid'
                  type='primary'
                  className='w-full'
                  onClick={onPayWallet}
                  loading={paying}
                  disabled={purchaseLimitReached}
                >
                  {t('钱包余额支付')} ({t('当前余额')}: {renderQuota(userQuota)})
                </Button>
              )}
            </div>
          ) : (
            <Banner
              type='info'
              description={t('管理员未开启在线支付功能，请联系管理员配置。')}
              className='!rounded-xl'
              closeIcon={null}
            />
          )}
        </div>
      ) : null}
    </Modal>
  );
};

export default SubscriptionPurchaseModal;
