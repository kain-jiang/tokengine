# 硅基流动风格首页 · 交付说明

## 产出文件

`web/public/silicon-landing.html` —— 参照 siliconflow.cn 首页结构与设计语言重做的可插拔首页内容页（不含 header/footer，沿用应用自带导航与页脚）。

## 页面结构（自上而下）

1. **Hero**：新品公告 pill + 渐变大字标题 + 双 CTA + 四项核心数据 + **纯 CSS 双环模型轨道动画**（10 个模型徽章正反双向公转、文字始终水平）+ 漂浮毛玻璃 API 代码卡
2. **供应商跑马灯**：20 个供应商徽章，两行反向无限滚动，悬停暂停
3. **产品矩阵**：4 卡片（大模型 API / 令牌分发计费 / 智能渠道路由 / 私有化部署），对标硅基流动四大产品
4. **热门模型套餐**：三个在售套餐（豆包视频 2.0 ¥138 / Kimi 3 ¥192 / 万相 2.2 ¥160）
5. **为什么选择我们**：深色数据带——高速引擎 100ms/10x/全球 + 高性价比 40%/50%+/0 元 六组大数字，下接高稳定/高智能/高安全/高扩展四支柱
6. **行业解决方案**：互联网/教育/政务/智算中心/AI 硬件 五个 **纯 CSS Tab**（radio `:checked` 实现，可键盘操作）
7. **渠道合作伙伴**：16 个厂商文字徽标墙
8. **CTA**：渐变行动卡片，引导注册与定价页

## 关键技术决策

- 首页内容经 `dangerouslySetInnerHTML` 注入，**`<script>` 不执行**，故全部交互为纯 CSS（keyframes、radio `:checked`、hover）
- 所有类名/变量/关键帧带 `sf-` 前缀，避免污染宿主 Semi UI 样式；背景采用淡紫渐变 + 网格 + 噪点营造纵深
- 移动优先响应式（1080/900/640 三档断点），移动端无横向溢出；尊重 `prefers-reduced-motion`

## 配套修复（React 应用侧）

1. **页脚脱离视口钉死**（`web/src/components/layout/PageLayout.jsx`）：非控制台页面（首页/关于等）的 `Layout.Footer` 移入滚动容器 `Content` 内部并采用 flex 列布局——长页面时页脚排在瀑布流末尾，短页面时仍吸底（sticky footer）；控制台页面保持原布局不变
2. **回到顶部**（`web/src/pages/Home/index.jsx`）：接入 Semi UI `BackTop` 组件，滚动超 400px 后出现，450ms 平滑回顶；桌面端目标为 `.semi-layout-content` 滚动容器，移动端为 window
3. **页脚压扁**（`web/src/components/layout/Footer.jsx`）：非演示站页脚 padding 从 `py-16` 收紧到 `py-4`（演示站带链接列保持 `py-16`），两个分支统一加顶部细分隔线

构建验证：`vite build` 18362 个模块全部编译通过（dist 写入被本地沙箱拦截属环境限制，不影响代码）。

**部署提醒**：后端通过 `go:embed web/dist` 把前端嵌入 exe，前端任何改动需 `bun run build` → 重新 `go build` → 重启 exe 后生效。

## 启用方法

1. 生产环境先执行 `cd web && bun run build`（让文件复制进 dist）
2. 后台 `/console/setting?tab=other` → 首页内容设置，填入完整 URL：`http(s)://<你的域名>/silicon-landing.html`
3. 清除浏览器 localStorage 中 `home_page_content` 缓存或等待自动刷新

## 验证情况

Playwright 截图验证：桌面端各板块、Tab 切换、轨道动画文字水平、移动端 390px 无横向溢出，全部通过。
