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

import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
  InputNumber,
} from '@douyinfe/semi-ui';
import { UserContext } from '../../context/User';
import {
  API,
  getUserIdFromLocalStorage,
  processGroupsData,
  showError,
} from '../../helpers';
import { API_ENDPOINTS } from '../../constants/playground.constants';

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

const { Title, Paragraph, Text } = Typography;

const RATIO_OPTIONS = [
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
];

const RESOLUTION_OPTIONS = [
  { label: '480P', value: '480p' },
  { label: '720P', value: '720p' },
  { label: '1080P', value: '1080p' },
];

const DURATION_OPTIONS = [
  { label: '3 秒', value: 3 },
  { label: '5 秒', value: 5 },
  { label: '8 秒', value: 8 },
  { label: '10 秒', value: 10 },
];

const DEFAULT_VIDEO_MODEL_TYPE = 3;
const DEFAULT_FALLBACK_GROUP = 'default';

const normalizeErrorMessage = (error, fallbackMessage) => {
  if (!error) return fallbackMessage;
  if (typeof error === 'string') return error;
  return error?.message || fallbackMessage;
};

const TextToVideo = () => {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  const [prompt, setPrompt] = useState('');
  const [group, setGroup] = useState('');
  const [groups, setGroups] = useState([]);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState('');
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState('720p');
  const [seed, setSeed] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoSrc, setVideoSrc] = useState('');
  const [showGenerationPreview, setShowGenerationPreview] = useState(false);

  const loadGroups = useCallback(async () => {
    try {
      const res = await API.get(API_ENDPOINTS.USER_GROUPS);
      const { success, message, data } = res.data;
      console.log('[TextToVideo] loadGroups response', { success, message, data });
      if (!success) {
        showError(normalizeErrorMessage(message, t('加载分组失败')));
        setGroups([]);
        setGroup(DEFAULT_FALLBACK_GROUP);
        return;
      }
      const userGroup =
        userState?.user?.group ||
        JSON.parse(localStorage.getItem('user') || '{}')?.group;
      const groupOptions = processGroupsData(data, userGroup) || [];
      console.log('[TextToVideo] loadGroups parsed options', { userGroup, groupOptions });
      setGroups(groupOptions);
      const first = groupOptions[0]?.value || DEFAULT_FALLBACK_GROUP;
      setGroup((g) => {
        const normalizedG = g === '' ? DEFAULT_FALLBACK_GROUP : g;
        if (normalizedG && groupOptions.some((o) => o.value === normalizedG)) return normalizedG;
        return first;
      });
    } catch (e) {
      console.error('Failed to load groups for text-to-video:', e);
      console.error('[TextToVideo] loadGroups error detail', {
        message: e?.message,
        response: e?.response?.data,
        status: e?.response?.status,
      });
      showError(t('加载分组失败'));
      setGroups([]);
      setGroup(DEFAULT_FALLBACK_GROUP);
    }
  }, [t, userState?.user?.group]);

  useEffect(() => {
    if (userState?.user) {
      loadGroups();
    }
  }, [userState?.user, loadGroups]);

  useEffect(() => {
    if (!userState?.user) return;
    const loadTextToVideoModels = async () => {
      try {
        const res = await API.get(API_ENDPOINTS.USER_MODELS, {
          params: { model_type: DEFAULT_VIDEO_MODEL_TYPE },
        });
        const { success, message, data } = res.data;
        console.log('[TextToVideo] loadModels response', { success, message, data });
        if (!success) {
          showError(normalizeErrorMessage(message, t('加载模型失败')));
          setModels([]);
          setModel('');
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
        console.log('[TextToVideo] loadModels parsed options', { modelList, options });
        setModels(options);
        setModel((current) => {
          if (current && options.some((item) => item.value === current)) {
            return current;
          }
          return options[0]?.value || '';
        });
      } catch (e) {
        console.error('Failed to load text-to-video models:', e);
        console.error('[TextToVideo] loadModels error detail', {
          message: e?.message,
          response: e?.response?.data,
          status: e?.response?.status,
        });
        showError(t('加载模型失败'));
        setModels([]);
        setModel('');
      }
    };

    loadTextToVideoModels();
  }, [t, userState?.user]);

  const seedHelper = useMemo(
    () => t('Seed：-1 表示随机生成；0 ~ 4294967295 可复现相同结果'),
    [t],
  );

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      showError(t('请输入视频描述'));
      return;
    }
    if (!model) {
      showError(t('请选择模型'));
      return;
    }
    console.log('[TextToVideo] handleGenerate start', {
      model,
      group,
      duration,
      aspectRatio,
      resolution,
      seed,
      prompt: trimmed,
      userId: getUserIdFromLocalStorage(),
      availableModels: models,
    });
    setLoading(true);
    setShowGenerationPreview(true);
    setVideoSrc('');
    try {
      const selectedGroup = group || DEFAULT_FALLBACK_GROUP;
      const body = {
        model,
        group: selectedGroup,
        prompt: trimmed,
        duration,
        resolution: resolution.toUpperCase(),
        ratio: aspectRatio,
      };
      console.log('[TextToVideo] submit video generation body', body);
      const res = await API.post(API_ENDPOINTS.VIDEO_GENERATIONS, body, {
        headers: {
          'Content-Type': 'application/json',
          'New-Api-User': getUserIdFromLocalStorage(),
        },
        skipErrorHandler: true,
      });
      console.log('[TextToVideo] submit response status', res?.status, 'data', res?.data);
      const json = res.data;
      if (!json) {
        showError(t('文生视频请求失败'));
        return;
      }
      const taskId = json?.task_id || json?.data?.task_id || json?.data?.[0]?.task_id || json?.id;
      const url = resolveVideoUrl(json);
      console.log('[TextToVideo] submit parsed result', { taskId, url, json });
      if (url) {
        setVideoSrc(url);
        Toast.success(t('视频生成完成'));
        return;
      }
      if (!taskId) {
        showError(t('文生视频请求失败'));
        setShowGenerationPreview(false);
        return;
      }

      const waitTask = async () => {
        for (let i = 0; i < 60; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          console.log('[TextToVideo] polling task', { taskId, attempt: i + 1 });
          const taskRes = await API.get(`${API_ENDPOINTS.VIDEO_GENERATIONS}/${taskId}`, {
            headers: {
              'Content-Type': 'application/json',
              'New-Api-User': getUserIdFromLocalStorage(),
            },
            skipErrorHandler: true,
          });
          console.log('[TextToVideo] polling response', {
            status: taskRes?.status,
            data: taskRes?.data,
          });
          const taskJson = taskRes.data;
          if (!taskJson) {
            continue;
          }
          const taskStatus = (taskJson?.status || taskJson?.data?.status || '').toLowerCase();
          console.log('[TextToVideo] polling parsed', { taskStatus, taskJson });
          if (taskStatus === 'succeeded' || taskStatus === 'completed' || taskStatus === 'success' || taskStatus === 'done') {
            const resolved = resolveVideoUrl(taskJson) || resolveVideoUrl(taskJson?.data);
            if (resolved) {
              setVideoSrc(resolved);
              return true;
            }
          }
          if (taskStatus === 'failed' || taskStatus === 'error') {
            throw new Error(taskJson?.error?.message || taskJson?.message || t('视频生成失败'));
          }
        }
        throw new Error(t('视频生成超时，请稍后在任务中心查看结果'));
      };
      await waitTask();
      Toast.success(t('视频生成完成'));
    } catch (e) {
      console.error('[TextToVideo] handleGenerate error', {
        message: e?.message,
        response: e?.response?.data,
        status: e?.response?.status,
      });
      showError(e?.message || t('文生视频请求失败'));
      setShowGenerationPreview(false);
    } finally {
      setLoading(false);
    }
  };

  const promptExamples = [
    {
      title: '城市穿梭',
      prompt: '镜头穿过未来城市街道，霓虹灯反射在湿润地面上，电影感强，动态流畅。',
    },
    {
      title: '海边日落',
      prompt: '海边日落下，海浪缓缓拍岸，逆光剪影，画面温暖宁静。',
    },
    {
      title: '森林漫步',
      prompt: '穿过晨雾森林的小路，阳光透过树叶洒落，轻柔运镜，氛围自然。',
    },
    {
      title: '赛博舞台',
      prompt: '赛博朋克舞台上，灯光随音乐闪烁，镜头围绕主角缓慢推进，视觉冲击强。',
    },
  ];

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
                {t('文生视频')}
              </Title>
              <Paragraph type='tertiary' style={{ marginBottom: 0, fontSize: 16 }}>
                {t('输入文字描述，配置模型、时长、画面比例、分辨率与 seed，生成视频内容。')}
              </Paragraph>
            </div>

            <div style={{ display: 'grid', gap: 20 }}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('模型')}
                </Text>
                <Select style={{ width: '100%' }} optionList={models} value={model} onChange={setModel} disabled={!models.length} placeholder={t('暂无可用文生视频模型')} />
              </div>

              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('分组')}
                </Text>
                <Select style={{ width: '100%' }} optionList={groups} value={group || 'default'} onChange={setGroup} disabled={!groups.length} />
              </div>

              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('视频时长')}
                </Text>
                <Select style={{ width: '100%' }} optionList={DURATION_OPTIONS} value={duration} onChange={setDuration} />
              </div>

              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('画面比例')}
                </Text>
                <Select style={{ width: '100%' }} optionList={RATIO_OPTIONS} value={aspectRatio} onChange={setAspectRatio} />
              </div>

              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('视频分辨率')}
                </Text>
                <Select style={{ width: '100%' }} optionList={RESOLUTION_OPTIONS} value={resolution} onChange={setResolution} />
              </div>

              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('Seed')}
                </Text>
                <InputNumber
                  style={{ width: '100%' }}
                  precision={0}
                  min={-1}
                  max={4294967295}
                  value={seed === '' ? null : Number(seed)}
                  onNumberChange={(value) => setSeed(value === null || value === undefined ? '' : String(value))}
                  placeholder={t('输入 -1 或 0 ~ 4294967295')}
                />
                <Text style={{ display: 'block', marginTop: 8, color: '#64748b', fontSize: 12 }}>
                  {seedHelper}
                </Text>
              </div>

              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('输入')}
                </Text>
                <TextArea
                  value={prompt}
                  onChange={setPrompt}
                  rows={6}
                  placeholder={t('请输入视频描述')}
                  style={{ marginTop: 0, borderRadius: 20 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button theme='solid' type='primary' onClick={handleGenerate} loading={loading} disabled={loading} style={{ borderRadius: 9999, paddingInline: 24 }}>
                  {t('生成')}
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
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {!showGenerationPreview && (
                  <>
                    <Title heading={4} style={{ marginBottom: 0 }}>
                      视频示例区
                    </Title>
                    <Paragraph type='tertiary' style={{ marginBottom: 0 }}>
                      点击卡片可将提示词填入输入框，快速体验文生视频。 
                    </Paragraph>
                  </>
                )}
              </div>

              <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
                {showGenerationPreview ? (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 5, borderRadius: 22, overflow: 'hidden', background: 'rgba(255, 255, 255, 0.98)', boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: 16, borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                      <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 18, color: '#0f172a' }}>
                        生成视频预览
                      </Text>
                      <Paragraph style={{ marginBottom: 0, lineHeight: 1.7, color: '#475569' }}>
                        {loading ? '视频正在生成中，请稍候…' : '这里显示最新生成的视频。'}
                      </Paragraph>
                    </div>
                    <div style={{ flex: 1, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: '100%', height: '100%', borderRadius: 18, overflow: 'hidden', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(15,23,42,0.08)' }}>
                        {loading && !videoSrc ? (
                          <Spin size='large' tip='正在生成...' />
                        ) : (
                          <video
                            src={videoSrc}
                            controls
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'stretch' }}>
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
                          minHeight: 140,
                        }}
                        onClick={() => setPrompt(item.prompt)}
                      >
                        <div style={{ padding: 16 }}>
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
            </div>
          </Card>
        </div>
      </Layout.Content>
    </Layout>
  );
};

export default TextToVideo;
