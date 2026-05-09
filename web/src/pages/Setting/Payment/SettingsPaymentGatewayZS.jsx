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
  verifyJSON,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsPaymentGatewayZS(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    ZSPayEnabled: false,
    ZSPayNotifyPath: '/api/user/zs_pay/notify',
    ZSPayPayValidTime: '1800',
  });
  const [originInputs, setOriginInputs] = useState({});
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        ZSPayEnabled: props.options['ZSPayEnabled'] || props.options['zs_payment.Enabled'] === 'true' || props.options['zs_payment.Enabled'] === true,
        ZSPayMerID: props.options['ZSPayMerID'] || props.options['zs_payment.MerID'] || '',
        ZSPayBaseURL: props.options['ZSPayBaseURL'] || props.options['zs_payment.BaseURL'] || 'https://api.cmburl.cn:8065',
        ZSPayNotifyPath: props.options['ZSPayNotifyPath'] || props.options['zs_payment.NotifyPath'] || '/api/user/zs_pay/notify',
        ZSPayPayValidTime: props.options['ZSPayPayValidTime'] || props.options['zs_payment.PayValidTime'] || '1800',
      };
      setInputs(currentInputs);
      setOriginInputs({ ...currentInputs });
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(prev => ({ ...prev, ...values }));
  };

  const submitZSSetting = async () => {
    // 从 formApi 获取最新的表单值
    let formValues = {};
    if (formApiRef.current) {
      formValues = formApiRef.current.getValues() || {};
    }
    
    // 合并 inputs 和 formValues，确保使用最新的值
    const finalInputs = { ...inputs, ...formValues };

    // 检查服务器地址（仅在非空时检查）
    const serverAddress = props.options?.ServerAddress || '';
    if (serverAddress && serverAddress.trim() === '') {
      showError(t('请先填写服务器地址'));
      return;
    }

    setLoading(true);
    try {
      const options = [];

      // 启用开关
      options.push({
        key: 'zs_payment.Enabled',
        value: (finalInputs.ZSPayEnabled || inputs.ZSPayEnabled || false) ? 'true' : 'false',
      });

      // API 地址
      const baseURL = finalInputs.ZSPayBaseURL || inputs.ZSPayBaseURL || '';
      if (baseURL !== '') {
        options.push({ key: 'zs_payment.BaseURL', value: baseURL });
      }

      // 回调路径
      const notifyPath = finalInputs.ZSPayNotifyPath || inputs.ZSPayNotifyPath || '';
      if (notifyPath && notifyPath !== '') {
        options.push({ key: 'zs_payment.NotifyPath', value: notifyPath });
      }

      // 支付有效期
      const payValidTime = finalInputs.ZSPayPayValidTime || inputs.ZSPayPayValidTime || '1800';
      if (payValidTime !== undefined && payValidTime !== null && payValidTime !== '') {
        options.push({
          key: 'zs_payment.PayValidTime',
          value: payValidTime.toString(),
        });
      }

      // 发送请求
      const requestQueue = options.map((opt) =>
        API.put('/api/option/', {
          key: opt.key,
          value: opt.value,
        }),
      );

      const results = await Promise.all(requestQueue);

      // 检查所有请求是否成功
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
            {t('招商银行聚合支付支持微信、支付宝、银联等支付方式。')}
            <br />
          </Text>
          <Banner
            type='warning'
            description={t(
              '回调地址格式：服务器地址 + 回调路径，例如：https://your-domain.com/api/user/zs_pay/notify',
            )}
          />

          <Form.Switch
            field='ZSPayEnabled'
            label={t('启用招商银行聚合支付')}
            size='default'
            checkedText='｜'
            uncheckedText='〇'
            style={{ marginBottom: 16, display: 'block' }}
          />

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='ZSPayMerID'
                label={t('商户号')}
                placeholder={t('')}
                disabled
              />
            </Col>
             <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='ZSPayBaseURL'
                label={t('API 地址')}
                placeholder={t('https://api.cmburl.cn:8065')}        
              />
            </Col>
          </Row>
          
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='ZSPayNotifyPath'
                label={t('回调路径')}
                placeholder={t('/api/user/zs_pay/notify')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.InputNumber
                field='ZSPayPayValidTime'
                label={t('支付有效期（秒）')}
                placeholder={t('1800')}
                min={60}
                step={60}
              />
            </Col>
          </Row>

          <Button onClick={submitZSSetting} style={{ marginTop: 16 }}>
            {t('更新招商银行聚合支付设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
