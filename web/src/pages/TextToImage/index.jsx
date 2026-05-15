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
  renderGroupOption,
  selectFilter,
} from '../../helpers';
import { API_ENDPOINTS } from '../../constants/playground.constants';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import SettingsPanel from '../../components/playground/SettingsPanel';
import ChatArea from '../../components/playground/ChatArea';
import FloatingButtons from '../../components/playground/FloatingButtons';
import { PlaygroundProvider } from '../../contexts/PlaygroundContext';

const { Title, Paragraph, Text } = Typography;

const SIZE_OPTIONS = [
  { label: '1024×1024', value: '1024x1024' },
  { label: '1024×768', value: '1024x768' },
  { label: '768×1024', value: '768x1024' },
];

const TextToImage = () => {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  const isMobile = useIsMobile();
  const styleState = { isMobile };

  // 使用与 Playground 一致的状态管理
  const [inputs, setInputs] = useState({
    model: '',
    group: '',
    size: '1024x1024',
    prompt: '',
    temperature: 0.7,
    top_p: 1,
    max_tokens: 4096,
    frequency_penalty: 0,
    presence_penalty: 0,
    seed: null,
    stream: true,
    imageEnabled: false,
    imageUrls: [''],
  });
  const [parameterEnabled, setParameterEnabled] = useState({
    temperature: true,
    top_p: true,
    max_tokens: false,
    frequency_penalty: true,
    presence_penalty: true,
    seed: false,
  });
  const [models, setModels] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showSettings, setShowSettings] = useState(!isMobile);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [customRequestMode, setCustomRequestMode] = useState(false);
  const [customRequestBody, setCustomRequestBody] = useState('');
  const [previewPayload, setPreviewPayload] = useState(null);

  // 图片展示状态
  const [loading, setLoading] = useState(false);
  const [imageSrc, setImageSrc] = useState('');
  const [showGenerationPreview, setShowGenerationPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // 加载分组
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
      const first = groupOptions[0]?.value || '';
      setInputs((prev) => ({ ...prev, group: first }));
    } catch (e) {
      showError(t('加载分组失败'));
    }
  }, [t, userState?.user?.group]);

  // 加载文生图模型
  const loadTextToImageModels = useCallback(async () => {
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
      if (options.length > 0) {
        setInputs((prev) => ({ ...prev, model: options[0].value }));
      }
    } catch (e) {
      showError(t('加载模型失败'));
    }
  }, [t]);

  useEffect(() => {
    if (userState?.user) {
      loadGroups();
      loadTextToImageModels();
    }
  }, [userState?.user, loadGroups, loadTextToImageModels]);

  // 处理输入变化
  const handleInputChange = useCallback((name, value) => {
    setInputs((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleParameterToggle = useCallback((paramName) => {
    setParameterEnabled((prev) => ({
      ...prev,
      [paramName]: !prev[paramName],
    }));
  }, []);

  // 生成图片
  const handleGenerate = async () => {
    const trimmed = inputs.prompt.trim();
    if (!trimmed) {
      showError(t('请输入画面描述'));
      return;
    }
    if (!inputs.model) {
      showError(t('暂无可用文生图模型'));
      return;
    }
    setLoading(true);
    setShowGenerationPreview(true);
    setImageSrc('');
    try {
      const body = {
        model: inputs.model,
        prompt: trimmed,
        size: inputs.size,
        response_format: 'b64_json',
        group: inputs.group || undefined,
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
        setShowGenerationPreview(false);
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

  // 提示词示例
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

  const handleExamplePromptClick = (item) => {
    handleInputChange('prompt', item.prompt);
  };

  const handleExampleImageClick = (item) => {
    setPreviewImage(item);
  };

  // 构建预览请求体
  const constructPreviewPayload = useCallback(() => {
    try {
      const body = {
        model: inputs.model,
        prompt: inputs.prompt,
        size: inputs.size,
        response_format: 'b64_json',
        group: inputs.group || undefined,
      };
      return body;
    } catch (error) {
      console.error('构造预览请求体失败:', error);
      return null;
    }
  }, [inputs]);

  // 构建预览payload
  useEffect(() => {
    const timer = setTimeout(() => {
      const preview = constructPreviewPayload();
      setPreviewPayload(preview);
    }, 300);

    return () => clearTimeout(timer);
  }, [inputs, constructPreviewPayload]);

  // 处理粘贴图片
  const handlePasteImage = useCallback(
    (base64Data) => {
      if (!inputs.imageEnabled) {
        return;
      }
      const newUrls = [...(inputs.imageUrls || []), base64Data];
      handleInputChange('imageUrls', newUrls);
    },
    [inputs.imageEnabled, inputs.imageUrls, handleInputChange],
  );

  // Playground Context 值
  const playgroundContextValue = {
    onPasteImage: handlePasteImage,
    imageUrls: inputs.imageUrls || [],
    imageEnabled: inputs.imageEnabled || false,
  };

  return (
    <PlaygroundProvider value={playgroundContextValue}>
      <div className='h-full'>
        <Layout className='h-full bg-transparent flex flex-col md:flex-row'>
          {(showSettings || !isMobile) && (
            <Layout.Sider
              className={`
              bg-transparent border-r-0 flex-shrink-0 overflow-auto mt-[60px]
              ${
                isMobile
                  ? 'fixed top-0 left-0 right-0 bottom-0 z-[1000] w-full h-auto bg-white shadow-lg'
                  : 'relative z-[1] w-80 h-[calc(100vh-66px)]'
              }
            `}
              width={isMobile ? '100%' : 320}
            >
              <SettingsPanel
                inputs={inputs}
                parameterEnabled={parameterEnabled}
                models={models}
                groups={groups}
                styleState={styleState}
                showSettings={showSettings}
                showDebugPanel={showDebugPanel}
                customRequestMode={customRequestMode}
                customRequestBody={customRequestBody}
                onInputChange={handleInputChange}
                onParameterToggle={handleParameterToggle}
                onCloseSettings={() => setShowSettings(false)}
                onConfigImport={() => {}}
                onConfigReset={() => {
                  setInputs({
                    model: inputs.model,
                    group: inputs.group,
                    size: '1024x1024',
                    prompt: '',
                    temperature: 0.7,
                    top_p: 1,
                    max_tokens: 4096,
                    frequency_penalty: 0,
                    presence_penalty: 0,
                    seed: null,
                    stream: true,
                    imageEnabled: false,
                    imageUrls: [''],
                  });
                  setParameterEnabled({
                    temperature: true,
                    top_p: true,
                    max_tokens: false,
                    frequency_penalty: true,
                    presence_penalty: true,
                    seed: false,
                  });
                }}
                onCustomRequestModeChange={setCustomRequestMode}
                onCustomRequestBodyChange={setCustomRequestBody}
                previewPayload={previewPayload}
                messages={[]}
                sizeOptions={SIZE_OPTIONS}
                hideParameterControl={true}
                hideConfigManager={true}
              >
                <Button
                  theme='solid'
                  type='primary'
                  onClick={handleGenerate}
                  loading={loading}
                  disabled={loading || !inputs.model}
                  block
                  style={{ borderRadius: 4 }}
                >
                  {t('生成图片')}
                </Button>
              </SettingsPanel>
            </Layout.Sider>
          )}

          <Layout.Content className='relative flex-1 overflow-hidden'>
            <div className='overflow-hidden flex flex-col lg:flex-row h-[calc(100vh-66px)] mt-[60px]'>
              <div className='flex-1 flex flex-col'>
                <div className='p-4 md:p-8 h-full overflow-y-auto'>
                  <div
                    style={{
                      maxWidth: 1280,
                      margin: '0 auto',
                    }}
                  >
                    <Card
                      style={{
                        borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(1, 1, 32, 0.1)',
                        background: 'rgba(255, 255, 255, 0.9)',
                        height: '100%',
                        minHeight: 500,
                      }}
                      bodyStyle={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}
                    >
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {/* 图片展示区 */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                          {showGenerationPreview ? (
                            <div
                              style={{
                                flex: 1,
                                minHeight: 300,
                                borderRadius: 8,
                                overflow: 'hidden',
                                background: '#f8fafc',
                                border: '1px solid rgba(15,23,42,0.08)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {loading && !imageSrc ? (
                                <div style={{ textAlign: 'center' }}>
                                  <Spin size='large' tip={t('正在生成...')} />
                                  <Paragraph type='tertiary' style={{ marginTop: 16 }}>
                                    {t('图片正在生成中，请稍候')}
                                  </Paragraph>
                                </div>
                              ) : imageSrc ? (
                                <img
                                  src={imageSrc}
                                  alt={t('生成的图片')}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    display: 'block',
                                    cursor: 'zoom-in',
                                  }}
                                  onClick={() => setPreviewImage({ title: t('生成图片预览'), image: imageSrc, prompt: inputs.prompt })}
                                />
                              ) : null}
                            </div>
                          ) : (
                            <>
                              {/* 图片示例区 */}
                              <div style={{ marginBottom: 8 }}>
                                <Title heading={5} style={{ marginBottom: 8 }}>
                                  {t('灵光一闪')}
                                </Title>
                                <Paragraph type='tertiary' style={{ marginBottom: 0, fontSize: 14 }}>
                                  {t('点击卡片可将提示词填入输入框，直接体验生成效果')}
                                </Paragraph>
                              </div>

                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                                  gap: 20,
                                }}
                              >
                                {promptExamples.map((item) => (
                                  <Card
                                    key={item.title}
                                    bodyStyle={{ padding: 0 }}
                                    style={{
                                      borderRadius: 8,
                                      overflow: 'hidden',
                                      background: '#fff',
                                      border: '1px solid rgba(99, 102, 241, 0.12)',
                                      cursor: 'pointer',
                                      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = 'translateY(-4px)';
                                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(1, 1, 32, 0.12)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = 'translateY(0)';
                                      e.currentTarget.style.boxShadow = 'none';
                                    }}
                                    onClick={() => handleExamplePromptClick(item)}
                                  >
                                    <div
                                      style={{
                                        position: 'relative',
                                        aspectRatio: '16 / 9',
                                        overflow: 'hidden',
                                        background: '#f1f5f9',
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
                                          cursor: 'zoom-in',
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleExamplePromptClick(item);
                                          setPreviewImage(item);
                                        }}
                                      />
                                    </div>
                                    <div
                                      style={{ padding: 16 }}
                                    >
                                      <Text strong style={{ display: 'block', marginBottom: 6, fontSize: 15 }}>
                                        {item.title}
                                      </Text>
                                      <Paragraph style={{ marginBottom: 0, fontSize: 14, lineHeight: 1.6 }}>
                                        {item.prompt}
                                      </Paragraph>
                                    </div>
                                  </Card>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            </div>

            {/* 浮动按钮 */}
            <FloatingButtons
              styleState={styleState}
              showSettings={showSettings}
              showDebugPanel={showDebugPanel}
              onToggleSettings={() => setShowSettings(!showSettings)}
              onToggleDebugPanel={() => setShowDebugPanel(!showDebugPanel)}
            />
          </Layout.Content>
        </Layout>
      </div>

      {/* 图片预览 Modal */}
      <Modal
        title={previewImage?.title || t('图片预览')}
        visible={Boolean(previewImage)}
        onCancel={() => setPreviewImage(null)}
        footer={null}
        centered
        width={840}
        bodyStyle={{ padding: 0, overflow: 'hidden', borderRadius: 8 }}
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
            {previewImage.prompt && (
              <div style={{ padding: 20, background: '#fff' }}>
                <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 16 }}>
                  {t('提示词')}
                </Text>
                <Paragraph style={{ marginBottom: 0, lineHeight: 1.75, fontSize: 15 }}>
                  {previewImage.prompt}
                </Paragraph>
              </div>
            )}
          </div>
        )}
      </Modal>
    </PlaygroundProvider>
  );
};

export default TextToImage;
