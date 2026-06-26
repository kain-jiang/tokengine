import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TabPane, Tabs, Spin, Typography, Toast } from '@douyinfe/semi-ui';
import { API, showError } from '../../helpers';
import CardPro from '../../components/common/ui/CardPro';
import BillingFilters from './components/BillingFilters';
import ModelSummaryTable from './components/ModelSummaryTable';
import TokenSummaryTable from './components/TokenSummaryTable';

const { Text } = Typography;

const MyPlanBilling = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('model');
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [modelData, setModelData] = useState({ total: 0, total_request_count: 0, items: [] });
  const [tokenData, setTokenData] = useState({ total: 0, total_request_count: 0, items: [] });
  
  // 默认最近一周
  const getDefaultDate = (daysAgo) => {
    const date = new Date();
    date.setDate(date.getDate() + daysAgo);
    return date.toISOString().split('T')[0];
  };
  
  const [filters, setFilters] = useState({
    startDate: getDefaultDate(-7),
    endDate: getDefaultDate(0)
  });

  const fetchModelSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/billing/self/model-summary', { params: filters });
      if (res.data?.success) {
        setModelData(res.data.data);
      } else {
        showError(res.data?.message || t('获取数据失败'));
      }
    } catch (e) {
      showError(e.message || t('获取数据失败'));
    } finally {
      setLoading(false);
    }
  }, [filters, t]);

  const fetchTokenSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/billing/self/token-summary', { params: filters });
      if (res.data?.success) {
        setTokenData(res.data.data);
      } else {
        showError(res.data?.message || t('获取数据失败'));
      }
    } catch (e) {
      showError(e.message || t('获取数据失败'));
    } finally {
      setLoading(false);
    }
  }, [filters, t]);

  useEffect(() => {
    if (activeTab === 'model') {
      fetchModelSummary();
    } else {
      fetchTokenSummary();
    }
  }, [activeTab, fetchModelSummary, fetchTokenSummary]);

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  // 导出功能
  const handleExport = async () => {
    // 验证日期范围（最大半年）
    const startDate = new Date(filters.startDate);
    const endDate = new Date(filters.endDate);
    const diffDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
    if (diffDays > 180) {
      Toast.error({ content: t('导出时间范围不能超过半年（180天）') });
      return;
    }

    setExportLoading(true);
    try {
      const endpoint = activeTab === 'model' 
        ? '/api/billing/self/model-summary/export' 
        : '/api/billing/self/token-summary/export';

      const params = new URLSearchParams();
      params.append('start_date', filters.startDate);
      params.append('end_date', filters.endDate);

      const res = await API.get(`${endpoint}?${params.toString()}`, {
        responseType: 'blob',
      });

      // 检查返回的 blob 是否是 JSON 错误响应
      const contentType = res.headers['content-type'];
      if (contentType && contentType.includes('application/json')) {
        const text = await res.data.text();
        const json = JSON.parse(text);
        Toast.error({ content: json.message || t('导出失败') });
        return;
      }

      // 创建下载链接
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const typeName = activeTab === 'model' ? 'model_summary' : 'token_summary';
      a.download = `${typeName}_${filters.startDate}_${filters.endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      Toast.success({ content: t('导出成功') });
    } catch (error) {
      Toast.error({ content: error.response?.data?.message || t('导出失败') });
    } finally {
      setExportLoading(false);
    }
  };

  const renderSummary = () => {
    const data = activeTab === 'model' ? modelData : tokenData;
    return (
      <div style={{ marginBottom: 16, padding: '12px 16px', backgroundColor: 'var(--semi-color-fill_0)', borderRadius: 8 }}>
        <Text type="tertiary">{t('总调用次数')}: </Text>
        <Text strong style={{ fontSize: 18, marginRight: 24 }}>{data.total_request_count?.toLocaleString() || 0}</Text>
        <Text type="tertiary">{t('总Token数')}: </Text>
        <Text strong style={{ fontSize: 18 }}>{data.total?.toLocaleString() || 0}</Text>
      </div>
    );
  };

  return (
    <div className='mt-[60px] px-2'>
      <CardPro
        type='type2'
        searchArea={<BillingFilters 
          filters={filters} 
          onChange={handleFiltersChange}
          onExport={handleExport}
          exportLoading={exportLoading}
        />}
      >
        {renderSummary()}
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab={t('模型汇总')} itemKey="model">
            <Spin spinning={loading}>
              <ModelSummaryTable data={modelData} />
            </Spin>
          </TabPane>
          <TabPane tab={t('令牌汇总')} itemKey="token">
            <Spin spinning={loading}>
              <TokenSummaryTable data={tokenData} />
            </Spin>
          </TabPane>
        </Tabs>
      </CardPro>
    </div>
  );
};

export default MyPlanBilling;