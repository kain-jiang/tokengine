import { useTranslation } from 'react-i18next';
import { Button, DatePicker, Space } from '@douyinfe/semi-ui';
import { IconSearch, IconRefresh } from '@douyinfe/semi-icons';

const BillingFilters = ({ filters, onChange }) => {
  const { t } = useTranslation();

  const handleChange = (key, value) => {
    onChange({
      ...filters,
      [key]: value
    });
  };

  const handleReset = () => {
    const getDefaultDate = (daysAgo) => {
      const date = new Date();
      date.setDate(date.getDate() + daysAgo);
      return date.toISOString().split('T')[0];
    };
    onChange({
      startDate: getDefaultDate(-7),
      endDate: getDefaultDate(0)
    });
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <Space spacing={12} wrap>
        <DatePicker
          value={filters.startDate}
          onChange={(date) => handleChange('startDate', date)}
          placeholder={t('开始日期')}
          format="yyyy-MM-dd"
          style={{ width: 150 }}
        />
        <DatePicker
          value={filters.endDate}
          onChange={(date) => handleChange('endDate', date)}
          placeholder={t('结束日期')}
          format="yyyy-MM-dd"
          style={{ width: 150 }}
        />
        <Button
          icon={<IconSearch />}
          type="primary"
          onClick={() => onChange({ ...filters })}
        >
          {t('搜索')}
        </Button>
        <Button
          icon={<IconRefresh />}
          onClick={handleReset}
        >
          {t('重置')}
        </Button>
      </Space>
    </div>
  );
};

export default BillingFilters;