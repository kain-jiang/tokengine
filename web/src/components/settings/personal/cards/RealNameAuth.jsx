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

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Typography, Modal } from '@douyinfe/semi-ui';
import { IconUser, IconGlobe, IconEdit, IconTickCircle, IconClock } from '@douyinfe/semi-icons';
import { XCircle } from 'lucide-react';
import { API, showError, showWarning } from '../../../../helpers';

const RealNameAuth = ({ t }) => {
  const navigate = useNavigate();
  const [authInfo, setAuthInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [licenseB64Content, setLicenseB64Content] = useState('');
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  useEffect(() => {
    loadAuthInfo();
  }, []);

  const loadAuthInfo = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/user/realname/auth');
      if (res.data.success) {
        setAuthInfo(res.data.data);
      }
    } catch (error) {
      showError(error.response?.data?.message || error.message || t('获取认证信息失败'));
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewLicense = async() => {
     try {
      const res = await API.get(authInfo.company_business_license);
      if (res.data.success) {
        setLicenseB64Content(res.data.data.content);
        setShowLicenseModal(true);
      }
    } catch (error) {
      showError(error.response?.data?.message || error.message || t('获取营业执照失败'));
    } finally {
    }
  };

  const handleStartAuth = async (type) => {
    if (type === 'company') {
      const res = await API.get('/api/user/realname/auth', {
        params: {
          auth_type: 'personal',
        },
      });
      if (res.data.success) {
        if (!res.data.data) {
          showWarning(t('请您先进行个人认证'));
          return
        }
      }
    }
    navigate(`/console/realname-auth?type=${type}`);
  };

  const handleEdit = () => {
    navigate(`/console/realname-auth?type=${authInfo.auth_type}&edit=true`);
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'AuditPending':
        return { text: t('审核中'), color: 'orange' };
      case 'AuditPassed':
        return { text: t('审核通过'), color: 'green' };
      case 'AuditRejected':
        return { text: t('审核拒绝'), color: 'red' };
      default:
        return { text: t('未知'), color: 'gray' };
    }
  };

  const maskIdCard = (idCard) => {
    if (!idCard) return '';
    if (idCard.length === 18) {
      return idCard.slice(0, 3) + '***********' + idCard.slice(-4);
    }
    return idCard;
  };

  const maskPhone = (phone) => {
    if (!phone) return '';
    if (phone.length === 11) {
      return phone.slice(0, 3) + '****' + phone.slice(-4);
    }
    return phone;
  };

  // 渲染未认证状态
  const renderUnauthorized = () => (
    <div className='p-6'>
      <div className='text-center mb-6'>
        <Typography.Text className='text-gray-500'>
          {t('实名认证后可享受更多服务')}
        </Typography.Text>
      </div>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <Card
          className='cursor-pointer hover:shadow-md transition-shadow border-2 border-dashed border-gray-200 hover:border-teal-300'
          onClick={() => handleStartAuth('personal')}
        >
          <div className='flex flex-col items-center py-6'>
            <div className='w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center mb-4'>
              <IconUser className='text-teal-600' size={32} />
            </div>
            <Typography.Title heading={4} className='text-gray-800'>
              {t('个人认证')}
            </Typography.Title>
            <Typography.Text className='text-gray-500 text-sm mt-2'>
              {t('适合个人用户使用')}
            </Typography.Text>
          </div>
        </Card>

        <Card
          className='cursor-pointer hover:shadow-md transition-shadow border-2 border-dashed border-gray-200 hover:border-blue-300'
          onClick={() => handleStartAuth('company')}
        >
          <div className='flex flex-col items-center py-6'>
            <div className='w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4'>
              <IconGlobe className='text-blue-600' size={32} />
            </div>
            <Typography.Title heading={4} className='text-gray-800'>
              {t('企业认证')}
            </Typography.Title>
            <Typography.Text className='text-gray-500 text-sm mt-2'>
              {t('适合企业用户使用')}
            </Typography.Text>
          </div>
        </Card>
      </div>
    </div>
  );

  // 渲染已认证状态
  const renderAuthorized = () => {
    const statusInfo = getStatusText(authInfo.status);
    return (
      <div className='p-6'>
        <div className='flex items-center justify-between mb-6'>
          <div>
            <Typography.Title heading={4} className='text-gray-800'>
              {authInfo.auth_type === 'personal'
                ? t('个人认证')
                : t('企业认证')}
            </Typography.Title>
            <div
              className='flex items-center mt-2'
              style={{
                color:
                  statusInfo.color === 'green'
                    ? '#16a34a'
                    : statusInfo.color === 'orange'
                      ? '#ea580c'
                      : statusInfo.color === 'red'
                        ? '#dc2626'
                        : '#4b5563',
              }}
            >
              {statusInfo.color === 'green' && (
                <IconTickCircle className='mr-2' />
              )}
              {statusInfo.color === 'orange' && <IconClock className='mr-2' />}
              {statusInfo.color === 'red' && (
                <XCircle size={16} className='mr-2' />
              )}
              {statusInfo.text}
            </div>
          </div>
          {authInfo.status === 'AuditPassed' && (
            <Button
              theme='borderless'
              type='tertiary'
              icon={<IconEdit size={16} />}
              onClick={handleEdit}
            >
              {t('编辑')}
            </Button>
          )}
        </div>

        <div className='mt-4 bg-white rounded-lg p-6'>
          {authInfo.auth_type === 'personal' ? (
            <div className='space-y-4'>
              <div>
                <div className='flex items-center' style={{ gap: '20px' }}>
                  <Typography.Text
                    style={{
                      color: '#1c1f239e',
                      minWidth: '100px',
                      flexShrink: 0,
                    }}
                  >
                    {t('真实姓名')}
                  </Typography.Text>
                  <Typography.Text className='font-medium'>
                    {authInfo.username}
                  </Typography.Text>
                </div>
                <div className='flex items-center' style={{ gap: '20px' }}>
                  <Typography.Text
                    style={{
                      color: '#1c1f239e',
                      minWidth: '100px',
                      flexShrink: 0,
                    }}
                  >
                    {t('身份证号码')}
                  </Typography.Text>
                  <Typography.Text className='font-medium'>
                    {maskIdCard(authInfo.person_icard)}
                  </Typography.Text>
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <Button onClick={(e) => handleStartAuth("company")}>
                  {t('企业认证>>')}
                </Button>
              </div>
            </div>
          ) : (
            <div className='space-y-4'>
              <div className='flex items-center' style={{ gap: '20px' }}>
                <Typography.Text
                  style={{
                    color: '#1c1f239e',
                    minWidth: '140px',
                    flexShrink: 0,
                  }}
                >
                  {t('企业名称')}
                </Typography.Text>
                <Typography.Text className='font-medium'>
                  {authInfo.company_name}
                </Typography.Text>
              </div>
              <div className='flex items-center' style={{ gap: '20px' }}>
                <Typography.Text
                  style={{
                    color: '#1c1f239e',
                    minWidth: '140px',
                    flexShrink: 0,
                  }}
                >
                  {t('统一社会信用代码')}
                </Typography.Text>
                <Typography.Text className='font-medium'>
                  {maskIdCard(authInfo.uscc)}
                </Typography.Text>
              </div>
              <div className='flex items-center' style={{ gap: '20px' }}>
                <Typography.Text
                  style={{
                    color: '#1c1f239e',
                    minWidth: '140px',
                    flexShrink: 0,
                  }}
                >
                  {t('法人姓名')}
                </Typography.Text>
                <Typography.Text className='font-medium'>
                  {authInfo.username}
                </Typography.Text>
              </div>
              {authInfo && authInfo.company_business_license && (
                <div className='flex items-center' style={{ gap: '20px' }}>
                  <Typography.Text
                    style={{
                      color: '#1c1f239e',
                      minWidth: '140px',
                      flexShrink: 0,
                    }}
                  >
                    {t('营业执照')}
                  </Typography.Text>
                  <Typography.Text
                    style={{ color: '#1890ff', cursor: 'pointer' }}
                    onClick={handlePreviewLicense}
                  >
                    {t('查看')}
                  </Typography.Text>
                </div>
              )}
              <div className='flex items-center' style={{ gap: '20px' }}>
                <Typography.Text
                  style={{
                    color: '#1c1f239e',
                    minWidth: '140px',
                    flexShrink: 0,
                  }}
                >
                  {t('联系人姓名')}
                </Typography.Text>
                <Typography.Text className='font-medium'>
                  {authInfo.company_contact_person}
                </Typography.Text>
              </div>
              <div className='flex items-center' style={{ gap: '20px' }}>
                <Typography.Text
                  style={{
                    color: '#1c1f239e',
                    minWidth: '140px',
                    flexShrink: 0,
                  }}
                >
                  {t('联系电话')}
                </Typography.Text>
                <Typography.Text className='font-medium'>
                  {maskPhone(authInfo.company_contact_phone)}
                </Typography.Text>
              </div>
            </div>
          )}
        </div>

        {authInfo.status === 'AuditRejected' && (
          <div className='mt-4 p-3 bg-red-50 rounded-lg'>
            <Typography.Text
              className='text-red-600 text-sm'
              style={{ color: '#FFB848', fontSize: '12px' }}
            >
              {t('审核未通过，请重新提交认证信息')}
            </Typography.Text>
            <div className='mt-3 flex items-center gap-4'>
              <Button
                theme='solid'
                type='primary'
                onClick={() => handleStartAuth(authInfo.auth_type)}
              >
                {t('重新认证')}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 渲染加载状态
  if (loading) {
    return (
      <div className='flex justify-center items-center py-12'>
        <Typography.Text>{t('加载中...')}</Typography.Text>
      </div>
    );
  }

  // 主渲染逻辑
  return (
    <>
      {/* 根据认证状态渲染内容 */}
      {!authInfo ? renderUnauthorized() : renderAuthorized()}

      {/* 营业执照预览模态框 */}
     
      {authInfo && authInfo.company_business_license && (
        <Modal
          visible={showLicenseModal}
          onCancel={() => setShowLicenseModal(false)}
          footer={null}
          width={800}
          closable
        >
          <img
            src={`data:image/png;base64,${licenseB64Content}`}
            alt={t('营业执照')}
            style={{ width: '100%' }}
          />
        </Modal>
      )}
      
    </>
  );
};

export default RealNameAuth;