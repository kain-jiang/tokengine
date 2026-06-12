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

import { useState, useEffect } from 'react';
import { API } from '../../helpers';

/**
 * Hook用于获取用户统计数据
 * @returns {Object} 用户统计数据和加载状态
 */
export const useUserStats = () => {
  const [userStats, setUserStats] = useState({
    totalUsers: 0,
    todayUsers: 0,
    weekUsers: 0,
    recentUsers: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchUserStats = async () => {
    try {
      setLoading(true);
      // 用户统计数据已经在GetStatus接口中返回，直接从StatusContext获取
      // 这里我们提供一个独立的API调用作为备选方案
      const res = await API.get('/api/status');
      const { success, data } = res.data;
      if (success && data?.user_stats) {
        setUserStats(data.user_stats);
      }
    } catch (error) {
      console.error('获取用户统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserStats();
  }, []);

  return { userStats, loading, refetch: fetchUserStats };
};

/**
 * Hook用于数字滚动动画
 * @param {number} targetValue - 目标数值
 * @param {number} duration - 动画持续时间（毫秒）
 * @returns {number} 当前显示数值
 */
export const useNumberRolling = (targetValue, duration = 1500) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (targetValue === 0) {
      setDisplayValue(0);
      return;
    }

    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const elapsedTime = Date.now() - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      
      // 使用easeOutCubic缓动函数
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.floor(
        startValue + (targetValue - startValue) * easedProgress
      );
      
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
