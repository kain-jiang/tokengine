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

import React, { useState, useEffect } from 'react';
import { Button } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useHeaderBar } from '../../../hooks/common/useHeaderBar';
import { useNotifications } from '../../../hooks/common/useNotifications';
import { useNavigation } from '../../../hooks/common/useNavigation';
import NoticeModal from '../NoticeModal';
import MobileMenuButton from './MobileMenuButton';
import HeaderLogo from './HeaderLogo';
import Navigation from './Navigation';
import ActionButtons from './ActionButtons';

const HeaderBar = ({ onMobileMenuToggle, drawerOpen, onBannerVisibilityChange }) => {
  const {
    userState,
    statusState,
    isMobile,
    collapsed,
    logoLoaded,
    currentLang,
    isLoading,
    systemName,
    logo,
    isNewYear,
    isSelfUseMode,
    docsLink,
    isDemoSiteMode,
    isConsoleRoute,
    theme,
    headerNavModules,
    pricingRequireAuth,
    logout,
    handleLanguageChange,
    handleThemeToggle,
    handleMobileMenuToggle,
    navigate,
    t,
  } = useHeaderBar({ onMobileMenuToggle, drawerOpen });

  const {
    noticeVisible,
    unreadCount,
    handleNoticeOpen,
    handleNoticeClose,
    getUnreadKeys,
  } = useNotifications(statusState);

  const { mainNavLinks } = useNavigation(t, docsLink, headerNavModules);
  
  const { i18n } = useTranslation();
  const navigateInternal = useNavigate();
  const [bannerVisible, setBannerVisible] = useState(true);

  useEffect(() => {
    setBannerVisible(true);
  }, []);

  const isChinese = ['zh', 'zh-CN', 'zh-TW'].includes(i18n.language);

  const handleRegister = () => {
    navigateInternal('/register');
  };

  const handleCloseBanner = () => {
    setBannerVisible(false);
    onBannerVisibilityChange?.(false);
  };

  return (
    <header className='sticky top-0 z-50 transition-colors duration-300 bg-gradient-to-r from-white via-blue-50/80 to-purple-50/80 backdrop-blur-xl border-b border-gray-100/50 shadow-[0_1px_4px_0_rgba(0,0,0,0.03)]'>
      <NoticeModal
        visible={noticeVisible}
        onClose={handleNoticeClose}
        isMobile={isMobile}
        defaultTab={unreadCount > 0 ? 'system' : 'inApp'}
        unreadKeys={getUnreadKeys()}
      />

      {bannerVisible && (
        <div
          className="w-full"
          style={{
            background: '#12121e',
            padding: '8px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            height: '44px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              flex: '1',
              maxWidth: '1200px',
            }}
          >
            <span
              style={{
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                letterSpacing: '0.5px',
              }}
            >
              🔥 {isChinese ? '新注册用户完成实名认证即送百万 Token，开启你的 AI 调用之旅' : 'New users get 1 million Tokens after real-name verification, start your AI journey!'} 🔥
            </span>
            <Button
              theme="solid"
              type="primary"
              size="small"
              onClick={handleRegister}
              style={{
                backgroundColor: '#ffffff',
                color: '#4645e8',
                fontWeight: 'bold',
                fontSize: '14px',
                padding: '0 16px',
                height: '30px',
                border: 'none',
                whiteSpace: 'nowrap',
                borderRadius: '15px',
              }}
            >
              {isChinese ? '立即注册' : 'Sign Up Now'}
            </Button>
          </div>
          <button
            onClick={handleCloseBanner}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: '#888888',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px 8px',
              lineHeight: 1,
            }}
            title="关闭"
          >
            ×
          </button>
        </div>
      )}

      <div className='w-full px-4'>
        <div className='flex items-center justify-between h-16'>
          <div className='flex items-center'>
            <MobileMenuButton
              isConsoleRoute={isConsoleRoute}
              isMobile={isMobile}
              drawerOpen={drawerOpen}
              collapsed={collapsed}
              onToggle={handleMobileMenuToggle}
              t={t}
            />

            <HeaderLogo
              isMobile={isMobile}
              isConsoleRoute={isConsoleRoute}
              logo={logo}
              logoLoaded={logoLoaded}
              isLoading={isLoading}
              systemName={systemName}
              isSelfUseMode={isSelfUseMode}
              isDemoSiteMode={isDemoSiteMode}
              t={t}
            />
          </div>

          <Navigation
            mainNavLinks={mainNavLinks}
            isMobile={isMobile}
            isLoading={isLoading}
            userState={userState}
            pricingRequireAuth={pricingRequireAuth}
          />

          <ActionButtons
            isNewYear={isNewYear}
            unreadCount={unreadCount}
            onNoticeOpen={handleNoticeOpen}
            userState={userState}
            isLoading={isLoading}
            isMobile={isMobile}
            isSelfUseMode={isSelfUseMode}
            logout={logout}
            navigate={navigate}
            t={t}
          />
        </div>
      </div>
    </header>
  );
};

export default HeaderBar;
