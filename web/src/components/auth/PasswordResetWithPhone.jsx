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

import React, { useState, useEffect, useContext, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  API,
  getLogo,
  showError,
  showInfo,
  showSuccess,
  getSystemName,
} from '../../helpers';
import Turnstile from 'react-turnstile';
import { Button, Card, Checkbox, Form } from '@douyinfe/semi-ui';
import Title from '@douyinfe/semi-ui/lib/es/typography/title';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import { IconPhone, IconKey, IconLock } from '@douyinfe/semi-icons';
import { StatusContext } from '../../context/Status';
import { useTranslation } from 'react-i18next';

const PasswordResetWithPhone = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);

  const [inputs, setInputs] = useState({
    telephone: '',
    verification_code: '',
    password: '',
    password2: '',
  });

  const [resetLoading, setResetLoading] = useState(false);
  const [verificationCodeLoading, setVerificationCodeLoading] = useState(false);
  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [hasUserAgreement, setHasUserAgreement] = useState(false);
  const [hasPrivacyPolicy, setHasPrivacyPolicy] = useState(false);

  const logo = getLogo();
  const systemName = getSystemName();

  const status = useMemo(() => {
    if (statusState?.status) return statusState.status;
    const savedStatus = localStorage.getItem('status');
    if (!savedStatus) return {};
    try {
      return JSON.parse(savedStatus) || {};
    } catch (err) {
      return {};
    }
  }, [statusState?.status]);

  useEffect(() => {
    if (status?.turnstile_check) {
      setTurnstileEnabled(true);
      setTurnstileSiteKey(status.turnstile_site_key);
    }
    setHasUserAgreement(status?.user_agreement_enabled || false);
    setHasPrivacyPolicy(status?.privacy_policy_enabled || false);
  }, [status]);

  useEffect(() => {
    let countdownInterval = null;
    if (disableButton && countdown > 0) {
      countdownInterval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setDisableButton(false);
      setCountdown(60);
    }
    return () => clearInterval(countdownInterval);
  }, [disableButton, countdown]);

  const handleChange = (name, value) => {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  };

  const sendSMSVerificationCode = async () => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(inputs.telephone)) {
      showInfo(t('请输入正确的手机号格式'));
      return;
    }
    if (turnstileEnabled && turnstileToken === '') {
      showInfo(t('请稍后几秒重试，Turnstile 正在检查用户环境！'));
      return;
    }
    setVerificationCodeLoading(true);
    try {
      const res = await API.post(
        `/api/verify/code?turnstile=${turnstileToken}`,
        {
          telephone: inputs.telephone,
        },
      );
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('短信验证码发送成功，请检查你的手机！'));
        setDisableButton(true);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('发送短信验证码失败，请重试'));
    } finally {
      setVerificationCodeLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }

    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(inputs.telephone)) {
      showInfo(t('请输入正确的手机号格式'));
      return;
    }

    if (!/^\d{6}$/.test(inputs.verification_code)) {
      showInfo(t('请输入6位数字验证码'));
      return;
    }

    if (inputs.password.length < 8) {
      showInfo(t('密码长度不得小于 8 位！'));
      return;
    }

    if (inputs.password !== inputs.password2) {
      showInfo(t('两次输入的密码不一致'));
      return;
    }

    if (turnstileEnabled && turnstileToken === '') {
      showInfo(t('请稍后几秒重试，Turnstile 正在检查用户环境！'));
      return;
    }

    setResetLoading(true);
    try {
      const res = await API.post(
        `/api/user/reset_password?turnstile=${turnstileToken}`,
        {
          telephone: inputs.telephone,
          verification_code: inputs.verification_code,
          password: inputs.password,
          confirmPassword: inputs.password2,
        },
      );
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('密码重置成功，请登录！'));
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('密码重置失败，请重试'));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className='relative overflow-hidden bg-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 min-h-screen'>
      <div className='w-full max-w-sm mt-[60px]'>
        <div className='flex flex-col items-center'>
          <div className='w-full max-w-md'>
            <div className='flex items-center justify-center mb-6 gap-2'>
              <img src={logo} alt='Logo' className='h-10 rounded-full' />
              <Title heading={3} className='section-heading'>
                {systemName}
              </Title>
            </div>

            <Card className='border border-border-light !rounded-lg overflow-hidden shadow-elevated'>
              <div className='flex justify-center pt-6 pb-2'>
                <Title
                  heading={3}
                  className='text-gray-800 dark:text-gray-200 section-heading'
                >
                  {t('重置密码')}
                </Title>
              </div>
              <div className='px-6 py-8'>
                <Form className='space-y-3'>
                  <Form.Input
                    field='password'
                    label={t('新密码')}
                    placeholder={t('输入新密码')}
                    name='password'
                    mode='password'
                    onChange={(value) => handleChange('password', value)}
                    prefix={<IconLock />}
                  />

                  <Form.Input
                    field='password2'
                    label={t('确认密码')}
                    placeholder={t('再次输入新密码')}
                    name='password2'
                    mode='password'
                    onChange={(value) => handleChange('password2', value)}
                    prefix={<IconLock />}
                  />
                  <Form.Input
                    field='telephone'
                    label={t('手机号')}
                    placeholder={t('输入手机号')}
                    name='telephone'
                    onChange={(value) => handleChange('telephone', value)}
                    prefix={<IconPhone />}
                  />

                  <Button
                    theme='light'
                    className='w-full !rounded-md font-semibold transition-colors duration-200'
                    type='tertiary'
                    onClick={sendSMSVerificationCode}
                    loading={verificationCodeLoading}
                    disabled={
                      disableButton ||
                      verificationCodeLoading ||
                      ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms)
                    }
                    style={{
                      fontWeight: '600',
                      backgroundColor:
                        disableButton || verificationCodeLoading
                          ? '#e5e7eb'
                          : '#f3f4f6',
                      color:
                        disableButton || verificationCodeLoading
                          ? '#9ca3af'
                          : '#2563eb',
                      cursor:
                        disableButton || verificationCodeLoading
                          ? 'not-allowed'
                          : 'pointer',
                    }}
                  >
                    {disableButton
                      ? `${t('重新发送')} (${countdown})`
                      : t('获取验证码')}
                  </Button>

                  <Form.Input
                    field='verification_code'
                    label={t('短信验证码')}
                    placeholder={t('输入6位验证码')}
                    name='verification_code'
                    onChange={(value) =>
                      handleChange('verification_code', value)
                    }
                    prefix={<IconKey />}
                    maxLength={6}
                  />
                  <div className='space-y-2 pt-2'>
                    <Button
                      theme='solid'
                      className='w-full !rounded-md bg-dark-blue text-white hover:bg-opacity-90 transition-colors body'
                      type='primary'
                      onClick={handleResetPassword}
                      loading={resetLoading}
                      disabled={
                        (hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms
                      }
                    >
                      {t('重置密码')}
                    </Button>

                    <Button
                      theme='borderless'
                      type='tertiary'
                      className='w-full !rounded-md body'
                      onClick={() => navigate('/login')}
                    >
                      {t('返回登录')}
                    </Button>
                  </div>
                </Form>

                {!status?.self_use_mode_enabled && (
                  <div className='mt-6 text-center text-sm'>
                    <Text className='caption'>
                      {t('没有账户？')}{' '}
                      <Link
                        to='/register'
                        className='text-blue-600 hover:text-blue-800 font-medium body'
                      >
                        {t('注册')}
                      </Link>
                    </Text>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {turnstileEnabled && (
          <div className='flex justify-center mt-6'>
            <Turnstile
              sitekey={turnstileSiteKey}
              onVerify={(token) => {
                setTurnstileToken(token);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PasswordResetWithPhone;
