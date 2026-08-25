import './bootstrap';

import axios from 'axios';
import { calculateWheelRotation } from './wheelMath';
import { appTranslate } from './translations';
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
    announcement: null,
    refreshAppSettings: async () => {},
    refreshMe: async () => {},
    refreshSpinStatus: async () => {},
    refreshAnnouncement: async () => {},
    markAnnouncementRead: async () => {},
    toasts: [],
    pushToast: () => {},
    login: async () => {},
    logout: async () => {},
    language: 'en',
    setLanguage: () => {},
    t: (key) => key,
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
    if (name === 'coin') {
        return (
            <svg aria-hidden="true" className="app-icon coin-icon" width={size} height={size} viewBox="0 0 24 24">
                <circle className="coin-icon-edge" cx="12" cy="12" r="10" />
                <circle className="coin-icon-face" cx="12" cy="12" r="7.4" />
                <path className="coin-icon-shine" d="M7.2 8.7A6.2 6.2 0 0 1 11 6.2" />
                <path className="coin-icon-mark" d="M9.6 17V7.2h3.1a3.1 3.1 0 0 1 0 6.2H9.6m0-3.1h3.1" />
                <circle className="coin-icon-spark" cx="17.6" cy="7.1" r="1" />
            </svg>
        );
    }

    const paths = {
        home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v10h5v-6h3v6h5V10" /></>,
        bag: <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 9V7a3 3 0 0 1 6 0v2" /></>,
        user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
        bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" /><path d="M10 20h4" /></>,
        lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
        eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
        history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
        wheel: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2" /><path d="m12 3 1.5 7.2M20.6 9l-6.8 2.4M17.3 19l-4.2-5.5M6.7 19l4.2-5.5M3.4 9l6.8 2.4" /></>,
        settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
        content: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
        link: <><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" /></>,
        shield: <><path d="M12 3 5 6v5c0 4.8 2.8 8 7 10 4.2-2 7-5.2 7-10V6l-7-3Z" /><path d="m9.5 12 1.7 1.7 3.5-3.7" /></>,
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

function SocialIcon({ name, size = 26 }) {
    const paths = {
        facebook: <path d="M14.3 8.3h3V4.2c-.5-.1-2.2-.2-4.1-.2-4 0-6.7 2.4-6.7 6.9v3.8H2v4.6h4.5V31h5.6V19.3h4.6l.7-4.6h-5.3v-3.3c0-1.3.4-2.3 2.2-2.3Z" />,
        telegram: <path d="M29.2 3.2 2.9 13.4c-1.8.7-1.8 1.7-.3 2.2l6.8 2.1 2.6 8c.3.9.2 1.3 1.1 1.3.7 0 1-.3 1.4-.7l3.3-3.2 6.9 5.1c1.3.7 2.2.3 2.5-1.2l4.5-21.2c.5-1.9-.7-2.8-2.5-2.1ZM11.1 17.2l15.3-9.7c.8-.5 1.5-.2.9.3L14.7 19.2l-.5 5.2-3.1-7.2Z" />,
        viber: <><path d="M16 3C8.8 3 3 8.1 3 14.4c0 3.6 1.9 6.8 4.9 8.9l-1.3 5.4 5.5-2.8c1.2.3 2.5.5 3.9.5 7.2 0 13-5.1 13-12S23.2 3 16 3Z" /><path d="M11 9.4c.3-.7.8-.8 1.3-.8.4 0 .8 0 1.1.7l1.1 2.6c.2.5.1.9-.2 1.3l-.8 1c1 2 2.4 3.4 4.4 4.4l1-.8c.4-.3.8-.4 1.3-.2l2.6 1.1c.6.3.7.7.7 1.1 0 .5-.1 1-.8 1.3-.7.3-1.7.6-2.6.4-5.8-1-10.4-5.6-11.4-11.4-.2-.9.1-1.9.3-2.7Z" fill="#7360f2" /></>,
        tiktok: <path d="M23.6 7.1a7.5 7.5 0 0 1-4.4-4V3h-4.8v18.1a3.8 3.8 0 1 1-3.3-3.8c.4 0 .8.1 1.2.2v-4.9a8.6 8.6 0 1 0 6.9 8.5v-9.2a12.1 12.1 0 0 0 7.1 2.3V9.4a7.5 7.5 0 0 1-2.7-.5V7.1Z" />,
    };
    return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 32 32" fill="currentColor">{paths[name]}</svg>;
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
        spin_exchange: 'Points exchanged for spins',
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
    about_content: 'Moung Ba Yin is a points and rewards app.',
    how_to_use_terms: 'အပ်(ပ်)အသုံးပြုနည်း\n• အသုံးပြုသူအမည်နှင့် စကားဝှက်ဖြင့် လော့အင်ဝင်ပါ။\n• နေ့စဉ်ပွိုင့်ရယူပြီး ကံစမ်းဘီးကို လှည့်နိုင်ပါသည်။\n• ပွိုင့်ဝယ်ရန် အက်ဒမင်ကို ဆက်သွယ်ပါ။\n\nစည်းကမ်းချက်များ\n• တစ်ရက်လျှင် အခမဲ့တစ်ကြိမ် လှည့်နိုင်ပါသည်။\n• အပ်(ပ်)အတွင်းရှိ ပွိုင့်များကို ငွေသားအဖြစ် သတ်မှတ်မထားပါ။\n• အကူအညီလိုပါက အက်ဒမင်ကို ဆက်သွယ်ပါ။',
    daily_bonus_points: 20,
    daily_bonus_schedule: [20, 20, 20, 20, 20, 20, 20],
    home_ticker_text: 'Welcome to Moung Ba Yin • One free spin every day • Points-only rewards • Contact admin to exchange or buy points',
    home_board_text: 'One free spin every day\nPoints-only wheel rewards\nPaid spins use wallet points\nDaily bonus available once\nAll activity is recorded\nContact admin for points',
};

const DAILY_BONUS_WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function normalizeDailyBonusSchedule(settings, coerceNumbers = true) {
    if (Array.isArray(settings?.daily_bonus_schedule) && settings.daily_bonus_schedule.length === 7) {
        return settings.daily_bonus_schedule.map((points) => (
            coerceNumbers ? Math.max(0, Number(points) || 0) : points
        ));
    }

    return Array(7).fill(Math.max(0, Number(settings?.daily_bonus_points) || 0));
}

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

function urlBase64ToUint8Array(value) {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replaceAll('-', '+').replaceAll('_', '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

function browserSupportsWebPush() {
    return 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window;
}

async function syncGrantedPushSubscription(api, createIfMissing = true) {
    if (!browserSupportsWebPush() || Notification.permission !== 'granted') return false;

    const configResponse = await api.get('/push/config');
    if (!configResponse.data.configured || !configResponse.data.public_key) return false;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription && createIfMissing) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(configResponse.data.public_key),
        });
    }
    if (!subscription) return false;

    const serialized = subscription.toJSON();
    await api.post('/push/subscriptions', {
        endpoint: serialized.endpoint,
        keys: serialized.keys,
        content_encoding: 'aes128gcm',
    });

    return true;
}

function UserHeader({ onNotify }) {
    const { announcement, t } = useContext(AuthContext);
    const navigate = useNavigate();
    const [notificationsOpen, setNotificationsOpen] = useState(false);

    useEffect(() => {
        if (!notificationsOpen) return undefined;
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') setNotificationsOpen(false);
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [notificationsOpen]);

    const toggleNotifications = () => {
        if (!announcement) {
            onNotify?.();
            return;
        }
        setNotificationsOpen((current) => !current);
    };

    const openAnnouncement = () => {
        setNotificationsOpen(false);
        navigate('/announcement');
    };

    return (
        <>
            <header className="user-header">
                <div className="brand-lockup">
                    <img src="logotransparent.png" alt="မောင်းဘုရင်" />
                    <div>
                        <strong>မောင်းဘုရင်</strong>
                    </div>
                </div>
                <button className="icon-button notification-bell" type="button" aria-label={announcement ? t('open_announcement') : t('notifications_empty')} aria-expanded={notificationsOpen} onClick={toggleNotifications}>
                    <AppIcon name="bell" size={23} />
                    {announcement?.unread ? <i aria-label={t('new_announcement')} /> : null}
                </button>
            </header>
            {notificationsOpen && announcement ? (
                <>
                    <button className="notification-popover-backdrop" type="button" aria-label={t('close')} onClick={() => setNotificationsOpen(false)} />
                    <section className="notification-popover" aria-label={t('notifications')}>
                        <div className="notification-popover-heading">
                            <strong>{t('notifications')}</strong>
                            <span>1</span>
                        </div>
                        <button className={`notification-list-item ${announcement.unread ? 'unread' : ''}`} type="button" onClick={openAnnouncement}>
                            <span className="notification-list-icon"><AppIcon name="bell" size={19} /></span>
                            <span className="notification-list-copy">
                                <small>{announcement.unread ? t('new_announcement') : t('announcement')}</small>
                                <strong>{announcement.title}</strong>
                                <span>{announcementExcerpt(announcement.body, 90)}</span>
                            </span>
                            <AppIcon name="arrow" size={18} />
                        </button>
                    </section>
                </>
            ) : null}
        </>
    );
}

function announcementExcerpt(value, limit = 90) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return normalized.length > limit ? `${normalized.slice(0, limit).trim()}…` : normalized;
}

function BalancePill({ balance = 0 }) {
    const { t } = useContext(AuthContext);
    return (
        <div className="balance-pill">
            <AppIcon name="coin" size={22} />
            <strong>{formatPoints(balance)}</strong>
            <span>{t('points')}</span>
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

    if (code === 'INSUFFICIENT_SPINS') {
        return {
            type: 'warn',
            text: 'You need a spin credit. Exchange points for spins first.',
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
    const { language, t } = useContext(AuthContext);
    if (!record) {
        return null;
    }

    const transactionType = record.type || record.transaction_type;
    const translatedType = t(`tx_${transactionType}`);
    const title = translatedType === `tx_${transactionType}`
        ? humanizeTransactionType(transactionType)
        : translatedType;
    const amount = record.amount ?? null;
    const date = record.created_at
        ? new Date(record.created_at).toLocaleString(language === 'my' ? 'my-MM' : 'en-US')
        : null;
    const lines = [
        amount !== null ? [t('amount'), `${amount > 0 ? '+' : ''}${formatPoints(amount)} ${t('points')}`] : null,
        record.points_spent != null ? [t('spin_cost'), `${formatPoints(record.points_spent)} ${t('points')}`] : null,
        record.points_awarded != null ? [t('reward'), `+${formatPoints(record.points_awarded)} ${t('points')}`] : null,
        record.balance_after != null ? [t('balance_after'), `${formatPoints(record.balance_after)} ${t('points')}`] : null,
        record.spin_segment_label ? [t('wheel_segment'), record.spin_segment_label] : null,
        date ? [t('date_time'), date] : null,
        record.notes && record.notes.trim().toLowerCase() !== title.trim().toLowerCase()
            ? [t('note'), record.notes]
            : null,
    ].filter(Boolean);

    return (
        <div className="detail-overlay" role="dialog" aria-modal="true">
            <div className="detail-sheet">
                <div className="detail-header">
                    <strong>{title}</strong>
                    <button className="btn secondary" type="button" onClick={onClose}>
                        {t('close')}
                    </button>
                </div>
                <div className="detail-body">
                    {lines.map(([label, value]) => (
                        <p key={label}>
                            <strong>{label}:</strong> {String(value)}
                        </p>
                    ))}
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
    const { t } = useContext(AuthContext);
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
                    <button type="button" onClick={onClose} aria-label={t('close')}>×</button>
                </header>
                <div className="admin-modal-body">{children}</div>
            </section>
        </div>
    );
}

function ConfirmationDialog({ open, title, children, confirmLabel, onConfirm, onCancel, busy = false, checkbox = null }) {
    const { t } = useContext(AuthContext);

    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape' && !busy) onCancel();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, busy, onCancel]);

    if (!open) return null;

    return (
        <div className="confirmation-overlay" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) onCancel();
        }}>
            <section className="confirmation-dialog" role="dialog" aria-modal="true" aria-label={title}>
                <div className="confirmation-icon"><AppIcon name="wheel" size={28} /></div>
                <h2>{title}</h2>
                <div className="confirmation-copy">{children}</div>
                {checkbox}
                <div className="confirmation-actions">
                    <button className="btn secondary" type="button" disabled={busy} onClick={onCancel}>{t('cancel')}</button>
                    <button className="btn primary" type="button" disabled={busy} onClick={onConfirm}>{busy ? t('loading') : (confirmLabel || t('confirm'))}</button>
                </div>
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
        console.error('Moung Ba Yin screen error', error, info);
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
    const { logout, pushToast, t } = useContext(AuthContext);
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
                    <img src={`${basePath}/logotransparent.png`} alt="မောင်းဘုရင်" />
                    <span><strong>မောင်းဘုရင်</strong><small>{t('admin')}</small></span>
                </NavLink>
                <button className="admin-header-logout" type="button" onClick={signOut} disabled={signingOut}>
                    {signingOut ? t('logging_out') : t('logout')}
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
    const [announcement, setAnnouncement] = useState(null);
    const [spinStatusLoading, setSpinStatusLoading] = useState(false);
    const [language, setLanguageState] = useState(() => {
        const saved = window.localStorage.getItem('maung-bayin-language');
        return saved === 'my' ? 'my' : 'en';
    });

    const setLanguage = useCallback((nextLanguage) => {
        const normalized = nextLanguage === 'my' ? 'my' : 'en';
        window.localStorage.setItem('maung-bayin-language', normalized);
        document.documentElement.lang = normalized === 'my' ? 'my' : 'en';
        setLanguageState(normalized);
    }, []);
    const t = useCallback((key) => appTranslate(language, key), [language]);

    useEffect(() => {
        document.documentElement.lang = language === 'my' ? 'my' : 'en';
    }, [language]);

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

    const refreshAnnouncement = useCallback(async () => {
        try {
            const response = await api.get('/announcement');
            setAnnouncement(response.data.announcement || null);
            return response.data.announcement || null;
        } catch (error) {
            if (error?.response?.status === 401 || error?.response?.status === 403) {
                setAnnouncement(null);
                return null;
            }
            throw error;
        }
    }, [api]);

    const markAnnouncementRead = useCallback(async () => {
        const response = await api.post('/announcement/read');
        const nextAnnouncement = response.data.announcement || null;
        setAnnouncement(nextAnnouncement);
        return nextAnnouncement;
    }, [api]);

    useEffect(() => {
        const initialize = async () => {
            await refreshAppSettings().catch(() => {});
            try {
                const currentUser = await refreshMe();
                if (currentUser.role === 'user') {
                    await Promise.all([
                        refreshSpinStatus().catch(() => setSpinStatus(null)),
                        refreshAnnouncement().catch(() => setAnnouncement(null)),
                    ]);
                } else {
                    setSpinStatus(null);
                    setAnnouncement(null);
                }
            } catch {
                setMe(null);
                setSpinStatus(null);
            } finally {
                setLoading(false);
            }
        };

        initialize();
    }, [api, refreshAnnouncement, refreshAppSettings, refreshMe, refreshSpinStatus]);

    useEffect(() => {
        if (me?.role !== 'user') return undefined;

        const refreshIfVisible = () => {
            if (document.visibilityState === 'visible') refreshAnnouncement().catch(() => {});
        };
        const interval = window.setInterval(refreshIfVisible, 60000);
        document.addEventListener('visibilitychange', refreshIfVisible);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', refreshIfVisible);
        };
    }, [api, me?.role, refreshAnnouncement]);

    useEffect(() => {
        if (me?.role !== 'user' || !announcement?.unread) return;

        const storageKey = `mby-announcement-notice-${me.id}`;
        if (Number(window.localStorage.getItem(storageKey) || 0) >= Number(announcement.version || 0)) return;

        window.localStorage.setItem(storageKey, String(announcement.version || 0));
        pushToast(`${announcement.title} — ${announcementExcerpt(announcement.body, 55)}`, 'warn');
    }, [announcement?.body, announcement?.title, announcement?.unread, announcement?.version, me?.id, me?.role, pushToast]);

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return undefined;
        const onServiceWorkerMessage = (event) => {
            if (event.data?.type === 'ANNOUNCEMENT_UPDATED' && me?.role === 'user') {
                refreshAnnouncement().catch(() => {});
            } else if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED' && me?.role === 'user') {
                syncGrantedPushSubscription(api).catch(() => {});
            }
        };
        navigator.serviceWorker.addEventListener('message', onServiceWorkerMessage);
        return () => navigator.serviceWorker.removeEventListener('message', onServiceWorkerMessage);
    }, [me?.role, refreshAnnouncement]);

    useEffect(() => {
        if (me?.role === 'user') syncGrantedPushSubscription(api).catch(() => {});
    }, [api, me?.id, me?.role]);

    const login = async ({ identifier, password, rememberMe, portalRole = 'user' }) => {
        await axios.get(`${basePath}/sanctum/csrf-cookie`, {
            withCredentials: true,
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
            },
        });
        const endpoint = portalRole === 'admin' ? '/auth/admin/login' : '/auth/login';
        const credentials = portalRole === 'admin'
            ? { email_or_phone: normalizeEmailOrPhone(identifier) }
            : { username: String(identifier || '').trim().toLowerCase() };
        const response = await api.post(endpoint, {
            ...credentials,
            password,
            remember_me: rememberMe,
        });
        setMe(response.data.user);
        const refreshes = [refreshAppSettings()];
        if (response.data.user.role === 'user') {
            refreshes.push(refreshSpinStatus(), refreshAnnouncement());
        }
        await Promise.all(refreshes);
        return response.data;
    };

    const logout = async () => {
        await api.post('/auth/logout');
        setMe(null);
        setSpinStatus(null);
        setAnnouncement(null);
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
                announcement,
                refreshAppSettings,
                refreshMe,
                refreshSpinStatus,
                refreshAnnouncement,
                markAnnouncementRead,
                toasts,
                pushToast,
                login,
                logout,
                language,
                setLanguage,
                t,
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
                            element={<Navigate to="/exchange-spins" replace />}
                        />
                        <Route
                            path="/exchange-spins"
                            element={
                                <ProtectedRoute user={me} roles={['user']}>
                                    <ExchangeSpinsScreen />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/betting-sites"
                            element={
                                <ProtectedRoute user={me} roles={['user']}>
                                    <BettingSitesScreen />
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
                            path="/announcement"
                            element={
                                <ProtectedRoute user={me} roles={['user']}>
                                    <AnnouncementScreen />
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
                            path="/admin/betting-sites"
                            element={
                                <AdminRoute user={me}>
                                    <AdminBettingSitesScreen />
                                </AdminRoute>
                            }
                        />
                        <Route
                            path="/admin/announcement"
                            element={
                                <AdminRoute user={me}>
                                    <AdminAnnouncementScreen />
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
    const { me, t } = useContext(AuthContext);
    const location = useLocation();
    if (!me || location.pathname === '/login' || location.pathname === '/admin/login') {
        return null;
    }
    if (me.role === 'admin') {
        return (
            <nav className="bottom-nav" aria-label="Admin navigation">
                <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'active' : '')}>
                    <AppIcon name="home" size={25} />
                    <span>{t('overview')}</span>
                </NavLink>
                <NavLink to="/admin/users" className={({ isActive }) => (isActive ? 'active' : '')}>
                    <AppIcon name="user" size={25} />
                    <span>{t('users')}</span>
                </NavLink>
                <NavLink to="/admin/spin-config" className={({ isActive }) => (isActive ? 'active' : '')}>
                    <AppIcon name="wheel" size={25} />
                    <span>{t('wheel')}</span>
                </NavLink>
                <NavLink to="/admin/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
                    <AppIcon name="settings" size={25} />
                    <span>{t('settings')}</span>
                </NavLink>
            </nav>
        );
    }
    return (
        <nav className="bottom-nav" aria-label="Main navigation">
            <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
                <AppIcon name="home" size={25} />
                <span>{t('home')}</span>
            </NavLink>
            <NavLink to="/spin" className={({ isActive }) => (isActive ? 'active' : '')}>
                <AppIcon name="wheel" size={25} />
                <span>{t('play')}</span>
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
                <AppIcon name="user" size={25} />
                <span>{t('settings')}</span>
            </NavLink>
        </nav>
    );
}

function LoginScreen({ portalRole = 'user', switchingAccount = false }) {
    const { login, pushToast, appSettings, language, setLanguage, t } = useContext(AuthContext);
    const { basePath } = useContext(AppBaseContext);
    const navigate = useNavigate();
    const isAdminPortal = portalRole === 'admin';
    const [form, setForm] = useState({
        identifier: '',
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
                <img src={`${basePath}/logotransparent.png`} alt="မောင်းဘုရင် logo" />
                <h1>{isAdminPortal ? `မောင်းဘုရင် ${t('admin')}` : t('welcome')}</h1>
                <p>{isAdminPortal ? t('admin_login_intro') : t('login_intro')}</p>
            </section>
            <section className="login-panel">
                <div className="login-panel-inner">
                    <p className="login-kicker">{isAdminPortal ? t('administrator_access') : t('member_access')}</p>
                    <h2>{isAdminPortal ? t('admin_login') : t('user_login')}</h2>
                    {isAdminPortal ? (
                        <div className="login-language-picker" role="group" aria-label={t('language')}>
                            <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>EN</button>
                            <button type="button" className={language === 'my' ? 'active' : ''} onClick={() => setLanguage('my')}>မြန်မာ</button>
                        </div>
                    ) : null}
                    {switchingAccount ? <p className="portal-session-note">{t('switching_account')}</p> : null}
                    <form className="login-form" onSubmit={onSubmit}>
                        <label className="login-input-wrap">
                            <AppIcon name="user" size={24} />
                            <span className="sr-only">{isAdminPortal ? t('email_or_phone') : t('username')}</span>
                            <input
                                value={form.identifier}
                                onChange={(event) =>
                                    setForm((prev) => ({ ...prev, identifier: event.target.value }))
                                }
                                placeholder={isAdminPortal ? t('email_or_phone') : t('username')}
                                autoComplete="username"
                                required
                            />
                        </label>
                        <label className="login-input-wrap">
                            <AppIcon name="lock" size={24} />
                            <span className="sr-only">{t('password')}</span>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={form.password}
                                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                                placeholder={t('password')}
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
                        {!isAdminPortal ? (
                            <button
                                className="create-account-link"
                                type="button"
                                onClick={() => openSocial(appSettings?.telegram_contact_url, 'Telegram')}
                            >
                                <SocialIcon name="telegram" size={18} />
                                {t('create_account')}
                            </button>
                        ) : null}
                        <label className="remember-row">
                            <input
                                type="checkbox"
                                checked={form.rememberMe}
                                onChange={(event) => setForm((prev) => ({ ...prev, rememberMe: event.target.checked }))}
                            />
                            <span>{t('remember_me')}</span>
                        </label>
                        <button className="login-button" type="submit" disabled={submitting}>
                            {submitting ? t('signing_in') : (isAdminPortal ? t('admin_login') : t('user_login'))}
                        </button>
                    </form>
                    {isAdminPortal ? (
                        <NavLink className="portal-switch-link" to="/login">{t('go_user_login')}</NavLink>
                    ) : null}
                    <div className="login-follow">
                        <span />
                        <p>{isAdminPortal ? 'follow for more' : t('follow_more')}</p>
                        <span />
                    </div>
                    <div className="social-row" aria-label="Social links">
                        <button className="facebook" type="button" aria-label="Facebook" onClick={() => openSocial(appSettings?.facebook_page_url, 'Facebook')}><SocialIcon name="facebook" /></button>
                        <button className="telegram" type="button" aria-label="Telegram" onClick={() => openSocial(appSettings?.telegram_channel_url, 'Telegram')}><SocialIcon name="telegram" /></button>
                        <button className="tiktok" type="button" aria-label="TikTok" onClick={() => openSocial(appSettings?.tiktok_channel_url, 'TikTok')}><SocialIcon name="tiktok" /></button>
                    </div>
                    <p className="login-footnote">{isAdminPortal ? t('authorized_admins_only') : t('accounts_by_admin')}</p>
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
    const { api, appSettings, announcement, t } = useContext(AuthContext);
    const { spinStatus, pushToast } = useSpinStatus();
    const navigate = useNavigate();
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

    const tickerText = String(appSettings?.home_ticker_text || DEFAULT_APP_SETTINGS.home_ticker_text);
    const boardItems = splitSettingLines(appSettings?.home_board_text || DEFAULT_APP_SETTINGS.home_board_text);
    const phoneNumbers = splitSettingLines(
        appSettings?.contact_phone_numbers
            || appSettings?.contact_phone
            || DEFAULT_APP_SETTINGS.contact_phone_numbers,
    );
    const currentBalance = wallet?.balance ?? spinStatus?.wallet_balance ?? 0;

    return (
        <main className="app-shell user-page home-page">
            <UserHeader onNotify={() => pushToast(t('notifications_empty'), 'ok')} />

            {announcement ? (
                <button className={`announcement-headline ${announcement.unread ? 'unread' : ''}`} type="button" onClick={() => navigate('/announcement')}>
                    <span><AppIcon name="bell" size={17} />{announcement.unread ? t('new_announcement') : t('announcement')}</span>
                    <strong>{announcement.title}</strong>
                    <p>{announcementExcerpt(announcement.body, 105)}</p>
                    <AppIcon name="arrow" size={18} />
                </button>
            ) : null}

            <section className="announcement-board">
                <img src="logotransparent.png" alt="" aria-hidden="true" />
                <div className="announcement-grid">
                    {boardItems.map((item, index) => (
                        <div key={`${index}-${item}`}><span>◆</span>{item}</div>
                    ))}
                </div>
            </section>

            <div className="announcement-ticker" aria-label={tickerText}>
                <div className="ticker-track">
                    <span>{tickerText}</span>
                    <span aria-hidden="true">{tickerText}</span>
                </div>
            </div>

            <section className="account-points-card">
                <div>
                    <span>{t('current_points')}</span>
                    <strong className="home-points-value"><i><AppIcon name="coin" size={25} /></i>{formatPoints(currentBalance)} {t('points')}</strong>
                </div>
                <div>
                    <span>{t('username')}</span>
                    <strong>{me?.username || '—'}</strong>
                </div>
            </section>

            <section className="play-bet-card">
                <div className="play-bet-copy">
                    <span>{t('outside_website')}</span>
                    <strong>{appSettings?.play_bet_label || DEFAULT_APP_SETTINGS.play_bet_label}</strong>
                </div>
                <button type="button" onClick={() => navigate('/betting-sites')}>
                    Play <AppIcon name="arrow" size={19} />
                </button>
            </section>

            <section className="exchange-card">
                <div className="exchange-heading">
                    <div>
                        <span>{t('contact_admin')}</span>
                        <h2>{t('exchange_points')}</h2>
                    </div>
                    <AppIcon name="coin" size={28} />
                </div>
                <div className="exchange-actions">
                    <button className="telegram" type="button" onClick={() => openExternal(appSettings?.telegram_contact_url, 'Telegram')}>
                        <SocialIcon name="telegram" size={21} /> Telegram
                    </button>
                    <button className="viber" type="button" onClick={() => openExternal(appSettings?.viber_contact_url, 'Viber')}>
                        <SocialIcon name="viber" size={21} /> Viber
                    </button>
                </div>
                <div className="contact-phone-list" aria-label="Contact phone numbers">
                    <span>{t('phone_numbers')}</span>
                    {phoneNumbers.map((phone, index) => (
                        <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} key={`${index}-${phone}`}>{phone}</a>
                    ))}
                </div>
            </section>
            {loading ? <p className="page-loading">{t('loading_account')}</p> : null}
        </main>
    );
}

function BettingSitesScreen() {
    const { api, pushToast, t } = useContext(AuthContext);
    const navigate = useNavigate();
    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        api.get('/betting-sites')
            .then((response) => {
                if (active) setSites(response.data.sites || []);
            })
            .catch((error) => {
                if (active) pushToast(error?.response?.data?.message || t('failed_load_betting_sites'), 'err');
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [api, pushToast, t]);

    const openSite = (site) => {
        const url = safeExternalUrl(site.url);
        if (!url) {
            pushToast(t('website_link_unavailable'), 'warn');
            return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <main className="app-shell user-page sub-page betting-sites-page">
            <UserHeader onNotify={() => pushToast(t('notifications_empty'), 'ok')} />
            <div className="betting-sites-heading">
                <span>{t('play_betting')}</span>
                <h1>{t('choose_betting_site')}</h1>
                <p>{t('betting_sites_help')}</p>
            </div>
            {loading ? <p className="page-loading">{t('loading_betting_sites')}</p> : null}
            {!loading && sites.length === 0 ? <section className="betting-sites-empty">{t('no_betting_sites')}</section> : null}
            <section className="betting-sites-list">
                {sites.map((site) => (
                    <article className="betting-site-card" key={site.id}>
                        <span className="betting-site-icon"><AppIcon name="link" size={23} /></span>
                        <div>
                            <small>{site.name}</small>
                            <strong>{site.display_text}</strong>
                        </div>
                        <button type="button" onClick={() => openSite(site)}>
                            {site.button_text || t('play')} <AppIcon name="arrow" size={17} />
                        </button>
                    </article>
                ))}
            </section>
            <button className="back-pill" type="button" onClick={() => navigate('/dashboard')}>{t('back_home')}</button>
        </main>
    );
}

function ExchangeSpinsScreen() {
    const { api, appSettings, refreshSpinStatus, pushToast, t } = useContext(AuthContext);
    const navigate = useNavigate();
    const [packages, setPackages] = useState([]);
    const [pointBalance, setPointBalance] = useState(0);
    const [spinBalance, setSpinBalance] = useState(0);
    const [busyId, setBusyId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pendingPackage, setPendingPackage] = useState(null);
    const exchangeBusyRef = useRef(false);

    const load = async () => {
        setLoading(true);
        try {
            const response = await api.get('/spin-exchange-packages');
            setPackages(response.data.packages || []);
            setPointBalance(response.data.wallet_balance || 0);
            setSpinBalance(response.data.spin_balance || 0);
        } catch (error) {
            pushToast(error?.response?.data?.message || 'Could not load spin packages', 'err');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const exchange = async (item) => {
        if (exchangeBusyRef.current) return;
        exchangeBusyRef.current = true;
        setBusyId(item.id);
        try {
            const requestKey = window.crypto?.randomUUID?.() || `exchange-${Date.now()}-${Math.random()}`;
            const response = await api.post(`/spin-exchange-packages/${item.id}/exchange`, null, {
                headers: { 'Idempotency-Key': requestKey },
            });
            setPointBalance(response.data.wallet_balance);
            setSpinBalance(response.data.spin_balance);
            await refreshSpinStatus();
            pushToast(t('exchange_success'), 'ok');
        } catch (error) {
            pushToast(error?.response?.data?.message || t('not_enough'), 'warn');
        } finally {
            exchangeBusyRef.current = false;
            setBusyId(null);
            setPendingPackage(null);
        }
    };

    const openTelegram = () => {
        const url = safeExternalUrl(appSettings?.telegram_contact_url);
        if (!url) return pushToast('Telegram link is not configured yet.', 'warn');
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <main className="app-shell user-page buy-page exchange-spins-page">
            <UserHeader onNotify={() => pushToast(t('notifications_empty'), 'ok')} />
            <div className="section-heading-row">
                <div><span>{t('spin_packages')}</span><h1>{t('exchange_spins')}</h1></div>
                <BalancePill balance={pointBalance} />
            </div>
            <div className="spin-credit-pill"><AppIcon name="wheel" size={20} /> {formatPoints(spinBalance)} {t('spins')}</div>
            <p className="exchange-help">{t('exchange_spins_help')}</p>
            {loading ? <p className="page-loading">{t('loading')}</p> : null}
            {!loading && packages.length === 0 ? <p className="exchange-help">{t('no_exchange_packages')}</p> : null}
            <section className="exchange-package-list">
                {packages.map((item) => (
                    <article className="exchange-package-card" key={item.id}>
                        <div className="package-art"><AppIcon name="wheel" size={30} /></div>
                        <div><strong>{formatPoints(item.points_cost)} {t('points')}</strong><span>{formatPoints(item.spins_amount)} {t('spins')}</span></div>
                        <button type="button" disabled={busyId !== null || pointBalance < item.points_cost} onClick={() => setPendingPackage(item)}>
                            {busyId === item.id ? t('exchanging') : t('exchange')}
                        </button>
                    </article>
                ))}
            </section>
            <button className="buy-points-telegram-card" type="button" onClick={openTelegram}>
                <AppIcon name="bag" size={25} /><span><strong>{t('buy_points_telegram')}</strong><small>Telegram</small></span><AppIcon name="arrow" size={19} />
            </button>
            <button className="back-pill" type="button" onClick={() => navigate('/spin')}>{t('back_to_wheel')}</button>
            <ConfirmationDialog
                open={Boolean(pendingPackage)}
                title={t('confirm_exchange')}
                confirmLabel={t('exchange')}
                busy={busyId !== null}
                onCancel={() => setPendingPackage(null)}
                onConfirm={() => pendingPackage && exchange(pendingPackage)}
            >
                <strong className="confirmation-exchange-value">
                    {formatPoints(pendingPackage?.points_cost || 0)} {t('points')} → {formatPoints(pendingPackage?.spins_amount || 0)} {t('spins')}
                </strong>
                <p>{t('exchange_deduct_notice')}</p>
            </ConfirmationDialog>
        </main>
    );
}

function AnnouncementScreen() {
    const { announcement, refreshAnnouncement, markAnnouncementRead, pushToast, language, t } = useContext(AuthContext);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(!announcement);

    useEffect(() => {
        let active = true;
        const open = async () => {
            try {
                const current = announcement || await refreshAnnouncement();
                if (current) await markAnnouncementRead();
            } catch (error) {
                if (active) pushToast(error?.response?.data?.message || t('announcement_load_failed'), 'err');
            } finally {
                if (active) setLoading(false);
            }
        };
        open();
        return () => { active = false; };
    }, []);

    return (
        <main className="app-shell user-page sub-page announcement-page">
            <UserHeader onNotify={() => pushToast(t('notifications_empty'), 'ok')} />
            <section className="announcement-full-card">
                {loading ? <p className="page-loading">{t('loading')}</p> : null}
                {!loading && !announcement ? <p className="announcement-empty">{t('no_announcement')}</p> : null}
                {announcement ? (
                    <>
                        <span className="announcement-kicker"><AppIcon name="bell" size={18} />{t('announcement')}</span>
                        <h1>{announcement.title}</h1>
                        <small>{t('published_on')} {new Date(announcement.published_at).toLocaleString(language === 'my' ? 'my-MM' : 'en-US')}</small>
                        <div className="announcement-body">{announcement.body}</div>
                    </>
                ) : null}
            </section>
            <button className="back-pill" type="button" onClick={() => navigate('/dashboard')}>{t('back_home')}</button>
        </main>
    );
}

function SettingsScreen() {
    const { api, me, spinStatus, appSettings, logout, pushToast, language, setLanguage, t } = useContext(AuthContext);
    const navigate = useNavigate();
    const [signingOut, setSigningOut] = useState(false);
    const [aboutOpen, setAboutOpen] = useState(false);
    const [termsOpen, setTermsOpen] = useState(false);
    const [pushState, setPushState] = useState('checking');
    const [pushBusy, setPushBusy] = useState(false);

    const browserSubscription = async () => {
        const registration = await navigator.serviceWorker.ready;
        return {
            registration,
            subscription: await registration.pushManager.getSubscription(),
        };
    };

    const savePushSubscription = async (subscription) => {
        const serialized = subscription.toJSON();
        await api.post('/push/subscriptions', {
            endpoint: serialized.endpoint,
            keys: serialized.keys,
            content_encoding: 'aes128gcm',
        });
    };

    useEffect(() => {
        let active = true;
        const check = async () => {
            if (!browserSupportsWebPush()) {
                if (active) setPushState('unsupported');
                return;
            }
            try {
                const response = await api.get('/push/config');
                if (!response.data.configured) {
                    if (active) setPushState('unavailable');
                    return;
                }
                if (Notification.permission === 'denied') {
                    if (active) setPushState('blocked');
                    return;
                }
                const { subscription } = await browserSubscription();
                if (subscription && Notification.permission === 'granted') {
                    await savePushSubscription(subscription);
                    if (active) setPushState('enabled');
                } else if (active) {
                    setPushState('disabled');
                }
            } catch {
                if (active) setPushState('unavailable');
            }
        };
        check();
        return () => { active = false; };
    }, [api]);

    const enablePushNotifications = async () => {
        if (!browserSupportsWebPush()) {
            setPushState('unsupported');
            return;
        }
        setPushBusy(true);
        try {
            const configResponse = await api.get('/push/config');
            if (!configResponse.data.configured || !configResponse.data.public_key) {
                setPushState('unavailable');
                pushToast(t('push_unavailable'), 'warn');
                return;
            }
            const permission = Notification.permission === 'granted'
                ? 'granted'
                : await Notification.requestPermission();
            if (permission !== 'granted') {
                setPushState(permission === 'denied' ? 'blocked' : 'disabled');
                pushToast(t('notification_permission_not_granted'), 'warn');
                return;
            }
            const { registration, subscription: existingSubscription } = await browserSubscription();
            const subscription = existingSubscription || await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(configResponse.data.public_key),
            });
            await savePushSubscription(subscription);
            setPushState('enabled');
            pushToast(t('notifications_enabled'), 'ok');
        } catch (error) {
            setPushState(Notification.permission === 'denied' ? 'blocked' : 'disabled');
            pushToast(error?.response?.data?.message || t('notifications_enable_failed'), 'err');
        } finally {
            setPushBusy(false);
        }
    };

    const disablePushNotifications = async () => {
        setPushBusy(true);
        try {
            const { subscription } = await browserSubscription();
            if (subscription) {
                await api.delete('/push/subscriptions', { data: { endpoint: subscription.endpoint } });
                await subscription.unsubscribe();
            }
            setPushState('disabled');
            pushToast(t('notifications_disabled'), 'ok');
        } catch (error) {
            pushToast(error?.response?.data?.message || t('notifications_disable_failed'), 'err');
        } finally {
            setPushBusy(false);
        }
    };

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
        { label: t('how_to_use_terms'), icon: 'content', action: () => setTermsOpen(true) },
        { label: t('daily_bonus'), icon: 'coin', action: () => navigate('/daily-bonus') },
        { label: t('transaction_history'), icon: 'history', action: () => navigate('/history') },
    ];

    return (
        <main className="app-shell user-page settings-page">
            <UserHeader onNotify={() => pushToast(t('notifications_empty'), 'ok')} />

            <section className="profile-card">
                <div className="profile-avatar"><img src="logo.png" alt="" /></div>
                <div className="profile-details">
                    <span>{t('your_account')}</span>
                    <strong>{me?.name || 'မောင်းဘုရင် player'}</strong>
                    <p>{me?.username ? `@${me.username}` : t('member_account')}</p>
                    <div><AppIcon name="coin" size={20} /> {formatPoints(spinStatus?.wallet_balance || 0)} {t('points')}</div>
                </div>
            </section>

            <section className="settings-card">
                <p className="settings-label">{t('account_gameplay')}</p>
                {menuItems.map((item) => (
                    <button className="settings-row" type="button" onClick={item.action} key={item.label}>
                        <span className="settings-row-icon"><AppIcon name={item.icon} size={21} /></span>
                        <strong>{item.label}</strong>
                        <AppIcon name="arrow" size={20} />
                    </button>
                ))}
            </section>

            <section className="settings-card">
                <p className="settings-label">{t('language')}</p>
                <div className="language-picker" role="group" aria-label={t('language')}>
                    <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>{t('english')}</button>
                    <button type="button" className={language === 'my' ? 'active' : ''} onClick={() => setLanguage('my')}>{t('burmese')}</button>
                </div>
            </section>

            <section className="settings-card notification-settings-card">
                <p className="settings-label">{t('notifications')}</p>
                <div className="notification-setting-summary">
                    <span className={`notification-state ${pushState}`}><AppIcon name="bell" size={20} /></span>
                    <div><strong>{t(`push_state_${pushState}`)}</strong><small>{t('push_notifications_help')}</small></div>
                </div>
                {pushState === 'blocked' ? <p className="notification-support-note">{t('push_blocked_help')}</p> : null}
                {pushState === 'unsupported' ? <p className="notification-support-note">{t('push_ios_install_help')}</p> : null}
                {pushState === 'enabled' ? (
                    <button className="btn secondary notification-toggle" type="button" disabled={pushBusy} onClick={disablePushNotifications}>{t('disable_notifications')}</button>
                ) : (
                    <button className="btn primary notification-toggle" type="button" disabled={pushBusy || pushState === 'blocked' || pushState === 'unsupported' || pushState === 'unavailable' || pushState === 'checking'} onClick={enablePushNotifications}>{pushBusy ? t('loading') : t('allow_notifications')}</button>
                )}
            </section>

            <section className="settings-card">
                <p className="settings-label">{t('connect')}</p>
                <button className="settings-row" type="button" onClick={() => openConfiguredLink(appSettings?.telegram_channel_url, 'Telegram channel')}>
                    <strong>{t('telegram_channel')}</strong><AppIcon name="arrow" size={20} />
                </button>
                <button className="settings-row" type="button" onClick={() => openConfiguredLink(appSettings?.facebook_page_url, 'Facebook page')}>
                    <strong>{t('facebook_page')}</strong><AppIcon name="arrow" size={20} />
                </button>
                <button className="settings-row" type="button" onClick={() => openConfiguredLink(appSettings?.tiktok_channel_url, 'TikTok channel')}>
                    <strong>{t('tiktok_channel')}</strong><AppIcon name="arrow" size={20} />
                </button>
                <button className="settings-row" type="button" onClick={() => setAboutOpen(true)}>
                    <strong>{t('about_app')}</strong><AppIcon name="arrow" size={20} />
                </button>
                <button className="settings-row logout-row" type="button" onClick={signOut} disabled={signingOut}>
                    <span className="settings-row-icon"><AppIcon name="logout" size={21} /></span>
                    <strong>{signingOut ? t('logging_out') : t('logout')}</strong>
                </button>
            </section>

            <p className="app-version">မောင်းဘုရင် PWA · version 1.0</p>
            {termsOpen ? (
                <div className="detail-overlay centered-overlay" role="dialog" aria-modal="true" aria-label={t('how_to_use_terms')}>
                    <section className="info-modal terms-modal">
                        <h2>{t('how_to_use_terms')}</h2>
                        <div className="terms-copy">
                            {appSettings?.how_to_use_terms || t('terms_content_missing')}
                        </div>
                        <button className="btn primary" type="button" onClick={() => setTermsOpen(false)}>{t('close')}</button>
                    </section>
                </div>
            ) : null}
            {aboutOpen ? (
                <div className="detail-overlay centered-overlay" role="dialog" aria-modal="true" aria-label="About this app">
                    <section className="info-modal">
                        <img src="logo.png" alt="" />
                        <h2>{t('about_app')}</h2>
                        <p>{appSettings?.about_content || DEFAULT_APP_SETTINGS.about_content}</p>
                        <button className="btn primary" type="button" onClick={() => setAboutOpen(false)}>{t('close')}</button>
                    </section>
                </div>
            ) : null}
        </main>
    );
}

function DailyBonusScreen() {
    const { api, pushToast, t } = useContext(AuthContext);
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
            <UserHeader onNotify={() => pushToast(t('notifications_empty'), 'ok')} />
            <SpinnerCard title={t('daily_bonus')}>
                <p className="subtitle">{t('daily_claim_once')}</p>
                <div className="spacer">
                    <button className="btn primary" onClick={claim} disabled={busy}>
                        {busy ? t('claiming') : t('claim_now')}
                    </button>
                </div>
                {message ? <p className="message ok spacer">{message}</p> : null}
            </SpinnerCard>
        </main>
    );
}

function SpinWheel({ size, segments, rotation, transitionMs = 2200, centerLabel = 'LUCKY', centerActionLabel, centerActionSubLabel, onCenterAction, centerDisabled = false }) {
    const { t } = useContext(AuthContext);
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
        { id: 'one', points_reward: 5 },
        { id: 'two', points_reward: 10 },
        { id: 'three', points_reward: 20 },
        { id: 'four', points_reward: 50 },
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
                            key={segment.id || index}
                            style={{
                                transform: `translate(-50%, -50%) rotate(${index * labelAngle + labelAngle / 2}deg) translateY(-${Math.round(size * 0.34)}px) rotate(${-index * labelAngle - labelAngle / 2}deg)`,
                                color: segment.text_color || '#ffffff',
                            }}
                        >
                            <small>
                                {formatPoints(segment.reward_amount ?? segment.points_reward ?? 0)}{' '}
                                {segment.reward_type === 'spins' ? t('spins') : t('points')}
                            </small>
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
    const { api, spinStatus, refreshSpinStatus, pushToast, appSettings, t } = useContext(AuthContext);
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
    const [pendingSpinType, setPendingSpinType] = useState(null);
    const [skipFutureSpinConfirmation, setSkipFutureSpinConfirmation] = useState(false);
    const intervalRef = useRef(null);
    const spinResultTimeoutRef = useRef(null);
    const spinBusyRef = useRef(false);

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
        if (spinBusyRef.current || busy) {
            return;
        }
        spinBusyRef.current = true;
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
                    awardType: event.reward_type || 'points',
                    amount: event.reward_amount ?? event.points_awarded,
                    balanceAfter,
                    spinBalanceAfter: event.spin_balance_after,
                });
                setBusy(false);
                setSpinning(false);
                spinBusyRef.current = false;
                refreshSpinStatus();
                pushToast(`You won ${event.reward_amount ?? event.points_awarded} ${event.reward_type === 'spins' ? 'spins' : 'points'}`, 'ok');
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
            spinBusyRef.current = false;
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

    const requestSpin = (type) => {
        let skipConfirmation = false;
        try {
            skipConfirmation = window.localStorage.getItem('mby.skipSpinConfirmation.v1') === '1';
        } catch {
            skipConfirmation = false;
        }

        if (skipConfirmation) {
            runSpin(type);
            return;
        }

        setSkipFutureSpinConfirmation(false);
        setPendingSpinType(type);
    };

    const confirmPendingSpin = () => {
        const type = pendingSpinType;
        if (!type) return;

        if (skipFutureSpinConfirmation) {
            try {
                window.localStorage.setItem('mby.skipSpinConfirmation.v1', '1');
            } catch {
                // Storage can be unavailable in private/restricted browser modes.
            }
        }

        setPendingSpinType(null);
        setSkipFutureSpinConfirmation(false);
        runSpin(type);
    };

    useEffect(() => {
        return () => {
            if (spinResultTimeoutRef.current) {
                clearTimeout(spinResultTimeoutRef.current);
            }
        };
    }, []);

    const spinBalance = Number(localStatus?.spin_balance) || 0;
    const hasSpinCredit = spinBalance > 0;
    const centerDisabled = busy || spinning || !localStatus?.config;
    const centerActionLabel = spinning
        ? t('spinning')
        : localStatus?.can_free_spin_today
          ? t('free_spin')
          : hasSpinCredit
            ? `${t('spin_singular')} × ${formatPoints(spinBalance)}`
            : t('not_enough_spins');
    const centerActionSubLabel = spinning
        ? ''
        : localStatus?.can_free_spin_today
          ? t('today')
          : hasSpinCredit ? '' : t('get_spins');

    const handleCenterSpinAction = () => {
        if (busy || spinning) {
            return;
        }
        if (localStatus?.can_free_spin_today) {
            requestSpin('free');
            return;
        }
        if (!hasSpinCredit) {
            navigate('/exchange-spins');
            return;
        }
        if ((cooldownRemaining || 0) > 0) {
            pushToast(`Please wait ${formatTimeRemaining(cooldownRemaining)}`, 'warn');
            return;
        }
        requestSpin('paid');
    };

    const openTelegram = () => {
        const url = safeExternalUrl(appSettings?.telegram_contact_url);
        if (!url) {
            pushToast('Telegram link is not configured yet.', 'warn');
            return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
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
            <UserHeader onNotify={() => pushToast(t('notifications_empty'), 'ok')} />
            <SpinnerCard title={localStatus?.config?.name || t('spin_wheel')}>
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
                            <span>{t('spin_packages')}</span>
                            <strong>{t('exchange_spins')}</strong>
                        </div>
                        <button type="button" onClick={() => navigate('/exchange-spins')}>{t('exchange')}</button>
                    </section>
                    <button className="spin-buy-points-link" type="button" onClick={openTelegram}>
                        <AppIcon name="bag" size={21} /> {t('buy_points_telegram')}
                    </button>
                    <section className="daily-card spin-daily-card">
                        <div className="daily-card-heading">
                            <div>
                                <span>{t('daily_bonus')}</span>
                                <h2>{t('daily_checkin')}</h2>
                            </div>
                            <strong className={`daily-status ${localStatus?.can_claim_daily_bonus ? 'ready' : ''}`}>
                                {localStatus?.can_claim_daily_bonus ? t('ready') : t('claimed')}
                            </strong>
                        </div>
                        <div className="daily-week-grid" aria-label={t('daily_points_schedule')}>
                            {(localStatus?.daily_bonus_week || []).map((day) => (
                                <article className={`daily-week-day ${day.status}`} key={day.date} title={`${day.weekday}: ${day.points} ${t('points')}`}>
                                    <span>{t('day')} {day.day}</span>
                                    <strong>+{formatPoints(day.points)}</strong>
                                    <small>{t(day.status)}</small>
                                </article>
                            ))}
                        </div>
                        <button className="collect-button" type="button" onClick={claimDailyPoints} disabled={claimBusy || !localStatus?.can_claim_daily_bonus}>
                            {claimBusy ? t('claiming') : localStatus?.can_claim_daily_bonus ? t('claim_points') : t('claimed_today')}
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
                            <h2>{t('won')}</h2>
                            <strong className="win-points">+{formatPoints(winModal.amount)} {winModal.awardType === 'spins' ? t('spins') : t('points')}</strong>
                            <small>{t('new_balance')}: {formatPoints(winModal.awardType === 'spins' ? winModal.spinBalanceAfter : winModal.balanceAfter)} {winModal.awardType === 'spins' ? t('spins') : t('points')}</small>
                            <button className="btn primary" type="button" onClick={() => setWinModal(null)}>{t('awesome')}</button>
                        </section>
                    </div>
                ) : null}
                <ConfirmationDialog
                    open={Boolean(pendingSpinType)}
                    title={t('confirm_spin')}
                    confirmLabel={pendingSpinType === 'free' ? t('free_spin') : t('spin_singular')}
                    onCancel={() => {
                        setPendingSpinType(null);
                        setSkipFutureSpinConfirmation(false);
                    }}
                    onConfirm={confirmPendingSpin}
                    checkbox={(
                        <label className="confirmation-checkbox">
                            <input type="checkbox" checked={skipFutureSpinConfirmation} onChange={(event) => setSkipFutureSpinConfirmation(event.target.checked)} />
                            <span>{t('do_not_show_again')}</span>
                        </label>
                    )}
                >
                    <p>{pendingSpinType === 'free' ? t('free_spin_confirmation') : t('credit_spin_confirmation')}</p>
                </ConfirmationDialog>
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
    const { api, pushToast, t } = useContext(AuthContext);
    const [type, setType] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ current_page: 1, per_page: 20, total: 0, last_page: 1 });
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const transactionTitle = (transactionType) => {
        const translated = t(`tx_${transactionType}`);
        return translated === `tx_${transactionType}` ? humanizeTransactionType(transactionType) : translated;
    };

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
            <UserHeader onNotify={() => pushToast(t('notifications_empty'), 'ok')} />
            <SpinnerCard title={t('history')}>
                <div className="history-filters spacer">
                    <select value={type} onChange={(event) => setType(event.target.value)}>
                        <option value="">{t('all')}</option>
                        <option value="daily_bonus">Daily Bonus</option>
                        <option value="free_spin_reward">Free Spin</option>
                        <option value="paid_spin_reward">Paid Spin Reward</option>
                        <option value="spin_spend">Spin Spend</option>
                        <option value="admin_adjustment">Admin Adjustment</option>
                        <option value="spin_exchange">{t('tx_spin_exchange')}</option>
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
                        <button onClick={() => load(1)} type="button">{t('apply_filters')}</button>
                        <button onClick={() => load(page)} type="button">{t('refresh')}</button>
                    </div>
                </div>
                {loading && <p className="subtitle">{t('loading')}</p>}
                <PullToRefreshList onRefresh={() => load(1)}>
                    {!loading && transactions.length === 0 ? <p className="subtitle">{t('no_transactions')}</p> : null}
                    <ul className="history-list spacer">
                        {transactions.map((tx) => (
                            <li className="history-transaction" key={tx.id}>
                                <button
                                    className="history-transaction-row"
                                    type="button"
                                    aria-label={transactionTitle(tx.type)}
                                    onClick={() => setSelectedTransaction(tx)}
                                >
                                    <span className={`history-type-icon ${tx.amount >= 0 ? 'credit' : 'debit'}`}>
                                        <AppIcon name={tx.type === 'spin_spend' ? 'wheel' : 'coin'} size={20} />
                                    </span>
                                    <span className="history-main-copy">
                                        <strong>{transactionTitle(tx.type)}</strong>
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
                        {t('previous')}
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
                        {t('next')}
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
    const { api, pushToast, t } = useContext(AuthContext);
    const [statistics, setStatistics] = useState(null);

    useEffect(() => {
        let active = true;
        api.get('/admin/overview')
            .then((response) => {
                if (active) setStatistics(response.data.statistics || null);
            })
            .catch((error) => {
                if (active) pushToast(error?.response?.data?.message || t('failed_load_overview'), 'err');
            });
        return () => { active = false; };
    }, [api, pushToast, t]);

    return (
        <main className="app-shell admin-page admin-dashboard">
            <div className="admin-page-heading">
                <div><span>{t('admin')}</span><h1>{t('overview')}</h1></div>
            </div>
            <section className="admin-stat-grid overview-stat-grid" aria-label={t('overview')}>
                <article className="users">
                    <span className="overview-stat-icon"><AppIcon name="user" size={21} /></span>
                    <span>{t('total_users')}</span>
                    <strong>{statistics ? formatPoints(statistics.total_users) : '—'}</strong>
                </article>
                <article className="coins">
                    <span className="overview-stat-icon"><AppIcon name="coin" size={22} /></span>
                    <span>{t('total_coins')}</span>
                    <strong>{statistics ? formatPoints(statistics.total_coins) : '—'}</strong>
                </article>
            </section>
            <nav className="admin-quick-grid" aria-label="Primary admin actions">
                <NavLink className="admin-quick-card users" to="/admin/users"><AppIcon name="user" size={24} /><span><strong>{t('users')}</strong><small>{t('accounts_points')}</small></span><AppIcon name="arrow" size={16} /></NavLink>
                <NavLink className="admin-quick-card wheel" to="/admin/spin-config"><AppIcon name="wheel" size={24} /><span><strong>{t('wheel')}</strong><small>{t('rewards_cost')}</small></span><AppIcon name="arrow" size={16} /></NavLink>
                <NavLink className="admin-quick-card betting" to="/admin/betting-sites"><AppIcon name="link" size={24} /><span><strong>{t('betting_sites')}</strong><small>{t('manage_betting_sites')}</small></span><AppIcon name="arrow" size={16} /></NavLink>
                <NavLink className="admin-quick-card content" to="/admin/app-settings"><AppIcon name="content" size={24} /><span><strong>{t('app_content')}</strong><small>{t('login_links_home')}</small></span><AppIcon name="arrow" size={16} /></NavLink>
                <NavLink className="admin-quick-card announcement" to="/admin/announcement"><AppIcon name="bell" size={24} /><span><strong>{t('notification_post')}</strong><small>{t('publish_single_post')}</small></span><AppIcon name="arrow" size={16} /></NavLink>
                <NavLink className="admin-quick-card account" to="/admin/settings"><AppIcon name="shield" size={24} /><span><strong>{t('admin_account')}</strong><small>{t('profile_password')}</small></span><AppIcon name="arrow" size={16} /></NavLink>
            </nav>
        </main>
    );
}

function AdminBettingSitesScreen() {
    const { api, pushToast, t } = useContext(AuthContext);
    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editor, setEditor] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [busy, setBusy] = useState(false);

    const loadSites = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get('/admin/betting-sites');
            setSites(response.data.sites || []);
        } catch (error) {
            pushToast(error?.response?.data?.message || t('failed_load_betting_sites'), 'err');
        } finally {
            setLoading(false);
        }
    }, [api, pushToast, t]);

    useEffect(() => {
        loadSites();
    }, [loadSites]);

    const createSite = () => setEditor({
        id: null,
        name: '',
        display_text: '',
        url: 'https://',
        button_text: t('play'),
        is_active: true,
        sort_order: sites.length + 1,
    });

    const saveSite = async (event) => {
        event.preventDefault();
        if (!editor) return;
        setBusy(true);
        try {
            const payload = {
                name: editor.name,
                display_text: editor.display_text,
                url: editor.url,
                button_text: editor.button_text,
                is_active: Boolean(editor.is_active),
                sort_order: Number(editor.sort_order) || 0,
            };
            if (editor.id) {
                await api.patch(`/admin/betting-sites/${editor.id}`, payload);
                pushToast(t('betting_site_updated'), 'ok');
            } else {
                await api.post('/admin/betting-sites', payload);
                pushToast(t('betting_site_created'), 'ok');
            }
            setEditor(null);
            await loadSites();
        } catch (error) {
            const validation = error?.response?.data?.errors;
            const firstError = validation ? Object.values(validation).flat()[0] : null;
            pushToast(firstError || error?.response?.data?.message || t('betting_site_save_failed'), 'err');
        } finally {
            setBusy(false);
        }
    };

    const deleteSite = async () => {
        if (!deleting) return;
        setBusy(true);
        try {
            await api.delete(`/admin/betting-sites/${deleting.id}`);
            setDeleting(null);
            pushToast(t('betting_site_deleted'), 'ok');
            await loadSites();
        } catch (error) {
            pushToast(error?.response?.data?.message || t('betting_site_delete_failed'), 'err');
        } finally {
            setBusy(false);
        }
    };

    return (
        <main className="app-shell admin-page admin-betting-sites-page">
            <div className="admin-page-heading">
                <div><span>{t('admin')}</span><h1>{t('betting_sites')}</h1></div>
                <button type="button" onClick={createSite}>+ {t('add_website')}</button>
            </div>
            <p className="admin-page-intro">{t('betting_sites_admin_help')}</p>
            {loading ? <p className="page-loading">{t('loading_betting_sites')}</p> : null}
            {!loading && sites.length === 0 ? <section className="admin-empty-state">{t('no_betting_sites_admin')}</section> : null}
            <section className="admin-betting-sites-list">
                {sites.map((site) => (
                    <article className="admin-betting-site-card" key={site.id}>
                        <span className={`admin-status-dot ${site.is_active ? 'active' : 'disabled'}`} />
                        <div>
                            <strong>{site.name}</strong>
                            <small>{site.display_text}</small>
                            <em>#{site.sort_order} · {site.is_active ? t('active') : t('disabled')}</em>
                        </div>
                        <div className="admin-betting-site-actions">
                            <button type="button" onClick={() => setEditor({ ...site })}>{t('edit')}</button>
                            <button className="danger" type="button" onClick={() => setDeleting(site)}>{t('delete')}</button>
                        </div>
                    </article>
                ))}
            </section>

            <AdminModal open={!!editor} title={editor?.id ? t('edit_website') : t('add_website')} subtitle={t('website_editor_help')} onClose={() => !busy && setEditor(null)} wide>
                {editor ? (
                    <form className="admin-modal-form" onSubmit={saveSite}>
                        <label><span>{t('website_name')}</span><input className="input" maxLength="100" value={editor.name} onChange={(event) => setEditor((current) => ({ ...current, name: event.target.value }))} required /></label>
                        <label><span>{t('website_display_text')}</span><textarea className="input" rows="4" maxLength="500" value={editor.display_text} onChange={(event) => setEditor((current) => ({ ...current, display_text: event.target.value }))} required /></label>
                        <label><span>{t('website_url')}</span><input className="input" type="url" maxLength="2048" value={editor.url} onChange={(event) => setEditor((current) => ({ ...current, url: event.target.value }))} required /></label>
                        <div className="admin-form-grid two">
                            <label><span>{t('button_text')}</span><input className="input" maxLength="40" value={editor.button_text} onChange={(event) => setEditor((current) => ({ ...current, button_text: event.target.value }))} required /></label>
                            <label><span>{t('display_order')}</span><input className="input" type="number" min="0" max="100000" value={editor.sort_order} onChange={(event) => setEditor((current) => ({ ...current, sort_order: event.target.value }))} required /></label>
                        </div>
                        <label className="check-row"><input type="checkbox" checked={Boolean(editor.is_active)} onChange={(event) => setEditor((current) => ({ ...current, is_active: event.target.checked }))} /><span>{t('website_active_help')}</span></label>
                        <button className="btn primary" type="submit" disabled={busy}>{busy ? t('saving') : t('save_website')}</button>
                    </form>
                ) : null}
            </AdminModal>

            <ConfirmationDialog open={!!deleting} title={t('delete_website')} confirmLabel={t('delete')} onConfirm={deleteSite} onCancel={() => setDeleting(null)} busy={busy}>
                <p>{t('confirm_delete_website')}</p>
                <strong>{deleting?.name}</strong>
            </ConfirmationDialog>
        </main>
    );
}

function AdminAnnouncementScreen() {
    const { api, pushToast, language, t } = useContext(AuthContext);
    const [form, setForm] = useState({ title: '', body: '' });
    const [announcement, setAnnouncement] = useState(null);
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const response = await api.get('/admin/announcement');
                const current = response.data.announcement || null;
                setAnnouncement(current);
                setForm({ title: current?.title || '', body: current?.body || '' });
            } catch (error) {
                pushToast(error?.response?.data?.message || t('announcement_load_failed'), 'err');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [api, pushToast]);

    const publish = async (event) => {
        event.preventDefault();
        setPublishing(true);
        try {
            const response = await api.put('/admin/announcement', form);
            setAnnouncement(response.data.announcement);
            setForm({
                title: response.data.announcement.title,
                body: response.data.announcement.body,
            });
            pushToast(response.data.push_configured ? t('announcement_published') : t('announcement_published_push_unavailable'), response.data.push_configured ? 'ok' : 'warn');
        } catch (error) {
            const validation = error?.response?.data?.errors;
            const firstError = validation ? Object.values(validation).flat()[0] : null;
            pushToast(firstError || error?.response?.data?.message || t('announcement_publish_failed'), 'err');
        } finally {
            setPublishing(false);
        }
    };

    return (
        <main className="app-shell admin-page admin-announcement-page">
            <SpinnerCard title={t('admin_notification_post')}>
                <p className="subtitle">{t('single_post_replace_help')}</p>
                {loading ? <p className="page-loading">{t('loading')}</p> : (
                    <form className="admin-modal-form spacer" onSubmit={publish}>
                        <label>
                            <span>{t('post_title')}</span>
                            <input className="input" maxLength="180" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
                            <small>{form.title.length}/180</small>
                        </label>
                        <label>
                            <span>{t('post_content')}</span>
                            <textarea className="input announcement-admin-body" rows="10" maxLength="20000" value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} required />
                            <small>{form.body.length}/20000</small>
                        </label>
                        <button className="btn primary" type="submit" disabled={publishing}>{publishing ? t('publishing') : t('publish_update')}</button>
                    </form>
                )}
                {announcement?.version > 0 ? (
                    <section className="announcement-admin-preview spacer">
                        <span>{t('current_post')} · v{announcement.version}</span>
                        <strong>{announcement.title}</strong>
                        <small>{t('published_on')} {new Date(announcement.published_at).toLocaleString(language === 'my' ? 'my-MM' : 'en-US')}</small>
                        <p>{announcement.body}</p>
                    </section>
                ) : <p className="subtitle spacer">{t('never_published')}</p>}
            </SpinnerCard>
        </main>
    );
}

function AdminUsersScreen() {
    const { api, pushToast, t } = useContext(AuthContext);
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
        username: '',
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
            pushToast(error?.response?.data?.message || t('failed_load_users'), 'err');
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
                username: '',
                password: '',
            });
            setCreateModalOpen(false);
            pushToast(t('user_created'), 'ok');
            await loadUsers(page);
        } catch (error) {
            pushToast(error?.response?.data?.message || t('failed_create_user'), 'err');
        }
    };

    const updateStatus = async (user) => {
        try {
            const next = user.status === 'active' ? 'disabled' : 'active';
            await api.patch(`/admin/users/${user.id}`, { status: next });
            pushToast(next === 'active' ? t('user_enabled') : t('user_disabled'), 'ok');
            setAccountModalUser(null);
            await loadUsers(page);
        } catch (error) {
            pushToast(error?.response?.data?.message || t('update_failed'), 'err');
        }
    };

    const adjustPoints = async () => {
        if (!adjustUserId || adjustAmount === '') {
            pushToast(t('select_user_amount'), 'warn');
            return;
        }
        try {
            await api.post(`/admin/users/${adjustUserId}/adjust-points`, {
                amount: Number(adjustAmount),
            });
            pushToast(t('points_adjusted'), 'ok');
            setAdjustAmount('');
            setAdjustUserId('');
            setPointModalUser(null);
            await loadUsers(page);
        } catch (error) {
            pushToast(error?.response?.data?.message || t('adjustment_failed'), 'err');
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
            pushToast(t('password_reset_done'), 'ok');
            setPasswordModalUser(null);
            setNewPassword('');
        } catch (error) {
            pushToast(error?.response?.data?.message || t('password_reset_failed'), 'err');
        }
    };

    return (
        <main className="app-shell admin-page">
            <SpinnerCard title={`${t('admin')} — ${t('users')}`}>
                <button className="admin-create-user-button spacer" type="button" onClick={() => setCreateModalOpen(true)}>
                    <span><strong>{t('create_user_account')}</strong><small>{t('add_new_player')}</small></span>
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
                        placeholder={t('search_name_username')}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                    <select value={statusFilter} onChange={(event) => {
                        const status = event.target.value;
                        setStatusFilter(status);
                        loadUsers(1, { status });
                    }} aria-label="Filter users by status">
                        <option value="">{t('all')}</option>
                        <option value="active">{t('active')}</option>
                        <option value="disabled">{t('disabled')}</option>
                    </select>
                </form>

                <div className="spacer">
                    {loading && <p className="subtitle">{t('loading_users')}</p>}
                    <ul className="history-list">
                        {users.map((user) => (
                            <li className="admin-user-row" key={user.id}>
                                <button className="admin-user-row-button" type="button" onClick={() => navigate(`/admin/users/${user.id}`)}>
                                <div className="admin-user-summary">
                                    <span className={`admin-status-dot ${user.status}`} />
                                    <span><strong>{user.name}</strong><small>@{user.username}</small></span>
                                    <strong>{formatPoints(user.wallet_balance)} {t('points')} · {formatPoints(user.spin_balance)} {t('spins')}</strong>
                                    <AppIcon name="arrow" size={16} />
                                </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="history-pagination compact-pagination">
                        <button className="btn secondary" disabled={page <= 1} onClick={() => loadUsers(page - 1)} type="button">
                            {t('previous')}
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
                            {t('next')}
                        </button>
                    </div>
                </div>

                <AdminModal open={createModalOpen} title={t('create_user_account')} subtitle={t('first_login_credentials')} onClose={() => setCreateModalOpen(false)}>
                    <form className="admin-modal-form" onSubmit={create}>
                    <input
                        className="input"
                        placeholder={t('name')}
                        value={createUser.name}
                        onChange={(event) => setCreateUser((prev) => ({ ...prev, name: event.target.value }))}
                        required
                    />
                    <input
                        className="input"
                        placeholder={t('username')}
                        value={createUser.username}
                        onChange={(event) => setCreateUser((prev) => ({ ...prev, username: event.target.value.toLowerCase() }))}
                        minLength="3"
                        maxLength="50"
                        pattern="[A-Za-z0-9._-]+"
                        autoCapitalize="none"
                        autoCorrect="off"
                        required
                    />
                    <input
                        className="input"
                        placeholder={t('password')}
                        type="password"
                        value={createUser.password}
                        onChange={(event) => setCreateUser((prev) => ({ ...prev, password: event.target.value }))}
                        required
                    />
                    <button className="btn primary" type="submit">
                        {t('create_account_admin')}
                    </button>
                    </form>
                </AdminModal>

            </SpinnerCard>
            <AdminModal
                open={!!accountModalUser}
                title={accountModalUser?.name || 'User account'}
                subtitle={accountModalUser?.username ? `@${accountModalUser.username}` : ''}
                onClose={() => setAccountModalUser(null)}
            >
                {accountModalUser ? (
                    <div className="admin-account-actions">
                        <div className="admin-account-balance"><span>{t('balance_after')}</span><strong>{formatPoints(accountModalUser.wallet_balance)}</strong></div>
                        <button className="btn primary" type="button" onClick={() => {
                            setAdjustUserId(String(accountModalUser.id));
                            setAdjustAmount('');
                            setPointModalUser(accountModalUser);
                            setAccountModalUser(null);
                        }}>{t('add_remove_points')}</button>
                        <button className="btn secondary" type="button" onClick={() => {
                            setPasswordModalUser(accountModalUser);
                            setNewPassword('');
                            setAccountModalUser(null);
                        }}>{t('reset_password')}</button>
                        <button className={accountModalUser.status === 'active' ? 'btn danger' : 'btn success'} type="button" onClick={() => updateStatus(accountModalUser)}>
                            {accountModalUser.status === 'active' ? t('disable_user') : t('enable_user')}
                        </button>
                    </div>
                ) : null}
            </AdminModal>
            <AdminModal
                open={!!pointModalUser}
                title={t('adjust_points')}
                subtitle={pointModalUser ? `${pointModalUser.name} · ${formatPoints(pointModalUser.wallet_balance)} ${t('points')}` : ''}
                onClose={() => {
                    setPointModalUser(null);
                    setAdjustAmount('');
                    setAdjustUserId('');
                }}
            >
                <div className="admin-modal-form">
                    <label>
                        <span>{t('point_amount')}</span>
                        <input
                            className="input"
                            type="number"
                            inputMode="numeric"
                            value={adjustAmount}
                            onChange={(event) => setAdjustAmount(event.target.value)}
                            placeholder={t('point_example')}
                            autoFocus
                        />
                        <small>{t('point_adjust_help')}</small>
                    </label>
                    <button className="btn primary" type="button" onClick={adjustPoints} disabled={adjustAmount === '' || Number(adjustAmount) === 0}>
                        {t('apply_point_adjustment')}
                    </button>
                </div>
            </AdminModal>
            <AdminModal
                open={!!passwordModalUser}
                title={t('reset_password')}
                subtitle={passwordModalUser?.name || ''}
                onClose={() => {
                    setPasswordModalUser(null);
                    setNewPassword('');
                }}
            >
                <div className="admin-modal-form">
                    <label>
                        <span>{t('new_password')}</span>
                        <input className="input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength="8" autoFocus />
                        <small>{t('password_help')}</small>
                    </label>
                    <button className="btn primary" type="button" onClick={resetPassword} disabled={newPassword.length < 8}>{t('save_new_password')}</button>
                </div>
            </AdminModal>
        </main>
    );
}

function AdminUserRecordsScreen() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { api, pushToast, language, t } = useContext(AuthContext);
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
    const [accountForm, setAccountForm] = useState({ name: '', username: '', email: '', phone: '' });
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
                username: response.data.user?.username || '',
                email: response.data.user?.email || '',
                phone: response.data.user?.phone || '',
            });
            setTransactions(response.data.transactions || []);
            setMeta(parsePaging(response));
            setPage(nextPage);
        } catch (error) {
            pushToast(error?.response?.data?.message || t('failed_load_records'), 'err');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(1);
    }, [userId]);

    const adjustPoints = async () => {
        if (adjustAmount === '' || Number(adjustAmount) === 0) {
            pushToast(t('enter_point_amount'), 'warn');
            return;
        }
        try {
            await api.post(`/admin/users/${userId}/adjust-points`, {
                amount: Number(adjustAmount),
            });
            setAdjustAmount('');
            setPointModalOpen(false);
            pushToast(t('points_adjusted'), 'ok');
            await load(1);
        } catch (error) {
            pushToast(error?.response?.data?.message || t('adjustment_failed'), 'err');
        }
    };

    const resetPassword = async () => {
        if (newPassword.length < 8) {
            pushToast(t('password_min_eight'), 'warn');
            return;
        }
        try {
            await api.post(`/admin/users/${userId}/reset-password`, {
                password: newPassword,
            });
            setNewPassword('');
            setPasswordModalOpen(false);
            pushToast(t('password_reset_done'), 'ok');
        } catch (error) {
            pushToast(error?.response?.data?.message || t('password_reset_failed'), 'err');
        }
    };

    const saveAccountDetails = async (event) => {
        event.preventDefault();
        try {
            await api.patch(`/admin/users/${userId}`, {
                name: accountForm.name,
                username: accountForm.username,
                email: accountForm.email || null,
                phone: accountForm.phone || null,
            });
            setAccountModalOpen(false);
            pushToast(t('user_account_updated'), 'ok');
            await load(page);
        } catch (error) {
            const validation = error?.response?.data?.errors;
            const firstError = validation ? Object.values(validation).flat()[0] : null;
            pushToast(firstError || error?.response?.data?.message || t('user_account_update_failed'), 'err');
        }
    };

    const toggleStatus = async () => {
        if (!user) return;
        const next = user.status === 'active' ? 'disabled' : 'active';
        try {
            await api.patch(`/admin/users/${user.id}`, { status: next });
            pushToast(next === 'active' ? t('user_enabled') : t('user_disabled'), 'ok');
            await load(page);
        } catch (error) {
            pushToast(error?.response?.data?.message || t('update_failed'), 'err');
        }
    };

    return (
        <main className="app-shell admin-page">
            <SpinnerCard title={t('user_records')}>
                <button className="admin-back-link" type="button" onClick={() => navigate('/admin/users')}>
                    <AppIcon name="arrow" size={16} /> {t('users')}
                </button>

                {user ? (
                    <section className="admin-user-record-card spacer">
                        <div>
                            <span className={`admin-status-dot ${user.status}`} />
                            <strong>{user.name}</strong>
                            <small>@{user.username}</small>
                        </div>
                        <strong>{formatPoints(user.wallet_balance)} {t('points')} · {formatPoints(user.spin_balance)} {t('spins')}</strong>
                    </section>
                ) : null}

                <details className="admin-collapsible admin-record-actions spacer">
                    <summary>{t('account_actions')}</summary>
                    <div className="admin-action-grid">
                        <button className="btn secondary" type="button" onClick={() => setAccountModalOpen(true)}>{t('edit_account')}</button>
                        <button className="btn primary" type="button" onClick={() => setPointModalOpen(true)}>{t('add_remove_points')}</button>
                        <button className="btn secondary" type="button" onClick={() => setPasswordModalOpen(true)}>{t('change_password')}</button>
                        <button className={user?.status === 'active' ? 'btn danger' : 'btn success'} type="button" onClick={toggleStatus}>
                            {user?.status === 'active' ? t('disable_user') : t('enable_user')}
                        </button>
                    </div>
                </details>

                <div className="history-filters admin-record-filters spacer">
                    <select value={type} onChange={(event) => setType(event.target.value)}>
                        <option value="">{t('all_records')}</option>
                        <option value="daily_bonus">{t('tx_daily_bonus')}</option>
                        <option value="free_spin_reward">{t('tx_free_spin_reward')}</option>
                        <option value="paid_spin_reward">{t('tx_paid_spin_reward')}</option>
                        <option value="spin_spend">{t('tx_spin_spend')}</option>
                        <option value="admin_adjustment">{t('tx_admin_adjustment')}</option>
                        <option value="spin_exchange">{t('tx_spin_exchange')}</option>
                    </select>
                    <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
                    <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
                    <div className="history-filter-actions">
                        <button onClick={() => load(1)} type="button">{t('apply_filters')}</button>
                        <button onClick={() => load(page)} type="button">{t('refresh')}</button>
                    </div>
                </div>

                {loading && <p className="subtitle">{t('loading_records')}</p>}
                {!loading && transactions.length === 0 ? <p className="subtitle">{t('no_records')}</p> : null}
                <ul className="history-list spacer">
                    {transactions.map((tx) => (
                        <li className="history-transaction" key={tx.id}>
                            <button className="history-transaction-row" type="button" onClick={() => setSelectedTransaction(tx)}>
                                <span className={`history-type-icon ${tx.amount >= 0 ? 'credit' : 'debit'}`}>
                                    <AppIcon name={tx.type === 'spin_spend' ? 'wheel' : 'coin'} size={20} />
                                </span>
                                <span className="history-main-copy">
                                    <strong>{t(`tx_${tx.type}`) === `tx_${tx.type}` ? humanizeTransactionType(tx.type) : t(`tx_${tx.type}`)}</strong>
                                    <small>{new Date(tx.created_at).toLocaleString(language === 'my' ? 'my-MM' : 'en-US')}</small>
                                </span>
                                <span className="history-value-copy">
                                    <strong className={tx.amount >= 0 ? 'credit' : 'debit'}>
                                        {tx.amount > 0 ? '+' : ''}{formatPoints(tx.amount)} {t('points')}
                                    </strong>
                                    <small>{t('balance_after')} {formatPoints(tx.balance_after)}</small>
                                </span>
                                <AppIcon name="arrow" size={18} />
                            </button>
                        </li>
                    ))}
                </ul>

                <div className="history-pagination compact-pagination">
                    <button className="btn secondary" disabled={page <= 1} onClick={() => load(page - 1)} type="button">{t('previous')}</button>
                    <span className="toolbar-caption">{meta.current_page}/{meta.last_page}</span>
                    <button className="btn secondary" disabled={page >= meta.last_page} onClick={() => load(page + 1)} type="button">{t('next')}</button>
                </div>
            </SpinnerCard>

            <AdminModal open={pointModalOpen} title={t('adjust_points')} subtitle={user?.name || ''} onClose={() => setPointModalOpen(false)}>
                <div className="admin-modal-form">
                    <label>
                        <span>{t('point_amount')}</span>
                        <input className="input" type="number" inputMode="numeric" value={adjustAmount} onChange={(event) => setAdjustAmount(event.target.value)} placeholder={t('point_example')} autoFocus />
                        <small>{t('point_adjust_help')}</small>
                    </label>
                    <button className="btn primary" type="button" onClick={adjustPoints}>{t('apply_point_adjustment')}</button>
                </div>
            </AdminModal>

            <AdminModal open={accountModalOpen} title={t('edit_account')} subtitle={user?.name || ''} onClose={() => setAccountModalOpen(false)}>
                <form className="admin-modal-form" onSubmit={saveAccountDetails}>
                    <label>
                        <span>{t('name')}</span>
                        <input className="input" value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} required autoFocus />
                    </label>
                    <label>
                        <span>{t('username')}</span>
                        <input className="input" value={accountForm.username} onChange={(event) => setAccountForm((current) => ({ ...current, username: event.target.value.toLowerCase() }))} minLength="3" maxLength="50" pattern="[A-Za-z0-9._-]+" autoCapitalize="none" autoCorrect="off" required />
                    </label>
                    <label>
                        <span>{t('email')} (optional)</span>
                        <input className="input" type="email" value={accountForm.email} onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))} />
                    </label>
                    <label>
                        <span>{t('phone')}</span>
                        <input className="input" value={accountForm.phone} onChange={(event) => setAccountForm((current) => ({ ...current, phone: event.target.value }))} />
                    </label>
                    <button className="btn primary" type="submit">{t('save_account')}</button>
                </form>
            </AdminModal>

            <AdminModal open={passwordModalOpen} title={t('change_password')} subtitle={user?.name || ''} onClose={() => setPasswordModalOpen(false)}>
                <div className="admin-modal-form">
                    <label>
                        <span>{t('new_password')}</span>
                        <input className="input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength="8" autoFocus />
                    </label>
                    <button className="btn primary" type="button" onClick={resetPassword} disabled={newPassword.length < 8}>{t('save_new_password')}</button>
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
    const { api, me, refreshMe, pushToast, language, setLanguage, t } = useContext(AuthContext);
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
            pushToast(t('admin_account_updated'), 'ok');
        } catch (error) {
            const validation = error?.response?.data?.errors;
            pushToast(validation ? Object.values(validation).flat()[0] : (error?.response?.data?.message || t('admin_account_update_failed')), 'err');
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
            pushToast(t('admin_password_changed'), 'ok');
        } catch (error) {
            const validation = error?.response?.data?.errors;
            pushToast(validation ? Object.values(validation).flat()[0] : (error?.response?.data?.message || t('password_change_failed')), 'err');
        } finally {
            setChangingPassword(false);
        }
    };

    return (
        <main className="app-shell admin-page">
            <SpinnerCard title={t('admin_settings')}>
                <section className="admin-profile-summary">
                    <div className="admin-profile-avatar"><AppIcon name="user" size={25} /></div>
                    <span><strong>{me?.name}</strong><small>{t('sole_admin_active')}</small></span>
                </section>
                <form className="admin-modal-form spacer" onSubmit={save}>
                    <label><span>{t('name')}</span><input className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label>
                    <label><span>{t('email')}</span><input className="input" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required /></label>
                    <label><span>{t('phone')}</span><input className="input" type="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
                    <button className="btn primary" type="submit" disabled={saving}>{saving ? t('saving') : t('save_account_information')}</button>
                </form>
                <section className="admin-language-section spacer">
                    <strong>{t('language')}</strong>
                    <div className="language-picker" role="group" aria-label={t('language')}>
                        <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>{t('english')}</button>
                        <button type="button" className={language === 'my' ? 'active' : ''} onClick={() => setLanguage('my')}>{t('burmese')}</button>
                    </div>
                </section>
                <nav className="admin-function-grid spacer">
                    <NavLink className="admin-function-link" to="/admin/app-settings">
                        <AppIcon name="settings" size={21} /><span><strong>{t('app_content_settings')}</strong><small>{t('home_contacts_social')}</small></span><AppIcon name="arrow" size={17} />
                    </NavLink>
                    <button type="button" onClick={() => setPasswordModalOpen(true)}>
                        <AppIcon name="lock" size={21} /><span><strong>{t('change_password')}</strong><small>{t('verify_current_password')}</small></span><AppIcon name="arrow" size={17} />
                    </button>
                </nav>
            </SpinnerCard>
            <AdminModal
                open={passwordModalOpen}
                title={t('change_admin_password')}
                subtitle={t('use_eight_characters')}
                onClose={() => setPasswordModalOpen(false)}
            >
                <form className="admin-modal-form" onSubmit={changePassword}>
                    <label>
                        <span>{t('current_password')}</span>
                        <input className="input" type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} required />
                    </label>
                    <label>
                        <span>{t('new_password')}</span>
                        <input className="input" type="password" autoComplete="new-password" minLength="8" value={passwordForm.password} onChange={(event) => setPasswordForm((current) => ({ ...current, password: event.target.value }))} required />
                    </label>
                    <label>
                        <span>{t('confirm_password')}</span>
                        <input className="input" type="password" autoComplete="new-password" minLength="8" value={passwordForm.confirmation} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmation: event.target.value }))} required />
                    </label>
                    <button className="btn primary" type="submit" disabled={changingPassword}>{changingPassword ? t('changing') : t('change_password')}</button>
                </form>
            </AdminModal>
        </main>
    );
}

function AdminApplicationSettingsScreen() {
    const { api, refreshAppSettings, pushToast, t } = useContext(AuthContext);
    const [form, setForm] = useState(DEFAULT_APP_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const response = await api.get('/app-settings');
                setForm({ ...DEFAULT_APP_SETTINGS, ...(response.data.settings || {}) });
            } catch (error) {
                pushToast(error?.response?.data?.message || t('app_settings_load_failed'), 'err');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [api, pushToast]);

    const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

    const updateDailyBonusDay = (index, value) => {
        setForm((current) => {
            const schedule = normalizeDailyBonusSchedule(current, false);
            schedule[index] = value;
            return { ...current, daily_bonus_schedule: schedule };
        });
    };

    const save = async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
            const payload = Object.fromEntries(
                Object.keys(DEFAULT_APP_SETTINGS).map((key) => [key, form[key] === '' ? null : form[key]]),
            );
            payload.play_bet_url = form.play_bet_url;
            payload.play_bet_label = form.play_bet_label;
            payload.daily_bonus_schedule = normalizeDailyBonusSchedule(form);
            // Retained for compatibility with installations upgrading from the old single-value setting.
            payload.daily_bonus_points = payload.daily_bonus_schedule[0];
            payload.contact_phone = splitSettingLines(form.contact_phone_numbers)[0] || null;
            const response = await api.patch('/admin/app-settings', payload);
            setForm({ ...DEFAULT_APP_SETTINGS, ...(response.data.settings || {}) });
            await refreshAppSettings();
            pushToast(t('app_content_updated'), 'ok');
        } catch (error) {
            const validation = error?.response?.data?.errors;
            const firstError = validation ? Object.values(validation).flat()[0] : null;
            pushToast(firstError || error?.response?.data?.message || t('app_settings_save_failed'), 'err');
        } finally {
            setSaving(false);
        }
    };

    const contactFields = [
        ['play_bet_label', t('play_bet_text'), 'text'],
        ['telegram_contact_url', t('telegram_account_url'), 'text'],
        ['viber_contact_url', t('viber_contact_url'), 'text'],
    ];
    const socialFields = [
        ['telegram_channel_url', t('telegram_channel_url'), 'url'],
        ['facebook_page_url', t('facebook_page_url'), 'url'],
        ['tiktok_channel_url', t('tiktok_channel_url'), 'url'],
    ];

    return (
        <main className="app-shell admin-page">
            <SpinnerCard title={t('admin_app_content')}>
                <p className="subtitle">{t('app_changes_immediate')}</p>
                {loading ? <p className="subtitle spacer">{t('loading')}</p> : (
                    <form className="admin-settings-form spacer" onSubmit={save}>
                        <details className="admin-collapsible">
                            <summary>{t('betting_contact_links')}</summary>
                            <div className="admin-compact-form">
                                {contactFields.map(([key, label, type]) => (
                                    <label key={key}><span>{label}</span><input className="input" type={type} value={form[key] || ''} onChange={(event) => update(key, event.target.value)} required={key === 'play_bet_url' || key === 'play_bet_label'} /></label>
                                ))}
                                <label><span>{t('contact_phones_lines')}</span><textarea className="input" rows="4" value={form.contact_phone_numbers || ''} onChange={(event) => update('contact_phone_numbers', event.target.value)} /></label>
                            </div>
                        </details>
                        <details className="admin-collapsible">
                            <summary>{t('home_screen_content')}</summary>
                            <div className="admin-compact-form">
                                <label><span>{t('information_board_lines')}</span><textarea className="input" rows="6" value={form.home_board_text || ''} onChange={(event) => update('home_board_text', event.target.value)} /></label>
                                <label><span>{t('auto_scrolling_text')}</span><textarea className="input" rows="3" value={form.home_ticker_text || ''} onChange={(event) => update('home_ticker_text', event.target.value)} /></label>
                                <fieldset className="daily-schedule-fieldset">
                                    <legend>{t('daily_points_schedule')}</legend>
                                    <p>{t('weekly_schedule_help')}</p>
                                    <div className="admin-daily-schedule-grid">
                                        {normalizeDailyBonusSchedule(form, false).map((points, index) => (
                                            <label key={DAILY_BONUS_WEEKDAYS[index]}>
                                                <span>{t('day')} {index + 1} · {t(DAILY_BONUS_WEEKDAYS[index])}</span>
                                                <input className="input" type="number" inputMode="numeric" min="0" max="1000000" value={points} onChange={(event) => updateDailyBonusDay(index, event.target.value)} />
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>
                            </div>
                        </details>
                        <details className="admin-collapsible">
                            <summary>{t('social_links_about')}</summary>
                            <div className="admin-compact-form">
                                {socialFields.map(([key, label, type]) => (
                                    <label key={key}><span>{label}</span><input className="input" type={type} value={form[key] || ''} onChange={(event) => update(key, event.target.value)} /></label>
                                ))}
                                <label><span>{t('terms_content')}</span><textarea className="input" rows="10" value={form.how_to_use_terms || ''} onChange={(event) => update('how_to_use_terms', event.target.value)} /></label>
                                <label><span>{t('about_app')}</span><textarea className="input" rows="4" value={form.about_content || ''} onChange={(event) => update('about_content', event.target.value)} /></label>
                            </div>
                        </details>
                        <button className="btn primary" type="submit" disabled={saving}>
                            {saving ? t('saving') : t('save_app_settings')}
                        </button>
                    </form>
                )}
            </SpinnerCard>
        </main>
    );
}

function AdminSpinConfigScreen() {
    const { api, pushToast, t } = useContext(AuthContext);
    const [editing, setEditing] = useState(null);
    const [loading, setLoading] = useState(false);
    const [editorModal, setEditorModal] = useState(null);
    const [exchangePackages, setExchangePackages] = useState([]);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const [response, packageResponse] = await Promise.all([
                api.get('/admin/spin-configuration'),
                api.get('/admin/spin-exchange-packages'),
            ]);
            setEditing(response.data.configuration);
            setExchangePackages(packageResponse.data.packages || []);
        } catch (error) {
            pushToast(error?.response?.data?.message || t('wheel_settings_load_failed'), 'err');
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
            segments: (editing.segments || []).map((segment) => ({
                id: segment.id || null,
                reward_type: segment.reward_type || 'points',
                reward_amount: Number(segment.reward_type === 'spins' ? segment.spins_reward : segment.points_reward),
                weight: Number(segment.weight),
            })),
        };

        try {
            const response = await api.patch('/admin/spin-configuration', payload);
            setEditing(response.data.configuration);
            pushToast(t('wheel_settings_saved'), 'ok');
            setEditorModal(null);
        } catch (error) {
            pushToast(error?.response?.data?.message || t('save_failed'), 'err');
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
            reward_type: 'points',
            spins_reward: 0,
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

    const addExchangePackage = () => setExchangePackages((current) => [...current, {
        id: null,
        points_cost: 100,
        spins_amount: 3,
        is_active: true,
    }]);

    const updateExchangePackage = (index, key, value) => setExchangePackages((current) => current.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [key]: value } : item
    )));

    const saveExchangePackages = async () => {
        try {
            const response = await api.put('/admin/spin-exchange-packages', {
                packages: exchangePackages.map((item) => ({
                    id: item.id || null,
                    points_cost: Number(item.points_cost),
                    spins_amount: Number(item.spins_amount),
                    is_active: Boolean(item.is_active),
                })),
            });
            setExchangePackages(response.data.packages || []);
            setEditorModal(null);
            pushToast(t('save_app_settings'), 'ok');
        } catch (error) {
            pushToast(error?.response?.data?.message || t('save_failed'), 'err');
        }
    };

    const loadingMessage = loading ? t('loading') : '';
    const totalWeight = (editing?.segments || []).reduce((sum, segment) => sum + Number(segment.weight || 0), 0);

    return (
        <main className="app-shell admin-page">
            <SpinnerCard title={t('admin_wheel')}>
                {loading && <p className="subtitle">{loadingMessage}</p>}
                <div className="admin-function-grid spacer">
                    <button type="button" onClick={() => setEditorModal('segments')} disabled={!editing}>
                        <AppIcon name="wheel" size={21} />
                        <span><strong>{t('slices_rewards_chances')}</strong><small>{(editing?.segments || []).length} {t('slices')}</small></span>
                        <AppIcon name="arrow" size={17} />
                    </button>
                    <button type="button" onClick={() => setEditorModal('packages')}>
                        <AppIcon name="coin" size={21} />
                        <span><strong>{t('spin_packages')}</strong><small>{t('manage_spin_packages')}</small></span>
                        <AppIcon name="arrow" size={17} />
                    </button>
                </div>
            </SpinnerCard>

                {editing ? (
                    <AdminModal
                        open={editorModal === 'segments'}
                        title={t('slices_rewards_chances')}
                        subtitle={`${(editing.segments || []).length} ${t('wheel_slices')}`}
                        onClose={() => setEditorModal(null)}
                        wide
                    >
                        <div className="admin-segment-list">
                        {(editing.segments || []).map((segment, index) => (
                            <details className="segment-block" key={`${segment.id || index}`}>
                                <summary>
                                    <i style={{ background: segment.color || '#ffca28' }} />
                                    <span>{t('slice')} {index + 1}</span>
                                    <strong>
                                        {formatPoints(segment.reward_type === 'spins' ? segment.spins_reward : segment.points_reward)}{' '}
                                        {segment.reward_type === 'spins' ? t('spins') : t('points')} ·{' '}
                                        {totalWeight ? ((Number(segment.weight || 0) / totalWeight) * 100).toFixed(1) : '0.0'}%
                                    </strong>
                                </summary>
                                <div className="segment-editor-fields">
                                    <label>
                                        <span>{t('reward_type')}</span>
                                        <select className="input" value={segment.reward_type || 'points'} onChange={(event) => updateSegment(index, 'reward_type', event.target.value)}>
                                            <option value="points">{t('points_reward_type')}</option>
                                            <option value="spins">{t('spins_reward_type')}</option>
                                        </select>
                                    </label>
                                    <label>
                                        <span>{t('reward_amount')}</span>
                                        <input
                                            className="input"
                                            value={segment.reward_type === 'spins' ? (segment.spins_reward ?? '') : (segment.points_reward ?? '')}
                                            type="number"
                                            inputMode="numeric"
                                            min="0"
                                            onChange={(event) => updateSegment(index, segment.reward_type === 'spins' ? 'spins_reward' : 'points_reward', event.target.value)}
                                        />
                                    </label>
                                    <label>
                                        <span>{t('chance_weight')}</span>
                                        <input
                                            className="input"
                                            value={segment.weight ?? ''}
                                            type="number"
                                            inputMode="numeric"
                                            min="1"
                                            onChange={(event) => updateSegment(index, 'weight', event.target.value)}
                                        />
                                        <small>{t('current_chance')}: {totalWeight ? ((Number(segment.weight || 0) / totalWeight) * 100).toFixed(2) : '0.00'}%</small>
                                    </label>
                                <button className="btn danger" type="button" onClick={() => removeSegment(index)} disabled={(editing.segments || []).length <= 2}>
                                    {t('remove_slice')}
                                </button>
                                </div>
                            </details>
                        ))}
                        <button className="btn secondary" type="button" onClick={addSegment}>
                            {t('add_slice')}
                        </button>
                        <button className="btn primary" type="button" onClick={save}>
                            {t('save_slices')}
                        </button>
                        </div>
                    </AdminModal>
                ) : null}
            <AdminModal open={editorModal === 'packages'} title={t('spin_packages')} subtitle={t('manage_spin_packages')} onClose={() => setEditorModal(null)} wide>
                <div className="admin-segment-list">
                    {exchangePackages.map((item, index) => (
                        <div className="segment-block exchange-package-editor" key={item.id || `new-${index}`}>
                            <label><span>{t('point_cost')}</span><input className="input" type="number" min="1" value={item.points_cost} onChange={(event) => updateExchangePackage(index, 'points_cost', event.target.value)} /></label>
                            <label><span>{t('spin_quantity')}</span><input className="input" type="number" min="1" value={item.spins_amount} onChange={(event) => updateExchangePackage(index, 'spins_amount', event.target.value)} /></label>
                            <label className="remember-row"><input type="checkbox" checked={Boolean(item.is_active)} onChange={(event) => updateExchangePackage(index, 'is_active', event.target.checked)} /><span>{t('active')}</span></label>
                            <button className="btn danger" type="button" disabled={exchangePackages.length <= 1} onClick={() => setExchangePackages((current) => current.filter((_, itemIndex) => itemIndex !== index))}>{t('remove_package')}</button>
                        </div>
                    ))}
                    <button className="btn secondary" type="button" onClick={addExchangePackage}>{t('add_package')}</button>
                    <button className="btn primary" type="button" onClick={saveExchangePackages}>{t('save_packages')}</button>
                </div>
            </AdminModal>
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

