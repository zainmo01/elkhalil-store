import React, { useMemo, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { SUPABASE_READY, placeOrder, submitRx, adminCall, fmtTime } from './lib/api';
import type { OrderRow, RxRow } from './lib/api';

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

// ===== REAL CATALOG (loaded from the pharmacy's item file) =====
// catalog.ts holds customer-safe fields only: id, name, sell price, category.
import { CATALOG } from './catalog';
import type { CatalogItem } from './catalog';

const CAT_NAMES = ['الأدوية', 'العناية', 'الفيتامينات', 'الأم والطفل', 'أجهزة طبية'];
const CATEGORIES = ['الكل', ...CAT_NAMES];
const BY_ID = new Map<string, CatalogItem>(CATALOG.map((x) => [x.i, x]));

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
        items: () => Object.entries(cart).flatMap(([id, qty]) => {
            const product = BY_ID.get(id);
            return product ? [{ product, qty }] : [];
        }),
    }), [cart]);
}

const CartContext = React.createContext<ReturnType<typeof useCartState> | null>(null);
const UserContext = React.createContext<string>('');
const UserSetContext = React.createContext<(p: string | null) => void>(() => {});
const ShopContext = React.createContext<{ cat: string; setCat: (c: string) => void; query: string; setQuery: (q: string) => void; selectedId: string | null; setSelectedId: (id: string | null) => void }>({ cat: 'الكل', setCat: () => {}, query: '', setQuery: () => {}, selectedId: null, setSelectedId: () => {} });

function useShop() { return React.useContext(ShopContext); }

// ===== ICONS (inline SVG — no emoji) =====
const PATHS: Record<string, React.ReactNode> = {
    cart: <><circle cx="9" cy="20" r="1.6" /><circle cx="17" cy="20" r="1.6" /><path d="M3 4h2l2.4 11h9.9l2-8H6" /></>,
    bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 19a2 2 0 0 0 4 0" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" /></>,
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
const SEARCH_INDEX = CATALOG.map((p) => ({ p, n: norm(p.n) }));

function searchProducts(q: string, max = 8): CatalogItem[] {
    const tokens = norm(q).trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];
    const starts: CatalogItem[] = [];
    const rest: CatalogItem[] = [];
    for (const e of SEARCH_INDEX) {
        if (!tokens.every((t) => e.n.includes(t))) continue;
        (e.n.startsWith(tokens[0]) ? starts : rest).push(e.p);
        if (starts.length >= max) break;
    }
    return [...starts, ...rest].slice(0, max);
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
                onChange={(e) => { setText(e.target.value); setOpen(true); if (e.target.value.trim() === '') setQuery(''); }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKey}
                placeholder="ابحث عن دواء أو منتج..."
                aria-label="ابحث في المتجر"
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
    const links = [
        { to: '/', label: 'الرئيسية' },
        { to: '/categories', label: 'الأقسام' },
        { to: '/orders', label: 'طلباتي' },
        { to: '/prescription', label: 'ارفع روشتة' },
        { to: '/account', label: 'حسابي' },
    ];
    return <header className="kh-header">
        <div className="kh-header-bar">
            <Link to="/" className="kh-brand">
                <img src={logo} alt="لوجو صيدلية الخليل" className="kh-brand-logo" />
                <span className="kh-brand-name">صيدلية <b>الخليل</b></span>
            </Link>
            <nav className="kh-topnav" aria-label="التنقل الرئيسي">
                {links.map((l) => <Link key={l.to} to={l.to} className={pathname === l.to ? 'is-active' : ''} onClick={() => { setSelectedId(null); if (l.to === '/') setCat('الكل'); window.scrollTo(0, 0); }}>{l.label}</Link>)}
            </nav>
            <SearchBox />
            <div className="kh-header-icons">
                <Link to="/account" className="kh-icon-btn" aria-label="حسابي"><Icon name="user" /></Link>
                <Link to="/cart" className="kh-icon-btn" aria-label="السلة">
                    <Icon name="cart" />
                    {cart.count > 0 && <b className="kh-badge">{cart.count.toLocaleString('en-US')}</b>}
                </Link>
                <span className="kh-icon-btn" aria-hidden="true"><Icon name="bell" /><i className="kh-dot" /></span>
            </div>
        </div>
    </header>;
}

function CartBar() {
    const cart = useCart();
    if (cart.count === 0) return null;
    return <Link to="/cart" className="kh-cartbar">
        <span>عرض السلة ({cart.count.toLocaleString('en-US')})</span>
        <span>{egp(cart.total)}</span>
    </Link>;
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

const CAT_ICON = ['pill', 'spray', 'vitamin', 'baby', 'stetho'] as const;

function CatTile({ c, size = 30 }: { c: number; size?: number }) {
    return <span className="kh-tile"><Icon name={CAT_ICON[c] ?? 'pill'} size={size} /></span>;
}

function ProductCard({ p }: { p: CatalogItem }) {
    const { setSelectedId } = useShop();
    return <div className="kh-card">
        <button type="button" className="kh-card-photo kh-card-tile" onClick={() => setSelectedId(p.i)} aria-label={p.n}><CatTile c={p.c} size={44} /></button>
        <div className="kh-card-body">
            <button type="button" className="kh-card-name kh-name-btn" onClick={() => setSelectedId(p.i)}>{p.n}</button>
            <span className="kh-card-unit">{CAT_NAMES[p.c]}</span>
            <span className="kh-card-price"><bdi>{fmtPrice(p.p)}</bdi> ج.م</span>
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
            {SLIDES.map((s, i) => <div key={s.title} className="kh-slide" dir="rtl" aria-hidden={i !== index}>
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
        <p className="kh-section">الفئات</p>
        <div className="kh-cats-row">
            {CATEGORY_ICONS.map((c) => <button
                key={c.cat}
                type="button"
                className={`kh-cat${c.cat === cat ? ' is-active' : ''}`}
                onClick={() => {
                    setCat(c.cat === cat ? 'الكل' : c.cat);
                    document.getElementById('kh-grid')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                }}
            >
                <span className="kh-cat-icon"><Icon name={c.icon} size={26} /></span>
                <span className="kh-cat-label">{c.cat}</span>
            </button>)}
        </div>
    </div>;
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

function Shop() {
    const { cat, setCat, query } = useShop();
    const [limit, setLimit] = useState(GRID_PAGE);
    React.useEffect(() => setLimit(GRID_PAGE), [cat, query]);
    const q = query.trim().toLowerCase();
    let shown = cat === 'الكل' ? CATALOG : CATALOG.filter((p) => p.c === CAT_NAMES.indexOf(cat));
    if (q !== '') shown = shown.filter((p) => p.n.toLowerCase().includes(q));
    const visible = shown.slice(0, limit);
    const remaining = shown.length - visible.length;
    return <>
        <ScrollTop />
        <HeroCarousel />
        <CategoryRow />
        <RxBanner />
        <CartBar />
        <div className="kh-grid-head" id="kh-grid">
            <p className="kh-section">{cat === 'الكل' ? 'الأكثر مبيعاً' : cat} <span className="kh-count">({shown.length.toLocaleString('en-US')} صنف)</span></p>
            {cat !== 'الكل' && <button type="button" className="kh-linklike" onClick={() => setCat('الكل')}>عرض الكل</button>}
        </div>
        <div className="kh-chips">
            {CATEGORIES.map((c) => <button key={c} type="button" className={`kh-chip${c === cat ? ' is-active' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        {shown.length === 0
            ? <div className="kh-empty"><Paragraph>مفيش منتجات مطابقة للبحث ده.</Paragraph></div>
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

function OrdersPage() {
    const phone = useUserPhone();
    const navigate = useNavigate();
    const orders = loadOrders().filter((o) => o.phone === phone);
    return <div className="kh-catpage">
        <ScrollTop />
        <p className="kh-section">طلباتي</p>
        {orders.length === 0
            ? <div className="kh-empty">
                <Icon name="receipt" size={44} />
                <Paragraph>لسه معملتش أي طلب. أول ما تطلب هتلاقيه هنا.</Paragraph>
                <button type="button" className="kh-confirm" onClick={() => navigate('/')}>ابدأ التسوق</button>
            </div>
            : <div className="kh-orders">
                {orders.map((o) => <div key={o.id} className="kh-order">
                    <div className="kh-order-top"><strong>{o.id}</strong><span>{fmtTime(o.at)}</span></div>
                    <p>{o.items.map((i) => `${i.name} ×${i.qty}`).join('، ')}</p>
                    <div className="kh-order-bot"><span>{o.payment}</span><b>{egp(o.total)}</b></div>
                </div>)}
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
            {CATEGORY_ICONS.map((c) => <button key={c.cat} type="button" className="kh-cat kh-cat-big" onClick={() => { setCat(c.cat); navigate('/'); }}>
                <span className="kh-cat-icon"><Icon name={c.icon} size={30} /></span>
                <span className="kh-cat-label">{c.cat}</span>
            </button>)}
        </div>
    </div>;
}

function AccountPage() {
    const phone = useUserPhone();
    const setPhone = React.useContext(UserSetContext);
    return <div className="kh-account">
        <ScrollTop />
        <div className="kh-account-card">
            <span className="kh-account-avatar"><Icon name="user" size={30} /></span>
            <strong>حسابي</strong>
            <span className="kh-account-phone"><bdi dir="ltr">{phone}</bdi></span>
        </div>
        {phone === ADMIN_PHONE && <Link className="kh-confirm kh-confirm-big" to="/admin">لوحة تحكم الأدمن</Link>}
        <button type="button" className="kh-biglink kh-logout" onClick={() => setPhone(null)}><Icon name="logout" size={18} /> تسجيل الخروج</button>
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
    const [qty, setQty] = useState(1);
    React.useEffect(() => setQty(1), [id]);
    const reviews = useMemo(() => reviewsFor(id), [id]);
    const related = useMemo(() => (product ? relatedFor(product) : []), [product]);
    if (!product) {
        return <div className="kh-empty">
            <Paragraph>المنتج ده مش موجود.</Paragraph>
            <button type="button" className="kh-biglink" onClick={() => setSelectedId(null)}>رجوع للمتجر</button>
        </div>;
    }
    const avg = reviews.reduce((a, r) => a + r.stars, 0) / reviews.length;
    const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.stars === n).length }));
    return <div className="kh-detail">
        <ScrollTop />
        <div className="kh-pdp-stage">
            <span className="kh-pdp-badge">{CAT_NAMES[product.c]}</span>
            <div className="kh-pdp-disc"><Icon name={CAT_ICON[product.c] ?? 'pill'} size={92} /></div>
        </div>
        <p className="kh-detail-name">{product.n}</p>
        <div className="kh-pdp-rate">
            <Stars value={avg} />
            <strong>{avg.toFixed(1)}</strong>
            <span>({reviews.length.toLocaleString('en-US')} تقييمات)</span>
        </div>
        <p className="kh-detail-price">{egp(product.p)}</p>
        <div className="kh-qty-row">
            <div className="kh-qty" dir="ltr">
                <button type="button" aria-label="زود الكمية" onClick={() => setQty((q) => q + 1)}>+</button>
                <span>{qty.toLocaleString('en-US')}</span>
                <button type="button" aria-label="قلل الكمية" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
            </div>
            <button type="button" className="kh-confirm" onClick={() => { cart.add(product.i, qty); setSelectedId(null); }}>
                أضف للسلة — {egp(product.p * qty)}
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

function LoginPage({ onLogin }: { onLogin: (phone: string) => void }) {
    const [phone, setPhone] = useState('');
    const phoneReady = digitsOnly(phone).length === 11;
    return <div className="kh-login">
        <ScrollTop />
        <img src={logo} alt="لوجو صيدلية الخليل" className="kh-login-logo" />
        <p className="kh-login-title">صيدلية <b>الخليل</b></p>
        <p className="kh-login-sub">مرحباً بك في صيدلية الخليل</p>
        <Paragraph>اكتب رقم موبايلك وهتدخل على طول. من غير إيميل ولا باسورد.</Paragraph>
        <label className="kh-field">
            <span>رقم الموبايل</span>
            <input
                value={phone}
                onChange={(e) => setPhone(digitsOnly(e.target.value))}
                placeholder="01xxxxxxxxx"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                style={{ textAlign: 'right' }}
            />
        </label>
        <button type="button" className="kh-confirm kh-confirm-big" disabled={!phoneReady} onClick={() => onLogin(digitsOnly(phone))}>
            دخول
        </button>
        <Caption>{phoneReady ? '' : 'رقم الموبايل 11 رقم وبيبدأ بـ 01.'}</Caption>
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
        const reader = new FileReader();
        reader.onload = () => setPreview(typeof reader.result === 'string' ? reader.result : null);
        reader.readAsDataURL(file);
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
            <span className="kh-step">2. التأكيد</span>
            <span className="kh-step">3. الاستلام</span>
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
            } catch {
                setSendErr('حصلت مشكلة في إرسال الروشتة. جرب تاني.');
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
    const [name, setName] = useState('');
    const [phone, setPhone] = useState(userPhone);
    const [address, setAddress] = useState('');
    const [pay, setPay] = useState('cod');
    const [orderId, setOrderId] = useState<string | null>(null);
    const [placing, setPlacing] = useState(false);
    const [orderErr, setOrderErr] = useState('');

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
    const ready = name.trim() !== '' && phone.trim() !== '' && address.trim() !== '';
    return <>
        <ScrollTop />
        <p className="kh-section">سلة المشتريات</p>
        <div className="kh-cart">
            {items.map(({ product, qty }) => <div className="kh-cart-row" key={product.i}>
                <span className="kh-line-photo kh-line-tile"><CatTile c={product.c} size={26} /></span>
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
            <div className="kh-total"><span>الإجمالي</span><span>{egp(subtotal + delivery)}</span></div>
        </div>
        <p className="kh-section">بيانات التوصيل</p>
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
        <p className="kh-section">طريقة الدفع</p>
        <div className="kh-chips">
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
                const id = await placeOrder(payload);
                const oid = id !== null ? `EK-${id}` : `EK-${Math.floor(1000 + Math.random() * 9000)}`;
                setOrderId(oid);
                try {
                    const prev = loadOrders();
                    localStorage.setItem('kh_orders', JSON.stringify([{ id: oid, at: new Date().toISOString(), phone: payload.phone, total: payload.total, payment: payload.payment, items: payload.items.map((x) => ({ name: x.name, qty: x.qty })) }, ...prev].slice(0, 50)));
                } catch {}
                cart.clear();
                window.scrollTo(0, 0);
            } catch {
                setOrderErr('حصلت مشكلة في إرسال الطلب. جرب تاني.');
            } finally {
                setPlacing(false);
            }
        }}>{placing ? 'جاري إرسال الطلب…' : `تأكيد الطلب — ${egp(subtotal + delivery)}`}</button>
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
    if (phone !== ADMIN_PHONE) {
        return <div className="kh-empty">
            <p className="kh-success-title">الصفحة دي للأدمن بس</p>
            <Paragraph>لوحة التحكم بتظهر لرقم الأدمن فقط.</Paragraph>
            <Link className="kh-biglink" to="/">رجوع للمتجر</Link>
        </div>;
    }
    if (SUPABASE_READY && !key) {
        return <div className="kh-empty">
            <p className="kh-success-title">مفتاح الأدمن</p>
            <Paragraph>اكتب مفتاح الأدمن مرة واحدة، وبيفضل محفوظ على الجهاز ده.</Paragraph>
            <label className="kh-field">
                <span>المفتاح</span>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} type="password" dir="ltr" style={{ textAlign: 'right' }} />
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
        { to: '/admin/rx', label: 'الروشتات', key: 'rx' },
    ];
    return <>
        <div className="kh-chips kh-admin-tabs">
            {tabs.map((t) => <Link key={t.key} to={t.to} className={`kh-chip${t.key === active ? ' is-active' : ''}`}>{t.label}</Link>)}
        </div>
        <Link className="kh-biglink" to="/">رجوع للمتجر</Link>
    </>;
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
    React.useEffect(() => {
        if (!SUPABASE_READY) return;
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
                    <span className="kh-line-photo kh-line-tile">{p ? <CatTile c={p.c} size={26} /> : null}</span>
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
    const dirty = digitsOnly(priceDraft) !== String(price) || digitsOnly(stockDraft) !== String(stock);
    return <div className="kh-card kh-prod-row">
        <span className="kh-thumb"><CatTile c={p.c} size={26} /></span>
        <div className="kh-prod-info">
            <strong>{p.n}</strong>
            <span className="kh-card-unit">{CAT_NAMES[p.c]}</span>
            <div className="kh-prod-inputs">
                <label>السعر<input value={priceDraft} onChange={(e) => { setPriceDraft(digitsOnly(e.target.value)); setSaved(false); }} inputMode="numeric" dir="ltr" /></label>
                <label>المخزون<input value={stockDraft} onChange={(e) => { setStockDraft(digitsOnly(e.target.value)); setSaved(false); }} inputMode="numeric" dir="ltr" /></label>
            </div>
        </div>
        <button type="button" className="kh-confirm kh-save" disabled={!dirty && !saved} onClick={() => {
            const nextPrice = Number(digitsOnly(priceDraft)) || price;
            const nextStock = Number(digitsOnly(stockDraft)) || 0;
            admin.saveProduct(p.i, nextPrice, nextStock);
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
                    ? <a href={r.photo_url} target="_blank" rel="noreferrer"><img className="kh-rx-thumb" src={r.photo_url} alt="صورة روشته" loading="lazy" decoding="async" width="96" height="128" /></a>
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

export function App() {
    const { pathname } = useLocation();
    const cartState = useCartState();
    const adminState = useAdminState();
    const [adminKey, setAdminKeyState] = useState<string>(() => {
        try { return localStorage.getItem('kh_admin_key') ?? ''; } catch { return ''; }
    });
    const setAdminKey = (k: string) => {
        try { k === '' ? localStorage.removeItem('kh_admin_key') : localStorage.setItem('kh_admin_key', k); } catch {}
        setAdminKeyState(k);
    };
    const [userPhone, setUserPhoneRaw] = useState<string | null>(() => {
        try { return localStorage.getItem('kh_session_phone'); } catch { return null; }
    });
    // Session lives in localStorage: survives refresh and app updates, ends only on explicit logout.
    const setUserPhone = (p: string | null) => {
        try { p === null ? localStorage.removeItem('kh_session_phone') : localStorage.setItem('kh_session_phone', p); } catch {}
        setUserPhoneRaw(p);
    };
    const [cat, setCat] = useState('الكل');
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const shopState = useMemo(() => ({ cat, setCat, query, setQuery, selectedId, setSelectedId }), [cat, query, selectedId]);
    return <CartContext.Provider value={cartState}>
        <AdminKeyContext.Provider value={[adminKey, setAdminKey]}>
        <AdminContext.Provider value={adminState}>
        <UserContext.Provider value={userPhone ?? ''}>
        <UserSetContext.Provider value={setUserPhone}>
        <ShopContext.Provider value={shopState}>
            <div className="kh-file">
                <div className="kh-app">
                <div id="kh-top" style={{ height: 0, overflow: 'hidden' }} aria-hidden="true" />
                <Header />
                <main className={`kh-main${pathname === '/' || pathname === '/categories' ? ' kh-main-wide' : ' kh-main-narrow'}`}>
                {userPhone === null
                    ? <LoginPage onLogin={setUserPhone} />
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
                    </Routes>}
                </main>
                {userPhone !== null && <BottomNav />}
                {userPhone === ADMIN_PHONE && <div className="kh-admin-entry">
                    <Link to="/admin">دخول الأدمن — لوحة التحكم</Link>
                </div>}
                <Closing>صيدلية الخليل — اطلب أونلاين والتوصيل لباب البيت. نوفمبر 2026.</Closing>
                </div>
            </div>
        </ShopContext.Provider>
        </UserSetContext.Provider>
        </UserContext.Provider>
        </AdminContext.Provider>
        </AdminKeyContext.Provider>
    </CartContext.Provider>;
}
