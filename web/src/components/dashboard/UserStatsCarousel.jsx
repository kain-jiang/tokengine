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

import React, { useState, useEffect, useRef, useCallback, useMemo, useContext } from 'react';
import { Card, Avatar } from '@douyinfe/semi-ui';
import { User, Users, TrendingUp, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../context/Status';
import { useActualTheme } from '../../context/Theme';

/**
 * 数字滚动动画hook
 * @param {number} targetValue - 目标数值
 * @param {number} duration - 动画持续时间（毫秒）
 * @returns {number} 当前显示数值
 */
const useNumberRolling = (targetValue, duration = 1500) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (targetValue === 0) {
      setDisplayValue(0);
      return;
    }

    const startTime = Date.now();

    const animate = () => {
      const elapsedTime = Date.now() - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      
      // 使用easeOutCubic缓动函数
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.floor(targetValue * easedProgress);
      
      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetValue);
      }
    };

    requestAnimationFrame(animate);
  }, [targetValue, duration]);

  return displayValue;
};

/**
 * 注册人数滚动轮播组件
 * 显示总用户数、今日新增、本周新增和最近注册用户滚动列表
 */
const UserStatsCarousel = () => {
  const { t } = useTranslation();
  const actualTheme = useActualTheme();
  const [statusState] = useContext(StatusContext);
  
  // 从StatusContext获取用户统计数据（后端使用下划线命名）
  const rawUserStats = statusState?.status?.user_stats || {};
  const userStats = {
    totalUsers: rawUserStats.total_users || 0,
    todayUsers: rawUserStats.today_users || 0,
    weekUsers: rawUserStats.week_users || 0,
    recentUsers: rawUserStats.recent_users || [],
  };
  const loading = !statusState?.status;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef(null);
  const timerRef = useRef(null);

  const { recentUsers } = userStats;

  // 使用数字滚动动画
  const displayTotalUsers = useNumberRolling(userStats.totalUsers, 2000);
  const displayTodayUsers = useNumberRolling(userStats.todayUsers, 1500);
  const displayWeekUsers = useNumberRolling(userStats.weekUsers, 1500);

  // 确保有足够的数据进行滚动（如果数据不足，重复使用）
  const displayUsers = useMemo(() => {
    if (!recentUsers || recentUsers.length === 0) {
      return [];
    }
    // 如果数据不足10条，复制一份来填充
    const users = [...recentUsers];
    while (users.length < 8) {
      users.push(...recentUsers);
    }
    return users;
  }, [recentUsers]);

  // 自动滚动功能
  const startAutoScroll = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      if (!isPaused && displayUsers.length > 0) {
        setCurrentIndex((prev) => (prev + 1) % displayUsers.length);
      }
    }, 3000);
  }, [isPaused, displayUsers.length]);

  useEffect(() => {
    startAutoScroll();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [startAutoScroll]);

  // 处理滚动列表的transform
  const scrollStyle = useMemo(() => {
    if (displayUsers.length === 0) return {};
    return {
      transform: `translateY(-${currentIndex * 48}px)`,
      transition: isPaused ? 'none' : 'transform 0.5s ease-in-out',
    };
  }, [currentIndex, isPaused, displayUsers.length]);

  // 格式化相对时间
  const formatRelativeTime = (userId) => {
    // 由于我们只有userId作为大致时间参考，这里显示"刚刚"
    return t('刚刚');
  };

  // 获取用户头像颜色
  const getAvatarColor = useCallback((index) => {
    const colors = ['blue', 'green', 'orange', 'purple', 'red', 'cyan', 'pink', 'amber'];
    return colors[index % colors.length];
  }, []);

  if (loading) {
    return (
      <div className='mb-4'>
        <Card
          {...{
            shape: 'rounded',
            theme: actualTheme === 'dark' ? 'dark' : 'light',
            className: `${actualTheme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100'} card-new w-full`,
          }}
          title={t('用户统计')}
        >
          <div className='space-y-3'>
            {[1, 2, 3].map((i) => (
              <div key={i} className='flex items-center justify-between'>
                <div className='flex items-center space-x-3'>
                  <div
                    className={`w-10 h-10 rounded-full animate-pulse ${
                      actualTheme === 'dark' ? 'bg-slate-700' : 'bg-emerald-200'
                    }`}
                  />
                  <div className='space-y-2'>
                    <div
                      className={`h-4 w-24 rounded animate-pulse ${
                        actualTheme === 'dark' ? 'bg-slate-700' : 'bg-emerald-200'
                      }`}
                    />
                    <div
                      className={`h-3 w-16 rounded animate-pulse ${
                        actualTheme === 'dark' ? 'bg-slate-700' : 'bg-emerald-200'
                      }`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className='mb-4'>
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
        {/* 总用户数卡片 */}
        <Card
          {...{
            shape: 'rounded',
            theme: actualTheme === 'dark' ? 'dark' : 'light',
            className: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 card-new w-full',
          }}
        >
          <div className='flex items-center justify-between p-2'>
            <div className='flex items-center space-x-4'>
              <div className='w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg'>
                <Users className='w-7 h-7 text-white' />
              </div>
              <div>
                <p className='text-sm text-gray-500'>{t('总注册用户数')}</p>
                <p className='text-3xl font-bold text-gray-800'>
                  {displayTotalUsers.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* 今日新增卡片 */}
        <Card
          {...{
            shape: 'rounded',
            theme: actualTheme === 'dark' ? 'dark' : 'light',
            className: 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100 card-new w-full',
          }}
        >
          <div className='flex items-center justify-between p-2'>
            <div className='flex items-center space-x-4'>
              <div className='w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg'>
                <TrendingUp className='w-7 h-7 text-white' />
              </div>
              <div>
                <p className='text-sm text-gray-500'>{t('今日新增')}</p>
                <p className='text-3xl font-bold text-gray-800'>
                  +{displayTodayUsers.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* 本周新增卡片 */}
        <Card
          {...{
            shape: 'rounded',
            theme: actualTheme === 'dark' ? 'dark' : 'light',
            className: 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100 card-new w-full',
          }}
        >
          <div className='flex items-center justify-between p-2'>
            <div className='flex items-center space-x-4'>
              <div className='w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg'>
                <Clock className='w-7 h-7 text-white' />
              </div>
              <div>
                <p className='text-sm text-gray-500'>{t('本周新增')}</p>
                <p className='text-3xl font-bold text-gray-800'>
                  +{displayWeekUsers.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 最近注册用户滚动列表 */}
      {displayUsers.length > 0 && (
        <Card
          {...{
            shape: 'rounded',
            theme: actualTheme === 'dark' ? 'dark' : 'light',
            className: `${actualTheme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gradient-to-br from-slate-50 to-gray-50 border-slate-100'} card-new w-full mt-4`,
          }}
          title={
            <div className='flex items-center space-x-2'>
              <User className='w-5 h-5 text-blue-500' />
              <span>{t('最近注册用户')}</span>
            </div>
          }
        >
          <div
            className='relative overflow-hidden'
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* 渐变遮罩 */}
            <div
              className={`absolute top-0 left-0 right-0 h-8 z-10 ${
                actualTheme === 'dark'
                  ? 'bg-gradient-to-b from-slate-800/80 to-transparent'
                  : 'bg-gradient-to-b from-white/80 to-transparent'
              }`}
            />
            <div
              className={`absolute bottom-0 left-0 right-0 h-8 z-10 ${
                actualTheme === 'dark'
                  ? 'bg-gradient-to-t from-slate-800/80 to-transparent'
                  : 'bg-gradient-to-t from-white/80 to-transparent'
              }`}
            />

            {/* 滚动容器 */}
            <div
              ref={scrollRef}
              className='space-y-1'
              style={{ maxHeight: '160px', overflow: 'hidden' }}
            >
              <div style={scrollStyle}>
                {displayUsers.map((user, index) => (
                  <div
                    key={`${user.id}-${index}`}
                    className='flex items-center justify-between h-12 px-3 rounded-lg hover:bg-opacity-80 transition-colors'
                    style={{
                      height: '48px',
                      backgroundColor: 'transparent',
                    }}
                    onMouseEnter={() => {
                      // 鼠标悬停时更新当前索引，确保持续滚动
                      const realIndex = index % displayUsers.length;
                      setCurrentIndex(realIndex);
                    }}
                  >
                    <div className='flex items-center space-x-3'>
                      <Avatar
                        size='small'
                        color={getAvatarColor(index)}
                        className='shadow-md'
                      >
                        {user.display_name?.charAt(0)?.toUpperCase() ||
                          user.username?.charAt(0)?.toUpperCase() ||
                          'U'}
                      </Avatar>
                      <div>
                        <p className='font-medium text-gray-800 text-sm'>
                          {user.display_name || user.username || t('用户')}
                        </p>
                        <p className='text-xs text-gray-500'>
                          @{user.username || 'user'}
                        </p>
                      </div>
                    </div>
                    <span className='text-xs text-gray-400'>
                      {formatRelativeTime(user.id)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default UserStatsCarousel;
