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
import { useTranslation } from 'react-i18next';
import {
  API,
  downloadTextAsFile,
  showError,
  showSuccess,
  renderQuota,
  getCurrencyConfig,
} from '../../../../helpers';
import {
  quotaToDisplayAmount,
  displayAmountToQuota,
} from '../../../../helpers/quota';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import {
  Button,
  Modal,
  SideSheet,
  Space,
  Spin,
  Typography,
  Card,
  Tag,
  Form,
  Avatar,
  Row,
  Col,
  InputNumber,
  Select,
} from '@douyinfe/semi-ui';
import {
  IconCreditCard,
  IconSave,
  IconClose,
  IconGift,
} from '@douyinfe/semi-icons';

const { Text, Title } = Typography;

// 下发方式选项
const ISSUE_TYPE_OPTIONS = [
  { value: 'direct', label: '额度充值' },
  { value: 'package', label: '订阅套餐' },
];

const EditRedemptionModal = (props) => {
  const { t } = useTranslation();
  const isEdit = props.editingRedemption.id !== undefined;
  const [loading, setLoading] = useState(isEdit);
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);
  const [showQuotaInput, setShowQuotaInput] = useState(false);
  
  // 下发方式状态
  const [issueType, setIssueType] = useState('direct');
  // 套餐相关状态
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [selectedPlanInfo, setSelectedPlanInfo] = useState(null);
  const [plansLoading, setPlansLoading] = useState(false);

  const getInitValues = () => ({
    name: '',
    issue_type: 'direct',
    quota: 100000,
    amount: Number(quotaToDisplayAmount(100000).toFixed(6)),
    count: 1,
    expired_time: null,
    plan_id: 0,
  });

  const handleCancel = () => {
    props.handleClose();
  };

  // 加载可用套餐列表
  const loadPlans = async () => {
    setPlansLoading(true);
    try {
      const res = await API.get('/api/subscription/plans');
      if (res.data?.success) {
        // 过滤出 plan_type='quota' 且 visible_to_user=false 的套餐
        const filteredPlans = (res.data.data || []).filter(
          p => p.plan?.plan_type === 'quota' && p.plan?.visible_to_user === false
        );
        setPlans(filteredPlans);
      }
    } catch (e) {
      // ignore
    } finally {
      setPlansLoading(false);
    }
  };

  const loadRedemption = async () => {
    setLoading(true);
    let res = await API.get(`/api/redemption/${props.editingRedemption.id}`);
    const { success, message, data } = res.data;
    if (success) {
      if (data.expired_time === 0) {
        data.expired_time = null;
      } else {
        data.expired_time = new Date(data.expired_time * 1000);
      }
      data.amount = Number(quotaToDisplayAmount(data.quota || 0).toFixed(6));
      
      // 设置下发方式
      const initialIssueType = (data.plan_id > 0) ? 'package' : 'direct';
      setIssueType(initialIssueType);
      setSelectedPlanId(data.plan_id || null);
      
      // 如果是套餐模式，加载套餐信息
      if (data.plan_id > 0) {
        await loadPlans();
        const plan = plans.find(p => p.plan?.id === data.plan_id);
        if (plan) {
          setSelectedPlanInfo(plan.plan);
        }
      }
      
      formApiRef.current?.setValues({ ...getInitValues(), ...data, issue_type: initialIssueType });
    } else {
      showError(message);
    }
    setLoading(false);
  };

  // 选择套餐后更新状态
  const handlePlanChange = (planId) => {
    setSelectedPlanId(planId || null);
    const plan = plans.find(p => p.plan?.id === planId);
    setSelectedPlanInfo(plan?.plan || null);
  };

  useEffect(() => {
    if (formApiRef.current) {
      if (isEdit) {
        loadRedemption();
      } else {
        formApiRef.current.setValues(getInitValues());
        // 新建时加载套餐列表
        loadPlans();
      }
    }
  }, [props.editingRedemption.id]);

  const submit = async (values) => {
    let name = values.name;
    if (!isEdit && (!name || name === '')) {
      name = renderQuota(values.quota);
    }
    setLoading(true);
    let localInputs = { ...values };
    
    // 根据下发方式处理数据
    if (issueType === 'package') {
      // 套餐模式
      if (!selectedPlanId) {
        showError(t('请选择套餐'));
        setLoading(false);
        return;
      }
      localInputs.plan_id = selectedPlanId || 0;
      localInputs.count = parseInt(localInputs.count) || 1;
      localInputs.quota = 0; // 套餐模式不需要 quota
      localInputs.amount = 0;
    } else {
      // 直接充值模式
      localInputs.plan_id = 0;
      localInputs.count = parseInt(localInputs.count) || 0;
      localInputs.quota = displayAmountToQuota(localInputs.amount);
      if (localInputs.quota <= 0) {
        showError(t('请输入金额'));
        setLoading(false);
        return;
      }
    }
    
    localInputs.name = name;
    if (!localInputs.expired_time) {
      localInputs.expired_time = 0;
    } else {
      localInputs.expired_time = Math.floor(
        localInputs.expired_time.getTime() / 1000,
      );
    }
    let res;
    if (isEdit) {
      res = await API.put(`/api/redemption/`, {
        ...localInputs,
        id: parseInt(props.editingRedemption.id),
      });
    } else {
      res = await API.post(`/api/redemption/`, {
        ...localInputs,
      });
    }
    const { success, message, data } = res.data;
    if (success) {
      if (isEdit) {
        showSuccess(t('兑换码更新成功！'));
        props.refresh();
        props.handleClose();
      } else {
        showSuccess(t('兑换码创建成功！'));
        props.refresh();
        formApiRef.current?.setValues(getInitValues());
        setSelectedPlanId(null);
        setSelectedPlanInfo(null);
        setIssueType('direct');
        props.handleClose();
      }
    } else {
      showError(message);
    }
    if (!isEdit && data) {
      let text = '';
      for (let i = 0; i < data.length; i++) {
        text += data[i] + '\n';
      }
      Modal.confirm({
        title: t('兑换码创建成功'),
        content: (
          <div>
            <p>{t('兑换码创建成功，是否下载兑换码？')}</p>
            <p>{t('兑换码将以文本文件的形式下载，文件名为兑换码的名称。')}</p>
          </div>
        ),
        onOk: () => {
          downloadTextAsFile(text, `${localInputs.name}.txt`);
        },
      });
    }
    setLoading(false);
  };

  return (
    <>
      <SideSheet
        placement={isEdit ? 'right' : 'left'}
        title={
          <Space>
            {isEdit ? (
              <Tag color='blue' shape='circle'>
                {t('更新')}
              </Tag>
            ) : (
              <Tag color='green' shape='circle'>
                {t('新建')}
              </Tag>
            )}
            <Title heading={4} className='m-0'>
              {isEdit ? t('更新兑换码信息') : t('创建新的兑换码')}
            </Title>
          </Space>
        }
        bodyStyle={{ padding: '0' }}
        visible={props.visiable}
        width={isMobile ? '100%' : 600}
        footer={
          <div className='flex justify-end bg-white'>
            <Space>
              <Button
                theme='solid'
                onClick={() => formApiRef.current?.submitForm()}
                icon={<IconSave />}
                loading={loading}
              >
                {t('提交')}
              </Button>
              <Button
                theme='light'
                type='primary'
                onClick={handleCancel}
                icon={<IconClose />}
              >
                {t('取消')}
              </Button>
            </Space>
          </div>
        }
        closeIcon={null}
        onCancel={() => handleCancel()}
      >
        <Spin spinning={loading}>
          <Form
            initValues={getInitValues()}
            getFormApi={(api) => (formApiRef.current = api)}
            onSubmit={submit}
          >
            {({ values }) => (
              <div className='p-2'>
                <Card className='!rounded-2xl shadow-sm border-0 mb-6'>
                  {/* Header: Basic Info */}
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='blue'
                      className='mr-2 shadow-md'
                    >
                      <IconGift size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('基本信息')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('设置兑换码的基本信息')}
                      </div>
                    </div>
                  </div>

                  <Row gutter={12}>
                    <Col span={24}>
                      <Form.Input
                        field='name'
                        label={t('名称')}
                        placeholder={t('请输入名称')}
                        style={{ width: '100%' }}
                        rules={
                          !isEdit
                            ? []
                            : [{ required: true, message: t('请输入名称') }]
                        }
                        showClear
                      />
                    </Col>
                    <Col span={24}>
                      <Form.DatePicker
                        field='expired_time'
                        label={t('过期时间')}
                        type='dateTime'
                        placeholder={t('选择过期时间（可选，留空为永久）')}
                        style={{ width: '100%' }}
                        showClear
                      />
                    </Col>
                  </Row>
                </Card>

                <Card className='!rounded-2xl shadow-sm border-0'>
                  {/* Header: Quota Settings */}
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='green'
                      className='mr-2 shadow-md'
                    >
                      <IconCreditCard size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('额度设置')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('设置兑换码的额度和数量')}
                      </div>
                    </div>
                  </div>

                  <Row gutter={12}>
                    <Col span={24}>
                      {/* 下发方式选择 */}
                      <Form.Select
                        field='issue_type'
                        label={t('下发方式')}
                        placeholder={t('选择下发方式')}
                        style={{ width: '100%', marginBottom: 16 }}
                        optionList={ISSUE_TYPE_OPTIONS}
                        onChange={(val) => {
                          setIssueType(val);
                          if (val === 'direct') {
                            setSelectedPlanId(null);
                            setSelectedPlanInfo(null);
                          } else {
                            // 切换到套餐模式时，如果套餐列表为空则加载
                            if (plans.length === 0) {
                              loadPlans();
                            }
                          }
                        }}
                      />

                      {issueType === 'direct' && (
                        // 直接充值模式：显示额度输入
                        <>
                          <Form.InputNumber
                            field='amount'
                            label={t('金额')}
                            prefix={getCurrencyConfig().symbol}
                            placeholder={t('输入金额')}
                            precision={6}
                            min={0}
                            step={0.000001}
                            style={{ width: '100%' }}
                            onChange={(val) => {
                              const amount = val === '' || val == null ? 0 : val;
                              formApiRef.current?.setValue('amount', amount);
                              formApiRef.current?.setValue(
                                'quota',
                                displayAmountToQuota(amount),
                              );
                            }}
                            showClear
                          />
                          <div
                            className='text-xs cursor-pointer mt-1'
                            style={{ color: 'var(--semi-color-text-2)' }}
                            onClick={() => setShowQuotaInput((v) => !v)}
                          >
                            {showQuotaInput
                              ? `▾ ${t('收起原生额度输入')}`
                              : `▸ ${t('使用原生额度输入')}`}
                          </div>
                          <div style={{ display: showQuotaInput ? 'block' : 'none' }} className='mt-2'>
                            <Form.InputNumber
                              field='quota'
                              label={t('额度')}
                              placeholder={t('输入额度')}
                              rules={[
                                { required: true, message: t('请输入额度') },
                                {
                                  validator: (rule, v) => {
                                    const num = parseInt(v, 10);
                                    return num > 0
                                      ? Promise.resolve()
                                      : Promise.reject(t('额度必须大于0'));
                                  },
                                },
                              ]}
                              onChange={(val) => {
                                const quota = val === '' || val == null ? 0 : val;
                                formApiRef.current?.setValue('quota', quota);
                                formApiRef.current?.setValue(
                                  'amount',
                                  Number(quotaToDisplayAmount(quota).toFixed(6)),
                                );
                              }}
                              style={{ width: '100%' }}
                              showClear
                            />
                          </div>
                          {!isEdit && (
                            <Col span={24} style={{ marginTop: 16 }}>
                              <Form.InputNumber
                                field='count'
                                label={t('生成数量')}
                                min={1}
                                rules={[
                                  { required: true, message: t('请输入生成数量') },
                                  {
                                    validator: (rule, v) => {
                                      const num = parseInt(v, 10);
                                      return num > 0
                                        ? Promise.resolve()
                                        : Promise.reject(t('生成数量必须大于0'));
                                    },
                                  },
                                ]}
                                style={{ width: '100%' }}
                                showClear
                              />
                            </Col>
                          )}
                        </>
                      )}

                      {issueType === 'package' && (
                        // 套餐模式：显示套餐选择器
                        <div>
                          <Select
                            placeholder={t('选择套餐')}
                            value={selectedPlanId}
                            onChange={handlePlanChange}
                            style={{ width: '100%' }}
                            loading={plansLoading}
                            optionList={plans.map(p => ({
                              label: `${p.plan?.title || ''} - ${renderQuota(p.plan?.total_amount || 0)}`,
                              value: p.plan?.id,
                            }))}
                          />
                          
                          {/* 显示套餐详情 */}
                          {selectedPlanInfo && (
                            <Card className='!mt-4 !border-0 bg-slate-50'>
                              <div className='space-y-2 text-sm'>
                                <div>
                                  <Text type='tertiary'>{t('额度')}：</Text>
                                  <Text strong>{renderQuota(selectedPlanInfo.total_amount || 0)}</Text>
                                </div>
                                <div>
                                  <Text type='tertiary'>{t('有效期')}：</Text>
                                  <Text strong>
                                    {selectedPlanInfo.duration_unit === 'custom' 
                                      ? `${selectedPlanInfo.custom_seconds || 0} 秒`
                                      : `${selectedPlanInfo.duration_value || 1} ${
                                          { year: '年', month: '月', day: '日', hour: '小时' }[selectedPlanInfo.duration_unit] || '月'
                                        }`}
                                  </Text>
                                </div>
                                {selectedPlanInfo.applicable_models && selectedPlanInfo.applicable_models !== '' && (
                                  <div>
                                    <Text type='tertiary'>{t('可用模型')}：</Text>
                                    <Text strong>{selectedPlanInfo.applicable_models}</Text>
                                  </div>
                                )}
                              </div>
                            </Card>
                          )}
                          
                          {/* 生成数量 - 套餐模式也显示 */}
                          {!isEdit && (
                            <Col span={24} style={{ marginTop: 16 }}>
                              <Form.InputNumber
                                field='count'
                                label={t('生成数量')}
                                min={1}
                                rules={[
                                  { required: true, message: t('请输入生成数量') },
                                  {
                                    validator: (rule, v) => {
                                      const num = parseInt(v, 10);
                                      return num > 0
                                        ? Promise.resolve()
                                        : Promise.reject(t('生成数量必须大于0'));
                                    },
                                  },
                                ]}
                                style={{ width: '100%' }}
                                showClear
                              />
                            </Col>
                          )}
                        </div>
                      )}
                    </Col>
                  </Row>
                </Card>
              </div>
            )}
          </Form>
        </Spin>
      </SideSheet>
    </>
  );
};

export default EditRedemptionModal;
