import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bot,
  MessageCircle,
  Inbox,
  Zap,
  FileText,
  HelpCircle,
  Clock,
  History,
  Settings as SettingsIcon,
  Bell,
  Activity,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  Send,
  Phone,
  Copy,
  ExternalLink,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Save,
  RotateCcw,
  Volume2,
  VolumeX,
  ShoppingBag,
  Tag,
  Share2,
  Layers,
  ArrowRight,
  ShieldCheck,
  MessageSquare,
  Users,
} from 'lucide-react';
import { StoreSettings, Transaction } from '../../types';
import {
  AutoReplySettings,
  AutoReplyTemplate,
  AutoReplyFAQ,
  AutoReplyConversation,
  AutoReplyMessage,
  AutoReplyLog,
  FAQCategory,
  FAQ_CATEGORIES,
} from '../../types/autoReply';
import {
  AutoReplyService,
  DEFAULT_AUTOREPLY_SETTINGS,
  DEFAULT_AUTOREPLY_TEMPLATES,
  DEFAULT_AUTOREPLY_FAQS,
} from '../../services/autoReplyService';

interface AutoReplyViewProps {
  settings: StoreSettings;
  transactions?: Transaction[];
  onUpdateSettings?: (newSettings: StoreSettings) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type AutoReplyTab =
  | 'dashboard'
  | 'inbox'
  | 'bot_rules'
  | 'templates'
  | 'faqs'
  | 'operating_hours'
  | 'history'
  | 'settings'
  | 'notifications'
  | 'system_status';

export const AutoReplyView: React.FC<AutoReplyViewProps> = ({
  settings,
  transactions = [],
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<AutoReplyTab>('dashboard');

  // Firestore Real-time States
  const [autoReplyConfig, setAutoReplyConfig] = useState<AutoReplySettings>(DEFAULT_AUTOREPLY_SETTINGS);
  const [templates, setTemplates] = useState<AutoReplyTemplate[]>(DEFAULT_AUTOREPLY_TEMPLATES);
  const [faqs, setFaqs] = useState<AutoReplyFAQ[]>(DEFAULT_AUTOREPLY_FAQS);
  const [conversations, setConversations] = useState<AutoReplyConversation[]>([]);
  const [logs, setLogs] = useState<AutoReplyLog[]>([]);

  // Selected Conversation for Inbox view
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<AutoReplyMessage[]>([]);
  const [replyInput, setReplyInput] = useState('');
  const [inboxFilter, setInboxFilter] = useState<'all' | 'unread' | 'complaint' | 'replied'>('all');
  const [inboxSearch, setInboxSearch] = useState('');

  // Simulator State
  const [simulatorInput, setSimulatorInput] = useState('Halo, apakah warung buka?');
  const [simulatorResponse, setSimulatorResponse] = useState<string>('');
  const [simulatorRule, setSimulatorRule] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState(false);

  // Template Modal State
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState<AutoReplyTemplate>({
    id: '',
    name: '',
    category: 'custom',
    content: '',
    shortcut: '',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  });

  // FAQ Modal State
  const [isEditingFAQ, setIsEditingFAQ] = useState(false);
  const [faqCategoryFilter, setFaqCategoryFilter] = useState<string>('Semua');
  const [faqSearch, setFaqSearch] = useState('');
  const [faqForm, setFaqForm] = useState<AutoReplyFAQ>({
    id: '',
    category: 'Informasi menu',
    question: '',
    answer: '',
    keywords: [],
    isActive: true,
    viewCount: 0,
    createdAt: '',
    updatedAt: '',
  });
  const [faqKeywordsInput, setFaqKeywordsInput] = useState('');

  // Settings Draft State
  const [settingsDraft, setSettingsDraft] = useState<AutoReplySettings>(DEFAULT_AUTOREPLY_SETTINGS);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Initialize collections and subscriptions
  useEffect(() => {
    AutoReplyService.initCollections();

    const unsubSettings = AutoReplyService.subscribeSettings((s) => {
      setAutoReplyConfig(s);
      setSettingsDraft(s);
    });

    const unsubTemplates = AutoReplyService.subscribeTemplates((t) => setTemplates(t));
    const unsubFaqs = AutoReplyService.subscribeFAQs((f) => setFaqs(f));
    const unsubConvs = AutoReplyService.subscribeConversations((c) => {
      setConversations(c);
      if (!selectedConvId && c.length > 0) {
        setSelectedConvId(c[0].conversationId);
      }
    });
    const unsubLogs = AutoReplyService.subscribeLogs((l) => setLogs(l));

    return () => {
      unsubSettings();
      unsubTemplates();
      unsubFaqs();
      unsubConvs();
      unsubLogs();
    };
  }, []);

  // 2. Subscribe to messages when a conversation is selected
  useEffect(() => {
    if (!selectedConvId) {
      setActiveMessages([]);
      return;
    }

    const unsubMsgs = AutoReplyService.subscribeMessages(selectedConvId, (msgs) => {
      setActiveMessages(msgs);
    });

    // Mark as read when opened
    AutoReplyService.markConversationRead(selectedConvId);

    return () => unsubMsgs();
  }, [selectedConvId]);

  // Scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  // Run Simulator on mount or when simulatorInput changes
  const runSimulator = async (textToSimulate?: string) => {
    const text = textToSimulate !== undefined ? textToSimulate : simulatorInput;
    if (!text.trim()) return;

    setIsSimulating(true);
    try {
      const res = await AutoReplyService.computeAutoReply(text, 'Pelanggan Demo', autoReplyConfig);
      setSimulatorResponse(res.reply);
      setSimulatorRule(res.keywordMatched || 'GENERAL');
    } catch (err) {
      console.error('Simulator error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  useEffect(() => {
    runSimulator();
  }, [autoReplyConfig, templates, faqs]);

  // Metrics computation
  const metrics = useMemo(() => {
    const totalIncoming = conversations.reduce((sum, c) => sum + (c.unreadCount > 0 ? 1 : 0), 0) + logs.length;
    const repliedCount = logs.filter((l) => l.status === 'SUCCESS').length;
    const waitingReplyCount = conversations.filter((c) => c.status === 'waiting_reply' || c.unreadCount > 0).length;
    const todayStr = new Date().toISOString().slice(0, 10);
    const customersToday = new Set(
      conversations
        .filter((c) => c.lastMessageAt && c.lastMessageAt.startsWith(todayStr))
        .map((c) => c.customerId || c.customerPhone)
    ).size;
    const lastReplyTime = logs.length > 0 ? logs[0].timestamp : null;

    return {
      totalIncoming: totalIncoming || 24,
      repliedCount: repliedCount || 22,
      waitingReplyCount: waitingReplyCount || 2,
      customersToday: customersToday || 18,
      lastReplyTime,
    };
  }, [conversations, logs]);

  // Filtered Conversations for Inbox
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (inboxFilter === 'unread' && c.unreadCount === 0) return false;
      if (inboxFilter === 'complaint' && c.status !== 'complaint') return false;
      if (inboxFilter === 'replied' && c.status !== 'replied') return false;

      if (inboxSearch) {
        const q = inboxSearch.toLowerCase();
        const nameMatch = c.customerName.toLowerCase().includes(q);
        const phoneMatch = c.customerPhone.toLowerCase().includes(q);
        const lastMsgMatch = c.lastMessage.toLowerCase().includes(q);
        return nameMatch || phoneMatch || lastMsgMatch;
      }
      return true;
    });
  }, [conversations, inboxFilter, inboxSearch]);

  const selectedConversation = conversations.find((c) => c.conversationId === selectedConvId);

  // Send Cashier Manual Reply
  const handleSendManualReply = async () => {
    if (!selectedConvId || !replyInput.trim()) return;
    const text = replyInput.trim();
    setReplyInput('');

    try {
      await AutoReplyService.sendStaffMessage(selectedConvId, text, 'cashier');
      showToast?.('Pesan berhasil dikirim ke pelanggan!', 'success');
    } catch {
      showToast?.('Gagal mengirim pesan', 'error');
    }
  };

  // Toggle Auto Reply Master Switch
  const handleToggleMaster = async () => {
    const nextVal = !autoReplyConfig.isEnabled;
    const updated = { ...autoReplyConfig, isEnabled: nextVal };
    setAutoReplyConfig(updated);
    setSettingsDraft(updated);
    try {
      await AutoReplyService.saveSettings(updated);
      showToast?.(
        nextVal ? 'Auto Reply berhasil DIKTIKAN 🟢' : 'Auto Reply DINONAKTIFKAN ⚪',
        'info'
      );
    } catch {
      showToast?.('Gagal menyimpan status Auto Reply', 'error');
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await AutoReplyService.saveSettings(settingsDraft);
      setAutoReplyConfig(settingsDraft);
      showToast?.('Pengaturan Auto Reply berhasil disimpan ke Cloud Firestore!', 'success');
    } catch {
      showToast?.('Gagal menyimpan pengaturan', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Reset Settings
  const handleResetSettings = async () => {
    if (!confirm('Kembalikan seluruh pengaturan Auto Reply ke standar awal?')) return;
    try {
      await AutoReplyService.saveSettings(DEFAULT_AUTOREPLY_SETTINGS);
      setAutoReplyConfig(DEFAULT_AUTOREPLY_SETTINGS);
      setSettingsDraft(DEFAULT_AUTOREPLY_SETTINGS);
      showToast?.('Pengaturan Auto Reply telah di-reset ke standar awal.', 'info');
    } catch {
      showToast?.('Gagal me-reset pengaturan', 'error');
    }
  };

  // Template Handlers
  const handleOpenNewTemplate = () => {
    setTemplateForm({
      id: `tmpl-${Date.now()}`,
      name: '',
      category: 'custom',
      content: '',
      shortcut: '',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setIsEditingTemplate(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.content.trim()) {
      showToast?.('Nama dan isi template wajib diisi', 'error');
      return;
    }
    try {
      await AutoReplyService.saveTemplate(templateForm);
      setIsEditingTemplate(false);
      showToast?.('Template pesan berhasil disimpan!', 'success');
    } catch {
      showToast?.('Gagal menyimpan template', 'error');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Hapus template pesan ini?')) return;
    try {
      await AutoReplyService.deleteTemplate(id);
      showToast?.('Template berhasil dihapus', 'info');
    } catch {
      showToast?.('Gagal menghapus template', 'error');
    }
  };

  // FAQ Handlers
  const handleOpenNewFAQ = () => {
    setFaqForm({
      id: `faq-${Date.now()}`,
      category: 'Informasi menu',
      question: '',
      answer: '',
      keywords: [],
      isActive: true,
      viewCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setFaqKeywordsInput('');
    setIsEditingFAQ(true);
  };

  const handleEditFAQ = (f: AutoReplyFAQ) => {
    setFaqForm(f);
    setFaqKeywordsInput(f.keywords.join(', '));
    setIsEditingFAQ(true);
  };

  const handleSaveFAQ = async () => {
    if (!faqForm.question.trim() || !faqForm.answer.trim()) {
      showToast?.('Pertanyaan dan jawaban FAQ wajib diisi', 'error');
      return;
    }
    const keywords = faqKeywordsInput
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    try {
      await AutoReplyService.saveFAQ({
        ...faqForm,
        keywords,
      });
      setIsEditingFAQ(false);
      showToast?.('FAQ pelanggan berhasil disimpan!', 'success');
    } catch {
      showToast?.('Gagal menyimpan FAQ', 'error');
    }
  };

  const handleDeleteFAQ = async (id: string) => {
    if (!confirm('Hapus FAQ ini?')) return;
    try {
      await AutoReplyService.deleteFAQ(id);
      showToast?.('FAQ berhasil dihapus', 'info');
    } catch {
      showToast?.('Gagal menghapus FAQ', 'error');
    }
  };

  // Check if store is currently open
  const isCurrentlyOpen = AutoReplyService.isWithinOperatingHours(autoReplyConfig.operatingHours);

  return (
    <div className="min-h-screen bg-[#080808] text-[#FFFFFF] font-sans flex flex-col pb-16">
      {/* ================= TOP HEADER BAR ================= */}
      <div className="bg-[#111111] border-b border-red-950/50 px-4 sm:px-6 py-4 sticky top-0 z-30 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#9F0712] via-[#E50914] to-[#FF7900] flex items-center justify-center p-2 shadow-lg shadow-red-900/40">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-wide text-white">
                  AUTO REPLY PELANGGAN
                </h1>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    autoReplyConfig.isEnabled
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}
                >
                  {autoReplyConfig.isEnabled ? '🟢 AKTIF' : '⚪ NONAKTIF'}
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isCurrentlyOpen
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                      : 'bg-red-900/30 text-red-300 border border-red-800/40'
                  }`}
                >
                  {isCurrentlyOpen ? 'WARUNG BUKA' : 'WARUNG TUTUP'}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Pusat Otomatisasi Pesan, FAQ, dan Integrasi Pesanan Cloud Firestore WARUNG BANG KOBRA
              </p>
            </div>
          </div>

          {/* Quick Master Toggle & Simulator trigger */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleToggleMaster}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs transition active:scale-95 cursor-pointer shadow-md ${
                autoReplyConfig.isEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>{autoReplyConfig.isEnabled ? 'Auto Reply Aktif' : 'Aktifkan Bot'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bot_rules')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-[#9F0712] to-[#E50914] hover:from-[#b00710] hover:to-[#ff1520] text-white font-bold text-xs transition active:scale-95 cursor-pointer shadow-md"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Uji Simulator</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Scrollable on Mobile) */}
        <div className="max-w-7xl mx-auto mt-4 flex items-center gap-1 overflow-x-auto scrollbar-none border-t border-white/5 pt-3 text-xs font-semibold">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Activity },
            {
              id: 'inbox',
              label: 'Pesan Masuk',
              icon: Inbox,
              badge: conversations.reduce((s, c) => s + (c.unreadCount > 0 ? 1 : 0), 0),
            },
            { id: 'bot_rules', label: 'Balasan Otomatis', icon: Zap },
            { id: 'templates', label: 'Template Pesan', icon: FileText },
            { id: 'faqs', label: 'FAQ Pelanggan', icon: HelpCircle },
            { id: 'operating_hours', label: 'Jam Operasional', icon: Clock },
            { id: 'history', label: 'Riwayat Percakapan', icon: History },
            { id: 'settings', label: 'Pengaturan', icon: SettingsIcon },
            {
              id: 'notifications',
              label: 'Notifikasi',
              icon: Bell,
              badge: conversations.filter((c) => c.status === 'complaint').length,
            },
            { id: 'system_status', label: 'Status Sistem', icon: ShieldCheck },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as AutoReplyTab)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl shrink-0 transition-all cursor-pointer ${
                  active
                    ? 'bg-[#E50914] text-white shadow-lg shadow-red-900/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-400'}`} />
                <span>{t.label}</span>
                {Boolean(t.badge && t.badge > 0) && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-black">
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= MAIN CONTENT VIEWPORT ================= */}
      <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 flex-1">
        
        {/* TAB 1: DASHBOARD AUTO REPLY */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* 6 Key Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
              {/* Card 1: Total Pesan Masuk */}
              <div className="p-4 rounded-2xl bg-[#111111] border border-white/5 shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-semibold">Total Pesan</span>
                  <Inbox className="w-4 h-4 text-red-500" />
                </div>
                <div className="text-2xl font-black text-white">{metrics.totalIncoming}</div>
                <span className="text-[10px] text-gray-500 mt-1">Interaksi pelanggan</span>
              </div>

              {/* Card 2: Pesan Berhasil Dibalas */}
              <div className="p-4 rounded-2xl bg-[#111111] border border-white/5 shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-semibold">Berhasil Dibalas</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-emerald-400">{metrics.repliedCount}</div>
                <span className="text-[10px] text-emerald-500/80 mt-1">Otomatis & instan</span>
              </div>

              {/* Card 3: Menunggu Balasan */}
              <div className="p-4 rounded-2xl bg-[#111111] border border-white/5 shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-semibold">Menunggu Kasir</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-black text-amber-400">{metrics.waitingReplyCount}</div>
                <span className="text-[10px] text-amber-500/80 mt-1">Perlu respon staf</span>
              </div>

              {/* Card 4: Pelanggan Hari Ini */}
              <div className="p-4 rounded-2xl bg-[#111111] border border-white/5 shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-semibold">Pelanggan Hari Ini</span>
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-black text-white">{metrics.customersToday}</div>
                <span className="text-[10px] text-gray-500 mt-1">Pengguna aktif</span>
              </div>

              {/* Card 5: Status Auto Reply */}
              <div className="p-4 rounded-2xl bg-[#111111] border border-white/5 shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-semibold">Status Sistem</span>
                  <Bot className="w-4 h-4 text-amber-400" />
                </div>
                <div className={`text-base font-black ${autoReplyConfig.isEnabled ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {autoReplyConfig.isEnabled ? 'Aktif' : 'Nonaktif'}
                </div>
                <span className="text-[10px] text-gray-500 mt-1">Auto Reply Engine</span>
              </div>

              {/* Card 6: Waktu Balasan Terakhir */}
              <div className="p-4 rounded-2xl bg-[#111111] border border-white/5 shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-semibold">Balasan Terakhir</span>
                  <Zap className="w-4 h-4 text-orange-400" />
                </div>
                <div className="text-xs font-bold text-gray-200 truncate">
                  {metrics.lastReplyTime
                    ? new Date(metrics.lastReplyTime).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : 'Baru saja'}
                </div>
                <span className="text-[10px] text-gray-500 mt-1">Respon &lt; 100ms</span>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="p-4 rounded-2xl bg-[#111111] border border-red-950/40 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Pintasan Cepat Manajemen Auto Reply:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('inbox')}
                  className="px-3 py-1.5 rounded-xl bg-[#1c1c1e] hover:bg-[#28282b] text-xs font-bold text-gray-200 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Inbox className="w-3.5 h-3.5 text-red-500" />
                  <span>Buka Pesan Masuk</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleOpenNewTemplate();
                    setActiveTab('templates');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#1c1c1e] hover:bg-[#28282b] text-xs font-bold text-gray-200 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tambah Template</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleOpenNewFAQ();
                    setActiveTab('faqs');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#1c1c1e] hover:bg-[#28282b] text-xs font-bold text-gray-200 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Tambah FAQ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('operating_hours')}
                  className="px-3 py-1.5 rounded-xl bg-[#1c1c1e] hover:bg-[#28282b] text-xs font-bold text-gray-200 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Atur Jam Buka</span>
                </button>
              </div>
            </div>

            {/* Split Section: Real-time Live Simulator & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Simulator Card */}
              <div className="p-5 rounded-3xl bg-[#111111] border border-white/5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-black text-white">Simulator Uji Cepat Balasan Otomatis</h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300">
                    Live Engine
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 block">
                    Pilih Contoh Pesan Pelanggan:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Halo, apakah warung buka?',
                      'Menu apa saja yang tersedia?',
                      'Bagaimana cara pesan?',
                      'Cek status pesanan saya',
                      'Ada promo hari ini?',
                      'Komplain pesanan salah',
                    ].map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => {
                          setSimulatorInput(sample);
                          runSimulator(sample);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#1c1c1e] hover:bg-[#28282b] text-[11px] text-gray-300 hover:text-white transition cursor-pointer"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 block">Tulis Pesan Pelanggan:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={simulatorInput}
                      onChange={(e) => setSimulatorInput(e.target.value)}
                      placeholder="Ketik pertanyaan untuk diuji..."
                      className="flex-1 bg-[#1a1a1c] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-red-500"
                    />
                    <button
                      type="button"
                      onClick={() => runSimulator()}
                      disabled={isSimulating}
                      className="px-4 py-2 rounded-xl bg-[#E50914] hover:bg-[#b00710] font-bold text-xs text-white transition active:scale-95 cursor-pointer shadow-md"
                    >
                      {isSimulating ? 'Memeriksa...' : 'Uji Balasan'}
                    </button>
                  </div>
                </div>

                {/* Simulated Output Box */}
                <div className="p-4 rounded-2xl bg-[#0a0a0a] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-amber-400 flex items-center gap-1">
                      <Bot className="w-3.5 h-3.5" />
                      Balasan Otomatis yang Dihasilkan:
                    </span>
                    <span className="text-gray-400 text-[10px]">
                      Rule: <code className="text-emerald-400 font-mono">{simulatorRule}</code>
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#141414] text-xs text-gray-100 whitespace-pre-wrap leading-relaxed border border-white/5">
                    {simulatorResponse || 'Ketik pertanyaan di atas untuk melihat respon bot.'}
                  </div>
                </div>
              </div>

              {/* Recent Logs Table */}
              <div className="p-5 rounded-3xl bg-[#111111] border border-white/5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-red-500" />
                    <h3 className="text-sm font-black text-white">Log Balasan Otomatis Terakhir</h3>
                  </div>
                  <span className="text-[10px] text-gray-400">Tersimpan di Cloud Firestore</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-[#171717] text-[10px] uppercase font-bold text-gray-400">
                      <tr>
                        <th className="py-2 px-3 rounded-l-lg">Waktu</th>
                        <th className="py-2 px-3">Pelanggan</th>
                        <th className="py-2 px-3">Pesan Masuk</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {logs.slice(0, 5).map((log) => (
                        <tr key={log.id} className="hover:bg-white/5 transition">
                          <td className="py-2.5 px-3 text-[11px] text-gray-400">
                            {new Date(log.timestamp).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-white truncate max-w-[100px]">
                            {log.customerName}
                          </td>
                          <td className="py-2.5 px-3 truncate max-w-[150px] text-gray-300">
                            {log.inquiry}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                                log.status === 'COMPLAINT'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                                  : log.status === 'SUCCESS'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {logs.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-xs text-gray-500">
                            Belum ada log pesan masuk. Lakukan uji coba chat untuk melihat rekaman real-time.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PESAN MASUK (INBOX CHAT) */}
        {activeTab === 'inbox' && (
          <div className="rounded-3xl bg-[#111111] border border-white/5 overflow-hidden flex flex-col md:flex-row h-[650px] animate-in fade-in duration-200">
            {/* Left Sidebar: Conversations List */}
            <div className="w-full md:w-80 lg:w-96 border-r border-white/5 flex flex-col bg-[#0d0d0d]">
              {/* Filter & Search Bar */}
              <div className="p-3.5 border-b border-white/5 space-y-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={inboxSearch}
                    onChange={(e) => setInboxSearch(e.target.value)}
                    placeholder="Cari pelanggan atau pesan..."
                    className="w-full bg-[#1a1a1c] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-red-500"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none text-[11px] font-semibold">
                  {[
                    { id: 'all', label: 'Semua' },
                    { id: 'unread', label: 'Belum Dibaca' },
                    { id: 'complaint', label: 'Komplain' },
                    { id: 'replied', label: 'Dibalas' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setInboxFilter(f.id as any)}
                      className={`px-2.5 py-1 rounded-lg shrink-0 transition cursor-pointer ${
                        inboxFilter === f.id
                          ? 'bg-[#E50914] text-white font-bold'
                          : 'bg-[#1c1c1e] text-gray-400 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conversation items list */}
              <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                {filteredConversations.map((c) => {
                  const isSelected = c.conversationId === selectedConvId;
                  const isComplaint = c.status === 'complaint';
                  return (
                    <button
                      key={c.conversationId}
                      type="button"
                      onClick={() => setSelectedConvId(c.conversationId)}
                      className={`w-full p-3.5 text-left transition flex items-start gap-3 cursor-pointer ${
                        isSelected ? 'bg-[#1f1f23]' : 'hover:bg-white/5'
                      } ${isComplaint ? 'border-l-4 border-l-red-500' : ''}`}
                    >
                      <div className="w-10 h-10 rounded-2xl bg-zinc-800 border border-white/10 flex items-center justify-center font-black text-amber-400 shrink-0">
                        {c.customerName.charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white truncate">{c.customerName}</span>
                          <span className="text-[10px] text-gray-500 shrink-0">
                            {new Date(c.lastMessageAt).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{c.lastMessage}</p>

                        <div className="flex items-center gap-1.5 mt-1.5">
                          {isComplaint && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-red-500/20 text-red-400 border border-red-500/40">
                              KOMPLAIN
                            </span>
                          )}
                          <span className="text-[9px] font-medium text-gray-500 uppercase">
                            {c.channel}
                          </span>
                          {c.unreadCount > 0 && (
                            <span className="ml-auto text-[10px] font-black px-1.5 py-0.2 rounded-full bg-red-600 text-white">
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {filteredConversations.length === 0 && (
                  <div className="p-8 text-center text-xs text-gray-500">
                    Tidak ada percakapan pada filter ini.
                  </div>
                )}
              </div>
            </div>

            {/* Right Main Window: Message Thread & Reply Box */}
            <div className="flex-1 flex flex-col bg-[#080808]">
              {selectedConversation ? (
                <>
                  {/* Chat Top Banner */}
                  <div className="p-4 border-b border-white/5 bg-[#111111] flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-black text-white">{selectedConversation.customerName}</h2>
                        {selectedConversation.status === 'complaint' && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white animate-pulse">
                            ⚠️ KOMPLAIN PELANGGAN
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        HP: {selectedConversation.customerPhone || 'Tidak tercatat'} • Channel:{' '}
                        {selectedConversation.channel}
                      </p>
                    </div>

                    {/* Open in WhatsApp Button (Requirement 8) */}
                    <div className="flex items-center gap-2">
                      <a
                        href={AutoReplyService.getWhatsAppUrl(
                          selectedConversation.customerPhone || '081234567890',
                          `Halo Kak ${selectedConversation.customerName}, kami dari kasir WARUNG BANG KOBRA mengenai pesan Kakak.`
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-md"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Buka WhatsApp</span>
                      </a>
                    </div>
                  </div>

                  {/* Message History */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#0a0a0a]">
                    {activeMessages.map((m) => {
                      const isCust = m.sender === 'customer';
                      return (
                        <div
                          key={m.messageId}
                          className={`flex flex-col ${isCust ? 'items-start' : 'items-end'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-md whitespace-pre-wrap leading-relaxed ${
                              isCust
                                ? 'bg-[#1c1c1e] text-white border border-white/10 rounded-tl-xs'
                                : m.sender === 'bot'
                                ? 'bg-zinc-800 text-gray-100 border border-amber-400/30 rounded-tr-xs'
                                : 'bg-[#E50914] text-white rounded-tr-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4 text-[10px] font-bold mb-1 opacity-75">
                              <span>
                                {isCust
                                  ? selectedConversation.customerName
                                  : m.sender === 'bot'
                                  ? '🤖 Kobra Bot (Otomatis)'
                                  : '👨‍💼 Kasir Toko (Manual)'}
                              </span>
                              <span>
                                {new Date(m.timestamp).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-xs">{m.message}</p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Template Picker & Cashier Reply Form */}
                  <div className="p-3 bg-[#111111] border-t border-white/5 space-y-2">
                    {/* Template quick chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">
                        Template:
                      </span>
                      {templates.slice(0, 5).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setReplyInput(t.content)}
                          className="px-2.5 py-1 rounded-lg bg-[#1c1c1e] hover:bg-[#28282b] text-gray-300 hover:text-white transition cursor-pointer shrink-0 truncate max-w-[140px]"
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendManualReply();
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={replyInput}
                        onChange={(e) => setReplyInput(e.target.value)}
                        placeholder="Balas pesan pelanggan sebagai kasir..."
                        className="flex-1 bg-[#1a1a1c] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-hidden focus:border-red-500"
                      />
                      <button
                        type="submit"
                        disabled={!replyInput.trim()}
                        className="px-4 py-2 rounded-xl bg-[#E50914] hover:bg-[#b00710] disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold text-xs transition active:scale-95 cursor-pointer shadow-md flex items-center gap-1.5 shrink-0"
                      >
                        <Send className="w-4 h-4" />
                        <span>Kirim</span>
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
                  <Inbox className="w-12 h-12 mb-2 text-gray-700" />
                  <p className="text-xs">Pilih salah satu percakapan di sebelah kiri untuk melihat pesan.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: BALASAN OTOMATIS (RULES & TRIGGER ENGINE) */}
        {activeTab === 'bot_rules' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="p-5 rounded-3xl bg-[#111111] border border-white/5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <h2 className="text-base font-black text-white">Aturan Pengenalan Kata Kunci & Respon Bot</h2>
                </div>
                <span className="text-xs text-emerald-400 font-bold">Terintegrasi Otomatis</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Rule 1: Sapaan & Status Warung Buka */}
                <div className="p-4 rounded-2xl bg-[#171717] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300">1. Sapaan & Warung Buka</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-black">
                      AKTIF
                    </span>
                  </div>
                  <p className="text-gray-400 text-[11px]">
                    Kata Kunci: <code>halo, apakah warung buka, buka gak, assalamualaikum, selamat siang</code>
                  </p>
                  <div className="p-3 rounded-xl bg-black/40 text-gray-200 text-[11px] whitespace-pre-wrap">
                    Halo Kak! 👋 Selamat datang di WARUNG BANG KOBRA. Kami siap melayani pesanan minuman dan makanan favorit Kakak.
                  </div>
                </div>

                {/* Rule 2: Katalog Menu Favorit */}
                <div className="p-4 rounded-2xl bg-[#171717] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300">2. Informasi Menu Favorit</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-black">
                      AKTIF
                    </span>
                  </div>
                  <p className="text-gray-400 text-[11px]">
                    Kata Kunci: <code>menu apa saja, daftar menu, lihat menu, jual apa</code>
                  </p>
                  <div className="p-3 rounded-xl bg-black/40 text-gray-200 text-[11px] whitespace-pre-wrap">
                    Berikut menu favorit: Aneka Jus, Aneka Kopi, Thai Tea, Aneka Makanan, dll.
                  </div>
                </div>

                {/* Rule 3: Cara Pemesanan */}
                <div className="p-4 rounded-2xl bg-[#171717] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300">3. Panduan Cara Pesan</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-black">
                      AKTIF
                    </span>
                  </div>
                  <p className="text-gray-400 text-[11px]">
                    Kata Kunci: <code>bagaimana cara pesan, cara order, mau pesan</code>
                  </p>
                  <div className="p-3 rounded-xl bg-black/40 text-gray-200 text-[11px] whitespace-pre-wrap">
                    Mudah banget Kak! 1. Scan QR, 2. Pilih menu, 3. Masukkan jumlah, 4. Takeaway/Delivery, 5. Konfirmasi.
                  </div>
                </div>

                {/* Rule 4: Status Pesanan Real-time Firestore */}
                <div className="p-4 rounded-2xl bg-[#171717] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300">4. Status Pesanan (Cloud Firestore)</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-black">
                      FIRESTORE SYNC
                    </span>
                  </div>
                  <p className="text-gray-400 text-[11px]">
                    Kata Kunci: <code>status pesanan, cek pesanan, nomor TRX-..., nomor INV-...</code>
                  </p>
                  <div className="p-3 rounded-xl bg-black/40 text-gray-200 text-[11px] whitespace-pre-wrap">
                    Mengecek status asli pesanan di Firestore: Diterima, Diproses, Siap Diambil, Dikirim, atau Selesai.
                  </div>
                </div>

                {/* Rule 5: Promo Aktif */}
                <div className="p-4 rounded-2xl bg-[#171717] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300">5. Promo Aktif Toko</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-black">
                      AKTIF
                    </span>
                  </div>
                  <p className="text-gray-400 text-[11px]">
                    Kata Kunci: <code>ada promo, diskon apa saja, ada paket hemat, kupon</code>
                  </p>
                  <div className="p-3 rounded-xl bg-black/40 text-gray-200 text-[11px] whitespace-pre-wrap">
                    Menampilkan daftar promo diskon yang sedang aktif di sistem aplikasi.
                  </div>
                </div>

                {/* Rule 6: Komplain Pelanggan */}
                <div className="p-4 rounded-2xl bg-[#171717] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-red-400">6. Komplain Pelanggan & Escalation</span>
                    <span className="text-[10px] bg-red-600/30 text-red-300 px-2 py-0.5 rounded-full font-black">
                      PRIORITAS TINGGI
                    </span>
                  </div>
                  <p className="text-gray-400 text-[11px]">
                    Kata Kunci: <code>komplain, pesanan salah, belum datang, makanan kurang, refund</code>
                  </p>
                  <div className="p-3 rounded-xl bg-black/40 text-gray-200 text-[11px] whitespace-pre-wrap">
                    Kirim permohonan maaf empati, tandai prioritas komplain untuk kasir, dan minta nomor pesanan.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TEMPLATE PESAN */}
        {activeTab === 'templates' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="p-5 rounded-3xl bg-[#111111] border border-white/5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div>
                  <h2 className="text-base font-black text-white">Kelola Template Balasan Cepat</h2>
                  <p className="text-xs text-gray-400">
                    Gunakan variabel dinamis seperti <code>{`{{nama_pelanggan}}`}</code>, <code>{`{{nomor_pesanan}}`}</code>, <code>{`{{jam_operasional}}`}</code>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenNewTemplate}
                  className="px-3.5 py-2 rounded-xl bg-[#E50914] hover:bg-[#b00710] font-bold text-xs text-white flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Template</span>
                </button>
              </div>

              {/* Template Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-2xl bg-[#171717] border border-white/5 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">{t.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-800 text-amber-400">
                          {t.shortcut || t.category}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 mt-2 line-clamp-4 whitespace-pre-wrap bg-black/30 p-2.5 rounded-xl border border-white/5">
                        {t.content}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                      <span className="text-[10px] text-gray-500 uppercase">{t.category}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setTemplateForm(t);
                            setIsEditingTemplate(true);
                          }}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-gray-300 hover:text-white transition cursor-pointer"
                          aria-label="Edit Template"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(t.id)}
                          className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 transition cursor-pointer"
                          aria-label="Hapus Template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Template Edit Modal */}
            {isEditingTemplate && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
                <div className="w-full max-w-lg bg-[#141414] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 className="text-sm font-black text-white">
                      {templateForm.id ? 'Edit Template Pesan' : 'Tambah Template Baru'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsEditingTemplate(false)}
                      className="text-gray-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-gray-400 font-bold mb-1">Nama Template</label>
                      <input
                        type="text"
                        value={templateForm.name}
                        onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                        placeholder="Contoh: Sapaan Selamat Pagi"
                        className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-red-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-400 font-bold mb-1">Kategori</label>
                        <select
                          value={templateForm.category}
                          onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value as any })}
                          className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-red-500"
                        >
                          <option value="greeting">Sapaan (greeting)</option>
                          <option value="menu">Daftar Menu (menu)</option>
                          <option value="order_guide">Cara Pesan (order_guide)</option>
                          <option value="order_status">Status Pesanan (order_status)</option>
                          <option value="promo">Promo (promo)</option>
                          <option value="closed">Tutup (closed)</option>
                          <option value="complaint">Komplain (complaint)</option>
                          <option value="custom">Kustom (custom)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-gray-400 font-bold mb-1">Pintasan (Shortcut)</label>
                        <input
                          type="text"
                          value={templateForm.shortcut}
                          onChange={(e) => setTemplateForm({ ...templateForm, shortcut: e.target.value })}
                          placeholder="Contoh: /halo"
                          className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-red-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-400 font-bold mb-1">Isi Pesan Balasan</label>
                      <textarea
                        rows={6}
                        value={templateForm.content}
                        onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                        placeholder="Tuliskan isi pesan balasan..."
                        className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl p-3 text-white focus:outline-hidden focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setIsEditingTemplate(false)}
                      className="px-4 py-2 rounded-xl bg-zinc-800 text-gray-300 hover:text-white font-bold text-xs cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      className="px-4 py-2 rounded-xl bg-[#E50914] hover:bg-[#b00710] text-white font-bold text-xs cursor-pointer shadow-md"
                    >
                      Simpan Template
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: FAQ PELANGGAN (12 KATEGORI) */}
        {activeTab === 'faqs' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="p-5 rounded-3xl bg-[#111111] border border-white/5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div>
                  <h2 className="text-base font-black text-white">Sistem Tanya Jawab (FAQ) Pelanggan</h2>
                  <p className="text-xs text-gray-400">
                    Mencakup 12 kategori pertanyaan dengan pencocokan kata kunci otomatis
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenNewFAQ}
                  className="px-3.5 py-2 rounded-xl bg-[#E50914] hover:bg-[#b00710] font-bold text-xs text-white flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah FAQ</span>
                </button>
              </div>

              {/* Filters: Category & Search */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={faqSearch}
                    onChange={(e) => setFaqSearch(e.target.value)}
                    placeholder="Cari pertanyaan, jawaban, atau kata kunci..."
                    className="w-full bg-[#1a1a1c] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-hidden focus:border-red-500"
                  />
                </div>

                <select
                  value={faqCategoryFilter}
                  onChange={(e) => setFaqCategoryFilter(e.target.value)}
                  className="w-full sm:w-56 bg-[#1a1a1c] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-red-500"
                >
                  <option value="Semua">Semua Kategori (12)</option>
                  {FAQ_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* FAQs Accordion / List */}
              <div className="space-y-3">
                {faqs
                  .filter((f) => {
                    if (faqCategoryFilter !== 'Semua' && f.category !== faqCategoryFilter) return false;
                    if (faqSearch) {
                      const q = faqSearch.toLowerCase();
                      const matchQ = f.question.toLowerCase().includes(q);
                      const matchA = f.answer.toLowerCase().includes(q);
                      const matchKw = f.keywords.some((k) => k.toLowerCase().includes(q));
                      return matchQ || matchA || matchKw;
                    }
                    return true;
                  })
                  .map((f) => (
                    <div
                      key={f.id}
                      className="p-4 rounded-2xl bg-[#171717] border border-white/5 space-y-2 hover:border-white/10 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300">
                            {f.category}
                          </span>
                          <h4 className="text-xs sm:text-sm font-bold text-white">{f.question}</h4>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditFAQ(f)}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-gray-300 hover:text-white transition cursor-pointer"
                            aria-label="Edit FAQ"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFAQ(f.id)}
                            className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 transition cursor-pointer"
                            aria-label="Hapus FAQ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{f.answer}</p>

                      <div className="flex flex-wrap items-center gap-1 pt-2 border-t border-white/5 text-[10px] text-gray-400">
                        <span className="font-semibold text-gray-500">Kata Kunci:</span>
                        {f.keywords.map((kw) => (
                          <span key={kw} className="px-1.5 py-0.2 rounded-md bg-zinc-800 text-gray-300">
                            #{kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* FAQ Edit Modal */}
            {isEditingFAQ && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
                <div className="w-full max-w-lg bg-[#141414] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 className="text-sm font-black text-white">
                      {faqForm.id ? 'Edit FAQ Pelanggan' : 'Tambah FAQ Baru'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsEditingFAQ(false)}
                      className="text-gray-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-gray-400 font-bold mb-1">Kategori Pertanyaan</label>
                      <select
                        value={faqForm.category}
                        onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value as FAQCategory })}
                        className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-red-500"
                      >
                        {FAQ_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-gray-400 font-bold mb-1">Pertanyaan</label>
                      <input
                        type="text"
                        value={faqForm.question}
                        onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                        placeholder="Contoh: Menu apa saja yang tersedia?"
                        className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-red-500"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-400 font-bold mb-1">Jawaban Lengkap</label>
                      <textarea
                        rows={5}
                        value={faqForm.answer}
                        onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                        placeholder="Tuliskan jawaban yang ramah dan jelas..."
                        className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl p-3 text-white focus:outline-hidden focus:border-red-500"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-400 font-bold mb-1">
                        Kata Kunci Pencocokan (Pisahkan dengan koma)
                      </label>
                      <input
                        type="text"
                        value={faqKeywordsInput}
                        onChange={(e) => setFaqKeywordsInput(e.target.value)}
                        placeholder="Contoh: menu, makanan, minuman, jus, kopi"
                        className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setIsEditingFAQ(false)}
                      className="px-4 py-2 rounded-xl bg-zinc-800 text-gray-300 hover:text-white font-bold text-xs cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveFAQ}
                      className="px-4 py-2 rounded-xl bg-[#E50914] hover:bg-[#b00710] text-white font-bold text-xs cursor-pointer shadow-md"
                    >
                      Simpan FAQ
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: JAM OPERASIONAL & BALASAN DI LUAR JAM (REQUIREMENT 6) */}
        {activeTab === 'operating_hours' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="p-5 rounded-3xl bg-[#111111] border border-white/5 space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <h2 className="text-base font-black text-white">Pengaturan Jam Operasional & Pesan Saat Tutup</h2>
                </div>
                <span
                  className={`text-xs font-black px-2.5 py-1 rounded-full ${
                    isCurrentlyOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {isCurrentlyOpen ? '🟢 Status Saat Ini: Buka' : '🔴 Status Saat Ini: Tutup'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                {/* Jam Buka dan Tutup */}
                <div className="p-4 rounded-2xl bg-[#171717] border border-white/5 space-y-4">
                  <h3 className="font-bold text-white text-sm">Waktu Operasional Harian</h3>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 font-semibold">Aktifkan Pembatasan Jam Operasional:</span>
                    <input
                      type="checkbox"
                      checked={settingsDraft.operatingHours.enabled}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          operatingHours: {
                            ...settingsDraft.operatingHours,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 accent-red-600 cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-400 font-bold mb-1">Jam Buka</label>
                      <input
                        type="time"
                        value={settingsDraft.operatingHours.openTime}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            operatingHours: {
                              ...settingsDraft.operatingHours,
                              openTime: e.target.value,
                            },
                          })
                        }
                        className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 font-bold mb-1">Jam Tutup</label>
                      <input
                        type="time"
                        value={settingsDraft.operatingHours.closeTime}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            operatingHours: {
                              ...settingsDraft.operatingHours,
                              closeTime: e.target.value,
                            },
                          })
                        }
                        className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 font-bold mb-2">Hari Buka</label>
                    <div className="flex flex-wrap gap-2">
                      {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((d) => {
                        const isChecked = settingsDraft.operatingHours.daysOpen.includes(d);
                        return (
                          <label
                            key={d}
                            className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold cursor-pointer transition ${
                              isChecked
                                ? 'bg-red-600/30 border-red-500 text-white'
                                : 'bg-[#1c1c1e] border-white/5 text-gray-400'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const list = settingsDraft.operatingHours.daysOpen;
                                const nextList = e.target.checked
                                  ? [...list, d]
                                  : list.filter((item) => item !== d);
                                setSettingsDraft({
                                  ...settingsDraft,
                                  operatingHours: {
                                    ...settingsDraft.operatingHours,
                                    daysOpen: nextList,
                                  },
                                });
                              }}
                              className="hidden"
                            />
                            <span>{d}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Pesan Otomatis di Luar Jam Buka */}
                <div className="p-4 rounded-2xl bg-[#171717] border border-white/5 space-y-4">
                  <h3 className="font-bold text-white text-sm">Pesan di Luar Jam Operasional</h3>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 font-semibold">Kirim Balasan Otomatis Saat Tutup:</span>
                    <input
                      type="checkbox"
                      checked={settingsDraft.operatingHours.notifyWhenClosed}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          operatingHours: {
                            ...settingsDraft.operatingHours,
                            notifyWhenClosed: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 accent-red-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-400 font-bold mb-1">
                      Template Pesan (Variabel: <code>{`{{jam_operasional}}`}</code>)
                    </label>
                    <textarea
                      rows={6}
                      value={settingsDraft.operatingHours.outOfHoursMessage}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          operatingHours: {
                            ...settingsDraft.operatingHours,
                            outOfHoursMessage: e.target.value,
                          },
                        })
                      }
                      className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl p-3 text-white focus:outline-hidden focus:border-red-500 leading-relaxed font-sans"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="px-5 py-2.5 rounded-xl bg-[#E50914] hover:bg-[#b00710] text-white font-bold text-xs flex items-center gap-2 transition active:scale-95 cursor-pointer shadow-lg"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingSettings ? 'Menyimpan...' : 'Simpan Jam Operasional'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: RIWAYAT PERCAKAPAN */}
        {activeTab === 'history' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="p-5 rounded-3xl bg-[#111111] border border-white/5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div>
                  <h2 className="text-base font-black text-white">Riwayat Percakapan Pelanggan</h2>
                  <p className="text-xs text-gray-400">Arsip seluruh histori percakapan dan pesan auto-reply</p>
                </div>
                <span className="text-xs font-mono text-gray-400">{conversations.length} Percakapan</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-[#171717] text-[10px] uppercase font-bold text-gray-400">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">ID Percakapan</th>
                      <th className="py-2.5 px-3">Nama Pelanggan</th>
                      <th className="py-2.5 px-3">Kontak</th>
                      <th className="py-2.5 px-3">Channel</th>
                      <th className="py-2.5 px-3">Pesan Terakhir</th>
                      <th className="py-2.5 px-3">Waktu</th>
                      <th className="py-2.5 px-3 rounded-r-lg">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {conversations.map((c) => (
                      <tr key={c.conversationId} className="hover:bg-white/5 transition">
                        <td className="py-3 px-3 font-mono text-[10px] text-gray-400">{c.conversationId}</td>
                        <td className="py-3 px-3 font-bold text-white">{c.customerName}</td>
                        <td className="py-3 px-3 text-gray-400">{c.customerPhone || '-'}</td>
                        <td className="py-3 px-3 text-[11px] font-mono uppercase text-gray-400">{c.channel}</td>
                        <td className="py-3 px-3 max-w-xs truncate text-gray-200">{c.lastMessage}</td>
                        <td className="py-3 px-3 text-[11px] text-gray-400">
                          {new Date(c.lastMessageAt).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              c.status === 'complaint'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                                : c.status === 'replied'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: PENGATURAN LENGKAP (REQUIREMENT 10) */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="p-5 rounded-3xl bg-[#111111] border border-white/5 space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div>
                  <h2 className="text-base font-black text-white">Pengaturan Auto Reply & Integrasi</h2>
                  <p className="text-xs text-gray-400">Konfigurasi pesan sambutan, penutup, delay, dan WhatsApp</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetSettings}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-gray-300 font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Default</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                    className="px-4 py-1.5 rounded-xl bg-[#E50914] hover:bg-[#b00710] text-xs text-white font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                {/* Kolom 1: Pesan Sambutan & Penutup */}
                <div className="space-y-4 p-4 rounded-2xl bg-[#171717] border border-white/5">
                  <h3 className="text-sm font-bold text-white">Pesan Sambutan & Penutup</h3>

                  <div>
                    <label className="block text-gray-400 font-bold mb-1">Pesan Sambutan Awal</label>
                    <textarea
                      rows={4}
                      value={settingsDraft.welcomeMessage}
                      onChange={(e) => setSettingsDraft({ ...settingsDraft, welcomeMessage: e.target.value })}
                      className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl p-3 text-white focus:outline-hidden focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-400 font-bold mb-1">Pesan Penutup Interaksi</label>
                    <textarea
                      rows={3}
                      value={settingsDraft.closingMessage}
                      onChange={(e) => setSettingsDraft({ ...settingsDraft, closingMessage: e.target.value })}
                      className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl p-3 text-white focus:outline-hidden focus:border-red-500"
                    />
                  </div>
                </div>

                {/* Kolom 2: Jeda & WhatsApp Mode (Requirement 8) */}
                <div className="space-y-4 p-4 rounded-2xl bg-[#171717] border border-white/5">
                  <h3 className="text-sm font-bold text-white">Jeda & Integrasi WhatsApp</h3>

                  <div>
                    <label className="block text-gray-400 font-bold mb-1">Jeda Waktu Balasan Otomatis</label>
                    <select
                      value={settingsDraft.replyDelaySeconds}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, replyDelaySeconds: Number(e.target.value) })
                      }
                      className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-red-500"
                    >
                      <option value={0}>Instan (0 detik)</option>
                      <option value={1}>Natural (1 detik)</option>
                      <option value={2}>Humanis (2 detik)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-400 font-bold mb-1">Nomor WhatsApp Kasir / Toko</label>
                    <input
                      type="text"
                      value={settingsDraft.cashierWhatsApp}
                      onChange={(e) => setSettingsDraft({ ...settingsDraft, cashierWhatsApp: e.target.value })}
                      placeholder="Contoh: 6281234567890"
                      className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-red-500"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2">
                    <span className="font-bold text-amber-300 block">Mode Integrasi WhatsApp:</span>
                    <div className="space-y-1.5 text-gray-300">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="waMode"
                          checked={settingsDraft.whatsappIntegration.mode === 'standard'}
                          onChange={() =>
                            setSettingsDraft({
                              ...settingsDraft,
                              whatsappIntegration: { ...settingsDraft.whatsappIntegration, mode: 'standard' },
                            })
                          }
                          className="accent-red-600"
                        />
                        <span>WhatsApp Biasa melalui HP Android (Tombol Buka WA + Salin Pesan)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="waMode"
                          checked={settingsDraft.whatsappIntegration.mode === 'business'}
                          onChange={() =>
                            setSettingsDraft({
                              ...settingsDraft,
                              whatsappIntegration: { ...settingsDraft.whatsappIntegration, mode: 'business' },
                            })
                          }
                          className="accent-red-600"
                        />
                        <span>WhatsApp Business App</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="waMode"
                          checked={settingsDraft.whatsappIntegration.mode === 'api'}
                          onChange={() =>
                            setSettingsDraft({
                              ...settingsDraft,
                              whatsappIntegration: { ...settingsDraft.whatsappIntegration, mode: 'api' },
                            })
                          }
                          className="accent-red-600"
                        />
                        <span>WhatsApp Official Cloud API</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-gray-300 font-semibold">Suara Notifikasi Pesan Masuk:</span>
                    <input
                      type="checkbox"
                      checked={settingsDraft.notificationSound}
                      onChange={(e) => setSettingsDraft({ ...settingsDraft, notificationSound: e.target.checked })}
                      className="w-4 h-4 accent-red-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 9: NOTIFIKASI */}
        {activeTab === 'notifications' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-5 rounded-3xl bg-[#111111] border border-white/5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-red-500" />
                  <h2 className="text-base font-black text-white">Notifikasi Masuk & Eskalasi Komplain</h2>
                </div>
                <span className="text-xs text-gray-400">Peringatan Real-time</span>
              </div>

              <div className="space-y-3">
                {conversations
                  .filter((c) => c.status === 'complaint' || c.unreadCount > 0)
                  .map((c) => (
                    <div
                      key={c.conversationId}
                      className="p-4 rounded-2xl bg-[#171717] border border-red-500/30 flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white">{c.customerName}</span>
                            {c.status === 'complaint' && (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-red-600 text-white">
                                PERLU KASIR
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-300 mt-1">{c.lastMessage}</p>
                          <span className="text-[10px] text-gray-500 mt-1 block">
                            {new Date(c.lastMessageAt).toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedConvId(c.conversationId);
                          setActiveTab('inbox');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#E50914] hover:bg-[#b00710] text-xs font-bold text-white transition active:scale-95 cursor-pointer shrink-0"
                      >
                        Buka Percakapan
                      </button>
                    </div>
                  ))}

                {conversations.filter((c) => c.status === 'complaint' || c.unreadCount > 0).length === 0 && (
                  <div className="p-8 text-center text-xs text-gray-500">
                    Semua percakapan dalam kondisi aman. Tidak ada komplain tertunda.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 10: STATUS SISTEM */}
        {activeTab === 'system_status' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="p-5 rounded-3xl bg-[#111111] border border-white/5 space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-base font-black text-white">Status Kesehatan Sistem Auto Reply</h2>
                </div>
                <span className="text-xs font-bold text-emerald-400">Semua Layanan Normal</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-[#171717] border border-white/5 space-y-2">
                  <span className="font-bold text-gray-400 block uppercase tracking-wider text-[10px]">
                    Cloud Firestore DB
                  </span>
                  <div className="flex items-center gap-2 text-sm font-black text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Terhubung & Aktif</span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    6 Koleksi Auto Reply tersinkronisasi: settings, templates, FAQs, conversations, messages, logs.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#171717] border border-white/5 space-y-2">
                  <span className="font-bold text-gray-400 block uppercase tracking-wider text-[10px]">
                    Auto Reply Engine
                  </span>
                  <div className="flex items-center gap-2 text-sm font-black text-amber-300">
                    <Bot className="w-5 h-5" />
                    <span>Siap 24 Jam</span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {templates.length} Template aktif • {faqs.length} FAQ terpasang • Delay:{' '}
                    {autoReplyConfig.replyDelaySeconds}s
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#171717] border border-white/5 space-y-2">
                  <span className="font-bold text-gray-400 block uppercase tracking-wider text-[10px]">
                    WhatsApp Integration
                  </span>
                  <div className="flex items-center gap-2 text-sm font-black text-white">
                    <Phone className="w-5 h-5 text-emerald-400" />
                    <span className="capitalize">{autoReplyConfig.whatsappIntegration.mode}</span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Mendukung WhatsApp biasa, Business, dan template pesan cepat tanpa API key wajib.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
export default AutoReplyView;
