import { Transaction } from '../types';

export interface EmailClientConfig {
  configured: boolean;
  maskedApiKey: string;
  fromEmail: string;
  senderName: string;
  replyTo: string;
  storeNotificationEmail: string;
  isEnabled: boolean;
  notifyCustomerReceipt: boolean;
  notifyStoreNewOrder: boolean;
  notifyStoreOrderStatus: boolean;
  notifyStorePreOrder?: boolean;
  notifyStoreLowStock?: boolean;
  lastTestAt: string | null;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: 'SUCCESS' | 'FAILED' | null;
  lastDeliveryError: string | null;
}

export interface EmailLogItem {
  id: string;
  eventType: string;
  timestamp: string;
  recipient: string;
  subject: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  durationMs: number;
  messageId?: string;
  error?: string;
  idempotencyKey?: string;
}

export class EmailService {
  /**
   * Fetch current Email integration configuration (masked Resend API key)
   */
  static async getConfig(): Promise<EmailClientConfig | null> {
    try {
      const res = await fetch('/api/email/config');
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn('Notice: Failed to fetch Email config:', err);
      return null;
    }
  }

  /**
   * Update Email vault settings (Owner/Admin)
   */
  static async updateConfig(
    payload: Partial<EmailClientConfig> & { resendApiKey?: string }
  ): Promise<{ success: boolean; message: string; maskedApiKey?: string }> {
    try {
      const res = await fetch('/api/email/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return {
        success: data.success ?? res.ok,
        message: data.message || (res.ok ? 'Pengaturan email berhasil disimpan' : 'Gagal menyimpan pengaturan'),
        maskedApiKey: data.maskedApiKey,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Gagal menghubungi server.',
      };
    }
  }

  /**
   * Send test email to verify Resend API deliverability
   */
  static async testConnection(
    targetEmail?: string,
    customApiKey?: string
  ): Promise<{ success: boolean; message: string; durationMs?: number; messageId?: string }> {
    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail, resendApiKey: customApiKey }),
      });
      const data = await res.json();
      return {
        success: data.success ?? res.ok,
        message: data.message || (res.ok ? 'Email uji coba berhasil dikirim' : 'Gagal mengirim email'),
        durationMs: data.durationMs,
        messageId: data.messageId,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Gagal menghubungi server pengujian email.',
      };
    }
  }

  /**
   * Send Customer Order Receipt Email
   * Called ONLY AFTER the order is saved in Firestore!
   */
  static async sendOrderReceipt(
    order: Transaction,
    customerEmail?: string
  ): Promise<{ success: boolean; message: string; messageId?: string; skipped?: boolean }> {
    const emailToUse = String(customerEmail || order.email_pelanggan || '').trim().toLowerCase();
    if (!emailToUse || !emailToUse.includes('@')) {
      return { success: false, message: 'Alamat email pelanggan tidak valid atau kosong', skipped: true };
    }

    try {
      const idempotencyKey = `order-receipt-${order.id_transaksi}-${emailToUse}`;
      const res = await fetch('/api/email/send-order-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order,
          customerEmail: emailToUse,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      return {
        success: Boolean(data.success),
        message: data.message || (data.success ? 'Struk pesanan berhasil dikirim ke email.' : 'Gagal mengirim struk email.'),
        messageId: data.messageId,
        skipped: Boolean(data.skipped),
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Gagal menghubungi server pengiriman email.',
      };
    }
  }

  /**
   * Notify Store Owner / Kitchen of New Order or Order Status Update
   */
  static async notifyStore(
    order: Transaction,
    eventType: 'NEW_ORDER' | 'STATUS_UPDATE' = 'NEW_ORDER'
  ): Promise<{ success: boolean; message: string; skipped?: boolean }> {
    try {
      const idempotencyKey = `store-notify-${order.id_transaksi}-${eventType}-${order.status || ''}`;
      const res = await fetch('/api/email/notify-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order,
          eventType,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      return {
        success: Boolean(data.success),
        message: data.message || '',
        skipped: Boolean(data.skipped),
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Gagal menghubungi server notifikasi toko.',
      };
    }
  }

  /**
   * Fetch recent delivery logs
   */
  static async getLogs(): Promise<EmailLogItem[]> {
    try {
      const res = await fetch('/api/email/logs');
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      console.warn('Notice: Failed to fetch email logs:', err);
      return [];
    }
  }
}
