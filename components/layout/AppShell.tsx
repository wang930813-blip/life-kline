import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import LeftNav from './LeftNav';
import MobileNav from './MobileNav';
import RightSidebar from './RightSidebar';
import { useSidebar, SIDEBAR_WIDTH_EXPANDED, SIDEBAR_WIDTH_COLLAPSED } from '../../contexts/SidebarContext';
import { Star, Calendar, TrendingUp, User, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { LifeDestinyResult, UserInput } from '../../types';

interface AppShellProps {
  isLoggedIn: boolean;
  userInfo: { email: string; points: number } | null;
  onLoginClick: () => void;
  onLogout: () => void;
  onHistorySelect?: (result: LifeDestinyResult, input: UserInput) => void;
  onNewCalculation?: () => void;
  isAnalysisPanelOpen?: boolean;
}

// Mini sidebar component for collapsed state
const SidebarMini: React.FC<{
  onGenerate: () => void;
  isLoggedIn: boolean;
}> = ({ onGenerate, isLoggedIn }) => {
  const navigate = useNavigate();

  const miniItems = [
    { icon: Star, label: '今日', color: 'text-[var(--color-cinnabar)]', onClick: () => navigate('/fortune/daily') },
    { icon: Calendar, label: '本月', color: 'text-[var(--color-qingdai)]', onClick: () => navigate('/fortune/monthly') },
    { icon: TrendingUp, label: '今年', color: 'text-[var(--color-bamboo)]', onClick: () => navigate('/fortune/yearly') },
    { icon: Sparkles, label: '测算', color: 'text-[var(--color-cinnabar)]', onClick: onGenerate },
  ];

  return (
    <div className="flex flex-col items-center py-4 space-y-2">
      {miniItems.map((item, index) => (
        <button
          key={index}
          onClick={item.onClick}
          className="ink-ripple w-12 h-12 flex flex-col items-center justify-center rounded-xl hover:bg-white/80 transition-colors group"
          title={item.label}
        >
          <item.icon className={`w-5 h-5 ${item.color} group-hover:scale-110 transition-transform`} />
          <span className="text-[10px] text-[var(--color-ink-muted)] mt-0.5">{item.label}</span>
        </button>
      ))}

      <div className="h-px w-8 bg-[var(--border-ink)] my-2" />

      <button
        onClick={() => navigate(isLoggedIn ? '/dashboard' : '/')}
        className="ink-ripple w-12 h-12 flex flex-col items-center justify-center rounded-xl hover:bg-white/80 transition-colors group"
        title={isLoggedIn ? '个人中心' : '登录'}
      >
        <User className="w-5 h-5 text-[var(--color-ink-muted)] group-hover:scale-110 transition-transform" />
        <span className="text-[10px] text-[var(--color-ink-muted)] mt-0.5">{isLoggedIn ? '我的' : '登录'}</span>
      </button>
    </div>
  );
};

const AppShell: React.FC<AppShellProps> = ({
  isLoggedIn,
  userInfo,
  onLoginClick,
  onLogout,
  onHistorySelect,
  onNewCalculation,
  isAnalysisPanelOpen = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isExpanded, isHovered, isCollapsible, setIsHovered, sidebarWidth, toggleExpanded } = useSidebar();

  // Check if on homepage
  const isHomepage = location.pathname === '/' || location.pathname === '/home';

  const handleGenerate = () => {
    navigate('/');
    setTimeout(() => {
      const form = document.getElementById('bazi-form-card');
      if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const firstInput = form.querySelector('input, select, button');
        if (firstInput instanceof HTMLElement) {
          firstInput.focus();
        }
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 80);
  };

  // Determine if sidebar should show full content
  const showFullSidebar = isExpanded || isHovered || !isCollapsible;

  return (
    <div className="min-h-screen paper-texture">
      {/* Desktop: Three-column layout */}
      <div className="hidden md:flex max-w-[1440px] mx-auto scroll-unfurl">
        {/* Left Nav - Fixed/Sticky */}
        <aside className="w-[280px] shrink-0">
          <div className="fixed top-0 h-screen w-[280px] overflow-y-auto border-r border-[rgb(18_60_67_/_0.2)] bg-[rgb(251_247_234_/_0.76)]">
            <LeftNav
              isLoggedIn={isLoggedIn}
              userInfo={userInfo}
              onLoginClick={onLoginClick}
              onLogout={onLogout}
              onHistorySelect={onHistorySelect}
              onNewCalculation={onNewCalculation}
            />
          </div>
        </aside>

        {/* Main Column - Scrollable, width adjusts based on sidebar */}
        <main
          className="flex-1 min-w-0 border-r border-[rgb(18_60_67_/_0.2)] bg-[rgb(251_247_234_/_0.78)] min-h-screen transition-all duration-300"
          style={{ maxWidth: isCollapsible && !showFullSidebar ? '800px' : '680px' }}
        >
          <Outlet />
        </main>

        {/* Right Sidebar - Fixed/Sticky with collapsible support */}
        <aside
          className="shrink-0 transition-all duration-300 ease-in-out"
          style={{ width: sidebarWidth }}
        >
          <div
            className={`fixed top-0 h-screen overflow-y-auto bg-[rgb(244_234_210_/_0.72)] transition-all duration-300 ease-in-out ${
              isCollapsible && !showFullSidebar ? 'overflow-hidden' : ''
            }`}
            style={{ width: sidebarWidth }}
            onMouseEnter={() => isCollapsible && setIsHovered(true)}
            onMouseLeave={() => isCollapsible && setIsHovered(false)}
          >
            {/* Collapse/Expand Toggle Button */}
            {isCollapsible && (
              <button
                onClick={toggleExpanded}
                className="ink-ripple absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-50 w-6 h-12 bg-[var(--color-xuan-paper)] border border-[var(--border-ink)] rounded-full shadow-md hover:shadow-lg hover:bg-[var(--color-rice-paper)] flex items-center justify-center transition-all duration-200"
                title={isExpanded || isHovered ? '收起侧边栏' : '展开侧边栏'}
              >
                {isExpanded || isHovered ? (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronLeft className="w-4 h-4 text-gray-500" />
                )}
              </button>
            )}

            {/* Full Sidebar Content */}
            <div
              className={`p-4 transition-opacity duration-200 ${
                showFullSidebar ? 'opacity-100' : 'opacity-0 pointer-events-none absolute'
              }`}
            >
              <RightSidebar
                isLoggedIn={isLoggedIn}
                userInfo={userInfo}
                onLogin={onLoginClick}
                onLogout={onLogout}
                onGenerate={handleGenerate}
                isAnalysisPanelOpen={isAnalysisPanelOpen}
              />
            </div>

            {/* Mini Sidebar (collapsed state) */}
            {isCollapsible && !showFullSidebar && (
              <div className="p-2 opacity-100">
                <SidebarMini onGenerate={handleGenerate} isLoggedIn={isLoggedIn} />
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile: Single column with bottom nav */}
      <div className="md:hidden scroll-unfurl">
        <main className="pb-20">
          <Outlet />
        </main>
        <MobileNav isLoggedIn={isLoggedIn} />
      </div>
    </div>
  );
};

export default AppShell;
