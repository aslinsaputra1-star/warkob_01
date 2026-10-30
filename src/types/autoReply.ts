export type FAQCategory =
  | 'Informasi menu'
  | 'Harga produk'
  | 'Jam operasional'
  | 'Lokasi warung'
  | 'Cara pemesanan'
  | 'Metode pembayaran'
  | 'Takeaway'
  | 'Delivery Order'
  | 'Promo'
  | 'Status pesanan'
  | 'Komplain pelanggan'
  | 'Kontak kasir';

export const FAQ_CATEGORIES: FAQCategory[] = [
  'Informasi menu',
  'Harga produk',
  'Jam operasional',
  'Lokasi warung',
  'Cara pemesanan',
  'Metode pembayaran',
  'Takeaway',
  'Delivery Order',
  'Promo',
  'Status pesanan',
  'Komplain pelanggan',
  'Kontak kasir',
];

export interface AutoReplyOperatingHours {
  enabled: boolean;
  openTime: string; // e.g. "08:00"
  closeTime: string; // e.g. "22:00"
  daysOpen: string[]; // ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
  holidays: string[];
  outOfHoursMessage: string;
  notifyWhenClosed: boolean;
}

export interface AutoReplySettings {
  id: string; // 'global'
  isEnabled: boolean;
  welcomeMessage: string;
  closingMessage: string;
  operatingHours: AutoReplyOperatingHours;
  replyDelaySeconds: number; // 0, 1, 2
  notificationSound: boolean;
  forwardToCashier: boolean;
  cashierWhatsApp: string;
  language: 'id';
  whatsappIntegration: {
    mode: 'standard' | 'business' | 'api';
    phoneConnected?: string;
    status: 'connected' | 'manual' | 'disconnected';
    officialWebhookUrl?: string;
  };
  updatedAt: string;
  updatedBy?: string;
}

export interface AutoReplyTemplate {
  id: string;
  name: string;
  category: 'greeting' | 'menu' | 'order_guide' | 'order_status' | 'promo' | 'closed' | 'complaint' | 'custom';
  content: string;
  shortcut: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AutoReplyFAQ {
  id: string;
  category: FAQCategory;
  question: string;
  answer: string;
  keywords: string[];
  isActive: boolean;
  viewCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutoReplyConversation {
  conversationId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  channel: 'web_chat' | 'whatsapp' | 'manual';
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  status: 'active' | 'waiting_reply' | 'replied' | 'complaint' | 'closed';
  notes?: string;
  tags?: string[];
  lastKeywordMatched?: string;
}

export interface AutoReplyMessage {
  messageId: string;
  conversationId: string;
  sender: 'customer' | 'bot' | 'cashier' | 'admin';
  message: string;
  messageType: 'text' | 'menu_card' | 'order_card' | 'quick_reply' | 'system';
  timestamp: string;
  deliveryStatus: 'sent' | 'delivered' | 'read' | 'manual';
  autoReply: boolean;
  keywordMatched?: string;
  metadata?: {
    orderId?: string;
    orderNumber?: string;
    category?: string;
    actionType?: string;
    quickReplies?: string[];
  };
}

export interface AutoReplyLog {
  id: string;
  timestamp: string;
  conversationId: string;
  customerName: string;
  customerPhone?: string;
  inquiry: string;
  reply: string;
  ruleMatched: string;
  status: 'SUCCESS' | 'NO_MATCH' | 'FORWARDED' | 'OUT_OF_HOURS' | 'COMPLAINT';
  responseTimeMs: number;
}
