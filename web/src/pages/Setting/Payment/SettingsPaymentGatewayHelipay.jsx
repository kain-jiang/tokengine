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

import React, { useEffect, useState, useRef } from 'react';
import {
  Banner,
  Button,
  Form,
  Row,
  Col,
  Typography,
  Spin,
} from '@douyinfe/semi-ui';
const { Text } = Typography;
import {
  API,
  showError,
  showSuccess,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsPaymentGatewayHelipay(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    HelipayEnabled: false,
    HelipayMerchantId: '',
    HelipayNotifyPath: '/api/user/helipay/notify',
    HelipayPayValidTime: '1800',
    HelipayTransactionApi: 'https://api.helipay.com/api/v1/trade/preorder',
    HelipayQueryApi: 'https://api.helipay.com/api/v1/trade/query',
  });
  const [originInputs, setOriginInputs] = useState({});
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        HelipayEnabled: props.options['HelipayEnabled'] || props.options['helipay.Enabled'] === 'true' || props.options['helipay.Enabled'] === true,
        HelipayMerchantId: props.options['HelipayMerchantId'] || props.options['helipay.CustomerNumber'] || '',
        HelipayTransactionApi: props.options['HelipayTransactionApi'] || props.options['helipay.TransactionApi'] || 'https://api.helipay.com/api/v1/trade/preorder',
        HelipayQueryApi: props.options['HelipayQueryApi'] || props.options['helipay.QueryApi'] || 'https://api.helipay.com/api/v1/trade/query',
        HelipayNotifyPath: props.options['HelipayNotifyPath'] || props.options['helipay.NotifyPath'] || '/api/user/helipay/notify',
        HelipayPayValidTime: props.options['HelipayPayValidTime'] || props.options['helipay.PayValidTime'] || '1800',
      };
      setInputs(currentInputs);
      setOriginInputs({ ...currentInputs });
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(prev => ({ ...prev, ...values }));
  };

  const submitHelipaySetting = async () => {
    let formValues = {};
    if (formApiRef.current) {
      formValues = formApiRef.current.getValues() || {};
    }

    const finalInputs = { ...inputs, ...formValues };

    const serverAddress = props.options?.ServerAddress || '';
    if (serverAddress && serverAddress.trim() === '') {
      showError(t('请先填写服务器地址'));
      return;
    }

    setLoading(true);
    try {
      const options = [];

      options.push({
        key: 'helipay.Enabled',
        value: (finalInputs.HelipayEnabled || inputs.HelipayEnabled || false) ? 'true' : 'false',
      });

      const transactionApi = finalInputs.HelipayTransactionApi || inputs.HelipayTransactionApi || '';
      if (transactionApi !== '') {
        options.push({ key: 'helipay.TransactionApi', value: transactionApi });
      }

      const queryApi = finalInputs.HelipayQueryApi || inputs.HelipayQueryApi || '';
      if (queryApi !== '') {
        options.push({ key: 'helipay.QueryApi', value: queryApi });
      }

      const notifyPath = finalInputs.HelipayNotifyPath || inputs.HelipayNotifyPath || '';
      if (notifyPath && notifyPath !== '') {
        options.push({ key: 'helipay.NotifyPath', value: notifyPath });
      }

      const payValidTime = finalInputs.HelipayPayValidTime || inputs.HelipayPayValidTime || '1800';
      if (payValidTime !== undefined && payValidTime !== null && payValidTime !== '') {
        options.push({
          key: 'helipay.PayValidTime',
          value: payValidTime.toString(),
        });
      }

      const requestQueue = options.map((opt) =>
        API.put('/api/option/', {
          key: opt.key,
          value: opt.value,
        }),
      );

      const results = await Promise.all(requestQueue);

      const errorResults = results.filter((res) => !res.data.success);
      if (errorResults.length > 0) {
        errorResults.forEach((res) => {
          showError(res.data.message);
        });
      } else {
        showSuccess(t('更新成功'));
        setOriginInputs({ ...finalInputs });
        props.refresh?.();
      }
    } catch (error) {
      showError(t('更新失败'));
    }
    setLoading(false);
  };

  return (
    <Spin spinning={loading}>
      <Form
        initValues={inputs}
        onValueChange={handleFormChange}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section>
          <Text>
            {t('合利宝支付支持多种支付方式，包括微信、支付宝、银行卡等。')}
            <br />
          </Text>
          <Banner
            type='warning'
            description={t(
              '敏感配置（商户号、密钥等）需要在环境变量中配置，包括：HELIPAY_CUSTOMER_NUMBER、HELIPAY_RSA_PRIVATE_KEY、HELIPAY_SM2_PRIVATE_KEY、HELIPAY_SM2_PUBLIC_KEY、HELIPAY_SM4_KEY',
            )}
          />
          <Banner
            type='info'
            description={t(
              '回调地址格式：服务器地址 + 回调路径，例如：https://your-domain.com/api/user/helipay/notify',
            )}
          />

          <Form.Switch
            field='HelipayEnabled'
            label={t('启用合利宝支付')}
            size='default'
            checkedText='｜'
            uncheckedText='〇'
            style={{ marginBottom: 16, display: 'block' }}
          />

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='HelipayMerchantId'
                label={t('商户号')}
                placeholder={t('从环境变量读取')}
                disabled
                readonly
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='HelipayTransactionApi'
                label={t('交易API地址')}
                placeholder={t('https://api.helipay.com/api/v1/trade/preorder')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='HelipayQueryApi'
                label={t('查询API地址')}
                placeholder={t('https://api.helipay.com/api/v1/trade/query')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='HelipayNotifyPath'
                label={t('回调路径')}
                placeholder={t('/api/user/helipay/notify')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.InputNumber
                field='HelipayPayValidTime'
                label={t('支付有效期（秒）')}
                placeholder={t('1800')}
                min={60}
                step={60}
              />
            </Col>
          </Row>

          <Button onClick={submitHelipaySetting} style={{ marginTop: 16 }}>
            {t('更新合利宝支付设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}