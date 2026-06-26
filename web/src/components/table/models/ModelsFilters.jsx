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

import React, { useRef } from 'react';
import { Form, Button, Select } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

const ModelsFilters = ({
  formInitValues,
  setFormApi,
  searchModels,
  loading,
  searching,
  channels,
<<<<<<< HEAD
  channelFilter,
  setChannelFilter,
=======
>>>>>>> dev0625
  t,
}) => {
  // Handle form reset and immediate search
  const formApiRef = useRef(null);

  const handleReset = () => {
    if (!formApiRef.current) return;
    formApiRef.current.reset();
    setChannelFilter('');
    setTimeout(() => {
      searchModels();
    }, 100);
  };

  return (
    <div className='flex flex-col gap-2 w-full'>
<<<<<<< HEAD
      {/* Channel filter dropdown */}
      <div className='w-full md:w-56'>
        <Select
          placeholder={t('筛选渠道')}
          value={channelFilter}
          onChange={(value) => setChannelFilter(value)}
          style={{ width: '100%' }}
          size='small'
          showClear
        >
          <Select.Option value=''>{t('全部渠道')}</Select.Option>
          {channels.map((ch) => (
            <Select.Option key={ch.id} value={ch.name}>
              {ch.name}
            </Select.Option>
          ))}
        </Select>
      </div>

=======
>>>>>>> dev0625
      <Form
        initValues={formInitValues}
        getFormApi={(api) => {
          setFormApi(api);
          formApiRef.current = api;
        }}
        onSubmit={searchModels}
        allowEmpty={true}
        autoComplete='off'
        layout='horizontal'
        trigger='change'
        stopValidateWithError={false}
        className='w-full md:w-auto order-1 md:order-2'
      >
        <div className='flex flex-col md:flex-row items-center gap-2 w-full md:w-auto'>
          <div className='relative w-full md:w-56'>
<<<<<<< HEAD
=======
            <Form.Select
              field='searchChannel'
              label={null}
              placeholder={t('筛选渠道')}
              style={{ width: '100%' }}
              size='small'
              showClear
            >
              <Select.Option value=''>{t('全部渠道')}</Select.Option>
              {channels.map((ch) => (
                <Select.Option key={ch.id} value={String(ch.id)}>
                  {ch.name}
                </Select.Option>
              ))}
            </Form.Select>
          </div>

          <div className='relative w-full md:w-56'>
>>>>>>> dev0625
            <Form.Input
              field='searchKeyword'
              prefix={<IconSearch />}
              placeholder={t('搜索模型名称')}
              showClear
              pure
              size='small'
            />
          </div>

          <div className='relative w-full md:w-56'>
            <Form.Input
              field='searchVendor'
              prefix={<IconSearch />}
              placeholder={t('搜索供应商')}
              showClear
              pure
              size='small'
            />
          </div>

          <div className='flex gap-2 w-full md:w-auto'>
            <Button
              type='tertiary'
              htmlType='submit'
              loading={loading || searching}
              className='flex-1 md:flex-initial md:w-auto'
              size='small'
            >
              {t('查询')}
            </Button>

            <Button
              type='tertiary'
              onClick={handleReset}
              className='flex-1 md:flex-initial md:w-auto'
              size='small'
            >
              {t('重置')}
            </Button>
          </div>
        </div>
      </Form>
    </div>
  );
};

export default ModelsFilters;
