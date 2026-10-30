import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  UtensilsCrossed,
  QrCode,
  Sparkles,
  Zap,
  CreditCard,
  Truck,
  Bike,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Flame,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { StoreSettings } from '../../types';
import { BrandLogo } from '../Common/BrandLogo';

interface CustomerHeroBannerProps {
  settings: StoreSettings;
  onOrderNow: () => void;
  onViewMenu: () => void;
  onOpenQR: () => void;
  cartCount?: number;
}

export interface BannerSlide {
  id: string;
  badge: string;
  title: string;
  titleHighlight: string;
  subtitle: string;
  imageUrl: string;
  highlightTag: string;
  ctaText?: string;
}

export const HERO_SLIDES: BannerSlide[] = [
  {
    id: 'slide-1',
    badge: 'KULINER SPESIAL WARUNG BANG KOBRA',
    title: 'Makan Enak Jadi',
    titleHighlight: 'Lebih Mudah!',
    subtitle: 'Pesan Mudah Tanpa Ribet!',
    imageUrl:
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=85',
    highlightTag: 'Favorit Santri & Staf DQM',
  },
  {
    id: 'slide-2',
    badge: 'DELIVERY HANGAT CEPAT AREA DQM',
    title: 'Layanan Antar',
    titleHighlight: 'Cepat & Hangat',
    subtitle: 'Pesan Mudah Tanpa Ribet! Langsung ke Asrama & Kelas.',
    imageUrl:
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1400&q=85',
    highlightTag: 'Min. Order Hanya Rp20.000',
  },
  {
    id: 'slide-3',
    badge: 'INDOMIE SPESIAL & KOPI RACIKAN',
    title: 'Rasa Mantap,',
    titleHighlight: 'Harga Bersahabat',
    subtitle: 'Pesan Mudah Tanpa Ribet! Nikmati Kopi & Mie Lezat.',
    imageUrl:
      'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1400&q=85',
    highlightTag: 'Varian Lengkap & Fresh',
  },
  {
    id: 'slide-4',
    badge: 'SEMBAKO & KEBUTUHAN HARIAN',
    title: 'Kebutuhan Harian',
    titleHighlight: 'Lengkap di Hati',
    subtitle: 'Pesan Mudah Tanpa Ribet! Belanja Praktis & Terjangkau.',
    imageUrl:
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1400&q=85',
    highlightTag: 'Stok Selalu Tersedia',
  },
];

export const CustomerHeroBanner: React.FC<CustomerHeroBannerProps> = ({
  settings,
  onOrderNow,
  onViewMenu,
  onOpenQR,
  cartCount = 0,
}) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto slide with pause-on-hover
  useEffect(() => {
    if (isPaused) return;

    timerRef.current = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused]);

  const currentSlide = HERO_SLIDES[currentSlideIndex];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlideIndex((prev) => (prev === 0 ? HERO_SLIDES.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
  };

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl md:rounded-[32px] shadow-2xl shadow-emerald-950/25 border border-emerald-500/25 bg-emerald-950 select-none group transition-all duration-300"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* ================= BACKGROUND HIGH-RES FOOD IMAGERY & EMERALD GRADIENT ================= */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {HERO_SLIDES.map((slide, index) => {
          const isActive = index === currentSlideIndex;
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
              }`}
            >
              <img
                src={slide.imageUrl}
                alt={slide.title}
                className="w-full h-full object-cover object-center transform transition-transform duration-7000 ease-out"
                style={{
                  transform: isActive ? 'scale(1.04)' : 'scale(1)',
                }}
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            </div>
          );
        })}

        {/* Emerald Deep Gradient Overlays for Guaranteed High-Contrast Legibility */}
        {/* Layer 1: Horizontal Desktop Wash (Heavy emerald left, transparent right to show tasty food) */}
        <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-emerald-950 via-emerald-950/85 to-emerald-900/40" />

        {/* Layer 2: Mobile / Universal Vertical Wash (Dark emerald base, gradient top) */}
        <div className="block md:hidden absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-950/85 to-emerald-900/60" />

        {/* Layer 3: Vibrant Emerald & Golden Radial Glow Accent */}
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />
      </div>

      {/* ================= BANNER MAIN CONTENT CONTAINER ================= */}
      {/* Heights: Mobile ~280-330px, Desktop ~380-460px */}
      <div className="relative z-10 flex flex-col justify-between min-h-[290px] sm:min-h-[330px] md:min-h-[400px] lg:min-h-[440px] p-5 sm:p-6 md:p-8 text-white">
        
        {/* TOP ROW: Brand Logo + Official Tag + Slide Badge */}
        <div className="flex items-center justify-between gap-3">
          {/* Logo Warung & Identitas */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-1 sm:p-1.5 rounded-2xl bg-white shadow-lg ring-2 ring-amber-400/90 shrink-0 transition-transform group-hover:scale-105 duration-300">
              <BrandLogo
                src={settings.logoUrl}
                size="sm"
                rounded="rounded-xl"
                className="w-8 h-8 sm:w-11 sm:h-11"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-black tracking-wider text-white uppercase drop-shadow-sm">
                  {settings.storeName || 'WARUNG BANG KOBRA'}
                </span>
                <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-amber-400 text-emerald-950 shadow-xs">
                  RESMI
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] font-medium text-emerald-200/90 leading-tight">
                {settings.storeSlogan || 'Rasa Enak, Harga Bersahabat, Selalu di Hati'}
              </p>
            </div>
          </div>

          {/* Slide Tag / Quick Indicator */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-900/80 backdrop-blur-md border border-emerald-400/30 text-amber-300 text-xs font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>{currentSlide.highlightTag}</span>
          </div>
        </div>

        {/* MIDDLE SECTION: Big Catchy Headings & Subtitle */}
        <div className="my-auto py-3 sm:py-4 space-y-1.5 sm:space-y-2 max-w-xl">
          {/* Category / Promo Pill */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-800/80 border border-emerald-400/40 backdrop-blur-md text-[10px] sm:text-xs font-black tracking-wider text-amber-300 shadow-2xs">
            <Flame className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="uppercase">{currentSlide.badge}</span>
          </div>

          {/* Judul Besar: "Makan Enak Jadi Lebih Mudah!" */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-black tracking-tight leading-[1.15] text-white drop-shadow-lg">
            {currentSlide.title}{' '}
            <span className="text-amber-300 drop-shadow-[0_2px_12px_rgba(251,191,36,0.4)]">
              {currentSlide.titleHighlight}
            </span>
          </h1>

          {/* Subjudul: "Pesan Mudah Tanpa Ribet!" */}
          <p className="text-xs sm:text-sm md:text-base font-semibold text-emerald-100/95 drop-shadow-md leading-relaxed">
            {currentSlide.subtitle}
          </p>
        </div>

        {/* 3 CALL TO ACTION (CTA) BUTTONS */}
        <div className="pt-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* CTA 1: Pesan Sekarang */}
            <button
              type="button"
              onClick={onOrderNow}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-emerald-950 font-black text-xs sm:text-sm tracking-wide shadow-xl shadow-amber-500/25 hover:shadow-2xl hover:shadow-amber-400/35 active:scale-95 transition-all duration-200 cursor-pointer border border-amber-300"
            >
              <ShoppingBag className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-950" />
              <span>Pesan Sekarang</span>
              {cartCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-900 text-white text-[10px] font-black">
                  {cartCount}
                </span>
              )}
            </button>

            {/* CTA 2: Lihat Menu */}
            <button
              type="button"
              onClick={onViewMenu}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-2xl bg-white hover:bg-emerald-50 text-emerald-900 font-extrabold text-xs sm:text-sm tracking-wide shadow-lg shadow-black/20 hover:shadow-xl active:scale-95 transition-all duration-200 cursor-pointer border border-white"
            >
              <UtensilsCrossed className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-700" />
              <span>Lihat Menu</span>
            </button>

            {/* CTA 3: Pesan via QR */}
            <button
              type="button"
              onClick={onOpenQR}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3.5 rounded-2xl bg-emerald-800/90 hover:bg-emerald-700/90 text-white font-black text-xs sm:text-sm tracking-wide backdrop-blur-md shadow-lg shadow-emerald-950/40 hover:shadow-xl active:scale-95 transition-all duration-200 cursor-pointer border border-emerald-400/50 hover:border-amber-300"
            >
              <QrCode className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-300" />
              <span>Pesan via QR</span>
            </button>
          </div>
        </div>

        {/* Carousel Slide Indicators & Arrow Controls */}
        <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-emerald-500/20 mt-3 text-white/80">
          {/* Dot Indicators */}
          <div className="flex items-center gap-1.5">
            {HERO_SLIDES.map((slide, idx) => {
              const active = idx === currentSlideIndex;
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setCurrentSlideIndex(idx)}
                  className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    active ? 'w-6 sm:w-8 bg-amber-400 shadow-xs' : 'w-2 bg-white/40 hover:bg-white/70'
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              );
            })}
          </div>

          {/* Prev & Next Arrow Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrev}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-95 cursor-pointer backdrop-blur-xs"
              aria-label="Slide Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-95 cursor-pointer backdrop-blur-xs"
              aria-label="Slide Selanjutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= VALUE PROPOSITION STRIP ================= */}
      {/* Information: Menu Lengkap, Proses Cepat, Pembayaran Fleksibel, Delivery & Take Away */}
      <div className="relative z-10 bg-emerald-950/90 backdrop-blur-md border-t border-emerald-500/20 px-4 py-3 sm:py-3.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
          
          {/* Item 1: Menu Lengkap */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-800/80 border border-emerald-400/30 flex items-center justify-center text-amber-300 shrink-0 shadow-2xs">
              <ChefHat className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] sm:text-xs font-black text-white block truncate leading-tight">
                Menu Lengkap
              </span>
              <span className="text-[9px] sm:text-[10px] text-emerald-200/80 block truncate">
                Makanan & Minuman
              </span>
            </div>
          </div>

          {/* Item 2: Proses Cepat */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-800/80 border border-emerald-400/30 flex items-center justify-center text-amber-300 shrink-0 shadow-2xs">
              <Zap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] sm:text-xs font-black text-white block truncate leading-tight">
                Proses Cepat
              </span>
              <span className="text-[9px] sm:text-[10px] text-emerald-200/80 block truncate">
                Langsung ke Dapur
              </span>
            </div>
          </div>

          {/* Item 3: Pembayaran Fleksibel */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-800/80 border border-emerald-400/30 flex items-center justify-center text-amber-300 shrink-0 shadow-2xs">
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] sm:text-xs font-black text-white block truncate leading-tight">
                Bayar Fleksibel
              </span>
              <span className="text-[9px] sm:text-[10px] text-emerald-200/80 block truncate">
                Tunai & QRIS Semua Bank
              </span>
            </div>
          </div>

          {/* Item 4: Delivery dan Take Away */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-800/80 border border-emerald-400/30 flex items-center justify-center text-amber-300 shrink-0 shadow-2xs">
              <Bike className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] sm:text-xs font-black text-white block truncate leading-tight">
                Delivery & Take Away
              </span>
              <span className="text-[9px] sm:text-[10px] text-emerald-200/80 block truncate">
                Antar DQM & Ambil Sendiri
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
export default CustomerHeroBanner;
