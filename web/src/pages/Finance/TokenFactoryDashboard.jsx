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

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as echarts from 'echarts';
import { IconArrowLeft } from '@douyinfe/semi-icons';

/* =========================================================
   Token 工厂生产运营大屏（前端演示版）
   数据为模拟数据，接入真实数据时替换 CONFIG 与各定时器即可
   ========================================================= */

const CONFIG = {
  models: [
    { name: 'DeepSeek-V3', calls: 12400, cost: 45200, color: '#00d4ff', inPrice: 2, outPrice: 8 },
    { name: 'GPT-4o (转售)', calls: 8200, cost: 78000, color: '#2d7ff9', inPrice: 18, outPrice: 60 },
    { name: 'Qwen2.5-72B', calls: 15600, cost: 23400, color: '#00ff9d', inPrice: 1, outPrice: 3 },
    { name: 'Llama-3.1-405B', calls: 3200, cost: 52000, color: '#a855f7', inPrice: 5, outPrice: 15 },
    { name: 'Claude-3.5 (转售)', calls: 5600, cost: 61000, color: '#ff9f43', inPrice: 21, outPrice: 63 },
    { name: 'GLM-4-Plus', calls: 9800, cost: 31200, color: '#ff5e5e', inPrice: 4, outPrice: 12 },
    { name: 'Kimi-Moonshot', calls: 6700, cost: 39800, color: '#ffd166', inPrice: 6, outPrice: 18 },
  ],
  regions: [
    { name: '乌兰察布', icon: '乌', gpus: 60, color: '#00ff9d', pue: 1.18, note: '绿电充足 · PUE 最优' },
    { name: '成都', icon: '成', gpus: 48, color: '#00d4ff', pue: 1.25, note: '西部枢纽 · 算力主力' },
    { name: '雅安', icon: '雅', gpus: 42, color: '#2d7ff9', pue: 1.2, note: '水电富集 · 低碳运行' },
    { name: '广州', icon: '广', gpus: 38, color: '#ff9f43', pue: 1.32, note: '华南出口 · 低延迟' },
    { name: '深圳', icon: '深', gpus: 32, color: '#a855f7', pue: 1.35, note: '边缘节点 · 就近推理' },
  ],
  gpuCount: 24,
  baseTps: 1.24,
  points: 60,
  elecPrice: 0.34,
  dailyKwh: 134400,
  totalGpus: 220,
};

const USERS = ['#8842', '#1290', '#3367', '#5512', '#7781', '#9023', '#4418', '#6650', '#2210', '#9907'];

const pad = (n) => String(n).padStart(2, '0');

export default function TokenFactoryDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // 时钟
  const [now, setNow] = useState(new Date());

  // KPI
  const [kpi, setKpi] = useState({
    tokens: 8.62,
    tps: 1.24,
    util: 87.3,
    eff: 48.6,
    models: 12,
    rev: 286400,
    margin: 62.4,
  });

  // 生产流程
  const [flow, setFlow] = useState({ req: 1284, cache: 12, gpu: '192/220', gen: '1.24M', lat: 380 });

  // GPU 集群
  const [gpus, setGpus] = useState([]);

  // 地域节点
  const [regions, setRegions] = useState([]);

  // TPS 曲线数据
  const [tpsData, setTpsData] = useState([]);

  // 模型排行（含实时增量）
  const [models, setModels] = useState(() => CONFIG.models.map((m) => ({ ...m })));

  // 费用流水
  const [txList, setTxList] = useState([]);

  // 成本拆解
  const [costs, setCosts] = useState([]);
  const [elecNote, setElecNote] = useState('');
  const [totalRev, setTotalRev] = useState(286400);
  const [totalTokens, setTotalTokens] = useState(8.62);

  // 图表 refs
  const tpsChartRef = useRef(null);
  const donutChartRef = useRef(null);
  const tpsChartInst = useRef(null);
  const donutChartInst = useRef(null);

  // 生成一条费用流水
  const makeTx = useCallback(() => {
    const m = CONFIG.models[Math.floor(Math.random() * CONFIG.models.length)];
    const reg = CONFIG.regions[Math.floor(Math.random() * CONFIG.regions.length)];
    const inp = (Math.random() * 4 + 0.2).toFixed(1);
    const out = (Math.random() * 8 + 0.5).toFixed(1);
    const cost = ((parseFloat(inp) * m.inPrice + parseFloat(out) * m.outPrice) / 1000).toFixed(2);
    const d = new Date();
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const user = USERS[Math.floor(Math.random() * USERS.length)];
    return { time, user, model: m.name, region: reg.name, cost: parseFloat(cost) };
  }, []);

  // 初始化数据
  useEffect(() => {
    setGpus(
      Array.from({ length: CONFIG.gpuCount }, (_, i) => ({
        id: i + 1,
        util: 50 + Math.random() * 45,
      }))
    );
    setRegions(CONFIG.regions.map((r) => ({ ...r, util: 50 + Math.random() * 35 })));
    setTpsData(Array.from({ length: CONFIG.points }, () => CONFIG.baseTps + (Math.random() - 0.5) * 0.25));
    const seed = [];
    for (let i = 0; i < 8; i++) seed.push(makeTx());
    setTxList(seed);
  }, [makeTx]);

  // 时钟
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // GPU 集群更新
  useEffect(() => {
    const timer = setInterval(() => {
      setGpus((prev) =>
        prev.map((g) => {
          let u = g.util + (Math.random() - 0.5) * 10;
          u = Math.max(35, Math.min(99, u));
          return { ...g, util: u };
        })
      );
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // 地域节点更新
  useEffect(() => {
    const timer = setInterval(() => {
      setRegions((prev) =>
        prev.map((r) => {
          let u = r.util + (Math.random() - 0.5) * 8;
          u = Math.max(40, Math.min(98, u));
          return { ...r, util: u };
        })
      );
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // TPS 曲线更新
  useEffect(() => {
    const timer = setInterval(() => {
      setTpsData((prev) => {
        const last = prev[prev.length - 1];
        let v = last + (Math.random() - 0.5) * 0.18;
        v = Math.max(0.7, Math.min(1.7, v));
        const next = [...prev.slice(1), v];
        setKpi((k) => ({ ...k, tps: v }));
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 费用流水 + 营收/产量累计
  useEffect(() => {
    const timer = setInterval(() => {
      const tx = makeTx();
      setTxList((prev) => [tx, ...prev].slice(0, 10));
      setTotalRev((prev) => prev + tx.cost);
      setTotalTokens((prev) => prev + (parseFloat(tx.cost) / 1000) * Math.random() * 4);
    }, 1200);
    return () => clearInterval(timer);
  }, [makeTx]);

  // 生产流程 + 利用率/能效
  useEffect(() => {
    const timer = setInterval(() => {
      setFlow((prev) => ({
        req: Math.max(700, Math.min(1800, prev.req + (Math.random() - 0.5) * 180)),
        cache: Math.max(4, Math.min(24, prev.cache + (Math.random() - 0.5) * 4)),
        gpu: prev.gpu,
        gen: prev.gen,
        lat: Math.max(200, Math.min(600, prev.lat + (Math.random() - 0.5) * 60)),
      }));
      const a = Math.round(180 + Math.random() * 40);
      setFlow((prev) => ({ ...prev, gpu: `${a}/${CONFIG.totalGpus}`, gen: `${(a / CONFIG.totalGpus * 1.42).toFixed(2)}M` }));
      setKpi((k) => ({
        ...k,
        util: (a / CONFIG.totalGpus * 100).toFixed(1),
        eff: (48 + Math.random() * 3).toFixed(1),
      }));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // 模型排行 / 环形图 / 成本拆解 定时刷新
  useEffect(() => {
    const timer = setInterval(() => {
      setModels((prev) =>
        prev.map((m) => ({
          ...m,
          calls: m.calls + Math.floor(Math.random() * 40),
          cost: m.cost + Math.floor(Math.random() * 200),
        }))
      );
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // 计算成本拆解
  useEffect(() => {
    const elecCost = CONFIG.dailyKwh * CONFIG.elecPrice;
    const depreciation = CONFIG.totalGpus * 2800;
    const bandwidth = 12000;
    const labor = 8500;
    const cooling = elecCost * 0.15;
    const other = 6200;
    const totalCost = elecCost + depreciation + bandwidth + labor + cooling + other;
    const margin = ((totalRev - totalCost) / totalRev) * 100;

    setElecNote(
      `集群日均用电 ${CONFIG.dailyKwh.toLocaleString()} 度 · 电费 ¥${Math.round(elecCost).toLocaleString()}/日`
    );
    setKpi((k) => ({ ...k, margin: Math.max(0, margin).toFixed(1) }));

    setCosts([
      { name: '折旧摊销', val: depreciation, color: 'linear-gradient(90deg,#a855f7,#c084fc)', pct: (depreciation / totalCost) * 100 },
      { name: '电费', val: elecCost, color: 'linear-gradient(90deg,#ff9f43,#ff5e5e)', pct: (elecCost / totalCost) * 100 },
      { name: '制冷散热', val: cooling, color: 'linear-gradient(90deg,#00d4ff,#0ea5e9)', pct: (cooling / totalCost) * 100 },
      { name: '带宽网络', val: bandwidth, color: 'linear-gradient(90deg,#2d7ff9,#60a5fa)', pct: (bandwidth / totalCost) * 100 },
      { name: '人工运维', val: labor, color: 'linear-gradient(90deg,#00ff9d,#34d399)', pct: (labor / totalCost) * 100 },
      { name: '其他成本', val: other, color: 'linear-gradient(90deg,#ffd166,#fbbf24)', pct: (other / totalCost) * 100 },
    ]);
  }, [totalRev]);

  // TPS 曲线图表
  useEffect(() => {
    if (!tpsChartRef.current) return;
    if (!tpsChartInst.current) {
      tpsChartInst.current = echarts.init(tpsChartRef.current);
    }
    const chart = tpsChartInst.current;
    chart.setOption({
      animation: false,
      grid: { left: 8, right: 8, top: 12, bottom: 6, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: tpsData.map((_, i) => i),
        axisLine: { lineStyle: { color: 'rgba(0,212,255,0.15)' } },
        axisLabel: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0.7,
        max: 1.7,
        splitLine: { lineStyle: { color: 'rgba(0,212,255,0.07)' } },
        axisLabel: { color: '#7a93b8', fontSize: 10 },
      },
      series: [
        {
          type: 'line',
          data: tpsData,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2.5, color: '#00d4ff' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(0,212,255,0.35)' },
              { offset: 1, color: 'rgba(0,212,255,0)' },
            ]),
          },
        },
      ],
    });
  }, [tpsData]);

  // 营收环形图
  useEffect(() => {
    if (!donutChartRef.current) return;
    if (!donutChartInst.current) {
      donutChartInst.current = echarts.init(donutChartRef.current);
    }
    const chart = donutChartInst.current;
    const total = models.reduce((s, m) => s + m.cost, 0);
    chart.setOption({
      tooltip: { trigger: 'item', backgroundColor: 'rgba(13,26,51,0.9)', borderColor: 'rgba(0,212,255,0.2)', textStyle: { color: '#e6f1ff' } },
      series: [
        {
          type: 'pie',
          radius: ['62%', '82%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderColor: '#050a16', borderWidth: 2 },
          label: {
            show: true,
            position: 'center',
            formatter: () => `¥${(total / 1000).toFixed(0)}k`,
            color: '#ffd166',
            fontSize: 16,
            fontWeight: 800,
            fontFamily: 'monospace',
          },
          emphasis: { label: { show: true, fontSize: 18 } },
          data: models.map((m) => ({ name: m.name, value: m.cost, itemStyle: { color: m.color } })),
        },
      ],
    });
  }, [models]);

  // 窗口 resize
  useEffect(() => {
    const handleResize = () => {
      tpsChartInst.current?.resize();
      donutChartInst.current?.resize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 卸载时销毁图表
  useEffect(() => {
    return () => {
      tpsChartInst.current?.dispose();
      donutChartInst.current?.dispose();
      tpsChartInst.current = null;
      donutChartInst.current = null;
    };
  }, []);

  const gpuColor = (u) => (u > 85 ? '#ff5e5e' : u > 65 ? '#ff9f43' : '#00ff9d');
  const gpuBar = (u) =>
    u > 85
      ? 'linear-gradient(90deg,#ff9f43,#ff5e5e)'
      : u > 65
        ? 'linear-gradient(90deg,#00d4ff,#00ff9d)'
        : 'linear-gradient(90deg,#2d7ff9,#00d4ff)';
  const regionColor = (u) => (u > 85 ? '#ff5e5e' : u > 65 ? '#ff9f43' : '#00ff9d');
  const regionBar = (u) =>
    u > 85
      ? 'linear-gradient(90deg,#ff9f43,#ff5e5e)'
      : u > 65
        ? 'linear-gradient(90deg,#00d4ff,#00ff9d)'
        : 'linear-gradient(90deg,#2d7ff9,#00d4ff)';

  const maxCalls = Math.max(...models.map((m) => m.calls));
  const rankList = [...models].sort((a, b) => b.calls - a.calls);

  const kpiItems = [
    { label: t('今日 Token 总产量'), value: kpi.tokens.toFixed(2), unit: t('亿'), trend: '▲ +12.4% 环比', color: '#00d4ff' },
    { label: t('实时吞吐 TPS'), value: kpi.tps.toFixed(2), unit: 'M tok/s', trend: '▲ 负载饱满', color: '#00ff9d' },
    { label: t('GPU 集群利用率'), value: kpi.util, unit: '%', trend: '▲ +3.1%', color: '#ff9f43' },
    { label: t('综合能效比'), value: kpi.eff, unit: 'K tok/W', trend: '▲ 行业领先', color: '#a855f7' },
    { label: t('在线模型数'), value: kpi.models, unit: t('个'), trend: '● 正常', color: '#2d7ff9' },
    { label: t('今日营收'), value: Math.round(totalRev).toLocaleString(), unit: '¥', trend: '▲ +18.7%', color: '#ffd166' },
    { label: t('今日净利率'), value: kpi.margin, unit: '%', trend: '▲ 成本可控', color: '#c9a96e' },
  ];

  const flowStages = [
    { name: t('用户请求接入'), val: Math.round(flow.req).toLocaleString(), desc: t('实时并发请求') },
    { name: t('智能调度路由'), val: `${flow.cache.toFixed(0)}%`, desc: t('缓存命中率') },
    { name: t('GPU 推理集群'), val: flow.gpu, desc: t('活跃计算卡') },
    { name: t('Token 流式生成'), val: flow.gen, desc: 'tok/s 实时产出' },
    { name: t('结果返回'), val: Math.round(flow.lat), desc: 'P99 延迟 ms' },
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      background: `
        radial-gradient(1200px 600px at 20% -10%, rgba(0,212,255,0.10), transparent 60%),
        radial-gradient(1000px 500px at 90% 0%, rgba(168,85,247,0.10), transparent 60%),
        #050a16
      `,
      color: '#e6f1ff',
      fontFamily: "-apple-system,'PingFang SC','Microsoft YaHei',Segoe UI,Roboto,sans-serif",
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 10000,
    }}>
      {/* 背景网格 */}
      <div aria-hidden style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(0,212,255,0.045) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,212,255,0.045) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse at 50% 0%, black 30%, transparent 85%)',
        WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, black 30%, transparent 85%)',
      }} />

      {/* 顶部栏 */}
      <div style={{
        position: 'relative',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: '12px 16px 0',
        padding: '10px 24px',
        borderRadius: '12px',
        background: 'linear-gradient(90deg, rgba(201,169,110,0.12), rgba(13,26,51,0.4) 40%, rgba(0,212,255,0.10))',
        border: '1px solid rgba(0,212,255,0.16)',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => navigate('/console/finance')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(13,26,51,0.55)',
              border: '1px solid rgba(0,212,255,0.2)',
              color: '#7dd8ff',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,212,255,0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(13,26,51,0.55)'; }}
          >
            <IconArrowLeft size={14} />
            {t('返回财务')}
          </button>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '9px',
            background: 'linear-gradient(135deg, #c9a96e, #8b6914)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: 900,
            color: '#1a1208',
            boxShadow: '0 0 14px rgba(201,169,110,0.4)',
          }}>T</div>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <div style={{
              fontSize: '22px',
              fontWeight: 800,
              letterSpacing: '2px',
              background: 'linear-gradient(90deg,#fff,#c9a96e)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              lineHeight: 1.2,
            }}>{t('Token 工厂生产运营大屏')}</div>
            <span style={{
              fontSize: '11px',
              color: '#7a93b8',
              marginLeft: '12px',
              letterSpacing: '1px',
              fontFamily: "'SF Mono','Consolas','Courier New',monospace",
              textTransform: 'uppercase',
            }}>Token Factory Ops Center</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#00ff9d' }}>
            <span style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              background: '#00ff9d',
              boxShadow: '0 0 10px #00ff9d',
              animation: 'ds-pulse 1.6s infinite',
            }} />
            {t('系统运行中')} · {t('五地集群在线')}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: '22px',
              fontWeight: 700,
              color: '#00d4ff',
              letterSpacing: '1px',
              fontFamily: "'SF Mono','Consolas','Courier New',monospace",
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.1,
            }}>
              {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
            </div>
            <div style={{ fontSize: '12px', color: '#7a93b8' }}>
              {now.getFullYear()}/{pad(now.getMonth() + 1)}/{pad(now.getDate())}
            </div>
          </div>
        </div>
      </div>

      {/* KPI 指标条 */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '10px',
        margin: '12px 16px 0',
      }}>
        {kpiItems.map((item, i) => (
          <div key={i} style={{
            background: 'rgba(13,26,51,0.55)',
            border: '1px solid rgba(0,212,255,0.16)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '88px',
          }}>
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '3px',
              height: '100%',
              background: item.color,
              opacity: 0.8,
              boxShadow: `0 0 8px ${item.color}`,
            }} />
            <div style={{ fontSize: '11px', color: '#7a93b8', whiteSpace: 'nowrap' }}>{item.label}</div>
            <div>
              <span style={{ fontSize: '23px', fontWeight: 800, color: item.color, lineHeight: 1, fontFamily: "'SF Mono','Consolas',monospace", fontVariantNumeric: 'tabular-nums' }}>{item.value}</span>
              <span style={{ fontSize: '11px', color: '#7a93b8', fontWeight: 400, marginLeft: '2px' }}>{item.unit}</span>
            </div>
            <div style={{ fontSize: '10px', color: '#00ff9d' }}>{item.trend}</div>
          </div>
        ))}
      </div>

      {/* 主体 4 列 */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1.5fr 1.3fr 1fr',
        gap: '10px',
        margin: '12px 16px 16px',
        minHeight: 0,
      }}>
        {/* COL 1: 生产流程 + GPU 集群 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
          <div style={{ flex: 1.1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'rgba(13,26,51,0.55)', border: '1px solid rgba(0,212,255,0.16)', borderRadius: '12px', padding: '12px 14px', position: 'relative' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '4px', height: '13px', background: '#00d4ff', borderRadius: '2px', boxShadow: '0 0 8px #00d4ff' }} />
              {t('Token 生产全流程')}
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: '2px', background: 'linear-gradient(90deg,transparent,#00d4ff,transparent)', opacity: 0.2 }} />
              <div style={{ position: 'absolute', top: '50%', width: '6px', height: '6px', borderRadius: '50%', background: '#00d4ff', boxShadow: '0 0 10px #00d4ff', animation: 'ds-flow 3s linear infinite' }} />
              {flowStages.map((s, i) => (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <div style={{ width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '7px solid rgba(0,212,255,0.5)' }} />
                    </div>
                  )}
                  <div style={{
                    flex: 1,
                    background: 'rgba(0,212,255,0.05)',
                    border: '1px solid rgba(0,212,255,0.18)',
                    borderRadius: '10px',
                    padding: '8px 6px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '4px',
                  }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#00d4ff' }}>{s.name}</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: "'SF Mono','Consolas',monospace", fontVariantNumeric: 'tabular-nums' }}>{s.val}</div>
                    <div style={{ fontSize: '9px', color: '#7a93b8' }}>{s.desc}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'rgba(13,26,51,0.55)', border: '1px solid rgba(0,212,255,0.16)', borderRadius: '12px', padding: '12px 14px', position: 'relative' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '4px', height: '13px', background: '#00d4ff', borderRadius: '2px', boxShadow: '0 0 8px #00d4ff' }} />
              {t('GPU 集群实时状态')}
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#7a93b8', fontWeight: 400 }}>{CONFIG.totalGpus} 卡 · 5 地机房</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', alignContent: 'start', overflow: 'hidden' }}>
              {gpus.map((g) => (
                <div key={g.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', padding: '5px 4px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ fontSize: '9px', color: '#7a93b8' }}>GPU-{pad(g.id)}</div>
                  <div style={{ fontSize: '12px', fontWeight: 800, marginTop: '2px', color: gpuColor(g.util), fontFamily: "'SF Mono','Consolas',monospace" }}>{g.util.toFixed(0)}%</div>
                  <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', marginTop: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '2px', width: `${g.util}%`, background: gpuBar(g.util), transition: 'width 0.8s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COL 2: 吞吐曲线 + 模型排行 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
          <div style={{ flex: 1.25, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'rgba(13,26,51,0.55)', border: '1px solid rgba(0,212,255,0.16)', borderRadius: '12px', padding: '12px 14px', position: 'relative' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '4px', height: '13px', background: '#00d4ff', borderRadius: '2px', boxShadow: '0 0 8px #00d4ff' }} />
              {t('实时 Token 吞吐曲线')}
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#7a93b8', fontWeight: 400 }}>{t('近 60 秒')} · M tok/s</span>
            </div>
            <div ref={tpsChartRef} style={{ flex: 1, minHeight: 0 }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'rgba(13,26,51,0.55)', border: '1px solid rgba(0,212,255,0.16)', borderRadius: '12px', padding: '12px 14px', position: 'relative' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '4px', height: '13px', background: '#00d4ff', borderRadius: '2px', boxShadow: '0 0 8px #00d4ff' }} />
              {t('各模型实时调用排行')}
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#7a93b8', fontWeight: 400 }}>{t('次数')} / {t('费用')}</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '7px', overflow: 'hidden' }}>
              {rankList.map((m, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                  <div style={{ height: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '8px', width: `${(m.calls / maxCalls) * 100}%`, background: `linear-gradient(90deg,${m.color},${m.color}aa)`, transition: 'width 1s ease' }} />
                  </div>
                  <div style={{ fontSize: '10px', color: '#7a93b8', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span style={{ fontFamily: "'SF Mono','Consolas',monospace" }}>{m.calls.toLocaleString()}</span> 次<br />
                    <b style={{ color: '#ffd166', fontSize: '12px', fontFamily: "'SF Mono','Consolas',monospace" }}>¥{m.cost.toLocaleString()}</b>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COL 3: 地域节点 + 费用流水 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
          <div style={{ flex: 1.05, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'rgba(13,26,51,0.55)', border: '1px solid rgba(0,212,255,0.16)', borderRadius: '12px', padding: '12px 14px', position: 'relative' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '4px', height: '13px', background: '#00d4ff', borderRadius: '2px', boxShadow: '0 0 8px #00d4ff' }} />
              {t('地域机房节点')}
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#7a93b8', fontWeight: 400 }}>{t('五地集群分布')}</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '7px', overflow: 'hidden' }}>
              {regions.map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '7px 10px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 900, color: '#1a1208' }}>{r.icon}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700 }}>
                      {r.name} <span style={{ fontSize: '9px', color: '#7a93b8', fontWeight: 400 }}>· {r.gpus} 卡 · PUE {r.pue}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#7a93b8' }}>{r.note}</div>
                    <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: '3px' }}>
                      <div style={{ height: '100%', borderRadius: '2px', width: `${r.util.toFixed(0)}%`, background: regionBar(r.util), transition: 'width 1s ease' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: regionColor(r.util), fontFamily: "'SF Mono','Consolas',monospace", whiteSpace: 'nowrap' }}>{r.util.toFixed(0)}%</div>
                    <div style={{ fontSize: '9px', textAlign: 'right', color: '#00ff9d' }}>● 在线</div>
                  </div>
                  <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '6px', height: '6px', borderRadius: '50%', background: r.color, boxShadow: `0 0 8px ${r.color}`, animation: 'ds-pulse 1.6s infinite' }} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: 1.1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'rgba(13,26,51,0.55)', border: '1px solid rgba(0,212,255,0.16)', borderRadius: '12px', padding: '12px 14px', position: 'relative' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '4px', height: '13px', background: '#00d4ff', borderRadius: '2px', boxShadow: '0 0 8px #00d4ff' }} />
              {t('实时费用流水')}
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#7a93b8', fontWeight: 400 }}>{t('用户调用计费')}</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '5px', overflow: 'hidden' }}>
              {txList.map((tx, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '10px', padding: '4px 8px', borderRadius: '7px', background: 'rgba(255,255,255,0.03)', borderLeft: '2px solid #00d4ff', animation: 'ds-slideIn 0.5s ease' }}>
                  <span style={{ color: '#7a93b8', fontFamily: "'SF Mono','Consolas',monospace" }}>{tx.time}</span>
                  <span style={{ color: '#00d4ff', fontWeight: 700 }}>{t('用户')}{tx.user}</span>
                  <span style={{ color: '#e6f1ff' }}>→ {tx.model} <span style={{ color: '#7a93b8', fontSize: '9px' }}>[{tx.region}]</span></span>
                  <span style={{ marginLeft: 'auto', color: '#ffd166', fontWeight: 700, fontFamily: "'SF Mono','Consolas',monospace" }}>¥{tx.cost.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COL 4: 成本拆解 + 营收来源 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
          <div style={{ flex: 1.15, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'rgba(13,26,51,0.55)', border: '1px solid rgba(0,212,255,0.16)', borderRadius: '12px', padding: '12px 14px', position: 'relative' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '4px', height: '13px', background: '#00d4ff', borderRadius: '2px', boxShadow: '0 0 8px #00d4ff' }} />
              {t('成本拆解分析')}
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#7a93b8', fontWeight: 400 }}>¥/日</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ background: 'rgba(255,159,67,0.08)', border: '1px solid rgba(255,159,67,0.25)', borderRadius: '10px', padding: '10px', marginBottom: '8px' }}>
                <div style={{ fontSize: '10px', color: '#7a93b8' }}>{t('电费单价')}</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#ff9f43', fontFamily: "'SF Mono','Consolas',monospace" }}>
                  {CONFIG.elecPrice} <small style={{ fontSize: '11px', color: '#7a93b8', fontWeight: 400 }}>{t('元/度')}</small>
                </div>
                <div style={{ fontSize: '9px', color: '#7a93b8', marginTop: '2px' }}>{elecNote}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {costs.map((c, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '11px' }}>
                      <span style={{ color: '#7a93b8' }}><b style={{ color: '#e6f1ff', fontWeight: 700 }}>{t(c.name)}</b></span>
                      <span style={{ color: '#ffd166', fontWeight: 800, fontSize: '13px', fontFamily: "'SF Mono','Consolas',monospace" }}>
                        ¥{Math.round(c.val).toLocaleString()} <span style={{ fontSize: '9px', color: '#7a93b8' }}>({c.pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: '3px', width: `${c.pct.toFixed(1)}%`, background: c.color, transition: 'width 1s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'rgba(13,26,51,0.55)', border: '1px solid rgba(0,212,255,0.16)', borderRadius: '12px', padding: '12px 14px', position: 'relative' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '4px', height: '13px', background: '#00d4ff', borderRadius: '2px', boxShadow: '0 0 8px #00d4ff' }} />
              {t('营收来源占比')}
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div ref={donutChartRef} style={{ flex: '0 0 auto', width: '140px', height: '140px' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '10px', overflow: 'hidden' }}>
                {models.slice(0, 7).map((m, i) => {
                  const total = models.reduce((s, x) => s + x.cost, 0);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: m.color, flex: '0 0 auto' }} />
                      <span style={{ color: '#7a93b8', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                      <span style={{ color: '#e6f1ff', fontWeight: 700, fontFamily: "'SF Mono','Consolas',monospace" }}>{(m.cost / total * 100).toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 底部说明 */}
      <div style={{ position: 'absolute', right: '16px', bottom: '6px', fontSize: '9px', color: '#7a93b8', opacity: 0.6, zIndex: 10 }}>
        {t('数据为模拟演示 · 接入真实数据请修改 CONFIG 配置')} · Token Factory Ops v2.0
      </div>

      {/* 全局动画 keyframes */}
      <style>{`
        @keyframes ds-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes ds-flow { 0% { left: 4%; } 100% { left: 96%; } }
        @keyframes ds-slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}
