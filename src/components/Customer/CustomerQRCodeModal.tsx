import React, { useState, useEffect } from 'react';
import {
  X,
  QrCode,
  Download,
  Copy,
  Check,
  Bike,
  ShoppingBag,
  ExternalLink,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { StoreSettings } from '../../types';
import { generateQRCodeDataURL } from '../../utils/qrcode';
import { BrandLogo } from '../Common/BrandLogo';

interface CustomerQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  customerAppUrl: string;
  onSelectServiceType: (service: 'Takeaway' | 'Delivery') => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const CustomerQRCodeModal: React.FC<CustomerQRCodeModalProps> = ({
  isOpen,
  onClose,
  settings,
  customerAppUrl,
  onSelectServiceType,
  showToast,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Generate QR code whenever the modal is open or url changes
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setLoading(true);

    const qrTargetUrl = `${customerAppUrl}${customerAppUrl.includes('?') ? '&' : '?'}source=qr_banner`;

    generateQRCodeDataURL(qrTargetUrl, {
      width: 480,
      margin: 2,
      color: {
        dark: '#064e3b', // Deep emerald dark
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate QR code:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, customerAppUrl]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(customerAppUrl);
      setCopied(true);
      showToast?.('Tautan menu berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast?.('Gagal menyalin tautan', 'error');
    }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR-Menu-WarungBangKobra-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast?.('Gambar QR Code berhasil diunduh!', 'success');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm sm:max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-emerald-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with emerald & yellow theme */}
        <div className="relative bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white p-5 pb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-1 rounded-2xl bg-white shadow-md ring-2 ring-amber-400">
                <BrandLogo
                  src={settings.logoUrl}
                  size="sm"
                  rounded="rounded-xl"
                  className="w-9 h-9"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black tracking-wider text-amber-300 uppercase">
                    Scan & Pesan
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/20 text-white">
                    Instan
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                  Pesan via QR Code
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-95 cursor-pointer"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-emerald-100/90 mt-2 leading-relaxed">
            Scan kode QR dengan kamera ponsel untuk membuka menu tanpa antre, atau gunakan tombol di bawah.
          </p>
        </div>

        {/* QR Code Canvas / Image Display */}
        <div className="p-5 flex flex-col items-center">
          <div className="relative p-4 bg-emerald-50/60 rounded-3xl border-2 border-dashed border-emerald-300/80 shadow-inner flex flex-col items-center justify-center">
            {loading ? (
              <div className="w-48 h-48 sm:w-56 sm:h-56 flex flex-col items-center justify-center gap-2 text-emerald-700">
                <QrCode className="w-10 h-10 animate-spin" />
                <span className="text-xs font-medium">Menyiapkan QR Code...</span>
              </div>
            ) : qrDataUrl ? (
              <div className="relative group">
                <img
                  src={qrDataUrl}
                  alt="QR Order Warung Bang Kobra"
                  className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl object-contain bg-white p-2 shadow-sm"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-10 h-10 rounded-xl bg-white p-1 shadow-md border border-emerald-100">
                    <BrandLogo
                      src={settings.logoUrl}
                      size="sm"
                      rounded="rounded-lg"
                      className="w-full h-full"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-xs text-red-500">
                Gagal memuat QR Code.
              </div>
            )}

            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-white/80 px-3 py-1 rounded-full shadow-2xs border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Buka Cepat di Ponsel Apapun</span>
            </div>
          </div>

          {/* Action Buttons: Copy Link & Download QR */}
          <div className="grid grid-cols-2 gap-2.5 w-full mt-4">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-emerald-700" />
                  <span>Salin Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadQR}
              disabled={!qrDataUrl || loading}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border border-amber-300 bg-amber-400 hover:bg-amber-300 text-emerald-950 text-xs font-black transition shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Unduh QR</span>
            </button>
          </div>

          {/* Quick Order Direct Choices */}
          <div className="w-full mt-4 pt-4 border-t border-gray-100 space-y-2">
            <span className="text-[11px] font-bold text-gray-500 block uppercase tracking-wider text-center">
              Atau Mulai Pesan Langsung Sekarang:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onSelectServiceType('Takeaway');
                  onClose();
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-amber-300" />
                <span>Takeaway</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectServiceType('Delivery');
                  onClose();
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
              >
                <Bike className="w-4 h-4 text-amber-300" />
                <span>Delivery DQM</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
