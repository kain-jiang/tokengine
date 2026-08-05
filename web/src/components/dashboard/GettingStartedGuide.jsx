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

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Progress, Tag } from '@douyinfe/semi-ui';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Copy,
  CreditCard,
  KeyRound,
  PlayCircle,
  RadioTower,
  TerminalSquare,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  API,
  copy,
  fetchTokenKey,
  getServerAddress,
  setUserData,
  showError,
  showSuccess,
} from '../../helpers';

function parseUserSetting(setting) {
  if (!setting) return {};
  try {
    return JSON.parse(setting);
  } catch {
    return {};
  }
}

function readOnboarding(setting) {
  const parsed = parseUserSetting(setting);
  return {
    apiKeySaved: Boolean(parsed.onboarding_api_key_saved),
    guideCollapsed: Boolean(parsed.onboarding_guide_collapsed),
  };
}

function StepRow({
  completed,
  icon: Icon,
  index,
  title,
  description,
  onClick,
}) {
  const StatusIcon = completed ? CheckCircle2 : Circle;
  return (
    <button
      type='button'
      onClick={onClick}
      className='flex w-full items-center gap-3 rounded-lg border border-gray-100 bg-white px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/50'
    >
      <StatusIcon
        size={24}
        className={
          completed ? 'shrink-0 text-emerald-500' : 'shrink-0 text-gray-400'
        }
      />
      <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600'>
        <Icon size={16} />
      </span>
      <span className='min-w-0 flex-1'>
        <span className='block font-semibold text-gray-800'>
          {index}. {title}
        </span>
        <span className='mt-0.5 block truncate text-sm text-gray-500'>
          {description}
        </span>
      </span>
      <span className='text-xl text-gray-400'>&rsaquo;</span>
    </button>
  );
}

function QuickAction({ icon: Icon, title, description, onClick }) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='flex w-full items-center gap-3 border-t border-gray-100 py-3 text-left transition hover:text-blue-600'
    >
      <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700'>
        <Icon size={17} />
      </span>
      <span className='min-w-0'>
        <span className='block font-medium text-gray-800'>{title}</span>
        <span className='block truncate text-sm text-gray-500'>
          {description}
        </span>
      </span>
    </button>
  );
}

export default function GettingStartedGuide({ userState, userDispatch }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = userState?.user;
  const saved = useMemo(() => readOnboarding(user?.setting), [user?.setting]);
  const [tokens, setTokens] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(saved.apiKeySaved);
  const [collapsed, setCollapsed] = useState(saved.guideCollapsed);

  useEffect(() => {
    setApiKeySaved(saved.apiKeySaved);
    setCollapsed(saved.guideCollapsed);
  }, [saved.apiKeySaved, saved.guideCollapsed]);

  useEffect(() => {
    let cancelled = false;

    async function loadGuideData() {
      setLoading(true);
      try {
        const [tokensRes, modelsRes] = await Promise.all([
          API.get('/api/token/?p=1&size=10'),
          API.get('/api/user/models'),
        ]);
        if (cancelled) return;

        const tokenData = tokensRes.data?.data;
        setTokens(
          tokensRes.data?.success
            ? Array.isArray(tokenData)
              ? tokenData
              : tokenData?.items || []
            : [],
        );
        setModels(
          modelsRes.data?.success && Array.isArray(modelsRes.data?.data)
            ? modelsRes.data.data
            : [],
        );
      } catch {
        if (!cancelled) {
          setTokens([]);
          setModels([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadGuideData();
    return () => {
      cancelled = true;
    };
  }, []);

  const token = useMemo(
    () => tokens.find((item) => item.name === 'default') || tokens[0],
    [tokens],
  );
  const selectedModel = models[0] || 'your-model';
  const quotaReady =
    Number(user?.quota || 0) > 0 || Number(user?.used_quota || 0) > 0;
  const requestSent = Number(user?.request_count || 0) > 0;
  const steps = [
    {
      title: t('保存 API 密钥'),
      description: token
        ? t('复制并安全保存你的默认密钥')
        : t('没有可用密钥时创建一个'),
      icon: KeyRound,
      completed: Boolean(token && apiKeySaved),
      to: token ? null : '/console/token',
    },
    {
      title: t('确认可用额度'),
      description: t('生产流量前请确保账户余额充足'),
      icon: CreditCard,
      completed: quotaReady,
      to: '/console/topup',
    },
    {
      title: t('发送首个请求'),
      description: t('使用 Playground 或客户端验证路由'),
      icon: TerminalSquare,
      completed: requestSent,
      to: '/console/playground',
    },
  ];
  const completed = steps.filter((step) => step.completed).length;
  const complete = completed === steps.length;
  const baseUrl = (getServerAddress() || window.location.origin).replace(
    /\/+$/,
    '',
  );
  const maskedKey = token?.key ? `sk-${token.key}` : 'sk-...';
  const requestPreview = `curl ${baseUrl}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${maskedKey}" \\
  -d '{"model":"${selectedModel}","messages":[{"role":"user","content":"Say hello"}]}'`;

  async function saveOnboarding(next) {
    const response = await API.put('/api/user/self', { onboarding: next });
    if (!response.data?.success) {
      throw new Error(response.data?.message || t('保存失败，请重试'));
    }

    const setting = {
      ...parseUserSetting(user?.setting),
      onboarding_api_key_saved: next.api_key_saved,
      onboarding_guide_collapsed: next.guide_collapsed,
    };
    const nextUser = { ...user, setting: JSON.stringify(setting) };
    userDispatch({ type: 'login', payload: nextUser });
    setUserData(nextUser);
  }

  async function handleCopyKey() {
    if (!token?.id) {
      navigate('/console/token');
      return;
    }

    setCopying(true);
    try {
      const key = await fetchTokenKey(token.id);
      if (!(await copy(`sk-${key}`))) {
        showError(t('无法复制到剪贴板，请手动复制'));
        return;
      }
      await saveOnboarding({ api_key_saved: true, guide_collapsed: false });
      setApiKeySaved(true);
      showSuccess(t('API 密钥已复制，请安全保存'));
    } catch (error) {
      showError(error?.message || t('获取 API 密钥失败'));
    } finally {
      setCopying(false);
    }
  }

  async function handleGuideVisibility(nextCollapsed) {
    setCollapsed(nextCollapsed);
    try {
      await saveOnboarding({
        api_key_saved: apiKeySaved,
        guide_collapsed: nextCollapsed,
      });
    } catch (error) {
      setCollapsed(!nextCollapsed);
      showError(error?.message || t('保存失败，请重试'));
    }
  }

  if (loading) return null;

  if (collapsed || complete) {
    return (
      <Card className='mb-4 border-gray-100 shadow-sm'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex items-center gap-3'>
            <CheckCircle2 className='text-emerald-500' size={24} />
            <div>
              <div className='font-semibold text-gray-800'>
                {complete ? t('开始使用已完成') : t('开始使用')}
              </div>
              <div className='text-sm text-gray-500'>
                {t('设置进度：{{completed}}/{{total}}', {
                  completed,
                  total: steps.length,
                })}
              </div>
            </div>
          </div>
          {!complete && (
            <Button
              theme='borderless'
              icon={<ChevronDown size={16} />}
              onClick={() => handleGuideVisibility(false)}
            >
              {t('展开引导')}
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className='mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]'>
      <Card
        className='overflow-hidden border-gray-100 shadow-sm'
        bodyStyle={{ padding: 0 }}
      >
        <div className='p-5'>
          <div className='mb-5 flex flex-wrap items-start justify-between gap-3'>
            <div>
              <div className='mb-1 flex items-center gap-2 text-sm font-medium text-gray-500'>
                <PlayCircle size={16} /> {t('开始使用')}
              </div>
              <div className='text-lg font-semibold text-gray-900'>
                {t('几分钟内开始使用你的 API 网关')}
              </div>
              <p className='mb-0 mt-2 text-gray-500'>
                {t('集中管理密钥、额度和首个 API 请求。')}
              </p>
            </div>
            <div className='flex items-center gap-2'>
              <Tag color='blue'>
                {t('进度 {{completed}}/{{total}}', {
                  completed,
                  total: steps.length,
                })}
              </Tag>
              <Button
                size='small'
                theme='borderless'
                icon={<ChevronUp size={16} />}
                onClick={() => handleGuideVisibility(true)}
              >
                {t('隐藏引导')}
              </Button>
            </div>
          </div>

          <Progress
            percent={(completed / steps.length) * 100}
            showInfo={false}
            className='mb-4'
          />
          <div className='space-y-3'>
            {steps.map((step, index) => (
              <StepRow
                key={step.title}
                index={index + 1}
                {...step}
                onClick={() => (step.to ? navigate(step.to) : handleCopyKey())}
              />
            ))}
          </div>
        </div>
      </Card>

      <Card
        className='border-gray-100 shadow-sm'
        bodyStyle={{ padding: '16px' }}
      >
        <div className='mb-3 flex items-center justify-between gap-3'>
          <div className='min-w-0'>
            <div className='font-semibold text-gray-800'>
              {t('首个 API 请求')}
            </div>
            <div className='truncate text-sm text-gray-500'>
              {token?.name || t('尚未创建密钥')}
            </div>
          </div>
          <Button
            size='small'
            icon={<Copy size={15} />}
            loading={copying}
            onClick={handleCopyKey}
          >
            {token ? t('复制密钥') : t('创建')}
          </Button>
        </div>
        <pre className='mb-4 overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-600'>
          {requestPreview}
        </pre>
        <div className='space-y-2'>
          <QuickAction
            icon={KeyRound}
            title={t('API 密钥')}
            description={t('查看和管理你的密钥')}
            onClick={() => navigate('/console/token')}
          />
          <QuickAction
            icon={RadioTower}
            title={t('模型广场')}
            description={t('了解可用模型与价格')}
            onClick={() => navigate('/pricing')}
          />
          <QuickAction
            icon={TerminalSquare}
            title={t('Playground')}
            description={t('快速验证模型和路由')}
            onClick={() => navigate('/console/playground')}
          />
        </div>
      </Card>
    </div>
  );
}
