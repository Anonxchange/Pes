import { useHead } from "@unhead/react";
import { useState, useRef, ComponentType } from "react";
import cryptoQrImg from "@assets/IMG_6447.webp";
import orderCompleteImg from "@assets/IMG_6446.webp";
import { useLocation } from "wouter";
import {
  Search, Coffee, Gamepad2, ShoppingBag, Music, Home, Globe,
  Smartphone, Coins, Gift, Heart, Dumbbell, Package, ShoppingCart,
  Check, ChevronsUpDown, Plus,
  Flame, CreditCard, UtensilsCrossed,
} from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { sanitizeImageUrl } from "@/lib/sanitize";
import { getRecipientDenominationRange, formatDenominationRange } from "@/lib/gift-card-denominations";
import { useGiftCardProducts, useGiftCardCategories, useGiftCardCountries } from "@/hooks/use-reloadly";
import { useGiftCardCart } from "@/hooks/use-gift-card-cart";
import { GiftCardCartSheet } from "@/components/gift-card-cart-sheet";

// ── Brand logos shown in the "How it works → Pick a product" visual ──────────
const HOW_IT_WORKS_BRANDS = [
  "/logos/brands/airbnb.svg",      "/logos/brands/mastercard.svg", "/logos/brands/playstation.svg",
  "/logos/brands/visa.svg",        "/logos/brands/netflix.svg",    "/logos/brands/steampowered.svg",
  "/logos/brands/uber.svg",        "/logos/brands/google.svg",     "/logos/brands/spotify.svg",
  "/logos/brands/xbox.svg",        "/logos/brands/apple.svg",      "/logos/brands/ebay.svg",
];

// ── Icon lookup for dynamically-loaded Reloadly categories ───────────────────
const CATEGORY_ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  "payment card": CreditCard,
  "software": Package,
  "gaming": Gamepad2,
  "entertainment": Music,
  "shopping": ShoppingBag,
  "crypto": Coins,
  "travel": Globe,
  "transport": Globe,
  "charity": Heart,
  "esim": Smartphone,
  "food": UtensilsCrossed,
  "fashion": ShoppingBag,
  "electronics": Smartphone,
  "home": Home,
  "health": Heart,
  "beauty": Heart,
  "sports": Dumbbell,
};

function getCategoryIcon(name: string): ComponentType<{ className?: string }> {
  const key = name.toLowerCase();
  for (const [needle, Icon] of Object.entries(CATEGORY_ICON_MAP)) {
    if (key.includes(needle)) return Icon;
  }
  return Gift;
}

// When a country is selected, only show cards actually available in that
// country. The Reloadly edge function may ignore/only partially honor the
// countryCode query param, so we also enforce the filter client-side —
// otherwise the country picker can appear "faulty" (selecting a country
// doesn't change what's shown).
export function filterByCountry(content: any[], countryCode?: string): any[] {
  if (!countryCode) return content || [];
  return (content || []).filter((item) => item?.country?.isoName === countryCode);
}

// Reloadly stores every country variant of a brand (e.g. "Google Play UAE",
// "Google Play MX") as a separate product. Promo rows should show each brand
// once — preferring the shopper's selected country when one is available.
export function dedupeByBrand(content: any[], preferredCountry?: string): any[] {
  const byBrand = new Map<string, any>();
  for (const item of content || []) {
    const key: string = item?.brand?.brandName || item?.productName;
    if (!key) continue;
    const existing = byBrand.get(key);
    if (!existing) {
      byBrand.set(key, item);
    } else if (
      preferredCountry &&
      item?.country?.isoName === preferredCountry &&
      existing?.country?.isoName !== preferredCountry
    ) {
      byBrand.set(key, item);
    }
  }
  return Array.from(byBrand.values());
}

export function mapProducts(content: any[]): { id: string; name: string; priceRange: string; discount: number; image: string }[] {
  return (content || []).map((card: any) => {
    // Face value (recipient side), with the currency that those numbers are
    // actually expressed in — never the sender/account currency.
    const range = getRecipientDenominationRange(card);
    const currencyCode: string = range.currencyCode || card.recipientCurrencyCode || "USD";
    const { min, max } = range;
    return {
      id: String(card.productId),
      name: card.productName,
      priceRange:
        min != null && max != null
          ? formatDenominationRange(range)
          : `${currencyCode} ${min ?? "?"} – ${max ?? "?"}`,
      discount: card.discountPercentage || 0,
      image: sanitizeImageUrl(card.logoUrls?.[0]) || "",
    };
  });
}

// ── Shared card components ────────────────────────────────────────────────────
export function ProductCardGrid({ card, onClick }: { card: any; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left group w-full">
      <div className="w-full aspect-square rounded-xl overflow-hidden bg-secondary mb-2 relative border border-border group-hover:border-primary/30 transition-colors">
        {card.discount > 0 && (
          <span className="absolute top-2 left-2 z-10 text-[10px] font-bold bg-yellow-400 text-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
            ↓ {card.discount}%
          </span>
        )}
        {card.image ? (
          <img src={card.image} alt={card.name} loading="lazy" decoding="async" className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-200" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Gift className="h-12 w-12" />
          </div>
        )}
      </div>
      <p className="text-foreground text-sm font-semibold leading-tight line-clamp-2 mb-0.5">{card.name}</p>
      <p className="text-muted-foreground text-xs">{card.priceRange}</p>
    </button>
  );
}

function ProductCardGridSkeleton() {
  return (
    <div>
      <Skeleton className="w-full aspect-square rounded-xl mb-2" />
      <Skeleton className="h-4 w-3/4 mb-1" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

// ── Mobile horizontal card ────────────────────────────────────────────────────
function ProductCardHorizontal({ card, onClick }: { card: any; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex-shrink-0 w-[140px] text-left group">
      <div className="w-[140px] h-[100px] rounded-xl overflow-hidden bg-secondary mb-2 relative border border-border">
        {card.discount > 0 && (
          <span className="absolute top-1.5 left-1.5 z-10 text-[10px] font-bold bg-yellow-400 text-black px-1.5 py-0.5 rounded-md">
            {card.discount}%
          </span>
        )}
        {card.image ? (
          <img src={card.image} alt={card.name} loading="lazy" decoding="async" className="w-full h-full object-contain p-2" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Gift className="h-8 w-8" />
          </div>
        )}
      </div>
      <p className="text-foreground text-xs font-semibold leading-tight line-clamp-2 mb-0.5">{card.name}</p>
      <p className="text-muted-foreground text-[11px]">{card.priceRange}</p>
    </button>
  );
}

function ProductCardHorizontalSkeleton() {
  return (
    <div className="flex-shrink-0 w-[140px]">
      <Skeleton className="w-[140px] h-[100px] rounded-xl mb-2" />
      <Skeleton className="h-3 w-3/4 mb-1" />
      <Skeleton className="h-2.5 w-1/2" />
    </div>
  );
}

// ── Desktop hero right-panel: live popular gift card tiles ───────────────────
function DesktopHeroGrid({ countryCode, onCardClick }: { countryCode?: string; onCardClick: (id: string) => void }) {
  const { data, isLoading } = useGiftCardProducts({ page: 1, size: 12, countryCode });
  const cards = mapProducts(dedupeByBrand(filterByCountry(data?.content || [], countryCode), countryCode)).slice(0, 6);

  if (isLoading) return (
    <div className="grid grid-cols-2 gap-2">
      {[...Array(6)].map((_, i) => <Skeleton key={i} className="w-full aspect-[4/3] rounded-xl" />)}
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map(card => (
        <button key={card.id} onClick={() => onCardClick(card.id)} className="group text-left">
          <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-secondary border border-border group-hover:border-primary/30 transition-colors relative">
            {card.discount > 0 && (
              <span className="absolute top-1.5 left-1.5 z-10 text-[10px] font-bold bg-yellow-400 text-black px-1.5 py-0.5 rounded">
                -{card.discount}%
              </span>
            )}
            {card.image
              ? <img src={card.image} alt={card.name} loading="lazy" className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-200" />
              : <div className="w-full h-full flex items-center justify-center"><Gift className="h-8 w-8 text-muted-foreground" /></div>
            }
          </div>
          <p className="text-xs font-semibold text-foreground mt-1 line-clamp-1">{card.name}</p>
        </button>
      ))}
    </div>
  );
}

// ── Desktop: flat "8,000+ products" grid (no pagination, no sidebar) ────────
// Mirrors Bitrefill's homepage "8k+ products in 180+ countries" showcase:
// a single static grid with a "See all" link out to the full browse page,
// instead of an in-place paginated catalog.
function DesktopMainGrid({
  countryCode,
  onSeeAll,
  onCardClick,
}: {
  countryCode?: string;
  onSeeAll: () => void;
  onCardClick: (id: string) => void;
}) {
  const { data, isLoading } = useGiftCardProducts({ page: 1, size: 50, countryCode });
  const cards = mapProducts(dedupeByBrand(filterByCountry(data?.content || [], countryCode), countryCode)).slice(0, 8);

  return (
    <section id="desktop-catalog" className="py-8">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-black text-foreground">8,000+ products in 180+ countries</h2>
        <button onClick={onSeeAll} className="text-sm text-muted-foreground underline underline-offset-2 flex-shrink-0">
          See all
        </button>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <ProductCardGridSkeleton key={i} />)}
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-20">
          <Gift className="h-14 w-14 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground font-semibold text-lg mb-2">No gift cards available</p>
          <p className="text-muted-foreground text-sm">Connect your Supabase API to browse live products.</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {cards.map(card => (
            <ProductCardGrid key={card.id} card={card} onClick={() => onCardClick(card.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Desktop: one curated category row, optionally with a banner image ──────
// This is the Bitrefill-style building block: "Gaming" / "For Your Travel
// Needs" / "Shopping" etc, each its own horizontal strip with a "See all"
// link, stacked one after another down the page.
function DesktopProductRow({
  title,
  categoryId,
  countryCode,
  bannerImage,
  bannerAlt,
  onSeeAll,
  onCardClick,
}: {
  title: string;
  categoryId?: number;
  countryCode?: string;
  bannerImage?: string;
  bannerAlt?: string;
  onSeeAll: () => void;
  onCardClick: (id: string) => void;
}) {
  // Bannered rows (Gaming, Travel, Shopping, Entertainment) show a full 4x2
  // grid of 8, matching Bitrefill. The eSIM/bonus row (no banner) is a
  // single row of 4, matching Bitrefill's actual eSIM showcase.
  const maxCards = bannerImage ? 8 : 4;
  const { data, isLoading } = useGiftCardProducts({ page: 1, size: 50, categoryId, countryCode });
  const cards = mapProducts(dedupeByBrand(filterByCountry(data?.content || [], countryCode), countryCode)).slice(0, maxCards);

  if (!isLoading && cards.length === 0) return null;

  const grid = isLoading
    ? [...Array(maxCards)].map((_, i) => <ProductCardGridSkeleton key={i} />)
    : cards.map(card => <ProductCardGrid key={card.id} card={card} onClick={() => onCardClick(card.id)} />);

  // Rows with a banner image: title + "See all" occupy columns 1-2 of a
  // single 4-col grid; the photo occupies columns 3-4 as its own short,
  // fixed-height row (not stretched to the full grid). The 8 product cards
  // are just further grid children, so they auto-flow into the two rows
  // beneath — the photo never extends down into the card rows at all.
  if (bannerImage) {
    return (
      <section className="py-8 border-t border-border">
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-2">
            <h2 className="text-2xl font-black text-foreground mb-1">{title}</h2>
            <button onClick={onSeeAll} className="text-sm text-muted-foreground underline underline-offset-2">
              See all
            </button>
          </div>
          <div className="col-span-2 h-[220px] rounded-xl overflow-hidden">
            <img src={bannerImage} alt={bannerAlt || title} className="w-full h-full object-cover" />
          </div>
        </div>
        {/* Pulled up so row 1 overlaps the bottom edge of the photo above —
            the cards sit in front, the image tucks behind from here down. */}
        <div className="grid grid-cols-4 gap-4 -mt-2">{grid}</div>
      </section>
    );
  }

  // No banner (e.g. the eSIM/bonus row): flat grid, "See all" inline to
  // the right of the title.
  return (
    <section className="py-8 border-t border-border">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-black text-foreground">{title}</h2>
        <button onClick={onSeeAll} className="text-sm text-muted-foreground underline underline-offset-2 flex-shrink-0">
          See all
        </button>
      </div>
      <div className="grid grid-cols-4 gap-4">{grid}</div>
    </section>
  );
}

// ── Mobile 2-row grid section (used for the "2k+ products" showcase) ─────────
// Pulls page 2 (not page 1) so this row never shows the exact same items as
// the "Popular" row above it, which also queries with no category filter.
function GridSection({ countryCode }: { countryCode?: string }) {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useGiftCardProducts({ page: 2, size: 24, countryCode });
  const cards = mapProducts(dedupeByBrand(filterByCountry(data?.content || [], countryCode), countryCode)).slice(0, 12);

  if (isLoading) {
    return (
      <div className="grid grid-rows-2 grid-flow-col auto-cols-[130px] gap-3 overflow-x-auto scrollbar-hide pb-1">
        {[...Array(12)].map((_, i) => <ProductCardHorizontalSkeleton key={i} />)}
      </div>
    );
  }

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-rows-2 grid-flow-col auto-cols-[130px] gap-3 overflow-x-auto scrollbar-hide pb-1">
      {cards.map((card) => (
        <ProductCardHorizontal
          key={card.id}
          card={card}
          onClick={() => setLocation(`/gift-cards/${card.id}`)}
        />
      ))}
    </div>
  );
}

// ── Mobile horizontal section ─────────────────────────────────────────────────
function HorizontalSection({
  title,
  onSeeAll,
  categoryId,
  countryCode,
}: {
  title: string;
  onSeeAll?: () => void;
  categoryId?: number;
  countryCode?: string;
}) {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useGiftCardProducts({ page: 1, size: 20, categoryId, countryCode });
  const cards = mapProducts(dedupeByBrand(filterByCountry(data?.content || [], countryCode), countryCode)).slice(0, 10);

  return (
    <section className="mb-8">
      {title && (
        <div className="flex items-end justify-between px-4 mb-3">
          <h2 className="font-bold text-xl leading-tight text-foreground">{title}</h2>
          {onSeeAll && (
            <button onClick={onSeeAll} className="text-sm text-muted-foreground underline underline-offset-2 flex-shrink-0 ml-4">
              See all
            </button>
          )}
        </div>
      )}
      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1">
          {[...Array(5)].map((_, i) => <ProductCardHorizontalSkeleton key={i} />)}
        </div>
      ) : cards.length === 0 ? null : (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1">
          {cards.map((card) => (
            <ProductCardHorizontal
              key={card.id}
              card={card}
              onClick={() => setLocation(`/gift-cards/${card.id}`)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
const faqs = [
  { question: "What payment options do you accept?", answer: "We accept cryptocurrency payments including Bitcoin (BTC), Ethereum (ETH), and USDT. This ensures fast, secure, and private transactions." },
  { question: "Do I need to create an account to purchase a gift card?", answer: "No! You can purchase gift cards without creating an account. Simply select your card, pay with crypto, and receive your gift card code via email." },
  { question: "How long does it take to receive my purchased gift card?", answer: "Most gift cards are delivered instantly via email after your cryptocurrency payment is confirmed. Delivery typically takes 5-15 minutes depending on network congestion." },
  { question: "What happens if I don't receive my gift card email?", answer: "First, check your spam or junk folder. If it's not there, wait a few more minutes. If you still haven't received it, contact our support team with your order details and we'll resolve it promptly." },
  { question: "What is Pexly?", answer: "Pexly is a non-custodial crypto platform that lets you convert cryptocurrency into everyday purchases — gift cards, eSIMs, payment cards, and phone refills — across 8,000+ products in 180+ countries." },
  { question: "Can I get a refund on a gift card purchase?", answer: "Gift card purchases are final once the code has been delivered, since codes cannot be revoked after issue. If your card doesn't work or arrives damaged, contact support within 24 hours and we'll investigate a replacement or refund." },
  { question: "Are there any fees for buying gift cards with crypto?", answer: "The price you see at checkout is the total price — there are no hidden purchase fees. Standard network fees for your crypto payment still apply and are shown before you confirm." },
  { question: "Can I use a gift card in a different country than where it was issued?", answer: "Most gift cards are region-locked and can only be redeemed in the country or store region they were issued for. Check the product description for country restrictions before purchasing." },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between py-4 text-left gap-4">
        <span className="text-foreground font-semibold text-sm leading-snug">{question}</span>
        <span className={cn("flex-shrink-0 h-6 w-6 rounded-full border border-border flex items-center justify-center transition-transform duration-200", open ? "rotate-45" : "")}>
          <Plus className="h-3 w-3 text-muted-foreground" />
        </span>
      </button>
      <div className={cn("overflow-hidden transition-all duration-300", open ? "max-h-[300px]" : "max-h-0")}>
        <p className="text-muted-foreground text-sm leading-relaxed pb-4">{answer}</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function GiftCards() {
  useHead({
    title: "Gift Cards | Pexly",
    meta: [{ name: "description", content: "Buy digital gift cards from hundreds of brands worldwide and pay with cryptocurrency." }],
  });

  const [, setLocation] = useLocation();
  const [cartOpen, setCartOpen] = useState(false);
  const { items: cartItems } = useGiftCardCart();
  const cartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);

  const { data: reloadlyCategories } = useGiftCardCategories();
  const { data: reloadlyCountries }  = useGiftCardCountries();

  // Shared "which tab is highlighted" state — used by both the mobile tab
  // bar and the desktop tab bar (only one of the two is ever visible at a
  // time, so they can safely share the same piece of state).
  const [activeTab, setActiveTab] = useState("Popular");

  const [openCountry, setOpenCountry] = useState(false);
  const [activeCountryCode, setActiveCountryCode] = useState<string | undefined>(undefined);
  const [searchInput, setSearchInput] = useState("");

  const activeCountryObj = (reloadlyCountries ?? []).find((c) => c.isoName === activeCountryCode);

  const gamingCategory = (reloadlyCategories ?? []).find(c => c.name.toLowerCase().includes("gaming"));
  const travelCategory = (reloadlyCategories ?? []).find(c => c.name.toLowerCase().includes("travel") || c.name.toLowerCase().includes("transport"));
  const shoppingCategory = (reloadlyCategories ?? []).find(c => c.name.toLowerCase().includes("shop") || c.name.toLowerCase().includes("fashion") || c.name.toLowerCase().includes("multi-brand") || c.name.toLowerCase().includes("multi brand"));
  const entertainmentCategory = (reloadlyCategories ?? []).find(c => c.name.toLowerCase().includes("entertainment"));
  const esimCategory   = (reloadlyCategories ?? []).find(c => c.name.toLowerCase().includes("esim"));
  // Fallback "bonus" category shown as the banner before the FAQ. eSIM isn't
  // always present in the real category list, so if it's missing we fall
  // back to the first category not already featured above, using its real
  // name/id instead of a hardcoded label, so the section is never empty.
  const bonusCategory = esimCategory ?? (reloadlyCategories ?? []).find(
    c => c.id !== gamingCategory?.id && c.id !== travelCategory?.id
      && c.id !== shoppingCategory?.id && c.id !== entertainmentCategory?.id
  );

  const mobileTabs: { name: string; Icon: ComponentType<{ className?: string }>; id: number | undefined }[] = [
    { name: "Popular", Icon: Flame, id: undefined },
    ...(reloadlyCategories ?? []).map(c => ({
      name: c.name,
      Icon: getCategoryIcon(c.name),
      id: c.id as number | undefined,
    })),
  ];
  const activeTabObj = mobileTabs.find(t => t.name === activeTab) ?? mobileTabs[0];

  const handleSelectCountry = (isoName: string) => {
    setActiveCountryCode(isoName || undefined);
    setOpenCountry(false);
  };

  const goToBrowse = (category: string, categoryId?: number, q?: string) => {
    const params = new URLSearchParams({ category });
    if (categoryId) params.set("categoryId", String(categoryId));
    if (q) params.set("q", q);
    setLocation(`/gift-cards/browse?${params.toString()}`);
  };

  const handleSearch = () => {
    if (searchInput.trim()) goToBrowse("All Gift Cards", undefined, searchInput.trim());
  };

  // Shared by both the mobile and desktop tab bars: "Popular" just scrolls
  // to the on-page showcase, anything else jumps straight to the full
  // browse page for that category.
  const handleTabClick = (name: string, id: number | undefined, scrollTargetId: string) => {
    if (name === "Popular") {
      setActiveTab("Popular");
      document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: "smooth" });
    } else {
      setActiveTab(name);
      goToBrowse(name, id);
    }
  };

  return (
    <div className="min-h-screen bg-background">

      {/* Floating cart */}
      {cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-primary-foreground font-bold shadow-2xl text-sm"
        >
          <ShoppingCart className="h-4 w-4" />
          {cartCount} in cart
        </button>
      )}

      {/* ════════════════════════════════════════════════════════
          DESKTOP layout (md+) — Bitrefill-style stacked sections
          ════════════════════════════════════════════════════════ */}
      <div className="hidden md:block max-w-7xl mx-auto px-6">

        {/* ── Hero: headline + search LEFT │ live popular grid RIGHT ── */}
        <div className="flex items-stretch gap-10 py-10 border-b border-border">

          {/* Left */}
          <div className="flex-1 min-w-0">
            <h1 className="text-4xl font-black leading-[1.08] tracking-tight mb-2">
              <span className="text-foreground">Turn </span>
              <span className="text-primary">Crypto</span>
              <span className="text-foreground"> Into<br />Everyday Purchases</span>
            </h1>
            <p className="text-muted-foreground text-sm mb-4">8,000+ gift cards in 180+ countries — pay with any crypto.</p>
            <button
              onClick={() => document.getElementById("desktop-catalog")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center px-5 py-2.5 rounded-full font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mb-6"
            >
              Take a Look
            </button>

            {/* Search + country */}
            <div className="flex gap-2 max-w-[400px] mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search for products or brands…"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
                  className="pl-9 h-10 rounded-xl text-sm"
                />
              </div>
              <button
                onClick={handleSearch}
                className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex-shrink-0"
              >
                Search
              </button>
            </div>
            <Popover open={openCountry} onOpenChange={setOpenCountry}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 px-3 rounded-xl text-sm flex-shrink-0">
                  <span className="max-w-[90px] truncate">
                    {activeCountryObj ? `${activeCountryObj.flag} ${activeCountryObj.name}` : "🌍 All Countries"}
                  </span>
                  <ChevronsUpDown className="h-3 w-3 ml-1 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search country..." />
                  <CommandList>
                    <CommandEmpty className="text-sm py-4 text-center text-muted-foreground">No country found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="all" onSelect={() => handleSelectCountry("")}>
                        <Check className={cn("mr-2 h-4 w-4", !activeCountryCode ? "opacity-100" : "opacity-0")} />
                        <span className="mr-2">🌍</span>All Countries
                      </CommandItem>
                      {(reloadlyCountries ?? []).map(c => (
                        <CommandItem key={c.isoName} value={`${c.name} ${c.isoName}`} onSelect={() => handleSelectCountry(c.isoName)}>
                          <Check className={cn("mr-2 h-4 w-4", activeCountryCode === c.isoName ? "opacity-100" : "opacity-0")} />
                          <span className="mr-2">{c.flag}</span>
                          <span>{c.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Right — live popular gift card grid */}
          <div className="flex-shrink-0 w-[360px] flex flex-col">
            {activeCountryObj && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Popular in {activeCountryObj.name} {activeCountryObj.flag}
              </p>
            )}
            <div className="flex-1 min-h-0">
              <DesktopHeroGrid
                countryCode={activeCountryCode}
                onCardClick={id => setLocation(`/gift-cards/${id}`)}
              />
            </div>
          </div>
        </div>

        {/* ── Category tabs (jump to a section, or straight to browse) ── */}
        <div className="border-b border-border overflow-x-auto scrollbar-hide">
          <div className="flex gap-0">
            {mobileTabs.map(tab => (
              <button
                key={tab.name}
                onClick={() => handleTabClick(tab.name, tab.id, "desktop-catalog")}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 px-5 py-3.5 border-b-2 transition-colors",
                  activeTab === tab.name
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.Icon className="h-5 w-5" />
                <span className="text-xs font-medium whitespace-nowrap">{tab.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── How it works ── */}
        <div className="border-b border-border py-12">
          <h2 className="text-2xl font-black text-foreground mb-8">How it works</h2>
          <div className="grid grid-cols-3 gap-8">
            {/* Step 1 */}
            <div>
              <div className="rounded-xl bg-secondary p-4 grid grid-cols-6 gap-2 mb-4">
                {HOW_IT_WORKS_BRANDS.map((logo, i) => (
                  <div key={i} className="aspect-square rounded-full bg-background flex items-center justify-center p-1.5">
                    <img src={logo} alt="" loading="lazy" className="w-full h-full object-contain" />
                  </div>
                ))}
              </div>
              <p className="font-bold text-foreground mb-1">1. Pick a product</p>
              <p className="text-muted-foreground text-sm">Choose from 8,000+ Gift Cards, eSIMs, Payment Cards, and Phone Refills.</p>
            </div>
            {/* Step 2 */}
            <div>
              <div className="rounded-xl overflow-hidden mb-4 h-[160px]">
                <img src={cryptoQrImg} alt="Pay with crypto" className="w-full h-full object-cover rounded-xl" />
              </div>
              <p className="font-bold text-foreground mb-1">2. Pay with crypto</p>
              <p className="text-muted-foreground text-sm">Use any wallet. Choose BTC, ETH, USDT and many more.</p>
            </div>
            {/* Step 3 */}
            <div>
              <div className="rounded-xl overflow-hidden bg-secondary mb-4 h-[160px]">
                <img src={orderCompleteImg} alt="Order completed" className="w-full h-full object-contain rounded-xl" />
              </div>
              <p className="font-bold text-foreground mb-1">3. Receive instantly</p>
              <p className="text-muted-foreground text-sm">Your code arrives in seconds, ready to use.</p>
            </div>
          </div>
        </div>

        {/* ── 8,000+ products flat grid (replaces sidebar + pagination) ── */}
        <DesktopMainGrid
          countryCode={activeCountryCode}
          onSeeAll={() => goToBrowse("All Gift Cards")}
          onCardClick={id => setLocation(`/gift-cards/${id}`)}
        />

        {/* ── Bonus category (eSIM when available, otherwise another real category) ── */}
        {bonusCategory && (
          <DesktopProductRow
            title={esimCategory ? "eSIMs, your passport to data in 140+ countries!" : `Check out our ${bonusCategory.name} gift cards!`}
            categoryId={bonusCategory.id}
            countryCode={activeCountryCode}
            onSeeAll={() => goToBrowse(bonusCategory.name, bonusCategory.id)}
            onCardClick={id => setLocation(`/gift-cards/${id}`)}
          />
        )}

        {/* ── Gaming ── */}
        {gamingCategory && (
          <DesktopProductRow
            title="Gaming"
            categoryId={gamingCategory.id}
            countryCode={activeCountryCode}
            bannerImage="https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&h=400&fit=crop&auto=format"
            bannerAlt="Gaming"
            onSeeAll={() => goToBrowse("Gaming", gamingCategory.id)}
            onCardClick={id => setLocation(`/gift-cards/${id}`)}
          />
        )}

        {/* ── Travel ── */}
        {travelCategory && (
          <DesktopProductRow
            title="For Your Travel Needs"
            categoryId={travelCategory.id}
            countryCode={activeCountryCode}
            bannerImage="https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?w=600&h=400&fit=crop&auto=format"
            bannerAlt="Travel"
            onSeeAll={() => goToBrowse("Travel", travelCategory.id)}
            onCardClick={id => setLocation(`/gift-cards/${id}`)}
          />
        )}

        {/* ── Shopping ── */}
        {shoppingCategory && (
          <DesktopProductRow
            title="Shopping"
            categoryId={shoppingCategory.id}
            countryCode={activeCountryCode}
            bannerImage="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&h=400&fit=crop&auto=format"
            bannerAlt="Shopping"
            onSeeAll={() => goToBrowse("Shopping", shoppingCategory.id)}
            onCardClick={id => setLocation(`/gift-cards/${id}`)}
          />
        )}

        {/* ── Entertainment ── */}
        {entertainmentCategory && (
          <DesktopProductRow
            title="Entertainment"
            categoryId={entertainmentCategory.id}
            countryCode={activeCountryCode}
            bannerImage="https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&h=400&fit=crop&auto=format"
            bannerAlt="Entertainment"
            onSeeAll={() => goToBrowse("Entertainment", entertainmentCategory.id)}
            onCardClick={id => setLocation(`/gift-cards/${id}`)}
          />
        )}

        {/* ── Shop on the Go ── */}
        <section className="my-10 rounded-2xl overflow-hidden bg-[hsl(168_40%_18%)]">
          <div className="py-10 px-12 text-center">
            <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-3">
              Shop on the Go
            </h2>
            <p className="text-white/80 text-sm leading-relaxed mb-6 max-w-md mx-auto">
              Download our app to manage the shopping from your phone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <a
                href="#"
                className="inline-flex items-center gap-3 bg-black text-white px-5 py-3 rounded-xl hover:bg-black/80 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <span className="text-left">
                  <span className="block text-[10px] leading-none text-white/70">Download on the</span>
                  <span className="block text-base font-semibold leading-tight">App Store</span>
                </span>
              </a>
              <a
                href="#"
                className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors"
              >
                Get the app
              </a>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <div className="pb-16 flex gap-16">
          <div className="w-[280px] flex-shrink-0">
            <h2 className="text-2xl font-black text-foreground mb-1">Frequently asked questions</h2>
            <p className="text-muted-foreground text-sm">
              Check out our <span className="underline text-foreground/70 cursor-pointer">Knowledge Base</span> page for more FAQs.
            </p>
          </div>
          <div className="flex-1 min-w-0">
            {faqs.map((faq, i) => <FaqItem key={i} question={faq.question} answer={faq.answer} />)}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          MOBILE layout (< md) — UNCHANGED
          ════════════════════════════════════════════════════════ */}
      <div className="md:hidden">

        {/* Hero */}
        <section className="px-4 pt-8 pb-6 bg-background">
          <h1 className="text-4xl font-black text-foreground leading-[1.1] tracking-tight mb-4">
            Turn Crypto Into<br />Everyday Purchases
          </h1>
          <button
            onClick={() => document.getElementById("mobile-catalog")?.scrollIntoView({ behavior: "smooth" })}
            className="inline-flex items-center px-6 py-3 rounded-full font-bold text-sm mb-5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Take a Look
          </button>

          {/* Product tiles row — shoes, gamepad, groceries, crypto grid */}
          <div className="flex gap-2.5 pb-1">
            {/* Shoes */}
            <div className="flex-shrink-0 w-[76px] h-[76px] rounded-2xl flex items-center justify-center overflow-hidden bg-[#F0C93A]">
              <img src="/hero/shoes_nobg.png" alt="Shoes" loading="lazy" className="w-[90%] h-[90%] object-contain drop-shadow-md" />
            </div>
            {/* Gamepad */}
            <div className="flex-shrink-0 w-[76px] h-[76px] rounded-2xl flex items-center justify-center overflow-hidden bg-[#1B4B3A]">
              <img src="/hero/gamepad_nobg.png" alt="Gamepad" loading="lazy" className="w-[90%] h-[90%] object-contain drop-shadow-md" />
            </div>
            {/* Groceries */}
            <div className="flex-shrink-0 w-[76px] h-[76px] rounded-2xl flex items-center justify-center overflow-hidden bg-[#C0392B]">
              <img src="/hero/groceries_nobg.png" alt="Groceries" loading="lazy" className="w-[90%] h-[90%] object-contain drop-shadow-md" />
            </div>
            {/* Crypto symbols — 2×2 grid of real logos */}
            <div className="flex-shrink-0 w-[76px] h-[76px] rounded-2xl bg-card border border-border overflow-hidden grid grid-cols-2 grid-rows-2 place-items-center gap-0 p-2">
              {["/logos/bitcoin-btc-logo.svg","/logos/ethereum-eth-logo.svg","/logos/solana-sol-logo.svg","/logos/tether-usdt-logo.svg"].map((src,i) => (
                <img key={i} src={src} alt="" loading="lazy" className="w-[26px] h-[26px] object-contain" />
              ))}
            </div>
          </div>
        </section>

        {/* Category tabs */}
        <div id="mobile-catalog" className="border-b border-border">
          <div className="flex gap-0 overflow-x-auto scrollbar-hide px-4">
            {mobileTabs.map(tab => (
              <button
                key={tab.name}
                onClick={() => tab.name === "Popular" ? setActiveTab("Popular") : goToBrowse(tab.name, tab.id)}
                className={cn(
                  "flex flex-col items-center gap-1 px-4 py-3 flex-shrink-0 border-b-2 transition-colors",
                  activeTab === tab.name ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.Icon className="h-5 w-5" />
                <span className="text-xs font-medium whitespace-nowrap">{tab.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mobile search */}
        <div className="px-4 py-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search brands…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
              className="pl-9 h-10 rounded-xl text-sm"
            />
          </div>
          <button onClick={handleSearch} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex-shrink-0">
            Search
          </button>
          <Popover open={openCountry} onOpenChange={setOpenCountry}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 px-3 rounded-xl text-sm font-normal flex-shrink-0">
                <span className="max-w-[70px] truncate">
                  {activeCountryObj ? `${activeCountryObj.flag} ${activeCountryObj.name}` : "🌍"}
                </span>
                <ChevronsUpDown className="h-3 w-3 ml-1 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Search country..." />
                <CommandList>
                  <CommandEmpty className="text-sm py-4 text-center text-muted-foreground">No country found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="all" onSelect={() => handleSelectCountry("")}>
                      <Check className={cn("mr-2 h-4 w-4", !activeCountryCode ? "opacity-100" : "opacity-0")} />
                      <span className="mr-2">🌍</span>All Countries
                    </CommandItem>
                    {(reloadlyCountries ?? []).map(c => (
                      <CommandItem key={c.isoName} value={`${c.name} ${c.isoName}`} onSelect={() => handleSelectCountry(c.isoName)}>
                        <Check className={cn("mr-2 h-4 w-4", activeCountryCode === c.isoName ? "opacity-100" : "opacity-0")} />
                        <span className="mr-2">{c.flag}</span>
                        <span>{c.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="pb-10">
          {/* Popular / tab section */}
          <HorizontalSection
            title={
              activeTab === "Popular" && activeCountryObj
                ? `Popular in ${activeCountryObj.name} ${activeCountryObj.flag}`
                : activeTab === "Popular" ? "Popular" : activeTab
            }
            onSeeAll={() => goToBrowse(activeTab === "Popular" ? "All Gift Cards" : activeTab, activeTabObj.id)}
            categoryId={activeTabObj.id}
            countryCode={activeCountryCode}
          />

          {/* How it works */}
          {activeTab === "Popular" && (
            <section className="mx-4 rounded-2xl bg-card border border-border p-5 mb-8">
              <h2 className="text-2xl font-black text-foreground mb-6">How it works</h2>
              <div className="space-y-5">

                {/* Step 1 */}
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-black">1</span>
                  <div>
                    <p className="text-foreground font-bold text-base mb-0.5">Pick a product</p>
                    <p className="text-muted-foreground text-sm">Choose from 8,000+ Gift Cards, eSIMs, Payment Cards, and Phone Refills.</p>
                  </div>
                </div>
                {/* Brand logos grid */}
                <div className="rounded-xl bg-secondary p-4 grid grid-cols-6 gap-2">
                  {HOW_IT_WORKS_BRANDS.map((logo, i) => (
                    <div key={i} className="aspect-square rounded-full bg-background flex items-center justify-center p-1.5">
                      <img src={logo} alt="" loading="lazy" className="w-full h-full object-contain" />
                    </div>
                  ))}
                </div>

                {/* Step 2 */}
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-black">2</span>
                  <div>
                    <p className="text-foreground font-bold text-base mb-0.5">Pay with crypto</p>
                    <p className="text-muted-foreground text-sm">Use any wallet. Choose BTC, ETH, USDT and many more.</p>
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden">
                  <img src={cryptoQrImg} alt="Pay with crypto" className="w-full object-cover rounded-xl" />
                </div>

                {/* Step 3 */}
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-black">3</span>
                  <div>
                    <p className="text-foreground font-bold text-base mb-0.5">Receive instantly</p>
                    <p className="text-muted-foreground text-sm">Your code arrives in seconds, ready to use.</p>
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden bg-secondary">
                  <img src={orderCompleteImg} alt="Order completed" className="w-full object-cover rounded-xl" />
                </div>

              </div>
            </section>
          )}

          {/* 8k+ products section — scrolls independently, same treatment as the other product rows */}
          {activeTab === "Popular" && (
            <section className="mb-8">
              <div className="flex items-end justify-between px-4 mb-3">
                <h2 className="text-2xl font-black text-foreground leading-tight">
                  2k+ products in<br />180+ countries
                </h2>
                <button
                  onClick={() => goToBrowse("All Gift Cards")}
                  className="text-sm text-muted-foreground underline underline-offset-2 flex-shrink-0 ml-4"
                >
                  See all
                </button>
              </div>
              <div className="px-4">
                <GridSection countryCode={activeCountryCode} />
              </div>
            </section>
          )}

          {/* Gaming section */}
          {activeTab === "Popular" && gamingCategory && (
            <section className="mb-8">
              <div className="flex items-end justify-between px-4 mb-3">
                <h2 className="font-bold text-xl text-foreground">Gaming</h2>
                <button onClick={() => goToBrowse("Gaming", gamingCategory.id)} className="text-sm text-muted-foreground underline underline-offset-2">See all</button>
              </div>
              <div className="mx-4 mb-3 rounded-xl overflow-hidden h-[140px]">
                <img src="https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&h=200&fit=crop&auto=format" alt="Gaming" className="w-full h-full object-cover" />
              </div>
              <HorizontalSection title="" categoryId={gamingCategory.id} countryCode={activeCountryCode} />
            </section>
          )}

          {/* Travel section */}
          {activeTab === "Popular" && travelCategory && (
            <section className="mb-8">
              <div className="flex items-end justify-between px-4 mb-3">
                <h2 className="font-bold text-xl text-foreground">For Your Travel Needs</h2>
                <button onClick={() => goToBrowse("Travel", travelCategory.id)} className="text-sm text-muted-foreground underline underline-offset-2">See all</button>
              </div>
              <div className="mx-4 mb-3 rounded-xl overflow-hidden h-[140px]">
                <img src="https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?w=600&h=200&fit=crop&auto=format" alt="Travel" className="w-full h-full object-cover" />
              </div>
              <HorizontalSection title="" categoryId={travelCategory.id} countryCode={activeCountryCode} />
            </section>
          )}

          {/* Shopping section */}
          {activeTab === "Popular" && shoppingCategory && (
            <section className="mb-8">
              <div className="flex items-end justify-between px-4 mb-3">
                <h2 className="font-bold text-xl text-foreground">Shopping</h2>
                <button onClick={() => goToBrowse("Shopping", shoppingCategory.id)} className="text-sm text-muted-foreground underline underline-offset-2">See all</button>
              </div>
              <div className="mx-4 mb-3 rounded-xl overflow-hidden h-[140px]">
                <img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&h=200&fit=crop&auto=format" alt="Shopping" className="w-full h-full object-cover" />
              </div>
              <HorizontalSection title="" categoryId={shoppingCategory.id} countryCode={activeCountryCode} />
            </section>
          )}

          {/* Entertainment section */}
          {activeTab === "Popular" && entertainmentCategory && (
            <section className="mb-8">
              <div className="flex items-end justify-between px-4 mb-3">
                <h2 className="font-bold text-xl text-foreground">Entertainment</h2>
                <button onClick={() => goToBrowse("Entertainment", entertainmentCategory.id)} className="text-sm text-muted-foreground underline underline-offset-2">See all</button>
              </div>
              <div className="mx-4 mb-3 rounded-xl overflow-hidden h-[140px]">
                <img src="https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&h=200&fit=crop&auto=format" alt="Entertainment" className="w-full h-full object-cover" />
              </div>
              <HorizontalSection title="" categoryId={entertainmentCategory.id} countryCode={activeCountryCode} />
            </section>
          )}

          {/* Shop on the Go */}
          <section className="mx-4 mb-8 rounded-2xl overflow-hidden bg-[hsl(168_40%_18%)]">
            <div className="p-7 text-center">
              <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-3">
                Shop on the Go
              </h2>
              <p className="text-white/80 text-sm leading-relaxed mb-6">
                Download our app to manage the shopping from your phone.
              </p>
              {/* App Store button */}
              <a
                href="#"
                className="inline-flex items-center gap-3 bg-black text-white px-5 py-3 rounded-xl mb-3 hover:bg-black/80 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <span className="text-left">
                  <span className="block text-[10px] leading-none text-white/70">Download on the</span>
                  <span className="block text-base font-semibold leading-tight">App Store</span>
                </span>
              </a>
              <br />
              {/* Get the app button */}
              <a
                href="#"
                className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors"
              >
                Get the app
              </a>
            </div>
          </section>

          {/* Bonus category banner (eSIM when available, otherwise another real category) */}
          {activeTab === "Popular" && bonusCategory && (
            <section className="mb-8 mx-4 rounded-2xl bg-primary/10 border border-primary/20 p-5">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-2xl font-black text-foreground leading-tight flex-1">
                  {esimCategory
                    ? <>eSIMs, your<br />passport to data<br />in 140+ countries!</>
                    : <>Check out our<br />{bonusCategory.name}<br />gift cards!</>}
                </h2>
                <button
                  onClick={() => goToBrowse(bonusCategory.name, bonusCategory.id)}
                  className="text-sm text-muted-foreground underline underline-offset-2 flex-shrink-0 mt-1 ml-4"
                >
                  See all
                </button>
              </div>
              <HorizontalSection title="" categoryId={bonusCategory.id} countryCode={activeCountryCode} />
            </section>
          )}

          {/* FAQ */}
          <section className="mx-4 mt-4">
            <h2 className="text-2xl font-black text-foreground mb-1">Frequently asked</h2>
            <h2 className="text-2xl font-black text-foreground mb-1">questions</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Check out our <span className="underline text-foreground/70 cursor-pointer">Knowledge Base</span> page for more FAQs
            </p>
            <div>{faqs.map((faq, i) => <FaqItem key={i} question={faq.question} answer={faq.answer} />)}</div>
          </section>
        </div>
      </div>

      <GiftCardCartSheet open={cartOpen} onOpenChange={setCartOpen} />
    </div>
  );
}
