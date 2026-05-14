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

import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Layout,
  Card,
  Typography,
  TextArea,
  Button,
  Select,
  Toast,
  Spin,
  Modal,
} from '@douyinfe/semi-ui';
import { UserContext } from '../../context/User';
import {
  API,
  getUserIdFromLocalStorage,
  processGroupsData,
  showError,
} from '../../helpers';
import { API_ENDPOINTS } from '../../constants/playground.constants';

const { Title, Paragraph, Text } = Typography;

const SIZE_OPTIONS = [
  { label: '1024×1024', value: '1024x1024' },
  { label: '1024×768', value: '1024x768' },
  { label: '768×1024', value: '768x1024' },
];

const TextToImage = () => {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1024x1024');
  const [group, setGroup] = useState('');
  const [groups, setGroups] = useState([]);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxLength, setMaxLength] = useState(2048);
  const [loading, setLoading] = useState(false);
  const [imageSrc, setImageSrc] = useState('');
  const [showGenerationPreview, setShowGenerationPreview] = useState(false);

  const loadGroups = useCallback(async () => {
    try {
      const res = await API.get(API_ENDPOINTS.USER_GROUPS);
      const { success, message, data } = res.data;
      if (!success) {
        showError(t(message));
        return;
      }
      const userGroup =
        userState?.user?.group ||
        JSON.parse(localStorage.getItem('user') || '{}')?.group;
      const groupOptions = processGroupsData(data, userGroup);
      setGroups(groupOptions);
      const first = groupOptions[0]?.value || 'default';
      setGroup((g) => {
        const normalizedG = g === '' ? 'default' : g;
        if (normalizedG && groupOptions.some((o) => o.value === normalizedG)) return normalizedG;
        return first;
      });
    } catch (e) {
      showError(t('加载分组失败'));
    }
  }, [t, userState?.user?.group]);

  useEffect(() => {
    if (userState?.user) {
      loadGroups();
    }
  }, [userState?.user, loadGroups]);

  useEffect(() => {
    if (!userState?.user) return;
    const loadTextToImageModels = async () => {
      try {
        const res = await API.get(API_ENDPOINTS.USER_MODELS, {
          params: { model_type: 2 },
        });
        const { success, message, data } = res.data;
        if (!success) {
          showError(t(message));
          return;
        }
        const modelList = Array.isArray(data) ? data : data?.items || [];
        const options = modelList
          .map((item) => ({
            label: item.model_name || item,
            value: item.model_name || item,
          }))
          .filter((item) => item.value);
        setModels(options);
        setModel(options[0]?.value || '');
      } catch (e) {
        showError(t('加载模型失败'));
      }
    };

    loadTextToImageModels();
  }, [t, userState?.user]);

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      showError(t('请输入画面描述'));
      return;
    }
    setLoading(true);
    setShowGenerationPreview(true);
    setImageSrc('');
    try {
      const body = {
        model,
        prompt: trimmed,
        size,
        response_format: 'b64_json',
        group: group || undefined,
        temperature,
        max_length: maxLength,
      };
      const res = await fetch(API_ENDPOINTS.IMAGES_GENERATIONS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'New-Api-User': getUserIdFromLocalStorage(),
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        showError(t('文生图请求失败'));
        return;
      }
      if (!res.ok) {
        const msg =
          json?.error?.message ||
          json?.message ||
          text ||
          t('文生图请求失败');
        showError(typeof msg === 'string' ? msg : t('文生图请求失败'));
        return;
      }
      const b64 = json?.data?.[0]?.b64_json;
      const url = json?.data?.[0]?.url;
      if (url) {
        setImageSrc(url);
      } else if (b64) {
        setImageSrc(`data:image/png;base64,${b64}`);
      } else {
        showError(t('文生图请求失败'));
        setShowGenerationPreview(false);
        return;
      }
      Toast.success(t('图片生成完成'));
    } catch (e) {
      showError(e?.message || t('文生图请求失败'));
      setShowGenerationPreview(false);
    } finally {
      setLoading(false);
    }
  };

  const promptExamples = [
    {
      title: '未来城市',
      prompt: '一个宁静的未来城市日落，柔和的霓虹倒影，电影级照明，超细节。',
      image: '/example/city-sunset.png',
    },
    {
      title: '小猫窗台',
      prompt: '一只毛茸茸的小猫坐在窗台上看雨，暖色室内灯光，治愈感，高清细节。',
      image: '/example/cat.png',
    },
    {
      title: '森林小屋',
      prompt: '暮色中的森林小屋，薄雾缭绕，木质纹理清晰，柔和灯光，童话氛围。',
      image: '/example/forest.png',
    },
    {
      title: '赛博花园',
      prompt: '夜晚的赛博花园，发光植物、透明玻璃步道、蓝紫色霓虹、未来感十足。',
      image: '/example/garden.png',
    },
  ];

  const [previewImage, setPreviewImage] = useState(null);

  const handleExamplePromptClick = (item) => {
    setPrompt(item.prompt);
  };

  const handleExampleImageClick = (item) => {
    setPreviewImage(item);
  };

  return (
    <Layout
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(99, 102, 241, 0.12), transparent 28%), radial-gradient(circle at top right, rgba(236, 72, 153, 0.09), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)',
        padding: '2rem',
      }}
    >
      <Layout.Content
        style={{
          width: '100%',
          maxWidth: 1280,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(340px, 440px) minmax(0, 1fr)',
            gap: 24,
            alignItems: 'stretch',
          }}
        >
          <Card
            style={{
              borderRadius: 32,
              padding: 32,
              boxShadow: '0 24px 70px rgba(15, 23, 42, 0.14)',
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(18px)',
              height: 'fit-content',
            }}
            bodyStyle={{ padding: 0 }}
          >
            <div style={{ marginBottom: 28 }}>
              <Title heading={2} style={{ marginBottom: 12 }}>
                {t('文生图')}
              </Title>
              <Paragraph type='tertiary' style={{ marginBottom: 0, fontSize: 16 }}>
                {t('文生图说明')}
              </Paragraph>
            </div>

            <div style={{ display: 'grid', gap: 20 }}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('模型')}
                </Text>
                <Select
                  style={{ width: '100%' }}
                  optionList={models}
                  value={model}
                  onChange={setModel}
                  disabled={!models.length}
                  placeholder={t('暂无可用文生图模型')}
                />
              </div>

              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('分组')}
                </Text>
                <Select
                  style={{ width: '100%' }}
                  optionList={groups}
                  value={group || 'default'}
                  onChange={setGroup}
                  disabled={!groups.length}
                />
              </div>

              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('尺寸')}
                </Text>
                <Select
                  style={{ width: '100%' }}
                  optionList={SIZE_OPTIONS}
                  value={size}
                  onChange={setSize}
                />
              </div>

              <div>
                <Text strong style={{ display: 'block', marginBottom: 10 }}>
                  温度：{temperature.toFixed(1)}
                </Text>
                <input
                  type='range'
                  min='0'
                  max='1.5'
                  step='0.1'
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#6366f1' }}
                />
              </div>

              <div>
                <Text strong style={{ display: 'block', marginBottom: 10 }}>
                  最大长度：{maxLength}
                </Text>
                <input
                  type='range'
                  min='256'
                  max='4096'
                  step='256'
                  value={maxLength}
                  onChange={(e) => setMaxLength(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#ec4899' }}
                />
              </div>

              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('输入')}
                </Text>
                <TextArea
                  value={prompt}
                  onChange={setPrompt}
                  rows={6}
                  placeholder={t('请输入画面描述')}
                  style={{ marginTop: 0, borderRadius: 20 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button
                  theme='solid'
                  type='primary'
                  onClick={handleGenerate}
                  loading={loading}
                  disabled={loading}
                  style={{ borderRadius: 9999, paddingInline: 24 }}
                >
                  {t('生成')}
                </Button>
                <Button
                  type='tertiary'
                  onClick={() =>
                    alert(
                      `模型: ${model || '无可用模型'}\n温度: ${temperature.toFixed(1)}\n最大长度: ${maxLength}\n尺寸: ${size}\n分组: ${group || 'default'}\n注意: 使用 openapi 生成图片，计费规则与 /v1/images/generations 一致。`, 
                    )
                  }
                  style={{ borderRadius: 9999, paddingInline: 24 }}
                >
                  应用参数
                </Button>
              </div>
            </div>
          </Card>

          <Card
            style={{
              borderRadius: 32,
              padding: 24,
              boxShadow: '0 24px 70px rgba(15, 23, 42, 0.1)',
              background: 'rgba(255, 255, 255, 0.82)',
              backdropFilter: 'blur(18px)',
              minHeight: 720,
            }}
            bodyStyle={{ padding: 0, height: '100%' }}
          >
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {showGenerationPreview ? null : (
                  <>
                    <Title heading={4} style={{ marginBottom: 0 }}>
                      图片示例区
                    </Title>
                    <Paragraph type='tertiary' style={{ marginBottom: 0 }}>
                      点击卡片可将提示词填入输入框，直接体验生成效果。
                    </Paragraph>
                  </>
                )}
              </div>

              <div
                style={{
                  position: 'relative',
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {showGenerationPreview ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 5,
                      borderRadius: 22,
                      overflow: 'hidden',
                      background: 'rgba(255, 255, 255, 0.98)',
                      boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ padding: 16, borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                      <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 18, color: '#0f172a' }}>
                        生成图片预览
                      </Text>
                      <Paragraph style={{ marginBottom: 0, lineHeight: 1.7, color: '#475569' }}>
                        {loading ? '图片正在生成中，请稍候…' : '这里显示最新生成的图片。'}
                      </Paragraph>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        padding: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: 18,
                          overflow: 'hidden',
                          background: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid rgba(15,23,42,0.08)',
                        }}
                      >
                        {loading && !imageSrc ? (
                          <Spin size='large' tip='正在生成...' />
                        ) : (
                          <img
                            src={imageSrc}
                            alt='generated preview'
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                              cursor: 'zoom-in',
                            }}
                            onClick={() => setPreviewImage({ title: '生成图片预览', image: imageSrc, prompt })}
                          />
                        )}
                      </div>
                    </div>
                    <div style={{ padding: 16, borderTop: '1px solid rgba(15,23,42,0.08)' }}>
                      <Text strong style={{ display: 'block', marginBottom: 8, color: '#0f172a' }}>
                        当前提示词
                      </Text>
                      <Paragraph style={{ marginBottom: 0, lineHeight: 1.7, color: '#475569' }}>
                        {prompt || '暂无提示词'}
                      </Paragraph>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 16,
                      alignItems: 'stretch',
                    }}
                  >
                    {promptExamples.map((item) => (
                      <Card
                        key={item.title}
                        bodyStyle={{ padding: 0 }}
                        style={{
                          borderRadius: 22,
                          overflow: 'hidden',
                          background: 'rgba(255,255,255,0.9)',
                          border: '1px solid rgba(99, 102, 241, 0.12)',
                          boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
                          cursor: 'pointer',
                          transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-6px)';
                          e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.28)';
                          e.currentTarget.style.boxShadow = '0 18px 40px rgba(15, 23, 42, 0.14)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.12)';
                          e.currentTarget.style.boxShadow = '0 12px 30px rgba(15, 23, 42, 0.08)';
                        }}
                      >
                        <div
                          style={{
                            position: 'relative',
                            aspectRatio: '4 / 3',
                            overflow: 'hidden',
                            background: '#e2e8f0',
                          }}
                        >
                          <img
                            src={item.image}
                            alt={item.title}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                              transition: 'transform 0.3s ease',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExampleImageClick(item);
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.08)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              left: 12,
                              top: 12,
                              padding: '6px 10px',
                              borderRadius: 9999,
                              background: 'rgba(15, 23, 42, 0.72)',
                              color: '#fff',
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            点击放大
                          </div>
                        </div>
                        <div
                          style={{ padding: 16 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExamplePromptClick(item);
                          }}
                        >
                          <Text strong style={{ display: 'block', marginBottom: 8 }}>
                            {item.title}
                          </Text>
                          <Paragraph style={{ marginBottom: 0, lineHeight: 1.7 }}>
                            {item.prompt}
                          </Paragraph>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <Modal
                title={previewImage?.title || '图片预览'}
                visible={Boolean(previewImage)}
                onCancel={() => setPreviewImage(null)}
                footer={null}
                centered
                width={840}
                bodyStyle={{ padding: 0, overflow: 'hidden', borderRadius: 24 }}
              >
                {previewImage && (
                  <div style={{ background: '#0f172a' }}>
                    <div style={{ width: '100%', aspectRatio: '16 / 10', overflow: 'hidden' }}>
                      <img
                        src={previewImage.image}
                        alt={previewImage.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    </div>
                    <div style={{ padding: 20, background: '#fff' }}>
                      <Text strong style={{ display: 'block', marginBottom: 10, fontSize: 18 }}>
                        {previewImage.title}
                      </Text>
                      <Paragraph style={{ marginBottom: 0, lineHeight: 1.75, fontSize: 15 }}>
                        {previewImage.prompt}
                      </Paragraph>
                    </div>
                  </div>
                )}
              </Modal>
            </div>
          </Card>
        </div>
      </Layout.Content>
    </Layout>
  );
};

export default TextToImage;
