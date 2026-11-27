import React, { useMemo, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getPhotoIds, getPhotos, getAnnouncement, getFeatured, myOrders, accountStatus, accountRegister, accountLogin, SUPABASE_READY, placeOrder, submitRx, adminCall, fmtTime, loadPriceOverrides, loadNotifications, loadCart, saveCart, loyaltyInfo, placeOrder2 } from './lib/api';
import type { OrderRow, RxRow, NotifRow, LoyaltyInfo } from './lib/api';

function Paragraph({ children }: { children: React.ReactNode }) {
    return <p className="kh-p">{children}</p>;
}
function Caption({ children }: { children: React.ReactNode }) {
    return <p className="kh-cap">{children}</p>;
}
function Closing({ children }: { children: React.ReactNode }) {
    return <footer className="kh-closing">{children}</footer>;
}
import logo from './photos/logo.webp';
import hero from './photos/hero.webp';
import c0_1 from './photos/cat/c0_1.webp';
import c0_2 from './photos/cat/c0_2.webp';
import c1_1 from './photos/cat/c1_1.webp';
import c1_2 from './photos/cat/c1_2.webp';
import c1_3 from './photos/cat/c1_3.webp';
import c2_1 from './photos/cat/c2_1.webp';
import c2_2 from './photos/cat/c2_2.webp';
import c2_3 from './photos/cat/c2_3.webp';
import c3_1 from './photos/cat/c3_1.webp';
import c3_2 from './photos/cat/c3_2.webp';
import c4_1 from './photos/cat/c4_1.webp';
import c4_2 from './photos/cat/c4_2.webp';

// ===== REAL CATALOG (loaded from the pharmacy's item file) =====
// catalog.ts holds customer-safe fields only: id, name, sell price, category.
import { CATALOG, BY_ID, useCatalogVersion, isCatalogReady, catalogHooks, live, refreshCatalog } from './catalog';
import type { CatalogItem } from './catalog';

const CAT_NAMES = ['الأدوية', 'العناية', 'الفيتامينات', 'الأم والطفل', 'أجهزة طبية'];
const CATEGORIES = ['الكل', ...CAT_NAMES];

function fmtPrice(value: number) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

const DELIVERY_FEE = 0; // delivery is free on everything, 24 hours
const ADMIN_PHONE = '01000000000'; // fictional demo admin number

const SLIDES = [
    { tag: 'خدمة 24 ساعة', title: 'دواءك يوصلك لباب البيت', sub: 'اطلب من تطبيق الخليل وهنجهز طلبك ونوصله بسرعة', cta: 'تسوق دلوقتي', to: '/#grid', photo: hero, icon: 'pill' as const },
    { tag: 'بالروشتة', title: 'صوّر الروشتة وسيب الباقي علينا', sub: 'الصيدلي هيراجعها ويتواصل معاك لتأكيد الطلب', cta: 'ارفع الروشتة', to: '/prescription', photo: null, icon: 'camera' as const },
    { tag: 'عرض التوصيل', title: 'توصيل مجاني على كل طلب', sub: 'على مدار 24 ساعة، من غير حد أدنى ولا رسوم', cta: 'ابدأ التسوق', to: '/#grid', photo: null, icon: 'truck' as const },
];

function egp(value: number) {
    return `${fmtPrice(value)} ج.م`;
}

function digitsOnly(value: string) {
    return value.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '');
}

type Cart = Record<string, number>;

function useCartState() {
    const [cart, setCart] = useState<Cart>({});
    return useMemo(() => ({
        count: Object.values(cart).reduce((a, b) => a + b, 0),
        total: Object.entries(cart).reduce((sum, [id, qty]) => sum + (BY_ID.get(id)?.p ?? 0) * qty, 0),
        add: (id: string, qty = 1) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + qty })),
        set: (id: string, qty: number) => setCart((c) => {
            const next = { ...c };
            if (qty <= 0) delete next[id]; else next[id] = qty;
            return next;
        }),
        clear: () => setCart({}),
        replace: (c: Cart) => setCart(c),
        raw: cart,
        items: () => Object.entries(cart).flatMap(([id, qty]) => {
            const product = BY_ID.get(id);
            return product ? [{ product, qty }] : [];
        }),
    }), [cart]);
}

const CartContext = React.createContext<ReturnType<typeof useCartState> | null>(null);
type NotifState = { items: NotifRow[]; unread: number; markSeen: () => void; reload: () => void };
const NotifContext = React.createContext<NotifState>({ items: [], unread: 0, markSeen: () => {}, reload: () => {} });
const LoyaltyContext = React.createContext<{ info: LoyaltyInfo | null; reload: () => void }>({ info: null, reload: () => {} });
const UserContext = React.createContext<string>('');
const UserSetContext = React.createContext<(p: string | null) => void>(() => {});
const ShopContext = React.createContext<{ cat: string; setCat: (c: string) => void; query: string; setQuery: (q: string) => void; selectedId: string | null; setSelectedId: (id: string | null) => void }>({ cat: 'الكل', setCat: () => {}, query: '', setQuery: () => {}, selectedId: null, setSelectedId: () => {} });

function useShop() { return React.useContext(ShopContext); }

// ===== ICONS (inline SVG — no emoji) =====
const PATHS: Record<string, React.ReactNode> = {
    shield: <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" />,
    star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z" />,
    cart: <><circle cx="9" cy="20" r="1.6" /><circle cx="17" cy="20" r="1.6" /><path d="M3 4h2l2.4 11h9.9l2-8H6" /></>,
    bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 19a2 2 0 0 0 4 0" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" /></>,
    eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    eyeoff: <><path d="M3 3l18 18" /><path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.5 6.6C3.7 8.3 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.4 4.5-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
    phone: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
    lock: <><rect x="5" y="11" width="14" height="9.5" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    home: <><path d="M4 11 12 4l8 7" /><path d="M6 10v10h12V10" /></>,
    grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
    receipt: <><path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z" /><path d="M9 8h6M9 12h6" /></>,
    camera: <><path d="M4 8h3l2-2.5h6L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.4" /></>,
    pill: <><rect x="3.5" y="8.5" width="12" height="7" rx="3.5" transform="rotate(-45 9.5 12)" /><path d="m8.5 8.5 5 5" /><path d="M15 5l4 4" /></>,
    spray: <><path d="M10 8h4v12h-4z" /><path d="M11 4h2v4h-2z" /><path d="M15 5l1.5-1.5M16 8l2-.5" /></>,
    vitamin: <><path d="M9 3h6v3l1.5 2v13h-9V8L9 6z" /><path d="M9 12h9" /></>,
    baby: <><circle cx="12" cy="10" r="5.5" /><path d="M9.5 9.5h.01M14.5 9.5h.01M10 12.5c.7.8 1.3 1 2 1s1.3-.2 2-1" /><path d="M7 19c2-1.5 8-1.5 10 0" /></>,
    stetho: <><path d="M6 3v5a4 4 0 0 0 8 0V3" /><path d="M10 12v3a5 5 0 0 0 10 0v-2" /><circle cx="20" cy="11" r="1.8" /></>,
    back: <path d="M9 6l6 6-6 6" />,
    logout: <><path d="M14 4h-8v16h8" /><path d="M11 12h9m-3-3 3 3-3 3" /></>,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    truck: <><rect x="2" y="7" width="12" height="9" rx="1" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
};

function PassInput({ value, onChange, autoComplete, icon }: { value: string; onChange: (v: string) => void; autoComplete: string; icon?: keyof typeof PATHS }) {
    const [show, setShow] = useState(false);
    return <span className="kh-passwrap">
        {icon && <span className="kh-fi"><Icon name={icon} size={19} /></span>}
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} dir="ltr" style={{ textAlign: 'right' }} />
        <button type="button" className="kh-eye" aria-label={show ? 'إخفاء الباسورد' : 'إظهار الباسورد'} aria-pressed={show} onClick={() => setShow((v) => !v)}><Icon name={show ? 'eyeoff' : 'eye'} size={20} /></button>
    </span>;
}

function Icon({ name, size = 22 }: { name: keyof typeof PATHS; size?: number }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[name]}</svg>;
}

function useCart() {
    const ctx = React.useContext(CartContext);
    if (!ctx) throw new Error('cart context missing');
    return ctx;
}

function useUserPhone() {
    return React.useContext(UserContext);
}


function ScrollTop() {
    React.useEffect(() => {
        // The File viewer scrolls the parent page, not this frame: scrollIntoView
        // propagates to ancestor scroll containers, window.scrollTo does not.
        window.scrollTo(0, 0);
        document.getElementById('kh-top')?.scrollIntoView({ block: 'start' });
    }, []);
    return null;
}

const norm = (t: string) => t.toLowerCase()
    .replace(/[\u064B-\u065F\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
let SEARCH_INDEX_C: { p: CatalogItem; n: string }[] | null = null;
function searchIndex() {
    const idx = SEARCH_INDEX_C ?? (SEARCH_INDEX_C = []);
    for (let k = idx.length; k < CATALOG.length; k++) idx.push({ p: CATALOG[k], n: norm(CATALOG[k].n) }); // extends as catalog parts arrive
    return idx;
}
catalogHooks.push(() => { if (SEARCH_INDEX_C) searchIndex(); });

function searchProducts(q: string, max = 8): CatalogItem[] {
    const tokens = norm(q).trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];
    const starts: CatalogItem[] = [];
    const rest: CatalogItem[] = [];
    for (const e of searchIndex()) {
        if (!tokens.every((t) => e.n.includes(t))) continue;
        (e.n.startsWith(tokens[0]) ? starts : rest).push(e.p);
        if (starts.length >= max) break;
    }
    return [...starts, ...rest].slice(0, max);
}

function AnnounceBanner() {
    const [text, setText] = useState('');
    React.useEffect(() => {
        let alive = true;
        const load = () => { getAnnouncement().then((t) => { if (alive && t !== null) setText(t.trim()); }).catch(() => {}); };
        load();
        const t = window.setInterval(load, 60000);
        const vis = () => { if (document.visibilityState === 'visible') load(); };
        document.addEventListener('visibilitychange', vis);
        return () => { alive = false; window.clearInterval(t); document.removeEventListener('visibilitychange', vis); };
    }, []);
    if (text === '') return null;
    return <div className="kh-announce" role="status" aria-live="polite">
        <svg className="kh-announce-ico" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11v3a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" /><path d="M15 9a4 4 0 0 1 0 6" /><path d="M18 6.5a8 8 0 0 1 0 11" /></svg>
        <span className="kh-announce-text">{text}</span>
    </div>;
}

function SearchBox() {
    const { setQuery, setSelectedId, setCat } = useShop();
    const navigate = useNavigate();
    const [text, setText] = useState('');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const wrap = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const results = useMemo(() => searchProducts(text), [text]);
    React.useEffect(() => setActive(-1), [text]);
    React.useEffect(() => {
        const close = (e: MouseEvent | TouchEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close);
        document.addEventListener('touchstart', close);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close); };
    }, []);
    React.useEffect(() => {
        listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
    }, [active]);
    const openProduct = (p: CatalogItem) => {
        setOpen(false);
        setText('');
        setQuery('');
        (document.activeElement as HTMLElement | null)?.blur();
        setSelectedId(p.i);
    };
    const showAll = () => {
        setOpen(false);
        (document.activeElement as HTMLElement | null)?.blur();
        setSelectedId(null);
        setCat('الكل');
        setQuery(text);
        navigate('/');
        window.setTimeout(() => document.getElementById('kh-grid')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
    };
    const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(results.length - 1, a + 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (active >= 0 && results[active]) openProduct(results[active]);
            else if (results.length === 1) openProduct(results[0]);
            else if (text.trim() !== '') showAll();
        }
        else if (e.key === 'Escape') { setOpen(false); }
    };
    const showList = open && text.trim() !== '';
    return <div className="kh-search-wrap" ref={wrap}>
        <label className="kh-search">
            <Icon name="search" size={18} />
            <input
                value={text}
                onChange={(e) => { if (/^\+?\d{10,13}$/.test(e.target.value.trim())) { setText(''); setQuery(''); return; } setText(e.target.value); setOpen(true); if (e.target.value.trim() === '') setQuery(''); }}
                onFocus={(e) => { e.currentTarget.readOnly = false; setOpen(true); }}
                readOnly
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                inputMode="search"
                onKeyDown={onKey}
                placeholder="ابحث عن دواء أو منتج..."
                aria-label="ابحث في المتجر"
                type="search"
                name="kh_find_x9"
                role="combobox"
                aria-expanded={showList}
                aria-autocomplete="list"
                enterKeyHint="search"
                autoComplete="off"
            />
            {text !== '' && <button type="button" className="kh-search-x" aria-label="مسح" onMouseDown={(e) => e.preventDefault()} onClick={() => { setText(''); setQuery(''); setOpen(false); }}>×</button>}
        </label>
        {showList && <div className="kh-sugg">
            {results.length === 0
                ? <p className="kh-sugg-empty">مفيش نتائج مطابقة</p>
                : <ul ref={listRef} role="listbox">
                    {results.map((p, i) => <li key={p.i} role="option" aria-selected={i === active} className={i === active ? 'is-active' : ''}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => openProduct(p)}>
                        <span className="kh-sugg-ico"><Icon name={CAT_ICON[p.c] ?? 'pill'} size={20} /></span>
                        <span className="kh-sugg-name">{p.n}<small>{CAT_NAMES[p.c]}</small></span>
                        <b className="kh-sugg-price"><bdi>{fmtPrice(p.p)}</bdi> ج.م</b>
                        <SuggAdd id={p.i} />
                    </li>)}
                </ul>}
            {results.length > 0 && <button type="button" className="kh-sugg-all" onMouseDown={(e) => e.preventDefault()} onClick={showAll}>عرض كل النتائج</button>}
        </div>}
    </div>;
}

function Header() {
    const cart = useCart();
    const { pathname } = useLocation();
    const { setSelectedId, setCat } = useShop();
    const notif = React.useContext(NotifContext);
    const userPhoneH = useUserPhone();
    const loyH = React.useContext(LoyaltyContext).info;
    const [nameH, setNameH] = useState('');
    React.useEffect(() => { const f = () => { try { setNameH((userPhoneH && localStorage.getItem(nameKey(userPhoneH))) || ''); } catch { setNameH(''); } }; f(); window.addEventListener('kh-name', f); return () => window.removeEventListener('kh-name', f); }, [userPhoneH]);
    const userChip = (cls: string) => userPhoneH ? <Link to={userPhoneH === ADMIN_PHONE ? '/admin' : '/account'} className={`kh-userbar ${cls}`} onClick={() => setSelectedId(null)}>
        {userPhoneH === ADMIN_PHONE
            ? <span className="kh-ub-item">وضع الأدمن</span>
            : <>
                <span className="kh-ub-item"><Icon name="user" size={15} />{nameH ? <span>{nameH}</span> : <bdi dir="ltr">{userPhoneH}</bdi>}</span>
                {loyH && <span className="kh-ub-item kh-ub-pts">★ <b>{loyH.balance.toLocaleString('en-US')}</b> نقطة</span>}
            </>}
    </Link> : null;
    const links = [
        { to: '/', label: 'الرئيسية' },
        { to: '/categories', label: 'الأقسام' },
        { to: '/orders', label: 'طلباتي' },
        { to: '/prescription', label: 'ارفع روشتة' },
    ];
    const goHome = () => { setSelectedId(null); setCat('الكل'); window.scrollTo(0, 0); };
    return <header className="kh-header">
        <div className="kh-header-bar">
            <Link to="/" className="kh-brand" onClick={goHome} aria-label="الصفحة الرئيسية">
                <img src={logo} alt="لوجو صيدلية الخليل" className="kh-brand-logo" />
                <span className="kh-brand-name">صيدلية <b>الخليل</b></span>
            </Link>
            <SearchBox />
            <div className="kh-header-icons">
                {userPhoneH && userPhoneH !== ADMIN_PHONE && loyH && <Link to="/account" className="kh-hd-pts" aria-label="نقاطي" onClick={() => setSelectedId(null)}>★ <b>{loyH.balance.toLocaleString('en-US')}</b></Link>}
                <Link to={userPhoneH === ADMIN_PHONE ? '/admin' : '/account'} className="kh-icon-btn" aria-label="حسابي" onClick={() => setSelectedId(null)}><Icon name="user" /><em>{nameH || 'حسابي'}</em></Link>
                <Link to="/notifications" className="kh-icon-btn" aria-label="الإشعارات" onClick={() => setSelectedId(null)}>
                    <Icon name="bell" />
                    {notif.unread > 0 && <b className="kh-badge">{notif.unread.toLocaleString('en-US')}</b>}
                    <em>الإشعارات</em>
                </Link>
                <Link to="/cart" className="kh-icon-btn" aria-label="السلة" onClick={() => setSelectedId(null)}>
                    <Icon name="cart" />
                    {cart.count > 0 && <b className="kh-badge">{cart.count.toLocaleString('en-US')}</b>}
                    <em>السلة</em>
                </Link>
            </div>
        </div>
        {userPhoneH === ADMIN_PHONE && userChip('kh-ub-mobile')}
        <div className="kh-navstrip">
            <nav className="kh-topnav" aria-label="التنقل الرئيسي">
                {links.map((l) => <Link key={l.to} to={l.to} className={pathname === l.to ? 'is-active' : ''} onClick={() => { setSelectedId(null); if (l.to === '/') setCat('الكل'); window.scrollTo(0, 0); }}>{l.label}</Link>)}
            </nav>
            {userPhoneH === ADMIN_PHONE && userChip('kh-ub-desktop')}
            <span className="kh-navnote"><Icon name="truck" size={16} /> توصيل مجاني على كل الطلبات، 24 ساعة</span>
        </div>
    </header>;
}

function NotificationsPage() {
    const { items, markSeen } = React.useContext(NotifContext);
    const [perm, setPerm] = useState<string>(() => ('Notification' in window ? Notification.permission : 'unsupported'));
    React.useEffect(() => { markSeen(); }, [items.length]);
    return <>
        <ScrollTop />
        <p className="kh-section">الإشعارات</p>
        {perm === 'default' && <button type="button" className="kh-biglink" onClick={() => Notification.requestPermission().then((r) => setPerm(r))}>فعّل تنبيهات المتصفح</button>}
        {items.length === 0 && <Caption>مفيش إشعارات لسه.</Caption>}
        {items.map((n) => <div className="kh-card kh-notif" key={n.id}>
            <span className="kh-notif-ico"><Icon name="bell" size={20} /></span>
            <div><strong>{n.title}</strong>{n.body !== '' && <p>{n.body}</p>}<small>{fmtTime(n.created_at)}</small></div>
        </div>)}
    </>;
}

function AdminLoyalty() {
    const [key] = useAdminKey();
    const [earn, setEarn] = useState('');
    const [val, setVal] = useState('');
    const [custs, setCusts] = useState<{ phone: string; balance: number; orders: number }[]>([]);
    const [state, setState] = useState<'idle' | 'ok' | 'err' | 'auth'>('idle');
    const load = () => adminCall<{ earn_per: number; point_value: number; customers: { phone: string; balance: number; orders: number }[] }>(key, 'loyalty-get')
        .then((d) => { setEarn(String(d.earn_per)); setVal(String(d.point_value)); setCusts(d.customers); })
        .catch((e) => setState(e.message === 'unauthorized' ? 'auth' : 'err'));
    React.useEffect(() => { load(); }, [key]);
    if (state === 'auth') return <AdminKeyError />;
    const num = (s: string) => Number(digitsOnly(s.replace(/[^0-9.٠-٩]/g, '')) === '' ? NaN : s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
    const ok = num(earn) > 0 && num(val) >= 0;
    return <>
        <ScrollTop />
        <AdminTabs active="loyalty" />
        <p className="kh-section">إعدادات نقاط الولاء</p>
        <div className="kh-card kh-add-form">
            <label className="kh-field"><span>كل كام جنيه من الأوردر = نقطة واحدة</span><input value={earn} onChange={(e) => setEarn(e.target.value)} inputMode="decimal" dir="ltr" style={{ textAlign: 'right' }} /></label>
            <label className="kh-field"><span>قيمة النقطة الواحدة بالجنيه عند الاستبدال</span><input value={val} onChange={(e) => setVal(e.target.value)} inputMode="decimal" dir="ltr" style={{ textAlign: 'right' }} /></label>
            <button type="button" className="kh-confirm kh-confirm-big" disabled={!ok} onClick={() => {
                adminCall(key, 'loyalty-set', { earn_per: num(earn), point_value: num(val) })
                    .then(() => { setState('ok'); window.setTimeout(() => setState('idle'), 2000); load(); })
                    .catch((e) => setState(e.message === 'unauthorized' ? 'auth' : 'err'));
            }}>{state === 'ok' ? '✓ اتحفظ' : 'احفظ الإعدادات'}</button>
            {state === 'err' && <Caption>تعذر الحفظ، حاول تاني.</Caption>}
            <Caption>النقاط بتتضاف للعميل لما الأوردر يتحول لـ "اتسلم".</Caption>
        </div>
        <p className="kh-section">نقاط العملاء ({custs.length.toLocaleString('en-US')})</p>
        {custs.length === 0 && <Caption>لسه مفيش عملاء معاهم نقاط.</Caption>}
        {custs.map((c) => <div className="kh-card kh-prod-row" key={c.phone}>
            <div className="kh-prod-info"><span className="kh-card-name"><bdi dir="ltr">{c.phone}</bdi></span><span className="kh-card-unit">{c.orders.toLocaleString('en-US')} أوردر</span></div>
            <strong>{c.balance.toLocaleString('en-US')} نقطة</strong>
        </div>)}
    </>;
}

function AdminFeatured() {
    const [key] = useAdminKey();
    const [ids, setIds] = useFeatured();
    const [text, setText] = useState('');
    const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');
    const res = text.trim() === '' ? [] : searchProducts(text, 8);
    const save = (next: string[]) => {
        setIds(next);
        setState('busy');
        adminCall(key, 'featured-set', { ids: next })
            .then(() => { setState('ok'); window.setTimeout(() => setState('idle'), 1800); })
            .catch(() => setState('err'));
    };
    const move = (i: number, d: number) => { const n = [...ids]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; save(n); };
    const items = ids.map((id) => BY_ID.get(id)).filter((p): p is CatalogItem => !!p);
    return <>
        <AdminTabs active="featured" />
        <section className="kh-ftp">
            <header className="kh-ftp-head">
                <span className="kh-ftp-ico"><Icon name="star" size={22} /></span>
                <div>
                    <h2>المنتجات المميزة</h2>
                    <p>اللي تضيفه هنا بيظهر أول حاجة في الرئيسية بنفس الترتيب.</p>
                </div>
            </header>
            <div className="kh-ftp-card">
                <label className="kh-ftp-search">
                    <Icon name="search" size={18} />
                    <input type="search" name="kh_feat_x7" autoComplete="off" readOnly onFocus={(e) => { e.currentTarget.readOnly = false; }} spellCheck={false} inputMode="search" value={text} onChange={(e) => setText(/^\+?\d{10,13}$/.test(e.target.value.trim()) ? '' : e.target.value)} placeholder="ابحث عن منتج عشان تضيفه..." aria-label="ابحث عن منتج" />
                </label>
                {res.length > 0 && <ul className="kh-ft-res">
                    {res.map((p) => {
                        const on = ids.includes(p.i);
                        return <li key={p.i}>
                            <span className="kh-ft-img"><ProdImg c={p.c} i={p.i} loading="lazy" /></span>
                            <span className="kh-ft-name">{p.n}<small>{CAT_NAMES[p.c]} · {fmtPrice(p.p)} ج.م</small></span>
                            <button type="button" className={`kh-ft-add${on ? ' is-on' : ''}`} disabled={on} onClick={() => save([...ids, p.i])}>{on ? '✓ مضاف' : '+ إضافة'}</button>
                        </li>;
                    })}
                </ul>}
            </div>
            <div className="kh-ftp-sub">
                <strong>المختارة <b>{items.length.toLocaleString('en-US')}</b></strong>
                <span className="kh-ft-state">{state === 'busy' ? 'جاري الحفظ…' : state === 'ok' ? '✓ تم الحفظ' : state === 'err' ? 'تعذر الحفظ' : ''}</span>
            </div>
            {items.length === 0
                ? <div className="kh-ftp-empty"><Icon name="star" size={28} /><span>مفيش منتجات مختارة. الرئيسية بتعرض المنتجات زي ما هي.</span></div>
                : <ol className="kh-ft-list">
                    {items.map((p, i) => <li key={p.i}>
                        <span className="kh-ft-n">{(i + 1).toLocaleString('en-US')}</span>
                        <span className="kh-ft-img"><ProdImg c={p.c} i={p.i} loading="lazy" /></span>
                        <span className="kh-ft-name">{p.n}<small>{CAT_NAMES[p.c]} · {fmtPrice(p.p)} ج.م</small></span>
                        <span className="kh-ft-ctl">
                            <button type="button" className="kh-ft-btn" aria-label="فوق" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
                            <button type="button" className="kh-ft-btn" aria-label="تحت" disabled={i === items.length - 1} onClick={() => move(i, 1)}>▼</button>
                            <button type="button" className="kh-ft-btn kh-ft-del" aria-label="حذف" onClick={() => save(ids.filter((x) => x !== p.i))}>✕</button>
                        </span>
                    </li>)}
                </ol>}
        </section>
    </>;
}

async function resizeToWebp(file: File): Promise<string> {
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('bad image')); im.src = url; });
        const max = 480;
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        if (!ctx) throw new Error('no canvas');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        for (const [type, q] of [['image/webp', 0.78], ['image/webp', 0.6], ['image/jpeg', 0.7], ['image/jpeg', 0.5]] as const) {
            const d = cv.toDataURL(type, q);
            if (d.startsWith(`data:${type}`) && d.length < 140000) return d;
        }
        throw new Error('too big');
    } finally { URL.revokeObjectURL(url); }
}

function PhotoBtn({ id }: { id: string }) {
    const [key] = useAdminKey();
    const [st, setSt] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');
    const [msg, setMsg] = useState('');
    useSyncPhotos();
    const has = PHOTO_IDS.has(id);
    const save = async (data: string) => {
        setSt('busy');
        try {
            await adminCall(key, 'photo-set', { id, data });
            if (data) { PHOTOS.set(id, data); PHOTO_IDS.add(id); } else { PHOTOS.delete(id); PHOTO_IDS.delete(id); }
            try { localStorage.setItem('kh_photo_ids', JSON.stringify([...PHOTO_IDS])); } catch { /* ignore */ }
            photoNotify(); setSt('ok'); setMsg(data ? 'تم حفظ الصورة' : 'تم مسح الصورة');
        } catch (e) { setSt('err'); setMsg((e as Error).message === 'unauthorized' ? 'مفتاح الأدمن غير صحيح' : 'تعذر الحفظ'); }
    };
    return <div className="kh-pb">
        <label className="kh-pb-up">
            <input type="file" accept="image/*" hidden onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = '';
                if (!f) return;
                try { await save(await resizeToWebp(f)); } catch { setSt('err'); setMsg('الصورة مش مقروءة'); }
            }} />
            {st === 'busy' ? 'جاري الرفع…' : has ? 'تغيير الصورة' : 'التقاط / رفع صورة'}
        </label>
        {has && <button type="button" className="kh-pb-del" onClick={() => void save('')}>مسح</button>}
        {msg !== '' && st !== 'busy' && <span className={`kh-pb-msg${st === 'err' ? ' is-err' : ''}`}>{msg}</span>}
    </div>;
}

function useSyncPhotos() { React.useSyncExternalStore(photoSub, photoSnap); }

function AdminPhotos() {
    useSyncPhotos();
    const [text, setText] = useState('');
    const res = text.trim() === '' ? [] : searchProducts(text, 8);
    const mine = [...PHOTO_IDS].map((id) => BY_ID.get(id)).filter((p): p is CatalogItem => !!p);
    return <>
        <AdminTabs active="photos" />
        <section className="kh-ftp">
            <header className="kh-ftp-head">
                <span className="kh-ftp-ico"><Icon name="camera" size={22} /></span>
                <div>
                    <h2>صور المنتجات</h2>
                    <p>اختار المنتج وصوّر العلبة بالموبايل. الصورة بتتصغّر لوحدها وتظهر للعملاء على طول.</p>
                </div>
            </header>
            <div className="kh-ftp-card">
                <label className="kh-ftp-search">
                    <Icon name="search" size={18} />
                    <input type="search" name="kh_photo_x5" autoComplete="off" readOnly onFocus={(e) => { e.currentTarget.readOnly = false; }} spellCheck={false} inputMode="search" value={text} onChange={(e) => setText(/^\+?\d{10,13}$/.test(e.target.value.trim()) ? '' : e.target.value)} placeholder="ابحث عن منتج..." aria-label="ابحث عن منتج" />
                </label>
                {res.length > 0 && <ul className="kh-ft-res">
                    {res.map((p) => <li key={p.i} className="kh-ph-li">
                        <span className="kh-ft-img"><ProdImg c={p.c} i={p.i} /></span>
                        <span className="kh-ft-name">{p.n}<small>{CAT_NAMES[p.c]}</small></span>
                        <PhotoBtn id={p.i} />
                    </li>)}
                </ul>}
            </div>
            <div className="kh-ftp-sub"><strong>الصور المرفوعة <b>{mine.length.toLocaleString('en-US')}</b></strong></div>
            {mine.length === 0
                ? <div className="kh-ftp-empty"><Icon name="camera" size={28} /><span>لسه مفيش صور. ابحث عن منتج وارفع صورته.</span></div>
                : <ul className="kh-ft-list kh-ph-list">{mine.map((p) => <li key={p.i}>
                    <span className="kh-ft-img"><ProdImg c={p.c} i={p.i} /></span>
                    <span className="kh-ft-name">{p.n}<small>{CAT_NAMES[p.c]}</small></span>
                    <PhotoBtn id={p.i} />
                </li>)}</ul>}
        </section>
    </>;
}

function AdminNotify() {
    const [key] = useAdminKey();
    const notif = React.useContext(NotifContext);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'err' | 'auth'>('idle');
    const publish = () => {
        setState('busy');
        adminCall(key, 'publish-notification', { title: title.trim(), body: body.trim() })
            .then(() => { setTitle(''); setBody(''); setState('ok'); notif.reload(); window.setTimeout(() => setState('idle'), 2500); })
            .catch((e) => setState(e.message === 'unauthorized' ? 'auth' : 'err'));
    };
    const [ann, setAnn] = useState('');
    const [annState, setAnnState] = useState<'idle' | 'busy' | 'ok' | 'cleared' | 'err'>('idle');
    React.useEffect(() => { getAnnouncement().then((t) => { if (t !== null) setAnn(t); }).catch(() => {}); }, []);
    const saveAnn = (text: string) => {
        setAnnState('busy');
        adminCall(key, 'announce-set', { text })
            .then(() => { setAnn(text); setAnnState(text === '' ? 'cleared' : 'ok'); window.setTimeout(() => setAnnState('idle'), 2500); })
            .catch((e) => setAnnState(e.message === 'unauthorized' ? 'err' : 'err'));
    };
    const remove = (id: number) => { adminCall(key, 'delete-notification', { id }).then(() => notif.reload()).catch(() => {}); };
    if (state === 'auth') return <AdminKeyError />;
    return <>
        <ScrollTop />
        <AdminTabs active="notify" />
        <p className="kh-section">إعلان أعلى الموقع</p>
        <div className="kh-card kh-add-form">
            <label className="kh-field"><span>نص الإعلان (بيظهر لكل الزوار فوق الموقع أول ما يفتحوه)</span>
                <textarea value={ann} onChange={(e) => setAnn(e.target.value)} rows={3} maxLength={300} placeholder="مثال: خصم 20% على الفيتامينات لحد الجمعة" /></label>
            <div className="kh-drv-row">
                <button type="button" className="kh-confirm" disabled={ann.trim() === '' || annState === 'busy'} onClick={() => saveAnn(ann.trim())}>{annState === 'ok' ? '✓ اتنشر' : 'نشر الإعلان'}</button>
                <button type="button" className="kh-biglink" disabled={annState === 'busy'} onClick={() => saveAnn('')}>{annState === 'cleared' ? '✓ اتشال' : 'شيل الإعلان'}</button>
            </div>
            {annState === 'err' && <Caption>تعذر الحفظ، حاول تاني.</Caption>}
        </div>
        <p className="kh-section">نشر إشعار لكل العملاء</p>
        <div className="kh-card kh-add-form">
            <label className="kh-field"><span>عنوان الإشعار</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: خصم 20% على الفيتامينات" /></label>
            <label className="kh-field"><span>النص (اختياري)</span><input value={body} onChange={(e) => setBody(e.target.value)} placeholder="تفاصيل الإشعار" /></label>
            <button type="button" className="kh-confirm kh-confirm-big" disabled={title.trim() === '' || state === 'busy'} onClick={publish}>{state === 'ok' ? '✓ اتنشر لكل العملاء' : state === 'busy' ? 'جاري النشر...' : 'انشر الإشعار'}</button>
            {state === 'err' && <Caption>تعذر النشر، حاول تاني.</Caption>}
        </div>
        <p className="kh-section">الإشعارات المنشورة</p>
        {notif.items.length === 0 && <Caption>لسه ما نشرتش أي إشعار.</Caption>}
        {notif.items.map((n) => <div className="kh-card kh-notif" key={n.id}>
            <span className="kh-notif-ico"><Icon name="bell" size={20} /></span>
            <div><strong>{n.title}</strong>{n.body !== '' && <p>{n.body}</p>}<small>{fmtTime(n.created_at)}</small></div>
            <button type="button" className="kh-notif-del" onClick={() => remove(n.id)}>حذف</button>
        </div>)}
    </>;
}

function CartBar() {
    const cart = useCart();
    if (cart.count === 0) return null;
    return <Link to="/cart" className="kh-cartbar">
        <span>عرض السلة ({cart.count.toLocaleString('en-US')})</span>
        <span>{egp(cart.total)}</span>
    </Link>;
}

function SuggAdd({ id }: { id: string }) {
    const cart = useCart();
    const [added, setAdded] = useState(false);
    const timer = useRef<number | undefined>(undefined);
    return <button
        type="button"
        className={`kh-sugg-add${added ? ' is-added' : ''}`}
        aria-label="أضف للسلة"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
            e.stopPropagation();
            cart.add(id);
            setAdded(true);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setAdded(false), 1400);
        }}
    >{added ? <Icon name="check" size={18} /> : <Icon name="cart" size={18} />}</button>;
}

function AddButton({ id }: { id: string }) {
    const cart = useCart();
    const [added, setAdded] = useState(false);
    const timer = useRef<number | undefined>(undefined);
    return <button
        type="button"
        className={`kh-add${added ? ' is-added' : ''}`}
        onClick={() => {
            cart.add(id);
            setAdded(true);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setAdded(false), 1600);
        }}
    >{added ? '✓ اتضاف في السلة' : <><Icon name="cart" size={17} /> أضف للسلة</>}</button>;
}

const CAT_PHOTOS: string[][] = [[c0_1, c0_2], [c1_1, c1_2, c1_3], [c2_1, c2_2, c2_3], [c3_1, c3_2], [c4_1, c4_2]];
// ===== Owner-uploaded product photos (small WebP, loaded lazily per visible product) =====
const PHOTOS = new Map<string, string>();
let PHOTO_IDS = new Set<string>();
try { PHOTO_IDS = new Set(JSON.parse(localStorage.getItem('kh_photo_ids') ?? '[]') as string[]); } catch { /* ignore */ }
let photoVer = 0;
const photoSubs = new Set<() => void>();
const photoNotify = () => { photoVer++; photoSubs.forEach((f) => f()); };
const photoSub = (f: () => void) => { photoSubs.add(f); return () => { photoSubs.delete(f); }; };
const photoSnap = () => photoVer;
const photoWanted = new Set<string>();
let photoTimer: number | undefined;
function requestPhoto(id: string) {
    if (PHOTOS.has(id) || photoWanted.has(id)) return;
    photoWanted.add(id);
    window.clearTimeout(photoTimer);
    photoTimer = window.setTimeout(async () => {
        const ids = [...photoWanted].slice(0, 30);
        ids.forEach((x) => photoWanted.delete(x));
        const got = await getPhotos(ids);
        if (got) { Object.entries(got).forEach(([k, v]) => PHOTOS.set(k, v)); photoNotify(); }
        if (photoWanted.size > 0) { const rest = [...photoWanted]; photoWanted.clear(); rest.forEach(requestPhoto); }
    }, 60);
}
function refreshPhotoIds() {
    getPhotoIds().then((ids) => {
        if (!ids) return;
        PHOTO_IDS = new Set(ids);
        try { localStorage.setItem('kh_photo_ids', JSON.stringify(ids)); } catch { /* ignore */ }
        [...PHOTOS.keys()].forEach((k) => { if (!PHOTO_IDS.has(k)) PHOTOS.delete(k); });
        photoNotify();
    }).catch(() => {});
}
function usePhotoSrc(c: number, id: string): string {
    React.useSyncExternalStore(photoSub, photoSnap);
    const has = PHOTO_IDS.has(id);
    const data = PHOTOS.get(id);
    if (has && !data) requestPhoto(id);
    return data ?? photoFor(c, id);
}
function ProdImg({ c, i, alt = '', loading }: { c: number; i: string; alt?: string; loading?: 'lazy' | 'eager' }) {
    return <img src={usePhotoSrc(c, i)} alt={alt} loading={loading} />;
}

function photoFor(c: number, id: string): string {
    const list = CAT_PHOTOS[c] ?? CAT_PHOTOS[0];
    return list[hashId(id) % list.length];
}
const CAT_ICON = ['pill', 'spray', 'vitamin', 'baby', 'stetho'] as const;

function CatTile({ c, size = 30 }: { c: number; size?: number }) {
    return <span className="kh-tile"><Icon name={CAT_ICON[c] ?? 'pill'} size={size} /></span>;
}

const FEAT_SET: { s: Set<string> } = { s: new Set() };
function ProductCard({ p }: { p: CatalogItem }) {
    const { setSelectedId } = useShop();
    const [ok, setOk] = useState(false);
    const feat = FEAT_SET.s.has(p.i);
    return <div className={`kh-card${feat ? ' is-feat' : ''}`}>
        <button type="button" className="kh-card-photo kh-card-tile" onClick={() => setSelectedId(p.i)} aria-label={p.n}>
            <img className={ok ? 'is-ok' : ''} src={usePhotoSrc(p.c, p.i)} alt="" loading="lazy" decoding="async" onLoad={() => setOk(true)} ref={(el) => { if (el && el.complete && !ok) setOk(true); }} />
            {feat && <span className="kh-badge-feat"><Icon name="star" size={12} /> مختار</span>}
            <span className="kh-badge-free"><Icon name="truck" size={12} /> مجاني</span>
        </button>
        <div className="kh-card-body">
            <span className="kh-card-unit">{CAT_NAMES[p.c]}</span>
            <button type="button" className="kh-card-name kh-name-btn" onClick={() => setSelectedId(p.i)}>{p.n}</button>
            <span className="kh-card-price"><bdi>{fmtPrice(p.p)}</bdi> <small>ج.م</small></span>
            <AddButton id={p.i} />
        </div>
    </div>;
}

function HeroCarousel() {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const touchX = useRef<number | null>(null);
    React.useEffect(() => {
        if (paused) return;
        const t = window.setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), 5500);
        return () => window.clearTimeout(t);
    }, [index, paused]);
    const go = (n: number) => setIndex((n + SLIDES.length) % SLIDES.length);
    const goToGrid = (e: React.MouseEvent<HTMLAnchorElement>, to: string) => {
        if (to !== '/#grid') return;
        e.preventDefault();
        document.getElementById('kh-grid')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
    return <div
        className="kh-hero"
        dir="ltr"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; setPaused(true); }}
        onTouchEnd={(e) => {
            const x0 = touchX.current;
            touchX.current = null;
            setPaused(false);
            if (x0 === null) return;
            const dx = e.changedTouches[0].clientX - x0;
            if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        }}
    >
        <div className="kh-hero-track" style={{ transform: `translateX(-${index * 100}%)` }}>
            {SLIDES.map((s, i) => <div key={s.title} className={`kh-slide${i === index ? ' is-on' : ''}`} dir="rtl" aria-hidden={i !== index}>
                {s.photo
                    ? <><img className="kh-slide-bg" src={s.photo} alt="" decoding="async" /><div className="kh-slide-shade" /></>
                    : <div className="kh-slide-art"><Icon name={s.icon} size={150} /></div>}
                <div className="kh-slide-text">
                    <em className="kh-slide-tag">{s.tag}</em>
                    <strong>{s.title}</strong>
                    <span>{s.sub}</span>
                    <Link to={s.to === '/#grid' ? '/' : s.to} className="kh-slide-cta" onClick={(e) => goToGrid(e, s.to)}>{s.cta} <Icon name="back" size={16} /></Link>
                </div>
            </div>)}
        </div>
        <button type="button" className="kh-hero-arrow kh-hero-prev" aria-label="السابق" onClick={() => go(index - 1)}><Icon name="back" size={18} /></button>
        <button type="button" className="kh-hero-arrow kh-hero-next" aria-label="التالي" onClick={() => go(index + 1)}><Icon name="back" size={18} /></button>
        <div className="kh-hero-dots">
            {SLIDES.map((s, i) => <button
                key={s.title}
                type="button"
                aria-label={`إعلان ${i + 1}`}
                className={i === index ? 'is-active' : ''}
                onClick={() => setIndex(i)}
            />)}
        </div>
    </div>;
}

const CATEGORY_ICONS: { cat: string; icon: keyof typeof PATHS }[] = [
    { cat: 'الأدوية', icon: 'pill' },
    { cat: 'العناية', icon: 'spray' },
    { cat: 'الفيتامينات', icon: 'vitamin' },
    { cat: 'الأم والطفل', icon: 'baby' },
    { cat: 'أجهزة طبية', icon: 'stetho' },
];

function CategoryRow() {
    const { cat, setCat } = useShop();
    return <div className="kh-cats" id="kh-cats">
        <div className="kh-sec-head"><p className="kh-section">تسوق حسب القسم</p></div>
        <div className="kh-cats-row">
            {CATEGORY_ICONS.map((c, ci) => <button
                key={c.cat}
                type="button"
                className={`kh-cat${c.cat === cat ? ' is-active' : ''}`}
                onClick={() => {
                    setCat(c.cat === cat ? 'الكل' : c.cat);
                    document.getElementById('kh-grid')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                }}
            >
                <span className="kh-cat-icon"><img src={CAT_PHOTOS[ci][0]} alt="" /></span>
                <span className="kh-cat-label">{c.cat}</span>
            </button>)}
        </div>
    </div>;
}

function Greeting() {
    const ph = useUserPhone();
    const [n, setN] = useState('');
    React.useEffect(() => { const f = () => { try { setN((ph && localStorage.getItem(nameKey(ph))) || ''); } catch { setN(''); } }; f(); window.addEventListener('kh-name', f); return () => window.removeEventListener('kh-name', f); }, [ph]);
    const h = new Date().getHours();
    const hi = h < 12 ? 'صباح الخير' : h < 18 ? 'نهارك سعيد' : 'مساء الخير';
    if (!n) return null;
    return <div className="kh-greet"><span>{hi}</span><b>{n}</b></div>;
}

function TrustStrip() {
    const items: { icon: keyof typeof PATHS; t: string; s: string }[] = [
        { icon: 'truck', t: 'توصيل مجاني', s: 'لكل الطلبات' },
        { icon: 'shield', t: 'متاحين دايماً', s: '24 ساعة' },
        { icon: 'star', t: 'نقاط ولاء', s: 'على كل طلب' },
        { icon: 'camera', t: 'ارفع روشتة', s: 'والصيدلي يتواصل' },
    ];
    return <div className="kh-trust">{items.map((x) => <div key={x.t} className="kh-trust-i"><span><Icon name={x.icon} size={18} /></span><b>{x.t}</b><em>{x.s}</em></div>)}</div>;
}

function RxBanner() {
    return <section className="kh-svc">
        <Link to="/prescription" className="kh-rx-banner">
            <span className="kh-rx-banner-icon"><Icon name="camera" size={30} /></span>
            <div className="kh-rx-banner-text">
                <strong>ارفع الروشتة وسيب الباقي علينا</strong>
                <span>صوّرها وابعتهالنا والصيدلي هيتواصل معاك</span>
            </div>
            <span className="kh-rx-banner-btn">ارفع الآن</span>
        </Link>
        <div className="kh-svc-foot">
            <Icon name="truck" size={20} />
            <strong>توصيل مجاني 24 ساعة</strong>
            <span>لأي طلب، لحد باب البيت</span>
        </div>
    </section>;
}

const GRID_PAGE = 48;

const FEAT_KEY = 'kh_featured';
function readFeat(): string[] { try { const v = JSON.parse(localStorage.getItem(FEAT_KEY) ?? '[]'); return Array.isArray(v) ? v.map(String) : []; } catch { return []; } }
function useFeatured(): [string[], (ids: string[]) => void] {
    const [ids, setIds] = useState<string[]>(readFeat);
    React.useEffect(() => {
        let alive = true;
        const load = () => { getFeatured().then((r) => { if (alive && r) { setIds(r); try { localStorage.setItem(FEAT_KEY, JSON.stringify(r)); } catch {} } }).catch(() => {}); };
        load();
        const onVis = () => { if (document.visibilityState === 'visible') load(); };
        document.addEventListener('visibilitychange', onVis);
        return () => { alive = false; document.removeEventListener('visibilitychange', onVis); };
    }, []);
    const set = (n: string[]) => { setIds(n); try { localStorage.setItem(FEAT_KEY, JSON.stringify(n)); } catch {} };
    return [ids, set];
}

function Shop() {
    const { cat, setCat, query } = useShop();
    const catVer = useCatalogVersion();
    const [limit, setLimit] = useState(GRID_PAGE);
    React.useEffect(() => setLimit(GRID_PAGE), [cat, query]);
    const q = query.trim().toLowerCase();
    const [featIds] = useFeatured();
    FEAT_SET.s = new Set(featIds);
    const ci = CAT_NAMES.indexOf(cat);
    React.useEffect(() => { live.want = cat !== 'الكل' || q !== ''; if (live.want && !isCatalogReady()) refreshCatalog(); return () => { live.want = false; }; }, [cat, q]);
    const base = useMemo(() => {
        let b: CatalogItem[] = cat === 'الكل' ? CATALOG : CATALOG.filter((p) => p.c === ci);
        if (q !== '') b = b.filter((p) => p.n.toLowerCase().includes(q));
        return b;
    }, [cat, q, catVer]);
    // Admin-curated picks first, in the admin's order; the rest keeps today's order. Only the visible page is built.
    const picks = q === '' ? featIds.map((id) => BY_ID.get(id)).filter((p): p is CatalogItem => !!p && (cat === 'الكل' || p.c === ci)) : [];
    const ps = new Set(picks.map((p) => p.i));
    const visible: CatalogItem[] = picks.slice(0, limit);
    for (let k = 0; k < base.length && visible.length < limit; k++) if (!ps.has(base[k].i)) visible.push(base[k]);
    const total = Math.max(base.length, picks.length);
    const shown = { length: total };
    const remaining = total - visible.length;
    return <>
        <ScrollTop />
        <Greeting />
        <HeroCarousel />
        <TrustStrip />
        <CategoryRow />
        <RxBanner />
        <CartBar />
        <div className="kh-grid-head" id="kh-grid">
            <p className="kh-section">{cat === 'الكل' ? 'الأكثر مبيعاً' : cat}</p><span className="kh-count">{shown.length.toLocaleString('en-US')} صنف</span>
            {cat !== 'الكل' && <button type="button" className="kh-linklike" onClick={() => setCat('الكل')}>عرض الكل</button>}
        </div>
        <div className="kh-chips">
            {CATEGORIES.map((c) => <button key={c} type="button" className={`kh-chip${c === cat ? ' is-active' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        {shown.length === 0
            ? <div className="kh-empty"><Paragraph>{isCatalogReady() ? 'مفيش منتجات مطابقة للبحث ده.' : 'جارٍ تحميل الأصناف…'}</Paragraph></div>
            : <div className="kh-grid">{visible.map((p) => <ProductCard key={p.i} p={p} />)}</div>}
        {remaining > 0 && <button type="button" className="kh-confirm kh-more" onClick={() => setLimit((l) => l + GRID_PAGE)}>
            عرض المزيد — باقي {remaining.toLocaleString('en-US')} صنف
        </button>}
        <CartBar />
    </>;
}

function BottomNav() {
    const { setSelectedId, setCat } = useShop();
    const { pathname } = useLocation();
    const { selectedId } = useShop();
    const items = [
        { to: '/', label: 'الرئيسية', icon: 'home' as const, on: pathname === '/' && selectedId === null, reset: true },
        { to: '/categories', label: 'الأقسام', icon: 'grid' as const, on: pathname === '/categories' && selectedId === null },
        { to: '/orders', label: 'الطلبات', icon: 'receipt' as const, on: pathname === '/orders' && selectedId === null },
        { to: '/account', label: 'حسابي', icon: 'user' as const, on: pathname === '/account' && selectedId === null },
    ];
    return <nav className="kh-bottomnav" aria-label="التنقل الرئيسي">
        {items.map((it) => <Link
            key={it.to}
            to={it.to}
            className={`kh-bn-item${it.on ? ' is-active' : ''}`}
            onClick={() => { setSelectedId(null); if (it.reset) setCat('الكل'); window.scrollTo(0, 0); }}
        ><Icon name={it.icon} /><span>{it.label}</span></Link>)}
    </nav>;
}

type SavedOrder = { id: string; at: string; phone: string; total: number; payment: string; items: { name: string; qty: number }[] };
function loadOrders(): SavedOrder[] {
    try { return JSON.parse(localStorage.getItem('kh_orders') ?? '[]') as SavedOrder[]; } catch { return []; }
}

const CUSTOMER_STEPS: { s: OrderStatus; label: string }[] = [
    { s: 'new', label: 'تم الاستلام' },
    { s: 'prep', label: 'قيد التحضير' },
    { s: 'out', label: 'مع الديليفري' },
    { s: 'done', label: 'اتسلم' },
];
type ShownOrder = { id: string; at: string; total: number; payment: string; status?: OrderStatus; driver?: string | null; items: { id?: string; name: string; qty: number }[] };
function OrdersPage() {
    const phone = useUserPhone();
    const navigate = useNavigate();
    const [remote, setRemote] = useState<ShownOrder[] | null>(null);
    React.useEffect(() => {
        if (!phone) return;
        let alive = true;
        const load = () => { myOrders(phone).then((r) => { if (alive && r) setRemote(r.map((o) => ({ id: `EK-${o.id}`, at: o.created_at, total: Number(o.total), payment: o.payment, status: o.status as OrderStatus, driver: o.driver_phone, items: o.items }))); }).catch(() => {}); };
        load();
        const t = window.setInterval(load, 20000);
        return () => { alive = false; window.clearInterval(t); };
    }, [phone]);
    const local: ShownOrder[] = loadOrders().filter((o) => o.phone === phone);
    const ids = new Set((remote ?? []).map((o) => o.id));
    const orders: ShownOrder[] = [...(remote ?? []), ...local.filter((o) => !ids.has(o.id))];
    return <div className="kh-catpage">
        <ScrollTop />
        <div className="kh-pg-head"><p className="kh-section">طلباتي</p>{orders.length > 0 && <span className="kh-count">{orders.length.toLocaleString('en-US')} طلب</span>}</div>
        {orders.length === 0
            ? <div className="kh-empty">
                <Icon name="receipt" size={44} />
                <Paragraph>لسه معملتش أي طلب. أول ما تطلب هتلاقيه هنا.</Paragraph>
                <button type="button" className="kh-confirm" onClick={() => navigate('/')}>ابدأ التسوق</button>
            </div>
            : <div className="kh-orders">
                {orders.map((o) => {
                    const idx = o.status ? CUSTOMER_STEPS.findIndex((x) => x.s === o.status) : -1;
                    return <div key={o.id} className="kh-order">
                        <div className="kh-order-top"><div className="kh-order-id"><strong>{o.id}</strong><span>{fmtTime(o.at)}</span></div>{idx >= 0 && <em className={`kh-pill kh-pill-${o.status}`}>{CUSTOMER_STEPS[idx].label}</em>}</div>
                        {idx >= 0 && <div className="kh-track">
                            {CUSTOMER_STEPS.map((st, k) => <div key={st.s} className={`kh-track-step${k < idx ? ' is-past' : ''}${k === idx ? ' is-now' : ''}`}><i>{k <= idx ? '✓' : ''}</i><span>{st.label}</span></div>)}
                        </div>}
                        {o.status === 'out' && o.driver && <a className="kh-driver" href={`tel:${o.driver}`}>
                            <span>رقم الديليفري</span><bdi dir="ltr">{o.driver}</bdi><b>اتصل</b>
                        </a>}
                        {o.status === 'out' && !o.driver && <p className="kh-driver-wait">طلبك مع الديليفري في الطريق ليك.</p>}
                        <div className="kh-order-items">{o.items.map((i, k) => {
                            const p = i.id ? BY_ID.get(i.id) : [...BY_ID.values()].find((q) => q.n === i.name);
                            return <div className="kh-oi" key={k}>
                                <span className="kh-oi-img">{p ? <ProdImg c={p.c} i={p.i} loading="lazy" /> : <Icon name="pill" size={28} />}</span>
                                <span className="kh-oi-name">{i.name}</span>
                                <span className="kh-oi-qty">×{i.qty.toLocaleString('en-US')}</span>
                            </div>;
                        })}</div>
                        <div className="kh-order-bot"><span>{o.payment === 'wallet' ? 'محفظة إلكترونية' : 'الدفع عند الاستلام'}</span><b>{egp(o.total)}</b></div>
                    </div>;
                })}
            </div>}
    </div>;
}

function CategoriesPage() {
    const { setCat } = useShop();
    const navigate = useNavigate();
    return <div className="kh-catpage">
        <ScrollTop />
        <p className="kh-section">كل الأقسام</p>
        <div className="kh-catpage-grid">
            {CATEGORY_ICONS.map((c, ci) => <button key={c.cat} type="button" className="kh-cat kh-cat-big" onClick={() => { setCat(c.cat); navigate('/'); }}>
                <span className="kh-cat-icon"><img src={CAT_PHOTOS[ci][0]} alt="" /></span>
                <span className="kh-cat-label">{c.cat}</span>
            </button>)}
        </div>
    </div>;
}

function LoyaltyCard() {
    const { info } = React.useContext(LoyaltyContext);
    if (!info) return null;
    return <div className="kh-card kh-loyalty">
        <span className="kh-loy-title">نقاط الولاء</span>
        <strong className="kh-loy-bal">{info.balance.toLocaleString('en-US')} <small>نقطة</small></strong>
        <span className="kh-loy-val">قيمتها {egp(info.balance * info.point_value)}</span>
        <Caption>بتكسب نقطة لكل {info.earn_per.toLocaleString('en-US')} جنيه من قيمة الأوردر بعد ما يتسلم، والنقطة بـ {egp(info.point_value)} وانت بتدفع.</Caption>
    </div>;
}

const nameKey = (phone: string | null) => `kh_name_${phone ?? ''}`;
function useUserName(phone: string | null): [string, (v: string) => void] {
    const [n, setN] = useState(() => { try { return (phone && localStorage.getItem(nameKey(phone))) || ''; } catch { return ''; } });
    React.useEffect(() => { try { setN((phone && localStorage.getItem(nameKey(phone))) || ''); } catch { setN(''); } }, [phone]);
    return [n, (v: string) => { setN(v); try { if (v) localStorage.setItem(nameKey(phone), v); else localStorage.removeItem(nameKey(phone)); window.dispatchEvent(new Event('kh-name')); } catch { /* ignore */ } }];
}

function AccountPage() {
    const [uname, setUname] = useUserName(useUserPhone());
    const [draft, setDraft] = useState('');
    const [editing, setEditing] = useState(false);
    const [saved, setSaved] = useState(false);
    const phone = useUserPhone();
    const setPhone = React.useContext(UserSetContext);
    const [, setAdminKeyHere] = useAdminKey();
    return <div className="kh-account">
        <ScrollTop />
        <div className="kh-account-card">
            <span className="kh-account-avatar"><Icon name="user" size={30} /></span>
            <strong>{uname || 'حسابي'}</strong>
            <span className="kh-account-phone"><bdi dir="ltr">{phone}</bdi></span>
        </div>
        {<div className="kh-name-card">
            <span className="kh-name-lbl">الاسم</span>
            {editing
                ? <form className="kh-name-form" onSubmit={(e) => { e.preventDefault(); setUname(draft.trim().slice(0, 40)); setEditing(false); setSaved(true); window.setTimeout(() => setSaved(false), 2000); }}>
                    <input name="kh_nm_x3" autoComplete="off" autoFocus maxLength={40} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="اكتب اسمك" aria-label="الاسم" />
                    <button type="submit" className="kh-name-save">حفظ</button>
                    <button type="button" className="kh-name-cancel" onClick={() => setEditing(false)}>إلغاء</button>
                </form>
                : <div className="kh-name-row">
                    <b>{uname || 'لسه ما أضفتش اسمك'}</b>
                    <button type="button" className="kh-name-edit" onClick={() => { setDraft(uname); setEditing(true); }}>{uname ? 'تعديل' : '+ إضافة الاسم'}</button>
                </div>}
            {saved && <span className="kh-name-ok">✓ تم حفظ الاسم</span>}
        </div>}
        <LoyaltyCard />
        <div className="kh-qlinks">
            <Link to="/orders"><Icon name="truck" size={20} /><span>طلباتي</span></Link>
            <Link to="/notifications"><Icon name="bell" size={20} /><span>الإشعارات</span></Link>
            <Link to="/prescription"><Icon name="camera" size={20} /><span>ارفع روشتة</span></Link>
        </div>
        {phone === ADMIN_PHONE && <Link className="kh-confirm kh-confirm-big" to="/admin">لوحة تحكم الأدمن</Link>}
        <button type="button" className="kh-biglink kh-logout" onClick={() => { if (phone === ADMIN_PHONE) setAdminKeyHere(''); setPhone(null); }}><Icon name="logout" size={18} /> تسجيل الخروج</button>
    </div>;
}

const REVIEWERS = ['أحمد سمير', 'منى عبد الله', 'محمود علي', 'هبة إبراهيم', 'كريم حسن', 'نورهان خالد', 'يوسف مصطفى', 'سارة محمد', 'عمرو فتحي', 'دعاء رضا', 'طارق عادل', 'ياسمين أشرف', 'مصطفى سعيد', 'رحاب نبيل'];
const REVIEW_TEXTS: { stars: number; text: string }[] = [
    { stars: 5, text: 'وصلني في نفس اليوم والتغليف كان سليم ومتقفل كويس. هطلب منكم تاني.' },
    { stars: 5, text: 'السعر ممتاز ومطابق للي في التطبيق، ومفيش أي مفاجآت وقت الدفع.' },
    { stars: 4, text: 'المنتج أصلي والتاريخ سليم. التوصيل اتأخر شوية بس الصيدلي اتصل واعتذر.' },
    { stars: 5, text: 'الصيدلي رد عليا بسرعة وفهمني طريقة الاستخدام. خدمة محترمة.' },
    { stars: 4, text: 'طلب سهل والتطبيق بسيط. كان نفسي تبقى فيه كمية أكبر بخصم.' },
    { stars: 5, text: 'تعاملت مع الصيدلية قبل كده وكل مرة نفس الجودة. أنصح بيها.' },
    { stars: 3, text: 'المنتج كويس بس الكرتونة وصلت مضغوطة شوية. المحتوى سليم.' },
    { stars: 5, text: 'الدليفري راجل محترم والطلب كان كامل زي ما طلبت بالظبط.' },
    { stars: 4, text: 'سعر أحسن من صيدليات تانية قريبة مني، وده فرق معايا.' },
    { stars: 5, text: 'طلبته لوالدتي ووصل بسرعة. شكراً على الاهتمام.' },
    { stars: 4, text: 'كل حاجة تمام، بس يا ريت تضيفوا صور أكتر للمنتجات.' },
    { stars: 5, text: 'أول مرة أطلب أونلاين من صيدلية وكانت تجربة سهلة جداً.' },
];
const REVIEW_AGE = ['منذ يومين', 'منذ 4 أيام', 'منذ أسبوع', 'منذ أسبوعين', 'منذ 3 أسابيع', 'منذ شهر'];

function hashId(id: string) {
    let h = 7;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return h;
}

function reviewsFor(id: string) {
    const h = hashId(id);
    const count = 3 + (h % 3);
    const list = [];
    const used = new Set<number>();
    for (let k = 0; k < count; k++) {
        let t = (h + k * 5 + (h >> 3) * k) % REVIEW_TEXTS.length;
        while (used.has(t)) t = (t + 1) % REVIEW_TEXTS.length;
        used.add(t);
        list.push({
            name: REVIEWERS[(h + k * 3 + (h >> 5)) % REVIEWERS.length],
            age: REVIEW_AGE[(h + k * 2) % REVIEW_AGE.length],
            ...REVIEW_TEXTS[t],
        });
    }
    return list;
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
    return <span className="kh-stars" dir="ltr" aria-label={`${value} من 5`}>
        {[1, 2, 3, 4, 5].map((n) => <svg key={n} width={size} height={size} viewBox="0 0 24 24" className={n <= Math.round(value) ? 'is-on' : ''}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></svg>)}
    </span>;
}

function relatedFor(product: CatalogItem): CatalogItem[] {
    const word = product.n.split(' ')[0].toLowerCase();
    const same = CATALOG.filter((x) => x.i !== product.i && x.c === product.c);
    const near = same.filter((x) => x.n.toLowerCase().includes(word));
    const h = hashId(product.i);
    const rest = same.filter((x) => !near.includes(x));
    const start = rest.length ? h % rest.length : 0;
    const spread = [...rest.slice(start), ...rest.slice(0, start)];
    return [...near, ...spread].slice(0, 8);
}

function ProductPage({ id }: { id: string }) {
    const cart = useCart();
    const { setSelectedId } = useShop();
    const product = BY_ID.get(id);
    const [adminKeyPdp] = useAdminKey();
    const [qty, setQty] = useState(1);
    const [pdpAdded, setPdpAdded] = useState(false);
    const pdpTimer = useRef<number | undefined>(undefined);
    React.useEffect(() => setQty(1), [id]);
    const reviews = useMemo(() => reviewsFor(id), [id]);
    const catReady = isCatalogReady();
    const related = useMemo(() => (product ? relatedFor(product) : []), [product, catReady]);
    useCatalogVersion();
    if (!product && !isCatalogReady()) return <div className="kh-empty"><Paragraph>جارٍ التحميل…</Paragraph></div>;
    if (!product) {
        return <div className="kh-empty">
            <Paragraph>المنتج ده مش موجود.</Paragraph>
            <button type="button" className="kh-biglink" onClick={() => setSelectedId(null)}>رجوع للمتجر</button>
        </div>;
    }
    const avg = reviews.reduce((a, r) => a + r.stars, 0) / reviews.length;
    const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.stars === n).length }));
    return <div className="kh-detail">
        <ScrollTop key={id} />
        <div className="kh-pdp-stage">
            <span className="kh-pdp-badge">{CAT_NAMES[product.c]}</span>
            <div className="kh-pdp-photo"><ProdImg c={product.c} i={product.i} alt={product.n} /></div>
        </div>
        {adminKeyPdp !== '' && <PhotoBtn id={product.i} />}
        <p className="kh-detail-name">{product.n}</p>
        <div className="kh-pdp-rate">
            <Stars value={avg} />
            <strong>{avg.toFixed(1)}</strong>
            <span>({reviews.length.toLocaleString('en-US')} تقييمات)</span>
        </div>
        <p className="kh-detail-price">{egp(product.p)}</p>
        <div className="kh-pdp-perks">
            <span><Icon name="truck" size={16} /> توصيل مجاني</span>
            <span><Icon name="shield" size={16} /> متاح للطلب</span>
            <span><Icon name="star" size={16} /> نقاط ولاء</span>
        </div>
        <div className="kh-qty-row">
            <div className="kh-qty" dir="ltr">
                <button type="button" aria-label="زود الكمية" onClick={() => setQty((q) => q + 1)}>+</button>
                <span>{qty.toLocaleString('en-US')}</span>
                <button type="button" aria-label="قلل الكمية" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
            </div>
            <button type="button" className={`kh-confirm${pdpAdded ? ' is-added' : ''}`} onClick={() => {
                cart.add(product.i, qty);
                setPdpAdded(true);
                window.clearTimeout(pdpTimer.current);
                pdpTimer.current = window.setTimeout(() => setPdpAdded(false), 1600);
            }}>
                {pdpAdded ? '✓ اتضاف في السلة' : <>أضف للسلة — {egp(product.p * qty)}</>}
            </button>
        </div>

        <p className="kh-pdp-h">تفاصيل المنتج</p>
        <dl className="kh-pdp-specs">
            <div><dt>اسم المنتج</dt><dd>{product.n}</dd></div>
            <div><dt>الفئة</dt><dd>{CAT_NAMES[product.c]}</dd></div>
            <div><dt>كود الصنف</dt><dd><bdi>{product.i}</bdi></dd></div>
            <div><dt>السعر</dt><dd>{egp(product.p)}</dd></div>
            <div><dt>التوفر</dt><dd>متاح للطلب من الصيدلية</dd></div>
            <div><dt>التوصيل</dt><dd>مجاني — 24 ساعة</dd></div>
        </dl>
        <div className="kh-pdp-note"><Icon name="stetho" size={20} /> لأي استفسار عن الاستخدام أو البدائل، الصيدلي بيرد عليك بعد الطلب.</div>

        <p className="kh-pdp-h">تقييمات العملاء</p>
        <div className="kh-rv-sum">
            <div className="kh-rv-score"><strong>{avg.toFixed(1)}</strong><Stars value={avg} size={16} /><span>{reviews.length.toLocaleString('en-US')} تقييمات</span></div>
            <div className="kh-rv-bars">
                {dist.map((d) => <div key={d.n} className="kh-rv-bar"><span>{d.n.toLocaleString('en-US')}</span><i><b style={{ width: `${(d.c / reviews.length) * 100}%` }} /></i></div>)}
            </div>
        </div>
        <div className="kh-rv-list">
            {reviews.map((r) => <div key={r.name + r.text} className="kh-rv">
                <div className="kh-rv-top"><span className="kh-rv-av">{r.name.charAt(0)}</span><div><strong>{r.name}</strong><small>{r.age}</small></div><Stars value={r.stars} /></div>
                <p>{r.text}</p>
            </div>)}
        </div>

        {related.length > 0 && <>
            <p className="kh-pdp-h">منتجات ذات صلة</p>
            <div className="kh-rel">
                {related.map((p) => <ProductCard key={p.i} p={p} />)}
            </div>
        </>}
        <button type="button" className="kh-biglink" onClick={() => setSelectedId(null)}>رجوع للمتجر</button>
    </div>;
}

function LoginPage({ onLogin, onCancel }: { onLogin: (phone: string) => void; onCancel?: () => void }) {
    const [phone, setPhone] = useState('');
    const [step, setStep] = useState<'phone' | 'login' | 'register' | 'legacy'>('phone');
    const [pass, setPass] = useState('');
    const [pass2, setPass2] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    const ph = digitsOnly(phone);
    const phoneReady = ph.length === 11;
    const reg = step === 'register' || step === 'legacy';
    const passOk = pass.length >= 6 && (!reg || pass === pass2);
    const next = async () => {
        setBusy(true); setMsg('');
        try {
            if (step === 'phone') {
                const st = await accountStatus(ph);
                setStep(st === 'has' ? 'login' : st === 'legacy' ? 'legacy' : 'register');
            } else if (reg) {
                const r = await accountRegister(ph, pass);
                if (r === 'ok') onLogin(ph);
                else if (r === 'exists') { setStep('login'); setMsg('الرقم ده عنده حساب. اكتب الباسورد.'); }
                else setMsg('الباسورد لازم يكون 6 حروف أو أرقام على الأقل.');
            } else {
                const r = await accountLogin(ph, pass);
                if (r === 'ok') onLogin(ph);
                else if (r === 'locked') setMsg('محاولات كتير غلط. جرب بعد 5 دقائق.');
                else setMsg('الباسورد غلط.');
            }
        } catch { setMsg('تعذر الاتصال. جرب تاني.'); }
        setBusy(false);
    };
    const heading = step === 'phone' ? 'أهلاً بيك' : step === 'login' ? 'سجّل دخولك' : step === 'legacy' ? 'اختار باسورد جديد' : 'اعمل حسابك';
    const sub = step === 'phone' ? 'اكتب رقم موبايلك للدخول أو لعمل حساب جديد.'
        : step === 'login' ? 'اكتب الباسورد بتاعك للدخول.'
        : step === 'legacy' ? 'حسابك متسجل عندنا من قبل. اختار باسورد جديد وأكده عشان نحمي طلباتك ونقاطك.'
        : 'حساب جديد: اختار باسورد وأكده.';
    const hint = msg !== '' ? msg : !phoneReady ? ''
        : step !== 'phone' && pass.length > 0 && pass.length < 6 ? 'الباسورد 6 حروف أو أرقام على الأقل.'
        : reg && pass2 !== '' && pass !== pass2 ? 'الباسورد وتأكيده مش متطابقين.' : '';
    return <div className="kh-lg">
        <ScrollTop />
        <div className="kh-lg-hero">
            <img src={logo} alt="لوجو صيدلية الخليل" className="kh-lg-logo" />
            <p className="kh-lg-brand">صيدلية <b>الخليل</b></p>
            <p className="kh-lg-tag">دواك وطلباتك لحد باب البيت</p>
        </div>
        <div className="kh-lg-card">
            <h2 className="kh-lg-h">{heading}</h2>
            <p className="kh-lg-p">{sub}</p>
            <label className="kh-field">
                <span>رقم الموبايل</span>
                <span className="kh-passwrap">
                    <span className="kh-fi"><Icon name="phone" size={19} /></span>
                    <input
                        value={phone}
                        onChange={(e) => { setPhone(digitsOnly(e.target.value)); setStep('phone'); setPass(''); setPass2(''); setMsg(''); }}
                        placeholder="01xxxxxxxxx"
                        inputMode="tel"
                        autoComplete="tel"
                        dir="ltr"
                        style={{ textAlign: 'right' }}
                    />
                </span>
            </label>
            {step !== 'phone' && <label className="kh-field">
                <span>الباسورد</span>
                <PassInput icon="lock" value={pass} onChange={setPass} autoComplete={reg ? 'new-password' : 'current-password'} />
            </label>}
            {reg && <label className="kh-field">
                <span>تأكيد الباسورد</span>
                <PassInput icon="lock" value={pass2} onChange={setPass2} autoComplete="new-password" />
            </label>}
            <button type="button" className="kh-confirm kh-confirm-big kh-lg-go" disabled={busy || !phoneReady || (step !== 'phone' && !passOk)} onClick={next}>
                {busy ? 'ثانية واحدة…' : step === 'phone' ? 'متابعة' : reg ? 'إنشاء الحساب' : 'دخول'}
            </button>
            <p className={`kh-lg-hint${hint !== '' ? ' is-on' : ''}`} role="status">{hint}</p>
        </div>
        <ul className="kh-lg-trust">
            <li><Icon name="truck" size={20} /><span>توصيل مجاني<br />24 ساعة</span></li>
            <li><Icon name="stetho" size={20} /><span>صيدلي بيراجع<br />طلبك</span></li>
            <li><Icon name="receipt" size={20} /><span>طلباتك ونقاطك<br />محفوظة</span></li>
        </ul>
        {onCancel && <button type="button" className="kh-biglink" onClick={onCancel}>رجوع للتصفح</button>}
    </div>;
}

function PrescriptionPage() {
    const userPhone = useUserPhone();
    const [preview, setPreview] = useState<string | null>(null);
    const [fileName, setFileName] = useState('');
    const [fileObj, setFileObj] = useState<File | null>(null);
    const [sending, setSending] = useState(false);
    const [sendErr, setSendErr] = useState('');
    const fileRef = useRef<HTMLInputElement | null>(null);

    const pickFile = (file: File | undefined) => {
        if (!file) return;
        setFileName(file.name);
        setFileObj(file);
        try { setPreview(URL.createObjectURL(file)); } catch {
            const reader = new FileReader();
            reader.onload = () => setPreview(typeof reader.result === 'string' ? reader.result : null);
            reader.readAsDataURL(file);
        }
    };

    const [altOk, setAltOk] = useState(true);
    const [callOk, setCallOk] = useState(false);
    const [notes, setNotes] = useState('');
    const [sent, setSent] = useState(false);
    if (sent) {
        return <div className="kh-success">
            <ScrollTop />
            <div className="kh-success-check">✓</div>
            <p className="kh-success-title">وصلتنا الروشتة!</p>
            <Paragraph>الصيدلي هيراجعها وهيتصل بيك على رقم موبايلك لتأكيد الطلب والتوصيل.</Paragraph>
            <button type="button" className="kh-biglink" onClick={() => { setSent(false); setPreview(null); setFileName(''); setFileObj(null); setNotes(''); }}>ارفع روشتة تانية</button>
            <Link className="kh-biglink" to="/">رجوع للمتجر</Link>
        </div>;
    }
    return <div className="kh-rx">
        <ScrollTop />
        <div className="kh-steps" dir="rtl">
            <span className="kh-step is-active">1. رفع الروشتة</span>
            <span className="kh-step">2. مراجعة الصيدلي</span>
            <span className="kh-step">3. اتصال وتوصيل</span>
        </div>
        <Paragraph>صوّر الروشتة أو ارفع صورتها وسيب رقمك، والصيدلي هيراجعها ويتصل بيك لتأكيد الطلب والتوصيل.</Paragraph>
        <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <button type="button" className="kh-upload" onClick={() => fileRef.current?.click()}>
            {preview
                ? <img src={preview} alt="معاينة الروشته" className="kh-upload-preview" />
                : <>
                    <span className="kh-upload-icon"><Icon name="camera" size={34} /></span>
                    <span className="kh-upload-label">اضغط هنا لتصوير أو رفع الروشتة</span>
                    <span className="kh-upload-hint">صورة واضحة للروشتة الطبية</span>
                </>}
        </button>
        {preview && <Caption>{fileName} — عايز تغيرها؟ دوس على الصورة فوق.</Caption>}
        <label className="kh-check" onClick={() => setAltOk(!altOk)}>
            <span className={`kh-checkbox${altOk ? ' is-on' : ''}`}>{altOk && <Icon name="check" size={14} />}</span>
            أريد بدائل أرخص إذا لم يتوفر
        </label>
        <label className="kh-check" onClick={() => setCallOk(!callOk)}>
            <span className={`kh-checkbox${callOk ? ' is-on' : ''}`}>{callOk && <Icon name="check" size={14} />}</span>
            اتصل بي لتأكيد الطلب
        </label>
        <textarea
            className="kh-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="أضف أي ملاحظات إضافية هنا..."
            rows={3}
        />
        {sendErr !== '' && <Caption>{sendErr}</Caption>}
        <button type="button" className="kh-confirm kh-confirm-big" disabled={!preview || sending} onClick={async () => {
            if (!fileObj) return;
            setSending(true);
            setSendErr('');
            try {
                await submitRx({ phone: userPhone, file: fileObj, want_substitutes: altOk, want_call: callOk, notes: notes.trim() });
                setSent(true);
                window.scrollTo(0, 0);
            } catch (e) {
                const m = e instanceof Error ? e.message : '';
                setSendErr(/bad photo/i.test(m) ? 'الصورة دي مش مقبولة. جرب صورة تانية (JPG أو PNG) أو صوّرها من جديد.' : 'حصلت مشكلة في إرسال الروشتة. جرب تاني.');
            } finally {
                setSending(false);
            }
        }}>{sending ? 'جاري الإرسال…' : 'إرسال الروشتة'}</button>
        <Link className="kh-biglink" to="/">رجوع للمتجر</Link>
    </div>;
}

function CartPage() {
    const cart = useCart();
    const userPhone = useUserPhone();
    const items = cart.items();
    const [name, setName] = useState(() => { try { return localStorage.getItem(nameKey(userPhone)) || ''; } catch { return ''; } });
    const [phone, setPhone] = useState(userPhone);
    const [address, setAddress] = useState('');
    const [pay, setPay] = useState('cod');
    const [orderId, setOrderId] = useState<string | null>(null);
    const [placing, setPlacing] = useState(false);
    const [orderErr, setOrderErr] = useState('');
    const loy = React.useContext(LoyaltyContext);
    const [usePts, setUsePts] = useState(false);

    if (orderId) {
        return <div className="kh-success">
            <div className="kh-success-check">✓</div>
            <p className="kh-success-title">تم استلام طلبك!</p>
            <Paragraph>شكراً يا {name || 'عميلنا'}، طلبك رقم <bdi>{orderId}</bdi> اتسجل وهنتواصل معاك على <bdi dir="ltr">{phone}</bdi> لتأكيد التوصيل.</Paragraph>
            <Link className="kh-biglink" to="/">كمل تسوق</Link>
        </div>;
    }
    if (items.length === 0) {
        return <div className="kh-empty">
            <p className="kh-success-title">السلة فاضية</p>
            <Paragraph>اختار اللي محتاجه من المتجر واضغط "أضف للسلة".</Paragraph>
            <Link className="kh-biglink" to="/">ابدأ التسوق</Link>
        </div>;
    }
    const subtotal = items.reduce((sum, item) => sum + item.product.p * item.qty, 0);
    const delivery = DELIVERY_FEE;
    const pv = loy.info?.point_value ?? 0;
    const redeemPts = usePts && loy.info && pv > 0 ? Math.min(loy.info.balance, Math.ceil(subtotal / pv)) : 0;
    const discount = Math.min(redeemPts * pv, subtotal);
    const payable = subtotal + delivery - discount;
    const ready = name.trim() !== '' && phone.trim() !== '' && address.trim() !== '';
    return <>
        <ScrollTop />
        <div className="kh-pg-head"><p className="kh-section">سلة المشتريات</p><span className="kh-count">{cart.count.toLocaleString('en-US')} منتج</span></div>
        <div className="kh-cart">
            {items.map(({ product, qty }) => <div className="kh-cart-row" key={product.i}>
                <span className="kh-cart-ph"><ProdImg c={product.c} i={product.i} loading="lazy" /></span>
                <div className="kh-cart-info">
                    <span className="kh-card-name">{product.n}</span>
                    <span className="kh-card-price">{egp(product.p * qty)}</span>
                </div>
                <div className="kh-qty" dir="ltr">
                    <button type="button" aria-label="زود الكمية" onClick={() => cart.set(product.i, qty + 1)}>+</button>
                    <span>{qty.toLocaleString('en-US')}</span>
                    <button type="button" aria-label={qty === 1 ? 'امسح من السلة' : 'قلل الكمية'} onClick={() => cart.set(product.i, qty - 1)}>{qty === 1 ? '×' : '−'}</button>
                </div>
            </div>)}
        </div>
        <div className="kh-totals">
            <div><span>المنتجات</span><span>{egp(subtotal)}</span></div>
            <div><span>التوصيل</span><span>{delivery === 0 ? 'مجاني' : egp(delivery)}</span></div>
            {discount > 0 && <div><span>خصم النقاط ({redeemPts.toLocaleString('en-US')} نقطة)</span><span>- {egp(discount)}</span></div>}
            <div className="kh-total"><span>الإجمالي</span><span>{egp(payable)}</span></div>
        </div>
        {loy.info && loy.info.balance > 0 && pv > 0 && <label className="kh-card kh-redeem">
            <input type="checkbox" checked={usePts} onChange={(e) => setUsePts(e.target.checked)} />
            <span>استخدم نقاطي: عندك {loy.info.balance.toLocaleString('en-US')} نقطة = {egp(loy.info.balance * pv)}</span>
        </label>}
        <div className="kh-free-note"><Icon name="truck" size={18} /> التوصيل مجاني على طلبك، وبيوصلك خلال 24 ساعة</div>
        <div className="kh-pg-head"><p className="kh-section">بيانات التوصيل</p></div>
        <div className="kh-formcard">
        <label className="kh-field">
            <span>الاسم</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اكتب اسمك" autoComplete="name" />
        </label>
        <label className="kh-field">
            <span>رقم الموبايل</span>
            <input value={phone} onChange={(e) => setPhone(digitsOnly(e.target.value))} placeholder="01xxxxxxxxx" inputMode="tel" autoComplete="tel" dir="ltr" style={{ textAlign: 'right' }} />
        </label>
        <label className="kh-field">
            <span>العنوان بالتفصيل</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="الشارع والمنطقة" autoComplete="street-address" />
        </label>
        </div>
        <div className="kh-pg-head"><p className="kh-section">طريقة الدفع</p></div>
        <div className="kh-chips kh-paygrid">
            <button type="button" className={`kh-chip kh-pay${pay === 'cod' ? ' is-active' : ''}`} onClick={() => setPay('cod')}>الدفع عند الاستلام</button>
            <button type="button" className={`kh-chip kh-pay${pay === 'wallet' ? ' is-active' : ''}`} onClick={() => setPay('wallet')}>محفظة إلكترونية</button>
        </div>
        {orderErr !== '' && <Caption>{orderErr}</Caption>}
        <button type="button" className="kh-confirm kh-confirm-big" disabled={!ready || placing} onClick={async () => {
            setPlacing(true);
            setOrderErr('');
            const payload = {
                customer_name: name.trim(),
                phone: digitsOnly(phone),
                address: address.trim(),
                payment: pay,
                items: items.map((it) => ({ id: it.product.i, name: it.product.n, qty: it.qty, price: it.product.p })),
                total: subtotal + delivery,
            };
            try {
                let id: number | null;
                if (userPhone !== '' && userPhone !== ADMIN_PHONE) {
                    const r = await placeOrder2({ ...payload, account: userPhone, redeem: redeemPts });
                    id = r === null ? null : r.id;
                    if (r) payload.total = r.total;
                    loy.reload();
                } else {
                    id = await placeOrder(payload);
                }
                const oid = id !== null ? `EK-${id}` : `EK-${Math.floor(1000 + Math.random() * 9000)}`;
                setOrderId(oid);
                try {
                    const prev = loadOrders();
                    localStorage.setItem('kh_orders', JSON.stringify([{ id: oid, at: new Date().toISOString(), phone: payload.phone, total: payload.total, payment: payload.payment, items: payload.items.map((x) => ({ id: x.id, name: x.name, qty: x.qty })) }, ...prev].slice(0, 50)));
                } catch {}
                cart.clear();
                window.scrollTo(0, 0);
            } catch {
                setOrderErr('حصلت مشكلة في إرسال الطلب. جرب تاني.');
            } finally {
                setPlacing(false);
            }
        }}>{placing ? 'جاري إرسال الطلب…' : `تأكيد الطلب — ${egp(payable)}`}</button>
        <Caption>{ready ? 'بالضغط على تأكيد بيتم تسجيل طلبك وهنتواصل معاك.' : 'املأ الاسم والموبايل والعنوان عشان تكمّل.'}</Caption>
    </>;
}


// ===== ADMIN DEMO DATA — SWAPPABLE =====
// In the real build these come from the backend (orders, prescriptions, products).

type OrderStatus = 'new' | 'prep' | 'out' | 'done';

const ORDER_STATUS: Record<OrderStatus, { label: string; cls: string }> = {
    new: { label: 'جديد', cls: 'kh-st-new' },
    prep: { label: 'قيد التحضير', cls: 'kh-st-prep' },
    out: { label: 'خرج للتوصيل', cls: 'kh-st-out' },
    done: { label: 'اتسلم', cls: 'kh-st-done' },
};

const STATUS_FLOW: OrderStatus[] = ['new', 'prep', 'out', 'done'];


type AdminState = {
    prices: Record<string, number>;
    stocks: Record<string, number>;
    saveProduct: (id: string, price: number, stock: number) => void;
    extraProducts: { id: string; name: string; cat: string; price: number; stock: number }[];
    addProduct: (name: string, cat: string, price: number, stock: number) => void;
};

const AdminContext = React.createContext<AdminState | null>(null);

function useAdmin() {
    const ctx = React.useContext(AdminContext);
    if (!ctx) throw new Error('admin context missing');
    return ctx;
}

function useAdminState(): AdminState {
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [stocks, setStocks] = useState<Record<string, number>>({});
    const [extraProducts, setExtraProducts] = useState<AdminState['extraProducts']>([]);
    return {
        prices,
        stocks,
        saveProduct: (id, price, stock) => {
            setPrices((p) => ({ ...p, [id]: price }));
            setStocks((s) => ({ ...s, [id]: stock }));
        },
        extraProducts,
        addProduct: (name, cat, price, stock) => setExtraProducts((l) => [
            ...l, { id: `x${l.length + 1}`, name, cat, price, stock },
        ]),
    };
}

// The pharmacy's admin key: entered once on the device, sent to the admin edge
// function on every admin call. Never shipped inside the bundle.
const AdminKeyContext = React.createContext<[string, (k: string) => void]>(['', () => {}]);
function useAdminKey() {
    return React.useContext(AdminKeyContext);
}


function AdminGate({ children }: { children: React.ReactNode }) {
    const phone = useUserPhone();
    const [key, setKey] = useAdminKey();
    const [draft, setDraft] = useState('');
    if (SUPABASE_READY && !key) {
        return <div className="kh-empty">
            <p className="kh-success-title">مفتاح الأدمن</p>
            <Paragraph>اكتب مفتاح الأدمن مرة واحدة، وبيفضل محفوظ على الجهاز ده.</Paragraph>
            <label className="kh-field">
                <span>المفتاح</span>
                <PassInput value={draft} onChange={setDraft} autoComplete="off" />
            </label>
            <button type="button" className="kh-confirm kh-confirm-big" disabled={draft.trim() === ''} onClick={() => setKey(draft.trim())}>حفظ ودخول</button>
            <Link className="kh-biglink" to="/">رجوع للمتجر</Link>
        </div>;
    }
    return <>{children}</>;
}

function StatusChip({ status }: { status: OrderStatus }) {
    const meta = ORDER_STATUS[status];
    return <span className={`kh-status ${meta.cls}`}>{meta.label}</span>;
}

function AdminTabs({ active }: { active: string }) {
    const tabs = [
        { to: '/admin', label: 'لوحة التحكم', key: 'home' },
        { to: '/admin/orders', label: 'الأوردرات', key: 'orders' },
        { to: '/admin/products', label: 'المنتجات', key: 'products' },
        { to: '/admin/featured', label: 'المميزة', key: 'featured' },
        { to: '/admin/photos', label: 'الصور', key: 'photos' },
        { to: '/admin/rx', label: 'الروشتات', key: 'rx' },
        { to: '/admin/notify', label: 'الإشعارات', key: 'notify' },
        { to: '/admin/loyalty', label: 'نقاط الولاء', key: 'loyalty' },
    ];
    return <div className="kh-adm-top">
        <div className="kh-adm-bar">
            <span className="kh-adm-title"><Icon name="shield" size={18} /> لوحة الأدمن</span>
            <Link className="kh-adm-back" to="/">المتجر <Icon name="back" size={14} /></Link>
        </div>
        <div className="kh-adm-tabs" role="tablist">
            {tabs.map((t) => <Link key={t.key} to={t.to} ref={(el) => { if (el && t.key === active) el.scrollIntoView({ inline: 'center', block: 'nearest' }); }} className={`kh-adm-tab${t.key === active ? ' is-active' : ''}`}>{t.label}</Link>)}
        </div>
    </div>;
}

function AdminHome() {
    const [key] = useAdminKey();
    const [stats, setStats] = useState<{ products: number; orders: number; prescriptions: number; today_revenue: number } | null>(null);
    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [err, setErr] = useState('');
    React.useEffect(() => {
        if (!SUPABASE_READY) return;
        adminCall<{ products: number; orders: number; prescriptions: number; today_revenue: number }>(key, 'stats')
            .then(setStats)
            .catch((e) => setErr(e.message === 'unauthorized' ? 'unauthorized' : 'تعذر تحميل البيانات'));
        adminCall<{ orders: OrderRow[] }>(key, 'list-orders').then((d) => setOrders(d.orders)).catch(() => {});
    }, [key]);
    if (err === 'unauthorized') return <AdminKeyError />;
    const newOrders = orders.filter((o) => o.status === 'new').length;
    return <>
        <ScrollTop />
        <AdminTabs active="home" />
        <p className="kh-section">نظرة عامة</p>
        <div className="kh-stats">
            <div className="kh-stat kh-stat-pink">
                <span className="kh-stat-icon">ط</span>
                <span className="kh-stat-label">كل الأوردرات</span>
                <strong>{(stats?.orders ?? 0).toLocaleString('en-US')}</strong>
            </div>
            <div className="kh-stat kh-stat-purple">
                <span className="kh-stat-icon">ج</span>
                <span className="kh-stat-label">مبيعات النهارده</span>
                <strong>{egp(stats?.today_revenue ?? 0)}</strong>
            </div>
            <div className="kh-stat kh-stat-amber">
                <span className="kh-stat-icon">ر</span>
                <span className="kh-stat-label">الروشتات الواردة</span>
                <strong>{(stats?.prescriptions ?? 0).toLocaleString('en-US')}</strong>
            </div>
            <div className="kh-stat kh-stat-blue">
                <span className="kh-stat-icon">ن</span>
                <span className="kh-stat-label">أوردرات مستنية</span>
                <strong>{newOrders.toLocaleString('en-US')}</strong>
            </div>
        </div>
        <p className="kh-section">آخر الأوردرات</p>
        {orders.length === 0 && <Caption>{SUPABASE_READY ? 'لسه مفيش أوردرات وصلت.' : 'الباك إند لسه مش متوصل — الأوردرات هتظهر هنا أول ما يتفعل.'}</Caption>}
        {orders.slice(0, 3).map((o) => <Link key={o.id} to={`/admin/order/${o.id}`} className="kh-order-row">
            <div className="kh-order-info">
                <strong>{o.customer_name}</strong>
                <span>{o.items.length.toLocaleString('en-US')} منتجات — {egp(o.total)}</span>
                <span className="kh-order-time">{fmtTime(o.created_at)}</span>
            </div>
            <StatusChip status={o.status} />
        </Link>)}
    </>;
}

function AdminKeyError() {
    const [, setKey] = useAdminKey();
    return <div className="kh-empty">
        <p className="kh-success-title">مفتاح الأدمن غلط</p>
        <Paragraph>المفتاح المحفوظ على الجهاز ده مش مظبوط. امسحه وادخله تاني.</Paragraph>
        <button type="button" className="kh-confirm kh-confirm-big" onClick={() => setKey('')}>إدخال المفتاح تاني</button>
        <Link className="kh-biglink" to="/">رجوع للمتجر</Link>
    </div>;
}

function AdminOrders() {
    const [key] = useAdminKey();
    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [err, setErr] = useState('');
    React.useEffect(() => {
        if (!SUPABASE_READY) return;
        adminCall<{ orders: OrderRow[] }>(key, 'list-orders')
            .then((d) => setOrders(d.orders))
            .catch((e) => setErr(e.message === 'unauthorized' ? 'unauthorized' : 'تعذر تحميل الأوردرات'));
    }, [key]);
    if (err === 'unauthorized') return <AdminKeyError />;
    return <>
        <ScrollTop />
        <AdminTabs active="orders" />
        <p className="kh-section">كل الأوردرات ({orders.length.toLocaleString('en-US')})</p>
        {orders.length === 0 && <Caption>لسه مفيش أوردرات.</Caption>}
        {orders.map((o) => <Link key={o.id} to={`/admin/order/${o.id}`} className="kh-order-row">
            <div className="kh-order-info">
                <strong>{o.customer_name}</strong>
                <span>{egp(o.total)}</span>
                <span className="kh-order-time"><bdi dir="ltr">{o.phone}</bdi> — {fmtTime(o.created_at)}</span>
            </div>
            <StatusChip status={o.status} />
        </Link>)}
    </>;
}

function AdminOrderDetail() {
    const { id } = useParams();
    const [key] = useAdminKey();
    const [order, setOrder] = useState<OrderRow | null>(null);
    const [err, setErr] = useState('');
    const [driver, setDriver] = useState('');
    const [driverSaved, setDriverSaved] = useState(false);
    React.useEffect(() => {
        if (!SUPABASE_READY) return;
        adminCall<string | null>(key, 'driver-get', { id }).then((d) => setDriver(d ?? '')).catch(() => {});
        adminCall<{ orders: OrderRow[] }>(key, 'list-orders')
            .then((d) => setOrder(d.orders.find((o) => String(o.id) === id) ?? null))
            .catch((e) => setErr(e.message === 'unauthorized' ? 'unauthorized' : 'تعذر تحميل الأوردر'));
    }, [key, id]);
    if (err === 'unauthorized') return <AdminKeyError />;
    if (!order) return <div className="kh-empty"><Paragraph>{SUPABASE_READY ? 'جاري التحميل…' : 'الأوردر ده مش موجود.'}</Paragraph></div>;
    const status = order.status;
    const subtotal = order.items.reduce((sum, it) => sum + it.price * it.qty, 0);
    const delivery = DELIVERY_FEE;
    const isLast = STATUS_FLOW.indexOf(status) === STATUS_FLOW.length - 1;
    const advance = () => {
        const next = STATUS_FLOW[Math.min(STATUS_FLOW.indexOf(status) + 1, STATUS_FLOW.length - 1)];
        setOrder({ ...order, status: next });
        adminCall(key, 'set-order-status', { id: order.id, status: next }).catch(() => {});
    };
    return <>
        <ScrollTop />
        <AdminTabs active="orders" />
        <div className="kh-order-head">
            <p className="kh-section">أوردر {order.customer_name}</p>
            <StatusChip status={status} />
        </div>
        <div className="kh-cart">
            {order.items.map((it) => {
                const p = BY_ID.get(it.id);
                return <div className="kh-cart-row" key={it.id}>
                    <span className="kh-aph">{p ? <ProdImg c={p.c} i={p.i} /> : null}</span>
                    <div className="kh-cart-info">
                        <span className="kh-card-name">{it.name}</span>
                        <span className="kh-card-unit">الكمية: {it.qty.toLocaleString('en-US')}</span>
                    </div>
                    <span className="kh-card-price">{egp(it.price * it.qty)}</span>
                </div>;
            })}
        </div>
        <div className="kh-totals">
            <div><span>المنتجات</span><span>{egp(subtotal)}</span></div>
            <div><span>التوصيل</span><span>{delivery === 0 ? 'مجاني' : egp(delivery)}</span></div>
            <div className="kh-total"><span>الإجمالي</span><span>{egp(subtotal + delivery)}</span></div>
        </div>
        <div className="kh-card kh-order-customer">
            <strong>{order.customer_name}</strong>
            <span><bdi dir="ltr">{order.phone}</bdi></span>
            <span>{order.address}</span>
            <span className="kh-order-time">{fmtTime(order.created_at)} — {order.payment === 'wallet' ? 'محفظة إلكترونية' : 'الدفع عند الاستلام'}</span>
        </div>
        <a className="kh-confirm kh-call" href={`tel:${order.phone}`}>اتصل بالعميل</a>
        <div className="kh-card kh-drv-box">
            <strong>حالة الأوردر (بتظهر للعميل)</strong>
            <div className="kh-drv-steps">
                {STATUS_FLOW.map((st) => <button type="button" key={st} className={`kh-chip${status === st ? ' is-active' : ''}`} onClick={() => { setOrder({ ...order, status: st }); adminCall(key, 'set-order-status', { id: order.id, status: st }).catch(() => {}); }}>{ORDER_STATUS[st].label}</button>)}
            </div>
            <strong>رقم الديليفري (بيظهر للعميل لما الأوردر يخرج)</strong>
            <div className="kh-drv-row">
                <input type="tel" inputMode="tel" dir="ltr" placeholder="01xxxxxxxxx" value={driver} onChange={(e) => { setDriver(e.target.value); setDriverSaved(false); }} />
                <button type="button" className="kh-confirm" onClick={() => { adminCall(key, 'driver-set', { id: order.id, driver }).then(() => setDriverSaved(true)).catch(() => {}); }}>حفظ</button>
            </div>
            {driverSaved && <span className="kh-order-time">اتحفظ ✓</span>}
        </div>
        <button type="button" className="kh-confirm kh-confirm-big" disabled={isLast} onClick={advance}>
            {isLast ? 'الأوردر اتسلم ✓' : `نقل لـ "${ORDER_STATUS[STATUS_FLOW[STATUS_FLOW.indexOf(status) + 1]].label}"`}
        </button>
    </>;
}

function AdminProductRow({ p }: { p: CatalogItem }) {
    const admin = useAdmin();
    const [adminKey] = useAdminKey();
    const price = admin.prices[p.i] ?? p.p;
    const stock = admin.stocks[p.i] ?? 0;
    const [priceDraft, setPriceDraft] = useState(String(price));
    const [stockDraft, setStockDraft] = useState(String(stock));
    const [saved, setSaved] = useState(false);
    const dirty = priceDraft !== String(price) || digitsOnly(stockDraft) !== String(stock);
    return <div className="kh-card kh-prod-row">
        <span className="kh-thumb"><CatTile c={p.c} size={26} /></span>
        <div className="kh-prod-info">
            <strong>{p.n}</strong>
            <span className="kh-card-unit">{CAT_NAMES[p.c]}</span>
            <div className="kh-prod-inputs">
                <label>السعر<input value={priceDraft} onChange={(e) => { setPriceDraft(e.target.value.replace(/[^0-9.]/g, '')); setSaved(false); }} inputMode="decimal" dir="ltr" /></label>
                <label>المخزون<input value={stockDraft} onChange={(e) => { setStockDraft(digitsOnly(e.target.value)); setSaved(false); }} inputMode="numeric" dir="ltr" /></label>
            </div>
        </div>
        <button type="button" className="kh-confirm kh-save" disabled={!dirty && !saved} onClick={() => {
            const nextPrice = Number(priceDraft) || price;
            const nextStock = Number(digitsOnly(stockDraft)) || 0;
            admin.saveProduct(p.i, nextPrice, nextStock);
            applyOverrides([{ id: p.i, price: nextPrice }]);
            setSaved(true);
            if (SUPABASE_READY) adminCall(adminKey, 'save-product', { id: p.i, price: nextPrice, stock: nextStock }).catch(() => {});
        }}>{saved ? '✓' : 'حفظ'}</button>
    </div>;
}

const ADMIN_PAGE = 30;

function AdminProducts() {
    const admin = useAdmin();
    const [adminKey] = useAdminKey();
    const [name, setName] = useState('');
    const [cat, setCat] = useState(CATEGORIES[1]);
    const [price, setPrice] = useState('');
    const [stock, setStock] = useState('');
    const [added, setAdded] = useState(false);
    const [pq, setPq] = useState('');
    const [plimit, setPlimit] = useState(ADMIN_PAGE);
    React.useEffect(() => setPlimit(ADMIN_PAGE), [pq]);
    const q = pq.trim().toLowerCase();
    const filtered = q === '' ? CATALOG : CATALOG.filter((p) => p.n.toLowerCase().includes(q));
    const canAdd = name.trim() !== '' && digitsOnly(price) !== '' && digitsOnly(stock) !== '';
    return <>
        <ScrollTop />
        <AdminTabs active="products" />
        <p className="kh-section">المنتجات ({(CATALOG.length + admin.extraProducts.length).toLocaleString('en-US')})</p>
        <input className="kh-field-input kh-admin-search" value={pq} onChange={(e) => setPq(e.target.value)} placeholder="ابحث باسم الصنف…" />
        {filtered.slice(0, plimit).map((p) => <AdminProductRow key={p.i} p={p} />)}
        {filtered.length > plimit && <button type="button" className="kh-confirm kh-more" onClick={() => setPlimit((l) => l + ADMIN_PAGE)}>عرض المزيد — باقي {(filtered.length - plimit).toLocaleString('en-US')} صنف</button>}
        {admin.extraProducts.map((p) => <div className="kh-card kh-prod-row" key={p.id}>
            <div className="kh-thumb kh-thumb-empty">{p.name.trim().slice(0, 1)}</div>
            <div className="kh-prod-info">
                <strong>{p.name}</strong>
                <span className="kh-card-unit">{p.cat}</span>
                <span className="kh-card-price">{egp(p.price)} — مخزون {p.stock.toLocaleString('en-US')}</span>
            </div>
        </div>)}
        <p className="kh-section">أضف منتج جديد</p>
        <div className="kh-card kh-add-form">
            <label className="kh-field"><span>اسم المنتج</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: باراسيتامول 500 مجم" /></label>
            <label className="kh-field"><span>القسم</span>
                <div className="kh-chips">
                    {CATEGORIES.slice(1).map((c) => <button key={c} type="button" className={`kh-chip${c === cat ? ' is-active' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
                </div>
            </label>
            <label className="kh-field"><span>السعر (ج.م)</span><input value={price} onChange={(e) => setPrice(digitsOnly(e.target.value))} inputMode="numeric" dir="ltr" style={{ textAlign: 'right' }} placeholder="0" /></label>
            <label className="kh-field"><span>المخزون</span><input value={stock} onChange={(e) => setStock(digitsOnly(e.target.value))} inputMode="numeric" dir="ltr" style={{ textAlign: 'right' }} placeholder="0" /></label>
            <button type="button" className="kh-confirm kh-confirm-big" disabled={!canAdd} onClick={() => {
                const n = name.trim();
                const pr = Number(digitsOnly(price));
                const st = Number(digitsOnly(stock));
                admin.addProduct(n, cat, pr, st);
                if (SUPABASE_READY) adminCall(adminKey, 'add-product', { name: n, category: cat, price: pr, stock: st }).catch(() => {});
                setName(''); setPrice(''); setStock(''); setAdded(true);
                window.setTimeout(() => setAdded(false), 2000);
            }}>{added ? '✓ اتضاف' : 'أضف المنتج'}</button>
        </div>
    </>;
}

function AdminRx() {
    const [key] = useAdminKey();
    const [items, setItems] = useState<RxRow[]>([]);
    const [err, setErr] = useState('');
    React.useEffect(() => {
        if (!SUPABASE_READY) return;
        adminCall<{ prescriptions: RxRow[] }>(key, 'list-rx')
            .then((d) => setItems(d.prescriptions))
            .catch((e) => setErr(e.message === 'unauthorized' ? 'unauthorized' : 'تعذر تحميل الروشتات'));
    }, [key]);
    if (err === 'unauthorized') return <AdminKeyError />;
    const toggle = (r: RxRow) => {
        const next = r.status === 'done' ? 'new' : 'done';
        setItems((l) => l.map((x) => (x.id === r.id ? { ...x, status: next } : x)));
        adminCall(key, 'set-rx-status', { id: r.id, status: next }).catch(() => {});
    };
    return <>
        <ScrollTop />
        <AdminTabs active="rx" />
        <p className="kh-section">الروشتات الواردة ({items.length.toLocaleString('en-US')})</p>
        {items.length === 0 && <Caption>لسه مفيش روشتات وصلت.</Caption>}
        {items.map((r) => {
            const done = r.status === 'done';
            return <div className="kh-card kh-rx-card" key={r.id}>
                {r.photo_url
                    ? <a href={r.photo_url} onClick={(e) => { e.preventDefault(); fetch(r.photo_url!).then((x) => x.blob()).then((bl) => window.open(URL.createObjectURL(bl), '_blank')); }}><img className="kh-rx-thumb" src={r.photo_url} alt="صورة روشته" loading="lazy" decoding="async" width="96" height="128" /></a>
                    : <span className="kh-rx-thumb" />}
                <div className="kh-prod-info">
                    <strong><bdi dir="ltr">{r.phone}</bdi></strong>
                    <span className="kh-order-time">{fmtTime(r.created_at)}</span>
                    {r.notes !== '' && <span className="kh-card-unit">{r.notes}</span>}
                    <span className={`kh-status ${done ? 'kh-st-done' : 'kh-st-new'}`}>{done ? 'تم التواصل' : 'جديدة'}</span>
                </div>
                <div className="kh-rx-actions">
                    <a className="kh-confirm kh-call" href={`tel:${r.phone}`}>اتصل</a>
                    <button type="button" className="kh-biglink kh-rx-done-btn" onClick={() => toggle(r)}>{done ? 'رجعها جديدة' : 'تم التواصل'}</button>
                </div>
            </div>;
        })}
    </>;
}

function applyOverrides(list: { id: string; price: number }[]): boolean {
    let changed = false;
    for (const o of list) {
        const it = BY_ID.get(o.id);
        if (it && it.p !== o.price) { it.p = o.price; changed = true; }
    }
    return changed;
}

const SESSION_KEY = 'kh_session_phone';
function readSession(): string | null {
    try { const v = localStorage.getItem(SESSION_KEY); if (v) return v; } catch {}
    try { const m = document.cookie.match(/(?:^|; )kh_sp=(\d{10,15})/); if (m) return m[1]; } catch {}
    return null;
}
function writeSession(p: string | null) {
    try { p === null ? localStorage.removeItem(SESSION_KEY) : localStorage.setItem(SESSION_KEY, p); } catch {}
    try { document.cookie = p === null ? 'kh_sp=; Max-Age=0; path=/' : `kh_sp=${p}; Max-Age=315360000; path=/; SameSite=Lax`; } catch {}
    if (p !== null) { try { navigator.storage?.persist?.(); } catch {} }
}

export function App() {
    const { pathname } = useLocation();
    const [, setPriceTick] = useState(0);
    React.useEffect(() => { refreshPhotoIds(); const t = window.setInterval(refreshPhotoIds, 300000); return () => window.clearInterval(t); }, []);
    React.useEffect(() => {
        const run = () => { loadPriceOverrides().then((l) => { if (applyOverrides(l)) setPriceTick((t) => t + 1); }).catch(() => {}); };
        run();
        const t = window.setInterval(run, 300000);
        return () => window.clearInterval(t);
    }, []);
    const [notifItems, setNotifItems] = useState<NotifRow[]>([]);
    const [seenId, setSeenId] = useState<number>(() => { try { return Number(localStorage.getItem('kh_notif_seen') ?? '0'); } catch { return 0; } });
    const notifFirst = useRef(true);
    const reloadNotifs = React.useCallback(() => {
        loadNotifications().then((l) => {
            setNotifItems((prev) => {
                const known = prev.length ? prev[0].id : 0;
                if (!notifFirst.current && l.length && l[0].id > known && 'Notification' in window && Notification.permission === 'granted') {
                    try { new Notification(l[0].title, { body: l[0].body, icon: './icons/icon-192.png', dir: 'rtl', lang: 'ar' }); } catch {}
                }
                return l;
            });
            notifFirst.current = false;
        }).catch(() => {});
    }, []);
    React.useEffect(() => {
        reloadNotifs();
        const t = window.setInterval(reloadNotifs, 120000);
        return () => window.clearInterval(t);
    }, [reloadNotifs]);
    const notifState = useMemo<NotifState>(() => ({
        items: notifItems,
        unread: notifItems.filter((n) => n.id > seenId).length,
        markSeen: () => { const top = notifItems[0]?.id ?? 0; if (top > seenId) { setSeenId(top); try { localStorage.setItem('kh_notif_seen', String(top)); } catch {} } },
        reload: reloadNotifs,
    }), [notifItems, seenId, reloadNotifs]);
    const cartState = useCartState();
    const adminState = useAdminState();
    const [adminKey, setAdminKeyState] = useState<string>(() => {
        try { return localStorage.getItem('kh_admin_key') ?? ''; } catch { return ''; }
    });
    const setAdminKey = (k: string) => {
        try { k === '' ? localStorage.removeItem('kh_admin_key') : localStorage.setItem('kh_admin_key', k); } catch {}
        setAdminKeyState(k);
        if (k !== '') { try { void navigator.storage?.persist?.(); document.cookie = `kh_admin=1; max-age=315360000; path=/; SameSite=Lax`; } catch {} }
    };
    const [userPhone, setUserPhoneRaw] = useState<string | null>(() => readSession());
    // Session lives in localStorage: survives refresh and app updates, ends only on explicit logout.
    const setUserPhone = (p: string | null) => {
        writeSession(p);
        setUserPhoneRaw(p);
        if (p === null) { cartState.replace({}); cartLoaded.current = false; }
    };
    // A saved admin key is a permanent admin session: browse the whole site without a customer login.
    React.useEffect(() => { if (adminKey !== '' && userPhone === null) setUserPhone(ADMIN_PHONE); });
    // Admin mode only ever exists together with a saved admin key; a bare admin phone in storage is dropped.
    React.useEffect(() => { if (adminKey === '' && userPhone === ADMIN_PHONE) setUserPhone(null); });
    const [loginOpen, setLoginOpen] = useState(false);
    const goNav = useNavigate();
    const pendingAdd = useRef<{ id: string; qty: number } | null>(null);
    const [loyalty, setLoyalty] = useState<LoyaltyInfo | null>(null);
    const reloadLoyalty = React.useCallback(() => {
        if (!userPhone || userPhone === ADMIN_PHONE) { setLoyalty(null); return; }
        loyaltyInfo(userPhone).then(setLoyalty).catch(() => {});
    }, [userPhone]);
    React.useEffect(() => { reloadLoyalty(); }, [reloadLoyalty]);
    // Cart is saved per account on the server and restored on any device.
    const cartLoaded = useRef(false);
    React.useEffect(() => {
        if (!userPhone || userPhone === ADMIN_PHONE) return;
        let dead = false;
        cartLoaded.current = false;
        loadCart(userPhone).then((srv) => {
            if (dead) return;
            cartState.replace({ ...srv, ...(pendingAdd.current ? { [pendingAdd.current.id]: (srv[pendingAdd.current.id] ?? 0) + pendingAdd.current.qty } : {}) });
            pendingAdd.current = null;
            cartLoaded.current = true;
        }).catch(() => { cartLoaded.current = true; });
        return () => { dead = true; };
    }, [userPhone]);
    React.useEffect(() => {
        if (!userPhone || userPhone === ADMIN_PHONE || !cartLoaded.current) return;
        const t = window.setTimeout(() => { saveCart(userPhone, cartState.raw).catch(() => {}); }, 600);
        return () => window.clearTimeout(t);
    }, [cartState.raw, userPhone]);
    const guardedCart = useMemo(() => ({
        ...cartState,
        add: (id: string, qty = 1) => {
            if (userPhone === null) { pendingAdd.current = { id, qty }; setLoginOpen(true); return; }
            cartState.add(id, qty);
        },
    }), [cartState, userPhone]);
    const [cat, setCat] = useState('الكل');
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const catVerRoot = useCatalogVersion();
    const shopState = useMemo(() => ({ cat, setCat, query, setQuery, selectedId, setSelectedId }), [cat, query, selectedId, catVerRoot]);
    return <CartContext.Provider value={guardedCart}>
        <LoyaltyContext.Provider value={{ info: loyalty, reload: reloadLoyalty }}>
        <NotifContext.Provider value={notifState}>
        <AdminKeyContext.Provider value={[adminKey, setAdminKey]}>
        <AdminContext.Provider value={adminState}>
        <UserContext.Provider value={userPhone ?? ''}>
        <UserSetContext.Provider value={setUserPhone}>
        <ShopContext.Provider value={shopState}>
            <div className="kh-file">
                <div className="kh-app">
                <div id="kh-top" style={{ height: 0, overflow: 'hidden' }} aria-hidden="true" />
                <AnnounceBanner />
                <Header />
                <main className={`kh-main${pathname === '/' || pathname === '/categories' ? ' kh-main-wide' : ' kh-main-narrow'}`}>
                {userPhone === null && (loginOpen || !['/', '/categories', '/notifications'].includes(pathname) && !pathname.startsWith('/admin'))
                    ? <LoginPage onLogin={(p) => { setUserPhone(p); setLoginOpen(false); setSelectedId(null); setCat('الكل'); setQuery(''); goNav('/'); window.scrollTo(0, 0); }} onCancel={loginOpen ? () => { pendingAdd.current = null; setLoginOpen(false); } : undefined} />
                    : selectedId !== null
                    ? <ProductPage id={selectedId} />
                    : <Routes>
                        <Route path="/" element={<Shop />} />
                        <Route path="/categories" element={<CategoriesPage />} />
                        <Route path="/account" element={<AccountPage />} />
                        <Route path="/orders" element={<OrdersPage />} />
                        <Route path="/cart" element={<CartPage />} />
                        <Route path="/prescription" element={<PrescriptionPage />} />
                        <Route path="/admin" element={<AdminGate><AdminHome /></AdminGate>} />
                        <Route path="/admin/orders" element={<AdminGate><AdminOrders /></AdminGate>} />
                        <Route path="/admin/order/:id" element={<AdminGate><AdminOrderDetail /></AdminGate>} />
                        <Route path="/admin/products" element={<AdminGate><AdminProducts /></AdminGate>} />
                        <Route path="/admin/rx" element={<AdminGate><AdminRx /></AdminGate>} />
                        <Route path="/admin/loyalty" element={<AdminGate><AdminLoyalty /></AdminGate>} />
                        <Route path="/admin/featured" element={<AdminGate><AdminFeatured /></AdminGate>} />
                        <Route path="/admin/photos" element={<AdminGate><AdminPhotos /></AdminGate>} />
                        <Route path="/admin/notify" element={<AdminGate><AdminNotify /></AdminGate>} />
                        <Route path="/notifications" element={<NotificationsPage />} />
                    </Routes>}
                </main>
                <BottomNav />
                <Closing>صيدلية الخليل — اطلب أونلاين والتوصيل لباب البيت. نوفمبر 2026.</Closing>
                </div>
            </div>
        </ShopContext.Provider>
        </UserSetContext.Provider>
        </UserContext.Provider>
        </AdminContext.Provider>
        </AdminKeyContext.Provider>
        </NotifContext.Provider>
        </LoyaltyContext.Provider>
    </CartContext.Provider>;
}
