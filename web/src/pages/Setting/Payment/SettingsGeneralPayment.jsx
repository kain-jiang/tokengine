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
import { Button, Form, Row, Col, Spin } from '@douyinfe/semi-ui';
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
  verifyJSON,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsGeneralPayment(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    ServerAddress: '',
    TopupGroupRatio: '',
    AmountOptions: '',
    AmountDiscount: '',
  });
  const [originInputs, setOriginInputs] = useState({});
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      // 美化 JSON 展示
      let AmountOptions = props.options.AmountOptions || '';
      try {
        if (AmountOptions) {
          AmountOptions = JSON.stringify(
            JSON.parse(AmountOptions),
            null,
            2,
          );
        }
      } catch {}

      let AmountDiscount = props.options.AmountDiscount || '';
      try {
        if (AmountDiscount) {
          AmountDiscount = JSON.stringify(
            JSON.parse(AmountDiscount),
            null,
            2,
          );
        }
      } catch {}

      let TopupGroupRatio = props.options.TopupGroupRatio || '';
      try {
        if (TopupGroupRatio) {
          TopupGroupRatio = JSON.stringify(
            JSON.parse(TopupGroupRatio),
            null,
            2,
          );
        }
      } catch {}

      const currentInputs = {
        ServerAddress: props.options.ServerAddress || '',
        TopupGroupRatio: TopupGroupRatio,
        AmountOptions: AmountOptions,
        AmountDiscount: AmountDiscount,
      };
      setInputs(currentInputs);
      setOriginInputs({ ...currentInputs });
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(prev => ({ ...prev, ...values }));
  };

  const submitSettings = async () => {
    // 从 formApi 获取最新的表单值
    let formValues = {};
    if (formApiRef.current) {
      formValues = formApiRef.current.getValues() || {};
    }
    
    // 合并 inputs 和 formValues，确保使用最新的值
    const finalInputs = { ...inputs, ...formValues };

    // 充值分组倍率验证
    const topupGroupRatio = finalInputs.TopupGroupRatio || inputs.TopupGroupRatio || '';
    if (originInputs['TopupGroupRatio'] !== topupGroupRatio) {
      if (topupGroupRatio && topupGroupRatio.trim() !== '' && !verifyJSON(topupGroupRatio)) {
        showError(t('充值分组倍率不是合法的 JSON 字符串'));
        return;
      }
    }

    // 自定义充值数量选项验证
    const amountOptions = finalInputs.AmountOptions || inputs.AmountOptions || '';
    if (originInputs['AmountOptions'] !== amountOptions) {
      if (amountOptions && amountOptions.trim() !== '' && !verifyJSON(amountOptions)) {
        showError(t('自定义充值数量选项不是合法的 JSON 数组'));
        return;
      }
    }

    // 充值金额折扣配置验证
    const amountDiscount = finalInputs.AmountDiscount || inputs.AmountDiscount || '';
    if (originInputs['AmountDiscount'] !== amountDiscount) {
      if (amountDiscount && amountDiscount.trim() !== '' && !verifyJSON(amountDiscount)) {
        showError(t('充值金额折扣配置不是合法的 JSON 对象'));
        return;
      }
    }

    setLoading(true);
    try {
      const options = [];

      // 服务器地址
      const ServerAddress = finalInputs.ServerAddress || inputs.ServerAddress || '';
      if (ServerAddress !== undefined && ServerAddress !== null) {
        options.push({
          key: 'ServerAddress',
          value: removeTrailingSlash(ServerAddress),
        });
      }

      // 充值分组倍率
      if (originInputs['TopupGroupRatio'] !== topupGroupRatio) {
        options.push({ key: 'TopupGroupRatio', value: topupGroupRatio });
      }

      // 自定义充值数量选项
      if (originInputs['AmountOptions'] !== amountOptions) {
        options.push({
          key: 'payment_setting.amount_options',
          value: amountOptions,
        });
      }

      // 充值金额折扣配置
      if (originInputs['AmountDiscount'] !== amountDiscount) {
        options.push({
          key: 'payment_setting.amount_discount',
          value: amountDiscount,
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
        props.refresh && props.refresh();
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
        <Form.Section text={t('通用设置')}>
          <Form.Input
            field='ServerAddress'
            label={t('服务器地址')}
            placeholder={'https://yourdomain.com'}
            style={{ width: '100%' }}
            extraText={t(
              '该服务器地址将影响支付回调地址以及默认首页展示的地址，请确保正确配置',
            )}
          />

          <Form.TextArea
            field='TopupGroupRatio'
            label={t('充值分组倍率')}
            placeholder={t('为一个 JSON 文本，键为组名称，值为倍率')}
            autosize
            style={{ marginTop: 16 }}
          />

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col span={24}>
              <Form.TextArea
                field='AmountOptions'
                label={t('自定义充值数量选项')}
                placeholder={t(
                  '为一个 JSON 数组，例如：[10, 20, 50, 100, 200, 500]',
                )}
                autosize
                extraText={t(
                  '设置用户可选择的充值数量选项，例如：[10, 20, 50, 100, 200, 500]',
                )}
              />
            </Col>
          </Row>

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col span={24}>
              <Form.TextArea
                field='AmountDiscount'
                label={t('充值金额折扣配置')}
                placeholder={t(
                  '为一个 JSON 对象，例如：{"100": 0.95, "200": 0.9, "500": 0.85}',
                )}
                autosize
                extraText={t(
                  '设置不同充值金额对应的折扣，键为充值金额，值为折扣率，例如：{"100": 0.95, "200": 0.9, "500": 0.85}',
                )}
              />
            </Col>
          </Row>

          <Button onClick={submitSettings} style={{ marginTop: 16 }}>
            {t('更新设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
