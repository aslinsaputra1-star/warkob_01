import React, { useState, useEffect } from 'react';
import { BrandLogo } from '../Common/BrandLogo';
import { Utensils, Sparkles, ArrowRight } from 'lucide-react';
import { StoreSettings } from '../../types';

interface CustomerSplashScreenProps {
  settings: StoreSettings;
  onFinish: () => void;
  onOpenLogin?: () => void;
}

export const CustomerSplashScreen: React.FC<CustomerSplashScreenProps> = ({
  settings,
  onFinish,
  onOpenLogin,
}) => {
  const [progress, setProgress] = useState(15);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Smooth progress increment over 1.4 seconds
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsFadingOut(true);
            setTimeout(onFinish, 300);
          }, 250);
          return 100;
        }
        return prev + 18;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [onFinish]);

  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(onFinish, 200);
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#101010] text-white flex flex-col justify-between items-center p-6 select-none transition-opacity duration-300 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(242, 13, 24, 0.22) 0%, rgba(16, 16, 16, 0.95) 75%)',
      }}
    >
      {/* Top Bar with Skip Button */}
      <div className="w-full max-w-md flex justify-end items-center pt-2">
        <button
          type="button"
          onClick={handleSkip}
          className="text-xs text-stone-400 hover:text-white px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm transition cursor-pointer flex items-center gap-1"
        >
          <span>Lewati</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center Hero: Circular Logo + Selamat Datang + Food Plate */}
      <div className="w-full max-w-sm flex flex-col items-center text-center space-y-6 my-auto">
        {/* Brand Circular Logo with soft red glow */}
        <div className="relative group">
          <div className="absolute -inset-3 bg-gradient-to-r from-red-600/30 to-amber-500/20 rounded-full blur-xl animate-pulse" />
          <BrandLogo
            src={settings.logoUrl}
            alt={settings.storeName || 'Es Bang Kobra — Warkob Drink'}
            size="2xl"
            className="w-32 h-32 rounded-full border-2 border-white/90 shadow-2xl relative"
            imgClassName="object-contain p-1"
          />
        </div>

        {/* Brand Typography */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/20 border border-red-500/30 text-red-400 text-[11px] font-bold tracking-wide uppercase">
            <Sparkles className="w-3 h-3 text-red-400" />
            <span>Mudah, Cepat, Lezaat!</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Selamat Datang!
          </h1>
          <p className="text-xs sm:text-sm text-stone-300 max-w-xs mx-auto leading-relaxed">
            Nikmati kemudahan berbelanja di{' '}
            <span className="font-bold text-red-500">WARUNG BANG KOBRA</span>
          </p>
        </div>

        {/* Appetizing Food Plate Image from Reference */}
        <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full overflow-hidden border-4 border-white/10 shadow-2xl shadow-red-950/60 my-2">
          <img
            src="https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=600&auto=format&fit=crop&q=80"
            alt="Nasi Ayam Sambal Lalapan Warung Bang Kobra"
            className="w-full h-full object-cover transform hover:scale-105 transition duration-500"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-3 inset-x-0 text-center">
            <span className="text-[11px] font-bold text-amber-300 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-amber-500/30 shadow-xs">
              🍛 Menu Spesial Hari Ini
            </span>
          </div>
        </div>

        {/* Tagline */}
        <p className="text-[11px] text-stone-400 italic font-medium">
          "Rasa Enak, Harga Bersahabat, Selalu di Hati."
        </p>
      </div>

      {/* Bottom Loading Progress Bar */}
      <div className="w-full max-w-xs space-y-2 pb-4">
        <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden p-0.5 backdrop-blur-sm">
          <div
            className="bg-gradient-to-r from-red-600 via-[#F20D18] to-orange-500 h-full rounded-full transition-all duration-200 shadow-sm"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-stone-400">
          <span>Memuat aplikasi...</span>
          <span className="font-mono">{progress}%</span>
        </div>
      </div>
    </div>
  );
};
