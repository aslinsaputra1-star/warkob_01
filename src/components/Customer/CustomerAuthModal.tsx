import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  KeyRound,
  RefreshCw,
  Send,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { BrandLogo } from '../Common/BrandLogo';
import { StoreSettings } from '../../types';
import {
  signInWithEmailPassword,
  registerCustomerWithEmailPassword,
  signInWithGoogle,
  sendPasswordReset,
  sendVerificationEmail,
  reloadCurrentUser,
  auth,
} from '../../services/firebase';

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  onLoginSuccess: (userProfile: { name: string; email?: string; phone?: string; uid?: string }) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  settings,
  onLoginSuccess,
  showToast,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'verify-notice'>('login');
  const [identifier, setIdentifier] = useState(''); // Email or WhatsApp Number
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Rate-limiting / cooldown for Resend Verification Email (60 seconds)
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  // Resolve email address from phone or raw email
  const resolveEmail = (input: string) => {
    const trimmed = input.trim();
    if (trimmed.includes('@')) {
      return trimmed.toLowerCase();
    }
    // If phone number entered (e.g. 08123456789), convert to alias
    const digits = trimmed.replace(/\D/g, '');
    return `pelanggan.${digits || 'user'}@warungbangkobra.id`;
  };

  const resetFormState = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    const cleanInput = identifier.trim();
    if (!cleanInput) {
      setErrorMessage('Nomor HP atau email wajib diisi.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Kata sandi minimal 6 karakter.');
      return;
    }

    setIsLoading(true);
    const emailToUse = resolveEmail(cleanInput);

    try {
      const res = await signInWithEmailPassword(emailToUse, password);
      if (res.user) {
        const profile = {
          name: res.user.displayName || fullName || cleanInput.split('@')[0],
          email: res.user.email || emailToUse,
          phone: cleanInput.startsWith('08') || cleanInput.startsWith('+62') ? cleanInput : '',
          uid: res.user.uid,
        };

        // Persist customer profile to local storage (strictly NEVER save password)
        localStorage.setItem('wbk_customer_profile', JSON.stringify(profile));
        localStorage.setItem('wbk_customer_name', profile.name);
        if (profile.email) localStorage.setItem('wbk_customer_email', profile.email);
        if (profile.phone) localStorage.setItem('wbk_customer_phone', profile.phone);

        showToast?.(`Selamat datang kembali, ${profile.name}!`, 'success');
        onLoginSuccess(profile);

        // If email is not yet verified, show gentle reminder notice
        if (!res.user.emailVerified && res.user.email && !res.user.email.endsWith('@warungbangkobra.id')) {
          setMode('verify-notice');
        } else {
          onClose();
        }
      } else {
        setErrorMessage(res.errorMessage || 'Email/nomor HP atau kata sandi tidak cocok.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kendala saat menghubungkan ke akun.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    const cleanName = fullName.trim();
    const cleanEmail = identifier.trim().toLowerCase();

    if (!cleanName) {
      setErrorMessage('Nama lengkap wajib diisi.');
      return;
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Masukkan alamat email yang valid (contoh: nama@domain.com).');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Kata sandi minimal harus 6 karakter.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await registerCustomerWithEmailPassword(cleanEmail, password, cleanName);
      if (res.user) {
        const profile = {
          name: cleanName,
          email: cleanEmail,
          phone: '',
          uid: res.user.uid,
        };

        // Persist profile safely without password
        localStorage.setItem('wbk_customer_profile', JSON.stringify(profile));
        localStorage.setItem('wbk_customer_name', profile.name);
        localStorage.setItem('wbk_customer_email', profile.email);

        onLoginSuccess(profile);

        if (res.emailVerificationSent) {
          showToast?.('Pendaftaran berhasil! Tautan verifikasi telah dikirim ke email Anda.', 'success');
          setMode('verify-notice');
          setResendCooldown(60);
        } else {
          showToast?.(`Pendaftaran berhasil! Selamat datang, ${cleanName}!`, 'success');
          onClose();
        }
      } else {
        setErrorMessage(res.errorMessage || 'Pendaftaran gagal. Silakan coba kembali.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kendala saat pendaftaran akun.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Mohon masukkan alamat email yang valid.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await sendPasswordReset(cleanEmail);
      if (res.success) {
        setSuccessMessage(res.message);
        showToast?.('Tautan pemulihan kata sandi telah dikirim ke email Anda.', 'success');
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal mengirim email reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || isLoading) return;

    setIsLoading(true);
    resetFormState();
    try {
      const res = await sendVerificationEmail();
      if (res.success) {
        setSuccessMessage(res.message);
        showToast?.('Email verifikasi baru berhasil dikirim!', 'success');
        setResendCooldown(60); // 60 seconds rate-limit cooldown
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal mengirim ulang email verifikasi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setIsLoading(true);
    resetFormState();
    try {
      const { emailVerified } = await reloadCurrentUser();
      if (emailVerified) {
        showToast?.('Email Anda telah berhasil diverifikasi! Terima kasih.', 'success');
        onClose();
      } else {
        setErrorMessage('Email Anda belum terverifikasi. Silakan klik tautan di email Anda terlebih dahulu.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal memeriksa status verifikasi.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google Sign-In via Firebase
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    resetFormState();
    try {
      const user = await signInWithGoogle();
      if (user) {
        const profile = {
          name: user.displayName || 'Pelanggan Google',
          email: user.email || '',
          phone: user.phoneNumber || '',
          uid: user.uid,
        };
        localStorage.setItem('wbk_customer_profile', JSON.stringify(profile));
        localStorage.setItem('wbk_customer_name', profile.name);
        if (profile.email) localStorage.setItem('wbk_customer_email', profile.email);
        showToast?.(`Login Google berhasil! Selamat datang, ${profile.name}!`, 'success');
        onLoginSuccess(profile);
        onClose();
      }
    } catch (err: any) {
      console.warn('Google sign in notice:', err);
      setErrorMessage('Google Sign-In tidak dapat dibuka di lingkungan ini. Silakan gunakan Email & Kata Sandi.');
    } finally {
      setIsLoading(false);
    }
  };

  // WhatsApp Fast Login simulation / phone confirmation
  const handleWhatsAppLogin = () => {
    const phonePrompt = window.prompt(
      'Masukkan nomor WhatsApp Anda untuk konfirmasi pesanan:',
      identifier || '08'
    );
    if (!phonePrompt || phonePrompt.trim().length < 8) return;

    const cleanPhone = phonePrompt.trim();
    const defaultName = cleanPhone.replace(/\D/g, '').slice(-4);
    const profile = {
      name: `Pelanggan WA (${defaultName})`,
      phone: cleanPhone,
      email: `${cleanPhone.replace(/\D/g, '')}@pelanggan.warungbangkobra.id`,
    };
    localStorage.setItem('wbk_customer_profile', JSON.stringify(profile));
    localStorage.setItem('wbk_customer_name', profile.name);
    localStorage.setItem('wbk_customer_phone', profile.phone);
    showToast?.(`Masuk via WhatsApp berhasil sebagai ${profile.name}!`, 'success');
    onLoginSuccess(profile);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 relative overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Center Logo & Branding */}
        <div className="flex flex-col items-center text-center pt-1 pb-3">
          <div className="relative mb-2.5">
            <BrandLogo
              src={settings.logoUrl}
              alt={settings.storeName || 'Es Bang Kobra — Warkob Drink'}
              size="lg"
              className="w-16 h-16 rounded-full border-2 border-gray-100 shadow-md"
              imgClassName="object-contain p-0.5"
            />
          </div>

          <h2 className="text-xl font-black text-gray-900 tracking-tight">
            {mode === 'login' && 'Masuk Akun Pelanggan'}
            {mode === 'register' && 'Daftar Akun Baru'}
            {mode === 'forgot' && 'Pemulihan Kata Sandi'}
            {mode === 'verify-notice' && 'Verifikasi Email'}
          </h2>
          <p className="text-xs text-gray-500 mt-1 max-w-[260px]">
            {mode === 'login' && 'Masuk untuk memesan lebih cepat dan melihat riwayat belanja'}
            {mode === 'register' && 'Buat akun pelanggan untuk menyimpan struk dan alamat antar'}
            {mode === 'forgot' && 'Masukkan email terdaftar untuk menerima tautan ganti password'}
            {mode === 'verify-notice' && 'Periksa kotak masuk email untuk memverifikasi akun Anda'}
          </p>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="mb-3.5 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-start gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1 font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Success notification */}
        {successMessage && (
          <div className="mb-3.5 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1 font-medium">{successMessage}</span>
          </div>
        )}

        {/* ========================================================
            MODE: VERIFY NOTICE
           ======================================================== */}
        {mode === 'verify-notice' ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <Mail className="w-4 h-4 text-amber-600" />
                <span>Tautan Verifikasi Dikirim</span>
              </div>
              <p className="text-amber-700 leading-relaxed">
                Kami telah mengirimkan tautan verifikasi ke email akun Anda. Klik tautan tersebut untuk menyelesaikan verifikasi.
              </p>
              <div className="text-[11px] text-amber-600 font-medium">
                Tip: Jika tidak ada di Kotak Masuk, periksa folder <strong>Spam</strong> atau <strong>Promosi</strong>.
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleCheckVerification}
                disabled={isLoading}
                className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-98 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Saya Sudah Klik Tautan Verifikasi</span>
              </button>

              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendCooldown > 0 || isLoading}
                className="w-full py-2.5 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-red-600" />
                <span>
                  {resendCooldown > 0
                    ? `Kirim Ulang Verifikasi (${resendCooldown}s)`
                    : 'Kirim Ulang Email Verifikasi'}
                </span>
              </button>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-gray-500 hover:text-gray-800 underline cursor-pointer"
              >
                Lanjutkan Berbelanja
              </button>
            </div>
          </div>
        ) : mode === 'forgot' ? (
          /* ========================================================
             MODE: FORGOT PASSWORD
             ======================================================== */
          <form onSubmit={handleForgotPassword} className="space-y-3.5">
            <div>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Masukkan Alamat Email Terdaftar"
                  required
                  className="w-full text-xs sm:text-sm pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#F20D18] bg-gray-50 text-gray-800"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-2xl bg-[#F20D18] hover:bg-[#B9000B] text-white font-black text-sm tracking-wide shadow-md shadow-red-600/30 transition-all active:scale-98 disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Kirim Link Reset Password'
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  resetFormState();
                }}
                className="text-xs text-gray-500 hover:text-gray-800 font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Kembali ke Halaman Masuk
              </button>
            </div>
          </form>
        ) : (
          /* ========================================================
             MODE: LOGIN & REGISTER
             ======================================================== */
          <>
            <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-3">
              {mode === 'register' && (
                <div>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nama Lengkap Anda"
                      required
                      className="w-full text-xs sm:text-sm pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#F20D18] bg-gray-50 text-gray-800"
                    />
                  </div>
                </div>
              )}

              {/* Nomor HP / Email Input */}
              <div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type={mode === 'register' ? 'email' : 'text'}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={mode === 'register' ? 'Alamat Email Aktif' : 'Nomor WhatsApp atau Email'}
                    required
                    className="w-full text-xs sm:text-sm pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#F20D18] bg-gray-50 text-gray-800"
                  />
                </div>
              </div>

              {/* Password Input with Toggle */}
              <div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? 'Buat Kata Sandi (min. 6 karakter)' : 'Kata Sandi'}
                    required
                    className="w-full text-xs sm:text-sm pl-10 pr-10 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#F20D18] bg-gray-50 text-gray-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Primary Action Button (Solid Red #F20D18) */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-2xl bg-[#F20D18] hover:bg-[#B9000B] text-white font-black text-sm tracking-wide shadow-md shadow-red-600/30 transition-all active:scale-98 disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : mode === 'login' ? (
                  'Masuk Akun'
                ) : (
                  'Daftar Sekarang'
                )}
              </button>

              {/* Lupa Password Link */}
              {mode === 'login' && (
                <div className="text-right pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(identifier.includes('@') ? identifier : '');
                      setMode('forgot');
                      resetFormState();
                    }}
                    className="text-xs font-bold text-[#F20D18] hover:underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3" />
                    Lupa Password?
                  </button>
                </div>
              )}
            </form>

            {/* Divider: ---- atau ---- */}
            <div className="relative my-3 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <span className="relative bg-white px-3 text-[11px] text-gray-400 uppercase tracking-widest font-bold">
                atau
              </span>
            </div>

            {/* Social / Fast Login Buttons */}
            <div className="space-y-2">
              {/* Google Sign-In */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-2.5 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold flex items-center justify-center gap-2.5 shadow-2xs transition active:scale-98 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Lanjut dengan Google</span>
              </button>

              {/* WhatsApp Direct Confirmation */}
              <button
                type="button"
                onClick={handleWhatsAppLogin}
                disabled={isLoading}
                className="w-full py-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/60 text-emerald-800 text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition active:scale-98 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-[#16A765]" />
                <span>Lanjut dengan WhatsApp</span>
              </button>
            </div>

            {/* Footer Toggle */}
            <div className="pt-3 text-center text-xs text-gray-500">
              {mode === 'login' ? (
                <p>
                  Belum punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      resetFormState();
                    }}
                    className="font-bold text-[#F20D18] hover:underline cursor-pointer"
                  >
                    Daftar Sekarang
                  </button>
                </p>
              ) : (
                <p>
                  Sudah punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      resetFormState();
                    }}
                    className="font-bold text-[#F20D18] hover:underline cursor-pointer"
                  >
                    Masuk ke Akun
                  </button>
                </p>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[11px] text-gray-400 hover:text-gray-700 underline cursor-pointer"
                >
                  Lanjut sebagai Tamu (Guest Checkout)
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
