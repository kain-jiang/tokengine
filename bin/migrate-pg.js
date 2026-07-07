const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// 数据库配置
const dbConfig = {
  host: '192.168.199.86',
  port: 5432,
  database: 'new-api',
  user: 'root',
  password: '1234qazx'
};

async function migrate() {
  const client = new Client(dbConfig);
  
  try {
    console.log('正在连接数据库...');
    await client.connect();
    console.log('数据库连接成功!');

    // 读取 SQL 文件
    const sqlFile = path.join(__dirname, 'create_supplier_settlement_tables-pg.sql');
    let sqlContent = fs.readFileSync(sqlFile, 'utf8');

    // 移除注释行
    sqlContent = sqlContent.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');

    // 分割 SQL 语句
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    let executed = 0;
    let skipped = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.substring(0, 60).replace(/\s+/g, ' ') + '...';
      
      console.log(`[${i + 1}] 执行: ${preview}`);
      
      try {
        await client.query(stmt);
        console.log('  成功!');
        executed++;
      } catch (err) {
        console.log(`  警告: ${err.message}`);
        skipped++;
      }
      
      // 添加小延迟避免过快
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n========== 迁移完成 ==========');
    console.log(`执行成功: ${executed}`);
    console.log(`跳过/警告: ${skipped}`);

  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    await client.end();
    console.log('数据库连接已关闭');
  }
}

migrate();
