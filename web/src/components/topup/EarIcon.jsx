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
import { Gift } from 'lucide-react';

const EarIcon = ({ onClick, hasNotification }) => {
  return (
    <button
      onClick={onClick}
      className={`fixed right-4 top-1/2 transform -translate-y-1/2 z-30
        w-14 h-14 rounded-full
        bg-gradient-to-br from-green-400 to-emerald-500
        shadow-lg hover:shadow-xl
        flex items-center justify-center
        transition-all duration-300
        hover:scale-110 active:scale-95
        animate-breathe`}
      style={{
        animation: 'breathe 2s ease-in-out infinite',
      }}
      aria-label='邀请好友'
      title='邀请好友'
    >
      <Gift size={28} color='white' strokeWidth={2.5} />
      {hasNotification && (
        <span
          className='absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full
                     border-2 border-white animate-pulse'
        />
      )}
    </button>
  );
};

export default EarIcon;
