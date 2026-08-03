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
import { Link } from 'react-router-dom';
import SkeletonWrapper from '../components/SkeletonWrapper';

const Navigation = ({
  mainNavLinks,
  isMobile,
  isLoading,
  userState,
  pricingRequireAuth,
}) => {
  const renderNavLinks = () => {
    const baseClasses =
      'flex-shrink-0 flex items-center gap-1 transition-all duration-200 ease-in-out';
    const hoverClasses = 'hover:text-blue-600';
    const spacingClasses = isMobile ? 'p-1' : 'p-2';

    const commonLinkClasses = `${baseClasses} ${spacingClasses} ${hoverClasses} body`;

    return mainNavLinks.map((link) => {
      const linkContent = <span>{link.text}</span>;

      if (link.isExternal) {
        return (
          <a
            key={link.itemKey}
            href={link.externalLink}
            target='_blank'
            rel='noopener noreferrer'
            className={commonLinkClasses}
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
        <Link key={link.itemKey} to={targetPath} state={linkState} className={commonLinkClasses}>
          {linkContent}
        </Link>
      );
    });
  };

  return (
    <nav className='flex items-center gap-4 mx-4 overflow-x-auto whitespace-nowrap scrollbar-hide justify-center'>
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
