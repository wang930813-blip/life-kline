import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, BookOpen, FolderOpen, Search, User, LayoutDashboard } from 'lucide-react';

interface MobileNavProps {
  isLoggedIn?: boolean;
}

const MobileNav: React.FC<MobileNavProps> = ({ isLoggedIn = false }) => {
  const location = useLocation();
  return (
    <nav className="mobile-bottom-nav md:hidden" aria-label="底部导航">
      <div className="flex items-center justify-around gap-1 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {/* Home */}
        <NavLink
          to="/"
          className={({ isActive }) =>
            `ink-ripple flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all flex-1 ${
              isActive
                ? 'text-[var(--color-cinnabar)] bg-[rgb(168_50_42_/_0.08)]'
                : 'text-[var(--color-ink-muted)]'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Home className={`w-6 h-6 ${isActive ? 'fill-[var(--color-cinnabar)]' : ''}`} />
              <span className={`text-xs ${isActive ? 'font-semibold' : 'font-medium'}`}>
                首页
              </span>
            </>
          )}
        </NavLink>

        {/* Knowledge */}
        <NavLink
          to="/knowledge"
          className={({ isActive }) =>
            `ink-ripple flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all flex-1 ${
              isActive
                ? 'text-[var(--color-cinnabar)] bg-[rgb(168_50_42_/_0.08)]'
                : 'text-[var(--color-ink-muted)]'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <BookOpen className={`w-6 h-6 ${isActive ? 'fill-[var(--color-cinnabar)]' : ''}`} />
              <span className={`text-xs ${isActive ? 'font-semibold' : 'font-medium'}`}>
                知识
              </span>
            </>
          )}
        </NavLink>

        {/* Cases */}
        <NavLink
          to="/cases"
          className={({ isActive }) =>
            `ink-ripple flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all flex-1 ${
              isActive
                ? 'text-[var(--color-cinnabar)] bg-[rgb(168_50_42_/_0.08)]'
                : 'text-[var(--color-ink-muted)]'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <FolderOpen className={`w-6 h-6 ${isActive ? 'fill-[var(--color-cinnabar)]' : ''}`} />
              <span className={`text-xs ${isActive ? 'font-semibold' : 'font-medium'}`}>
                案例
              </span>
            </>
          )}
        </NavLink>

        {/* Search */}
        <NavLink
          to="/search"
          className={({ isActive }) =>
            `ink-ripple flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all flex-1 ${
              isActive
                ? 'text-[var(--color-cinnabar)] bg-[rgb(168_50_42_/_0.08)]'
                : 'text-[var(--color-ink-muted)]'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Search className={`w-6 h-6 ${isActive ? 'fill-[var(--color-cinnabar)]' : ''}`} />
              <span className={`text-xs ${isActive ? 'font-semibold' : 'font-medium'}`}>
                搜索
              </span>
            </>
          )}
        </NavLink>

        {/* Profile */}
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `ink-ripple flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all flex-1 ${
              isActive
                ? 'text-[var(--color-cinnabar)] bg-[rgb(168_50_42_/_0.08)]'
                : 'text-[var(--color-ink-muted)]'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <User className={`w-6 h-6 ${isActive ? 'fill-[var(--color-cinnabar)]' : ''}`} />
              <span className={`text-xs ${isActive ? 'font-semibold' : 'font-medium'}`}>
                我的
              </span>
            </>
          )}
        </NavLink>

        {/* Dashboard - Only show when logged in */}
        {isLoggedIn && (
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `ink-ripple flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all flex-1 ${
                isActive || location.pathname.startsWith('/dashboard')
                  ? 'text-[var(--color-cinnabar)] bg-[rgb(168_50_42_/_0.08)]'
                  : 'text-[var(--color-ink-muted)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <LayoutDashboard className={`w-6 h-6 ${isActive || location.pathname.startsWith('/dashboard') ? 'fill-[var(--color-cinnabar)]' : ''}`} />
                <span className={`text-xs ${isActive || location.pathname.startsWith('/dashboard') ? 'font-semibold' : 'font-medium'}`}>
                  控制台
                </span>
              </>
            )}
          </NavLink>
        )}
      </div>
    </nav>
  );
};

export default MobileNav;
