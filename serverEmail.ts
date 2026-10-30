import { Router } from "express";
import fs from "fs";
import path from "path";
import { Resend } from "resend";

const DATA_DIR = path.join(process.cwd(), "data");
const VAULT_FILE = path.join(DATA_DIR, "email_vault.json");
const LOGS_FILE = path.join(DATA_DIR, "email_logs.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.warn("Failed to create data directory for email vault:", err);
  }
}

export interface EmailVaultConfig {
  resendApiKey: string;
  fromEmail: string;
  senderName: string;
  replyTo: string;
  storeNotificationEmail: string;
  isEnabled: boolean;
  notifyCustomerReceipt: boolean;
  notifyStoreNewOrder: boolean;
  notifyStoreOrderStatus: boolean;
  notifyStorePreOrder: boolean;
  notifyStoreLowStock: boolean;
  lastTestAt: string | null;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: "SUCCESS" | "FAILED" | null;
  lastDeliveryError: string | null;
}

export interface EmailLogItem {
  id: string;
  eventType: string; // "CUSTOMER_RECEIPT" | "STORE_NEW_ORDER" | "STORE_ORDER_STATUS" | "TEST_EMAIL"
  timestamp: string;
  recipient: string;
  subject: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  durationMs: number;
  messageId?: string;
  error?: string;
  idempotencyKey?: string;
}

const DEFAULT_CONFIG: EmailVaultConfig = {
  resendApiKey: process.env.RESEND_API_KEY || "",
  fromEmail: process.env.RESEND_FROM_EMAIL || "Warung Bang Kobra <onboarding@resend.dev>",
  senderName: "Warung Bang Kobra",
  replyTo: process.env.STORE_NOTIFICATION_EMAIL || "rayyanarasid549@gmail.com",
  storeNotificationEmail: process.env.STORE_NOTIFICATION_EMAIL || "rayyanarasid549@gmail.com",
  isEnabled: true,
  notifyCustomerReceipt: true,
  notifyStoreNewOrder: true,
  notifyStoreOrderStatus: true,
  notifyStorePreOrder: true,
  notifyStoreLowStock: false,
  lastTestAt: null,
  lastDeliveryAt: null,
  lastDeliveryStatus: null,
  lastDeliveryError: null,
};

// In-memory deduplication cache: key -> timestamp (15 minutes TTL)
const deduplicationCache = new Map<string, number>();
const DEDUP_TTL_MS = 15 * 60 * 1000;

// Rate limiting: ip -> timestamps[]
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_EMAILS_PER_WINDOW = 20;

function cleanupDedupCache() {
  const now = Date.now();
  for (const [key, exp] of deduplicationCache.entries()) {
    if (exp <= now) {
      deduplicationCache.delete(key);
    }
  }
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const valid = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (valid.length >= MAX_EMAILS_PER_WINDOW) {
    return false;
  }
  valid.push(now);
  rateLimitMap.set(ip, valid);
  return true;
}

function readVaultConfig(): EmailVaultConfig {
  try {
    if (fs.existsSync(VAULT_FILE)) {
      const raw = fs.readFileSync(VAULT_FILE, "utf8");
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        resendApiKey: parsed.resendApiKey || process.env.RESEND_API_KEY || "",
        fromEmail: parsed.fromEmail || process.env.RESEND_FROM_EMAIL || DEFAULT_CONFIG.fromEmail,
        storeNotificationEmail: parsed.storeNotificationEmail || process.env.STORE_NOTIFICATION_EMAIL || DEFAULT_CONFIG.storeNotificationEmail,
      };
    }
  } catch (err) {
    console.warn("Error reading email vault:", err);
  }
  return { ...DEFAULT_CONFIG };
}

function writeVaultConfig(config: EmailVaultConfig): boolean {
  try {
    fs.writeFileSync(VAULT_FILE, JSON.stringify(config, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("Error writing email vault:", err);
    return false;
  }
}

function readLogs(): EmailLogItem[] {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      const raw = fs.readFileSync(LOGS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 100);
      }
    }
  } catch (err) {
    console.warn("Error reading email logs:", err);
  }
  return [];
}

function appendLog(log: EmailLogItem) {
  try {
    const existing = readLogs();
    const updated = [log, ...existing].slice(0, 100);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(updated, null, 2), "utf8");
  } catch (err) {
    console.warn("Error appending email log:", err);
  }
}

function maskApiKey(key?: string): string {
  if (!key || key.trim() === "") return "";
  const clean = key.trim();
  if (clean.length <= 8) return "••••••••";
  return clean.slice(0, 4) + "••••••••" + clean.slice(-4);
}

function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
}

function formatRupiahServer(amount: number): string {
  return "Rp" + (amount || 0).toLocaleString("id-ID");
}

// ==========================================
// RESPONSIVE HTML & TEXT EMAIL BUILDERS
// ==========================================

function buildCustomerReceiptEmail(order: any, settings: any = {}) {
  const storeName = settings.storeName || "WARUNG BANG KOBRA";
  const orderId = order.id_transaksi || "BK-000";
  const date = order.tanggal || new Date().toISOString().split("T")[0];
  const time = order.jam || new Date().toTimeString().split(" ")[0];
  const customerName = order.nama_pelanggan || "Pelanggan Terhormat";
  const orderType = order.orderType === "DELIVERY_DQM" ? "Delivery DQM (Antar ke Lokasi)" : "Bungkus / Takeaway";
  const paymentMethod = order.metode_pembayaran || "QRIS";
  const status = order.status || "MENUNGGU";
  const subtotal = Number(order.subtotal || 0);
  const deliveryFee = Number(order.biaya || order.deliveryFee || 0);
  const diskon = Number(order.diskon || 0);
  const total = Number(order.total || subtotal + deliveryFee - diskon);

  const items = Array.isArray(order.items) ? order.items : [];
  const itemsHtml = items
    .map(
      (it: any) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f1f1f1; font-size: 14px; color: #1e293b;">
          <strong>${it.nama_produk || it.productName || "Menu"}</strong>
          ${it.variantName ? `<br><span style="font-size: 12px; color: #64748b;">Varian: ${it.variantName}</span>` : ""}
          ${it.catatan ? `<br><span style="font-size: 11px; color: #94a3b8; font-style: italic;">Catatan: ${it.catatan}</span>` : ""}
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f1f1f1; font-size: 14px; color: #64748b; text-align: center;">
          ${it.qty || 1}x
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f1f1f1; font-size: 14px; color: #0f172a; text-align: right; font-weight: 600;">
          ${formatRupiahServer(it.subtotal || (it.harga || 0) * (it.qty || 1))}
        </td>
      </tr>
    `
    )
    .join("");

  const itemsText = items
    .map(
      (it: any) =>
        `- ${it.nama_produk || it.productName || "Menu"} ${it.variantName ? `(${it.variantName})` : ""} x${it.qty || 1} = ${formatRupiahServer(
          it.subtotal || (it.harga || 0) * (it.qty || 1)
        )}`
    )
    .join("\n");

  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bukti Pesanan ${orderId} - ${storeName}</title>
    </head>
    <body style="margin: 0; padding: 20px 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" style="max-width: 580px; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;" border="0" cellspacing="0" cellpadding="0">
              
              <!-- Header Brand -->
              <tr>
                <td style="background: linear-gradient(135deg, #F20D18 0%, #B9000B 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
                  <h1 style="margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">
                    ${storeName}
                  </h1>
                  <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9; font-weight: 500;">
                    Es Bang Kobra — Warkob Drink • Mudah, Cepat, Lezaat!
                  </p>
                </td>
              </tr>

              <!-- Receipt Notice -->
              <tr>
                <td style="padding: 24px 24px 12px 24px;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td>
                        <span style="display: inline-block; padding: 4px 12px; background: #ecfdf5; color: #047857; border-radius: 50px; font-size: 12px; font-weight: 700; text-transform: uppercase;">
                          ✓ Pesanan Tersimpan
                        </span>
                      </td>
                      <td align="right">
                        <span style="font-family: monospace; font-size: 14px; font-weight: 800; color: #F20D18;">
                          #${orderId}
                        </span>
                      </td>
                    </tr>
                  </table>
                  
                  <h2 style="margin: 16px 0 4px 0; font-size: 18px; color: #0f172a; font-weight: 800;">
                    Halo, ${customerName}!
                  </h2>
                  <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.5;">
                    Terima kasih telah memesan di <strong>${storeName}</strong>. Berikut rincian bukti pesanan Anda:
                  </p>
                </td>
              </tr>

              <!-- Metadata Card -->
              <tr>
                <td style="padding: 0 24px 16px 24px;">
                  <div style="background: #f8fafc; border-radius: 12px; padding: 14px 16px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="4">
                      <tr>
                        <td width="35%" style="color: #64748b;">Waktu:</td>
                        <td style="font-weight: 600;">${date} • ${time} WIB</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b;">Layanan:</td>
                        <td style="font-weight: 600;">${orderType}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b;">Pembayaran:</td>
                        <td style="font-weight: 600;">${paymentMethod}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b;">Status:</td>
                        <td style="font-weight: 700; color: #F20D18;">${status}</td>
                      </tr>
                      ${
                        order.deliveryLocation
                          ? `<tr>
                              <td style="color: #64748b;">Lokasi Antar:</td>
                              <td style="font-weight: 600;">${order.deliveryLocation} ${
                              order.deliveryDetail ? `(${order.deliveryDetail})` : ""
                            }</td>
                            </tr>`
                          : ""
                      }
                    </table>
                  </div>
                </td>
              </tr>

              <!-- Items Table -->
              <tr>
                <td style="padding: 0 24px 16px 24px;">
                  <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
                    Rincian Menu
                  </h3>
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <thead>
                      <tr style="border-bottom: 2px solid #e2e8f0;">
                        <th align="left" style="padding-bottom: 8px; font-size: 12px; color: #64748b; font-weight: 600;">ITEM</th>
                        <th align="center" style="padding-bottom: 8px; font-size: 12px; color: #64748b; font-weight: 600;">QTY</th>
                        <th align="right" style="padding-bottom: 8px; font-size: 12px; color: #64748b; font-weight: 600;">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsHtml}
                    </tbody>
                  </table>
                </td>
              </tr>

              <!-- Financial Summary -->
              <tr>
                <td style="padding: 0 24px 24px 24px;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="6" style="border-top: 1px solid #e2e8f0; font-size: 14px;">
                    <tr>
                      <td style="color: #64748b;">Subtotal Menu:</td>
                      <td align="right" style="font-weight: 600; color: #0f172a;">${formatRupiahServer(subtotal)}</td>
                    </tr>
                    ${
                      deliveryFee > 0
                        ? `<tr>
                            <td style="color: #64748b;">Ongkos Kirim Delivery DQM:</td>
                            <td align="right" style="font-weight: 600; color: #0f172a;">${formatRupiahServer(deliveryFee)}</td>
                          </tr>`
                        : ""
                    }
                    ${
                      diskon > 0
                        ? `<tr>
                            <td style="color: #16a34a;">Potongan Diskon:</td>
                            <td align="right" style="font-weight: 600; color: #16a34a;">-${formatRupiahServer(diskon)}</td>
                          </tr>`
                        : ""
                    }
                    <tr style="border-top: 2px solid #0f172a;">
                      <td style="font-size: 16px; font-weight: 800; color: #0f172a; padding-top: 10px;">Total Pembayaran:</td>
                      <td align="right" style="font-size: 18px; font-weight: 900; color: #F20D18; padding-top: 10px;">
                        ${formatRupiahServer(total)}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer Note -->
              <tr>
                <td style="background: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.5;">
                  <p style="margin: 0 0 6px 0;">
                    Ada pertanyaan terkait pesanan ini? Hubungi kami via WhatsApp kasir di <strong>0812-3456-7890</strong>.
                  </p>
                  <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                    Email ini dikirim secara otomatis oleh sistem <strong>${storeName}</strong>. Simpan email ini sebagai bukti transaksi sah.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
BUKTI PESANAN - ${storeName}
Nomor Pesanan: #${orderId}
Tanggal: ${date} ${time} WIB
Pelanggan: ${customerName}
Layanan: ${orderType}
Pembayaran: ${paymentMethod}
Status: ${status}

RINCIAN MENU:
${itemsText}

Subtotal: ${formatRupiahServer(subtotal)}
${deliveryFee > 0 ? `Ongkir: ${formatRupiahServer(deliveryFee)}\n` : ""}${diskon > 0 ? `Diskon: -${formatRupiahServer(diskon)}\n` : ""}TOTAL: ${formatRupiahServer(total)}

Terima kasih atas pesanan Anda di ${storeName}!
  `.trim();

  return { html, text };
}

function buildStoreNotificationEmail(order: any, type: "NEW_ORDER" | "STATUS_UPDATE") {
  const orderId = order.id_transaksi || "BK-000";
  const date = order.tanggal || new Date().toISOString().split("T")[0];
  const time = order.jam || new Date().toTimeString().split(" ")[0];
  const customerName = order.nama_pelanggan || "Pelanggan";
  const phone = order.no_whatsapp || "-";
  const orderType = order.orderType === "DELIVERY_DQM" ? "Delivery DQM" : "Takeaway / Bungkus";
  const total = Number(order.total || 0);
  const status = order.status || "MENUNGGU";

  const isNew = type === "NEW_ORDER";
  const title = isNew ? `[PESANAN BARU] #${orderId} dari ${customerName}` : `[UPDATE STATUS] #${orderId} -> ${status}`;

  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head><meta charset="utf-8"><title>${title}</title></head>
    <body style="font-family: sans-serif; background: #f8fafc; padding: 20px; color: #0f172a;">
      <div style="max-width: 540px; margin: auto; background: #ffffff; border-radius: 16px; padding: 24px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="border-left: 4px solid #F20D18; padding-left: 12px; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 18px; color: #F20D18; font-weight: 800;">
            ${isNew ? "NOTIFIKASI OPERASIONAL: PESANAN BARU MASUK" : "NOTIFIKASI: PERUBAHAN STATUS PESANAN"}
          </h2>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">
            Warung Bang Kobra — Sistem Manajemen Pesanan
          </p>
        </div>

        <table width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size: 14px; background: #f8fafc; border-radius: 10px; margin-bottom: 20px;">
          <tr>
            <td width="35%" style="color: #64748b;">Nomor Order:</td>
            <td style="font-weight: 700; color: #F20D18; font-family: monospace;">#${orderId}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Pelanggan:</td>
            <td style="font-weight: 600;">${customerName} (${phone})</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Waktu:</td>
            <td>${date} ${time} WIB</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Tipe Order:</td>
            <td style="font-weight: 600;">${orderType}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Total Nilai:</td>
            <td style="font-weight: 800; font-size: 16px; color: #0f172a;">${formatRupiahServer(total)}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Status Sekarang:</td>
            <td style="font-weight: 700; color: #047857;">${status}</td>
          </tr>
        </table>

        <p style="font-size: 13px; color: #475569; margin: 0;">
          Silakan buka dasbor kasir atau panel manajemen pesanan untuk memproses pesanan ini.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
${title}
Nomor Order: #${orderId}
Pelanggan: ${customerName} (${phone})
Waktu: ${date} ${time} WIB
Layanan: ${orderType}
Total: ${formatRupiahServer(total)}
Status: ${status}
  `.trim();

  return { html, text, title };
}

// ==========================================
// EXPRESS ROUTER FACTORY
// ==========================================

export function createEmailRouter(): Router {
  const router = Router();

  // GET /api/email/config - Read masked config
  router.get("/config", (_req, res) => {
    const config = readVaultConfig();
    return res.json({
      configured: Boolean(config.resendApiKey && config.resendApiKey.trim().length > 5),
      maskedApiKey: maskApiKey(config.resendApiKey),
      fromEmail: config.fromEmail,
      senderName: config.senderName,
      replyTo: config.replyTo,
      storeNotificationEmail: config.storeNotificationEmail,
      isEnabled: config.isEnabled,
      notifyCustomerReceipt: config.notifyCustomerReceipt,
      notifyStoreNewOrder: config.notifyStoreNewOrder,
      notifyStoreOrderStatus: config.notifyStoreOrderStatus,
      notifyStorePreOrder: config.notifyStorePreOrder,
      notifyStoreLowStock: config.notifyStoreLowStock,
      lastTestAt: config.lastTestAt,
      lastDeliveryAt: config.lastDeliveryAt,
      lastDeliveryStatus: config.lastDeliveryStatus,
      lastDeliveryError: config.lastDeliveryError,
    });
  });

  // POST /api/email/config - Update config (Owner/Admin)
  router.post("/config", (req, res) => {
    try {
      const current = readVaultConfig();
      const body = req.body || {};

      let newApiKey = current.resendApiKey;
      if (typeof body.resendApiKey === "string" && body.resendApiKey.trim() !== "") {
        newApiKey = body.resendApiKey.trim();
      }

      const updated: EmailVaultConfig = {
        ...current,
        resendApiKey: newApiKey,
        fromEmail: typeof body.fromEmail === "string" && body.fromEmail.trim() ? body.fromEmail.trim() : current.fromEmail,
        senderName: typeof body.senderName === "string" && body.senderName.trim() ? body.senderName.trim() : current.senderName,
        replyTo: typeof body.replyTo === "string" && body.replyTo.trim() ? body.replyTo.trim() : current.replyTo,
        storeNotificationEmail:
          typeof body.storeNotificationEmail === "string" && body.storeNotificationEmail.trim()
            ? body.storeNotificationEmail.trim()
            : current.storeNotificationEmail,
        isEnabled: body.isEnabled !== undefined ? Boolean(body.isEnabled) : current.isEnabled,
        notifyCustomerReceipt: body.notifyCustomerReceipt !== undefined ? Boolean(body.notifyCustomerReceipt) : current.notifyCustomerReceipt,
        notifyStoreNewOrder: body.notifyStoreNewOrder !== undefined ? Boolean(body.notifyStoreNewOrder) : current.notifyStoreNewOrder,
        notifyStoreOrderStatus: body.notifyStoreOrderStatus !== undefined ? Boolean(body.notifyStoreOrderStatus) : current.notifyStoreOrderStatus,
        notifyStorePreOrder: body.notifyStorePreOrder !== undefined ? Boolean(body.notifyStorePreOrder) : current.notifyStorePreOrder,
        notifyStoreLowStock: body.notifyStoreLowStock !== undefined ? Boolean(body.notifyStoreLowStock) : current.notifyStoreLowStock,
      };

      const success = writeVaultConfig(updated);
      if (!success) {
        return res.status(500).json({ success: false, message: "Gagal menyimpan konfigurasi email ke server." });
      }

      return res.json({
        success: true,
        message: "Pengaturan integrasi email berhasil disimpan.",
        configured: Boolean(updated.resendApiKey && updated.resendApiKey.trim().length > 5),
        maskedApiKey: maskApiKey(updated.resendApiKey),
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Kesalahan internal server." });
    }
  });

  // POST /api/email/test - Live test email
  router.post("/test", async (req, res) => {
    const startTime = Date.now();
    const config = readVaultConfig();
    const targetEmail = req.body.targetEmail || config.storeNotificationEmail || "rayyanarasid549@gmail.com";

    if (!isValidEmail(targetEmail)) {
      return res.status(400).json({ success: false, message: "Alamat email penerima uji coba tidak valid." });
    }

    const apiKey = (req.body.resendApiKey && String(req.body.resendApiKey).trim()) || config.resendApiKey;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: "API Key Resend belum diisi. Masukkan RESEND_API_KEY di pengaturan sebelum melakukan uji coba.",
      });
    }

    try {
      const resend = new Resend(apiKey);
      const fromSender = config.fromEmail || "Warung Bang Kobra <onboarding@resend.dev>";

      const sendResult = await resend.emails.send({
        from: fromSender,
        to: targetEmail,
        subject: `[UJI COBA BERHASIL] Integrasi Email Warung Bang Kobra • ${new Date().toLocaleTimeString("id-ID")}`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
            <h2 style="color: #16a34a; margin-top: 0;">✓ Uji Coba Pengiriman Berhasil!</h2>
            <p style="color: #334155; font-size: 14px; line-height: 1.6;">
              Selamat! Integrasi Resend API untuk <strong>Warung Bang Kobra</strong> telah terhubung dengan sempurna.
            </p>
            <div style="background: #f8fafc; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #475569;">
              <strong>Penerima:</strong> ${targetEmail}<br>
              <strong>Waktu:</strong> ${new Date().toLocaleString("id-ID")}<br>
              <strong>Pengirim:</strong> ${fromSender}
            </div>
            <p style="color: #94a3b8; font-size: 11px; margin-top: 20px;">
              Pesan ini dibuat otomatis oleh panel pengaturan Warung Bang Kobra.
            </p>
          </div>
        `,
        text: `Uji coba integrasi email Warung Bang Kobra berhasil dikirim ke ${targetEmail} pada ${new Date().toLocaleString("id-ID")}.`,
      });

      const durationMs = Date.now() - startTime;

      if (sendResult.error) {
        throw new Error(sendResult.error.message || "Resend API mengembalikan kesalahan.");
      }

      const logItem: EmailLogItem = {
        id: `LOG-${Date.now()}`,
        eventType: "TEST_EMAIL",
        timestamp: new Date().toISOString(),
        recipient: targetEmail,
        subject: "Uji Coba Resend API",
        status: "SUCCESS",
        durationMs,
        messageId: sendResult.data?.id,
      };
      appendLog(logItem);

      config.lastTestAt = new Date().toISOString();
      config.lastDeliveryAt = new Date().toISOString();
      config.lastDeliveryStatus = "SUCCESS";
      config.lastDeliveryError = null;
      writeVaultConfig(config);

      return res.json({
        success: true,
        message: `Email uji coba berhasil dikirim ke ${targetEmail}`,
        durationMs,
        messageId: sendResult.data?.id,
      });
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errMsg = err?.message || "Gagal menghubungi layanan email Resend.";

      const logItem: EmailLogItem = {
        id: `LOG-${Date.now()}`,
        eventType: "TEST_EMAIL",
        timestamp: new Date().toISOString(),
        recipient: targetEmail,
        subject: "Uji Coba Resend API",
        status: "FAILED",
        durationMs,
        error: errMsg,
      };
      appendLog(logItem);

      config.lastTestAt = new Date().toISOString();
      config.lastDeliveryStatus = "FAILED";
      config.lastDeliveryError = errMsg;
      writeVaultConfig(config);

      return res.status(500).json({
        success: false,
        message: `Gagal mengirim email: ${errMsg}`,
        durationMs,
      });
    }
  });

  // POST /api/email/send-order-receipt - Customer Order Receipt
  router.post("/send-order-receipt", async (req, res) => {
    const startTime = Date.now();
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";

    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        success: false,
        message: "Terlalu banyak permintaan pengiriman email. Silakan tunggu 1 menit.",
      });
    }

    cleanupDedupCache();

    const { order, customerEmail, idempotencyKey } = req.body || {};
    if (!order || !order.id_transaksi) {
      return res.status(400).json({ success: false, message: "Data pesanan tidak lengkap." });
    }

    const recipient = String(customerEmail || order.email_pelanggan || "").trim().toLowerCase();
    if (!recipient || !isValidEmail(recipient)) {
      return res.status(400).json({ success: false, message: "Alamat email pelanggan tidak valid." });
    }

    // Idempotency check
    const dedupKey = idempotencyKey || `order-receipt-${order.id_transaksi}-${recipient}`;
    if (deduplicationCache.has(dedupKey)) {
      return res.json({
        success: true,
        message: "Struk email untuk pesanan ini sudah pernah dikirim sebelumnya (duplikasi dicegah).",
        skipped: true,
      });
    }

    const config = readVaultConfig();
    if (!config.isEnabled || !config.notifyCustomerReceipt) {
      return res.json({
        success: false,
        skipped: true,
        message: "Fitur pengiriman bukti pesanan email dinonaktifkan di pengaturan warung.",
      });
    }

    if (!config.resendApiKey) {
      return res.status(200).json({
        success: false,
        skipped: true,
        message: "Layanan email belum aktif (RESEND_API_KEY belum dikonfigurasi oleh pemilik warung).",
      });
    }

    try {
      const resend = new Resend(config.resendApiKey);
      const { html, text } = buildCustomerReceiptEmail(order);
      const subject = `Bukti Pesanan #${order.id_transaksi} — Warung Bang Kobra`;

      const sendResult = await resend.emails.send({
        from: config.fromEmail || "Warung Bang Kobra <onboarding@resend.dev>",
        to: recipient,
        replyTo: config.replyTo || undefined,
        subject,
        html,
        text,
      });

      const durationMs = Date.now() - startTime;

      if (sendResult.error) {
        throw new Error(sendResult.error.message || "Resend API error");
      }

      // Mark idempotency key (valid for 15 minutes)
      deduplicationCache.set(dedupKey, Date.now() + DEDUP_TTL_MS);

      const logItem: EmailLogItem = {
        id: `LOG-${Date.now()}`,
        eventType: "CUSTOMER_RECEIPT",
        timestamp: new Date().toISOString(),
        recipient,
        subject,
        status: "SUCCESS",
        durationMs,
        messageId: sendResult.data?.id,
        idempotencyKey: dedupKey,
      };
      appendLog(logItem);

      config.lastDeliveryAt = new Date().toISOString();
      config.lastDeliveryStatus = "SUCCESS";
      config.lastDeliveryError = null;
      writeVaultConfig(config);

      return res.json({
        success: true,
        message: `Bukti pesanan berhasil dikirim ke ${recipient}`,
        messageId: sendResult.data?.id,
        durationMs,
      });
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errMessage = err?.message || "Gagal mengirim email bukti pesanan";

      const logItem: EmailLogItem = {
        id: `LOG-${Date.now()}`,
        eventType: "CUSTOMER_RECEIPT",
        timestamp: new Date().toISOString(),
        recipient,
        subject: `Bukti Pesanan #${order.id_transaksi}`,
        status: "FAILED",
        durationMs,
        error: errMessage,
        idempotencyKey: dedupKey,
      };
      appendLog(logItem);

      config.lastDeliveryStatus = "FAILED";
      config.lastDeliveryError = errMessage;
      writeVaultConfig(config);

      return res.status(200).json({
        success: false,
        message: `Gagal mengirim bukti pesanan via email: ${errMessage}`,
        durationMs,
      });
    }
  });

  // POST /api/email/notify-store - Store notification (New Order / Status Update)
  router.post("/notify-store", async (req, res) => {
    const startTime = Date.now();
    cleanupDedupCache();

    const { order, eventType, idempotencyKey } = req.body || {};
    if (!order || !order.id_transaksi) {
      return res.status(400).json({ success: false, message: "Data pesanan tidak lengkap." });
    }

    const type = eventType === "STATUS_UPDATE" ? "STATUS_UPDATE" : "NEW_ORDER";
    const dedupKey = idempotencyKey || `store-notify-${order.id_transaksi}-${type}-${order.status || ""}`;

    if (deduplicationCache.has(dedupKey)) {
      return res.json({
        success: true,
        message: "Notifikasi toko sudah pernah dikirim sebelumnya.",
        skipped: true,
      });
    }

    const config = readVaultConfig();
    if (!config.isEnabled) {
      return res.json({ success: false, skipped: true, message: "Integrasi email nonaktif." });
    }

    if (type === "NEW_ORDER" && !config.notifyStoreNewOrder) {
      return res.json({ success: false, skipped: true, message: "Notifikasi pesanan baru ke email toko dinonaktifkan." });
    }

    if (type === "STATUS_UPDATE" && !config.notifyStoreOrderStatus) {
      return res.json({ success: false, skipped: true, message: "Notifikasi update status ke email toko dinonaktifkan." });
    }

    const recipient = config.storeNotificationEmail;
    if (!recipient || !isValidEmail(recipient) || !config.resendApiKey) {
      return res.json({
        success: false,
        skipped: true,
        message: "Alamat email toko atau RESEND_API_KEY belum dikonfigurasi.",
      });
    }

    try {
      const resend = new Resend(config.resendApiKey);
      const { html, text, title } = buildStoreNotificationEmail(order, type);

      const sendResult = await resend.emails.send({
        from: config.fromEmail || "Warung Bang Kobra <onboarding@resend.dev>",
        to: recipient,
        subject: title,
        html,
        text,
      });

      const durationMs = Date.now() - startTime;

      if (sendResult.error) {
        throw new Error(sendResult.error.message || "Resend API error");
      }

      deduplicationCache.set(dedupKey, Date.now() + DEDUP_TTL_MS);

      const logItem: EmailLogItem = {
        id: `LOG-${Date.now()}`,
        eventType: type === "NEW_ORDER" ? "STORE_NEW_ORDER" : "STORE_ORDER_STATUS",
        timestamp: new Date().toISOString(),
        recipient,
        subject: title,
        status: "SUCCESS",
        durationMs,
        messageId: sendResult.data?.id,
        idempotencyKey: dedupKey,
      };
      appendLog(logItem);

      return res.json({
        success: true,
        message: `Notifikasi toko berhasil dikirim ke ${recipient}`,
        messageId: sendResult.data?.id,
        durationMs,
      });
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errMessage = err?.message || "Gagal mengirim notifikasi toko";

      const logItem: EmailLogItem = {
        id: `LOG-${Date.now()}`,
        eventType: type === "NEW_ORDER" ? "STORE_NEW_ORDER" : "STORE_ORDER_STATUS",
        timestamp: new Date().toISOString(),
        recipient,
        subject: `[NOTIF TOKO] #${order.id_transaksi}`,
        status: "FAILED",
        durationMs,
        error: errMessage,
        idempotencyKey: dedupKey,
      };
      appendLog(logItem);

      return res.status(200).json({
        success: false,
        message: errMessage,
        durationMs,
      });
    }
  });

  // GET /api/email/logs - Delivery Logs
  router.get("/logs", (_req, res) => {
    const logs = readLogs();
    return res.json(logs);
  });

  return router;
}
