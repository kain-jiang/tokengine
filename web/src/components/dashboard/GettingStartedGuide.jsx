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
  CreditCard,
  FileText,
  KeyRound,
  PlayCircle,
  RadioTower,
  ShieldCheck,
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
  isLast,
}) {
  const StatusIcon = completed ? CheckCircle2 : Circle;
  return (
    <li className='relative flex gap-3 pb-3 last:pb-0'>
      {!isLast && (
        <span
          className='absolute -bottom-1/2 left-4 top-1/2 w-px'
          style={{ background: 'var(--semi-color-border)' }}
        />
      )}
      <span
        className='relative z-10 flex h-8 w-8 shrink-0 self-center items-center justify-center rounded-lg border'
        style={{
          borderColor: completed
            ? 'var(--semi-color-success-light-active)'
            : 'var(--semi-color-border)',
          background: completed
            ? 'var(--semi-color-success-light-default)'
            : 'var(--semi-color-bg-0)',
          color: completed
            ? 'var(--semi-color-success)'
            : 'var(--semi-color-text-2)',
        }}
      >
        <StatusIcon size={16} />
      </span>
      <button
        type='button'
        onClick={onClick}
        className='guide-step-action flex min-w-0 flex-1 items-center justify-between gap-3 rounded-[22px] border px-3 py-2.5 text-left transition-colors'
        style={{
          borderColor: 'var(--semi-color-border)',
          background: 'var(--semi-color-fill-1)',
        }}
      >
        <span className='flex min-w-0 items-start gap-2.5'>
          <span
            className='guide-step-icon mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md'
            style={{
              background: 'var(--semi-color-fill-1)',
              color: 'var(--semi-color-text-2)',
            }}
          >
            <Icon size={15} />
          </span>
          <span className='min-w-0'>
            <span
              className='block truncate text-sm font-medium'
              style={{ color: 'var(--semi-color-text-0)' }}
            >
              <span
                className='mr-2 font-mono text-xs'
                style={{ color: 'var(--semi-color-text-3)' }}
              >
                {index}.
              </span>
              {title}
            </span>
            <span
              className='mt-0.5 block truncate text-xs'
              style={{ color: 'var(--semi-color-text-2)' }}
            >
              {description}
            </span>
          </span>
        </span>
        <span
          className='shrink-0'
          style={{ color: 'var(--semi-color-text-3)' }}
        >
          &rsaquo;
        </span>
      </button>
    </li>
  );
}

function QuickAction({ icon: Icon, title, description, onClick }) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='guide-quick-action flex w-full items-center gap-3 rounded-[24px] border px-4 py-4 text-left transition-colors'
      style={{
        borderColor: 'var(--semi-color-border)',
        background: 'var(--semi-color-fill-1)',
      }}
    >
      <span
        className='guide-quick-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px]'
        style={{
          background: 'var(--semi-color-fill-1)',
          color: 'var(--semi-color-text-1)',
        }}
      >
        <Icon size={17} />
      </span>
      <span className='min-w-0 flex-1'>
        <span
          className='block truncate text-sm font-medium'
          style={{ color: 'var(--semi-color-text-0)' }}
        >
          {title}
        </span>
        <span
          className='mt-0.5 block truncate text-xs'
          style={{ color: 'var(--semi-color-text-2)' }}
        >
          {description}
        </span>
      </span>
    </button>
  );
}

function CompactAction({ icon: Icon, title, onClick }) {
  return (
    <Button
      size='small'
      theme='borderless'
      icon={<Icon size={15} />}
      onClick={onClick}
    >
      {title}
    </Button>
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
      await saveOnboarding({
        api_key_saved: true,
        guide_collapsed: collapsed,
      });
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

  const summaryTitle = complete ? t('开始使用已完成') : t('开始使用');
  const progressText = t('设置进度：{{completed}}/{{total}}', {
    completed,
    total: steps.length,
  });
  const quickActions = [
    {
      icon: KeyRound,
      title: t('API 密钥'),
      description: t('查看和管理你的密钥'),
      to: '/console/token',
    },
    {
      icon: FileText,
      title: t('使用日志'),
      description: t('API使用记录'),
      to: '/console/log',
    },
    {
      icon: RadioTower,
      title: t('模型广场'),
      description: t('了解可用模型与价格'),
      to: '/pricing',
    },
  ];

  if (collapsed) {
    return (
      <Card
        className='mb-8 rounded-[28px]'
        bodyStyle={{ padding: '14px 16px' }}
        style={{
          marginBottom: '20px',
          borderColor: 'var(--semi-color-border)',
          background: 'var(--semi-color-bg-0)',
        }}
      >
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div className='flex min-w-0 items-center gap-3'>
            <span
              className='flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border'
              style={{
                borderColor: complete
                  ? 'var(--semi-color-success-light-active)'
                  : 'var(--semi-color-border)',
                background: complete
                  ? 'var(--semi-color-success-light-default)'
                  : 'var(--semi-color-fill-0)',
                color: complete
                  ? 'var(--semi-color-success)'
                  : 'var(--semi-color-primary)',
              }}
            >
              {complete ? <CheckCircle2 size={17} /> : <PlayCircle size={17} />}
            </span>
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-2'>
                <span
                  className='truncate text-sm font-semibold'
                  style={{ color: 'var(--semi-color-text-0)' }}
                >
                  {summaryTitle}
                </span>
                <Tag color={complete ? 'green' : 'blue'}>{progressText}</Tag>
              </div>
              <div
                className='mt-0.5 truncate text-xs'
                style={{ color: 'var(--semi-color-text-2)' }}
              >
                {t('集中管理密钥、额度和首个 API 请求。')}
              </div>
            </div>
          </div>
          <div className='flex flex-wrap items-center gap-1'>
            {quickActions.map((action) => (
              <CompactAction
                key={action.title}
                icon={action.icon}
                title={action.title}
                onClick={() => navigate(action.to)}
              />
            ))}
            <Button
              size='small'
              theme='borderless'
              icon={<ChevronDown size={16} />}
              onClick={() => handleGuideVisibility(false)}
            >
              {t('展开引导')}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className='mb-8 grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]'>
      <Card
        className='h-full overflow-hidden rounded-[28px]'
        bodyStyle={{ padding: 0 }}
        style={{
          borderColor: 'var(--semi-color-border)',
          background: 'var(--semi-color-bg-0)',
        }}
      >
        <div className='grid h-full gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_26rem]'>
          <div className='min-w-0'>
            <div className='mb-5'>
              <div className='max-w-2xl'>
                <div
                  className='mb-1 flex items-center gap-2 text-xs font-medium uppercase'
                  style={{ color: 'var(--semi-color-text-2)' }}
                >
                  <PlayCircle
                    size={15}
                    style={{ color: 'var(--semi-color-primary)' }}
                  />
                  {t('开始使用')}
                </div>
                <div
                  className='text-xl font-semibold sm:text-2xl'
                  style={{ color: 'var(--semi-color-text-0)' }}
                >
                  {t('几分钟内开始使用你的 API 网关')}
                </div>
                <p
                  className='mb-0 mt-2 text-sm leading-relaxed'
                  style={{ color: 'var(--semi-color-text-2)' }}
                >
                  {t('集中管理密钥、额度和首个 API 请求。')}
                </p>
              </div>
              <div className='mt-4 flex flex-wrap items-center gap-2'>
                <Button
                  size='small'
                  theme='borderless'
                  icon={<ChevronUp size={16} />}
                  onClick={() => handleGuideVisibility(true)}
                >
                  {t('隐藏引导')}
                </Button>
                <Button
                  size='small'
                  theme='solid'
                  type='primary'
                  icon={<KeyRound size={15} />}
                  loading={copying}
                  onClick={handleCopyKey}
                >
                  {token ? t('复制密钥') : t('创建')}
                </Button>
              </div>
            </div>

            <ol
              className='guide-step-list rounded-[24px] border p-2.5'
              style={{
                borderColor: 'var(--semi-color-border)',
                background: 'var(--semi-color-fill-0)',
              }}
            >
              {steps.map((step, index) => (
                <StepRow
                  key={step.title}
                  index={index + 1}
                  isLast={index === steps.length - 1}
                  {...step}
                  onClick={() =>
                    step.to ? navigate(step.to) : handleCopyKey()
                  }
                />
              ))}
            </ol>
          </div>

          <div
            className='guide-request-panel h-full overflow-hidden rounded-[24px] border p-4'
            style={{
              borderColor: 'var(--semi-color-border)',
              background: 'var(--semi-color-fill-0)',
            }}
          >
            <div
              className='flex items-center gap-2 border-b pb-3'
              style={{ borderColor: 'var(--semi-color-border)' }}
            >
              <span
                className='flex h-8 w-8 shrink-0 items-center justify-center rounded-md'
                style={{
                  background: 'var(--semi-color-fill-0)',
                  color: 'var(--semi-color-primary)',
                }}
              >
                <TerminalSquare size={16} />
              </span>
              <div className='min-w-0'>
                <div
                  className='truncate text-sm font-medium'
                  style={{ color: 'var(--semi-color-text-0)' }}
                >
                  {t('首个 API 请求')}
                </div>
                <div
                  className='truncate text-xs'
                  style={{ color: 'var(--semi-color-text-2)' }}
                >
                  {token?.name || t('尚未创建密钥')}
                </div>
              </div>
            </div>
            <pre
              className='guide-request-code my-4 min-h-40 whitespace-pre-wrap break-words rounded-[20px] p-4 font-mono text-xs leading-5'
              style={{
                background: 'var(--semi-color-fill-0)',
                color: 'var(--semi-color-text-1)',
              }}
            >
              <span className='mb-2 flex gap-1.5'>
                <i className='h-1.5 w-1.5 rounded-full bg-red-400' />
                <i className='h-1.5 w-1.5 rounded-full bg-amber-400' />
                <i className='h-1.5 w-1.5 rounded-full bg-emerald-400' />
              </span>
              {requestPreview}
            </pre>
            <div className='space-y-2'>
              <div
                className='guide-request-signal flex items-center justify-between gap-3 rounded-[18px] px-3 py-2'
                style={{ background: 'var(--semi-color-fill-0)' }}
              >
                <span className='flex min-w-0 items-center gap-2'>
                  <RadioTower
                    size={15}
                    style={{ color: 'var(--semi-color-primary)' }}
                  />
                  <span
                    className='truncate text-xs font-medium'
                    style={{ color: 'var(--semi-color-text-0)' }}
                  >
                    {t('已选择模型')}
                  </span>
                </span>
                <span
                  className='truncate text-xs'
                  style={{ color: 'var(--semi-color-text-2)' }}
                >
                  {selectedModel}
                </span>
              </div>
              <div
                className='guide-request-signal flex items-center justify-between gap-3 rounded-[18px] px-3 py-2'
                style={{ background: 'var(--semi-color-fill-0)' }}
              >
                <span className='flex min-w-0 items-center gap-2'>
                  <ShieldCheck
                    size={15}
                    style={{ color: 'var(--semi-color-success)' }}
                  />
                  <span
                    className='truncate text-xs font-medium'
                    style={{ color: 'var(--semi-color-text-0)' }}
                  >
                    {t('认证已配置')}
                  </span>
                </span>
                <span
                  className='truncate text-xs'
                  style={{ color: 'var(--semi-color-text-2)' }}
                >
                  {t('已保护')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card
        className='h-full rounded-[28px]'
        bodyStyle={{ padding: 0 }}
        style={{
          borderColor: 'var(--semi-color-border)',
          background: 'var(--semi-color-bg-0)',
        }}
      >
        <div className='py-4 pr-4 pl-3 sm:py-5 sm:pr-5 sm:pl-4'>
          <div className='mb-7'>
            <div
              className='text-xs font-medium uppercase'
              style={{ color: 'var(--semi-color-text-2)' }}
            >
              {t('推荐操作')}
            </div>
            <div
              className='mt-1 text-lg font-semibold'
              style={{ color: 'var(--semi-color-text-0)' }}
            >
              {t('保持平台就绪')}
            </div>
          </div>
          <div className='space-y-4'>
            {quickActions.map((action) => (
              <QuickAction
                key={action.title}
                {...action}
                onClick={() => navigate(action.to)}
              />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
