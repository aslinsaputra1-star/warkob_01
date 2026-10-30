import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  deleteDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  AutoReplySettings,
  AutoReplyTemplate,
  AutoReplyFAQ,
  AutoReplyConversation,
  AutoReplyMessage,
  AutoReplyLog,
  FAQCategory,
} from '../types/autoReply';
import { Transaction, Product, StoreSettings } from '../types';
import { StorageService } from './storage';
import { PROMO_LIST } from '../components/Customer/CustomerPromoModal';

/**
 * Recursively removes any object keys whose values are `undefined`
 * to guarantee Firestore setDoc, addDoc, and updateDoc never throw:
 * "Unsupported field value: undefined"
 */
export function cleanFirestorePayload<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }
  if (Array.isArray(input)) {
    return input
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestorePayload(item)) as unknown as T;
  }
  if (typeof input === 'object' && !(input instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(input as Record<string, any>)) {
      if (v !== undefined) {
        cleaned[k] = cleanFirestorePayload(v);
      }
    }
    return cleaned as T;
  }
  return input;
}

// Default initial settings
export const DEFAULT_AUTOREPLY_SETTINGS: AutoReplySettings = {
  id: 'global',
  isEnabled: true,
  welcomeMessage:
    'Halo Kak! 👋 Selamat datang di layanan pesan otomatis WARUNG BANG KOBRA. Ada yang bisa kami bantu seputar menu, pemesanan, atau status pesanan?',
  closingMessage:
    'Terima kasih telah menghubungi WARUNG BANG KOBRA! Nikmati sajian lezat & segar kami hari ini. Salam hangat! 🐍',
  operatingHours: {
    enabled: true,
    openTime: '08:00',
    closeTime: '22:00',
    daysOpen: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
    holidays: [],
    outOfHoursMessage:
      'Terima kasih telah menghubungi WARUNG BANG KOBRA! 🐍\n\nSaat ini warung kami sedang tutup.\n\nJam operasional:\n{{jam_operasional}}\n\nPesan Kakak tetap kami terima dan akan kami tanggapi saat warung buka kembali.',
    notifyWhenClosed: true,
  },
  replyDelaySeconds: 1,
  notificationSound: true,
  forwardToCashier: true,
  cashierWhatsApp: '6281234567890',
  language: 'id',
  whatsappIntegration: {
    mode: 'standard',
    phoneConnected: '081234567890',
    status: 'connected',
  },
  updatedAt: new Date().toISOString(),
  updatedBy: 'Sistem',
};

// Default initial message templates
export const DEFAULT_AUTOREPLY_TEMPLATES: AutoReplyTemplate[] = [
  {
    id: 'tmpl-greeting',
    name: 'Sapaan Pelanggan',
    category: 'greeting',
    shortcut: '/halo',
    content:
      'Halo Kak! 👋 Selamat datang di WARUNG BANG KOBRA.\n\nKami siap melayani pesanan minuman dan makanan favorit Kakak.\n\nAda yang bisa kami bantu?',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-menu',
    name: 'Daftar Menu Favorit',
    category: 'menu',
    shortcut: '/menu',
    content:
      'Berikut beberapa menu favorit WARUNG BANG KOBRA:\n\n🥤 Aneka Jus Segar (Mangga, Alpukat, Stroberi, Sirsak)\n☕ Aneka Kopi Mantap (Kopi Gula Aren, Espresso Susu)\n🍵 Thai Tea & Green Tea Creamy\n🍫 Aneka Cokelat Latte Nikmat\n🍜 Aneka Makanan Lezat (Mie Aceh, Geprek, Nasi Hangat)\n\nSilakan buka halaman menu pelanggan untuk melihat produk dan harga terbaru.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-how-to-order',
    name: 'Panduan Cara Pemesanan',
    category: 'order_guide',
    shortcut: '/carapesan',
    content:
      'Mudah banget, Kak! 😊\n\n1. Scan QR Code WARUNG BANG KOBRA atau buka web menu.\n2. Pilih menu favorit.\n3. Masukkan jumlah pesanan.\n4. Pilih Takeaway atau Delivery Order.\n5. Konfirmasi pesanan.\n\nPesanan Kakak akan langsung masuk ke sistem kasir kami.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-order-status',
    name: 'Status Pesanan Pelanggan',
    category: 'order_status',
    shortcut: '/status',
    content:
      'Halo Kak {{nama_pelanggan}}, pesanan {{nomor_pesanan}} sudah kami periksa.\n\nStatus saat ini: *{{status_pesanan}}*.\n\n{{catatan_status}}\n\nTerima kasih telah memilih WARUNG BANG KOBRA!',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-promo',
    name: 'Informasi Promo Aktif',
    category: 'promo',
    shortcut: '/promo',
    content:
      'Kabar gembira Kak! 🎉 Promo aktif hari ini di WARUNG BANG KOBRA:\n\n{{daftar_promo}}\n\nGunakan kupon saat checkout di aplikasi pelanggan untuk klaim diskon!',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-closed',
    name: 'Pemberitahuan Warung Tutup',
    category: 'closed',
    shortcut: '/tutup',
    content:
      'Terima kasih telah menghubungi WARUNG BANG KOBRA! 🐍\n\nSaat ini warung kami sedang tutup.\n\nJam operasional:\n{{jam_operasional}}\n\nPesan Kakak tetap kami terima dan akan kami tanggapi saat warung buka kembali.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-complaint',
    name: 'Penanganan Komplain Pelanggan',
    category: 'complaint',
    shortcut: '/komplain',
    content:
      'Maaf atas ketidaknyamanannya, Kak. 🙏\n\nKami akan membantu menyelesaikan masalah pesanan Kakak.\n\nPesan ini sudah kami tandai untuk diperiksa oleh kasir WARUNG BANG KOBRA.\n\nSilakan sampaikan nomor pesanan agar kami dapat membantu lebih cepat.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Default initial FAQs
export const DEFAULT_AUTOREPLY_FAQS: AutoReplyFAQ[] = [
  {
    id: 'faq-1',
    category: 'Informasi menu',
    question: 'Menu apa saja yang tersedia di Warung Bang Kobra?',
    answer:
      'Kami menyediakan aneka makanan lezat (Mie Goreng/Kuah berbagai varian, Mie Ayam, Nasi Hangat), Aneka Jus buah segar murni (Mangga, Alpukat, Jambu, Stroberi, Sirsak), Minuman kopi racikan khas, teh tarik, cokelat latte, serta makanan ringan dan sembako kebutuhan harian.',
    keywords: ['menu', 'makanan', 'minuman', 'jus', 'kopi', 'tersedia', 'jual apa', 'katalog'],
    isActive: true,
    viewCount: 142,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'faq-2',
    category: 'Harga produk',
    question: 'Berapa kisaran harga menu di warung?',
    answer:
      'Harga menu di WARUNG BANG KOBRA sangat bersahabat! Minuman jus segar mulai dari Rp7.000 - Rp10.000, kopi dan teh mulai dari Rp5.000, dan aneka mie lezat mulai dari Rp5.000 - Rp16.000. Seluruh harga tercantum transparan di menu web.',
    keywords: ['harga', 'berapa', 'ongkos', 'tarif', 'murah', 'biaya', 'pricelist'],
    isActive: true,
    viewCount: 98,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'faq-3',
    category: 'Jam operasional',
    question: 'Kapan jam buka dan tutup Warung Bang Kobra?',
    answer:
      'Warung Bang Kobra melayani pelanggan setiap hari dari pukul 08:00 hingga 22:00 WIB. Pemesanan delivery dan takeaway dibuka penuh sepanjang jam operasional.',
    keywords: ['jam', 'buka', 'tutup', 'operasional', 'jadwal', 'kapan', 'waktu'],
    isActive: true,
    viewCount: 210,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'faq-4',
    category: 'Lokasi warung',
    question: 'Di mana lokasi Warung Bang Kobra?',
    answer:
      'Warung Bang Kobra berlokasi di area Pesantren DQM (Darul Quran Mulia). Kami siap melayani pembelian langsung di gerai maupun delivery langsung ke asrama santri, kantor, dan kelas.',
    keywords: ['lokasi', 'alamat', 'tempat', 'dimana', 'posisi', 'dqm', 'pesantren'],
    isActive: true,
    viewCount: 175,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'faq-5',
    category: 'Cara pemesanan',
    question: 'Bagaimana langkah-langkah memesan makanan?',
    answer:
      '1. Buka halaman menu di browser atau scan QR Code di meja/poster.\n2. Pilih menu dan masukkan ke keranjang belanja.\n3. Pilih jenis pesanan: Takeaway (ambil sendiri) atau Delivery DQM.\n4. Isi nama dan nomor kontak.\n5. Pilih metode pembayaran dan klik Pesan Sekarang.',
    keywords: ['cara', 'pesan', 'order', 'gimana', 'langkah', 'beli', 'pemesanan'],
    isActive: true,
    viewCount: 310,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'faq-6',
    category: 'Metode pembayaran',
    question: 'Metode pembayaran apa saja yang diterima?',
    answer:
      'Kami menerima Tunai (Cash) di kasir/saat serah terima dan QRIS otomatis (BCA, Mandiri, BRI, BNI, GoPay, OVO, Dana, ShopeePay, LinkAja) serta transfer bank.',
    keywords: ['bayar', 'pembayaran', 'qris', 'tunai', 'cash', 'transfer', 'metode'],
    isActive: true,
    viewCount: 185,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'faq-7',
    category: 'Takeaway',
    question: 'Bagaimana cara mengambil pesanan Takeaway?',
    answer:
      'Setelah melakukan pemesanan takeaway di aplikasi, Anda akan mendapatkan nomor antrian takeaway. Silakan menuju kasir Warung Bang Kobra dan tunjukkan nomor pesanan untuk mengambil hidangan yang telah siap.',
    keywords: ['takeaway', 'bungkus', 'ambil', 'bawa pulang', 'antrian'],
    isActive: true,
    viewCount: 89,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'faq-8',
    category: 'Delivery Order',
    question: 'Bagaimana ketentuan Delivery ke area Pesantren DQM?',
    answer:
      'Layanan Delivery DQM mengantarkan pesanan langsung ke asrama/lokasi Anda di Pesantren DQM dengan minimal pesanan Rp20.000. Pengantaran dilakukan hangat dan cepat oleh tim kurir DQM kami.',
    keywords: ['delivery', 'antar', 'ongkir', 'kurir', 'asrama', 'pengantaran'],
    isActive: true,
    viewCount: 264,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'faq-9',
    category: 'Promo',
    question: 'Apakah ada diskon atau promo hari ini?',
    answer:
      'Tentu ada! Kami secara rutin menyediakan promo diskon belanja, potongan harga menu jus buah, dan paket hemat. Silakan tanyakan promo aktif atau periksa menu Promo di aplikasi.',
    keywords: ['promo', 'diskon', 'potongan', 'voucher', 'hemat', 'cashback', 'gratis'],
    isActive: true,
    viewCount: 220,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'faq-10',
    category: 'Status pesanan',
    question: 'Bagaimana cara melacak pesanan saya?',
    answer:
      'Ketik nomor pesanan Anda (contoh: TRX-xxxx atau nomor yang tertera di struk), sistem kami akan otomatis mengecek data Firestore dan mengabarkan apakah pesanan sedang diproses, siap diambil, atau sedang diantar.',
    keywords: ['status', 'lacak', 'cek', 'sudah sampai', 'diproses', 'kapan jadi'],
    isActive: true,
    viewCount: 305,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'faq-11',
    category: 'Komplain pelanggan',
    question: 'Bagaimana jika pesanan saya kurang, salah, atau ada kendala?',
    answer:
      'Kami mohon maaf atas kendala yang dialami. Silakan sampaikan keluhan dan nomor pesanan Anda di chat ini. Percakapan akan otomatis ditandai prioritas dan diteruskan ke kasir untuk penanganan langsung.',
    keywords: ['komplain', 'salah', 'kurang', 'rusak', 'refund', 'ganti', 'keluhan', 'kecewa'],
    isActive: true,
    viewCount: 72,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'faq-12',
    category: 'Kontak kasir',
    question: 'Bagaimana cara menghubungi kasir atau admin secara langsung?',
    answer:
      'Anda dapat menghubungi kasir Warung Bang Kobra melalui tombol WhatsApp yang tersedia di aplikasi atau via nomor WhatsApp kasir kami di 0812-3456-7890.',
    keywords: ['kontak', 'hubungi', 'wa', 'whatsapp', 'kasir', 'telepon', 'admin'],
    isActive: true,
    viewCount: 160,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export class AutoReplyService {
  private static cachedSettings: AutoReplySettings = DEFAULT_AUTOREPLY_SETTINGS;
  private static cachedTemplates: AutoReplyTemplate[] = DEFAULT_AUTOREPLY_TEMPLATES;
  private static cachedFAQs: AutoReplyFAQ[] = DEFAULT_AUTOREPLY_FAQS;

  /**
   * Initialize and seed Firestore collections if empty
   */
  static async initCollections(): Promise<void> {
    try {
      // 1. Settings
      const settingsRef = doc(db, 'autoReplySettings', 'global');
      const settingsSnap = await getDoc(settingsRef);
      if (!settingsSnap.exists()) {
        await setDoc(settingsRef, DEFAULT_AUTOREPLY_SETTINGS);
      }

      // 2. Templates
      const templatesRef = collection(db, 'autoReplyTemplates');
      const templatesSnap = await getDocs(templatesRef);
      if (templatesSnap.empty) {
        for (const tmpl of DEFAULT_AUTOREPLY_TEMPLATES) {
          await setDoc(doc(db, 'autoReplyTemplates', tmpl.id), tmpl);
        }
      }

      // 3. FAQs
      const faqsRef = collection(db, 'autoReplyFAQs');
      const faqsSnap = await getDocs(faqsRef);
      if (faqsSnap.empty) {
        for (const faq of DEFAULT_AUTOREPLY_FAQS) {
          await setDoc(doc(db, 'autoReplyFAQs', faq.id), faq);
        }
      }
    } catch (err) {
      console.warn('AutoReplyService initCollections fallback notice:', err);
    }
  }

  /**
   * Subscribe to Settings in Firestore
   */
  static subscribeSettings(callback: (settings: AutoReplySettings) => void): () => void {
    const docRef = doc(db, 'autoReplySettings', 'global');
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as AutoReplySettings;
          this.cachedSettings = data;
          callback(data);
        } else {
          callback(DEFAULT_AUTOREPLY_SETTINGS);
        }
      },
      (err) => {
        console.warn('subscribeSettings snapshot error:', err);
        callback(this.cachedSettings);
      }
    );
  }

  /**
   * Save Settings to Firestore
   */
  static async saveSettings(settings: AutoReplySettings): Promise<void> {
    this.cachedSettings = settings;
    try {
      const docRef = doc(db, 'autoReplySettings', 'global');
      await setDoc(
        docRef,
        cleanFirestorePayload({
          ...settings,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );
    } catch (err) {
      console.error('Failed to save autoReplySettings:', err);
      throw err;
    }
  }

  /**
   * Subscribe to Templates
   */
  static subscribeTemplates(callback: (templates: AutoReplyTemplate[]) => void): () => void {
    const colRef = collection(db, 'autoReplyTemplates');
    return onSnapshot(
      colRef,
      (snap) => {
        if (!snap.empty) {
          const list: AutoReplyTemplate[] = [];
          snap.forEach((d) => list.push(d.data() as AutoReplyTemplate));
          this.cachedTemplates = list;
          callback(list);
        } else {
          callback(DEFAULT_AUTOREPLY_TEMPLATES);
        }
      },
      (err) => {
        console.warn('subscribeTemplates snapshot error:', err);
        callback(this.cachedTemplates);
      }
    );
  }

  /**
   * Save / Update a Template
   */
  static async saveTemplate(template: AutoReplyTemplate): Promise<void> {
    try {
      const docRef = doc(db, 'autoReplyTemplates', template.id);
      await setDoc(
        docRef,
        cleanFirestorePayload({
          ...template,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );
    } catch (err) {
      console.error('Failed to save template:', err);
      throw err;
    }
  }

  /**
   * Delete a Template
   */
  static async deleteTemplate(templateId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'autoReplyTemplates', templateId));
    } catch (err) {
      console.error('Failed to delete template:', err);
      throw err;
    }
  }

  /**
   * Subscribe to FAQs
   */
  static subscribeFAQs(callback: (faqs: AutoReplyFAQ[]) => void): () => void {
    const colRef = collection(db, 'autoReplyFAQs');
    return onSnapshot(
      colRef,
      (snap) => {
        if (!snap.empty) {
          const list: AutoReplyFAQ[] = [];
          snap.forEach((d) => list.push(d.data() as AutoReplyFAQ));
          this.cachedFAQs = list;
          callback(list);
        } else {
          callback(DEFAULT_AUTOREPLY_FAQS);
        }
      },
      (err) => {
        console.warn('subscribeFAQs snapshot error:', err);
        callback(this.cachedFAQs);
      }
    );
  }

  /**
   * Save / Update a FAQ
   */
  static async saveFAQ(faq: AutoReplyFAQ): Promise<void> {
    try {
      const docRef = doc(db, 'autoReplyFAQs', faq.id);
      await setDoc(
        docRef,
        cleanFirestorePayload({
          ...faq,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );
    } catch (err) {
      console.error('Failed to save FAQ:', err);
      throw err;
    }
  }

  /**
   * Delete a FAQ
   */
  static async deleteFAQ(faqId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'autoReplyFAQs', faqId));
    } catch (err) {
      console.error('Failed to delete FAQ:', err);
      throw err;
    }
  }

  /**
   * Subscribe to Conversations list (for admin dashboard)
   */
  static subscribeConversations(
    callback: (conversations: AutoReplyConversation[]) => void
  ): () => void {
    const colRef = collection(db, 'conversations');
    const q = query(colRef, orderBy('lastMessageAt', 'desc'), limit(100));
    return onSnapshot(
      q,
      (snap) => {
        const list: AutoReplyConversation[] = [];
        snap.forEach((d) => list.push(d.data() as AutoReplyConversation));
        callback(list);
      },
      (err) => {
        console.warn('subscribeConversations error:', err);
        callback([]);
      }
    );
  }

  /**
   * Subscribe to Messages in a specific conversation
   */
  static subscribeMessages(
    conversationId: string,
    callback: (messages: AutoReplyMessage[]) => void
  ): () => void {
    const colRef = collection(db, 'messages');
    const q = query(
      colRef,
      where('conversationId', '==', conversationId),
      orderBy('timestamp', 'asc'),
      limit(200)
    );
    return onSnapshot(
      q,
      (snap) => {
        const list: AutoReplyMessage[] = [];
        snap.forEach((d) => list.push(d.data() as AutoReplyMessage));
        callback(list);
      },
      (err) => {
        console.warn('subscribeMessages error:', err);
        callback([]);
      }
    );
  }

  /**
   * Subscribe to Auto Reply Logs
   */
  static subscribeLogs(callback: (logs: AutoReplyLog[]) => void): () => void {
    const colRef = collection(db, 'autoReplyLogs');
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(100));
    return onSnapshot(
      q,
      (snap) => {
        const list: AutoReplyLog[] = [];
        snap.forEach((d) => list.push(d.data() as AutoReplyLog));
        callback(list);
      },
      (err) => {
        console.warn('subscribeLogs error:', err);
        callback([]);
      }
    );
  }

  /**
   * Check if current time is within operating hours
   */
  static isWithinOperatingHours(operatingHours: AutoReplySettings['operatingHours']): boolean {
    if (!operatingHours.enabled) return true;

    try {
      const now = new Date();
      // Jakarta time GMT+7
      const nowHours = now.getHours();
      const nowMinutes = now.getMinutes();
      const currentTimeVal = nowHours * 60 + nowMinutes;

      const [openH, openM] = operatingHours.openTime.split(':').map(Number);
      const [closeH, closeM] = operatingHours.closeTime.split(':').map(Number);

      const openVal = openH * 60 + (openM || 0);
      const closeVal = closeH * 60 + (closeM || 0);

      // Day check
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const currentDay = days[now.getDay()];
      if (operatingHours.daysOpen.length > 0 && !operatingHours.daysOpen.includes(currentDay)) {
        return false;
      }

      // Holiday check (YYYY-MM-DD)
      const dateString = now.toISOString().slice(0, 10);
      if (operatingHours.holidays && operatingHours.holidays.includes(dateString)) {
        return false;
      }

      return currentTimeVal >= openVal && currentTimeVal <= closeVal;
    } catch {
      return true;
    }
  }

  /**
   * The Intelligent Engine: Matches user inquiry and computes automated response
   */
  static async computeAutoReply(
    inquiry: string,
    customerName: string,
    settings: AutoReplySettings = this.cachedSettings
  ): Promise<{
    reply: string;
    keywordMatched?: string;
    status: AutoReplyLog['status'];
    isComplaint?: boolean;
    metadata?: AutoReplyMessage['metadata'];
  }> {
    const normalized = inquiry.toLowerCase().trim();
    const opHours = settings.operatingHours;
    const hoursFormatted = `${opHours.openTime} - ${opHours.closeTime} WIB (${opHours.daysOpen.join(', ')})`;

    // 1. Check Operating Hours
    if (!this.isWithinOperatingHours(opHours)) {
      let closedMsg = opHours.outOfHoursMessage || DEFAULT_AUTOREPLY_SETTINGS.operatingHours.outOfHoursMessage;
      closedMsg = closedMsg.replace(/\{\{jam_operasional\}\}/g, hoursFormatted);
      return {
        reply: closedMsg,
        keywordMatched: 'di_luar_jam_operasional',
        status: 'OUT_OF_HOURS',
      };
    }

    // 2. Check Complaint Keywords (CRITICAL: Section 7)
    const complaintKeywords = [
      'komplain',
      'pesanan salah',
      'salah pesanan',
      'pesanan belum datang',
      'belum sampai',
      'minuman tidak sesuai',
      'makanan kurang',
      'kurang',
      'refund',
      'kembalikan uang',
      'kecewa',
      'basi',
      'dingin',
      'salah kirim',
    ];

    if (complaintKeywords.some((kw) => normalized.includes(kw))) {
      const tmpl = this.cachedTemplates.find((t) => t.category === 'complaint') || DEFAULT_AUTOREPLY_TEMPLATES.find((t) => t.category === 'complaint');
      const text = tmpl ? tmpl.content : DEFAULT_AUTOREPLY_TEMPLATES[6].content;
      return {
        reply: text,
        keywordMatched: 'komplain_pelanggan',
        status: 'COMPLAINT',
        isComplaint: true,
      };
    }

    // 3. Check Order Status Inquiry (CRITICAL: Section 3)
    const statusKeywords = [
      'status pesanan',
      'cek status',
      'pesanan saya',
      'lacak pesanan',
      'status order',
      'sudah sampai mana',
      'kapan selesai',
      'kapan diantar',
    ];

    // Check if message mentions an Order ID pattern (e.g. TRX-1234, INV-123, WBK-123, PO-123)
    const orderIdMatch = inquiry.match(/\b(TRX|INV|WBK|PO)[A-Z0-9-]+\b/i);

    if (orderIdMatch || statusKeywords.some((kw) => normalized.includes(kw))) {
      const targetQuery = orderIdMatch ? orderIdMatch[0].toUpperCase() : '';
      let matchedOrder: Transaction | null = null;

      // Query from Firestore or Storage
      const allTx = StorageService.getTransactions();
      if (targetQuery) {
        matchedOrder = allTx.find(
          (t) =>
            t.id_transaksi?.toUpperCase().includes(targetQuery) ||
            (t.queueNumber && t.queueNumber.toUpperCase().includes(targetQuery)) ||
            (t.poNumber && t.poNumber.toUpperCase().includes(targetQuery))
        ) || null;
      } else {
        // Find most recent order by customer name if available
        matchedOrder = allTx.find(
          (t) => t.nama_pelanggan?.toLowerCase() === customerName.toLowerCase()
        ) || allTx[0] || null;
      }

      if (matchedOrder) {
        const orderNum = matchedOrder.queueNumber || matchedOrder.poNumber || matchedOrder.id_transaksi;
        const custName = matchedOrder.nama_pelanggan || customerName || 'Kakak';
        const stUpper = String(matchedOrder.status || '').toUpperCase();
        const delStatus = String(matchedOrder.deliveryStatus || '').toUpperCase();

        let statusText = 'Pesanan sudah kami terima dan sedang dalam antrian kasir.';
        let catatan = 'Mohon ditunggu sebentar ya Kak, kami sedang menyiapkan dengan sepenuh hati.';

        if (stUpper.includes('PROSES') || stUpper.includes('MENUNGGU') || stUpper.includes('PENDING')) {
          statusText = 'Pesanan sedang diproses & disiapkan di dapur.';
          catatan = 'Dapur kami sedang meracik pesanan agar tiba dalam kondisi lezat dan hangat.';
        } else if (stUpper.includes('SIAP')) {
          statusText = 'Pesanan siap diambil di meja kasir Warung Bang Kobra!';
          catatan = 'Silakan tunjukkan nomor pesanan ini ke kasir kami untuk pengambilan.';
        } else if (delStatus.includes('DIANTAR') || delStatus.includes('KIRIM')) {
          statusText = 'Pesanan sedang dalam perjalanan oleh kurir Delivery DQM.';
          catatan = 'Kurir kami sedang menuju lokasi Kakak. Mohon pastikan nomor telepon aktif.';
        } else if (stUpper.includes('SELESAI')) {
          statusText = 'Pesanan telah selesai diserahkan.';
          catatan = 'Selamat menikmati sajian Warung Bang Kobra! Jangan lupa berikan ulasan terbaik ya.';
        } else if (stUpper.includes('BATAL') || stUpper.includes('DIBATALKAN')) {
          statusText = 'Pesanan telah dibatalkan.';
          catatan = 'Silakan hubungi kasir kami jika terdapat pertanyaan lebih lanjut.';
        }

        const reply = `Halo Kak ${custName}, pesanan ${orderNum} sudah kami periksa di sistem Firestore.\n\nStatus saat ini: *${statusText}*\n\n${catatan}\n\nTerima kasih telah memilih WARUNG BANG KOBRA! 🐍`;

        return {
          reply,
          keywordMatched: `status_pesanan_${stUpper || 'AKTIF'}`,
          status: 'SUCCESS',
          metadata: {
            orderId: matchedOrder.id_transaksi,
            orderNumber: orderNum,
          },
        };
      } else {
        return {
          reply: `Halo Kak ${customerName}! Kami siap membantu memeriksa status pesanan Kakak di Cloud Firestore.\n\nSilakan ketikkan Nomor Pesanan atau Nomor Struk Kakak (contoh: *TRX-...* atau *WBK-...*) agar sistem dapat melacak secara akurat.`,
          keywordMatched: 'status_pesanan_tanya_id',
          status: 'SUCCESS',
        };
      }
    }

    // 4. Check Promo Inquiry (CRITICAL: Section 5)
    const promoKeywords = [
      'promo',
      'ada promo',
      'promo hari ini',
      'diskon apa saja',
      'ada paket hemat',
      'voucher',
      'kupon',
      'cashback',
      'diskon',
    ];

    if (promoKeywords.some((kw) => normalized.includes(kw))) {
      const activePromos = PROMO_LIST;
      let promoContent = '';
      if (activePromos.length > 0) {
        promoContent = activePromos
          .map((p) => {
            const val =
              p.discountType === 'percentage'
                ? `${p.discountValue}%`
                : p.discountType === 'free_shipping'
                ? 'Gratis Ongkir DQM'
                : `Rp${p.discountValue.toLocaleString()}`;
            return `🏷️ *${p.title}*\n   Kode: *${p.code}* • Diskon: ${val}\n   ${p.description}`;
          })
          .join('\n\n');
      } else {
        promoContent = 'Saat ini belum ada kode promo baru, namun nikmati harga spesial kami setiap hari!';
      }

      const reply = `Kabar gembira Kak! 🎉 Promo aktif hari ini di WARUNG BANG KOBRA:\n\n${promoContent}\n\nGunakan kode kupon saat checkout di aplikasi pelanggan untuk klaim diskon instan!`;

      return {
        reply,
        keywordMatched: 'promo_aktif',
        status: 'SUCCESS',
      };
    }

    // 5. Check "Cara Pesan" (Section 2)
    const orderGuideKeywords = [
      'cara pesan',
      'bagaimana cara pesan',
      'gimana pesannya',
      'cara order',
      'mau pesan',
      'langkah pesan',
    ];

    if (orderGuideKeywords.some((kw) => normalized.includes(kw))) {
      const tmpl = this.cachedTemplates.find((t) => t.category === 'order_guide');
      return {
        reply: tmpl ? tmpl.content : DEFAULT_AUTOREPLY_TEMPLATES[2].content,
        keywordMatched: 'cara_pemesanan',
        status: 'SUCCESS',
      };
    }

    // 6. Check Menu List (Section 2)
    const menuKeywords = [
      'menu apa saja',
      'menu tersedia',
      'daftar menu',
      'ada menu apa',
      'lihat menu',
      'pilihan menu',
      'makanan apa',
      'minuman apa',
    ];

    if (menuKeywords.some((kw) => normalized.includes(kw))) {
      const tmpl = this.cachedTemplates.find((t) => t.category === 'menu');
      return {
        reply: tmpl ? tmpl.content : DEFAULT_AUTOREPLY_TEMPLATES[1].content,
        keywordMatched: 'daftar_menu_favorit',
        status: 'SUCCESS',
      };
    }

    // 7. Check Greetings & "Apakah Warung Buka" (Section 2)
    const greetingKeywords = [
      'halo',
      'hello',
      'hai',
      'assalamualaikum',
      'selamat pagi',
      'selamat siang',
      'selamat malam',
      'apakah warung buka',
      'warung buka',
      'buka gak',
      'buka tidak',
      'masih buka',
    ];

    if (greetingKeywords.some((kw) => normalized.includes(kw))) {
      const tmpl = this.cachedTemplates.find((t) => t.category === 'greeting');
      return {
        reply: tmpl ? tmpl.content : DEFAULT_AUTOREPLY_TEMPLATES[0].content,
        keywordMatched: 'sapaan_warung_buka',
        status: 'SUCCESS',
      };
    }

    // 8. Match against FAQ Database (Section 4)
    const activeFAQs = this.cachedFAQs.filter((f) => f.isActive);
    let bestMatch: AutoReplyFAQ | null = null;
    let highestScore = 0;

    for (const faq of activeFAQs) {
      let score = 0;
      for (const kw of faq.keywords) {
        if (normalized.includes(kw.toLowerCase())) {
          score += 2;
        }
      }
      if (normalized.includes(faq.question.toLowerCase())) {
        score += 5;
      }
      if (score > highestScore && score >= 2) {
        highestScore = score;
        bestMatch = faq;
      }
    }

    if (bestMatch) {
      // Increment view count
      this.saveFAQ({
        ...bestMatch,
        viewCount: (bestMatch.viewCount || 0) + 1,
      }).catch(() => {});

      return {
        reply: `💡 *${bestMatch.question}*\n\n${bestMatch.answer}\n\nAda hal lain yang ingin Kakak tanyakan? Silakan pilih topik lain atau hubungi kasir kami.`,
        keywordMatched: `faq_${bestMatch.category}`,
        status: 'SUCCESS',
      };
    }

    // 9. Default Fallback
    return {
      reply: `Halo Kak ${customerName}! Terima kasih telah menghubungi WARUNG BANG KOBRA. 🐍\n\nUntuk bantuan cepat, Kakak bisa ketikkan:\n• *Menu* untuk katalog makanan & minuman\n• *Cara Pesan* untuk panduan order cepat\n• *Promo* untuk daftar diskon hari ini\n• *Status [Nomor Pesanan]* untuk cek pesanan\n• *Komplain* jika ada kendala pesanan\n\nAtau tekan tombol Hubungi Kasir untuk terhubung langsung dengan staf kami.`,
      keywordMatched: 'default_fallback',
      status: 'NO_MATCH',
    };
  }

  /**
   * Send Customer Message and Trigger Automated Reply Flow
   */
  static async sendCustomerMessage(params: {
    conversationId: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    messageText: string;
    channel?: 'web_chat' | 'whatsapp';
  }): Promise<{ userMessage: AutoReplyMessage; botMessage?: AutoReplyMessage }> {
    const startTime = Date.now();
    const channel = params.channel || 'web_chat';

    // 1. Create or Update Conversation Doc
    const convRef = doc(db, 'conversations', params.conversationId);
    const convSnap = await getDoc(convRef);

    const nowIso = new Date().toISOString();
    const userMessageId = `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const userMessage: AutoReplyMessage = {
      messageId: userMessageId,
      conversationId: params.conversationId,
      sender: 'customer',
      message: params.messageText,
      messageType: 'text',
      timestamp: nowIso,
      deliveryStatus: 'delivered',
      autoReply: false,
    };

    // Save customer message
    await setDoc(doc(db, 'messages', userMessageId), cleanFirestorePayload(userMessage));

    // 2. Compute Auto Reply
    const settings = this.cachedSettings;
    let botMessage: AutoReplyMessage | undefined = undefined;

    if (settings.isEnabled) {
      const replyData = await this.computeAutoReply(params.messageText, params.customerName, settings);
      const latency = Date.now() - startTime;

      const botMessageId = `MSG-${Date.now() + 1}-${Math.random().toString(36).slice(2, 6)}`;
      const newBotMessage: AutoReplyMessage = {
        messageId: botMessageId,
        conversationId: params.conversationId,
        sender: 'bot',
        message: replyData.reply,
        messageType: 'text',
        timestamp: new Date(Date.now() + (settings.replyDelaySeconds || 1) * 1000).toISOString(),
        deliveryStatus: 'sent',
        autoReply: true,
      };

      if (replyData.keywordMatched !== undefined && replyData.keywordMatched !== null) {
        newBotMessage.keywordMatched = replyData.keywordMatched;
      }
      if (replyData.metadata !== undefined && replyData.metadata !== null) {
        newBotMessage.metadata = cleanFirestorePayload(replyData.metadata);
      }

      botMessage = newBotMessage;

      // Save bot reply
      await setDoc(doc(db, 'messages', botMessageId), cleanFirestorePayload(botMessage));

      // Save Log
      const logId = `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const logEntry: AutoReplyLog = {
        id: logId,
        timestamp: nowIso,
        conversationId: params.conversationId,
        customerName: params.customerName || 'Pelanggan',
        customerPhone: params.customerPhone || '',
        inquiry: params.messageText,
        reply: replyData.reply,
        ruleMatched: replyData.keywordMatched || 'GENERAL',
        status: replyData.status,
        responseTimeMs: latency,
      };
      await setDoc(doc(db, 'autoReplyLogs', logId), cleanFirestorePayload(logEntry));
    }

    // Update conversation record
    const updatedStatus: AutoReplyConversation['status'] =
      params.messageText.toLowerCase().includes('komplain') || params.messageText.toLowerCase().includes('salah')
        ? 'complaint'
        : botMessage
        ? 'replied'
        : 'waiting_reply';

    const convData: AutoReplyConversation = {
      conversationId: params.conversationId,
      customerId: params.customerId || 'anon',
      customerName: params.customerName || 'Pelanggan',
      customerPhone: params.customerPhone || '',
      channel,
      lastMessage: botMessage ? botMessage.message : params.messageText,
      lastMessageAt: nowIso,
      unreadCount: convSnap.exists() ? (convSnap.data().unreadCount || 0) + 1 : 1,
      status: updatedStatus,
    };

    await setDoc(convRef, cleanFirestorePayload(convData), { merge: true });

    return { userMessage, botMessage };
  }

  /**
   * Cashier / Admin sends a manual message
   */
  static async sendStaffMessage(
    conversationId: string,
    messageText: string,
    senderRole: 'cashier' | 'admin' = 'cashier'
  ): Promise<AutoReplyMessage> {
    const nowIso = new Date().toISOString();
    const messageId = `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const staffMessage: AutoReplyMessage = {
      messageId,
      conversationId,
      sender: senderRole,
      message: messageText,
      messageType: 'text',
      timestamp: nowIso,
      deliveryStatus: 'sent',
      autoReply: false,
    };

    await setDoc(doc(db, 'messages', messageId), cleanFirestorePayload(staffMessage));

    // Update conversation: reset unread, mark replied
    const convRef = doc(db, 'conversations', conversationId);
    await setDoc(
      convRef,
      cleanFirestorePayload({
        lastMessage: messageText,
        lastMessageAt: nowIso,
        unreadCount: 0,
        status: 'replied',
      }),
      { merge: true }
    );

    return staffMessage;
  }

  /**
   * Mark Conversation as Read
   */
  static async markConversationRead(conversationId: string): Promise<void> {
    try {
      const convRef = doc(db, 'conversations', conversationId);
      await updateDoc(convRef, { unreadCount: 0 });
    } catch (err) {
      console.warn('markConversationRead notice:', err);
    }
  }

  /**
   * Generate WhatsApp Click-to-Chat Link for Customer (Section 8)
   */
  static getWhatsAppUrl(phone: string, text: string): string {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const intlPhone = cleanPhone.startsWith('0')
      ? '62' + cleanPhone.slice(1)
      : cleanPhone.startsWith('62')
      ? cleanPhone
      : '62' + cleanPhone;
    return `https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`;
  }
}
