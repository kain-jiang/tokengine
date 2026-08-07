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
import { Link, useLocation } from 'react-router-dom';
import SkeletonWrapper from '../components/SkeletonWrapper';

const Navigation = ({
  mainNavLinks,
  isMobile,
  isLoading,
  userState,
  pricingRequireAuth,
}) => {
  const location = useLocation();

  const isLinkActive = (link) => {
    if (link.isExternal) return false;
    if (link.itemKey === 'home') return location.pathname === '/';
    if (link.to === '/') return false;
    return location.pathname.startsWith(link.to);
  };

  const renderNavLinks = () => {
    return mainNavLinks.map((link) => {
      const active = isLinkActive(link);

      const baseClasses = [
        'relative flex-shrink-0 flex items-center gap-1 rounded-full px-3.5 py-2',
        'text-sm font-medium transition-all duration-200 ease-in-out select-none whitespace-nowrap',
        active
          ? 'text-semi-color-primary bg-semi-color-primary-light-default shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]'
          : 'text-semi-color-text-1 hover:text-semi-color-text-0 hover:bg-semi-color-fill-1 active:scale-95',
      ].join(' ');

      const linkContent = <span>{link.text}</span>;

      if (link.isExternal) {
        return (
          <a
            key={link.itemKey}
            href={link.externalLink}
            target='_blank'
            rel='noopener noreferrer'
            className={baseClasses}
          >
            {linkContent}
          </a>
        );
      }

      let targetPath = link.to;
      let linkState = undefined;
      if (link.itemKey === 'console' && !userState.user) {
        targetPath = '/login';
      }
      if (link.itemKey === 'canvasTool' && !userState.user) {
        targetPath = '/login?reason=canvas_tool';
        linkState = { from: '/canvas-tool' };
      }
      if (link.itemKey === 'pricing' && pricingRequireAuth && !userState.user) {
        targetPath = '/login';
      }

      return (
        <Link key={link.itemKey} to={targetPath} state={linkState} className={baseClasses}>
          {linkContent}
        </Link>
      );
    });
  };

  return (
    <nav className='flex items-center gap-1 mx-2 px-2 py-1.5 rounded-full bg-semi-color-fill-0 overflow-x-auto scrollbar-hide md:mx-4'>
      <SkeletonWrapper
        loading={isLoading}
        type='navigation'
        count={4}
        width={60}
        height={16}
        isMobile={isMobile}
      >
        {renderNavLinks()}
      </SkeletonWrapper>
    </nav>
  );
};

export default Navigation;
