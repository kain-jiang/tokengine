import { useTranslation } from 'react-i18next';
import { Table } from '@douyinfe/semi-ui';
import { convertUSDToCurrency } from '../../../helpers/render';

const ModelSummaryTable = ({ data }) => {
  const { t } = useTranslation();
  
  const columns = [
    {
      title: t('用户'),
      dataIndex: 'username',
      width: 120,
    },
    {
      title: t('模型名称'),
      dataIndex: 'model_name',
      width: 150,
    },
    {
      title: t('调用次数'),
      dataIndex: 'request_count',
      width: 100,
      sorter: (a, b) => a.request_count - b.request_count,
    },
    {
      title: t('Token总数'),
      dataIndex: 'total_tokens',
      width: 120,
      sorter: (a, b) => a.total_tokens - b.total_tokens,
      render: (text) => text?.toLocaleString() || 0,
    },
    {
      title: t('消费金额'),
      dataIndex: 'quota_consumed',
      width: 100,
      sorter: (a, b) => a.quota_consumed - b.quota_consumed,
      render: (text) => convertUSDToCurrency(text || 0, 6),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={data?.items || []}
      pagination={{
        pageSize: 20,
        showSizeChanger: true,
        showQuickJumper: true,
      }}
      emptyText={t('暂无数据')}
    />
  );
};

export default ModelSummaryTable;