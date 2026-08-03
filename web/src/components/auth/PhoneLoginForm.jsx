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

import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
// import Turnstile from 'react-turnstile';
import { Button, Card, Checkbox, Form, Toast } from '@douyinfe/semi-ui';
import Title from '@douyinfe/semi-ui/lib/es/typography/title';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import { IconPhone, IconKey } from '@douyinfe/semi-icons';
import { StatusContext } from '../../context/Status';
import { UserContext } from '../../context/User';
import { API } from '../../helpers/api';
import { setUserData, updateAPI } from '../../helpers';
import TwoFAVerification from './TwoFAVerification';

function PhoneLoginForm() {
  const [statusState] = useContext(StatusContext);
  const [userState, userDispatch] = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();

  const getRedirectPath = () => {
    return location.state?.from || '/console';
  };

  const [inputs, setInputs] = useState({
    telephone: '',
    verification_code: '',
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [verificationCodeLoading, setVerificationCodeLoading] = useState(false);
  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTwoFA, setShowTwoFA] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');

  const {
    status,
    logo,
    systemName,
    hasUserAgreement,
    hasPrivacyPolicy,
    turnstileSiteKey,
    turnstileEnabled,
  } = statusState;

  const { user } = userState;

  useEffect(() => {
    if (user && user.id) {
      navigate('/console');
    }
  }, [user, navigate]);

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

  const showInfo = (message) => {
    Toast.info(message);
  };

  const showError = (message) => {
    Toast.error(message);
  };

  const showSuccess = (message) => {
    Toast.success(message);
  };

  const handleChange = (field, value) => {
    setInputs((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const sendSMSVerificationCode = async () => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(inputs.telephone)) {
      showInfo('请输入正确的手机号格式');
      return;
    }
    if (turnstileEnabled && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return;
    }
    setVerificationCodeLoading(true);
    try {
      const res = await API.post(
        `/api/verify/code?turnstile=${turnstileToken}`,
        {
          telephone: inputs.telephone,
        }
      )
      const { success, message } = res.data;
      if (success) {
        showSuccess('短信验证码发送成功，请检查你的手机！');
        setDisableButton(true);
      } else {
        showError(message);
      }
    } catch (error) {
      showError('发送短信验证码失败，请重试');
    } finally {
      setVerificationCodeLoading(false);
    }
  };

  const handlePhoneLogin = async () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo('请先阅读并同意用户协议和隐私政策');
      return;
    }

    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(inputs.telephone)) {
      showInfo('请输入正确的手机号格式');
      return;
    }

    if (!/^\d{6}$/.test(inputs.verification_code)) {
      showInfo('请输入6位数字验证码');
      return;
    }

    if (turnstileEnabled && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await API.post(
        `/api/user/login/phone?turnstile=${turnstileToken}`,
        {
          telephone: inputs.telephone,
          verification_code: inputs.verification_code,
        },
      );
      const { success, message, data } = res.data;
      if (success) {
        if (data && data.require_2fa) {
          setShowTwoFA(true);
          setLoginLoading(false);
          return;
        }
        userDispatch({ type: 'login', payload: data });
        setUserData(data);
        updateAPI();
        showSuccess('登录成功！');
        navigate(getRedirectPath());
      } else {
        showError(message);
      }
    } catch (error) {
      showError('登录失败，请重试');
    } finally {
      setLoginLoading(false);
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
                  手机号登录
                </Title>
              </div>
              <div className='px-6 py-8'>
                <Form className='space-y-3'>
                  <Form.Input
                    field='telephone'
                    label='手机号'
                    placeholder='输入手机号'
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
                        disableButton || verificationCodeLoading ? '#e5e7eb' : '#f3f4f6',
                      color: disableButton || verificationCodeLoading ? '#9ca3af' : '#2563eb',
                      cursor:
                        disableButton || verificationCodeLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {disableButton ? `重新发送 (${countdown})` : '获取验证码'}
                  </Button>

                  <Form.Input
                    field='verification_code'
                    label='短信验证码'
                    placeholder='输入6位验证码'
                    name='verification_code'
                    onChange={(value) => handleChange('verification_code', value)}
                    prefix={<IconKey />}
                    maxLength={6}
                  />

                  {(hasUserAgreement || hasPrivacyPolicy) && (
                    <div className='pt-4'>
                      <Checkbox
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                      >
                        <Text size='small' className='text-gray-600 caption'>
                          我已阅读并同意
                          {hasUserAgreement && (
                            <>
                              <a
                                href='/user-agreement'
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-blue-600 hover:text-blue-800 mx-1'
                              >
                                用户协议
                              </a>
                            </>
                          )}
                          {hasUserAgreement && hasPrivacyPolicy && '和'}
                          {hasPrivacyPolicy && (
                            <>
                              <a
                                href='/privacy-policy'
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-blue-600 hover:text-blue-800 mx-1'
                              >
                                隐私政策
                              </a>
                            </>
                          )}
                        </Text>
                      </Checkbox>
                    </div>
                  )}

                  <div className='space-y-2 pt-2'>
                    <Button
                      theme='solid'
                      className='w-full !rounded-md bg-dark-blue text-white hover:bg-opacity-90 transition-colors body'
                      type='primary'
                      onClick={handlePhoneLogin}
                      loading={loginLoading}
                      disabled={(hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms}
                    >
                      登录
                    </Button>

                    <Button
                      theme='borderless'
                      type='tertiary'
                      className='w-full !rounded-md body'
                      onClick={() => navigate('/login')}
                    >
                      返回密码登录
                    </Button>
                  </div>
                </Form>

                {!status?.self_use_mode_enabled && (
                  <div className='mt-6 text-center text-sm'>
                    <Text className='caption'>
                      没有账户？{' '}
                      <Link
                        to='/register'
                        className='text-blue-600 hover:text-blue-800 font-medium body'
                      >
                        注册
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
            <React.Suspense fallback={<div>Loading...</div>}>
              <Turnstile
                sitekey={turnstileSiteKey}
                onVerify={(token) => {
                  setTurnstileToken(token);
                }}
              />
            </React.Suspense>
          </div>
        )}
      </div>
    </div>
  );
}

export default PhoneLoginForm;
