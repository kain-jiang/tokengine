import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TabPane, Tabs, Spin, Typography } from '@douyinfe/semi-ui';
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
        searchArea={<BillingFilters filters={filters} onChange={handleFiltersChange} />}
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