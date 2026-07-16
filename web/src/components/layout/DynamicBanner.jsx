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

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { marked } from 'marked';
import { X } from 'lucide-react';

// 自动轮播间隔时间（毫秒）
const AUTO_PLAY_INTERVAL = 5000;

// Design System Colors (from DESIGN.md)
const COLORS = {
  // Banner background - 蓝紫渐变（科技感，紫气东来）
  bannerGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  // Text and accents
  pureWhite: '#ffffff',
  // Borders
  borderLight: 'rgba(0, 0, 0, 0.08)',
  borderDark: 'rgba(255, 255, 255, 0.12)',
  // Shadows
  shadowPurple: 'rgba(118, 75, 162, 0.2)',
  // Glass
  glassLight: 'rgba(255, 255, 255, 0.2)',
  glassDark: 'rgba(0, 0, 0, 0.08)',
  // Purple transparent
  purple40: 'rgba(118, 75, 162, 0.4)',
  purple8: 'rgba(118, 75, 162, 0.08)',
};

/**
 * 动态公告 Banner 组件
 * 遵循 DESIGN.md 设计系统
 * 
 * @param {Object} props
 * @param {Array} props.announcements - 公告数组，格式: [{content, type, publishDate, extra}]
 * @param {boolean} props.announcementsEnabled - 是否启用公告
 * @param {Function} props.onVisibilityChange - 可见性变化回调
 * @param {Function} props.onHeightChange - 高度变化回调
 * @param {string} [props.bannerKey] - 存储 key，用于区分不同位置的 Banner
 */
const DynamicBanner = ({ announcements, announcementsEnabled, onVisibilityChange, onHeightChange, bannerKey = 'banner' }) => {
  const [visible, setVisible] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const BANNER_HEIGHT = 48;
  const intervalRef = useRef(null);
  const announcementsRef = useRef(announcements);

  // 保持 ref 同步
  useEffect(() => {
    announcementsRef.current = announcements;
  }, [announcements]);

  // 通知父组件可见性和高度
  useEffect(() => {
    onVisibilityChange?.(visible);
    onHeightChange?.(BANNER_HEIGHT);
  }, [visible, onVisibilityChange, onHeightChange]);

  // 公告数据变化时重置索引
  useEffect(() => {
    setCurrentIndex(0);
  }, [announcements?.length]);

  // 自动轮播逻辑 - 使用 setInterval 实现真正的循环
  useEffect(() => {
    const len = announcements?.length || 0;
    if (len <= 1) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    console.log('[DynamicBanner] 启动轮播，公告数量:', len);

    // 清除之前的定时器
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // 使用 setInterval 定时切换
    intervalRef.current = setInterval(() => {
      if (isHovered) {
        return; // 鼠标悬停时不切换
      }
      
      const currentAnnouncements = announcementsRef.current;
      const currentLen = currentAnnouncements?.length || 0;
      
      if (currentLen > 1) {
        setCurrentIndex((prev) => {
          const next = (prev + 1) % currentLen;
          console.log('[DynamicBanner] 切换到索引:', next, '/', currentLen);
          return next;
        });
      }
    }, AUTO_PLAY_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [announcements?.length, isHovered]);

  // 判断是否应该显示 Banner
  const shouldShow = useMemo(() => {
    return announcementsEnabled && 
           announcements && 
           Array.isArray(announcements) && 
           announcements.length > 0 && 
           visible;
  }, [announcementsEnabled, announcements, visible]);

  // 获取当前公告
  const currentAnnouncement = useMemo(() => {
    return shouldShow && announcements ? announcements[currentIndex] : null;
  }, [shouldShow, announcements, currentIndex]);

  // 解析 Markdown 内容为 HTML
  const parseMarkdown = useCallback((text) => {
    if (!text || !text.trim()) return '';
    try {
      return marked.parse(text, { breaks: true });
    } catch (error) {
      console.error('Failed to parse markdown:', error);
      return text;
    }
  }, []);

  // 关闭 Banner
  const handleClose = useCallback(() => {
    setVisible(false);
    onVisibilityChange?.(false);
  }, [onVisibilityChange]);

  // 鼠标悬停处理
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  // ========== 计算值（非 Hook） ==========
  const contentHtml = currentAnnouncement?.content ? parseMarkdown(currentAnnouncement.content) : '';
  const extraHtml = currentAnnouncement?.extra ? parseMarkdown(currentAnnouncement.extra) : '';
  const hasMultiple = (announcements?.length || 0) > 1;

  // ========== 条件渲染（在所有 Hook 之后） ==========
  if (!shouldShow) {
    return null;
  }

  return (
    <div
      className="w-full transition-all duration-300 dynamic-banner-container"
      style={{
        background: COLORS.bannerGradient,
        padding: '0 24px',
        position: 'relative',
        height: `${BANNER_HEIGHT}px`,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        boxShadow: `0 4px 10px ${COLORS.shadowPurple}`,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 公告内容区域 - 居中 */}
      <div
        style={{
          flex: '1',
          overflow: 'hidden',
          marginRight: '48px',
          position: 'relative',
          height: `${BANNER_HEIGHT - 16}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* 当前公告，使用 CSS animation 实现向上淡入效果 */}
        <div
          key={currentIndex}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'bannerSlideIn 0.6s ease-out',
          }}
        >
          {/* 公告文本内容 - The Future 字体，负字母间距 */}
          <div
            className="dynamic-banner-content"
            style={{
              color: COLORS.pureWhite,
              fontSize: '14px',
              fontWeight: 400,
              lineHeight: 1.4,
              letterSpacing: '-0.14px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              cursor: 'default',
            }}
            dangerouslySetInnerHTML={{ __html: contentHtml }}
            title={currentAnnouncement?.content}
          />
        </div>
      </div>

      {/* 关闭按钮 - Glass on Dark 风格 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
        style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: COLORS.glassLight,
          border: 'none',
          color: COLORS.pureWhite,
          fontSize: '14px',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          opacity: 0.5,
        }}
        onMouseEnter={(e) => { 
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
          e.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(e) => { 
          e.currentTarget.style.background = COLORS.glassLight;
          e.currentTarget.style.opacity = '0.5';
        }}
        title="关闭"
      >
        <X size={14} />
      </button>

      {/* 额外说明（可选，展开显示） */}
      {extraHtml && (
        <div
          className="dynamic-banner-extra"
          style={{
            position: 'absolute',
            top: `${BANNER_HEIGHT}px`,
            left: '0',
            right: '0',
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '6px 24px',
            color: COLORS.pureWhite,
            fontSize: '12px',
            lineHeight: 1.4,
            letterSpacing: '-0.12px',
          }}
        >
          <div
            className="dynamic-banner-extra-content"
            dangerouslySetInnerHTML={{ __html: extraHtml }}
          />
        </div>
      )}

      {/* 全局动画样式 */}
      <style>{`
        @keyframes bannerSlideIn {
          0% {
            opacity: 0;
            transform: translateY(15px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default DynamicBanner;
