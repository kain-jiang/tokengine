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
import FloatingButtons from '../../components/playground/FloatingButtons';
import { PlaygroundProvider } from '../../contexts/PlaygroundContext';

const { Title, Paragraph, Text } = Typography;

const RATIO_OPTIONS = [
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
];

const DURATION_OPTIONS = [
  { label: '3 秒', value: 3 },
  { label: '5 秒', value: 5 },
  { label: '8 秒', value: 8 },
  { label: '10 秒', value: 10 },
];

const DEFAULT_FALLBACK_GROUP = 'default';

const normalizeErrorMessage = (error, fallbackMessage) => {
  if (!error) return fallbackMessage;
  if (typeof error === 'string') return error;
  return error?.message || fallbackMessage;
};

const resolveVideoUrl = (payload) => {
  const candidates = [
    payload?.data?.[0]?.url,
    payload?.data?.[0]?.video_url,
    payload?.data?.url,
    payload?.data?.result_url,
    payload?.url,
    payload?.result?.url,
    payload?.result?.video_url,
    payload?.result_url,
  ];
  return candidates.find((item) => typeof item === 'string' && item.trim()) || '';
};

const TextToVideo = () => {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  const isMobile = useIsMobile();
  const styleState = { isMobile };

  // 使用与 Playground 一致的状态管理
  const [inputs, setInputs] = useState({
    model: '',
    group: '',
    ratio: '16:9',
    duration: 5,
    resolution: '720p',
    seed: null,
    prompt: '',
  });
  const [parameterEnabled, setParameterEnabled] = useState({
    seed: false,
  });
  const [models, setModels] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showSettings, setShowSettings] = useState(!isMobile);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [customRequestMode, setCustomRequestMode] = useState(false);
  const [customRequestBody, setCustomRequestBody] = useState('');
  const [previewPayload, setPreviewPayload] = useState(null);

  // 视频展示状态
  const [loading, setLoading] = useState(false);
  const [videoSrc, setVideoSrc] = useState('');
  const [showGenerationPreview, setShowGenerationPreview] = useState(false);
  const [previewVideo, setPreviewVideo] = useState(null);

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
      const first = groupOptions[0]?.value || DEFAULT_FALLBACK_GROUP;
      setInputs((prev) => ({ ...prev, group: first }));
    } catch (e) {
      showError(t('加载分组失败'));
    }
  }, [t, userState?.user?.group]);

  // 加载文生视频模型
  const loadTextToVideoModels = useCallback(async () => {
    try {
      const res = await API.get(API_ENDPOINTS.USER_MODELS, {
        params: { model_type: 3 },
      });
      const { success, message, data } = res.data;
      if (!success) {
        showError(t(message));
        return;
      }
      const modelList = Array.isArray(data) ? data : data?.items || [];
      const options = modelList
        .map((item) => {
          const value = item?.model_name || item?.model || item?.name || item?.modelName || item;
          return {
            label: value,
            value,
          };
        })
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
      loadTextToVideoModels();
    }
  }, [userState?.user, loadGroups, loadTextToVideoModels]);

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

  // 生成视频
  const handleGenerate = async () => {
    const trimmed = inputs.prompt.trim();
    if (!trimmed) {
      showError(t('请输入视频描述'));
      return;
    }
    if (!inputs.model) {
      showError(t('暂无可用文生视频模型'));
      return;
    }
    setLoading(true);
    setShowGenerationPreview(true);
    setVideoSrc('');
    try {
      const selectedGroup = inputs.group || DEFAULT_FALLBACK_GROUP;
      const body = {
        model: inputs.model,
        group: selectedGroup,
        prompt: trimmed,
        duration: inputs.duration,
        // Note: Doubao Seedance models do not accept 'resolution' parameter.
        // They use 'ratio' (aspect ratio) instead. Do not send resolution.
        ratio: inputs.ratio,
      };
      const res = await fetch(API_ENDPOINTS.VIDEO_GENERATIONS, {
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
        showError(t('文生视频请求失败'));
        return;
      }
      if (!res.ok) {
        const msg =
          json?.error?.message ||
          json?.message ||
          text ||
          t('文生视频请求失败');
        showError(typeof msg === 'string' ? msg : t('文生视频请求失败'));
        setShowGenerationPreview(false);
        return;
      }

      const waitTask = async () => {
        for (let i = 0; i < 60; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          const taskRes = await fetch(`${API_ENDPOINTS.VIDEO_GENERATIONS}/${json?.task_id || json?.id}`, {
            headers: {
              'Content-Type': 'application/json',
              'New-Api-User': getUserIdFromLocalStorage(),
            },
          });
          const taskJson = await taskRes.json();
          if (!taskJson) continue;
          const taskStatus = (taskJson?.status || taskJson?.data?.status || '').toLowerCase();
          if (taskStatus === 'succeeded' || taskStatus === 'completed' || taskStatus === 'success' || taskStatus === 'done') {
            const resolved = resolveVideoUrl(taskJson) || resolveVideoUrl(taskJson?.data);
            if (resolved) {
              return resolved;
            }
          }
          if (taskStatus === 'failed' || taskStatus === 'error') {
            throw new Error(taskJson?.error?.message || taskJson?.message || t('视频生成失败'));
          }
        }
        return null;
      };

      const url = resolveVideoUrl(json);
      if (url) {
        setVideoSrc(url);
        Toast.success(t('视频生成完成'));
      } else {
        const taskId = json?.task_id || json?.id;
        if (!taskId) {
          showError(t('文生视频请求失败'));
          setShowGenerationPreview(false);
          return;
        }
        const completedUrl = await waitTask();
        if (completedUrl) {
          setVideoSrc(completedUrl);
          Toast.success(t('视频生成完成'));
        } else {
          Toast.info(t('视频任务已提交，生成时间较长，请稍后到任务中心查看结果'));
          setShowGenerationPreview(false);
        }
      }
    } catch (e) {
      showError(e?.message || t('文生视频请求失败'));
      setShowGenerationPreview(false);
    } finally {
      setLoading(false);
    }
  };

  // 提示词示例
  const promptExamples = [
    {
      title: '城市穿梭',
      prompt: '镜头穿过未来城市街道，霓虹灯反射在湿润地面上，电影感强，动态流畅。',
      image: '/example/city-sunset.png',
    },
    {
      title: '海边日落',
      prompt: '海边日落下，海浪缓缓拍岸，逆光剪影，画面温暖宁静。',
      image: '/example/cat.png',
    },
    {
      title: '森林漫步',
      prompt: '穿过晨雾森林的小路，阳光透过树叶洒落，轻柔运镜，氛围自然。',
      image: '/example/forest.png',
    },
    {
      title: '赛博舞台',
      prompt: '赛博朋克舞台上，灯光随音乐闪烁，镜头围绕主角缓慢推进，视觉冲击强。',
      image: '/example/garden.png',
    },
  ];

  const handleExamplePromptClick = (item) => {
    handleInputChange('prompt', item.prompt);
  };

  const handleExampleImageClick = (item) => {
    setPreviewVideo(item);
  };

  // 构建预览请求体
  const constructPreviewPayload = useCallback(() => {
    try {
      const body = {
        model: inputs.model,
        group: inputs.group || undefined,
        prompt: inputs.prompt,
        duration: inputs.duration,
        // Note: Doubao Seedance models do not accept 'resolution' parameter.
        // They use 'ratio' (aspect ratio) instead. Do not send resolution.
        ratio: inputs.ratio,
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

  // Playground Context 值
  const playgroundContextValue = {
    onPasteImage: () => {},
    imageUrls: [],
    imageEnabled: false,
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
                    ratio: '16:9',
                    duration: 5,
                    resolution: '720p',
                    seed: null,
                    prompt: '',
                  });
                  setParameterEnabled({
                    seed: false,
                  });
                }}
                onCustomRequestModeChange={setCustomRequestMode}
                onCustomRequestBodyChange={setCustomRequestBody}
                previewPayload={previewPayload}
                messages={[]}
                ratioOptions={RATIO_OPTIONS}
                durationOptions={DURATION_OPTIONS}
                hideParameterControl={true}
                hideConfigManager={true}
                hideImageUrlInput={true}
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
                  {t('生成视频')}
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
                        {/* 视频展示区 */}
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
                              {loading && !videoSrc ? (
                                <div style={{ textAlign: 'center' }}>
                                  <Spin size='large' tip={t('正在生成...')} />
                                  <Paragraph type='tertiary' style={{ marginTop: 16 }}>
                                    {t('视频正在生成中，请稍候')}
                                  </Paragraph>
                                </div>
                              ) : videoSrc ? (
                                <video
                                  src={videoSrc}
                                  controls
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    display: 'block',
                                    cursor: 'zoom-in',
                                  }}
                                  onClick={() => setPreviewVideo({ title: t('生成视频预览'), video: videoSrc, prompt: inputs.prompt })}
                                />
                              ) : null}
                            </div>
                          ) : (
                            <>
                              {/* 视频示例区 */}
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
                                          setPreviewVideo(item);
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

      {/* 视频预览 Modal */}
      <Modal
        title={previewVideo?.title || t('视频预览')}
        visible={Boolean(previewVideo)}
        onCancel={() => setPreviewVideo(null)}
        footer={null}
        centered
        width={960}
        bodyStyle={{ padding: 0, overflow: 'hidden', borderRadius: 8 }}
      >
        {previewVideo && (
          <div style={{ background: '#0f172a' }}>
            {previewVideo.video ? (
              <video
                src={previewVideo.video}
                controls
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            ) : (
              <div style={{ width: '100%', aspectRatio: '16 / 10', overflow: 'hidden' }}>
                <img
                  src={previewVideo.image}
                  alt={previewVideo.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </div>
            )}
            {previewVideo.prompt && (
              <div style={{ padding: 20, background: '#fff' }}>
                <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 16 }}>
                  {t('提示词')}
                </Text>
                <Paragraph style={{ marginBottom: 0, lineHeight: 1.75, fontSize: 15 }}>
                  {previewVideo.prompt}
                </Paragraph>
              </div>
            )}
          </div>
        )}
      </Modal>
    </PlaygroundProvider>
  );
};

export default TextToVideo;
