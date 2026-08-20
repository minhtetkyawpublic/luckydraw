import './bootstrap';

import axios from 'axios';
import { calculateWheelRotation } from './wheelMath';
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
    BrowserRouter,
    NavLink,
    Navigate,
    Route,
    Routes,
    useLocation,
    useNavigate,
    useParams,
} from 'react-router-dom';

const AppBaseContext = createContext({
    basePath: '',
    apiBase: '/api',
    manifestPath: '/manifest.webmanifest',
    swPath: '/sw.js',
    scope: '/',
});

const AuthContext = createContext({
    api: null,
    me: null,
    loading: true,
    spinStatus: null,
    appSettings: null,
    refreshAppSettings: async () => {},
    refreshMe: async () => {},
    refreshSpinStatus: async () => {},
    toasts: [],
    pushToast: () => {},
    login: async () => {},
    logout: async () => {},
});

function resolveClientBase() {
    const pathname = new URL(import.meta.url).pathname;
    const marker = '/build/assets/';
    const idx = pathname.indexOf(marker);
    const basePath = idx >= 0 ? pathname.slice(0, idx) : '';
    const cleanBase = basePath.replace(/\/+$/, '');
    return {
        basePath: cleanBase,
        apiBase: `${cleanBase}/api`,
        manifestPath: `${cleanBase}/manifest.webmanifest`,
        swPath: `${cleanBase}/sw.js`,
        scope: cleanBase === '' ? '/' : `${cleanBase}/`,
    };
}
function formatTimeRemaining(totalSeconds) {
    const seconds = Math.max(0, Number(totalSeconds) || 0);
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    if (minutes <= 0) {
        return `${remainder}s`;
    }
    return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
}
function AppIcon({ name, size = 24, strokeWidth = 2.2 }) {
    const paths = {
        home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v10h5v-6h3v6h5V10" /></>,
        bag: <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 9V7a3 3 0 0 1 6 0v2" /></>,
        user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
        bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" /><path d="M10 20h4" /></>,
        lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
        eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
        coin: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5.5" /><path d="M14.5 9.5c-.6-.6-1.4-.9-2.5-.9-1.4 0-2.5.7-2.5 1.8 0 2.9 5.2 1.3 5.2 3.9 0 1.1-1.1 1.9-2.7 1.9-1.1 0-2.1-.4-2.8-1.1M12 7v10" /></>,
        history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
        wheel: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2" /><path d="m12 3 1.5 7.2M20.6 9l-6.8 2.4M17.3 19l-4.2-5.5M6.7 19l4.2-5.5M3.4 9l6.8 2.4" /></>,
        settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
        arrow: <><path d="m9 18 6-6-6-6" /></>,
        logout: <><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" /></>,
        sound: <><path d="M5 10H2v4h3l4 3V7l-4 3Z" /><path d="M13 9a4 4 0 0 1 0 6M16 6a8 8 0 0 1 0 12" /></>,
    };

    return (
        <svg
            aria-hidden="true"
            className="app-icon"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {paths[name] || paths.home}
        </svg>
    );
}
function formatPoints(value) {
    return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

function humanizeTransactionType(type) {
    const labels = {
        daily_bonus: 'Daily bonus',
        free_spin_reward: 'Free spin reward',
        paid_spin_reward: 'Paid spin reward',
        spin_spend: 'Paid spin cost',
        admin_adjustment: 'Points adjustment',
    };

    return labels[type] || String(type || 'Transaction').replaceAll('_', ' ');
}

const DEFAULT_APP_SETTINGS = {
    play_bet_url: 'https://m.bet555mix.com',
    play_bet_label: 'ဘောလုံးမောင်း ဘော်ဒီ၊ ဂိုးပေါင်း ကစားရန်',
    contact_phone: '09441884527',
    contact_phone_numbers: '09441884527\n09441884528\n09441884529',
    telegram_contact_url: 'tg://resolve?phone=959441884527',
    viber_contact_url: 'viber://chat?number=%2B959441884527',
    telegram_channel_url: '',
    facebook_page_url: '',
    tiktok_channel_url: '',
    about_content: 'Lucky Draw is a points-only spin wheel app.',
    buy_points_instructions: 'To buy points, contact the administrator outside this app.\nSend your username or phone number, complete payment with the admin, and your wallet points will be added manually.',
    daily_bonus_points: 20,
    home_ticker_text: 'Welcome to Lucky Draw • One free spin every day • Points-only rewards • Contact admin to exchange or buy points',
    home_board_text: 'One free spin every day\nPoints-only wheel rewards\nPaid spins use wallet points\nDaily bonus available once\nAll activity is recorded\nContact admin for points',
};

function safeExternalUrl(value) {
    const url = String(value || '').trim();
    return /^(https?:\/\/|tg:\/\/|viber:\/\/)/i.test(url) ? url : '';
}

function splitSettingLines(value) {
    return String(value || '')
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function UserHeader({ onNotify }) {
    return (
        <header className="user-header">
            <div className="brand-lockup">
                <img src="logotransparent.png" alt="Lucky Draw" />
                <div>
                    <strong>Lucky Draw</strong>
                    <span>Play • Collect • Enjoy</span>
                </div>
            </div>
            <button className="icon-button" type="button" aria-label="Notifications" onClick={onNotify}>
                <AppIcon name="bell" size={23} />
            </button>
        </header>
    );
}

function BalancePill({ balance = 0 }) {
    return (
        <div className="balance-pill">
            <AppIcon name="coin" size={22} />
            <strong>{formatPoints(balance)}</strong>
            <span>points</span>
        </div>
    );
}

function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

function resolveSpinBlockMessage(payload, actionType = 'paid') {
    const code = payload?.error_code || '';
    if (code === 'COOLDOWN_ACTIVE') {
        return {
            type: 'warn',
            text: `Paid spin is cooling down. Wait ${formatTimeRemaining(payload.paid_spin_cooldown_remaining_seconds || 0)}.`,
        };
    }

    if (code === 'INSUFFICIENT_BALANCE') {
        const required = payload.required_points ?? 0;
        const balance = payload.balance ?? 0;
        return {
            type: 'err',
            text: `Insufficient points. Need ${required} but current balance is ${balance}.`,
        };
    }

    if (code === 'FREE_SPIN_ALREADY_USED') {
        return {
            type: 'warn',
            text: 'Free spin already used for today. It will reset after midnight.',
            actionHint:
                actionType === 'free'
                    ? 'Please try again after midnight or use a paid spin now.'
                    : 'Try daily bonus or a paid spin.',
        };
    }

    if (code === 'NO_ACTIVE_CONFIGURATION' || code === 'NO_ACTIVE_SEGMENTS') {
        return {
            type: 'warn',
            text: 'No active spin configuration is available right now. Please contact admin.',
        };
    }

    return {
        type: 'err',
        text: payload?.message || 'Spin blocked.',
    };
}

function TransactionDetailSheet({ record, onClose }) {
    if (!record) {
        return null;
    }

    const title = record.transaction_type
        ? `${record.transaction_type} #${record.id}`
        : `Record #${record.id}`;
    const lines = [
        ['id', record.id],
        ['type', record.type || record.transaction_type],
        ['amount', record.amount],
        ['balance_after', record.balance_after],
        ['reference_type', record.reference_type || 'n/a'],
        ['reference_id', record.reference_id || 'n/a'],
        ['points_spent', record.points_spent],
        ['points_awarded', record.points_awarded],
        ['segment', record.spin_segment_label || 'n/a'],
        ['segment_id', record.spin_segment_id || 'n/a'],
        ['free_spin', record.is_free_spin ? 'yes' : 'no'],
        ['created_at', record.created_at],
        ['notes', record.notes || ''],
    ];

    return (
        <div className="detail-overlay" role="dialog" aria-modal="true">
            <div className="detail-sheet">
                <div className="detail-header">
                    <strong>{title}</strong>
                    <button className="btn secondary" type="button" onClick={onClose}>
                        Close
                    </button>
                </div>
                <div className="detail-body">
                    {lines.map(([label, value]) => (
                        <p key={label}>
                            <strong>{label}:</strong> {String(value)}
                        </p>
                    ))}
                    <details className="detail-json">
                        <summary>Raw payload</summary>
                        <pre>{JSON.stringify(record, null, 2)}</pre>
                    </details>
                </div>
            </div>
        </div>
    );
}

function normalizeEmailOrPhone(value) {
    return String(value || '').trim();
}

function toDateTimeLocalInput(value) {
    if (!value) {
        return '';
    }

    const normalized = String(value).trim().replace(' ', 'T');
    if (!normalized) {
        return '';
    }

    return normalized.replace('Z', '').slice(0, 16);
}

function SpinnerCard({ title, children }) {
    return (
        <section className="card">
            <h1 className="title">{title}</h1>
            {children}
        </section>
    );
}

function AdminModal({ open, title, subtitle, onClose, children, wide = false }) {
    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="admin-modal-overlay" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
        }}>
            <section className={`admin-modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
                <header>
                    <span><strong>{title}</strong>{subtitle ? <small>{subtitle}</small> : null}</span>
                    <button type="button" onClick={onClose} aria-label="Close dialog">×</button>
                </header>
                <div className="admin-modal-body">{children}</div>
            </section>
        </div>
    );
}

function Toast({ toasts }) {
    return (
        <div className="toast-wrap">
            {toasts.map((toast) => (
                <div key={toast.id} className={`toast ${toast.type}`}>
                    {toast.message}
                </div>
            ))}
        </div>
    );
}

class AppErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('Lucky Draw screen error', error, info);
    }

    render() {
        if (!this.state.error) {
            return this.props.children;
        }

        return (
            <main className="app-shell">
                <SpinnerCard title="Something went wrong">
                    <p className="message err">
                        This screen could not be displayed. Reload the app and try again.
                    </p>
                    {import.meta.env.DEV ? (
                        <pre className="error-details spacer">{this.state.error.message}</pre>
                    ) : null}
                    <button className="btn primary spacer" type="button" onClick={() => window.location.reload()}>
                        Reload App
                    </button>
                </SpinnerCard>
            </main>
        );
    }
}

function ProtectedRoute({ user, roles, loginPath = '/login', children }) {
    if (!user) {
        return <Navigate to={loginPath} replace />;
    }
    if (roles && roles.length > 0 && !roles.includes(user.role)) {
        return <Navigate to={loginPath} replace />;
    }
    return children;
}

function landingPathFor(user) {
    return user?.role === 'admin' ? '/admin' : '/dashboard';
}

function AdminLayout({ children }) {
    const { logout, pushToast } = useContext(AuthContext);
    const { basePath } = useContext(AppBaseContext);
    const navigate = useNavigate();
    const [signingOut, setSigningOut] = useState(false);

    const signOut = async () => {
        setSigningOut(true);
        try {
            await logout();
            navigate('/admin/login', { replace: true });
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Could not log out', 'err');
            setSigningOut(false);
        }
    };

    return (
        <div className="admin-shell">
            <header className="admin-mobile-header">
                <NavLink className="admin-brand" to="/admin">
                    <img src={`${basePath}/logotransparent.png`} alt="Lucky Draw" />
                    <span><strong>Lucky Draw</strong><small>Admin</small></span>
                </NavLink>
                <button className="admin-header-logout" type="button" onClick={signOut} disabled={signingOut}>
                    {signingOut ? 'Wait…' : 'Logout'}
                </button>
            </header>
            <div className="admin-page-slot">{children}</div>
        </div>
    );
}

function AdminRoute({ user, children }) {
    return (
        <ProtectedRoute user={user} roles={['admin']} loginPath="/admin/login">
            <AdminLayout>{children}</AdminLayout>
        </ProtectedRoute>
    );
}

function AppShell() {
    const { basePath, apiBase } = useContext(AppBaseContext);
    const [me, setMe] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toasts, setToasts] = useState([]);
    const [spinStatus, setSpinStatus] = useState(null);
    const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS);
    const [spinStatusLoading, setSpinStatusLoading] = useState(false);

    const api = useMemo(() => {
        const client = axios.create({
            baseURL: apiBase,
            withCredentials: true,
        });
        client.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
        return client;
    }, [apiBase]);

    const pushToast = useCallback((message, type = 'ok') => {
        const id = `${Date.now()}_${Math.random()}`;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((item) => item.id !== id));
        }, 3800);
    }, []);

    const refreshMe = useCallback(async () => {
        const response = await api.get('/auth/me');
        setMe(response.data.user);
        return response.data.user;
    }, [api]);

    const refreshSpinStatus = useCallback(async () => {
        setSpinStatusLoading(true);
        try {
            const response = await api.get('/spins/status');
            setSpinStatus(response.data.status);
            return response.data.status;
        } finally {
            setSpinStatusLoading(false);
        }
    }, [api]);

    const refreshAppSettings = useCallback(async () => {
        const response = await api.get('/app-settings');
        const settings = { ...DEFAULT_APP_SETTINGS, ...(response.data.settings || {}) };
        setAppSettings(settings);
        return settings;
    }, [api]);

    useEffect(() => {
        const initialize = async () => {
            await refreshAppSettings().catch(() => {});
            try {
                const currentUser = await refreshMe();
                if (currentUser.role === 'user') {
                    await refreshSpinStatus().catch(() => setSpinStatus(null));
                } else {
                    setSpinStatus(null);
                }
            } catch {
                setMe(null);
                setSpinStatus(null);
            } finally {
                setLoading(false);
            }
        };

        initialize();
    }, [api, refreshAppSettings, refreshMe, refreshSpinStatus]);

    const login = async ({ emailOrPhone, password, rememberMe, portalRole = 'user' }) => {
        await axios.get(`${basePath}/sanctum/csrf-cookie`, {
            withCredentials: true,
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
            },
        });
        const endpoint = portalRole === 'admin' ? '/auth/admin/login' : '/auth/login';
        const response = await api.post(endpoint, {
            email_or_phone: normalizeEmailOrPhone(emailOrPhone),
            password,
            remember_me: rememberMe,
        });
        setMe(response.data.user);
        const refreshes = [refreshAppSettings()];
        if (response.data.user.role === 'user') refreshes.push(refreshSpinStatus());
        await Promise.all(refreshes);
        return response.data;
    };

    const logout = async () => {
        await api.post('/auth/logout');
        setMe(null);
        setSpinStatus(null);
    };

    return (
        <AuthContext.Provider
            value={{
                api,
                me,
                loading,
                spinStatus,
                spinStatusLoading,
                appSettings,
                refreshAppSettings,
                refreshMe,
                refreshSpinStatus,
                toasts,
                pushToast,
                login,
                logout,
            }}
        >
            {loading ? (
                <div className="app-shell">
                    <p>Loading…</p>
                </div>
            ) : (
                <>
                    <Toast toasts={toasts} />
                    <Routes>
                        <Route path="/" element={me ? <Navigate to={landingPathFor(me)} replace /> : <LoginScreen portalRole="user" />} />
                        <Route path="/login" element={me?.role === 'user' ? <Navigate to="/dashboard" replace /> : <LoginScreen portalRole="user" switchingAccount={!!me} />} />
                        <Route path="/admin/login" element={me?.role === 'admin' ? <Navigate to="/admin" replace /> : <LoginScreen portalRole="admin" switchingAccount={!!me} />} />
                        <Route
                            path="/dashboard"
                            element={
                                <ProtectedRoute user={me} roles={['user']}>
                                    <DashboardScreen />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/buy-points"
                            element={
                                <ProtectedRoute user={me} roles={['user']}>
                                    <BuyPointsScreen />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/settings"
                            element={
                                <ProtectedRoute user={me} roles={['user']}>
                                    <SettingsScreen />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/daily-bonus"
                            element={
                                <ProtectedRoute user={me} roles={['user']}>
                                    <DailyBonusScreen />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/spin"
                            element={
                                <ProtectedRoute user={me} roles={['user']}>
                                    <SpinScreen />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/history"
                            element={
                                <ProtectedRoute user={me} roles={['user']}>
                                    <HistoryScreen />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin"
                            element={
                                <AdminRoute user={me}>
                                    <AdminDashboardScreen />
                                </AdminRoute>
                            }
                        />
                        <Route
                            path="/admin/users"
                            element={
                                <AdminRoute user={me}>
                                    <AdminUsersScreen />
                                </AdminRoute>
                            }
                        />
                        <Route
                            path="/admin/users/:userId"
                            element={
                                <AdminRoute user={me}>
                                    <AdminUserRecordsScreen />
                                </AdminRoute>
                            }
                        />
                        <Route
                            path="/admin/spin-config"
                            element={
                                <AdminRoute user={me}>
                                    <AdminSpinConfigScreen />
                                </AdminRoute>
                            }
                        />
                        <Route
                            path="/admin/app-settings"
                            element={
                                <AdminRoute user={me}>
                                    <AdminApplicationSettingsScreen />
                                </AdminRoute>
                            }
                        />
                        <Route
                            path="/admin/settings"
                            element={
                                <AdminRoute user={me}>
                                    <AdminSettingsScreen />
                                </AdminRoute>
                            }
                        />
                    </Routes>
                    <BottomNav />
                </>
            )}
        </AuthContext.Provider>
    );
}

function BottomNav() {
    const { me } = useContext(AuthContext);
    const location = useLocation();
    if (!me || location.pathname === '/login' || location.pathname === '/admin/login') {
        return null;
    }
    if (me.role === 'admin') {
        return (
            <nav className="bottom-nav" aria-label="Admin navigation">
                <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'active' : '')}>
                    <AppIcon name="home" size={25} />
                    <span>Overview</span>
                </NavLink>
                <NavLink to="/admin/users" className={({ isActive }) => (isActive ? 'active' : '')}>
                    <AppIcon name="user" size={25} />
                    <span>Users</span>
                </NavLink>
                <NavLink to="/admin/spin-config" className={({ isActive }) => (isActive ? 'active' : '')}>
                    <AppIcon name="wheel" size={25} />
                    <span>Wheel</span>
                </NavLink>
                <NavLink to="/admin/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
                    <AppIcon name="settings" size={25} />
                    <span>Settings</span>
                </NavLink>
            </nav>
        );
    }
    return (
        <nav className="bottom-nav" aria-label="Main navigation">
            <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
                <AppIcon name="home" size={25} />
                <span>Home</span>
            </NavLink>
            <NavLink to="/spin" className={({ isActive }) => (isActive ? 'active' : '')}>
                <AppIcon name="wheel" size={25} />
                <span>Play</span>
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
                <AppIcon name="user" size={25} />
                <span>Settings</span>
            </NavLink>
        </nav>
    );
}

function LoginScreen({ portalRole = 'user', switchingAccount = false }) {
    const { login, pushToast, appSettings } = useContext(AuthContext);
    const { basePath } = useContext(AppBaseContext);
    const navigate = useNavigate();
    const isAdminPortal = portalRole === 'admin';
    const [form, setForm] = useState({
        emailOrPhone: '',
        password: '',
        rememberMe: true,
    });
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const openSocial = (url, label) => {
        const safeUrl = safeExternalUrl(url);
        if (!safeUrl) {
            pushToast(`${label} link is not configured yet.`, 'warn');
            return;
        }
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const auth = await login({ ...form, portalRole });
            pushToast('Welcome back! Login successful', 'ok');
            navigate(landingPathFor(auth.user), { replace: true });
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Login failed', 'err');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className={`login-page ${isAdminPortal ? 'admin-login-page' : ''}`}>
            <section className="login-brand">
                <img src={`${basePath}/logotransparent.png`} alt="Lucky Draw logo" />
                <h1>{isAdminPortal ? 'Lucky Draw Administrator' : 'Welcome to Lucky Draw'}</h1>
                <p>{isAdminPortal ? 'Manage users, points, wheel and app content.' : 'Sign in to collect points and spin.'}</p>
            </section>
            <section className="login-panel">
                <div className="login-panel-inner">
                    <p className="login-kicker">{isAdminPortal ? 'Administrator access' : 'Member access'}</p>
                    <h2>{isAdminPortal ? 'Admin Login' : 'User Login'}</h2>
                    {switchingAccount ? <p className="portal-session-note">Sign in below to switch from the currently active account.</p> : null}
                    <form className="login-form" onSubmit={onSubmit}>
                        <label className="login-input-wrap">
                            <AppIcon name="user" size={24} />
                            <span className="sr-only">Email or phone</span>
                            <input
                                value={form.emailOrPhone}
                                onChange={(event) =>
                                    setForm((prev) => ({ ...prev, emailOrPhone: event.target.value }))
                                }
                                placeholder="Email or phone"
                                autoComplete="username"
                                required
                            />
                        </label>
                        <label className="login-input-wrap">
                            <AppIcon name="lock" size={24} />
                            <span className="sr-only">Password</span>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={form.password}
                                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                                placeholder="Password"
                                autoComplete="current-password"
                                required
                            />
                            <button
                                className="input-action"
                                type="button"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                onClick={() => setShowPassword((value) => !value)}
                            >
                                <AppIcon name="eye" size={21} />
                            </button>
                        </label>
                        <label className="remember-row">
                            <input
                                type="checkbox"
                                checked={form.rememberMe}
                                onChange={(event) => setForm((prev) => ({ ...prev, rememberMe: event.target.checked }))}
                            />
                            <span>Remember me</span>
                        </label>
                        <button className="login-button" type="submit" disabled={submitting}>
                            {submitting ? 'Signing in…' : (isAdminPortal ? 'Admin Login' : 'User Login')}
                        </button>
                    </form>
                    <NavLink className="portal-switch-link" to={isAdminPortal ? '/login' : '/admin/login'}>
                        {isAdminPortal ? 'Go to user login' : 'Administrator login'}
                    </NavLink>
                    <div className="login-follow">
                        <span />
                        <p>follow for more</p>
                        <span />
                    </div>
                    <div className="social-row" aria-label="Social links">
                        <button type="button" aria-label="Facebook" onClick={() => openSocial(appSettings?.facebook_page_url, 'Facebook')}>f</button>
                        <button type="button" aria-label="Telegram" onClick={() => openSocial(appSettings?.telegram_channel_url, 'Telegram')}>✈</button>
                        <button type="button" aria-label="TikTok" onClick={() => openSocial(appSettings?.tiktok_channel_url, 'TikTok')}>♪</button>
                    </div>
                    <p className="login-footnote">Accounts are provided by the administrator.</p>
                </div>
            </section>
        </main>
    );
}

function useSpinStatus() {
    const { spinStatus, spinStatusLoading, refreshSpinStatus, pushToast } = useContext(AuthContext);
    return { spinStatus, spinStatusLoading, refreshSpinStatus, pushToast };
}

function DashboardScreen() {
    const { api, appSettings } = useContext(AuthContext);
    const { spinStatus, pushToast } = useSpinStatus();
    const [wallet, setWallet] = useState(null);
    const [me, setMe] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [walletData, meData] = await Promise.all([
                    api.get('/wallet'),
                    api.get('/auth/me'),
                ]);
                setWallet(walletData.data.wallet);
                setMe(meData.data.user);
            } catch (error) {
                pushToast(error?.response?.data?.message || 'Failed to load dashboard', 'err');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [api, pushToast]);

    const openExternal = (url, label) => {
        const safeUrl = safeExternalUrl(url);
        if (!safeUrl) {
            pushToast(`${label} link is not configured yet.`, 'warn');
            return;
        }
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
    };

    const announcement = String(appSettings?.home_ticker_text || DEFAULT_APP_SETTINGS.home_ticker_text);
    const boardItems = splitSettingLines(appSettings?.home_board_text || DEFAULT_APP_SETTINGS.home_board_text);
    const phoneNumbers = splitSettingLines(
        appSettings?.contact_phone_numbers
            || appSettings?.contact_phone
            || DEFAULT_APP_SETTINGS.contact_phone_numbers,
    );
    const currentBalance = wallet?.balance ?? spinStatus?.wallet_balance ?? 0;

    return (
        <main className="app-shell user-page home-page">
            <UserHeader onNotify={() => pushToast('You have no new notifications', 'ok')} />

            <section className="announcement-board">
                <img src="logotransparent.png" alt="" aria-hidden="true" />
                <div className="announcement-grid">
                    {boardItems.map((item, index) => (
                        <div key={`${index}-${item}`}><span>◆</span>{item}</div>
                    ))}
                </div>
            </section>

            <div className="announcement-ticker" aria-label={announcement}>
                <div className="ticker-track">
                    <span>{announcement}</span>
                    <span aria-hidden="true">{announcement}</span>
                </div>
            </div>

            <section className="account-points-card">
                <div>
                    <span>Current points</span>
                    <strong>{formatPoints(currentBalance)} points</strong>
                </div>
                <div>
                    <span>Account</span>
                    <strong>{me?.name || me?.email || 'Lucky Draw player'}</strong>
                    <small>{spinStatus?.can_free_spin_today ? 'Free spin ready today' : 'Free spin used today'}</small>
                </div>
            </section>

            <section className="play-bet-card">
                <div className="play-bet-copy">
                    <span>Outside website</span>
                    <strong>{appSettings?.play_bet_label || DEFAULT_APP_SETTINGS.play_bet_label}</strong>
                    <p>Open the partner website to continue.</p>
                </div>
                <button type="button" onClick={() => openExternal(appSettings?.play_bet_url, 'Play Bet')}>
                    Play <AppIcon name="arrow" size={19} />
                </button>
            </section>

            <section className="exchange-card">
                <div className="exchange-heading">
                    <div>
                        <span>Contact administrator</span>
                        <h2>Exchange points</h2>
                    </div>
                    <AppIcon name="coin" size={28} />
                </div>
                <div className="exchange-actions">
                    <button type="button" onClick={() => openExternal(appSettings?.telegram_contact_url, 'Telegram')}>
                        <span>✈</span> Telegram
                    </button>
                    <button type="button" onClick={() => openExternal(appSettings?.viber_contact_url, 'Viber')}>
                        <span>☎</span> Viber
                    </button>
                </div>
                <div className="contact-phone-list" aria-label="Contact phone numbers">
                    <span>Phone numbers</span>
                    {phoneNumbers.map((phone, index) => (
                        <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} key={`${index}-${phone}`}>{phone}</a>
                    ))}
                </div>
            </section>
            {loading ? <p className="page-loading">Loading your account…</p> : null}
        </main>
    );
}

function BuyPointsScreen() {
    const { spinStatus, appSettings, pushToast } = useContext(AuthContext);
    const navigate = useNavigate();
    const balance = spinStatus?.wallet_balance || 0;
    const instructionLines = splitSettingLines(appSettings?.buy_points_instructions || DEFAULT_APP_SETTINGS.buy_points_instructions);
    const socialLinks = [
        ['telegram_contact_url', 'Telegram', '✈'],
        ['viber_contact_url', 'Viber', '☎'],
        ['facebook_page_url', 'Facebook', 'f'],
        ['tiktok_channel_url', 'TikTok', '♪'],
    ].map(([key, label, icon]) => ({ label, icon, url: appSettings?.[key] })).filter((item) => item.url);

    const openLink = (url, label) => {
        const safeUrl = safeExternalUrl(url);
        if (!safeUrl) {
            pushToast(`${label} link is not configured yet.`, 'warn');
            return;
        }
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <main className="app-shell user-page buy-page">
            <UserHeader onNotify={() => pushToast('You have no new notifications', 'ok')} />
            <div className="section-heading-row">
                <div>
                    <span>Point store</span>
                    <h1>Buy points</h1>
                </div>
                <BalancePill balance={balance} />
            </div>

            <section className="buy-info-card">
                <AppIcon name="bag" size={24} />
                <div>
                    <strong>How to buy points</strong>
                    <div className="buy-instructions">
                        {instructionLines.length ? instructionLines.map((line, index) => (
                            <p key={`${index}-${line}`}>{line}</p>
                        )) : <p>Contact the administrator outside this app to buy points.</p>}
                    </div>
                </div>
            </section>

            <section className="buy-social-card">
                <strong>Contact admin</strong>
                <div className="buy-social-links">
                    {socialLinks.length ? socialLinks.map((item) => (
                        <button type="button" key={item.label} onClick={() => openLink(item.url, item.label)}>
                            <span>{item.icon}</span>{item.label}
                        </button>
                    )) : <p>Admin contact links are not configured yet.</p>}
                </div>
            </section>

            <button className="back-pill" type="button" onClick={() => navigate('/dashboard')}>Back to home</button>
        </main>
    );
}

function SettingsScreen() {
    const { me, spinStatus, appSettings, logout, pushToast } = useContext(AuthContext);
    const navigate = useNavigate();
    const [signingOut, setSigningOut] = useState(false);
    const [aboutOpen, setAboutOpen] = useState(false);

    const openConfiguredLink = (url, label) => {
        const safeUrl = safeExternalUrl(url);
        if (!safeUrl) {
            pushToast(`${label} link is not configured yet.`, 'warn');
            return;
        }
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
    };

    const signOut = async () => {
        setSigningOut(true);
        try {
            await logout();
            navigate('/login', { replace: true });
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Could not log out', 'err');
            setSigningOut(false);
        }
    };

    const menuItems = [
        { label: 'Spin wheel', icon: 'wheel', action: () => navigate('/spin') },
        { label: 'Daily bonus', icon: 'coin', action: () => navigate('/daily-bonus') },
        { label: 'Transaction history', icon: 'history', action: () => navigate('/history') },
    ];

    return (
        <main className="app-shell user-page settings-page">
            <UserHeader onNotify={() => pushToast('You have no new notifications', 'ok')} />

            <section className="profile-card">
                <div className="profile-avatar"><img src="logo.png" alt="" /></div>
                <div className="profile-details">
                    <span>Your account</span>
                    <strong>{me?.name || 'Lucky Draw player'}</strong>
                    <p>{me?.email || me?.phone || 'Member account'}</p>
                    <div><AppIcon name="coin" size={20} /> {formatPoints(spinStatus?.wallet_balance || 0)} points</div>
                </div>
            </section>

            <section className="settings-card">
                <p className="settings-label">Account & gameplay</p>
                {menuItems.map((item) => (
                    <button className="settings-row" type="button" onClick={item.action} key={item.label}>
                        <span className="settings-row-icon"><AppIcon name={item.icon} size={21} /></span>
                        <strong>{item.label}</strong>
                        <AppIcon name="arrow" size={20} />
                    </button>
                ))}
            </section>

            <section className="settings-card">
                <p className="settings-label">Connect</p>
                <button className="settings-row" type="button" onClick={() => openConfiguredLink(appSettings?.telegram_channel_url, 'Telegram channel')}>
                    <strong>Telegram channel</strong><AppIcon name="arrow" size={20} />
                </button>
                <button className="settings-row" type="button" onClick={() => openConfiguredLink(appSettings?.facebook_page_url, 'Facebook page')}>
                    <strong>Facebook page</strong><AppIcon name="arrow" size={20} />
                </button>
                <button className="settings-row" type="button" onClick={() => openConfiguredLink(appSettings?.tiktok_channel_url, 'TikTok channel')}>
                    <strong>TikTok channel</strong><AppIcon name="arrow" size={20} />
                </button>
                <button className="settings-row" type="button" onClick={() => setAboutOpen(true)}>
                    <strong>About this app</strong><AppIcon name="arrow" size={20} />
                </button>
                <button className="settings-row logout-row" type="button" onClick={signOut} disabled={signingOut}>
                    <span className="settings-row-icon"><AppIcon name="logout" size={21} /></span>
                    <strong>{signingOut ? 'Logging out…' : 'Logout'}</strong>
                </button>
            </section>

            <p className="app-version">Lucky Draw PWA · version 1.0</p>
            {aboutOpen ? (
                <div className="detail-overlay centered-overlay" role="dialog" aria-modal="true" aria-label="About this app">
                    <section className="info-modal">
                        <img src="logo.png" alt="" />
                        <h2>About this app</h2>
                        <p>{appSettings?.about_content || DEFAULT_APP_SETTINGS.about_content}</p>
                        <button className="btn primary" type="button" onClick={() => setAboutOpen(false)}>Close</button>
                    </section>
                </div>
            ) : null}
        </main>
    );
}

function DailyBonusScreen() {
    const { api, pushToast } = useContext(AuthContext);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    const claim = async () => {
        setBusy(true);
        setMessage('');
        try {
            const response = await api.post('/points/claim-daily');
            setMessage(response.data.message);
            pushToast('Daily bonus claimed', 'ok');
        } catch (error) {
            const msg = error?.response?.data?.message || 'Claim not available';
            setMessage(msg);
            pushToast(msg, 'warn');
        } finally {
            setBusy(false);
        }
    };

    return (
        <main className="app-shell user-page sub-page">
            <UserHeader onNotify={() => pushToast('You have no new notifications', 'ok')} />
            <SpinnerCard title="Daily Bonus">
                <p className="subtitle">One free claim each day.</p>
                <div className="spacer">
                    <button className="btn primary" onClick={claim} disabled={busy}>
                        {busy ? 'Claiming…' : 'Claim Now'}
                    </button>
                </div>
                {message ? <p className="message ok spacer">{message}</p> : null}
            </SpinnerCard>
        </main>
    );
}

function SpinWheel({ size, segments, rotation, transitionMs = 2200, centerLabel = 'LUCKY', centerActionLabel, centerActionSubLabel, onCenterAction, centerDisabled = false }) {
    const segmentCount = segments.length || 1;
    const segmentAngle = 360 / segmentCount;
    const palette = ['#ffca28', '#ff7a00', '#7c3aed', '#ec4899', '#22c55e', '#0ea5e9'];
    const gradient = segments.length
        ? `conic-gradient(${segments.map((segment, index) => {
            const start = index * segmentAngle;
            const end = (index + 1) * segmentAngle;
            return `${segment.color || palette[index % palette.length]} ${start}deg ${end}deg`;
        }).join(', ')})`
        : 'conic-gradient(#ffca28 0deg 90deg, #ff7a00 90deg 180deg, #7c3aed 180deg 270deg, #22c55e 270deg 360deg)';
    const displaySegments = segments.length ? segments : [
        { id: 'one', label: '5 pts' },
        { id: 'two', label: '10 pts' },
        { id: 'three', label: '20 pts' },
        { id: 'four', label: '50 pts' },
    ];
    const labelAngle = 360 / displaySegments.length;

    return (
        <div className="spin-wheel-shell">
            <div className="spin-wheel-pointer">▼</div>
            <div
                className="spin-wheel"
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    transform: `rotate(${rotation}deg)`,
                    transition: `transform ${transitionMs}ms cubic-bezier(0.12, 0.72, 0.1, 1)`,
                    background: gradient,
                }}
            >
                <div className="spin-wheel-ring">
                    {displaySegments.map((segment, index) => (
                        <span
                            className="wheel-label"
                            key={segment.id || segment.label}
                            style={{
                                transform: `translate(-50%, -50%) rotate(${index * labelAngle + labelAngle / 2}deg) translateY(-${Math.round(size * 0.34)}px) rotate(${-index * labelAngle - labelAngle / 2}deg)`,
                                color: segment.text_color || '#ffffff',
                            }}
                        >
                            <b>{segment.label}</b>
                            <small>{formatPoints(segment.points_reward ?? 0)} pts</small>
                        </span>
                    ))}
                </div>
            </div>
            <button className="wheel-center" type="button" onClick={onCenterAction} disabled={centerDisabled}>
                <AppIcon name="coin" size={22} />
                <span>{centerActionLabel || centerLabel}</span>
                {centerActionSubLabel ? <small>{centerActionSubLabel}</small> : null}
            </button>
        </div>
    );
}

function SpinScreen() {
    const { api, spinStatus, refreshSpinStatus, pushToast } = useContext(AuthContext);
    const navigate = useNavigate();
    const [result, setResult] = useState({ text: '', type: 'ok' });
    const [winModal, setWinModal] = useState(null);
    const [busy, setBusy] = useState(false);
    const [spinning, setSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [transitionMs, setTransitionMs] = useState(2600);
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    const [localStatus, setLocalStatus] = useState(spinStatus);
    const [spinRequestKey, setSpinRequestKey] = useState('');
    const [claimBusy, setClaimBusy] = useState(false);
    const [claimMessage, setClaimMessage] = useState('');
    const intervalRef = useRef(null);
    const spinResultTimeoutRef = useRef(null);

    useEffect(() => {
        setLocalStatus(spinStatus);
        setCooldownRemaining(spinStatus?.paid_spin_cooldown_remaining_seconds || 0);
    }, [spinStatus]);

    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        if ((localStatus?.paid_spin_cooldown_remaining_seconds || 0) <= 0) {
            return undefined;
        }
        intervalRef.current = setInterval(() => {
            setCooldownRemaining((current) => {
                if (current <= 1) {
                    clearInterval(intervalRef.current);
                    refreshSpinStatus();
                    return 0;
                }
                return current - 1;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [localStatus?.paid_spin_cooldown_remaining_seconds, refreshSpinStatus]);

    const segments = localStatus?.segments || [];

    const runSpin = async (type) => {
        if (busy) {
            return;
        }
        const requestKey = spinRequestKey || window.crypto?.randomUUID?.() || `spin-${Date.now()}-${Math.random()}`;
        setBusy(true);
        setSpinning(false);
        setResult({ text: '', type: 'ok' });
        setSpinRequestKey(requestKey);
        try {
            const response = await api.post(type === 'free' ? '/spins/free' : '/spins', null, {
                headers: {
                    'Idempotency-Key': requestKey,
                },
            });
            const event = response.data.spin;
            const segmentLabel = event.segment;
            const segmentId = event.segment_id;
            const segmentIndexFromOrder =
                typeof event.segment_order === 'number' ? event.segment_order : null;
            const segmentIndex =
                segmentIndexFromOrder !== null
                    ? segmentIndexFromOrder
                    : segments.findIndex((segment) => segment.id === segmentId || segment.label === segmentLabel);
            const safeIndex = segmentIndex >= 0 ? segmentIndex : 0;
            const nextRotation = calculateWheelRotation(rotation, safeIndex, segments.length, 6);
            const segmentText = segmentLabel || (segments[safeIndex]?.label || 'mystery');
            const balanceAfter = event.balance_after ?? response.data.wallet?.balance ?? 0;
            const rewardType = event.is_free_spin ? 'free' : 'paid';
            const nextTransitionMs = 2300 + Math.min(1400, safeIndex * 75);

            setSpinning(true);
            setTransitionMs(nextTransitionMs);
            setRotation(nextRotation);

            if (spinResultTimeoutRef.current) {
                clearTimeout(spinResultTimeoutRef.current);
            }

            spinResultTimeoutRef.current = setTimeout(() => {
                setWinModal({
                    rewardType,
                    points: event.points_awarded,
                    segment: segmentText,
                    balanceAfter,
                });
                setBusy(false);
                setSpinning(false);
                refreshSpinStatus();
                pushToast(`You won ${event.points_awarded} points`, 'ok');
                setSpinRequestKey('');
                if (type === 'free') {
                    setLocalStatus((prev) => (prev ? { ...prev, can_free_spin_today: false } : prev));
                }
                spinResultTimeoutRef.current = null;
            }, nextTransitionMs);
        } catch (error) {
            const response = error?.response;
            const payload = response?.data || {};
            const blocked = resolveSpinBlockMessage(payload, type);
            const message = blocked.text;
            if (payload?.error_code === 'COOLDOWN_ACTIVE' && payload.paid_spin_cooldown_remaining_seconds) {
                setCooldownRemaining(payload.paid_spin_cooldown_remaining_seconds);
            }
            if (payload?.error_code === 'FREE_SPIN_ALREADY_USED') {
                setLocalStatus((prev) => (prev ? { ...prev, can_free_spin_today: false } : prev));
            }

            setResult({
                text: message,
                type: blocked.type,
            });
            pushToast(blocked?.actionHint || message, blocked.type);
            setBusy(false);
            setSpinning(false);
            if (!response) {
                return;
            }
            if (response.status >= 500) {
                return;
            }
            if (payload?.error_code === 'COOLDOWN_ACTIVE' || payload?.error_code === 'FREE_SPIN_ALREADY_USED') {
                return;
            }
            setSpinRequestKey('');
        }
    };

    useEffect(() => {
        return () => {
            if (spinResultTimeoutRef.current) {
                clearTimeout(spinResultTimeoutRef.current);
            }
        };
    }, []);

    const paidSpinCost = Number(localStatus?.config?.cost_points) || 0;
    const walletBalance = Number(localStatus?.wallet_balance) || 0;
    const hasEnoughPaidSpinPoints = walletBalance >= paidSpinCost;
    const centerDisabled = busy || spinning || !localStatus?.config;
    const centerActionLabel = spinning
        ? 'Spinning'
        : localStatus?.can_free_spin_today
          ? 'Free Spin'
          : !hasEnoughPaidSpinPoints
            ? 'Not enough points'
            : 'Paid Spin';
    const centerActionSubLabel = spinning
        ? ''
        : localStatus?.can_free_spin_today
          ? 'Today'
          : !hasEnoughPaidSpinPoints
            ? 'Buy points'
            : `${formatPoints(paidSpinCost)} pts`;

    const handleCenterSpinAction = () => {
        if (busy || spinning) {
            return;
        }
        if (localStatus?.can_free_spin_today) {
            runSpin('free');
            return;
        }
        if (!hasEnoughPaidSpinPoints) {
            navigate('/buy-points');
            return;
        }
        if ((cooldownRemaining || 0) > 0) {
            pushToast(`Please wait ${formatTimeRemaining(cooldownRemaining)}`, 'warn');
            return;
        }
        runSpin('paid');
    };

    const claimDailyPoints = async () => {
        setClaimBusy(true);
        setClaimMessage('');
        try {
            const response = await api.post('/points/claim-daily');
            setClaimMessage(response.data.message || 'Claimed');
            pushToast('Daily points claimed', 'ok');
            setLocalStatus((prev) => prev ? {
                ...prev,
                can_claim_daily_bonus: false,
                wallet_balance: response.data.wallet?.balance ?? prev.wallet_balance,
            } : prev);
            await refreshSpinStatus();
        } catch (error) {
            const msg = error?.response?.data?.message || 'Claim not available';
            setClaimMessage(msg);
            pushToast(msg, 'warn');
            if (error?.response?.status === 409) {
                setLocalStatus((prev) => prev ? { ...prev, can_claim_daily_bonus: false } : prev);
            }
        } finally {
            setClaimBusy(false);
        }
    };

    return (
        <main className="app-shell user-page sub-page">
            <UserHeader onNotify={() => pushToast('You have no new notifications', 'ok')} />
            <SpinnerCard title={localStatus?.config?.name || 'Spin Wheel'}>
                <p className="subtitle">Wheel rewards are points-only.</p>
                <div className="spacer spin-wheel-wrapper">
                    <SpinWheel
                        size={260}
                        segments={segments}
                        rotation={rotation}
                        transitionMs={transitionMs}
                        centerLabel={localStatus?.config?.center_label || 'LUCKY'}
                        centerActionLabel={centerActionLabel}
                        centerActionSubLabel={centerActionSubLabel}
                        onCenterAction={handleCenterSpinAction}
                        centerDisabled={centerDisabled}
                    />
                </div>
                <div className="spacer spin-actions">
                    <section className="buy-banner spin-buy-banner">
                        <div className="buy-banner-icon"><AppIcon name="coin" size={30} /></div>
                        <div>
                            <span>Need more points?</span>
                            <strong>Buy points from admin</strong>
                        </div>
                        <button type="button" onClick={() => navigate('/buy-points')}>Buy</button>
                    </section>
                    <section className="daily-card spin-daily-card">
                        <div className="daily-card-heading">
                            <div>
                                <span>Daily bonus</span>
                                <h2>Daily check in</h2>
                            </div>
                            <strong className={`daily-status ${localStatus?.can_claim_daily_bonus ? 'ready' : ''}`}>
                                {localStatus?.can_claim_daily_bonus ? 'Ready' : 'Claimed'}
                            </strong>
                        </div>
                        <button className="collect-button" type="button" onClick={claimDailyPoints} disabled={claimBusy || !localStatus?.can_claim_daily_bonus}>
                            {claimBusy ? 'Claiming…' : localStatus?.can_claim_daily_bonus ? 'Claim points' : 'Claimed today'}
                        </button>
                        {claimMessage ? <p className="daily-claim-message">{claimMessage}</p> : null}
                    </section>
                </div>
                <div className="spin-result-wrap">
                    {result?.text ? <p className={`message ${result.type} spacer`}>{result.text}</p> : null}
                </div>
                {winModal ? (
                    <div className="spin-result-overlay" role="dialog" aria-modal="true" aria-label="Spin result">
                        <section className="spin-result-modal">
                            <div className="celebration-burst" aria-hidden="true">
                                {Array.from({ length: 12 }).map((_, index) => <i key={index} />)}
                            </div>
                            <div className="win-coin"><AppIcon name="coin" size={42} /></div>
                            <span className="win-kicker">{winModal.rewardType === 'free' ? 'Daily free spin' : 'Paid spin'}</span>
                            <h2>You won!</h2>
                            <strong className="win-points">+{formatPoints(winModal.points)} points</strong>
                            <p>{winModal.segment}</p>
                            <small>New balance: {formatPoints(winModal.balanceAfter)} points</small>
                            <button className="btn primary" type="button" onClick={() => setWinModal(null)}>Awesome!</button>
                        </section>
                    </div>
                ) : null}
            </SpinnerCard>
        </main>
    );
}

function parsePaging(response) {
    return response.data.meta || {
        current_page: 1,
        per_page: 20,
        total: Array.isArray(response.data.transactions || response.data.spins)
            ? (response.data.transactions || response.data.spins).length
            : 0,
        last_page: 1,
    };
}

function PullToRefreshList({ onRefresh, children }) {
    const listRef = useRef(null);
    const startY = useRef(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const onTouchStart = (event) => {
        if (!listRef.current) {
            return;
        }
        if (listRef.current.scrollTop !== 0) {
            return;
        }
        startY.current = event.touches[0].clientY;
    };

    const onTouchMove = (event) => {
        if (!listRef.current || startY.current === 0) {
            return;
        }
        const delta = event.touches[0].clientY - startY.current;
        if (delta > 80 && !isRefreshing && listRef.current.scrollTop === 0) {
            setIsRefreshing(true);
            onRefresh().finally(() => {
                setTimeout(() => setIsRefreshing(false), 350);
            });
            startY.current = 0;
        }
    };

    const onTouchEnd = () => {
        startY.current = 0;
    };

    return (
        <div
            ref={listRef}
            className="pull-list"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {isRefreshing ? <div className="subtitle spacer">Refreshing…</div> : null}
            {children}
        </div>
    );
}

function HistoryScreen() {
    const { api, pushToast } = useContext(AuthContext);
    const [type, setType] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ current_page: 1, per_page: 20, total: 0, last_page: 1 });
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTransaction, setSelectedTransaction] = useState(null);

    const load = async (nextPage = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (type) {
                params.set('type', type);
            }
            if (from) {
                params.set('from', from);
            }
            if (to) {
                params.set('to', to);
            }
            params.set('page', String(nextPage));
            const response = await api.get(`/wallet/transactions?${params.toString()}`);
            setTransactions(response.data.transactions || []);
            setMeta(parsePaging(response));
            setPage(nextPage);
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Failed to load history', 'err');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(1);
    }, []);

    return (
        <main className="app-shell user-page sub-page">
            <UserHeader onNotify={() => pushToast('You have no new notifications', 'ok')} />
            <SpinnerCard title="History">
                <div className="history-filters spacer">
                    <select value={type} onChange={(event) => setType(event.target.value)}>
                        <option value="">All</option>
                        <option value="daily_bonus">Daily Bonus</option>
                        <option value="free_spin_reward">Free Spin</option>
                        <option value="paid_spin_reward">Paid Spin Reward</option>
                        <option value="spin_spend">Spin Spend</option>
                        <option value="admin_adjustment">Admin Adjustment</option>
                    </select>
                    <input
                        type="date"
                        value={from}
                        onChange={(event) => setFrom(event.target.value)}
                        placeholder="From"
                    />
                    <input
                        type="date"
                        value={to}
                        onChange={(event) => setTo(event.target.value)}
                        placeholder="To"
                    />
                    <div className="history-filter-actions">
                        <button onClick={() => load(1)} type="button">Apply filters</button>
                        <button onClick={() => load(page)} type="button">Refresh</button>
                    </div>
                </div>
                {loading && <p className="subtitle">Loading…</p>}
                <PullToRefreshList onRefresh={() => load(1)}>
                    {!loading && transactions.length === 0 ? <p className="subtitle">No transactions yet.</p> : null}
                    <ul className="history-list spacer">
                        {transactions.map((tx) => (
                            <li className="history-transaction" key={tx.id}>
                                <button
                                    className="history-transaction-row"
                                    type="button"
                                    aria-label={`Open ${humanizeTransactionType(tx.type)} details`}
                                    onClick={() => setSelectedTransaction(tx)}
                                >
                                    <span className={`history-type-icon ${tx.amount >= 0 ? 'credit' : 'debit'}`}>
                                        <AppIcon name={tx.type === 'spin_spend' ? 'wheel' : 'coin'} size={20} />
                                    </span>
                                    <span className="history-main-copy">
                                        <strong>{humanizeTransactionType(tx.type)}</strong>
                                        <small>{new Date(tx.created_at).toLocaleString()}</small>
                                    </span>
                                    <span className="history-value-copy">
                                        <strong className={tx.amount >= 0 ? 'credit' : 'debit'}>
                                            {tx.amount > 0 ? '+' : ''}{formatPoints(tx.amount)} pts
                                        </strong>
                                        <small>Balance {formatPoints(tx.balance_after)}</small>
                                    </span>
                                    <AppIcon name="arrow" size={18} />
                                </button>
                            </li>
                        ))}
                    </ul>
                </PullToRefreshList>
                <div className="history-pagination">
                    <button
                        className="btn secondary"
                        onClick={() => load(page - 1)}
                        disabled={page <= 1}
                        type="button"
                    >
                        Prev
                    </button>
                    <span className="toolbar-caption">
                        {meta.current_page} / {meta.last_page}
                    </span>
                    <button
                        className="btn secondary"
                        onClick={() => load(page + 1)}
                        disabled={page >= meta.last_page}
                        type="button"
                    >
                        Next
                    </button>
                </div>
                <TransactionDetailSheet
                    record={selectedTransaction}
                    onClose={() => setSelectedTransaction(null)}
                />
            </SpinnerCard>
        </main>
    );
}

function AdminDashboardScreen() {
    return (
        <main className="app-shell admin-page admin-dashboard">
            <div className="admin-page-heading">
                <div><span>Administration</span><h1>Overview</h1></div>
            </div>
            <nav className="admin-quick-grid" aria-label="Primary admin actions">
                <NavLink to="/admin/users"><AppIcon name="user" size={22} /><span><strong>Users</strong><small>Accounts & points</small></span><AppIcon name="arrow" size={17} /></NavLink>
                <NavLink to="/admin/spin-config"><AppIcon name="wheel" size={22} /><span><strong>Wheel</strong><small>Rewards & cost</small></span><AppIcon name="arrow" size={17} /></NavLink>
                <NavLink to="/admin/app-settings"><AppIcon name="settings" size={22} /><span><strong>App content</strong><small>Links & Home</small></span><AppIcon name="arrow" size={17} /></NavLink>
                <NavLink to="/admin/settings"><AppIcon name="user" size={22} /><span><strong>Admin account</strong><small>Profile & password</small></span><AppIcon name="arrow" size={17} /></NavLink>
            </nav>
        </main>
    );
}

function AdminUsersScreen() {
    const { api, pushToast } = useContext(AuthContext);
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ current_page: 1, per_page: 20, total: 0, last_page: 1 });
    const [users, setUsers] = useState([]);
    const [adjustAmount, setAdjustAmount] = useState('');
    const [adjustUserId, setAdjustUserId] = useState('');
    const [pointModalUser, setPointModalUser] = useState(null);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [passwordModalUser, setPasswordModalUser] = useState(null);
    const [accountModalUser, setAccountModalUser] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [createUser, setCreateUser] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
    });
    const [loading, setLoading] = useState(false);

    const loadUsers = async (nextPage = 1, overrides = {}) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            const activeQuery = overrides.query ?? query;
            const activeStatus = overrides.status ?? statusFilter;
            if (activeQuery) {
                params.set('q', activeQuery);
            }
            if (activeStatus) {
                params.set('status', activeStatus);
            }
            params.set('page', String(nextPage));
            params.set('per_page', '10');
            const response = await api.get(`/admin/users?${params.toString()}`);
            setUsers(response.data.users || []);
            setMeta(response.data.meta || {});
            setPage(nextPage);
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Failed to load users', 'err');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers(1);
    }, []);

    const create = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/users', {
                ...createUser,
            });
            setCreateUser({
                name: '',
                email: '',
                phone: '',
                password: '',
            });
            setCreateModalOpen(false);
            pushToast('User created', 'ok');
            await loadUsers(page);
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Failed to create user', 'err');
        }
    };

    const updateStatus = async (user) => {
        try {
            const next = user.status === 'active' ? 'disabled' : 'active';
            await api.patch(`/admin/users/${user.id}`, { status: next });
            pushToast(`User ${next === 'active' ? 'enabled' : 'disabled'}`, 'ok');
            setAccountModalUser(null);
            await loadUsers(page);
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Update failed', 'err');
        }
    };

    const adjustPoints = async () => {
        if (!adjustUserId || adjustAmount === '') {
            pushToast('Select user and amount first', 'warn');
            return;
        }
        try {
            await api.post(`/admin/users/${adjustUserId}/adjust-points`, {
                amount: Number(adjustAmount),
            });
            pushToast('Points adjusted', 'ok');
            setAdjustAmount('');
            setAdjustUserId('');
            setPointModalUser(null);
            await loadUsers(page);
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Adjustment failed', 'err');
        }
    };

    const resetPassword = async () => {
        if (!passwordModalUser || !newPassword) {
            return;
        }
        try {
            await api.post(`/admin/users/${passwordModalUser.id}/reset-password`, {
                password: newPassword,
            });
            pushToast('Password reset', 'ok');
            setPasswordModalUser(null);
            setNewPassword('');
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Password reset failed', 'err');
        }
    };

    return (
        <main className="app-shell admin-page">
            <SpinnerCard title="Admin — Users">
                <button className="admin-create-user-button spacer" type="button" onClick={() => setCreateModalOpen(true)}>
                    <span><strong>Create user account</strong><small>Add a new player</small></span>
                    <AppIcon name="arrow" size={17} />
                </button>

                <form className="admin-user-search spacer" onSubmit={(event) => {
                    event.preventDefault();
                    loadUsers(1);
                }}>
                    <input
                        type="search"
                        enterKeyHint="search"
                        value={query}
                        placeholder="Search name / email / phone"
                        onChange={(event) => setQuery(event.target.value)}
                    />
                    <select value={statusFilter} onChange={(event) => {
                        const status = event.target.value;
                        setStatusFilter(status);
                        loadUsers(1, { status });
                    }} aria-label="Filter users by status">
                        <option value="">All</option>
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                    </select>
                </form>

                <div className="spacer">
                    {loading && <p className="subtitle">Loading users…</p>}
                    <ul className="history-list">
                        {users.map((user) => (
                            <li className="admin-user-row" key={user.id}>
                                <button className="admin-user-row-button" type="button" onClick={() => navigate(`/admin/users/${user.id}`)}>
                                <div className="admin-user-summary">
                                    <span className={`admin-status-dot ${user.status}`} />
                                    <span><strong>{user.name}</strong><small>{user.email || user.phone || `User #${user.id}`}</small></span>
                                    <strong>{formatPoints(user.wallet_balance)} pts</strong>
                                    <AppIcon name="arrow" size={16} />
                                </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="history-pagination compact-pagination">
                        <button className="btn secondary" disabled={page <= 1} onClick={() => loadUsers(page - 1)} type="button">
                            Prev
                        </button>
                        <span className="toolbar-caption">
                            {meta.current_page}/{meta.last_page}
                        </span>
                        <button
                            className="btn secondary"
                            disabled={page >= meta.last_page}
                            onClick={() => loadUsers(page + 1)}
                            type="button"
                        >
                            Next
                        </button>
                    </div>
                </div>

                <AdminModal open={createModalOpen} title="Create user account" subtitle="Assign the first login credentials" onClose={() => setCreateModalOpen(false)}>
                    <form className="admin-modal-form" onSubmit={create}>
                    <input
                        className="input"
                        placeholder="Name"
                        value={createUser.name}
                        onChange={(event) => setCreateUser((prev) => ({ ...prev, name: event.target.value }))}
                        required
                    />
                    <input
                        className="input"
                        placeholder="Email"
                        value={createUser.email}
                        onChange={(event) => setCreateUser((prev) => ({ ...prev, email: event.target.value }))}
                        required
                    />
                    <input
                        className="input"
                        placeholder="Phone"
                        value={createUser.phone}
                        onChange={(event) => setCreateUser((prev) => ({ ...prev, phone: event.target.value }))}
                    />
                    <input
                        className="input"
                        placeholder="Password"
                        type="password"
                        value={createUser.password}
                        onChange={(event) => setCreateUser((prev) => ({ ...prev, password: event.target.value }))}
                        required
                    />
                    <button className="btn primary" type="submit">
                        Create account
                    </button>
                    </form>
                </AdminModal>

            </SpinnerCard>
            <AdminModal
                open={!!accountModalUser}
                title={accountModalUser?.name || 'User account'}
                subtitle={accountModalUser?.email || accountModalUser?.phone || ''}
                onClose={() => setAccountModalUser(null)}
            >
                {accountModalUser ? (
                    <div className="admin-account-actions">
                        <div className="admin-account-balance"><span>Point balance</span><strong>{formatPoints(accountModalUser.wallet_balance)}</strong></div>
                        <button className="btn primary" type="button" onClick={() => {
                            setAdjustUserId(String(accountModalUser.id));
                            setAdjustAmount('');
                            setPointModalUser(accountModalUser);
                            setAccountModalUser(null);
                        }}>Add or remove points</button>
                        <button className="btn secondary" type="button" onClick={() => {
                            setPasswordModalUser(accountModalUser);
                            setNewPassword('');
                            setAccountModalUser(null);
                        }}>Reset password</button>
                        <button className={accountModalUser.status === 'active' ? 'btn danger' : 'btn success'} type="button" onClick={() => updateStatus(accountModalUser)}>
                            {accountModalUser.status === 'active' ? 'Disable user' : 'Enable user'}
                        </button>
                    </div>
                ) : null}
            </AdminModal>
            <AdminModal
                open={!!pointModalUser}
                title="Adjust points"
                subtitle={pointModalUser ? `${pointModalUser.name} · ${formatPoints(pointModalUser.wallet_balance)} points` : ''}
                onClose={() => {
                    setPointModalUser(null);
                    setAdjustAmount('');
                    setAdjustUserId('');
                }}
            >
                <div className="admin-modal-form">
                    <label>
                        <span>Point amount</span>
                        <input
                            className="input"
                            type="number"
                            inputMode="numeric"
                            value={adjustAmount}
                            onChange={(event) => setAdjustAmount(event.target.value)}
                            placeholder="Example: 500 or -100"
                            autoFocus
                        />
                        <small>Use a positive number to add points or a negative number to deduct them.</small>
                    </label>
                    <button className="btn primary" type="button" onClick={adjustPoints} disabled={adjustAmount === '' || Number(adjustAmount) === 0}>
                        Apply point adjustment
                    </button>
                </div>
            </AdminModal>
            <AdminModal
                open={!!passwordModalUser}
                title="Reset password"
                subtitle={passwordModalUser?.name || ''}
                onClose={() => {
                    setPasswordModalUser(null);
                    setNewPassword('');
                }}
            >
                <div className="admin-modal-form">
                    <label>
                        <span>New password</span>
                        <input className="input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength="8" autoFocus />
                        <small>Use at least 8 characters and share it with the user securely.</small>
                    </label>
                    <button className="btn primary" type="button" onClick={resetPassword} disabled={newPassword.length < 8}>Save new password</button>
                </div>
            </AdminModal>
        </main>
    );
}

function AdminUserRecordsScreen() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { api, pushToast } = useContext(AuthContext);
    const [user, setUser] = useState(null);
    const [type, setType] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ current_page: 1, per_page: 20, total: 0, last_page: 1 });
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pointModalOpen, setPointModalOpen] = useState(false);
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [accountModalOpen, setAccountModalOpen] = useState(false);
    const [accountForm, setAccountForm] = useState({ name: '', email: '', phone: '' });
    const [adjustAmount, setAdjustAmount] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [selectedTransaction, setSelectedTransaction] = useState(null);

    const load = async (nextPage = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (type) params.set('type', type);
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            params.set('page', String(nextPage));
            params.set('per_page', '20');
            const response = await api.get(`/admin/users/${userId}?${params.toString()}`);
            setUser(response.data.user);
            setAccountForm({
                name: response.data.user?.name || '',
                email: response.data.user?.email || '',
                phone: response.data.user?.phone || '',
            });
            setTransactions(response.data.transactions || []);
            setMeta(parsePaging(response));
            setPage(nextPage);
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Could not load user records', 'err');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(1);
    }, [userId]);

    const adjustPoints = async () => {
        if (adjustAmount === '' || Number(adjustAmount) === 0) {
            pushToast('Enter a point amount first', 'warn');
            return;
        }
        try {
            await api.post(`/admin/users/${userId}/adjust-points`, {
                amount: Number(adjustAmount),
            });
            setAdjustAmount('');
            setPointModalOpen(false);
            pushToast('Points adjusted', 'ok');
            await load(1);
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Adjustment failed', 'err');
        }
    };

    const resetPassword = async () => {
        if (newPassword.length < 8) {
            pushToast('Password must be at least 8 characters', 'warn');
            return;
        }
        try {
            await api.post(`/admin/users/${userId}/reset-password`, {
                password: newPassword,
            });
            setNewPassword('');
            setPasswordModalOpen(false);
            pushToast('Password reset', 'ok');
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Password reset failed', 'err');
        }
    };

    const saveAccountDetails = async (event) => {
        event.preventDefault();
        try {
            await api.patch(`/admin/users/${userId}`, {
                name: accountForm.name,
                email: accountForm.email,
                phone: accountForm.phone || null,
            });
            setAccountModalOpen(false);
            pushToast('User account updated', 'ok');
            await load(page);
        } catch (error) {
            const validation = error?.response?.data?.errors;
            const firstError = validation ? Object.values(validation).flat()[0] : null;
            pushToast(firstError || error?.response?.data?.message || 'Could not update user account', 'err');
        }
    };

    const toggleStatus = async () => {
        if (!user) return;
        const next = user.status === 'active' ? 'disabled' : 'active';
        try {
            await api.patch(`/admin/users/${user.id}`, { status: next });
            pushToast(`User ${next === 'active' ? 'enabled' : 'disabled'}`, 'ok');
            await load(page);
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Update failed', 'err');
        }
    };

    return (
        <main className="app-shell admin-page">
            <SpinnerCard title="User records">
                <button className="admin-back-link" type="button" onClick={() => navigate('/admin/users')}>
                    <AppIcon name="arrow" size={16} /> Users
                </button>

                {user ? (
                    <section className="admin-user-record-card spacer">
                        <div>
                            <span className={`admin-status-dot ${user.status}`} />
                            <strong>{user.name}</strong>
                            <small>{user.email || user.phone || `User #${user.id}`}</small>
                        </div>
                        <strong>{formatPoints(user.wallet_balance)} pts</strong>
                    </section>
                ) : null}

                <details className="admin-collapsible admin-record-actions spacer">
                    <summary>Account actions</summary>
                    <div className="admin-action-grid">
                        <button className="btn secondary" type="button" onClick={() => setAccountModalOpen(true)}>Edit account</button>
                        <button className="btn primary" type="button" onClick={() => setPointModalOpen(true)}>Add/remove points</button>
                        <button className="btn secondary" type="button" onClick={() => setPasswordModalOpen(true)}>Change password</button>
                        <button className={user?.status === 'active' ? 'btn danger' : 'btn success'} type="button" onClick={toggleStatus}>
                            {user?.status === 'active' ? 'Disable user' : 'Enable user'}
                        </button>
                    </div>
                </details>

                <div className="history-filters admin-record-filters spacer">
                    <select value={type} onChange={(event) => setType(event.target.value)}>
                        <option value="">All records</option>
                        <option value="daily_bonus">Daily Bonus</option>
                        <option value="free_spin_reward">Free Spin</option>
                        <option value="paid_spin_reward">Paid Spin Reward</option>
                        <option value="spin_spend">Spin Spend</option>
                        <option value="admin_adjustment">Admin Adjustment</option>
                    </select>
                    <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
                    <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
                    <div className="history-filter-actions">
                        <button onClick={() => load(1)} type="button">Apply filters</button>
                        <button onClick={() => load(page)} type="button">Refresh</button>
                    </div>
                </div>

                {loading && <p className="subtitle">Loading records…</p>}
                {!loading && transactions.length === 0 ? <p className="subtitle">No records yet.</p> : null}
                <ul className="history-list spacer">
                    {transactions.map((tx) => (
                        <li className="history-transaction" key={tx.id}>
                            <button className="history-transaction-row" type="button" onClick={() => setSelectedTransaction(tx)}>
                                <span className={`history-type-icon ${tx.amount >= 0 ? 'credit' : 'debit'}`}>
                                    <AppIcon name={tx.type === 'spin_spend' ? 'wheel' : 'coin'} size={20} />
                                </span>
                                <span className="history-main-copy">
                                    <strong>{humanizeTransactionType(tx.type)}</strong>
                                    <small>{new Date(tx.created_at).toLocaleString()}</small>
                                </span>
                                <span className="history-value-copy">
                                    <strong className={tx.amount >= 0 ? 'credit' : 'debit'}>
                                        {tx.amount > 0 ? '+' : ''}{formatPoints(tx.amount)} pts
                                    </strong>
                                    <small>Balance {formatPoints(tx.balance_after)}</small>
                                </span>
                                <AppIcon name="arrow" size={18} />
                            </button>
                        </li>
                    ))}
                </ul>

                <div className="history-pagination compact-pagination">
                    <button className="btn secondary" disabled={page <= 1} onClick={() => load(page - 1)} type="button">Prev</button>
                    <span className="toolbar-caption">{meta.current_page}/{meta.last_page}</span>
                    <button className="btn secondary" disabled={page >= meta.last_page} onClick={() => load(page + 1)} type="button">Next</button>
                </div>
            </SpinnerCard>

            <AdminModal open={pointModalOpen} title="Adjust points" subtitle={user?.name || ''} onClose={() => setPointModalOpen(false)}>
                <div className="admin-modal-form">
                    <label>
                        <span>Point amount</span>
                        <input className="input" type="number" inputMode="numeric" value={adjustAmount} onChange={(event) => setAdjustAmount(event.target.value)} placeholder="Example: 500 or -100" autoFocus />
                        <small>Positive adds points. Negative deducts points.</small>
                    </label>
                    <button className="btn primary" type="button" onClick={adjustPoints}>Apply point adjustment</button>
                </div>
            </AdminModal>

            <AdminModal open={accountModalOpen} title="Edit user account" subtitle={user?.name || ''} onClose={() => setAccountModalOpen(false)}>
                <form className="admin-modal-form" onSubmit={saveAccountDetails}>
                    <label>
                        <span>Name</span>
                        <input className="input" value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} required autoFocus />
                    </label>
                    <label>
                        <span>Email</span>
                        <input className="input" type="email" value={accountForm.email} onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))} required />
                    </label>
                    <label>
                        <span>Phone number</span>
                        <input className="input" value={accountForm.phone} onChange={(event) => setAccountForm((current) => ({ ...current, phone: event.target.value }))} />
                    </label>
                    <button className="btn primary" type="submit">Save account</button>
                </form>
            </AdminModal>

            <AdminModal open={passwordModalOpen} title="Change password" subtitle={user?.name || ''} onClose={() => setPasswordModalOpen(false)}>
                <div className="admin-modal-form">
                    <label>
                        <span>New password</span>
                        <input className="input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength="8" autoFocus />
                    </label>
                    <button className="btn primary" type="button" onClick={resetPassword} disabled={newPassword.length < 8}>Save new password</button>
                </div>
            </AdminModal>

            <TransactionDetailSheet record={selectedTransaction} onClose={() => setSelectedTransaction(null)} />
        </main>
    );
}

function AdminMonitoringScreen() {
    const { api, pushToast } = useContext(AuthContext);
    const [withinMinutes, setWithinMinutes] = useState(60);
    const [minEvents, setMinEvents] = useState(12);
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);

    const load = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('within_minutes', String(withinMinutes));
            params.set('min_events', String(minEvents));
            const response = await api.get(`/admin/monitoring/suspicious-spins?${params.toString()}`);
            setItems(response.data.data || []);
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Failed to load suspicious activity', 'err');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    return (
        <main className="app-shell admin-page">
            <SpinnerCard title="Admin — Suspicious Activity">
                <details className="admin-collapsible spacer">
                    <summary>Detection filters</summary>
                    <div className="admin-compact-form">
                    <input
                        type="number"
                        min="1"
                        value={withinMinutes}
                        onChange={(event) => setWithinMinutes(Number(event.target.value || 0))}
                    />
                    <input
                        type="number"
                        min="1"
                        value={minEvents}
                        onChange={(event) => setMinEvents(Number(event.target.value || 0))}
                    />
                    <button className="btn secondary" type="button" onClick={() => load()}>
                        Refresh
                    </button>
                    </div>
                </details>
                {loading && <p className="subtitle">Loading…</p>}
                {!loading && items.length === 0 ? <p className="subtitle">No suspicious spins found.</p> : null}
                <ul className="history-list spacer">
                    {items.map((item) => (
                        <li key={item.user_id}>
                            <p>
                                <strong>{item.name || `User #${item.user_id}`}</strong> ({item.email || 'n/a'})
                            </p>
                            <p>User ID: {item.user_id}</p>
                            <p>Events in window: {item.events_in_window}</p>
                            <p>Latest spin: {new Date(item.latest_spin_at).toLocaleString()}</p>
                        </li>
                    ))}
                </ul>
            </SpinnerCard>
        </main>
    );
}

function AdminHealthScreen() {
    const { api, pushToast } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [health, setHealth] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const response = await api.get('/admin/reports/health');
            setHealth(response.data || null);
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Failed to load health data', 'err');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    return (
        <main className="app-shell admin-page">
            <SpinnerCard title="Admin — Health & Operations">
                <div className="toolbar">
                    <button className="btn secondary" type="button" onClick={load}>
                        Refresh
                    </button>
                </div>
                {loading ? (
                    <p className="subtitle">Loading…</p>
                ) : (
                    <>
                        <div className="status-grid">
                            <div className="status-chip">
                                <p>Overall status</p>
                                <strong>{health?.status || 'unknown'}</strong>
                            </div>
                            <div className="status-chip">
                                <p>Last check</p>
                                <strong>{health?.time || 'n/a'}</strong>
                            </div>
                            <div className="status-chip">
                                <p>Active users</p>
                                <strong>{health?.counts?.users?.active_users ?? 0}</strong>
                            </div>
                            <div className="status-chip">
                                <p>Recent spins</p>
                                <strong>{health?.counts?.spins?.recent_spins ?? 0}</strong>
                            </div>
                            <div className="status-chip">
                                <p>Recent alert candidates</p>
                                <strong>{health?.counts?.alerts?.recent_suspicious_users ?? 0}</strong>
                            </div>
                            <div className="status-chip">
                                <p>DB</p>
                                <strong>
                                    {health?.database?.connected ? 'Connected' : 'Disconnected'}
                                </strong>
                            </div>
                        </div>
                        <div className="spacer">
                            <h2 className="subtitle">Alerts</h2>
                            {!health?.alerts?.length ? <p className="subtitle">No alerts</p> : null}
                            <ul className="history-list">
                                {(health?.alerts || []).map((alert) => (
                                    <li key={alert.code}>
                                        <p>
                                            <strong>{alert.code}</strong> ({alert.severity})
                                        </p>
                                        <p>{alert.message}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </>
                )}
            </SpinnerCard>
        </main>
    );
}

function AdminSettingsScreen() {
    const { api, me, refreshMe, pushToast } = useContext(AuthContext);
    const [form, setForm] = useState({ name: me?.name || '', email: me?.email || '', phone: me?.phone || '' });
    const [saving, setSaving] = useState(false);
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', password: '', confirmation: '' });
    const [changingPassword, setChangingPassword] = useState(false);

    useEffect(() => {
        setForm({ name: me?.name || '', email: me?.email || '', phone: me?.phone || '' });
    }, [me]);

    const save = async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
            await api.patch('/admin/profile', form);
            await refreshMe();
            pushToast('Admin account updated', 'ok');
        } catch (error) {
            const validation = error?.response?.data?.errors;
            pushToast(validation ? Object.values(validation).flat()[0] : (error?.response?.data?.message || 'Could not update admin account'), 'err');
        } finally {
            setSaving(false);
        }
    };

    const changePassword = async (event) => {
        event.preventDefault();
        setChangingPassword(true);
        try {
            await api.patch('/admin/profile/password', {
                current_password: passwordForm.currentPassword,
                password: passwordForm.password,
                password_confirmation: passwordForm.confirmation,
            });
            setPasswordForm({ currentPassword: '', password: '', confirmation: '' });
            setPasswordModalOpen(false);
            pushToast('Admin password changed', 'ok');
        } catch (error) {
            const validation = error?.response?.data?.errors;
            pushToast(validation ? Object.values(validation).flat()[0] : (error?.response?.data?.message || 'Could not change password'), 'err');
        } finally {
            setChangingPassword(false);
        }
    };

    return (
        <main className="app-shell admin-page">
            <SpinnerCard title="Admin — Settings">
                <section className="admin-profile-summary">
                    <div className="admin-profile-avatar"><AppIcon name="user" size={25} /></div>
                    <span><strong>{me?.name}</strong><small>Sole administrator · active</small></span>
                </section>
                <form className="admin-modal-form spacer" onSubmit={save}>
                    <label><span>Name</span><input className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label>
                    <label><span>Email</span><input className="input" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required /></label>
                    <label><span>Phone</span><input className="input" type="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
                    <button className="btn primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save account information'}</button>
                </form>
                <nav className="admin-function-grid spacer">
                    <NavLink className="admin-function-link" to="/admin/app-settings">
                        <AppIcon name="settings" size={21} /><span><strong>App content settings</strong><small>Home text, contacts and social links</small></span><AppIcon name="arrow" size={17} />
                    </NavLink>
                    <button type="button" onClick={() => setPasswordModalOpen(true)}>
                        <AppIcon name="lock" size={21} /><span><strong>Change password</strong><small>Verify the current password first</small></span><AppIcon name="arrow" size={17} />
                    </button>
                </nav>
            </SpinnerCard>
            <AdminModal
                open={passwordModalOpen}
                title="Change admin password"
                subtitle="Use at least 8 characters"
                onClose={() => setPasswordModalOpen(false)}
            >
                <form className="admin-modal-form" onSubmit={changePassword}>
                    <label>
                        <span>Current password</span>
                        <input className="input" type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} required />
                    </label>
                    <label>
                        <span>New password</span>
                        <input className="input" type="password" autoComplete="new-password" minLength="8" value={passwordForm.password} onChange={(event) => setPasswordForm((current) => ({ ...current, password: event.target.value }))} required />
                    </label>
                    <label>
                        <span>Confirm new password</span>
                        <input className="input" type="password" autoComplete="new-password" minLength="8" value={passwordForm.confirmation} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmation: event.target.value }))} required />
                    </label>
                    <button className="btn primary" type="submit" disabled={changingPassword}>{changingPassword ? 'Changing…' : 'Change password'}</button>
                </form>
            </AdminModal>
        </main>
    );
}

function AdminApplicationSettingsScreen() {
    const { api, refreshAppSettings, pushToast } = useContext(AuthContext);
    const [form, setForm] = useState(DEFAULT_APP_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const response = await api.get('/app-settings');
                setForm({ ...DEFAULT_APP_SETTINGS, ...(response.data.settings || {}) });
            } catch (error) {
                pushToast(error?.response?.data?.message || 'Could not load app settings', 'err');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [api, pushToast]);

    const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

    const save = async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
            const payload = Object.fromEntries(
                Object.keys(DEFAULT_APP_SETTINGS).map((key) => [key, form[key] === '' ? null : form[key]]),
            );
            payload.play_bet_url = form.play_bet_url;
            payload.play_bet_label = form.play_bet_label;
            payload.daily_bonus_points = Math.max(0, Number(form.daily_bonus_points) || 0);
            payload.contact_phone = splitSettingLines(form.contact_phone_numbers)[0] || null;
            const response = await api.patch('/admin/app-settings', payload);
            setForm({ ...DEFAULT_APP_SETTINGS, ...(response.data.settings || {}) });
            await refreshAppSettings();
            pushToast('App links and content updated', 'ok');
        } catch (error) {
            const validation = error?.response?.data?.errors;
            const firstError = validation ? Object.values(validation).flat()[0] : null;
            pushToast(firstError || error?.response?.data?.message || 'Could not save app settings', 'err');
        } finally {
            setSaving(false);
        }
    };

    const contactFields = [
        ['play_bet_url', 'Play Bet URL', 'url'],
        ['play_bet_label', 'Play Bet display text', 'text'],
        ['telegram_contact_url', 'Telegram exchange/contact URL', 'text'],
        ['viber_contact_url', 'Viber exchange/contact URL', 'text'],
    ];
    const socialFields = [
        ['telegram_channel_url', 'Telegram channel URL', 'url'],
        ['facebook_page_url', 'Facebook page URL', 'url'],
        ['tiktok_channel_url', 'TikTok channel URL', 'url'],
    ];

    return (
        <main className="app-shell admin-page">
            <SpinnerCard title="Admin — App Links & Content">
                <p className="subtitle">These changes appear in the user app immediately; no rebuild is required.</p>
                {loading ? <p className="subtitle spacer">Loading…</p> : (
                    <form className="admin-settings-form spacer" onSubmit={save}>
                        <details className="admin-collapsible">
                            <summary>Betting & contact links</summary>
                            <div className="admin-compact-form">
                                {contactFields.map(([key, label, type]) => (
                                    <label key={key}><span>{label}</span><input className="input" type={type} value={form[key] || ''} onChange={(event) => update(key, event.target.value)} required={key === 'play_bet_url' || key === 'play_bet_label'} /></label>
                                ))}
                                <label><span>Contact phone numbers — one per line</span><textarea className="input" rows="4" value={form.contact_phone_numbers || ''} onChange={(event) => update('contact_phone_numbers', event.target.value)} /></label>
                            </div>
                        </details>
                        <details className="admin-collapsible">
                            <summary>Home screen content</summary>
                            <div className="admin-compact-form">
                                <label><span>Information board — one item per line</span><textarea className="input" rows="6" value={form.home_board_text || ''} onChange={(event) => update('home_board_text', event.target.value)} /></label>
                                <label><span>Auto-scrolling text</span><textarea className="input" rows="3" value={form.home_ticker_text || ''} onChange={(event) => update('home_ticker_text', event.target.value)} /></label>
                                <label><span>Daily claim points</span><input className="input" type="number" inputMode="numeric" min="0" value={form.daily_bonus_points ?? 20} onChange={(event) => update('daily_bonus_points', event.target.value)} /></label>
                            </div>
                        </details>
                        <details className="admin-collapsible">
                            <summary>Social links & About</summary>
                            <div className="admin-compact-form">
                                {socialFields.map(([key, label, type]) => (
                                    <label key={key}><span>{label}</span><input className="input" type={type} value={form[key] || ''} onChange={(event) => update(key, event.target.value)} /></label>
                                ))}
                                <label><span>Buy points instructions</span><textarea className="input" rows="5" value={form.buy_points_instructions || ''} onChange={(event) => update('buy_points_instructions', event.target.value)} /></label>
                                <label><span>About this app</span><textarea className="input" rows="4" value={form.about_content || ''} onChange={(event) => update('about_content', event.target.value)} /></label>
                            </div>
                        </details>
                        <button className="btn primary" type="submit" disabled={saving}>
                            {saving ? 'Saving…' : 'Save App Settings'}
                        </button>
                    </form>
                )}
            </SpinnerCard>
        </main>
    );
}

function AdminSpinConfigScreen() {
    const { api, pushToast } = useContext(AuthContext);
    const [editing, setEditing] = useState(null);
    const [loading, setLoading] = useState(false);
    const [editorModal, setEditorModal] = useState(null);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const response = await api.get('/admin/spin-configuration');
            setEditing(response.data.configuration);
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Could not load wheel settings', 'err');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConfig();
    }, []);

    const save = async () => {
        if (!editing) {
            return;
        }
        const payload = {
            cost_points: Number(editing.cost_points),
            segments: (editing.segments || []).map((segment) => ({
                id: segment.id || null,
                points_reward: Number(segment.points_reward),
                weight: Number(segment.weight),
            })),
        };

        try {
            const response = await api.patch('/admin/spin-configuration', payload);
            setEditing(response.data.configuration);
            pushToast('Wheel settings saved', 'ok');
            setEditorModal(null);
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Save failed', 'err');
        }
    };

    const syncSegments = (newSegments) => {
        setEditing((prev) => ({ ...prev, segments: newSegments }));
    };

    const addSegment = () => {
        const segments = [...(editing?.segments || [])];
        const palette = ['#ffca28', '#ff7a00', '#7c3aed', '#ec4899', '#22c55e', '#0ea5e9'];
        segments.push({
            label: `Slice ${segments.length + 1}`,
            color: palette[segments.length % palette.length],
            text_color: '#ffffff',
            points_reward: 10,
            weight: 10,
            max_win_per_day: null,
        });
        syncSegments(segments);
    };

    const updateSegment = (index, key, value) => {
        const next = [...(editing?.segments || [])];
        next[index] = { ...next[index], [key]: value };
        syncSegments(next);
    };

    const removeSegment = (index) => {
        const segments = [...(editing?.segments || [])];
        segments.splice(index, 1);
        syncSegments(segments);
    };

    const loadingMessage = loading ? 'Loading…' : '';
    const totalWeight = (editing?.segments || []).reduce((sum, segment) => sum + Number(segment.weight || 0), 0);
    const expectedPayout = totalWeight > 0
        ? (editing.segments || []).reduce((sum, segment) => sum + (Number(segment.points_reward || 0) * Number(segment.weight || 0)), 0) / totalWeight
        : 0;
    const expectedMargin = Number(editing?.cost_points || 0) - expectedPayout;

    return (
        <main className="app-shell admin-page">
            <SpinnerCard title="Admin — Lucky Draw Wheel">
                {loading && <p className="subtitle">{loadingMessage}</p>}
                <div className={`wheel-profit-card ${expectedMargin < 0 ? 'risk' : 'safe'}`}>
                    <span>Expected average per spin</span>
                    <strong>{expectedPayout.toFixed(2)} pts</strong>
                    <small>Paid cost {formatPoints(editing?.cost_points)} pts · expected margin {expectedMargin.toFixed(2)} pts</small>
                </div>
                <div className="admin-function-grid spacer">
                    <button type="button" onClick={() => setEditorModal('settings')}>
                        <AppIcon name="settings" size={21} />
                        <span><strong>Paid spin cost</strong><small>{formatPoints(editing?.cost_points)} points per spin</small></span>
                        <AppIcon name="arrow" size={17} />
                    </button>
                    <button type="button" onClick={() => setEditorModal('segments')} disabled={!editing}>
                        <AppIcon name="wheel" size={21} />
                        <span><strong>Slices, rewards & chances</strong><small>{(editing?.segments || []).length} slices</small></span>
                        <AppIcon name="arrow" size={17} />
                    </button>
                </div>
            </SpinnerCard>

            <AdminModal
                open={editorModal === 'settings'}
                title="Paid spin cost"
                subtitle="The points deducted for every paid spin"
                onClose={() => setEditorModal(null)}
            >
                <div className="admin-modal-form">
                    <label>
                        <span>Points required for one paid spin</span>
                        <input
                            className="input"
                            value={editing?.cost_points ?? ''}
                            onChange={(event) => setEditing((prev) => ({ ...prev, cost_points: event.target.value }))}
                            type="number"
                            inputMode="numeric"
                            min="0"
                            autoFocus
                        />
                    </label>
                    <div className={`wheel-margin-note ${expectedMargin < 0 ? 'risk' : 'safe'}`}>
                        Expected reward: {expectedPayout.toFixed(2)} points<br />
                        Expected margin: {expectedMargin.toFixed(2)} points per paid spin
                    </div>
                    <button className="btn primary" type="button" onClick={save}>
                        Save paid spin cost
                    </button>
                </div>
            </AdminModal>

                {editing ? (
                    <AdminModal
                        open={editorModal === 'segments'}
                        title="Slices, rewards & chances"
                        subtitle={`${(editing.segments || []).length} wheel slices`}
                        onClose={() => setEditorModal(null)}
                        wide
                    >
                        <div className="admin-segment-list">
                        {(editing.segments || []).map((segment, index) => (
                            <details className="segment-block" key={`${segment.id || index}`}>
                                <summary>
                                    <i style={{ background: segment.color || '#ffca28' }} />
                                    <span>Slice {index + 1}</span>
                                    <strong>{formatPoints(segment.points_reward)} pts · {totalWeight ? ((Number(segment.weight || 0) / totalWeight) * 100).toFixed(1) : '0.0'}%</strong>
                                </summary>
                                <div className="segment-editor-fields">
                                    <label>
                                        <span>Reward points</span>
                                        <input
                                            className="input"
                                            value={segment.points_reward ?? ''}
                                            type="number"
                                            inputMode="numeric"
                                            min="0"
                                            onChange={(event) => updateSegment(index, 'points_reward', event.target.value)}
                                        />
                                    </label>
                                    <label>
                                        <span>Chance weight</span>
                                        <input
                                            className="input"
                                            value={segment.weight ?? ''}
                                            type="number"
                                            inputMode="numeric"
                                            min="1"
                                            onChange={(event) => updateSegment(index, 'weight', event.target.value)}
                                        />
                                        <small>Current chance: {totalWeight ? ((Number(segment.weight || 0) / totalWeight) * 100).toFixed(2) : '0.00'}%</small>
                                    </label>
                                <button className="btn danger" type="button" onClick={() => removeSegment(index)} disabled={(editing.segments || []).length <= 2}>
                                    Remove slice
                                </button>
                                </div>
                            </details>
                        ))}
                        <button className="btn secondary" type="button" onClick={addSegment}>
                            Add slice
                        </button>
                        <button className="btn primary" type="button" onClick={save}>
                            Save slices and chances
                        </button>
                        </div>
                    </AdminModal>
                ) : null}
        </main>
    );
}

function AdminEventsScreen() {
    const { api, pushToast } = useContext(AuthContext);
    const [userId, setUserId] = useState('');
    const [type, setType] = useState('');
    const [page, setPage] = useState(1);
    const [events, setEvents] = useState([]);
    const [meta, setMeta] = useState({ current_page: 1, per_page: 20, total: 0, last_page: 1 });
    const [loading, setLoading] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);

    const load = async (nextPage = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (type) {
                params.set('type', type);
            }
            if (userId) {
                params.set('user_id', userId);
            }
            params.set('page', String(nextPage));
            const response = await api.get(`/spins/me?${params.toString()}`);
            setEvents(response.data.spins || []);
            setMeta(response.data.meta || {});
            setPage(nextPage);
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Failed to load events', 'err');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(1);
    }, []);

    return (
        <main className="app-shell admin-page">
            <SpinnerCard title="Admin — Spin Events">
                <details className="admin-collapsible">
                    <summary>Filters</summary>
                    <div className="admin-compact-form">
                    <select value={type} onChange={(event) => setType(event.target.value)}>
                        <option value="">All</option>
                        <option value="free">Free only</option>
                        <option value="paid">Paid only</option>
                    </select>
                    <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="Filter by user ID" />
                    <button className="btn secondary" type="button" onClick={() => load(1)}>
                        Apply
                    </button>
                    </div>
                </details>
                {loading && <p className="subtitle">Loading…</p>}
                <ul className="history-list spacer">
                    {!loading && events.length === 0 ? <li>No spin events found.</li> : null}
                    {events.map((spin) => (
                        <li key={spin.id}>
                            <p>
                                User #{spin.user_id} · {spin.is_free_spin ? 'Free' : 'Paid'}
                            </p>
                            <p>Segment: {spin.spin_segment_id}</p>
                            <p>
                                {spin.points_spent > 0 ? `-${spin.points_spent} pts` : ''} +{spin.points_awarded} pts
                            </p>
                            <p>{new Date(spin.created_at).toLocaleString()}</p>
                            <button className="btn secondary" type="button" onClick={() => setSelectedEvent(spin)}>
                                Details
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="toolbar">
                    <button className="btn secondary" disabled={page <= 1} onClick={() => load(page - 1)} type="button">
                        Prev
                    </button>
                    <span className="toolbar-caption">
                        {meta.current_page}/{meta.last_page}
                    </span>
                    <button
                        className="btn secondary"
                        disabled={page >= meta.last_page}
                        onClick={() => load(page + 1)}
                        type="button"
                    >
                        Next
                    </button>
                </div>
                <TransactionDetailSheet
                    record={selectedEvent}
                    onClose={() => setSelectedEvent(null)}
                />
            </SpinnerCard>
        </main>
    );
}

function AdminAuditLogScreen() {
    const { api, pushToast } = useContext(AuthContext);
    const [action, setAction] = useState('');
    const [actorUserId, setActorUserId] = useState('');
    const [subjectUserId, setSubjectUserId] = useState('');
    const [page, setPage] = useState(1);
    const [logs, setLogs] = useState([]);
    const [meta, setMeta] = useState({ current_page: 1, per_page: 20, total: 0, last_page: 1 });
    const [loading, setLoading] = useState(false);

    const load = async (nextPage = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (action) {
                params.set('action', action);
            }
            if (actorUserId) {
                params.set('actor_user_id', actorUserId);
            }
            if (subjectUserId) {
                params.set('subject_user_id', subjectUserId);
            }
            params.set('page', String(nextPage));
            const response = await api.get(`/admin/audit-logs?${params.toString()}`);
            setLogs(response.data.logs || []);
            setMeta(response.data.meta || {});
            setPage(nextPage);
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Failed to load audit logs', 'err');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(1);
    }, []);

    const clearFilters = () => {
        setAction('');
        setActorUserId('');
        setSubjectUserId('');
        load(1);
    };

    return (
        <main className="app-shell admin-page">
            <SpinnerCard title="Admin — Audit Logs">
                <details className="admin-collapsible spacer">
                    <summary>Filters</summary>
                    <div className="admin-compact-form">
                    <input value={action} onChange={(event) => setAction(event.target.value)} placeholder="Filter by action" />
                    <input value={actorUserId} onChange={(event) => setActorUserId(event.target.value)} placeholder="Actor user ID" />
                    <input
                        value={subjectUserId}
                        onChange={(event) => setSubjectUserId(event.target.value)}
                        placeholder="Subject user ID"
                    />
                    <button className="btn secondary" type="button" onClick={() => load(1)}>
                        Apply
                    </button>
                    <button className="btn secondary" type="button" onClick={clearFilters}>
                        Reset
                    </button>
                    </div>
                </details>
                {loading && <p className="subtitle">Loading…</p>}
                <ul className="history-list spacer">
                    {!loading && logs.length === 0 ? <li>No audit logs found.</li> : null}
                    {logs.map((log) => (
                        <li key={log.id}>
                            <p>
                                #{log.id} · {log.action}
                            </p>
                            <p>
                                Actor user: {log.actor_user_id || 'system'} · Subject user: {log.subject_user_id || 'n/a'}
                            </p>
                            <p>Metadata: {JSON.stringify(log.metadata || {})}</p>
                            <p>{new Date(log.created_at).toLocaleString()}</p>
                        </li>
                    ))}
                </ul>
                <div className="toolbar">
                    <button className="btn secondary" disabled={page <= 1} onClick={() => load(page - 1)} type="button">
                        Prev
                    </button>
                    <span className="toolbar-caption">
                        {meta.current_page}/{meta.last_page}
                    </span>
                    <button
                        className="btn secondary"
                        disabled={page >= meta.last_page}
                        onClick={() => load(page + 1)}
                        type="button"
                    >
                        Next
                    </button>
                </div>
            </SpinnerCard>
        </main>
    );
}

function AdminReportsScreen() {
    const { api, pushToast } = useContext(AuthContext);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [summary, setSummary] = useState(null);

    const loadSummary = async () => {
        try {
            const params = new URLSearchParams();
            if (from) {
                params.set('from', from);
            }
            if (to) {
                params.set('to', to);
            }
            const response = await api.get(`/admin/reports/summary?${params.toString()}`);
            setSummary(response.data.summary || null);
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Failed to load reports summary', 'err');
        }
    };

    useEffect(() => {
        loadSummary();
    }, []);

    const triggerDownload = (blob, filename) => {
        const url = window.URL.createObjectURL(new Blob([blob]));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    const exportSpins = async () => {
        try {
            const params = new URLSearchParams();
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            const response = await api.get(`/admin/reports/spins/export?${params.toString()}`, {
                responseType: 'blob',
            });
            triggerDownload(response.data, `spins-${from || 'all'}-${to || 'all'}.csv`);
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Failed to export spins', 'err');
        }
    };

    const exportTransactions = async () => {
        try {
            const params = new URLSearchParams();
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            const response = await api.get(`/admin/reports/transactions/export?${params.toString()}`, {
                responseType: 'blob',
            });
            triggerDownload(response.data, `transactions-${from || 'all'}-${to || 'all'}.csv`);
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Failed to export transactions', 'err');
        }
    };

    return (
        <main className="app-shell admin-page">
            <SpinnerCard title="Admin — Reports">
                <details className="admin-collapsible">
                    <summary>Date range & exports</summary>
                    <div className="admin-compact-form">
                        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
                        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
                        <button className="btn secondary" type="button" onClick={loadSummary}>
                            Load Summary
                        </button>
                        <div className="toolbar">
                            <button className="btn primary" type="button" onClick={exportSpins}>
                                Export Spins CSV
                            </button>
                            <button className="btn primary" type="button" onClick={exportTransactions}>
                                Export Transactions CSV
                            </button>
                        </div>
                    </div>
                </details>
                {summary ? (
                    <div className="status-grid">
                        <div className="status-chip">
                            <p>Total Spins</p>
                            <strong>{summary.spin.total_spins}</strong>
                        </div>
                        <div className="status-chip">
                            <p>Free Spins</p>
                            <strong>{summary.spin.free_spins}</strong>
                        </div>
                        <div className="status-chip">
                            <p>Paid Spins</p>
                            <strong>{summary.spin.paid_spins}</strong>
                        </div>
                        <div className="status-chip">
                            <p>Spins Awarded</p>
                            <strong>{summary.spin.total_awarded_points}</strong>
                        </div>
                        <div className="status-chip">
                            <p>Spins Spent</p>
                            <strong>{summary.spin.total_spent_points}</strong>
                        </div>
                        <div className="status-chip">
                            <p>Active Spinners</p>
                            <strong>{summary.spin.active_users_spun}</strong>
                        </div>
                        <div className="status-chip">
                            <p>Total Transactions</p>
                            <strong>{summary.transactions.total_transactions}</strong>
                        </div>
                        <div className="status-chip">
                            <p>Admin Adjustments</p>
                            <strong>{summary.transactions.admin_adjustments}</strong>
                        </div>
                    </div>
                ) : (
                    <p className="subtitle">Load a date range to see summary.</p>
                )}
            </SpinnerCard>
        </main>
    );
}

const root = document.getElementById('app');
if (root) {
    const paths = resolveClientBase();

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register(paths.swPath, { scope: paths.scope }).catch(() => {});
        });
    }

    createRoot(root).render(
        <AppErrorBoundary>
            <AppBaseContext.Provider value={paths}>
                <BrowserRouter basename={paths.basePath}>
                    <AppShell />
                </BrowserRouter>
            </AppBaseContext.Provider>
        </AppErrorBoundary>,
    );
}

