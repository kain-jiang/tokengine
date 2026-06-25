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
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Card,
  Typography,
  Form,
  Breadcrumb,
  Modal,
  Input,
} from '@douyinfe/semi-ui';
import {
  IconUser,
  IconGlobe,
  IconUpload,
  IconChevronLeft,
  IconPlus,
  IconDelete,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const RealNameAuthForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authType = searchParams.get('type') || 'personal';
  const isEditing = searchParams.get('edit') === 'true';

  const [formData, setFormData] = useState({
    username: '',
    company_name: '',
    uscc: '',
    company_business_license: '',
    company_contact_person: '',
    company_contact_phone: '',
    mediaUrl: ""
  });

  const [loading, setLoading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showBusinessLicenseModal, setShowBusinessLicenseModal] =
    useState(false);

  useEffect(() => {
    if (isEditing) {
      loadAuthInfo();
    }
  }, [isEditing]);

  const loadAuthInfo = async () => {
    try {
      const res = await API.get('/api/user/realname/auth');
      if (res.data.success && res.data.data) {
        const data = res.data.data;
        let licenseBase64 = '';
        
        if (data.company_business_license) {
          try {
            const mediaRes = await API.get(data.company_business_license);
            if (mediaRes.data.success && mediaRes.data.data.content) {
              licenseBase64 = `data:image/png;base64,${mediaRes.data.data.content}`;
            }
          } catch (e) {
            console.error('获取营业执照图片失败:', e);
          }
        }
        
        const newData = {
          username: data.username || '',
          person_icard: data.person_icard || '',
          company_name: data.company_name || '',
          uscc: data.uscc || '',
          company_business_license: licenseBase64,
          company_contact_person: data.company_contact_person || '',
          company_contact_phone: data.company_contact_phone || '',
          mediaUrl: data.company_business_license || ''
        };
        setFormData(newData);
      }
    } catch (error) {
      showError(
        error.response?.data?.message || error.message || t('获取认证信息失败'),
      );
    }
  };

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await API.post('/api/user/upload', formData, {
        headers: {
          ...API.defaults.headers,
          'Content-Type': 'multipart/form-data',
        },
      });
      if (res.data.success) {
        // base64展示图片
        setFormData((prev) => ({
          ...prev,
          company_business_license:
            'data:image/png;base64,' + res.data.data.content,
          mediaUrl: res.data.data.url
        }));
        showSuccess(t('营业执照上传成功'));
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('上传失败'));
    } finally {
      // 重置文件上传input的value，以便可以重新选择文件
      const uploadInput = document.getElementById('business-license-upload');
      if (uploadInput) {
        uploadInput.value = '';
      }
    }
  };

  const handleSubmit = async () => {
    if (authType === 'personal') {
      if (!formData.username || !formData.person_icard) {
        showError(t('请填写完整信息'));
        return;
      }
      if (!/^\d{17}[\dXx]$/.test(formData.person_icard)) {
        showError(t('请输入正确的身份证号码'));
        return;
      }
    } else {
      // 企业认证：企业名称、统一社会信用代码、法人姓名、营业执照为必填
      if (
        !formData.company_name ||
        !formData.uscc ||
        !formData.username ||
        !formData.company_business_license
      ) {
        showError(t('请填写完整信息'));
        return;
      }
      if (!/^\S{18}$/.test(formData.uscc)) {
        showError(t('请输入正确的统一社会信用代码'));
        return;
      }
      // 联系人姓名和联系电话为可选，如果填写了则验证格式
      if (
        formData.company_contact_phone &&
        !/^1[3-9]\d{9}$/.test(formData.company_contact_phone)
      ) {
        showError(t('请输入正确的联系电话'));
        return;
      }
    }

    setLoading(true);
    try {
      const res = await API.post('/api/user/realname/auth', {
        auth_type: authType,
        ...formData,
      });
      if (res.data.success) {
        showSuccess(t('提交成功，等待审核'));
        navigate('/console/personal?tab=realname');
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(
        error.response?.data?.message || error.message || t('提交失败'),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/console/personal?tab=realname');
  };

  return (
    <div className='p-6 max-w-4xl mx-auto' style={{ paddingTop: '50px' }}>
      <div className='mb-6'>
        <Button
          theme='borderless'
          type='tertiary'
          icon={<IconChevronLeft />}
          onClick={handleBack}
          className='mb-4'
        >
          {t('返回')}
        </Button>
        <Breadcrumb>
          <Breadcrumb.Item onClick={handleBack} className='cursor-pointer'>
            {t('个人设置')}
          </Breadcrumb.Item>
          <Breadcrumb.Item onClick={handleBack} className='cursor-pointer'>
            {t('账户管理')}
          </Breadcrumb.Item>
          <Breadcrumb.Item>{t('实名认证')}</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      <Card>
        <div className='mb-6'>
          <Typography.Title heading={3}>
            {isEditing
              ? t('修改认证信息')
              : authType === 'personal'
                ? t('个人实名认证')
                : t('企业实名认证')}
          </Typography.Title>
          <Typography.Text className='text-gray-500'>
            {authType === 'personal'
              ? t('请填写您的真实身份信息')
              : t('请填写企业认证信息')}
          </Typography.Text>
        </div>

        <div className='space-y-4'>
          {authType === 'personal' ? (
            <>
              <div className='space-y-2'>
                <label className='block text-sm font-medium text-gray-700'>
                  {t('真实姓名')}
                  <span className='text-red-500 mr-1' style={{ color: 'red' }}>
                    *
                  </span>
                </label>
                <Input
                  placeholder={t('请输入真实姓名')}
                  value={formData.username}
                  onChange={(value) => handleInputChange('username', value)}
                  className='w-full'
                />
              </div>
              <div className='space-y-2'>
                <label className='block text-sm font-medium text-gray-700'>
                  {t('身份证号码')}
                  <span className='text-red-500 mr-1' style={{ color: 'red' }}>
                    *
                  </span>
                </label>
                <Input
                  placeholder={t('请输入身份证号码')}
                  value={formData.person_icard}
                  onChange={(value) => handleInputChange('person_icard', value)}
                  maxLength={18}
                  className='w-full'
                />
              </div>
            </>
          ) : (
            <>
              <div className='space-y-2'>
                <label className='block text-sm font-medium text-gray-700'>
                  {t('企业名称')}
                  <span className='text-red-500 mr-1' style={{ color: 'red' }}>
                    *
                  </span>
                </label>
                <Input
                  placeholder={t('请输入企业名称')}
                  value={formData.company_name}
                  onChange={(value) => handleInputChange('company_name', value)}
                  className='w-full'
                />
              </div>
              <div className='space-y-2'>
                <label className='block text-sm font-medium text-gray-700'>
                  {t('统一社会信用代码')}
                  <span className='text-red-500 mr-1' style={{ color: 'red' }}>
                    *
                  </span>
                </label>
                <Input
                  placeholder={t('请输入统一社会信用代码')}
                  value={formData.uscc}
                  onChange={(value) => handleInputChange('uscc', value)}
                  maxLength={18}
                  className='w-full'
                />
              </div>
              <div className='space-y-2'>
                <label className='block text-sm font-medium text-gray-700'>
                  {t('法人姓名')}
                  <span className='text-red-500 mr-1' style={{ color: 'red' }}>
                    *
                  </span>
                </label>
                <Input
                  placeholder={t('请输入法人姓名')}
                  value={formData.username}
                  onChange={(value) => handleInputChange('username', value)}
                  className='w-full'
                />
              </div>
              <div className='space-y-2'>
                <label
                  className='block text-sm font-medium text-gray-700'
                  style={{
                    color: '#1c1f23',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  {t('营业执照')}
                  <span className='text-red-500 mr-1' style={{ color: 'red' }}>
                    *
                  </span>
                </label>
                <div className='flex gap-4' style={{ color: '#b0b1b8' }}>
                  <input
                    type='file'
                    accept='image/jpeg,image/jpg,image/png'
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        if (file.size > 3 * 1024 * 1024) {
                          showError(t('文件大小不能超过3MB'));
                          return;
                        }
                        handleFileUpload(file);
                      }
                    }}
                    style={{ display: 'none' }}
                    id='business-license-upload'
                  />
                  <div
                    className='w-32 h-32 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-gray-300 hover:bg-gray-100 transition-colors'
                    onClick={() =>
                      document.getElementById('business-license-upload').click()
                    }
                  >
                    <IconPlus className='text-gray-400 mb-1' size={24} />
                    <Typography.Text
                      className='text-gray-400 text-xs'
                      style={{ color: '#b0b1b8', fontSize: '12px' }}
                    >
                      {t('上传')}
                    </Typography.Text>
                  </div>
                  <div className='flex-1 bg-gray-50 rounded-lg p-3'>
                    <Typography.Text
                      className='text-gray-400 text-xs leading-relaxed'
                      style={{
                        display: 'inline-block',
                        color: '#b0b1b8',
                        fontSize: '12px',
                        width: '400px',
                        wordWrap: 'break-word',
                        whiteSpace: 'normal',
                      }}
                    >
                      {t(
                        '请提供证件的原件照片或彩色扫描件（正副本均可），文字/盖章清晰可辨认。格式要求jpg、jpeg、png，不超过3MB',
                      )}
                    </Typography.Text>
                    <div className='mt-3'>
                      <img
                        src='/yinyezhizhao.png'
                        alt={t('营业执照示例')}
                        className='w-24 h-16 object-contain rounded cursor-pointer hover:opacity-80 transition-opacity'
                        onClick={() => setShowPreviewModal(true)}
                      />
                    </div>
                  </div>
                </div>
                {formData.company_business_license && (
                  <div className='mt-2'>
                    <Typography.Text className='text-gray-500 text-sm mb-1 block'>
                      {t('已上传')}
                    </Typography.Text>
                    <div
                      style={{ position: 'relative', display: 'inline-block' }}
                    >
                      <img
                        src={formData.company_business_license}
                        alt='营业执照'
                        style={{
                          maxWidth: '200px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                        }}
                        onClick={() => setShowBusinessLicenseModal(true)}
                      />
                      {/* 遮罩层 */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'rgba(0, 0, 0, 0)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'flex-end',
                          padding: '8px',
                          transition: 'background-color 0.2s',
                        }}
                        onClick={() => setShowBusinessLicenseModal(true)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor =
                            'rgba(0, 0, 0, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor =
                            'rgba(0, 0, 0, 0)';
                        }}
                      >
                        <div
                          style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '50%',
                            backgroundColor: '#f0f0f0',
                            color: '#666666',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData((prev) => ({
                              ...prev,
                              company_business_license: '',
                            }));
                            // 重置文件上传input的value，以便可以重新选择文件
                            const uploadInput = document.getElementById(
                              'business-license-upload',
                            );
                            if (uploadInput) {
                              uploadInput.value = '';
                            }
                          }}
                        >
                          ×
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 示例图片预览模态框 */}
              <Modal
                visible={showPreviewModal}
                onCancel={() => setShowPreviewModal(false)}
                footer={null}
                width={600}
                closable
              >
                <img
                  src='/yinyezhizhao.png'
                  alt={t('营业执照示例')}
                  className='w-full'
                />
              </Modal>

              {/* 营业执照预览模态框 */}
              <Modal
                visible={showBusinessLicenseModal}
                onCancel={() => setShowBusinessLicenseModal(false)}
                footer={null}
                width={800}
                closable
              >
                <img
                  src={formData.company_business_license}
                  alt={t('营业执照')}
                  className='w-full'
                />
              </Modal>

              <div className='space-y-2'>
                <label className='block text-sm font-medium text-gray-700'>
                  {t('联系人姓名')}
                </label>
                <Input
                  placeholder={t('请输入联系人姓名')}
                  value={formData.company_contact_person}
                  onChange={(value) =>
                    handleInputChange('company_contact_person', value)
                  }
                  className='w-full'
                />
              </div>
              <div className='space-y-2'>
                <label className='block text-sm font-medium text-gray-700'>
                  {t('联系电话')}
                </label>
                <Input
                  placeholder={t('请输入联系电话')}
                  value={formData.company_contact_phone}
                  onChange={(value) =>
                    handleInputChange('company_contact_phone', value)
                  }
                  maxLength={11}
                  className='w-full'
                />
              </div>
            </>
          )}

          <div className='flex justify-end gap-3 pt-4'>
            <Button onClick={handleBack}>{t('取消')}</Button>
            <Button
              theme='solid'
              type='primary'
              onClick={handleSubmit}
              loading={loading}
            >
              {t('确定')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default RealNameAuthForm;
