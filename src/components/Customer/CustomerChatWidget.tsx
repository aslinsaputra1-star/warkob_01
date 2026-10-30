import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  ShoppingBag,
  Tag,
  HelpCircle,
  Clock,
  Phone,
  ExternalLink,
  ChevronDown,
  RefreshCw,
  CheckCheck,
} from 'lucide-react';
import { StoreSettings } from '../../types';
import { AutoReplyMessage, AutoReplySettings } from '../../types/autoReply';
import { AutoReplyService, DEFAULT_AUTOREPLY_SETTINGS } from '../../services/autoReplyService';
import { playCustomerMessageChime } from '../../utils/formatters';

interface CustomerChatWidgetProps {
  settings: StoreSettings;
  onNavigateToMenu?: () => void;
  onNavigateToPromo?: () => void;
  onNavigateToOrders?: () => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const CustomerChatWidget: React.FC<CustomerChatWidgetProps> = ({
  settings,
  onNavigateToMenu,
  onNavigateToPromo,
  onNavigateToOrders,
  showToast,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<AutoReplyMessage[]>([]);
  const [autoReplyConfig, setAutoReplyConfig] = useState<AutoReplySettings>(DEFAULT_AUTOREPLY_SETTINGS);
  const [unreadBadge, setUnreadBadge] = useState(1);

  // Persistent conversation ID for this customer device
  const [conversationId] = useState(() => {
    let savedId = localStorage.getItem('wbk_customer_conv_id');
    if (!savedId) {
      savedId = `CONV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      localStorage.setItem('wbk_customer_conv_id', savedId);
    }
    return savedId;
  });

  const customerName = localStorage.getItem('wbk_customer_name') || 'Pelanggan';
  const customerPhone = localStorage.getItem('wbk_customer_phone') || '';
  const customerId = localStorage.getItem('wbk_customer_id') || `CUST-${conversationId.slice(-6)}`;

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to AutoReplySettings
  useEffect(() => {
    const unsub = AutoReplyService.subscribeSettings((cfg) => {
      setAutoReplyConfig(cfg);
    });
    return () => unsub();
  }, []);

  // Subscribe to real-time Messages for this conversation
  useEffect(() => {
    const unsub = AutoReplyService.subscribeMessages(conversationId, (msgs) => {
      if (msgs.length === 0) {
        // Provide initial welcome message if completely empty
        const welcome: AutoReplyMessage = {
          messageId: 'welcome-init',
          conversationId,
          sender: 'bot',
          message:
            autoReplyConfig.welcomeMessage ||
            'Halo Kak! 👋 Selamat datang di layanan chat otomatis WARUNG BANG KOBRA. Ada yang bisa kami bantu?',
          messageType: 'text',
          timestamp: new Date().toISOString(),
          deliveryStatus: 'delivered',
          autoReply: true,
        };
        setMessages([welcome]);
      } else {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && (lastMsg.sender === 'bot' || lastMsg.sender === 'cashier')) {
          playCustomerMessageChime();
        }
        setMessages(msgs);
        if (!isOpen) {
          setUnreadBadge((prev) => Math.min(prev + 1, 9));
        }
      }
    });

    return () => unsub();
  }, [conversationId, autoReplyConfig.welcomeMessage, isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadBadge(0);
    }
  }, [messages, isOpen]);

  const handleSend = async (customText?: string) => {
    const textToSend = (customText !== undefined ? customText : inputText).trim();
    if (!textToSend || isSending) return;

    setIsSending(true);
    setInputText('');

    try {
      await AutoReplyService.sendCustomerMessage({
        conversationId,
        customerId,
        customerName,
        customerPhone,
        messageText: textToSend,
        channel: 'web_chat',
      });
    } catch (err) {
      console.error('Error sending message:', err);
      showToast?.('Gagal mengirim pesan, periksa koneksi', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickQuestion = (label: string, queryText: string) => {
    handleSend(queryText);
  };

  const cashierPhone = settings.whatsappNumber || autoReplyConfig.cashierWhatsApp || '081234567890';

  return (
    <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 select-none">
      {/* ================= CHAT POPUP WINDOW ================= */}
      {isOpen && (
        <div className="mb-3 w-[calc(100vw-2rem)] max-w-sm sm:max-w-md bg-[#0F0F0F] text-white rounded-3xl shadow-2xl border border-red-950/60 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200 h-[520px] sm:h-[560px]">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#9F0712] via-[#E50914] to-[#9F0712] p-4 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-2xl bg-black/40 border border-white/20 flex items-center justify-center p-1 shadow-inner">
                <Bot className="w-6 h-6 text-amber-300" />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-black rounded-full" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-black tracking-wide leading-tight">
                    {settings.storeName || 'WARUNG BANG KOBRA'}
                  </h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-400 text-black">
                    Auto Reply
                  </span>
                </div>
                <p className="text-[11px] text-white/80 leading-tight">
                  {autoReplyConfig.isEnabled ? '🟢 Bot Aktif • Siap Menjawab 24/7' : '⚪ Bot Nonaktif'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition active:scale-95 cursor-pointer"
              aria-label="Tutup Chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Questions Header Strip */}
          <div className="bg-[#171717] px-3 py-2 border-b border-white/10 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
            <span className="text-[10px] font-bold text-gray-400 shrink-0 uppercase tracking-wider pl-1">
              Topik:
            </span>

            <button
              type="button"
              onClick={() => handleQuickQuestion('Menu', 'Menu apa saja yang tersedia?')}
              className="px-2.5 py-1 rounded-full bg-[#262626] hover:bg-[#333333] text-gray-200 hover:text-white shrink-0 font-medium text-[11px] transition flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <ShoppingBag className="w-3 h-3 text-red-400" />
              <span>Lihat Menu</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickQuestion('Promo', 'Ada promo hari ini?')}
              className="px-2.5 py-1 rounded-full bg-[#262626] hover:bg-[#333333] text-gray-200 hover:text-white shrink-0 font-medium text-[11px] transition flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <Tag className="w-3 h-3 text-amber-400" />
              <span>Cek Promo</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickQuestion('Cara Pesan', 'Bagaimana cara pesan?')}
              className="px-2.5 py-1 rounded-full bg-[#262626] hover:bg-[#333333] text-gray-200 hover:text-white shrink-0 font-medium text-[11px] transition flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <HelpCircle className="w-3 h-3 text-emerald-400" />
              <span>Cara Pesan</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickQuestion('Status', 'Cek status pesanan saya')}
              className="px-2.5 py-1 rounded-full bg-[#262626] hover:bg-[#333333] text-gray-200 hover:text-white shrink-0 font-medium text-[11px] transition flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>Cek Status</span>
            </button>

            <a
              href={`https://wa.me/${cashierPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                'Halo Kasir Warung Bang Kobra, saya butuh bantuan langsung.'
              )}`}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-full bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-300 shrink-0 font-medium text-[11px] transition flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <Phone className="w-3 h-3 text-emerald-400" />
              <span>Hubungi Kasir</span>
            </a>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-[#0a0a0a] text-xs">
            {messages.map((m) => {
              const isCust = m.sender === 'customer';
              return (
                <div
                  key={m.messageId}
                  className={`flex flex-col ${isCust ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-md leading-relaxed whitespace-pre-wrap ${
                      isCust
                        ? 'bg-[#E50914] text-white rounded-br-xs'
                        : m.sender === 'bot'
                        ? 'bg-[#1C1C1E] text-gray-100 border border-white/10 rounded-bl-xs'
                        : 'bg-emerald-900/90 text-white border border-emerald-600/40 rounded-bl-xs'
                    }`}
                  >
                    {!isCust && (
                      <div className="flex items-center gap-1 text-[10px] font-black tracking-wider uppercase mb-1 text-amber-400">
                        <Bot className="w-3 h-3" />
                        <span>{m.sender === 'bot' ? 'Kobra Bot' : 'Kasir Toko'}</span>
                      </div>
                    )}
                    <p className="text-xs">{m.message}</p>

                    <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-white/50">
                      <span>
                        {new Date(m.timestamp).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {isCust && <CheckCheck className="w-3 h-3 text-white/70" />}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-2.5 bg-[#141414] border-t border-white/10">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Tulis pertanyaan (menu, status, promo)..."
                disabled={isSending}
                className="flex-1 bg-[#222222] border border-white/15 focus:border-red-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-hidden transition"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className="w-9 h-9 rounded-xl bg-[#E50914] hover:bg-[#b00710] disabled:bg-gray-800 disabled:text-gray-500 text-white flex items-center justify-center transition active:scale-95 cursor-pointer shadow-md shrink-0"
                aria-label="Kirim Pesan"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= FLOATING ACTION BUTTON (FAB) ================= */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setUnreadBadge(0);
        }}
        className="relative group w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-[#9F0712] via-[#E50914] to-[#FF7900] text-white shadow-2xl hover:shadow-red-600/40 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer border-2 border-white/30"
        aria-label="Buka Chat Auto Reply"
      >
        {isOpen ? (
          <ChevronDown className="w-7 h-7 sm:w-8 sm:h-8" />
        ) : (
          <>
            <MessageCircle className="w-7 h-7 sm:w-8 sm:h-8 text-white drop-shadow-md" />
            {unreadBadge > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-400 text-black text-[11px] font-black px-1.5 py-0.5 rounded-full border-2 border-black animate-bounce shadow-md">
                {unreadBadge}
              </span>
            )}
          </>
        )}
      </button>
    </div>
  );
};
export default CustomerChatWidget;
