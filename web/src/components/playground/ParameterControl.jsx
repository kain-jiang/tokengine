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

import React from 'react';
import {
  Input,
  InputNumber,
  Slider,
  Typography,
  Button,
  Tag,
  Select,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import {
  Hash,
  Thermometer,
  Target,
  Repeat,
  Ban,
  Shuffle,
  Check,
  X,
  Film,
  Ratio,
  Maximize,
} from 'lucide-react';

const ParameterControl = ({
  inputs,
  parameterEnabled,
  onInputChange,
  onParameterToggle,
  disabled = false,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Temperature */}
      <div
        className={`transition-opacity duration-200 mb-4 ${!parameterEnabled.temperature || disabled ? 'opacity-50' : ''}`}
      >
        <div className='flex items-center justify-between mb-2'>
          <div className='flex items-center gap-2'>
            <Thermometer size={16} className='text-gray-500' />
            <Typography.Text strong className='text-sm'>
              Temperature
            </Typography.Text>
            <Tag size='small' shape='circle'>
              {inputs.temperature}
            </Tag>
          </div>
          <Button
            theme={parameterEnabled.temperature ? 'solid' : 'borderless'}
            type={parameterEnabled.temperature ? 'primary' : 'tertiary'}
            size='small'
            icon={
              parameterEnabled.temperature ? (
                <Check size={10} />
              ) : (
                <X size={10} />
              )
            }
            onClick={() => onParameterToggle('temperature')}
            className='!rounded-full !w-4 !h-4 !p-0 !min-w-0'
            disabled={disabled}
          />
        </div>
        <Typography.Text className='text-xs text-gray-500 mb-2'>
          {t('控制输出的随机性和创造性')}
        </Typography.Text>
        <Slider
          step={0.1}
          min={0.1}
          max={1}
          value={inputs.temperature}
          onChange={(value) => onInputChange('temperature', value)}
          className='mt-2'
          disabled={!parameterEnabled.temperature || disabled}
        />
      </div>

      {/* Top P */}
      <div
        className={`transition-opacity duration-200 mb-4 ${!parameterEnabled.top_p || disabled ? 'opacity-50' : ''}`}
      >
        <div className='flex items-center justify-between mb-2'>
          <div className='flex items-center gap-2'>
            <Target size={16} className='text-gray-500' />
            <Typography.Text strong className='text-sm'>
              Top P
            </Typography.Text>
            <Tag size='small' shape='circle'>
              {inputs.top_p}
            </Tag>
          </div>
          <Button
            theme={parameterEnabled.top_p ? 'solid' : 'borderless'}
            type={parameterEnabled.top_p ? 'primary' : 'tertiary'}
            size='small'
            icon={
              parameterEnabled.top_p ? <Check size={10} /> : <X size={10} />
            }
            onClick={() => onParameterToggle('top_p')}
            className='!rounded-full !w-4 !h-4 !p-0 !min-w-0'
            disabled={disabled}
          />
        </div>
        <Typography.Text className='text-xs text-gray-500 mb-2'>
          {t('核采样，控制词汇选择的多样性')}
        </Typography.Text>
        <Slider
          step={0.1}
          min={0.1}
          max={1}
          value={inputs.top_p}
          onChange={(value) => onInputChange('top_p', value)}
          className='mt-2'
          disabled={!parameterEnabled.top_p || disabled}
        />
      </div>

      {/* Frequency Penalty */}
      <div
        className={`transition-opacity duration-200 mb-4 ${!parameterEnabled.frequency_penalty || disabled ? 'opacity-50' : ''}`}
      >
        <div className='flex items-center justify-between mb-2'>
          <div className='flex items-center gap-2'>
            <Repeat size={16} className='text-gray-500' />
            <Typography.Text strong className='text-sm'>
              Frequency Penalty
            </Typography.Text>
            <Tag size='small' shape='circle'>
              {inputs.frequency_penalty}
            </Tag>
          </div>
          <Button
            theme={parameterEnabled.frequency_penalty ? 'solid' : 'borderless'}
            type={parameterEnabled.frequency_penalty ? 'primary' : 'tertiary'}
            size='small'
            icon={
              parameterEnabled.frequency_penalty ? (
                <Check size={10} />
              ) : (
                <X size={10} />
              )
            }
            onClick={() => onParameterToggle('frequency_penalty')}
            className='!rounded-full !w-4 !h-4 !p-0 !min-w-0'
            disabled={disabled}
          />
        </div>
        <Typography.Text className='text-xs text-gray-500 mb-2'>
          {t('频率惩罚，减少重复词汇的出现')}
        </Typography.Text>
        <Slider
          step={0.1}
          min={-2}
          max={2}
          value={inputs.frequency_penalty}
          onChange={(value) => onInputChange('frequency_penalty', value)}
          className='mt-2'
          disabled={!parameterEnabled.frequency_penalty || disabled}
        />
      </div>

      {/* Presence Penalty */}
      <div
        className={`transition-opacity duration-200 mb-4 ${!parameterEnabled.presence_penalty || disabled ? 'opacity-50' : ''}`}
      >
        <div className='flex items-center justify-between mb-2'>
          <div className='flex items-center gap-2'>
            <Ban size={16} className='text-gray-500' />
            <Typography.Text strong className='text-sm'>
              Presence Penalty
            </Typography.Text>
            <Tag size='small' shape='circle'>
              {inputs.presence_penalty}
            </Tag>
          </div>
          <Button
            theme={parameterEnabled.presence_penalty ? 'solid' : 'borderless'}
            type={parameterEnabled.presence_penalty ? 'primary' : 'tertiary'}
            size='small'
            icon={
              parameterEnabled.presence_penalty ? (
                <Check size={10} />
              ) : (
                <X size={10} />
              )
            }
            onClick={() => onParameterToggle('presence_penalty')}
            className='!rounded-full !w-4 !h-4 !p-0 !min-w-0'
            disabled={disabled}
          />
        </div>
        <Typography.Text className='text-xs text-gray-500 mb-2'>
          {t('存在惩罚，鼓励讨论新话题')}
        </Typography.Text>
        <Slider
          step={0.1}
          min={-2}
          max={2}
          value={inputs.presence_penalty}
          onChange={(value) => onInputChange('presence_penalty', value)}
          className='mt-2'
          disabled={!parameterEnabled.presence_penalty || disabled}
        />
      </div>

      {/* MaxTokens */}
      <div
        className={`transition-opacity duration-200 mb-4 ${!parameterEnabled.max_tokens || disabled ? 'opacity-50' : ''}`}
      >
        <div className='flex items-center justify-between mb-2'>
          <div className='flex items-center gap-2'>
            <Hash size={16} className='text-gray-500' />
            <Typography.Text strong className='text-sm'>
              Max Tokens
            </Typography.Text>
          </div>
          <Button
            theme={parameterEnabled.max_tokens ? 'solid' : 'borderless'}
            type={parameterEnabled.max_tokens ? 'primary' : 'tertiary'}
            size='small'
            icon={
              parameterEnabled.max_tokens ? (
                <Check size={10} />
              ) : (
                <X size={10} />
              )
            }
            onClick={() => onParameterToggle('max_tokens')}
            className='!rounded-full !w-4 !h-4 !p-0 !min-w-0'
            disabled={disabled}
          />
        </div>
        <InputNumber
          placeholder='MaxTokens'
          name='max_tokens'
          value={inputs.max_tokens}
          onNumberChange={(value) => onInputChange('max_tokens', value)}
          min={0}
          precision={0}
          style={{ width: '100%' }}
          disabled={!parameterEnabled.max_tokens || disabled}
        />
      </div>

      {/* Seed */}
      <div
        className={`transition-opacity duration-200 mb-4 ${!parameterEnabled.seed || disabled ? 'opacity-50' : ''}`}
      >
        <div className='flex items-center justify-between mb-2'>
          <div className='flex items-center gap-2'>
            <Shuffle size={16} className='text-gray-500' />
            <Typography.Text strong className='text-sm'>
              Seed
            </Typography.Text>
            <Typography.Text className='text-xs text-gray-400'>
              ({t('可选，用于复现结果')})
            </Typography.Text>
          </div>
          <Button
            theme={parameterEnabled.seed ? 'solid' : 'borderless'}
            type={parameterEnabled.seed ? 'primary' : 'tertiary'}
            size='small'
            icon={parameterEnabled.seed ? <Check size={10} /> : <X size={10} />}
            onClick={() => onParameterToggle('seed')}
            className='!rounded-full !w-4 !h-4 !p-0 !min-w-0'
            disabled={disabled}
          />
        </div>
        <Input
          placeholder={t('随机种子 (留空为随机)')}
          name='seed'
          autoComplete='new-password'
          value={inputs.seed || ''}
          onChange={(value) =>
            onInputChange('seed', value === '' ? null : value)
          }
          className='!rounded-lg'
          disabled={!parameterEnabled.seed || disabled}
        />
      </div>

      {/* 文生视频参数 - 仅当有视频参数启用时显示 */}
      {(parameterEnabled.videoDuration || parameterEnabled.videoAspectRatio || parameterEnabled.videoResolution || parameterEnabled.videoSeed) && (
        <div className='pt-2 border-t border-gray-100'>
          <div className='flex items-center gap-2 mb-3'>
            <Film size={16} className='text-gray-500' />
            <Typography.Text strong className='text-sm'>
              {t('文生视频参数')}
            </Typography.Text>
          </div>

          <div className='grid grid-cols-1 gap-4'>
            {parameterEnabled.videoDuration && (
              <div>
                <Typography.Text className='text-sm' strong>
                  {t('视频时长')}
                </Typography.Text>
                <Select
                  value={inputs.videoDuration}
                  onChange={(value) => onInputChange('videoDuration', value)}
                  optionList={[
                    { label: '5s', value: 5 },
                    { label: '10s', value: 10 },
                    { label: '15s', value: 15 },
                  ]}
                  style={{ width: '100%', marginTop: 8 }}
                  disabled={disabled}
                />
              </div>
            )}

            {parameterEnabled.videoAspectRatio && (
              <div>
                <div className='flex items-center gap-2 mb-2'>
                  <Ratio size={16} className='text-gray-500' />
                  <Typography.Text className='text-sm' strong>
                    {t('画面比例')}
                  </Typography.Text>
                </div>
                <Select
                  value={inputs.videoAspectRatio}
                  onChange={(value) => onInputChange('videoAspectRatio', value)}
                  optionList={[
                    { label: '16:9', value: '16:9' },
                    { label: '9:16', value: '9:16' },
                    { label: '1:1', value: '1:1' },
                  ]}
                  style={{ width: '100%' }}
                  disabled={disabled}
                />
              </div>
            )}

            {parameterEnabled.videoResolution && (
              <div>
                <div className='flex items-center gap-2 mb-2'>
                  <Maximize size={16} className='text-gray-500' />
                  <Typography.Text className='text-sm' strong>
                    {t('视频分辨率')}
                  </Typography.Text>
                </div>
                <Select
                  value={inputs.videoResolution}
                  onChange={(value) => onInputChange('videoResolution', value)}
                  optionList={[
                    { label: '480p', value: '480p' },
                    { label: '720p', value: '720p' },
                    { label: '1080p', value: '1080p' },
                  ]}
                  style={{ width: '100%' }}
                  disabled={disabled}
                />
              </div>
            )}

            {parameterEnabled.videoSeed && (
              <div>
                <Typography.Text className='text-sm' strong>
                  {t('视频 Seed')}
                </Typography.Text>
                <Input
                  placeholder={t('输入 -1 或 0 ~ 4294967295')}
                  name='videoSeed'
                  autoComplete='new-password'
                  value={inputs.videoSeed || ''}
                  onChange={(value) =>
                    onInputChange('videoSeed', value === '' ? null : value)
                  }
                  className='!rounded-lg'
                  style={{ marginTop: 8 }}
                  disabled={disabled}
                />
                <Typography.Text className='text-xs text-gray-400 mt-1 block'>
                  {t('种子值用于控制生成内容的随机性。设为 -1 表示随机生成；设为固定值（0 ~ 4294967295）可复现相同的生成结果。')}
                </Typography.Text>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ParameterControl;
