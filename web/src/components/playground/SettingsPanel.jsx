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
import { Card, Select, Typography, Button, Switch, TextArea, InputNumber } from '@douyinfe/semi-ui';
import { Sparkles, Users, ToggleLeft, X, Settings, Image as ImageIcon, PenTool } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { renderGroupOption, selectFilter } from '../../helpers';
import ParameterControl from './ParameterControl';
import ImageUrlInput from './ImageUrlInput';
import ConfigManager from './ConfigManager';
import CustomRequestEditor from './CustomRequestEditor';

const SettingsPanel = ({
  inputs,
  parameterEnabled,
  models,
  groups,
  styleState,
  showDebugPanel,
  customRequestMode,
  customRequestBody,
  onInputChange,
  onParameterToggle,
  onCloseSettings,
  onConfigImport,
  onConfigReset,
  onCustomRequestModeChange,
  onCustomRequestBodyChange,
  previewPayload,
  messages,
  sizeOptions = [],
  ratioOptions = [],
  durationOptions = [],
  hideParameterControl = false,
  hideConfigManager = false,
  hideImageUrlInput = false,
  children,
}) => {
  const { t } = useTranslation();

  const currentConfig = {
    inputs,
    parameterEnabled,
    showDebugPanel,
    customRequestMode,
    customRequestBody,
  };

  return (
    <Card
      className='h-full flex flex-col'
      bordered={false}
      bodyStyle={{
        padding: styleState.isMobile ? '16px' : '24px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 标题区域 - 与调试面板保持一致 */}
      <div className='flex items-center justify-between mb-6 flex-shrink-0'>
        <div className='flex items-center'>
          <div className='w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center mr-3'>
            <Settings size={20} className='text-white' />
          </div>
          <Typography.Title heading={5} className='mb-0'>
            {t('模型配置')}
          </Typography.Title>
        </div>

        {styleState.isMobile && onCloseSettings && (
          <Button
            icon={<X size={16} />}
            onClick={onCloseSettings}
            theme='borderless'
            type='tertiary'
            size='small'
            className='!rounded-lg'
          />
        )}
      </div>

      {/* 移动端配置管理 - 文生图页面不显示 */}
      {!hideConfigManager && styleState.isMobile && (
        <div className='mb-4 flex-shrink-0'>
          <ConfigManager
            currentConfig={currentConfig}
            onConfigImport={onConfigImport}
            onConfigReset={onConfigReset}
            styleState={{ ...styleState, isMobile: false }}
            messages={messages}
          />
        </div>
      )}

      <div className='space-y-6 overflow-y-auto flex-1 pr-2 model-settings-scroll'>
        {/* 自定义请求体编辑器 */}
        <CustomRequestEditor
          customRequestMode={customRequestMode}
          customRequestBody={customRequestBody}
          onCustomRequestModeChange={onCustomRequestModeChange}
          onCustomRequestBodyChange={onCustomRequestBodyChange}
          defaultPayload={previewPayload}
        />

        {/* 分组选择 */}
        <div className={customRequestMode ? 'opacity-50' : ''}>
          <div className='flex items-center gap-2 mb-2'>
            <Users size={16} className='text-gray-500' />
            <Typography.Text strong className='text-sm'>
              {t('分组')}
            </Typography.Text>
            {customRequestMode && (
              <Typography.Text className='text-xs text-orange-600'>
                ({t('已在自定义模式中忽略')})
              </Typography.Text>
            )}
          </div>
          <Select
            placeholder={t('请选择分组')}
            name='group'
            required
            selection
            filter={selectFilter}
            autoClearSearchValue={false}
            onChange={(value) => onInputChange('group', value)}
            value={inputs.group}
            autoComplete='new-password'
            optionList={groups}
            renderOptionItem={renderGroupOption}
            style={{ width: '100%' }}
            dropdownStyle={{ width: '100%', maxWidth: '100%' }}
            className='!rounded-lg'
            disabled={customRequestMode}
          />
        </div>

        {/* 模型选择 */}
        <div className={customRequestMode ? 'opacity-50' : ''}>
          <div className='flex items-center gap-2 mb-2'>
            <Sparkles size={16} className='text-gray-500' />
            <Typography.Text strong className='text-sm'>
              {t('模型')}
            </Typography.Text>
            {customRequestMode && (
              <Typography.Text className='text-xs text-orange-600'>
                ({t('已在自定义模式中忽略')})
              </Typography.Text>
            )}
          </div>
          <Select
            placeholder={t('请选择模型')}
            name='model'
            required
            selection
            filter={selectFilter}
            autoClearSearchValue={false}
            onChange={(value) => onInputChange('model', value)}
            value={inputs.model}
            autoComplete='new-password'
            optionList={models}
            style={{ width: '100%' }}
            dropdownStyle={{ width: '100%', maxWidth: '100%' }}
            className='!rounded-lg'
            disabled={customRequestMode}
          />
        </div>

        {/* 图片URL输入 */}
        {!hideImageUrlInput && (
          <div className={customRequestMode ? 'opacity-50' : ''}>
            <ImageUrlInput
              imageUrls={inputs.imageUrls}
              imageEnabled={inputs.imageEnabled}
              onImageUrlsChange={(urls) => onInputChange('imageUrls', urls)}
              onImageEnabledChange={(enabled) =>
                onInputChange('imageEnabled', enabled)
              }
              disabled={customRequestMode}
            />
          </div>
        )}

        {/* 文生图专用：尺寸选择 */}
        {sizeOptions && sizeOptions.length > 0 && (
          <div className={customRequestMode ? 'opacity-50' : ''}>
            <div className='flex items-center gap-2 mb-2'>
              <ImageIcon size={16} className='text-gray-500' />
              <Typography.Text strong className='text-sm'>
                {t('尺寸')}
              </Typography.Text>
              {customRequestMode && (
                <Typography.Text className='text-xs text-orange-600'>
                  ({t('已在自定义模式中忽略')})
                </Typography.Text>
              )}
            </div>
            <Select
              placeholder={t('请选择图片尺寸')}
              name='size'
              selection
              filter={selectFilter}
              autoClearSearchValue={false}
              onChange={(value) => onInputChange('size', value)}
              value={inputs.size}
              autoComplete='new-password'
              optionList={sizeOptions}
              style={{ width: '100%' }}
              dropdownStyle={{ width: '100%', maxWidth: '100%' }}
              className='!rounded-lg'
              disabled={customRequestMode}
            />
          </div>
        )}

        {/* 文生视频专用：画面比例 */}
        {ratioOptions && ratioOptions.length > 0 && (
          <div className={customRequestMode ? 'opacity-50' : ''}>
            <div className='flex items-center gap-2 mb-2'>
              <ImageIcon size={16} className='text-gray-500' />
              <Typography.Text strong className='text-sm'>
                {t('画面比例')}
              </Typography.Text>
              {customRequestMode && (
                <Typography.Text className='text-xs text-orange-600'>
                  ({t('已在自定义模式中忽略')})
                </Typography.Text>
              )}
            </div>
            <Select
              placeholder={t('请选择画面比例')}
              name='ratio'
              selection
              filter={selectFilter}
              autoClearSearchValue={false}
              onChange={(value) => onInputChange('ratio', value)}
              value={inputs.ratio}
              autoComplete='new-password'
              optionList={ratioOptions}
              style={{ width: '100%' }}
              dropdownStyle={{ width: '100%', maxWidth: '100%' }}
              className='!rounded-lg'
              disabled={customRequestMode}
            />
          </div>
        )}

        {/* 文生视频专用：视频时长 */}
        {durationOptions && durationOptions.length > 0 && (
          <div className={customRequestMode ? 'opacity-50' : ''}>
            <div className='flex items-center gap-2 mb-2'>
              <ImageIcon size={16} className='text-gray-500' />
              <Typography.Text strong className='text-sm'>
                {t('视频时长')}
              </Typography.Text>
              {customRequestMode && (
                <Typography.Text className='text-xs text-orange-600'>
                  ({t('已在自定义模式中忽略')})
                </Typography.Text>
              )}
            </div>
            <Select
              placeholder={t('请选择视频时长')}
              name='duration'
              selection
              filter={selectFilter}
              autoClearSearchValue={false}
              onChange={(value) => onInputChange('duration', value)}
              value={inputs.duration}
              autoComplete='new-password'
              optionList={durationOptions}
              style={{ width: '100%' }}
              dropdownStyle={{ width: '100%', maxWidth: '100%' }}
              className='!rounded-lg'
              disabled={customRequestMode}
            />
          </div>
        )}

        {/* 文生视频专用：视频分辨率 */}
        {ratioOptions && ratioOptions.length > 0 && (
          <div className={customRequestMode ? 'opacity-50' : ''}>
            <div className='flex items-center gap-2 mb-2'>
              <ImageIcon size={16} className='text-gray-500' />
              <Typography.Text strong className='text-sm'>
                {t('视频分辨率')}
              </Typography.Text>
              {customRequestMode && (
                <Typography.Text className='text-xs text-orange-600'>
                  ({t('已在自定义模式中忽略')})
                </Typography.Text>
              )}
            </div>
            <Select
              placeholder={t('请选择视频分辨率')}
              name='resolution'
              selection
              filter={selectFilter}
              autoClearSearchValue={false}
              onChange={(value) => onInputChange('resolution', value)}
              value={inputs.resolution}
              autoComplete='new-password'
              optionList={[
                { label: '480P', value: '480p' },
                { label: '720P', value: '720p' },
                { label: '1080P', value: '1080p' },
              ]}
              style={{ width: '100%' }}
              dropdownStyle={{ width: '100%', maxWidth: '100%' }}
              className='!rounded-lg'
              disabled={customRequestMode}
            />
          </div>
        )}

        {/* 文生视频专用：Seed */}
        {ratioOptions && ratioOptions.length > 0 && (
          <div className={customRequestMode ? 'opacity-50' : ''}>
            <div className='flex items-center gap-2 mb-2'>
              <Settings size={16} className='text-gray-500' />
              <Typography.Text strong className='text-sm'>
                {t('Seed')}
              </Typography.Text>
              {customRequestMode && (
                <Typography.Text className='text-xs text-orange-600'>
                  ({t('已在自定义模式中忽略')})
                </Typography.Text>
              )}
            </div>
            <InputNumber
              placeholder={t('输入 -1 或 0 ~ 4294967295')}
              name='seed'
              precision={0}
              min={-1}
              max={4294967295}
              value={inputs.seed === null || inputs.seed === undefined ? null : Number(inputs.seed)}
              onChange={(value) => onInputChange('seed', value === null || value === undefined ? '' : String(value))}
              style={{ width: '100%' }}
              className='!rounded-lg'
              disabled={customRequestMode}
            />
            <Typography.Text style={{ display: 'block', marginTop: 8, color: '#64748b', fontSize: 12 }}>
              {t('Seed：-1 表示随机生成；0 ~ 4294967295 可复现相同结果')}
            </Typography.Text>
          </div>
        )}

        {/* 文生图专用：提示词输入 */}
        {sizeOptions && sizeOptions.length > 0 && (
          <div className={customRequestMode ? 'opacity-50' : ''}>
            <div className='flex items-center gap-2 mb-2'>
              <PenTool size={16} className='text-gray-500' />
              <Typography.Text strong className='text-sm'>
                {t('提示词')}
              </Typography.Text>
              {customRequestMode && (
                <Typography.Text className='text-xs text-orange-600'>
                  ({t('已在自定义模式中忽略')})
                </Typography.Text>
              )}
            </div>
            <TextArea
              value={inputs.prompt || ''}
              onChange={(value) => onInputChange('prompt', value)}
              rows={4}
              placeholder={t('请输入画面描述')}
              style={{ borderRadius: 4 }}
              disabled={customRequestMode}
            />
            {/* 生成图片按钮 - 紧跟在提示词输入框下方 */}
            {children}
          </div>
        )}

        {/* 文生视频专用：提示词输入 */}
        {ratioOptions && ratioOptions.length > 0 && (
          <div className={customRequestMode ? 'opacity-50' : ''}>
            <div className='flex items-center gap-2 mb-2'>
              <PenTool size={16} className='text-gray-500' />
              <Typography.Text strong className='text-sm'>
                {t('提示词')}
              </Typography.Text>
              {customRequestMode && (
                <Typography.Text className='text-xs text-orange-600'>
                  ({t('已在自定义模式中忽略')})
                </Typography.Text>
              )}
            </div>
            <TextArea
              value={inputs.prompt || ''}
              onChange={(value) => onInputChange('prompt', value)}
              rows={4}
              placeholder={t('请输入视频描述')}
              style={{ borderRadius: 4 }}
              disabled={customRequestMode}
            />
            {/* 生成视频按钮 - 紧跟在提示词输入框下方 */}
            {children}
          </div>
        )}
        
        {/* 参数控制组件 - 文生图页面不显示 */}
        {!hideParameterControl && (
          <div className={customRequestMode ? 'opacity-50' : ''}>
            <ParameterControl
              inputs={inputs}
              parameterEnabled={parameterEnabled}
              onInputChange={onInputChange}
              onParameterToggle={onParameterToggle}
              disabled={customRequestMode}
            />
          </div>
        )}

        {/* 流式输出开关 - 文生图页面不显示 */}
        {!hideParameterControl && (
          <div className={customRequestMode ? 'opacity-50' : ''}>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <ToggleLeft size={16} className='text-gray-500' />
                <Typography.Text strong className='text-sm'>
                  {t('流式输出')}
                </Typography.Text>
                {customRequestMode && (
                  <Typography.Text className='text-xs text-orange-600'>
                    ({t('已在自定义模式中忽略')})
                  </Typography.Text>
                )}
              </div>
              <Switch
                checked={inputs.stream}
                onChange={(checked) => onInputChange('stream', checked)}
                checkedText={t('开')}
                uncheckedText={t('关')}
                size='small'
                disabled={customRequestMode}
              />
            </div>
          </div>
        )}
      </div>

      {/* 桌面端的配置管理放在底部 - 文生图页面不显示 */}
      {!hideConfigManager && !styleState.isMobile && (
        <div className='flex-shrink-0 pt-3'>
          <ConfigManager
            currentConfig={currentConfig}
            onConfigImport={onConfigImport}
            onConfigReset={onConfigReset}
            styleState={styleState}
            messages={messages}
          />
        </div>
      )}

    </Card>
  );
};

export default SettingsPanel;
