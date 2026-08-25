"use client";

import {
  Bell,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  LoaderCircle,
  Mic,
  Pencil,
  Plus,
  RefreshCw,
  Repeat2,
  Send,
  Sparkles,
  Trash2,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { fmt, parseAmount } from "@/lib/format";
import { BareIcon, CategoryIcon, ICON_MAP } from "@/lib/icons";
import type { CategoryDTO, FinanceData, TxnType, UserDTO } from "@/lib/types";

type CategoryInput = { name: string; icon: string; color: string; type: TxnType };
type GoalInput = { name: string; targetCents: number; color: string; icon: string };

const PRESET_COLORS = [
  "#b6f244",
  "#ff6e82",
  "#38bdf8",
  "#a78bfa",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#eab308",
  "#6366f1",
  "#14b8a6",
];

const AVAILABLE_ICONS = Object.keys(ICON_MAP);

export function ManageView({
  data,
  user,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onCreateBudget,
  onDeleteBudget,
  onCreateGoal,
  onDeleteGoal,
  onTogglePaid,
}: {
  data: FinanceData;
  user?: UserDTO;
  onCreateCategory: (input: CategoryInput) => Promise<void>;
  onUpdateCategory?: (id: number, input: Partial<CategoryInput>) => Promise<void>;
  onDeleteCategory: (id: number) => Promise<void>;
  onCreateBudget: (categoryId: number, amountCents: number) => Promise<void>;
  onDeleteBudget: (id: number) => Promise<void>;
  onCreateGoal: (input: GoalInput) => Promise<void>;
  onDeleteGoal: (id: number) => Promise<void>;
  onTogglePaid?: (id: number, currentPaid: boolean) => Promise<void>;
}) {
  const [category, setCategory] = useState<CategoryInput>({
    name: "",
    icon: "Wallet",
    color: "#B7F34B",
    type: "expense",
  });
  const [showCreateIconPicker, setShowCreateIconPicker] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryDTO | null>(null);
  const [editCategoryForm, setEditCategoryForm] = useState<CategoryInput>({
    name: "",
    icon: "Wallet",
    color: "#B7F34B",
    type: "expense",
  });
  const [budgetCategory, setBudgetCategory] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [goalName, setGoalName] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Telegram Assistant State
  const [tgInfo, setTgInfo] = useState<{
    loading: boolean;
    connected: boolean;
    chatId?: string | null;
    username?: string | null;
    pairCode?: string | null;
    pairExpires?: string | null;
    deepLink?: string | null;
    botUsername?: string | null;
    notifyDueBills: boolean;
    notifyBudgetLimit: boolean;
    botConfigured: boolean;
  }>({
    loading: true,
    connected: Boolean(user?.telegramChatId),
    chatId: user?.telegramChatId,
    username: user?.telegramUsername,
    notifyDueBills: user?.telegramNotifyDueBills ?? true,
    notifyBudgetLimit: user?.telegramNotifyBudgetLimit ?? true,
    botConfigured: true,
  });

  const loadTelegramStatus = async () => {
    try {
      const res = await fetch("/api/telegram/connect");
      if (res.ok) {
        const json = await res.json();
        setTgInfo((cur) => ({
          ...cur,
          loading: false,
          connected: json.connected,
          chatId: json.chatId,
          username: json.username,
          pairCode: json.pairCode,
          pairExpires: json.pairExpires,
          notifyDueBills: json.notifyDueBills ?? true,
          notifyBudgetLimit: json.notifyBudgetLimit ?? true,
          botUsername: json.botUsername,
          botConfigured: json.botConfigured,
        }));
      }
    } catch {
      setTgInfo((cur) => ({ ...cur, loading: false }));
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/telegram/connect")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!active || !json) return;
        setTgInfo((cur) => ({
          ...cur,
          loading: false,
          connected: json.connected,
          chatId: json.chatId,
          username: json.username,
          pairCode: json.pairCode,
          pairExpires: json.pairExpires,
          notifyDueBills: json.notifyDueBills ?? true,
          notifyBudgetLimit: json.notifyBudgetLimit ?? true,
          botUsername: json.botUsername,
          botConfigured: json.botConfigured,
        }));
      })
      .catch(() => {
        if (active) setTgInfo((cur) => ({ ...cur, loading: false }));
      });
    return () => {
      active = false;
    };
  }, []);

  const generateTgCode = async () => {
    setBusy("tg-code");
    try {
      const res = await fetch("/api/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_code" }),
      });
      const data = await res.json();
      if (res.ok) {
        setTgInfo((cur) => ({
          ...cur,
          pairCode: data.pairCode,
          pairExpires: data.pairExpires,
          deepLink: data.deepLink,
          botUsername: data.botUsername,
        }));
      } else {
        setMessage(data.error || "Erro ao gerar código.");
      }
    } catch (e: any) {
      setMessage(e?.message || "Falha na conexão.");
    } finally {
      setBusy(null);
    }
  };

  const disconnectTelegram = async () => {
    if (!confirm("Deseja realmente desvincular o Telegram da sua conta Aurum?")) return;
    setBusy("tg-disconnect");
    try {
      const res = await fetch("/api/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      if (res.ok) {
        setTgInfo((cur) => ({
          ...cur,
          connected: false,
          chatId: null,
          username: null,
          pairCode: null,
        }));
        setMessage("Telegram desvinculado com sucesso.");
      }
    } finally {
      setBusy(null);
    }
  };

  const updateTgSettings = async (field: "due" | "budget", val: boolean) => {
    const notifyDueBills = field === "due" ? val : tgInfo.notifyDueBills;
    const notifyBudgetLimit = field === "budget" ? val : tgInfo.notifyBudgetLimit;

    setTgInfo((cur) => ({ ...cur, notifyDueBills, notifyBudgetLimit }));
    try {
      await fetch("/api/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_settings",
          notifyDueBills,
          notifyBudgetLimit,
        }),
      });
    } catch {
      // rollback if failed
      setTgInfo((cur) => ({ ...cur }));
    }
  };

  const sendTestMessage = async () => {
    setBusy("tg-test");
    setMessage(null);
    try {
      const res = await fetch("/api/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_message" }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("✨ Notificação de teste enviada para o seu Telegram!");
      } else {
        setMessage(data.error || "Erro ao enviar teste.");
      }
    } catch (e: any) {
      setMessage(e?.message || "Falha ao enviar mensagem de teste.");
    } finally {
      setBusy(null);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const budgeted = useMemo(() => new Set(data.budgets.map((budget) => budget.categoryId)), [data]);
  const availableBudgetCategories = data.categories.filter(
    (item) => item.type === "expense" && !budgeted.has(item.id),
  );
  const categoryById = useMemo(() => new Map(data.categories.map((item) => [item.id, item])), [data]);

  // Unique list of active recurring expenses
  const recurringItems = useMemo(() => {
    const map = new Map<string, (typeof data.transactions)[0]>();
    for (const t of data.transactions) {
      if (t.isRecurring) {
        const key = `${t.type}:${t.categoryId}:${t.description.trim().toLowerCase()}`;
        if (!map.has(key)) {
          map.set(key, t);
        }
      }
    }
    return [...map.values()].sort((a, b) => b.amountCents - a.amountCents);
  }, [data]);

  const totalFixedExpenses = useMemo(
    () => recurringItems.filter((t) => t.type === "expense").reduce((s, t) => s + t.amountCents, 0),
    [recurringItems],
  );

  const run = async (key: string, action: () => Promise<void>, success?: () => void) => {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      success?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      {message && <p className="card border-accent/30 bg-accent/5 px-5 py-3 text-xs text-accent">{message}</p>}

      {/* Seção do Agente Telegram */}
      <section className="card relative overflow-hidden border-accent/25 card-pad">
        <div className="absolute right-0 top-0 h-40 w-40 translate-x-12 -translate-y-12 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-ink font-bold shadow-md shadow-accent/20">
              <Bot size={22} strokeWidth={2.4} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-semibold text-cream">Assistente do Telegram</h2>
                {tgInfo.connected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                    <CheckCircle2 size={12} /> Conectado
                  </span>
                ) : (
                  <span className="rounded-full bg-cream/10 px-2 py-0.5 text-[11px] font-medium text-faint">
                    Desconectado
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-faint">
                Lance despesas e receitas por texto, áudio ou fotos de comprovantes e receba lembretes de vencimentos.
              </p>
            </div>
          </div>

          <button
            onClick={() => void loadTelegramStatus()}
            className="grid h-9 w-9 place-items-center rounded-lg border border-line text-faint hover:text-cream transition-colors"
            title="Atualizar status"
          >
            <RefreshCw size={14} className={tgInfo.loading ? "animate-spin" : ""} />
          </button>
        </div>

        {tgInfo.connected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-accent/[0.04] p-4">
              <div>
                <p className="text-xs text-faint">Conta vinculada:</p>
                <p className="font-display text-sm font-semibold text-cream">
                  {tgInfo.username ? `@${tgInfo.username}` : `Chat ID: ${tgInfo.chatId}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full xs:w-auto">
                <button
                  disabled={busy === "tg-test"}
                  onClick={() => void sendTestMessage()}
                  className="flex-1 xs:flex-none flex items-center justify-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors disabled:opacity-50 min-h-[40px]"
                >
                  {busy === "tg-test" ? <LoaderCircle size={13} className="animate-spin" /> : <Send size={13} />}
                  Enviar Teste
                </button>
                <button
                  disabled={busy === "tg-disconnect"}
                  onClick={() => void disconnectTelegram()}
                  className="flex-1 xs:flex-none rounded-xl border border-coral/20 px-3 py-2 text-xs font-semibold text-coral hover:bg-coral/10 transition-colors disabled:opacity-50 min-h-[40px]"
                >
                  Desconectar
                </button>
              </div>
            </div>

            {/* Preferências de Notificação */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 pt-1">
              <label className="flex items-center justify-between rounded-xl border border-line bg-cream/[0.02] p-3.5 cursor-pointer hover:border-line/80 transition-colors min-h-[52px]">
                <div className="flex items-center gap-2.5">
                  <Bell size={16} className="text-accent" />
                  <div>
                    <p className="text-xs font-medium text-cream">Lembretes de Vencimento</p>
                    <p className="text-[10px] text-faint">Avisa diariamente sobre contas a pagar</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={tgInfo.notifyDueBills}
                  onChange={(e) => void updateTgSettings("due", e.target.checked)}
                  className="h-5 w-5 rounded accent-accent cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-line bg-cream/[0.02] p-3.5 cursor-pointer hover:border-line/80 transition-colors min-h-[52px]">
                <div className="flex items-center gap-2.5">
                  <Zap size={16} className="text-coral" />
                  <div>
                    <p className="text-xs font-medium text-cream">Alertas de Orçamento</p>
                    <p className="text-[10px] text-faint">Avisa ao atingir 80% e 100% do limite</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={tgInfo.notifyBudgetLimit}
                  onChange={(e) => void updateTgSettings("budget", e.target.checked)}
                  className="h-5 w-5 rounded accent-accent cursor-pointer"
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-line bg-cream/[0.02] p-4 sm:p-5">
              {tgInfo.pairCode ? (
                <div className="space-y-3">
                  <p className="text-xs text-faint">
                    Envie o comando abaixo no Telegram para o bot ou clique no link direto:
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex w-full xs:w-auto items-center justify-between gap-2 rounded-xl bg-ink/70 border border-line px-3.5 py-2 font-mono text-sm sm:text-base font-bold text-accent break-all">
                      <span>/conectar {tgInfo.pairCode}</span>
                      <button
                        onClick={() => copyCode(`/conectar ${tgInfo.pairCode}`)}
                        className="text-faint hover:text-cream ml-1 p-1"
                        title="Copiar comando"
                      >
                        {copied ? <CheckCircle2 size={16} className="text-accent" /> : <Copy size={16} />}
                      </button>
                    </div>

                    {tgInfo.deepLink && (
                      <a
                        href={tgInfo.deepLink}
                        target="_blank"
                        rel="noreferrer"
                        className="flex w-full xs:w-auto items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-ink shadow hover:opacity-90 transition-opacity min-h-[44px]"
                      >
                        <ExternalLink size={14} /> Abrir no Telegram
                      </a>
                    )}
                  </div>

                  <p className="text-[11px] text-faint">
                    ⏳ Este código expira em 15 minutos. Após enviar, seu Telegram estará conectado.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-cream">Conecte seu Telegram em segundos</p>
                    <p className="text-xs text-faint mt-0.5">
                      Gere um código de pareamento exclusivo para autenticar seu chat.
                    </p>
                  </div>
                  <button
                    disabled={busy === "tg-code"}
                    onClick={() => void generateTgCode()}
                    className="flex w-full xs:w-auto items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-ink shadow hover:opacity-95 transition-opacity disabled:opacity-50 min-h-[44px]"
                  >
                    {busy === "tg-code" ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Gerar Código de Conexão
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recursos e Dicas de Uso */}
        <div className="mt-4 grid gap-2.5 grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 pt-2 border-t border-line/60">
          <div className="rounded-xl border border-line/60 bg-cream/[0.015] p-3 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-cream mb-1">
              <Send size={13} className="text-accent" /> Mensagens em Texto
            </div>
            <p className="text-[11px] text-faint">
              &quot;Almoço 45 alimentação&quot;, &quot;Salário 4500&quot;, &quot;Internet 120 recorrente dia 10&quot;, &quot;Notebook 3000 10x&quot;.
            </p>
          </div>

          <div className="rounded-xl border border-line/60 bg-cream/[0.015] p-3 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-cream mb-1">
              <Mic size={13} className="text-accent" /> Áudio & Voz
            </div>
            <p className="text-[11px] text-faint">
              Grave uma mensagem de voz dizendo o que gastou e o agente transcreve e cadastra automaticamente.
            </p>
          </div>

          <div className="col-span-full xs:col-span-2 lg:col-span-1 rounded-xl border border-line/60 bg-cream/[0.015] p-3 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-cream mb-1">
              <Camera size={13} className="text-accent" /> Fotos & Comprovantes
            </div>
            <p className="text-[11px] text-faint">
              Tire foto de notas fiscais, cupons ou comprovantes PIX para extração inteligente de valores.
            </p>
          </div>
        </div>
      </section>

      {/* Gastos Fixos Recorrentes Ativos */}
      <section className="card card-pad border-accent/20">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-accent shrink-0">
                <Repeat2 size={16} strokeWidth={2.4} />
              </span>
              <h2 className="font-display text-base font-semibold text-cream truncate">Gastos & Receitas Fixas Recorrentes</h2>
            </div>
            <p className="mt-1 text-xs text-faint">
              Lançamentos cadastrados como fixos ficam disponíveis como modelo e podem ser importados para o mês com 1 clique sempre que você solicitar.
            </p>
          </div>
          <div className="w-full sm:w-auto text-left sm:text-right">
            <p className="text-[11px] text-faint">Total de Despesas Fixas / Mês</p>
            <p className="font-display text-[16px] font-bold text-coral tabular-nums">{fmt(totalFixedExpenses)}</p>
          </div>
        </div>

        {recurringItems.length === 0 ? (
          <p className="py-6 text-center text-xs text-faint">Nenhum gasto fixo cadastrado ainda.</p>
        ) : (
          <div className="grid gap-2.5 grid-cols-1 xs:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4">
            {recurringItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-line bg-cream/[0.015] p-3.5">
                <CategoryIcon icon={item.category.icon} color={item.category.color} chip={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-cream">{item.description}</p>
                  <p className="text-[11px] text-faint">
                    {item.category.name} · Dia {item.date.split("-")[2]}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`font-display text-xs font-semibold tabular-nums ${item.type === "income" ? "text-accent" : "text-cream"}`}>
                    {fmt(item.amountCents)}
                  </span>
                  <span className="block text-[9.5px] text-accent">mensal</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Categorias */}
      <section className="card card-pad">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold">Categorias</h2>
            <p className="mt-1 text-xs text-faint">Organize receitas e despesas com suas próprias categorias personalizadas.</p>
          </div>
          <span className="text-xs text-faint">{data.categories.length} cadastradas</span>
        </div>

        {/* Formulário de Criação Rápida */}
        <div className="space-y-3">
          <div className="grid gap-2 grid-cols-1 xs:grid-cols-2 lg:grid-cols-[1fr_130px_48px_48px_auto]">
            <input
              className="field"
              placeholder="Nome da categoria..."
              value={category.name}
              onChange={(event) => setCategory((value) => ({ ...value, name: event.target.value }))}
            />
            <select
              className="field"
              value={category.type}
              onChange={(event) => setCategory((value) => ({ ...value, type: event.target.value as TxnType }))}
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
            <button
              type="button"
              onClick={() => setShowCreateIconPicker((v) => !v)}
              title="Escolher Ícone"
              className={`grid h-11 w-full place-items-center rounded-xl border transition-colors min-h-[44px] ${
                showCreateIconPicker
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-line bg-cream/[0.02] text-mute hover:border-line-strong hover:text-cream"
              }`}
            >
              <BareIcon icon={category.icon} size={18} />
            </button>
            <input
              aria-label="Cor"
              type="color"
              className="field h-11 w-full !p-1.5 cursor-pointer"
              value={category.color}
              onChange={(event) => setCategory((value) => ({ ...value, color: event.target.value }))}
            />
            <button
              disabled={busy !== null || category.name.trim().length < 2}
              onClick={() =>
                void run("category-new", () => onCreateCategory(category), () => {
                  setCategory((value) => ({ ...value, name: "" }));
                  setShowCreateIconPicker(false);
                })
              }
              className="xs:col-span-2 lg:col-span-1 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-30 min-h-[44px]"
            >
              {busy === "category-new" ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />}
              Adicionar
            </button>
          </div>

          {/* Grade seletora de ícones para criação */}
          {showCreateIconPicker && (
            <div className="rounded-2xl border border-line bg-panel p-3 shadow-xl">
              <p className="eyebrow mb-2">Selecione o ícone da categoria</p>
              <div className="grid max-h-[140px] grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2 overflow-y-auto p-1">
                {AVAILABLE_ICONS.map((iconName) => {
                  const isSelected = category.icon === iconName;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => {
                        setCategory((cur) => ({ ...cur, icon: iconName }));
                        setShowCreateIconPicker(false);
                      }}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
                        isSelected
                          ? "bg-accent/20 text-accent border border-accent/40 shadow-sm"
                          : "text-mute hover:bg-cream/6 hover:text-cream"
                      }`}
                      title={iconName}
                    >
                      <BareIcon icon={iconName} size={18} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Lista de Categorias com botões de Editar e Excluir */}
        <div className="mt-5 grid gap-2 grid-cols-1 xs:grid-cols-2 xl:grid-cols-3">
          {data.categories.map((item) => (
            <div key={item.id} className="group flex items-center gap-3 rounded-2xl border border-line p-3 hover:border-line-strong transition-colors">
              <CategoryIcon icon={item.icon} color={item.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-cream">{item.name}</p>
                <p className="text-[11px] text-faint">{item.type === "income" ? "Receita" : "Despesa"}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  aria-label={`Editar ${item.name}`}
                  onClick={() => {
                    setEditingCategory(item);
                    setEditCategoryForm({
                      name: item.name,
                      icon: item.icon,
                      color: item.color,
                      type: item.type,
                    });
                  }}
                  className="grid h-9 w-9 place-items-center rounded-lg text-faint hover:bg-cream/10 hover:text-cream transition-colors"
                  title="Editar Categoria"
                >
                  <Pencil size={14} />
                </button>
                <button
                  aria-label={`Excluir ${item.name}`}
                  disabled={busy !== null}
                  onClick={() => void run(`category-${item.id}`, () => onDeleteCategory(item.id))}
                  className="grid h-9 w-9 place-items-center rounded-lg text-faint hover:bg-coral/10 hover:text-coral transition-colors"
                  title="Excluir Categoria"
                >
                  {busy === `category-${item.id}` ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Orçamentos */}
        <section className="card card-pad">
          <h2 className="font-display text-base font-semibold">Orçamentos</h2>
          <p className="mt-1 text-xs text-faint">Crie limites para categorias ainda sem orçamento.</p>
          <div className="mt-5 grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_150px_auto]">
            <select className="field" value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value)}>
              <option value="">Categoria</option>
              {availableBudgetCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input className="field" inputMode="decimal" placeholder="Limite em R$" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} />
            <button
              disabled={busy !== null || !budgetCategory || !parseAmount(budgetAmount)}
              onClick={() => void run("budget-new", () => onCreateBudget(Number(budgetCategory), parseAmount(budgetAmount)!), () => {
                setBudgetCategory("");
                setBudgetAmount("");
              })}
              className="sm:col-span-2 lg:col-span-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-30 min-h-[44px]"
            >
              Criar
            </button>
          </div>
          <div className="mt-5 space-y-2">
            {data.budgets.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
                <span className="min-w-0 truncate text-sm">{categoryById.get(item.categoryId)?.name ?? "Categoria"}</span>
                <span className="ml-auto mr-2 font-display text-sm text-mute shrink-0">{fmt(item.amountCents)}</span>
                <button aria-label="Excluir orçamento" onClick={() => void run(`budget-${item.id}`, () => onDeleteBudget(item.id))} className="grid h-8 w-8 place-items-center rounded-lg text-faint hover:text-coral transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Metas */}
        <section className="card card-pad">
          <h2 className="font-display text-base font-semibold">Metas</h2>
          <p className="mt-1 text-xs text-faint">Crie e encerre objetivos financeiros.</p>
          <div className="mt-5 grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_150px_auto]">
            <input className="field" placeholder="Nome da meta" value={goalName} onChange={(e) => setGoalName(e.target.value)} />
            <input className="field" inputMode="decimal" placeholder="Objetivo em R$" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} />
            <button
              disabled={busy !== null || goalName.trim().length < 2 || !parseAmount(goalAmount)}
              onClick={() => void run("goal-new", () => onCreateGoal({
                name: goalName.trim(),
                targetCents: parseAmount(goalAmount)!,
                color: "#B7F34B",
                icon: "Target",
              }), () => {
                setGoalName("");
                setGoalAmount("");
              })}
              className="sm:col-span-2 lg:col-span-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-30 min-h-[44px]"
            >
              Criar
            </button>
          </div>
          <div className="mt-5 space-y-2">
            {data.goals.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
                <span className="min-w-0 truncate text-sm">{item.name}</span>
                <span className="ml-auto mr-2 font-display text-sm text-mute shrink-0">{fmt(item.currentCents)} / {fmt(item.targetCents)}</span>
                <button aria-label="Excluir meta" onClick={() => void run(`goal-${item.id}`, () => onDeleteGoal(item.id))} className="grid h-8 w-8 place-items-center rounded-lg text-faint hover:text-coral transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Modal de Edição de Categoria */}
      <AnimatePresence>
        {editingCategory && (
          <motion.div
            className="fixed inset-0 z-[95] flex items-end justify-center p-0 sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.button
              aria-label="Fechar"
              className="absolute inset-0 bg-ink/88 sm:bg-ink/75 sm:backdrop-blur-md"
              onClick={() => setEditingCategory(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              role="dialog"
              aria-modal
              className="relative max-h-[92dvh] sm:max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[26px] sm:rounded-[26px] border border-line-strong bg-panel p-5 sm:p-7 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] overscroll-contain pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-7"
              initial={{ opacity: 0, y: 32, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
            >
              {/* Header com Preview */}
              <div className="flex items-center justify-between gap-3 border-b border-line pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <CategoryIcon icon={editCategoryForm.icon} color={editCategoryForm.color} chip={46} size={22} />
                  <div className="min-w-0">
                    <p className="eyebrow mb-0.5">editar categoria</p>
                    <h2 className="font-serif text-[22px] leading-tight text-cream truncate">
                      {editCategoryForm.name || "Sem nome"}
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => setEditingCategory(null)}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-line text-mute transition-colors hover:border-line-strong hover:text-cream"
                  aria-label="Fechar"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Nome */}
                <div>
                  <label className="eyebrow mb-1.5 block">Nome da categoria</label>
                  <input
                    className="field"
                    placeholder="Ex.: Alimentação, Saúde, etc."
                    value={editCategoryForm.name}
                    onChange={(e) => setEditCategoryForm((cur) => ({ ...cur, name: e.target.value }))}
                  />
                </div>

                {/* Tipo */}
                <div>
                  <label className="eyebrow mb-1.5 block">Tipo de movimentação</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditCategoryForm((cur) => ({ ...cur, type: "expense" }))}
                      className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition-colors min-h-[44px] ${
                        editCategoryForm.type === "expense"
                          ? "border-coral/60 bg-coral/15 text-coral shadow-sm"
                          : "border-line bg-cream/[0.02] text-mute hover:border-line-strong hover:text-cream"
                      }`}
                    >
                      Despesa
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditCategoryForm((cur) => ({ ...cur, type: "income" }))}
                      className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition-colors min-h-[44px] ${
                        editCategoryForm.type === "income"
                          ? "border-accent/60 bg-accent/15 text-accent shadow-sm"
                          : "border-line bg-cream/[0.02] text-mute hover:border-line-strong hover:text-cream"
                      }`}
                    >
                      Receita
                    </button>
                  </div>
                </div>

                {/* Cor */}
                <div>
                  <label className="eyebrow mb-1.5 block">Cor da categoria</label>
                  <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl border border-line bg-cream/[0.02]">
                    {PRESET_COLORS.map((c) => {
                      const isSelected = editCategoryForm.color.toLowerCase() === c.toLowerCase();
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditCategoryForm((cur) => ({ ...cur, color: c }))}
                          className={`grid h-7 w-7 place-items-center rounded-full transition-transform hover:scale-110 ${
                            isSelected
                              ? "ring-2 ring-cream ring-offset-2 ring-offset-panel scale-110"
                              : ""
                          }`}
                          style={{ background: c }}
                        >
                          {isSelected && <Check size={13} className="text-ink font-bold" strokeWidth={3} />}
                        </button>
                      );
                    })}
                    <label className="flex items-center gap-1.5 text-[11px] text-faint ml-auto cursor-pointer">
                      <span>Personalizada</span>
                      <input
                        aria-label="Cor customizada"
                        type="color"
                        className="h-7 w-7 rounded-full !p-0 border-0 cursor-pointer overflow-hidden bg-transparent"
                        value={editCategoryForm.color}
                        onChange={(e) => setEditCategoryForm((cur) => ({ ...cur, color: e.target.value }))}
                      />
                    </label>
                  </div>
                </div>

                {/* Ícone */}
                <div>
                  <label className="eyebrow mb-1.5 block">Ícone da categoria</label>
                  <div className="grid max-h-[160px] grid-cols-6 gap-2 overflow-y-auto p-2 rounded-2xl border border-line bg-cream/[0.02]">
                    {AVAILABLE_ICONS.map((iconName) => {
                      const isSelected = editCategoryForm.icon === iconName;
                      return (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => setEditCategoryForm((cur) => ({ ...cur, icon: iconName }))}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
                            isSelected
                              ? "bg-accent/20 text-accent border border-accent/40 shadow-sm"
                              : "text-mute hover:bg-cream/6 hover:text-cream"
                          }`}
                          title={iconName}
                        >
                          <BareIcon icon={iconName} size={18} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="rounded-xl border border-line px-4 py-2.5 text-xs font-semibold text-mute hover:border-line-strong hover:text-cream transition-colors min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy !== null || editCategoryForm.name.trim().length < 2}
                  onClick={() => {
                    if (!onUpdateCategory) return;
                    void run(`category-edit-${editingCategory.id}`, async () => {
                      await onUpdateCategory(editingCategory.id, {
                        name: editCategoryForm.name.trim(),
                        icon: editCategoryForm.icon,
                        color: editCategoryForm.color,
                        type: editCategoryForm.type,
                      });
                      setEditingCategory(null);
                    });
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-ink hover:opacity-95 transition-opacity disabled:opacity-30 min-h-[44px]"
                >
                  {busy === `category-edit-${editingCategory.id}` ? (
                    <LoaderCircle size={15} className="animate-spin" />
                  ) : (
                    <Check size={15} strokeWidth={2.6} />
                  )}
                  Salvar Alterações
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
