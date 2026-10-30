import React, { useState, useEffect } from 'react';
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Send,
  Lock,
  ExternalLink,
  ShieldCheck,
  Bell,
  Clock,
  Sparkles,
  Sliders,
  Check,
  X,
  Layers,
  ShoppingBag,
  Eye,
  KeyRound,
  FileText,
  AlertTriangle,
  RotateCw,
  Smartphone,
  Monitor,
  ChevronRight,
  Truck,
  Calendar,
  Store,
  Info,
  Receipt,
} from 'lucide-react';
import { EmailService, EmailClientConfig, EmailLogItem } from '../../services/emailService';
import { UserRole, StoreSettings } from '../../types';
import { normalizeRole } from '../../utils/rbac';
import { formatRupiah } from '../../utils/formatters';
import { BrandLogo } from '../Common/BrandLogo';

interface EmailIntegrationTabProps {
  userRole?: UserRole;
  settings?: StoreSettings;
  onUpdateSettings?: (updated: StoreSettings) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type PreviewTemplateType = 'receipt' | 'newOrder' | 'statusUpdate' | 'preOrder';
type PreviewDeviceType = 'mobile' | 'desktop';

export const EmailIntegrationTab: React.FC<EmailIntegrationTabProps> = ({
  userRole = 'Owner',
  settings,
  onUpdateSettings,
  showToast,
}) => {
  const normRole = normalizeRole(userRole);
  const isAuthorized = normRole === 'Owner' || normRole === 'Admin';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<EmailClientConfig | null>(null);
  const [logs, setLogs] = useState<EmailLogItem[]>([]);

  // Config Form State
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [fromEmailInput, setFromEmailInput] = useState('');
  const [senderNameInput, setSenderNameInput] = useState('');
  const [replyToInput, setReplyToInput] = useState('');
  const [storeNotificationEmailInput, setStoreNotificationEmailInput] = useState(
    settings?.emailSenderAddress || 'rayyanarasid549@gmail.com'
  );
  const [isEnabled, setIsEnabled] = useState(true);
  const [notifyCustomerReceipt, setNotifyCustomerReceipt] = useState(true);
  const [notifyStoreNewOrder, setNotifyStoreNewOrder] = useState(true);
  const [notifyStoreOrderStatus, setNotifyStoreOrderStatus] = useState(true);
  const [notifyStorePreOrder, setNotifyStorePreOrder] = useState(true);
  const [notifyStoreLowStock, setNotifyStoreLowStock] = useState(false);

  // Live Embedded Preview States
  const [previewTemplate, setPreviewTemplate] = useState<PreviewTemplateType>('receipt');
  const [previewDevice, setPreviewDevice] = useState<PreviewDeviceType>('mobile');

  // Test Email States
  const [testTargetEmail, setTestTargetEmail] = useState('');
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    durationMs?: number;
    messageId?: string;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cfg, logList] = await Promise.all([
        EmailService.getConfig(),
        EmailService.getLogs(),
      ]);
      if (cfg) {
        setConfig(cfg);
        setFromEmailInput(cfg.fromEmail || '');
        setSenderNameInput(cfg.senderName || settings?.storeName || 'WARUNG BANG KOBRA');
        setReplyToInput(cfg.replyTo || 'rayyanarasid549@gmail.com');
        setStoreNotificationEmailInput(
          cfg.storeNotificationEmail || settings?.emailSenderAddress || 'rayyanarasid549@gmail.com'
        );
        setIsEnabled(cfg.isEnabled !== false);
        setNotifyCustomerReceipt(cfg.notifyCustomerReceipt !== false);
        setNotifyStoreNewOrder(cfg.notifyStoreNewOrder !== false);
        setNotifyStoreOrderStatus(cfg.notifyStoreOrderStatus !== false);
        if (cfg.notifyStorePreOrder !== undefined) {
          setNotifyStorePreOrder(cfg.notifyStorePreOrder !== false);
        }
        if (cfg.notifyStoreLowStock !== undefined) {
          setNotifyStoreLowStock(Boolean(cfg.notifyStoreLowStock));
        }
        if (!testTargetEmail && (cfg.storeNotificationEmail || 'rayyanarasid549@gmail.com')) {
          setTestTargetEmail(cfg.storeNotificationEmail || 'rayyanarasid549@gmail.com');
        }
      }
      setLogs(logList);
    } catch (e) {
      console.warn('Error loading email integration data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorized) {
      showToast('Hanya Owner atau Admin yang berhak mengubah konfigurasi email.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<EmailClientConfig> & { resendApiKey?: string } = {
        fromEmail: fromEmailInput.trim(),
        senderName: senderNameInput.trim(),
        replyTo: replyToInput.trim(),
        storeNotificationEmail: storeNotificationEmailInput.trim(),
        isEnabled,
        notifyCustomerReceipt,
        notifyStoreNewOrder,
        notifyStoreOrderStatus,
        notifyStorePreOrder,
        notifyStoreLowStock,
      };

      if (apiKeyInput.trim()) {
        payload.resendApiKey = apiKeyInput.trim();
      }

      const res = await EmailService.updateConfig(payload);

      // Also persist to store settings in Firestore if onUpdateSettings available
      if (settings && onUpdateSettings) {
        onUpdateSettings({
          ...settings,
          emailSenderName: senderNameInput.trim() || settings.emailSenderName,
          emailSenderAddress: storeNotificationEmailInput.trim() || settings.emailSenderAddress,
          emailReceiptEnabled: notifyCustomerReceipt,
          emailOrderConfirmationEnabled: notifyStoreNewOrder,
          emailOrderReadyEnabled: notifyStoreOrderStatus,
          emailPoNotificationEnabled: notifyStorePreOrder,
          emailLowStockNotificationEnabled: notifyStoreLowStock,
        });
      }

      if (res.success) {
        showToast('Pengaturan email & preferensi notifikasi berhasil disimpan!', 'success');
        setApiKeyInput(''); // Clear plain text input
        await loadData();
      } else {
        showToast(res.message || 'Gagal menyimpan pengaturan email.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Terjadi kesalahan sistem saat menyimpan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!isAuthorized) {
      showToast('Hanya Owner yang dapat menjalankan pengujian pengiriman email.', 'error');
      return;
    }

    const target = testTargetEmail.trim() || storeNotificationEmailInput.trim();
    if (!target || !target.includes('@')) {
      showToast('Masukkan alamat email tujuan uji coba yang valid.', 'error');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await EmailService.testConnection(
        target,
        apiKeyInput.trim() ? apiKeyInput.trim() : undefined
      );
      setTestResult(res);
      if (res.success) {
        showToast(`Email pengujian berhasil dikirim ke ${target}!`, 'success');
      } else {
        showToast(res.message || 'Pengujian email gagal.', 'error');
      }
      // Refresh logs
      const updatedLogs = await EmailService.getLogs();
      setLogs(updatedLogs);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Koneksi ke server email gagal.',
      });
      showToast('Gagal menghubungi backend email.', 'error');
    } finally {
      setTesting(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="p-6 rounded-3xl bg-stone-900 border border-stone-800 text-center max-w-lg mx-auto my-8 space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-950/60 border border-red-800/50 text-red-500 flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-extrabold text-white">Akses Pengaturan Dibatasi</h3>
          <p className="text-xs text-stone-400">
            Halaman integrasi email dan server vault hanya dapat diakses oleh peran <strong className="text-red-400">Owner</strong> dan <strong className="text-red-400">Admin</strong> Warung Bang Kobra.
          </p>
        </div>
      </div>
    );
  }

  const isConfiguredAndReady = Boolean(config?.configured && isEnabled);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ========================================================
          1. HEADER & LIVE STATUS BANNER
         ======================================================== */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 border border-stone-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-white shadow-lg shadow-red-950/50 shrink-0">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-tight">
                  Pengaturan Email &amp; Notifikasi Transaksi
                </h3>
                {isConfiguredAndReady ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Pengiriman Aktif
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-950/80 text-amber-400 border border-amber-800/60 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Pratinjau / Belum Aktif
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400 mt-1 max-w-2xl leading-relaxed">
                Kelola alamat email toko, toggle notifikasi owner, dan uji pratinjau template email transaksi resmi Warung Bang Kobra secara langsung sebelum pengiriman diaktifkan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition active:scale-95 cursor-pointer border border-stone-700 disabled:opacity-50 flex items-center gap-1.5 text-xs font-bold"
              title="Perbarui Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-red-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Status Metrics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-stone-800/80 text-xs">
          <div className="p-3 rounded-2xl bg-stone-950/60 border border-stone-800/80">
            <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider block">
              Status Server Vault
            </span>
            <div className="mt-1 flex items-center gap-2">
              <ShieldCheck className={`w-4 h-4 ${config?.configured ? 'text-emerald-400' : 'text-stone-500'}`} />
              <span className="font-mono text-stone-200 font-bold">
                {config?.configured ? config.maskedApiKey : 'Belum Ada API Key'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-stone-950/60 border border-stone-800/80">
            <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider block">
              Email Notifikasi Owner
            </span>
            <div className="mt-1 flex items-center gap-2">
              <Bell className="w-4 h-4 text-rose-400" />
              <span className="font-mono text-stone-200 font-bold truncate">
                {storeNotificationEmailInput || 'Belum Diatur'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-stone-950/60 border border-stone-800/80">
            <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider block">
              Pengiriman Terakhir
            </span>
            <div className="mt-1 flex items-center gap-2">
              <Clock className="w-4 h-4 text-stone-400" />
              <span className="text-stone-200 font-bold">
                {config?.lastDeliveryAt
                  ? new Date(config.lastDeliveryAt).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: 'numeric',
                      month: 'short',
                    })
                  : 'Belum Ada Log'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          2. PRATINJAU TEMPLATE EMAIL TRANSAKSI (SEBELUM PENGIRIMAN AKTIF)
         ======================================================== */}
      <div className="p-5 sm:p-6 rounded-3xl bg-stone-900 border border-stone-800 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-rose-500" />
              <h4 className="text-sm font-extrabold text-white">
                Pratinjau Template Email Transaksi (Sebelum Pengiriman Aktif)
              </h4>
            </div>
            <p className="text-xs text-stone-400">
              Lihat secara presisi format email HTML resmi dan responsif yang akan diterima pelanggan maupun owner sebelum Anda mengaktifkan pengiriman live.
            </p>
          </div>

          {/* Device Switcher (Mobile vs Desktop) */}
          <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-2xl border border-stone-800 shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setPreviewDevice('mobile')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                previewDevice === 'mobile'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile HP</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('desktop')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                previewDevice === 'desktop'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop PC</span>
            </button>
          </div>
        </div>

        {/* Template Selector Tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPreviewTemplate('receipt')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              previewTemplate === 'receipt'
                ? 'bg-red-600 text-white shadow-md shadow-red-950/40'
                : 'bg-stone-950 text-stone-300 hover:bg-stone-800 border border-stone-800'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>1. Struk Transaksi Pelanggan</span>
          </button>
          <button
            type="button"
            onClick={() => setPreviewTemplate('newOrder')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              previewTemplate === 'newOrder'
                ? 'bg-red-600 text-white shadow-md shadow-red-950/40'
                : 'bg-stone-950 text-stone-300 hover:bg-stone-800 border border-stone-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>2. Notifikasi Pesanan Baru (Owner)</span>
          </button>
          <button
            type="button"
            onClick={() => setPreviewTemplate('statusUpdate')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              previewTemplate === 'statusUpdate'
                ? 'bg-red-600 text-white shadow-md shadow-red-950/40'
                : 'bg-stone-950 text-stone-300 hover:bg-stone-800 border border-stone-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-blue-400" />
            <span>3. Pembaruan Status Pesanan</span>
          </button>
          <button
            type="button"
            onClick={() => setPreviewTemplate('preOrder')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              previewTemplate === 'preOrder'
                ? 'bg-red-600 text-white shadow-md shadow-red-950/40'
                : 'bg-stone-950 text-stone-300 hover:bg-stone-800 border border-stone-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>4. Pre-Order (PO) Acara &amp; Katering</span>
          </button>
        </div>

        {/* Live Responsive Email Viewer Container */}
        <div className="p-4 sm:p-6 rounded-2xl bg-stone-950 border border-stone-800/80 flex flex-col items-center justify-center">
          <div
            className={`w-full transition-all duration-300 ${
              previewDevice === 'mobile' ? 'max-w-[400px]' : 'max-w-[620px]'
            }`}
          >
            {/* Mock Email Client Frame */}
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-300 text-gray-800 font-sans">
              {/* Fake Email Client Header Bar */}
              <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex items-center justify-between text-[11px] text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                  <span className="ml-2 font-mono font-bold text-gray-700 truncate">
                    {previewTemplate === 'receipt'
                      ? `Ke: fauzi@gmail.com`
                      : `Ke: ${storeNotificationEmailInput || 'rayyanarasid549@gmail.com'}`}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-red-100 text-[#E50914] font-black text-[9px] uppercase tracking-wider">
                  Live Preview
                </span>
              </div>

              {/* Email Content Body */}
              <div>
                {/* 1. Brand Header */}
                <div className="bg-gradient-to-r from-[#E50914] via-[#B9000B] to-[#151515] p-5 text-white text-center">
                  <div className="flex justify-center mb-1">
                    <BrandLogo
                      src={settings?.logoUrl}
                      alt={senderNameInput || settings?.storeName || 'WARUNG BANG KOBRA'}
                      size="sm"
                      className="rounded-xl shadow-md border border-white/20"
                    />
                  </div>
                  <h2 className="text-base sm:text-lg font-black tracking-wider uppercase m-0 leading-tight">
                    {senderNameInput || settings?.storeName || 'WARUNG BANG KOBRA'}
                  </h2>
                  <p className="text-[11px] text-red-100 mt-0.5 font-medium">
                    Es Bang Kobra — Warkob Drink • Mudah, Cepat, Lezaat!
                  </p>
                </div>

                {/* 2. Dynamic Template Contents */}
                <div className="p-5 space-y-4 text-xs">
                  {/* Template 1: Struk Transaksi Pelanggan */}
                  {previewTemplate === 'receipt' && (
                    <>
                      <div className="p-3 rounded-xl bg-red-50 border border-red-100 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-red-700 font-bold uppercase tracking-wider block">
                            Bukti Pembayaran &amp; Struk Resmi
                          </span>
                          <span className="font-mono font-black text-sm text-gray-900">#WBK-20261017-0042</span>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px]">
                          LUNAS (QRIS)
                        </span>
                      </div>

                      <p className="text-gray-600 leading-relaxed text-[11px]">
                        Halo <strong>Kak Fauzi</strong>, terima kasih telah berbelanja di Warung Bang Kobra! Pesanan Anda telah tersimpan di sistem kasir dan siap disajikan.
                      </p>

                      {/* Items Table */}
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-gray-200 text-gray-400 text-[10px] uppercase">
                            <th className="py-1">Menu</th>
                            <th className="py-1 text-center">Qty</th>
                            <th className="py-1 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr>
                            <td className="py-2">
                              <span className="font-bold text-gray-900 block">Nasi Goreng Spesial Kobra</span>
                              <span className="text-[10px] text-gray-500">Pedas Sedang + Telur Ceplok</span>
                            </td>
                            <td className="py-2 text-center text-gray-600 font-bold">2x</td>
                            <td className="py-2 text-right font-bold text-gray-900">Rp 44.000</td>
                          </tr>
                          <tr>
                            <td className="py-2">
                              <span className="font-bold text-gray-900 block">Es Pop Ice Coklat Blender</span>
                              <span className="text-[10px] text-gray-500">Topping Keju &amp; Meses</span>
                            </td>
                            <td className="py-2 text-center text-gray-600 font-bold">2x</td>
                            <td className="py-2 text-right font-bold text-gray-900">Rp 16.000</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Pricing Breakdown */}
                      <div className="pt-2 border-t border-gray-100 space-y-1 text-xs">
                        <div className="flex justify-between text-gray-500">
                          <span>Subtotal Menu:</span>
                          <span>Rp 60.000</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>Ongkir Delivery DQM:</span>
                          <span className="text-emerald-600 font-medium">Rp 0 (Gratis)</span>
                        </div>
                        <div className="flex justify-between text-sm font-black text-gray-900 pt-2 border-t border-gray-200">
                          <span>Total Pembayaran:</span>
                          <span className="text-red-600 font-black">Rp 60.000</span>
                        </div>
                      </div>

                      {/* Service Info */}
                      <div className="p-3 bg-gray-50 rounded-xl space-y-1 text-[11px] text-gray-600">
                        <div className="flex justify-between">
                          <span>Layanan:</span>
                          <span className="font-bold text-gray-800">Delivery DQM (Asrama Utama)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Waktu Pesan:</span>
                          <span>17 Okt 2026, 12:45 WIB</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Template 2: Notifikasi Pesanan Baru (Owner) */}
                  {previewTemplate === 'newOrder' && (
                    <>
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block">
                            Peringatan Dapur &amp; Kasir
                          </span>
                          <span className="font-mono font-black text-sm text-gray-900">
                            PESANAN BARU: #WBK-20261017-0042
                          </span>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-red-600 text-white font-black text-[10px]">
                          SEGERA PROSES
                        </span>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-xl space-y-1.5 text-xs text-gray-700">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Nama Pelanggan:</span>
                          <span className="font-bold text-gray-900">Fauzi Rahman (0812-9876-5432)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Tipe Pesanan:</span>
                          <span className="font-bold text-red-600">DELIVERY DQM</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Alamat Antar:</span>
                          <span className="font-bold text-gray-800">Kamar Santri Asrama Putra Lt. 2</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Total Transaksi:</span>
                          <span className="font-black text-red-600 text-sm">Rp 60.000</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Status Bayar:</span>
                          <span className="font-bold text-emerald-700">Lunas via QRIS</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-yellow-50/70 border border-yellow-200 text-[11px] text-yellow-900">
                        <strong>Catatan Dapur:</strong> &quot;Tolong telurnya setengah matang, sambal dipisah ya mang.&quot;
                      </div>
                    </>
                  )}

                  {/* Template 3: Pembaruan Status Pesanan */}
                  {previewTemplate === 'statusUpdate' && (
                    <>
                      <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider block">
                            Pemberitahuan Status Pesanan
                          </span>
                          <span className="font-mono font-black text-sm text-gray-900">#WBK-20261017-0042</span>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-blue-600 text-white font-black text-[10px]">
                          SEDANG DIANTAR
                        </span>
                      </div>

                      <p className="text-gray-600 leading-relaxed text-[11px]">
                        Pesanan Anda telah selesai dimasak oleh tim dapur Warung Bang Kobra dan kurir saat ini sedang bergerak menuju lokasi Asrama DQM.
                      </p>

                      <div className="p-3 bg-gray-50 rounded-xl space-y-1.5 text-xs text-gray-700">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Nama Kurir Delivery:</span>
                          <span className="font-bold text-gray-900">Kang Kobra Express</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Perkiraan Tiba:</span>
                          <span className="font-bold text-emerald-700">5 - 10 Menit</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Template 4: Pre-Order Acara & Katering */}
                  {previewTemplate === 'preOrder' && (
                    <>
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">
                            Konfirmasi Pre-Order Katering Acara
                          </span>
                          <span className="font-mono font-black text-sm text-gray-900">#PO-20261025-001</span>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-700 text-white font-black text-[10px]">
                          DP DITERIMA (50%)
                        </span>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-xl space-y-1.5 text-xs text-gray-700">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Acara:</span>
                          <span className="font-bold text-gray-900">Khataman Akbar Santri DQM</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Tanggal Acara:</span>
                          <span className="font-bold text-gray-800">25 Oktober 2026, 09:00 WIB</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Jumlah Porsi:</span>
                          <span className="font-bold text-gray-800">50 Box Nasi Ayam Bakar Spesial</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Sisa Pelunasan:</span>
                          <span className="font-black text-red-600">Rp 650.000</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Public Track Order CTA Button */}
                  <div className="pt-2 text-center">
                    <div className="inline-block w-full py-2.5 rounded-xl bg-gradient-to-r from-[#E50914] to-[#B9000B] text-white font-bold text-xs shadow-md shadow-red-600/30 text-center">
                      Lihat Rincian Pesanan
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="pt-3 border-t border-gray-100 text-center text-[10px] text-gray-400 space-y-0.5">
                    <p className="font-bold text-gray-600">
                      {senderNameInput || settings?.storeName || 'WARUNG BANG KOBRA'} — Pesantren DQM
                    </p>
                    <p>WhatsApp Bantuan Kasir: 0812-3456-7890 • Pesanan Resmi</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          3. MAIN CONFIGURATION FORM (EMAIL TOKO & TOGGLES OWNER)
         ======================================================== */}
      <form onSubmit={handleSaveConfig} className="p-5 sm:p-6 rounded-3xl bg-stone-900 border border-stone-800 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800 pb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-rose-500" />
            <h4 className="text-sm font-extrabold text-white">
              Kelola Alamat Email Toko &amp; Toggle Notifikasi Owner
            </h4>
          </div>
          <span className="text-[11px] text-stone-400 bg-stone-950 px-3 py-1 rounded-full border border-stone-800 self-start sm:self-auto">
            Kredensial disimpan di Server Vault
          </span>
        </div>

        {/* Master Switch */}
        <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-white block">Status Layanan Email Transaksional</span>
            <span className="text-[11px] text-stone-400 block mt-0.5">
              Aktifkan atau jeda seluruh proses pengiriman struk pelanggan dan notifikasi email toko
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-stone-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
          </label>
        </div>

        {/* Resend API Key Field */}
        <div>
          <label className="text-xs font-bold text-stone-300 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-rose-400" />
              Resend API Key (Server Secret)
            </span>
            {config?.configured && (
              <span className="text-[11px] text-emerald-400 font-mono">
                Tersimpan: {config.maskedApiKey}
              </span>
            )}
          </label>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder={config?.configured ? 'Ketik API key baru jika ingin mengganti...' : 're_xxxxxxxxxxxxxxxxxxxxxxxx'}
            className="w-full text-xs font-mono px-4 py-3 rounded-2xl bg-stone-950 border border-stone-800 text-stone-200 placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600 transition"
          />
          <p className="text-[11px] text-stone-500 mt-1.5">
            Dapatkan API Key gratis di <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="text-red-400 hover:underline">resend.com/api-keys</a>. API key Anda dienkripsi dan tidak pernah diekspos ke browser atau kode frontend.
          </p>
        </div>

        {/* From & Sender Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5">
              Alamat Pengirim Toko (From Header)
            </label>
            <input
              type="text"
              value={fromEmailInput}
              onChange={(e) => setFromEmailInput(e.target.value)}
              placeholder="Warung Bang Kobra <onboarding@resend.dev>"
              className="w-full text-xs px-4 py-3 rounded-2xl bg-stone-950 border border-stone-800 text-stone-200 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600 transition"
            />
            <span className="text-[10px] text-stone-500 mt-1 block">
              Gunakan domain terverifikasi toko Anda atau <code className="text-stone-300">onboarding@resend.dev</code> untuk pengujian.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5">
              Nama Brand Toko Pengirim
            </label>
            <input
              type="text"
              value={senderNameInput}
              onChange={(e) => setSenderNameInput(e.target.value)}
              placeholder="WARUNG BANG KOBRA"
              className="w-full text-xs px-4 py-3 rounded-2xl bg-stone-950 border border-stone-800 text-stone-200 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600 transition"
            />
          </div>
        </div>

        {/* Reply-To & Owner Notification Recipient */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5">
              Alamat Reply-To (Untuk Balasan Pelanggan)
            </label>
            <input
              type="email"
              value={replyToInput}
              onChange={(e) => setReplyToInput(e.target.value)}
              placeholder="rayyanarasid549@gmail.com"
              className="w-full text-xs px-4 py-3 rounded-2xl bg-stone-950 border border-stone-800 text-stone-200 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5">
              Alamat Email Penerima Notifikasi Owner / Toko
            </label>
            <input
              type="email"
              value={storeNotificationEmailInput}
              onChange={(e) => setStoreNotificationEmailInput(e.target.value)}
              placeholder="rayyanarasid549@gmail.com"
              className="w-full text-xs px-4 py-3 rounded-2xl bg-stone-950 border border-stone-800 text-stone-200 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600 transition"
            />
            <span className="text-[10px] text-stone-500 mt-1 block">
              Setiap pesanan baru dan perubahan status akan dikirimkan ke email ini.
            </span>
          </div>
        </div>

        {/* Toggle Notifikasi untuk Owner & Pelanggan */}
        <div className="pt-2 border-t border-stone-800 space-y-3">
          <span className="text-xs font-extrabold text-stone-300 uppercase tracking-wider block">
            Toggle Notifikasi untuk Owner &amp; Pelanggan
          </span>

          {/* Toggle 1: Struk Pelanggan */}
          <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800 cursor-pointer hover:border-stone-700 transition">
            <input
              type="checkbox"
              checked={notifyCustomerReceipt}
              onChange={(e) => setNotifyCustomerReceipt(e.target.checked)}
              className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
            />
            <div>
              <span className="text-xs font-bold text-white block">
                Kirim Bukti Pesanan &amp; Struk Digital ke Pelanggan
              </span>
              <span className="text-[11px] text-stone-400 block mt-0.5">
                Struk otomatis terkirim hanya jika pelanggan menyetujui opsi kirim email saat checkout pesanan.
              </span>
            </div>
          </label>

          {/* Toggle 2: Notifikasi Pesanan Baru untuk Owner */}
          <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800 cursor-pointer hover:border-stone-700 transition">
            <input
              type="checkbox"
              checked={notifyStoreNewOrder}
              onChange={(e) => setNotifyStoreNewOrder(e.target.checked)}
              className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
            />
            <div>
              <span className="text-xs font-bold text-white block">
                Notifikasi Pesanan Baru Masuk untuk Owner / Dapur
              </span>
              <span className="text-[11px] text-stone-400 block mt-0.5">
                Mengirimkan rincian pesanan baru (Takeaway maupun Delivery DQM) langsung ke alamat email Owner.
              </span>
            </div>
          </label>

          {/* Toggle 3: Notifikasi Perubahan Status Pesanan */}
          <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800 cursor-pointer hover:border-stone-700 transition">
            <input
              type="checkbox"
              checked={notifyStoreOrderStatus}
              onChange={(e) => setNotifyStoreOrderStatus(e.target.checked)}
              className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
            />
            <div>
              <span className="text-xs font-bold text-white block">
                Notifikasi Perubahan Status Pesanan Transaksi
              </span>
              <span className="text-[11px] text-stone-400 block mt-0.5">
                Kirim update email jika status pesanan diubah di kasir (Diproses, Siap, Selesai). Dilengkapi pencegah email ganda (*idempotency key*).
              </span>
            </div>
          </label>

          {/* Toggle 4: Notifikasi Pre-Order (PO) Acara & Katering */}
          <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800 cursor-pointer hover:border-stone-700 transition">
            <input
              type="checkbox"
              checked={notifyStorePreOrder}
              onChange={(e) => setNotifyStorePreOrder(e.target.checked)}
              className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
            />
            <div>
              <span className="text-xs font-bold text-white block">
                Notifikasi Pesanan Pre-Order (PO) Katering &amp; Acara
              </span>
              <span className="text-[11px] text-stone-400 block mt-0.5">
                Kirim pemberitahuan prioritas ke email Owner saat ada pemesanan porsi besar atau katering terjadwal.
              </span>
            </div>
          </label>

          {/* Toggle 5: Peringatan Stok Menipis */}
          <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800 cursor-pointer hover:border-stone-700 transition">
            <input
              type="checkbox"
              checked={notifyStoreLowStock}
              onChange={(e) => setNotifyStoreLowStock(e.target.checked)}
              className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
            />
            <div>
              <span className="text-xs font-bold text-white block">
                Notifikasi Stok Bahan / Menu Menipis ke Email Owner
              </span>
              <span className="text-[11px] text-stone-400 block mt-0.5">
                Peringatkan Owner via email jika stok menu atau sachet minuman berada di bawah batas minimum.
              </span>
            </div>
          </label>
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-stone-800 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-95 text-white font-bold text-xs shadow-lg shadow-red-950/40 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{saving ? 'Menyimpan Pengaturan...' : 'Simpan Perubahan Pengaturan'}</span>
          </button>
        </div>
      </form>

      {/* ========================================================
          4. UJI COBA PENGIRIMAN EMAIL NYATA (OWNER TEST)
         ======================================================== */}
      <div className="p-5 sm:p-6 rounded-3xl bg-stone-900 border border-stone-800 shadow-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-stone-800 pb-3">
          <Send className="w-4 h-4 text-emerald-400" />
          <h4 className="text-sm font-extrabold text-white">Uji Coba Pengiriman Email Nyata ke Kotak Masuk Owner</h4>
        </div>

        <p className="text-xs text-stone-400">
          Uji koneksi Resend API secara riil dengan mengirimkan email simulasi transaksi resmi ke kotak masuk Anda. Ini memastikan kredensial API Key dan domain pengirim telah terhubung sempurna.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="email"
            value={testTargetEmail}
            onChange={(e) => setTestTargetEmail(e.target.value)}
            placeholder="Masukkan email tujuan pengujian (contoh: rayyanarasid549@gmail.com)"
            className="w-full sm:flex-1 text-xs px-4 py-3 rounded-2xl bg-stone-950 border border-stone-800 text-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
          />
          <button
            type="button"
            onClick={handleTestEmail}
            disabled={testing || !isEnabled}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shrink-0"
          >
            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{testing ? 'Mengirim Uji Coba...' : 'Kirim Email Uji Coba'}</span>
          </button>
        </div>

        {/* Test Result Feedback */}
        {testResult && (
          <div
            className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
              testResult.success
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <span className="font-bold block">
                {testResult.success ? 'Pengujian Sukses!' : 'Pengujian Gagal'}
              </span>
              <p>{testResult.message}</p>
              {testResult.durationMs && (
                <span className="text-[10px] opacity-75 font-mono block">
                  Waktu respon: {testResult.durationMs}ms {testResult.messageId ? `| Message ID: ${testResult.messageId}` : ''}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          5. RIWAYAT PENGIRIMAN EMAIL (DELIVERY LOGS)
         ======================================================== */}
      <div className="p-5 sm:p-6 rounded-3xl bg-stone-900 border border-stone-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-stone-400" />
            <h4 className="text-sm font-extrabold text-white">Riwayat Pengiriman Email Transaksional</h4>
          </div>
          <span className="text-[11px] text-stone-500 font-mono">
            {logs.length} catatan aktivitas
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 rounded-2xl bg-stone-950/50 border border-stone-800/80 text-center text-xs text-stone-500">
            Belum ada aktivitas pengiriman email yang tercatat di server.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400">
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Tipe Event</th>
                  <th className="py-2.5 px-3">Penerima</th>
                  <th className="py-2.5 px-3">Subjek / Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-850/50 transition">
                    <td className="py-2.5 px-3 text-stone-400 whitespace-nowrap text-[11px]">
                      {new Date(log.timestamp).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {log.status === 'SUCCESS' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                          TERKIRIM
                        </span>
                      )}
                      {log.status === 'FAILED' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">
                          GAGAL
                        </span>
                      )}
                      {log.status === 'SKIPPED' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-800 text-stone-400">
                          DILEWATI
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-stone-300 font-sans font-bold whitespace-nowrap">
                      {log.eventType === 'CUSTOMER_RECEIPT'
                        ? 'Bukti Pesanan'
                        : log.eventType === 'STORE_NOTIFICATION'
                        ? 'Notifikasi Toko'
                        : log.eventType === 'CONNECTION_TEST'
                        ? 'Uji Coba'
                        : log.eventType}
                    </td>
                    <td className="py-2.5 px-3 text-stone-300 truncate max-w-[180px]">
                      {log.recipient}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-stone-400 truncate max-w-[240px]">
                      {log.error ? (
                        <span className="text-rose-400 font-sans">{log.error}</span>
                      ) : (
                        <span className="text-stone-400">{log.subject}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
