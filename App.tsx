import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Loader2, X, LogIn, UserPlus } from 'lucide-react';
import AppShell from './components/layout/AppShell';
import { SidebarProvider } from './contexts/SidebarContext';
import { LifeDestinyResult, UserInput } from './types';

// Lazy load page components
const HomePage = lazy(() => import('./pages/HomePage'));
const KnowledgeHub = lazy(() => import('./pages/KnowledgeHub'));
const KnowledgeArticle = lazy(() => import('./pages/KnowledgeArticle'));
const CasesLibrary = lazy(() => import('./pages/CasesLibrary'));
const CaseDetail = lazy(() => import('./pages/CaseDetail'));
const CelebrityCaseDetail = lazy(() => import('./pages/CelebrityCaseDetail'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const DailyFortunePage = lazy(() => import('./pages/DailyFortunePage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const AdminVoucherPage = lazy(() => import('./pages/AdminVoucherPage'));
const AdminPricingPage = lazy(() => import('./pages/AdminPricingPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

// Loading fallback
const PageLoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
  </div>
);

// Auth Modal Component
const AuthModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: 'login' | 'register';
}> = ({ isOpen, onClose, onSuccess, initialMode = 'register' }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('请填写邮箱和密码');
      return;
    }
    if (password.length < 6) {
      setError('密码至少6位');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.error === 'INVALID_CREDENTIALS') {
            setError('邮箱或密码错误');
          } else {
            setError(data.error || '登录失败');
          }
          return;
        }

        onSuccess();
        onClose();
      } else {
        // Register mode - try login first, then register
        let response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password }),
          });
        }

        const data = await response.json();

        if (!response.ok) {
          if (data.error === 'EMAIL_EXISTS') {
            setError('该邮箱已注册，请检查密码是否正确');
          } else if (data.error === 'INVALID_CREDENTIALS') {
            setError('密码错误');
          } else {
            setError(data.error || '注册失败，请重试');
          }
          return;
        }

        onSuccess();
        onClose();
      }
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="scroll-panel w-full max-w-md mx-4 overflow-hidden animate-fade-in">
        <div className="px-6 py-5 flex items-center justify-between border-b border-[var(--border-ink)] bg-[rgb(18_60_67_/_0.08)]">
          <div className="flex items-center gap-2 text-[var(--color-qingdai)]">
            {mode === 'login' ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            <h3 className="font-bold text-lg">{mode === 'login' ? '登录账号' : '注册/登录'}</h3>
          </div>
          <button onClick={onClose} className="ink-ripple text-[var(--color-ink-muted)] hover:text-[var(--color-cinnabar)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-[var(--color-ink-muted)] text-sm">
            {mode === 'login'
              ? '登录后可以查看历史记录和点数余额'
              : '注册后可以：保存分析结果、查看历史记录、获得更多测算次数'}
          </p>

          <div>
            <label className="block text-sm font-bold text-[var(--color-qingdai)] mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="classical-input w-full px-4 py-2.5 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[var(--color-qingdai)] mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少6位"
              className="classical-input w-full px-4 py-2.5 outline-none"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="ink-ripple classical-button w-full py-3 font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                处理中...
              </>
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                登录
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                注册/登录
              </>
            )}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="ink-ripple text-sm text-[var(--color-cinnabar)] hover:text-[var(--color-cinnabar-dark)]"
            >
              {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<{ email: string; points: number } | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('register');
  const [showUserMenu, setShowUserMenu] = useState(false);

  // History selection state (for LeftNav → HomePage communication)
  const [historyResult, setHistoryResult] = useState<LifeDestinyResult | null>(null);
  const [historyInput, setHistoryInput] = useState<UserInput | null>(null);

  // Analysis panel state (for HomePage → RightSidebar communication)
  const [isAnalysisPanelOpen, setIsAnalysisPanelOpen] = useState(false);

  // History handlers
  const handleHistorySelect = useCallback((result: LifeDestinyResult, input: UserInput) => {
    setHistoryResult(result);
    setHistoryInput(input);
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistoryResult(null);
    setHistoryInput(null);
  }, []);

  const handleNewCalculation = useCallback(() => {
    setHistoryResult(null);
    setHistoryInput(null);
  }, []);

  // Check auth status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            setIsLoggedIn(true);
            setUserInfo({ email: data.user.email, points: data.user.points });
            console.log('User authenticated:', data.user);
          } else {
            setIsLoggedIn(false);
            setUserInfo(null);
            console.log('No user data found');
          }
        } else {
          setIsLoggedIn(false);
          setUserInfo(null);
          console.log('Auth check failed:', response.status);
        }
      } catch (error) {
        setIsLoggedIn(false);
        setUserInfo(null);
        console.error('Auth check error:', error);
      }
    };
    checkAuth();
  }, []);

  // Refresh user info
  const refreshUserInfo = async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          setUserInfo({ email: data.user.email, points: data.user.points });
        }
      }
    } catch {
      // Ignore errors
    }
  };

  // Auth success handler
  const handleAuthSuccess = () => {
    setIsLoggedIn(true);
    setIsGuest(false);
    refreshUserInfo();
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore errors
    }
    setIsLoggedIn(false);
    setUserInfo(null);
    setShowUserMenu(false);
  };

  // Open login modal
  const openLoginModal = () => {
    setAuthModalMode('login');
    setShowAuthModal(true);
  };

  // Open register modal
  const openRegisterModal = () => {
    setAuthModalMode('register');
    setShowAuthModal(true);
  };

  return (
    <BrowserRouter>
      <SidebarProvider>
      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        initialMode={authModalMode}
      />

      <Routes>
        <Route
          path="/admin"
          element={
            <Suspense fallback={<PageLoadingFallback />}>
              <AdminPage />
            </Suspense>
          }
        />
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<PageLoadingFallback />}>
              <AdminPage />
            </Suspense>
          }
        />
        <Route
          element={
            <AppShell
              isLoggedIn={isLoggedIn}
              userInfo={userInfo}
              onLoginClick={openLoginModal}
              onLogout={handleLogout}
              onHistorySelect={handleHistorySelect}
              onNewCalculation={handleNewCalculation}
              isAnalysisPanelOpen={isAnalysisPanelOpen}
            />
          }
        >
          <Route
            path="/"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <HomePage
                  isLoggedIn={isLoggedIn}
                  isGuest={isGuest}
                  setIsGuest={setIsGuest}
                  setIsLoggedIn={setIsLoggedIn}
                  setUserInfo={setUserInfo}
                  openRegisterModal={openRegisterModal}
                  refreshUserInfo={refreshUserInfo}
                  historyResult={historyResult}
                  historyInput={historyInput}
                  onClearHistory={handleClearHistory}
                  onAnalysisPanelChange={setIsAnalysisPanelOpen}
                />
              </Suspense>
            }
          />
          <Route
            path="/knowledge"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <KnowledgeHub />
              </Suspense>
            }
          />
          <Route
            path="/knowledge/:slug"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <KnowledgeArticle />
              </Suspense>
            }
          />
          <Route
            path="/cases"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <CasesLibrary />
              </Suspense>
            }
          />
          <Route
            path="/cases/:id"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <CaseDetail />
              </Suspense>
            }
          />
          <Route
            path="/celebrity-cases/:id"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <CelebrityCaseDetail />
              </Suspense>
            }
          />
          {/* Dashboard Routes */}
          <Route
            path="/dashboard"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <DashboardPage
                  isLoggedIn={isLoggedIn}
                  userInfo={userInfo}
                  onLoginClick={openLoginModal}
                  onLogout={handleLogout}
                  onHistorySelect={handleHistorySelect}
                />
              </Suspense>
            }
          />
          <Route
            path="/dashboard/:tab"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <DashboardPage
                  isLoggedIn={isLoggedIn}
                  userInfo={userInfo}
                  onLoginClick={openLoginModal}
                  onLogout={handleLogout}
                  onHistorySelect={handleHistorySelect}
                />
              </Suspense>
            }
          />
          {/* Fortune Routes */}
          <Route
            path="/fortune/daily"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <DailyFortunePage />
              </Suspense>
            }
          />
          <Route
            path="/fortune/daily/:date"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <DailyFortunePage />
              </Suspense>
            }
          />
          {/* Profile Route */}
          <Route
            path="/profile"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <ProfilePage />
              </Suspense>
            }
          />
          {/* Search Route */}
          <Route
            path="/search"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <SearchPage />
              </Suspense>
            }
          />
        </Route>
      </Routes>
      </SidebarProvider>
    </BrowserRouter>
  );
};

export default App;
