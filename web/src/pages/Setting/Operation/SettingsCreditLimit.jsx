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
import { Button, Col, Form, Row, Select, Spin } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';

export default function SettingsCreditLimit(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    QuotaForNewUser: '',
    PreConsumedQuota: '',
    QuotaForInviter: '',
    QuotaForInvitee: '',
    RealNameAuthGiftPlanId: '',
    'quota_setting.enable_free_model_pre_consume': true,
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);
  // 赠送模式：'new_user' = 新用户初始额度（Token），'real_name_auth' = 实名认证（订阅套餐）
  // 仅控制 UI 展示，不持久化。根据 RealNameAuthGiftPlanId 是否配置过推断初始值。
  const [giftMode, setGiftMode] = useState('new_user');
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      let value = '';
      if (typeof inputs[item.key] === 'boolean') {
        value = String(inputs[item.key]);
      } else {
        value = inputs[item.key];
      }
      return API.put('/api/option/', {
        key: item.key,
        value,
      });
    });
    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (requestQueue.length === 1) {
          if (res.includes(undefined)) return;
        } else if (requestQueue.length > 1) {
          if (res.includes(undefined))
            return showError(t('部分保存失败，请重试'));
        }
        showSuccess(t('保存成功'));
        props.refresh();
      })
      .catch(() => {
        showError(t('保存失败，请重试'));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    const currentInputs = {};
    for (let key in props.options) {
      if (Object.keys(inputs).includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    refForm.current.setValues(currentInputs);
    // 回显下发方式：若已配置实名认证套餐 ID（>0）则显示「实名认证」，否则显示「新用户初始额度」
    const planId = parseInt(currentInputs.RealNameAuthGiftPlanId, 10);
    if (!isNaN(planId) && planId > 0) {
      setGiftMode('real_name_auth');
    } else {
      setGiftMode('new_user');
    }
  }, [props.options]);

  // 拉取订阅套餐列表（用于实名认证赠送套餐下拉框）
  useEffect(() => {
    setPlansLoading(true);
    API.get('/api/subscription/plans')
      .then((res) => {
        if (res.data?.success) {
          setSubscriptionPlans(res.data.data || []);
        } else {
          setSubscriptionPlans([]);
        }
      })
      .catch(() => setSubscriptionPlans([]))
      .finally(() => setPlansLoading(false));
  }, []);
  return (
    <>
      <Spin spinning={loading}>
        <Form
          values={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
          style={{ marginBottom: 15 }}
        >
          <Form.Section text={t('额度设置')}>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <div className='semi-form-field' style={{ marginBottom: 12 }}>
                  <div className='semi-form-field-label' style={{ marginBottom: 4 }}>
                    {t('下发方式')}
                  </div>
                  <table></table>
                  <Select
                    style={{ width: '40%' }}
                    value={giftMode}
                    onChange={(value) => setGiftMode(value)}
                    extraText={t(
                      '选择「新用户初始额度」时下方输入框配置注册赠送 Token；选择「订阅套餐」时下方下拉框配置实名认证成功后赠送的订阅套餐',
                    )}
                  >
                    <Select.Option value='new_user'>
                      {t('新用户初始额度')}
                    </Select.Option>
                    <Select.Option value='real_name_auth'>
                      {t('订阅套餐')}
                    </Select.Option>
                  </Select>
                </div>
              </Col>
            </Row>
            <Row gutter={16}>
              {giftMode === 'new_user' ? (
                <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                  <Form.InputNumber
                    label={t('新用户初始额度')}
                    field={'QuotaForNewUser'}
                    step={1}
                    min={0}
                    initValue={0}
                    suffix={'Token'}
                    placeholder={''}
                    onChange={(value) =>
                      setInputs({
                        ...inputs,
                        QuotaForNewUser: String(value),
                      })
                    }
                  />
                </Col>
              ) : (
                <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                  <Form.Select
                    label={t('实名认证赠送套餐')}
                    field={'RealNameAuthGiftPlanId'}
                    style={{ width: '40%' }}
                    initValue={inputs.RealNameAuthGiftPlanId || '0'}
                    showClear
                    placeholder={t('不赠送')}
                    extraText={t(
                      '用户实名认证成功后自动绑定该订阅套餐（source=gift）。留空则不赠送',
                    )}
                    onChange={(value) =>
                      setInputs({
                        ...inputs,
                        RealNameAuthGiftPlanId: String(value || 0),
                      })
                    }
                    optionList={[
                      { value: '0', label: t('不赠送') },
                      ...(subscriptionPlans || []).map((p) => ({
                        value: String(p?.plan?.id || 0),
                        label:
                          p?.plan?.title ||
                          `#${p?.plan?.id || ''}`,
                      })),
                    ]}
                  />
                </Col>
              )}
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  label={t('请求预扣费额度')}
                  field={'PreConsumedQuota'}
                  step={1}
                  min={0}
                  suffix={'Token'}
                  extraText={t('请求结束后多退少补')}
                  placeholder={''}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      PreConsumedQuota: String(value),
                    })
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  label={t('邀请新用户奖励额度')}
                  field={'QuotaForInviter'}
                  step={1}
                  min={0}
                  suffix={'Token'}
                  extraText={''}
                  placeholder={t('例如：2000')}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      QuotaForInviter: String(value),
                    })
                  }
                />
              </Col>
            </Row>
            <Row>
              <Col xs={24} sm={12} md={8} lg={8} xl={6}>
                <Form.InputNumber
                  label={t('新用户使用邀请码奖励额度')}
                  field={'QuotaForInvitee'}
                  step={1}
                  min={0}
                  suffix={'Token'}
                  extraText={''}
                  placeholder={t('例如：1000')}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      QuotaForInvitee: String(value),
                    })
                  }
                />
              </Col>
            </Row>
            <Row>
              <Col>
                <Form.Switch
                  label={t('对免费模型启用预消耗')}
                  field={'quota_setting.enable_free_model_pre_consume'}
                  extraText={t(
                    '开启后，对免费模型（倍率为0，或者价格为0）的模型也会预消耗额度',
                  )}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      'quota_setting.enable_free_model_pre_consume': value,
                    })
                  }
                />
              </Col>
            </Row>

            <Row>
              <Button size='default' onClick={onSubmit}>
                {t('保存额度设置')}
              </Button>
            </Row>
          </Form.Section>
        </Form>
      </Spin>
    </>
  );
}
