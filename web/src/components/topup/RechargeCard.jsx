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

import React, { useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Typography,
  Tag,
  Card,
  Button,
  Banner,
  Skeleton,
  Form,
  Input,
  Space,
  Row,
  Col,
  Spin,
  Tooltip,
} from '@douyinfe/semi-ui';
import { SiAlipay, SiWechat, SiStripe } from 'react-icons/si';
import {
  CreditCard,
  Coins,
  Wallet,
  BarChart2,
  TrendingUp,
  Receipt,
  Gift,
} from 'lucide-react';
import { IconGift } from '@douyinfe/semi-icons';
import { useMinimumLoadingTime } from '../../hooks/common/useMinimumLoadingTime';
import { getCurrencyConfig } from '../../helpers/render';

const { Text } = Typography;

const RechargeCard = ({
  t,
  enableOnlineTopUp,
  enableStripeTopUp,
  enableCreemTopUp,
  creemProducts,
  creemPreTopUp,
  presetAmounts,
  selectedPreset,
  selectPresetAmount,
  formatLargeNumber,
  priceRatio,
  topUpCount,
  minTopUp,
  renderQuotaWithAmount,
  getAmount,
  setTopUpCount,
  setSelectedPreset,
  renderAmount,
  amountLoading,
  payMethods,
  preTopUp,
  paymentLoading,
  payWay,
  redemptionCode,
  setRedemptionCode,
  topUp,
  isSubmitting,
  topUpLink,
  openTopUpLink,
  userState,
  renderQuota,
  statusLoading,
  topupInfo,
  onOpenHistory,
  onOpenInvitation,
  enableWaffoTopUp,
  waffoTopUp,
  waffoPayMethods,
  enableZsPayTopUp,
  enableHelipayTopUp,
}) => {
  const onlineFormApiRef = useRef(null);
  const redeemFormApiRef = useRef(null);
  const showAmountSkeleton = useMinimumLoadingTime(amountLoading);
  const [isTopUpInputFocused, setIsTopUpInputFocused] = useState(false);

  // 判断是否只启用了招行支付（是的话隐藏充值数量输入和支付方式选择）
  const onlyZsPayEnabled = enableZsPayTopUp && !enableOnlineTopUp && !enableStripeTopUp && !enableWaffoTopUp && !enableHelipayTopUp;

  // 根据币种获取对应的充值套餐
  const getZSPayPresetAmounts = () => {
    const statusStr = localStorage.getItem('status');
    let usdRate = 7;
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        usdRate = s?.usd_exchange_rate || 7;
      }
    } catch (e) {}

    const { type, symbol } = getCurrencyConfig();
    
    // 优先使用 topupInfo 中的自定义充值数量选项和折扣配置
    // 注意：自定义充值数量选项的值直接作为当前币元的金额，不需要汇率换算
    if (topupInfo && topupInfo.amount_options && topupInfo.amount_options.length > 0) {
      // 使用自定义充值数量选项，添加标记表示这些金额已是当前币元
      return topupInfo.amount_options.map((amount) => ({
        value: amount,
        discount: topupInfo.discount?.[amount] || 1.0,
        isCustomCurrencyAmount: true,
      }));
    }
    
    // 根据币种返回不同的套餐金额
    if (type === 'USD') {
      // 美元：100, 500, 1000, 5000
      return [100, 500, 1000, 5000].map(amount => ({
        value: amount,
        discount: 1.0
      }));
    } else if (type === 'CNY') {
      // 人民币：100, 500, 1000, 5000
      return [100, 500, 1000, 5000].map(amount => ({
        value: amount,
        discount: 1.0
      }));
    } else {
      // 自定义货币：使用人民币套餐并换算
      return [100, 500, 1000, 5000].map(amount => ({
        value: Math.round(amount * usdRate),
        discount: 1.0
      }));
    }
  };

  const topupContent = (
    <Space vertical style={{ width: '100%' }}>
      {/* 统计数据 */}
      <Card
        className='!rounded-xl w-full'
        cover={
          <div
            className='relative h-30'
            style={{
              '--palette-primary-darkerChannel': '37 99 235',
              backgroundImage: `linear-gradient(0deg, rgba(var(--palette-primary-darkerChannel) / 80%), rgba(var(--palette-primary-darkerChannel) / 80%)), url('/cover-4.webp')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          >
            <div className='relative z-10 h-full flex flex-col justify-between p-4'>
              <div className='flex justify-between items-center'>
                <Text strong style={{ color: 'white', fontSize: '16px' }}>
                  {t('账户统计')}
                </Text>
              </div>

              {/* 统计数据 */}
              <div className='grid grid-cols-3 gap-6 mt-4'>
                {/* 当前余额 */}
                <div className='text-center'>
                  <div
                    className='text-base sm:text-2xl font-bold mb-2'
                    style={{ color: 'white' }}
                  >
                    {renderQuota(userState?.user?.quota)}
                  </div>
                  <div className='flex items-center justify-center text-sm'>
                    <Wallet
                      size={14}
                      className='mr-1'
                      style={{ color: 'rgba(255,255,255,0.8)' }}
                    />
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: '12px',
                      }}
                    >
                      {t('当前余额')}
                    </Text>
                  </div>
                </div>

                {/* 历史消耗 */}
                <div className='text-center'>
                  <div
                    className='text-base sm:text-2xl font-bold mb-2'
                    style={{ color: 'white' }}
                  >
                    {renderQuota(userState?.user?.used_quota)}
                  </div>
                  <div className='flex items-center justify-center text-sm'>
                    <TrendingUp
                      size={14}
                      className='mr-1'
                      style={{ color: 'rgba(255,255,255,0.8)' }}
                    />
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: '12px',
                      }}
                    >
                      {t('历史消耗')}
                    </Text>
                  </div>
                </div>

                {/* 请求次数 */}
                <div className='text-center'>
                  <div
                    className='text-base sm:text-2xl font-bold mb-2'
                    style={{ color: 'white' }}
                  >
                    {userState?.user?.request_count || 0}
                  </div>
                  <div className='flex items-center justify-center text-sm'>
                    <BarChart2
                      size={14}
                      className='mr-1'
                      style={{ color: 'rgba(255,255,255,0.8)' }}
                    />
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: '12px',
                      }}
                    >
                      {t('请求次数')}
                    </Text>
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
      >
        {/* 在线充值表单 */}
        {statusLoading ? (
          <div className='py-8 flex justify-center'>
            <Spin size='large' />
          </div>
        ) : (enableOnlineTopUp || enableStripeTopUp || enableCreemTopUp || enableWaffoTopUp || enableZsPayTopUp || enableHelipayTopUp) ? (
          <Form
            getFormApi={(api) => (onlineFormApiRef.current = api)}
            initValues={{ topUpCount: topUpCount }}
          >
            <div className='space-y-6'>
              {/* 充值数量输入框 - 在启用任何充值方式时显示 */}
              {(enableOnlineTopUp || enableStripeTopUp || enableWaffoTopUp || enableZsPayTopUp || enableHelipayTopUp) && (
                <Row gutter={12}>
                  <Col xs={24} sm={24} md={24} lg={10} xl={10}>
                    <Form.Slot
                      label={t('充值数量')}
                    >
                      <Input
                        disabled={!enableOnlineTopUp && !enableStripeTopUp && !enableWaffoTopUp && !enableZsPayTopUp && !enableHelipayTopUp}
                        placeholder={
                          t('充值数量，最低 ') + renderQuotaWithAmount(minTopUp, true)
                        }
                        value={topUpCount?.toString() || ''}
                        onFocus={() => setIsTopUpInputFocused(true)}
                        onBlur={() => setIsTopUpInputFocused(false)}
                        onChange={(value) => {
                          // 允许空字符串（用户删除所有字符）
                          if (value === '' || value === '-' || value === '.') {
                            setTopUpCount(0);
                            setSelectedPreset(null);
                            return;
                          }
                          const numValue = parseInt(value);
                          // 允许有效数字或 0
                          if (!isNaN(numValue) && numValue >= 0) {
                            setTopUpCount(numValue);
                            setSelectedPreset(null);
                            // 只有易支付和 Stripe 才需要调用后端 API 获取金额
                            // 招行支付、合利宝等使用本地计算
                            if (enableOnlineTopUp || enableStripeTopUp) {
                              getAmount(numValue);
                            }
                          }
                        }}
                        style={{ width: '100%' }}
                      />
                    </Form.Slot>
                  </Col>
                  {/* 当只启用招行支付时，隐藏支付方式选择 */}
                  {!onlyZsPayEnabled && (enableOnlineTopUp || enableStripeTopUp) && payMethods && payMethods.filter(m => m.type !== 'waffo' && m.type !== 'zs_pay').length > 0 && (
                  <Col xs={24} sm={24} md={24} lg={14} xl={14}>
                    <Form.Slot label={t('选择支付方式')}>
                        <Space wrap>
                          {payMethods.filter(m => m.type !== 'waffo' && m.type !== 'zs_pay').map((payMethod) => {
                            const minTopupVal = Number(payMethod.min_topup) || 0;
                            const isStripe = payMethod.type === 'stripe';
                            // 确保只有启用了的支付方式才可以点击
                            const isEnabled = (isStripe && enableStripeTopUp) || (!isStripe && enableOnlineTopUp);
                            const disabled =
                              !isEnabled ||
                              minTopupVal > Number(topUpCount || 0);

                            const buttonEl = (
                              <Button
                                key={payMethod.type}
                                theme='outline'
                                type='tertiary'
                                onClick={() => preTopUp(payMethod.type)}
                                disabled={disabled}
                                loading={
                                  paymentLoading && payWay === payMethod.type
                                }
                                icon={
                                  payMethod.type === 'alipay' ? (
                                    <SiAlipay size={18} color='#1677FF' />
                                  ) : payMethod.type === 'wxpay' ? (
                                    <SiWechat size={18} color='#07C160' />
                                  ) : payMethod.type === 'stripe' ? (
                                    <SiStripe size={18} color='#635BFF' />
                                  ) : (
                                    <CreditCard
                                      size={18}
                                      color={
                                        payMethod.color ||
                                        'var(--semi-color-text-2)'
                                      }
                                    />
                                  )
                                }
                                className='!rounded-lg !px-4 !py-2'
                              >
                                {payMethod.name}
                              </Button>
                            );

                            return disabled &&
                              minTopupVal > Number(topUpCount || 0) ? (
                              <Tooltip
                                content={
                                  t('此支付方式最低充值金额为') +
                                  ' ' +
                                  minTopupVal
                                }
                                key={payMethod.type}
                              >
                                {buttonEl}
                              </Tooltip>
                            ) : (
                              <React.Fragment key={payMethod.type}>
                                {buttonEl}
                              </React.Fragment>
                            );
                          })}
                        </Space>
                    </Form.Slot>
                  </Col>
                  )}
                </Row>
              )}

              {/* 充值套餐区域 - 所有支付方式都显示 */}
              {(enableOnlineTopUp || enableStripeTopUp || enableWaffoTopUp || enableZsPayTopUp || enableHelipayTopUp) && (
                <Form.Slot
                  label={
                    <div className='flex items-center gap-2'>
                      <span>{t('选择充值额度')}</span>
                    </div>
                  }
                >
                  <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2'>
                    {/* 当只启用招行支付时，使用根据币种计算的套餐 */}
                    {(onlyZsPayEnabled ? getZSPayPresetAmounts() : presetAmounts).map((preset, index) => {
                      const discount =
                        preset.discount || topupInfo?.discount?.[preset.value] || 1.0;

                      // 如果标记为自定义币元金额（管理员直接设置的当前币元充值选项），则不进行汇率换算
                      const isCustomCurrencyAmount = preset.isCustomCurrencyAmount === true;

                      // 计算原价和折后价：自定义币元金额直接使用 preset.value，默认选项需要乘以 priceRatio
                      const originalPrice = isCustomCurrencyAmount ? preset.value : preset.value * priceRatio;
                      const discountedPrice = originalPrice * discount;
                      const hasDiscount = discount < 1.0;
                      const actualPay = discountedPrice;
                      const save = originalPrice - discountedPrice;

                      // 根据当前货币类型换算显示金额和数量
                      const { symbol, rate, type } = getCurrencyConfig();
                      const statusStr = localStorage.getItem('status');
                      let usdRate = 7; // 默认CNY汇率
                      try {
                        if (statusStr) {
                          const s = JSON.parse(statusStr);
                          usdRate = s?.usd_exchange_rate || 7;
                        }
                      } catch (e) { }

                      let displayValue = preset.value; // 显示的数量
                      let displayActualPay = actualPay;
                      let displaySave = save;

                      if (!isCustomCurrencyAmount) {
                        // 默认预设选项：需要进行汇率换算
                        // 充值套餐金额保持美元计价，显示时根据全局币种换算
                        if (type === 'USD') {
                          // 美元：直接显示原值
                          displayValue = preset.value;
                        } else if (type === 'CNY') {
                          // 人民币：乘以汇率换算
                          displayValue = preset.value * usdRate;
                          displayActualPay = actualPay * usdRate;
                          displaySave = save * usdRate;
                        } else if (type === 'CUSTOM') {
                          // 自定义货币：乘以汇率换算
                          displayValue = preset.value * rate;
                          displayActualPay = actualPay * rate;
                          displaySave = save * rate;
                        }
                      }
                      // isCustomCurrencyAmount 为 true 时，displayValue/displayActualPay/displaySave 保持原值不变

                      return (
                        <Card
                          key={index}
                          style={{
                            cursor: 'pointer',
                            border:
                              selectedPreset === preset.value
                                ? '2px solid var(--semi-color-primary)'
                                : '1px solid var(--semi-color-border)',
                            height: '100%',
                            width: '100%',
                          }}
                          bodyStyle={{ padding: '12px' }}
                          onClick={() => {
                            // 如果充值数量文本框聚焦中，点击套餐应该取消选择而不是填充金额
                            if (isTopUpInputFocused) {
                              setSelectedPreset(null);
                              return;
                            }
                            // 如果点击已选中的套餐，则取消选择
                            if (selectedPreset === preset.value) {
                              setSelectedPreset(null);
                              setTopUpCount(0);
                            } else {
                              // selectPresetAmount 内部已经处理了 setTopUpCount，无需重复调用
                              selectPresetAmount(preset);
                            }
                          }}
                        >
                          <div style={{ textAlign: 'center' }}>
                            <Typography.Title
                              heading={6}
                              style={{ margin: '0 0 8px 0' }}
                            >
                              <Coins size={18} />
                              {formatLargeNumber(displayValue)} {symbol}
                              {hasDiscount && (
                                <Tag style={{ marginLeft: 4 }} color='green'>
                                  {t('折').includes('off')
                                    ? ((1 - parseFloat(discount)) * 100).toFixed(1)
                                    : (discount * 10).toFixed(1)}
                                  {t('折')}
                                </Tag>
                              )}
                            </Typography.Title>
                            <div
                              style={{
                                color: 'var(--semi-color-text-2)',
                                fontSize: '12px',
                                margin: '4px 0',
                              }}
                            >
                              {t('实付')} {symbol}
                              {displayActualPay.toFixed(2)}，
                              {hasDiscount
                                ? `${t('节省')} ${symbol}${displaySave.toFixed(2)}`
                                : `${t('节省')} ${symbol}0.00`}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </Form.Slot>
              )}

              {/* Waffo 充值区域 */}
              {enableWaffoTopUp &&
                waffoPayMethods &&
                waffoPayMethods.length > 0 && (
                  <Form.Slot label={t('Waffo 充值')}>
                    <Space wrap>
                      {waffoPayMethods.map((method, index) => (
                        <Button
                          key={index}
                          theme='outline'
                          type='tertiary'
                          onClick={() => waffoTopUp(index)}
                          loading={paymentLoading}
                          icon={
                            method.icon ? (
                              <img
                                src={method.icon}
                                alt={method.name}
                                style={{
                                  width: 36,
                                  height: 36,
                                  objectFit: 'contain',
                                }}
                              />
                            ) : (
                              <CreditCard
                                size={18}
                                color='var(--semi-color-text-2)'
                              />
                            )
                          }
                          className='!rounded-lg !px-4 !py-2'
                        >
                          {method.name}
                        </Button>
                      ))}
                    </Space>
                  </Form.Slot>
                )}

              {/* Creem 充值区域 */}
              {enableCreemTopUp && creemProducts.length > 0 && (
                <Form.Slot label={t('Creem 充值')}>
                  <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
                    {creemProducts.map((product, index) => (
                      <Card
                        key={index}
                        onClick={() => creemPreTopUp(product)}
                        className='cursor-pointer !rounded-2xl transition-all hover:shadow-md border-gray-200 hover:border-gray-300'
                        bodyStyle={{ textAlign: 'center', padding: '16px' }}
                      >
                        <div className='font-medium text-lg mb-2'>
                          {product.name}
                        </div>
                        <div className='text-sm text-gray-600 mb-2'>
                          {t('充值额度')}: {product.quota}
                        </div>
                        <div className='text-lg font-semibold text-blue-600'>
                          {product.currency === 'EUR' ? '€' : '$'}
                          {product.price}
                        </div>
                      </Card>
                    ))}
                  </div>
                </Form.Slot>
              )}

              {/* 招商银行聚合支付区域 - 当只启用招行支付且未选择套餐时隐藏 */}
              {enableZsPayTopUp && !(onlyZsPayEnabled && !selectedPreset) && (
                <Form.Slot label={t('招商银行聚合支付')}>
                  <div className='flex items-center gap-3'>
                    <Button
                      theme='solid'
                      type='danger'
                      onClick={() => preTopUp('zs_pay')}
                      loading={paymentLoading && payWay === 'zs_pay'}
                      icon={<CreditCard size={18} color='white' />}
                      className='!rounded-lg !px-6 !py-2'
                    >
                      {t('立即支付')}
                    </Button>
                    <Text type='tertiary' style={{ fontSize: '12px' }}>
                      {t('支持支付宝、微信、银联扫码支付')}
                    </Text>
                  </div>
                </Form.Slot>
              )}

              {/* 合利宝支付区域 */}
              {enableHelipayTopUp && (
                <Form.Slot label={t('合利宝支付')}>
                  <div className='flex items-center gap-3'>
                    <Button
                      theme='solid'
                      type='danger'
                      onClick={() => preTopUp('helipay')}
                      loading={paymentLoading && payWay === 'helipay'}
                      icon={<CreditCard size={18} color='white' />}
                      className='!rounded-lg !px-6 !py-2'
                    >
                      {t('立即支付')}
                    </Button>
                    <Text type='tertiary' style={{ fontSize: '12px' }}>
                      {t('支持多种支付方式')}
                    </Text>
                  </div>
                </Form.Slot>
              )}
            </div>
          </Form>
        ) : (
          <Banner
            type='info'
            description={t(
              '管理员未开启在线充值功能，请联系管理员开启或使用兑换码充值。',
            )}
            className='!rounded-xl'
            closeIcon={null}
          />
        )}
      </Card>

      {/* 兑换码充值 */}
      <Card
        className='!rounded-xl w-full'
        title={
          <Text type='tertiary' strong>
            {t('兑换码充值')}
          </Text>
        }
      >
        <Form
          getFormApi={(api) => (redeemFormApiRef.current = api)}
          initValues={{ redemptionCode: redemptionCode }}
        >
          <Form.Input
            field='redemptionCode'
            noLabel={true}
            placeholder={t('请输入兑换码')}
            value={redemptionCode}
            onChange={(value) => setRedemptionCode(value)}
            prefix={<IconGift />}
            suffix={
              <div className='flex items-center gap-2'>
                <Button
                  type='primary'
                  theme='solid'
                  onClick={topUp}
                  loading={isSubmitting}
                >
                  {t('兑换额度')}
                </Button>
              </div>
            }
            showClear
            style={{ width: '100%' }}
            extraText={
              topUpLink && (
                <Text type='tertiary'>
                  {t('在找兑换码？')}
                  <Text
                    type='secondary'
                    underline
                    className='cursor-pointer'
                    onClick={openTopUpLink}
                  >
                    {t('购买兑换码')}
                  </Text>
                </Text>
              )
            }
          />
        </Form>
      </Card>
    </Space>
  );

  return (
    <Card className='!rounded-2xl shadow-sm border-0'>
      {/* 卡片头部 */}
      <div className='flex items-center justify-between mb-4'>
        <div className='flex items-center'>
          <Avatar size='small' color='blue' className='mr-3 shadow-md'>
            <CreditCard size={16} />
          </Avatar>
          <div>
            <Typography.Text className='text-lg font-medium'>
              {t('账户充值')}
            </Typography.Text>
            <div className='text-xs'>{t('多种充值方式，安全便捷')}</div>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          {onOpenInvitation && (
            <Tooltip content={t('邀请奖励')}>
              <button
                onClick={onOpenInvitation}
                className='p-2 rounded-full hover:bg-green-50 transition-colors'
              >
                <Gift className='w-5 h-5 text-green-500' />
              </button>
            </Tooltip>
          )}
          <Button
            icon={<Receipt size={16} />}
            theme='solid'
            onClick={onOpenHistory}
          >
            {t('充值账单')}
          </Button>
        </div>
      </div>

      {topupContent}
    </Card>
  );
};

export default RechargeCard;
