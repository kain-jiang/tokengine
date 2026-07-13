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

import React from 'react';
import { Outlet } from 'react-router-dom';

export default function FinanceLayout() {
  return (
    <div style={{ paddingTop: '60px' }}>
      {/* 页面内容区域 */}
      <div style={{
        padding: '0 24px',
        maxWidth: 1400,
        margin: '0 auto',
      }}>
        <Outlet />
      </div>
    </div>
  );
}
