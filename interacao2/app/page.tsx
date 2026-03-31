"use client";

import { useState, useEffect, useRef } from "react";
import {
  supabase,
  getProcesses,
  createProcess,
  updateProcess,
  deleteProcess,
  getActivity,
  addActivity,
  autoDeleteLiberated,
  subscribeToProcesses,
  subscribeToActivity,
} from "@/lib/supabase";
import type { ContainerProcess, ActivityLog, Stage } from "@/lib/supabase";

/* ═══ CONFIG ═══ */
const AUTO_DELETE_MS = 2 * 60 * 60 * 1000;
const today = () => new Date().toISOString().slice(0, 10);
const isToday = (d: string | null) => d === today();

const STAGES: { key: Stage; label: string; icon: string; color: string; bg: string }[] = [
  { key: "sem_container", label: "Sem Container", icon: "📭", color: "#e85d04", bg: "#fff7ed" },
  { key: "contato_terminal", label: "Contato Terminal", icon: "📞", color: "#7209b7", bg: "#faf5ff" },
  { key: "aguardando", label: "Aguard. Estratégia", icon: "⏳", color: "#f72585", bg: "#fff0f6" },
  { key: "liberado", label: "Liberado", icon: "✅", color: "#06d6a0", bg: "#ecfdf5" },
  { key: "concluido", label: "Concluído", icon: "📦", color: "#118ab2", bg: "#eff6ff" },
];

const CTYPES = ["20' Dry","40' Dry","40' HC","20' Reefer","40' Reefer","20' OT","40' OT","20' FR","40' FR"];

interface AppUser { email: string; name: string; role: "admin" | "user"; }

const fd = (d: string | null) => {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
};
const ff = (d: string | null) => {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
};
const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora"; if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

/* ═══ SVG ICONS ═══ */
const IX = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IPlus = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const ISearch = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const ITrash = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>;
const IEdit = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IDown = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const ILog = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
const IOut = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IAlert = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const IClk = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IChev = ({ d = "down" }: { d?: string }) => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: d === "up" ? "rotate(180deg)" : "none", transition: "0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>;
const IMenu = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const IShield = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const ITimer = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3L2 6"/><path d="M22 6l-3-3"/><line x1="12" y1="1" x2="12" y2="3"/></svg>;

/* ═══ REUSABLE COMPONENTS ═══ */
const ip: React.CSSProperties = { width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid #e4e4ec", borderRadius: 9, background: "#fafafc", color: "#1a1a2e", outline: "none", fontFamily: "'Nunito',sans-serif", boxSizing: "border-box" };
const sl: React.CSSProperties = { ...ip, cursor: "pointer" };

function Modal({ open, onClose, title, children, w = 520 }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; w?: number }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.22)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, border: "1px solid #e8e8ec", width: "100%", maxWidth: w, maxHeight: "92vh", overflow: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.1)", animation: "mIn .22s cubic-bezier(.16,1,.3,1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #f0f0f3" }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1a1a2e", fontFamily: "var(--fm)" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", padding: 4, borderRadius: 8, display: "flex" }}><IX /></button>
        </div>
        <div style={{ padding: "16px 20px" }}>{children}</div>
      </div>
    </div>
  );
}

function Fl({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div style={{ gridColumn: span ? "1/-1" : undefined }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#8890a4", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".07em" }}>{label}</label>
      {children}
    </div>
  );
}

/* ═══ LOGIN SCREEN ═══ */
function LoginScreen({ onLogin }: { onLogin: (u: AppUser) => void }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => { setTimeout(() => setShow(true), 80); }, []);

  const go = async () => {
    setLoading(true); setErr("");
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email.trim().toLowerCase())
        .eq("password_hash", pass)
        .single();
      if (error || !data) { setErr("E-mail ou senha incorretos"); }
      else { onLogin({ email: data.email, name: data.name, role: data.role }); }
    } catch { setErr("Erro de conexão"); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(155deg,#f2f4f8 0%,#eaecf5 40%,#f5f1f8 100%)" }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 22, padding: "40px 36px", boxShadow: "0 16px 50px rgba(0,0,0,0.07)", border: "1px solid #eee", opacity: show ? 1 : 0, transform: show ? "none" : "translateY(16px)", transition: "all .45s cubic-bezier(.16,1,.3,1)", margin: 16 }}>
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-.04em", color: "#1a1a2e", fontFamily: "var(--fm)" }}>Inter<span style={{ color: "#6366f1" }}>ação</span></div>
          <p style={{ fontSize: 12, color: "#aaa", marginTop: 5 }}>Controle de Liberação de Contêineres</p>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#8890a4", marginBottom: 4, textTransform: "uppercase" }}>E-mail</label>
          <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} placeholder="seu@email.com" style={{ ...ip, padding: "11px 14px" }} />
        </div>
        <div style={{ marginBottom: 6 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#8890a4", marginBottom: 4, textTransform: "uppercase" }}>Senha</label>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} placeholder="••••••••" style={{ ...ip, padding: "11px 14px" }} />
        </div>
        {err && <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 9, background: "#fef2f2", color: "#dc2626", fontSize: 11.5, fontWeight: 600, marginTop: 10 }}><IAlert />{err}</div>}
        <button onClick={go} disabled={loading} style={{ width: "100%", padding: "12px", borderRadius: 11, border: "none", marginTop: 16, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1, boxShadow: "0 4px 18px rgba(99,102,241,0.28)" }}>{loading ? "Entrando..." : "Entrar"}</button>
        <p style={{ textAlign: "center", fontSize: 10, color: "#ccc", marginTop: 18 }}>Inter Shipping © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}

/* ═══ PROCESS ROW ═══ */
function ProcessRow({ card, stgData, onEdit, onDelete, onChangeStage, urgent, autoMin }: {
  card: ContainerProcess; stgData: typeof STAGES[0]; onEdit: (c: ContainerProcess) => void;
  onDelete: (id: string) => void; onChangeStage: (id: string, s: Stage) => void;
  urgent: boolean; autoMin: number | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ background: urgent ? "#fffbeb" : "#fff", border: urgent ? "2px solid #fbbf24" : "1px solid #ececf2", borderRadius: 14, marginBottom: 8, overflow: "hidden", borderLeft: urgent ? "4px solid #f59e0b" : `4px solid ${stgData.color}`, transition: "box-shadow .2s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.05)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}>

      <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", cursor: "pointer", flexWrap: "wrap", position: "relative" }}>
        {urgent && <span style={{ position: "absolute", top: 4, right: 10, background: "linear-gradient(135deg,#f59e0b,#ef4444)", color: "#fff", fontSize: 8, fontWeight: 800, padding: "1px 6px", borderRadius: 4, animation: "pulse 2s infinite" }}>🔥 HOJE</span>}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: stgData.bg, color: stgData.color, border: `1px solid ${stgData.color}20`, whiteSpace: "nowrap", flexShrink: 0 }}>{stgData.icon} {stgData.label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e", flexShrink: 0 }}>{card.exportador}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: stgData.color, fontFamily: "var(--fm)", flexShrink: 0 }}>{card.reserva}</span>
        <span style={{ fontSize: 10, color: "#999", fontWeight: 600, flexShrink: 0 }}>{card.quantidade}× {card.tipo_container}</span>
        {card.transportadora && <span style={{ fontSize: 10, color: "#aaa", flexShrink: 0 }}>🚛 {card.transportadora}</span>}
        {card.data_retirada && <span style={{ fontSize: 9.5, color: urgent ? "#d97706" : "#bbb", fontFamily: "var(--fm)", display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}><IClk />Ret:{fd(card.data_retirada)}</span>}
        {card.data_carregamento && <span style={{ fontSize: 9.5, color: "#bbb", fontFamily: "var(--fm)", display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>📅Car:{fd(card.data_carregamento)}</span>}
        {card.stage === "liberado" && autoMin !== null && (
          <span style={{ fontSize: 9, color: "#06d6a0", fontFamily: "var(--fm)", display: "flex", alignItems: "center", gap: 2, background: "#ecfdf5", padding: "2px 6px", borderRadius: 5, fontWeight: 700, flexShrink: 0 }}>
            <ITimer />{autoMin > 60 ? `${Math.floor(autoMin / 60)}h${autoMin % 60}m` : `${autoMin}min`}
          </span>
        )}
        {card.referencia && <span style={{ fontSize: 9.5, color: "#ccc", fontFamily: "var(--fm)", flexShrink: 0 }}>REF:{card.referencia}</span>}
        <div style={{ marginLeft: "auto", flexShrink: 0 }}><IChev d={open ? "up" : "down"} /></div>
      </div>

      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: "1px solid #f5f5f8", animation: "fUp .18s ease" }}>
          {card.comentarios && <div style={{ margin: "10px 0", padding: "7px 11px", borderRadius: 8, background: "#f8f8fc", fontSize: 12, color: "#666", lineHeight: 1.5, borderLeft: "3px solid #e8e8f0" }}>{card.comentarios}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "8px 14px", padding: "8px 0 12px" }}>
            <div><div style={{ fontSize: 9, color: "#bbb", fontWeight: 700, textTransform: "uppercase" }}>Transportadora</div><div style={{ fontSize: 12, color: "#444", fontWeight: 600 }}>{card.transportadora || "—"}</div></div>
            <div><div style={{ fontSize: 9, color: "#bbb", fontWeight: 700, textTransform: "uppercase" }}>Data Retirada</div><div style={{ fontSize: 12, color: "#444", fontWeight: 600 }}>{ff(card.data_retirada)}</div></div>
            <div><div style={{ fontSize: 9, color: "#bbb", fontWeight: 700, textTransform: "uppercase" }}>Data Carregamento</div><div style={{ fontSize: 12, color: "#444", fontWeight: 600 }}>{ff(card.data_carregamento)}</div></div>
            <div><div style={{ fontSize: 9, color: "#bbb", fontWeight: 700, textTransform: "uppercase" }}>Referência</div><div style={{ fontSize: 12, color: "#444", fontWeight: 600 }}>{card.referencia || "—"}</div></div>
            <div><div style={{ fontSize: 9, color: "#bbb", fontWeight: 700, textTransform: "uppercase" }}>Criado por</div><div style={{ fontSize: 12, color: "#444", fontWeight: 600 }}>{card.created_by || "—"}</div></div>
            <div><div style={{ fontSize: 9, color: "#bbb", fontWeight: 700, textTransform: "uppercase" }}>Criado</div><div style={{ fontSize: 12, color: "#444", fontWeight: 600 }}>{card.created_at ? ago(card.created_at) + " atrás" : "—"}</div></div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: "#bbb", fontWeight: 700, textTransform: "uppercase", marginBottom: 5 }}>Mover para:</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {STAGES.map(s => (
                <button key={s.key} onClick={() => onChangeStage(card.id, s.key)} style={{ padding: "4px 9px", borderRadius: 7, fontSize: 10, fontWeight: 700, border: card.stage === s.key ? `2px solid ${s.color}` : "1px solid #e4e4ec", background: card.stage === s.key ? s.bg : "transparent", color: card.stage === s.key ? s.color : "#ccc", cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}>{s.icon}{s.label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
            <button onClick={() => onEdit(card)} style={{ display: "flex", alignItems: "center", gap: 3, padding: "6px 12px", borderRadius: 8, background: "#f0eeff", border: "1px solid #e0dbff", color: "#6366f1", fontSize: 11, fontWeight: 700, cursor: "pointer" }}><IEdit />Editar</button>
            <button onClick={() => onDelete(card.id)} style={{ display: "flex", alignItems: "center", gap: 3, padding: "6px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer" }}><ITrash />Excluir</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/* MAIN PAGE                                                  */
/* ═══════════════════════════════════════════════════════════ */
export default function Page() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [cards, setCards] = useState<ContainerProcess[]>([]);
  const [activityList, setActivityList] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    stage: "sem_container" as Stage, exportador: "", reserva: "", data_retirada: "",
    data_carregamento: "", quantidade: 1, tipo_container: "40' HC",
    transportadora: "", referencia: "", comentarios: "",
  });
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("todos");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [, setTick] = useState(0);

  /* ─ Load data + realtime ─ */
  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const load = async () => {
      try {
        const [procs, acts] = await Promise.all([getProcesses(), getActivity()]);
        if (mounted) { setCards(procs); setActivityList(acts); }
      } catch (err) { console.error(err); }
      if (mounted) setLoading(false);
    };
    load();

    const procSub = subscribeToProcesses(() => { getProcesses().then(d => mounted && setCards(d)).catch(console.error); });
    const actSub = subscribeToActivity(() => { getActivity().then(d => mounted && setActivityList(d)).catch(console.error); });

    const iv = setInterval(() => {
      setTick(t => t + 1);
      autoDeleteLiberated().catch(console.error);
    }, 30000);

    return () => { mounted = false; procSub.unsubscribe(); actSub.unsubscribe(); clearInterval(iv); };
  }, [user]);

  /* ─ Form handlers ─ */
  const openNew = () => {
    setForm({ stage: "sem_container", exportador: "", reserva: "", data_retirada: "", data_carregamento: "", quantidade: 1, tipo_container: "40' HC", transportadora: "", referencia: "", comentarios: "" });
    setEditId(null); setShowForm(true); setMobileMenu(false);
  };
  const openEdit = (c: ContainerProcess) => {
    setForm({ stage: c.stage, exportador: c.exportador, reserva: c.reserva, data_retirada: c.data_retirada || "", data_carregamento: c.data_carregamento || "", quantidade: c.quantidade, tipo_container: c.tipo_container, transportadora: c.transportadora || "", referencia: c.referencia || "", comentarios: c.comentarios || "" });
    setEditId(c.id); setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); };

  const saveCard = async () => {
    if (!form.exportador || !form.reserva || !user) return;
    try {
      if (editId) {
        const old = cards.find(c => c.id === editId);
        await updateProcess(editId, {
          stage: form.stage, exportador: form.exportador, reserva: form.reserva,
          data_retirada: form.data_retirada || null, data_carregamento: form.data_carregamento || null,
          quantidade: form.quantidade, tipo_container: form.tipo_container,
          transportadora: form.transportadora || null, referencia: form.referencia || null,
          comentarios: form.comentarios || null,
          liberated_at: form.stage === "liberado" && old?.stage !== "liberado" ? new Date().toISOString() : old?.liberated_at || null,
        });
        await addActivity(`✏️ Editou ${form.exportador} — ${form.reserva}`, user.name);
      } else {
        await createProcess({
          stage: form.stage, exportador: form.exportador, reserva: form.reserva,
          data_retirada: form.data_retirada || null, data_carregamento: form.data_carregamento || null,
          quantidade: form.quantidade, tipo_container: form.tipo_container,
          transportadora: form.transportadora || null, referencia: form.referencia || null,
          comentarios: form.comentarios || null, created_by: user.name,
          liberated_at: form.stage === "liberado" ? new Date().toISOString() : null,
        });
        await addActivity(`📋 Criou ${form.exportador} — ${form.reserva}`, user.name);
      }
      setCards(await getProcesses());
    } catch (err) { console.error(err); }
    closeForm();
  };

  const changeStage = async (id: string, ns: Stage) => {
    if (!user) return;
    const c = cards.find(x => x.id === id);
    if (!c || c.stage === ns) return;
    try {
      await updateProcess(id, { stage: ns, liberated_at: ns === "liberado" ? new Date().toISOString() : c.liberated_at });
      await addActivity(`➡️ ${c.exportador}: ${STAGES.find(s => s.key === c.stage)?.label} → ${STAGES.find(s => s.key === ns)?.label}`, user.name);
      setCards(await getProcesses());
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    const c = cards.find(x => x.id === id);
    try {
      await deleteProcess(id);
      if (c) await addActivity(`🗑️ Excluiu ${c.exportador} — ${c.reserva}`, user.name);
      setCards(await getProcesses());
    } catch (err) { console.error(err); }
    setDeleteConfirm(null);
  };

  const updateField = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  /* ─ Filter ─ */
  const filtered = cards.filter(c => {
    if (filterStage !== "todos" && c.stage !== filterStage) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return [c.exportador, c.reserva, c.transportadora, c.referencia, c.comentarios].some(v => v?.toLowerCase().includes(q));
  });

  /* ─ CSV ─ */
  const exportCSV = () => {
    const h = ["Etapa","Data Retirada","Data Carregamento","Exportador","Reserva","Qtd","Tipo","Transportadora","REF","Comentários"];
    const r = cards.map(c => [STAGES.find(s => s.key === c.stage)?.label, c.data_retirada, c.data_carregamento, c.exportador, c.reserva, c.quantidade, c.tipo_container, c.transportadora, c.referencia, c.comentarios]);
    const csv = [h, ...r].map(x => x.map(c => `"${c || ""}"`).join(",")).join("\n");
    const b = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `interacao-${today()}.csv`; a.click();
  };

  const totalC = cards.reduce((a, c) => a + (c.quantidade || 0), 0);
  const todayCount = cards.filter(c => isToday(c.data_retirada)).length;
  const isAdmin = user?.role === "admin";

  /* ─ LOGIN ─ */
  if (!user) return <LoginScreen onLogin={setUser} />;

  /* ─ LOADING ─ */
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f5f9" }}>
      <div style={{ textAlign: "center" }}><div style={{ fontSize: 32, marginBottom: 10 }}>📦</div><p style={{ color: "#999", fontWeight: 600 }}>Carregando...</p></div>
    </div>
  );

  /* ═══ RENDER ═══ */
  return (
    <div style={{ minHeight: "100vh", background: "#f4f5f9" }}>

      {/* HEADER */}
      <header style={{ background: "#fff", borderBottom: "1px solid #ececf2", padding: "10px 16px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 13, boxShadow: "0 3px 12px rgba(99,102,241,.22)" }}>📦</div>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-.03em", lineHeight: 1 }}>Inter<span style={{ color: "#6366f1" }}>ação</span></h1>
              <p style={{ fontSize: 9, color: "#aaa", fontWeight: 600 }}>{cards.length} processos · {totalC} cnt{todayCount > 0 && <span style={{ color: "#f59e0b", fontWeight: 800 }}> · 🔥{todayCount} hoje</span>}</p>
            </div>
          </div>

          {/* Desktop nav */}
          <div className="desk" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#ccc" }}><ISearch /></div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ ...ip, width: 150, paddingLeft: 28, fontSize: 11.5, padding: "7px 10px 7px 28px", borderRadius: 9, background: "#f7f7fb" }} />
            </div>
            <button onClick={() => setShowLog(!showLog)} style={{ display: "flex", alignItems: "center", gap: 3, padding: "7px 11px", borderRadius: 9, background: showLog ? "#f0eeff" : "transparent", border: "1px solid #ececf2", color: showLog ? "#6366f1" : "#999", fontSize: 11, fontWeight: 700, cursor: "pointer" }}><ILog />Log</button>
            <button onClick={exportCSV} style={{ display: "flex", alignItems: "center", gap: 3, padding: "7px 11px", borderRadius: 9, background: "transparent", border: "1px solid #ececf2", color: "#999", fontSize: 11, fontWeight: 700, cursor: "pointer" }}><IDown />CSV</button>
            <button onClick={openNew} style={{ display: "flex", alignItems: "center", gap: 3, padding: "7px 13px", borderRadius: 9, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 12px rgba(99,102,241,.25)" }}><IPlus />Novo</button>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 9px 4px 10px", borderRadius: 9, background: "#f7f7fb", border: "1px solid #ececf2" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: isAdmin ? "linear-gradient(135deg,#f59e0b,#ef4444)" : "linear-gradient(135deg,#6366f1,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 800 }}>{user.name.split(" ").map(w => w[0]).join("").slice(0, 2)}</div>
              <div style={{ lineHeight: 1.1 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#555", display: "block" }}>{user.name.split(" ")[0]}</span>
                {isAdmin && <span style={{ fontSize: 8, fontWeight: 800, color: "#f59e0b", display: "flex", alignItems: "center", gap: 1 }}><IShield />ADMIN</span>}
              </div>
              <button onClick={() => setUser(null)} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", display: "flex", padding: 2 }}><IOut /></button>
            </div>
          </div>

          {/* Mobile toggle */}
          <button className="mob" onClick={() => setMobileMenu(!mobileMenu)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: 4, display: "flex" }}><IMenu /></button>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div className="mob" style={{ padding: "10px 0", display: "flex", flexDirection: "column", gap: 6, animation: "fUp .2s ease" }}>
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#ccc" }}><ISearch /></div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ ...ip, width: "100%", paddingLeft: 28, fontSize: 12, padding: "9px 10px 9px 28px", borderRadius: 9, background: "#f7f7fb" }} />
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              <button onClick={openNew} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "9px 0", borderRadius: 9, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><IPlus />Novo</button>
              <button onClick={() => { setShowLog(!showLog); setMobileMenu(false); }} style={{ flex: 1, padding: "9px 0", borderRadius: 9, background: "#f7f7fb", border: "1px solid #ececf2", color: "#999", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}><ILog />Log</button>
              <button onClick={exportCSV} style={{ flex: 1, padding: "9px 0", borderRadius: 9, background: "#f7f7fb", border: "1px solid #ececf2", color: "#999", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}><IDown />CSV</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 9, background: "#f7f7fb" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>{user.name}</span>
              <button onClick={() => setUser(null)} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 11 }}><IOut /></button>
            </div>
          </div>
        )}
      </header>

      {/* STAGE FILTERS */}
      <div style={{ padding: "10px 16px 0", display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2 }}>
        <button onClick={() => setFilterStage("todos")} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 10.5, fontWeight: 700, border: filterStage === "todos" ? "2px solid #6366f1" : "1px solid #e4e4ec", background: filterStage === "todos" ? "#f0eeff" : "#fff", color: filterStage === "todos" ? "#6366f1" : "#aaa", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>Todos ({cards.length})</button>
        {STAGES.map(s => {
          const n = cards.filter(c => c.stage === s.key).length;
          return <button key={s.key} onClick={() => setFilterStage(s.key)} style={{ padding: "5px 10px", borderRadius: 8, fontSize: 10.5, fontWeight: 700, border: filterStage === s.key ? `2px solid ${s.color}` : "1px solid #e4e4ec", background: filterStage === s.key ? s.bg : "#fff", color: filterStage === s.key ? s.color : "#ccc", cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>{s.icon}{s.label} ({n})</button>;
        })}
      </div>

      {/* CONTENT */}
      <div style={{ display: "flex", gap: 0, padding: "10px 16px 28px", minHeight: "calc(100vh - 140px)" }} className="mfull">
        <div style={{ flex: 1, minWidth: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 20px", color: "#ccc" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Nenhum processo</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Clique em &quot;Novo&quot; para criar</div>
            </div>
          ) : filtered.map((card, i) => {
            const stgData = STAGES.find(s => s.key === card.stage)!;
            const urgent = isToday(card.data_retirada);
            const libAt = card.liberated_at ? new Date(card.liberated_at) : null;
            const autoMin = libAt ? Math.max(0, Math.ceil((libAt.getTime() + AUTO_DELETE_MS - Date.now()) / 60000)) : null;
            return <div key={card.id} style={{ animation: `fUp .25s ${i * 0.025}s both` }}><ProcessRow card={card} stgData={stgData} onEdit={openEdit} onDelete={id => setDeleteConfirm(id)} onChangeStage={changeStage} urgent={urgent} autoMin={autoMin} /></div>;
          })}
        </div>

        {/* Activity log sidebar */}
        {showLog && (
          <div style={{ width: 230, flexShrink: 0, marginLeft: 12, background: "#fff", borderRadius: 14, border: "1px solid #ececf2", padding: 12, overflow: "auto", maxHeight: "calc(100vh - 160px)", position: "sticky", top: 80, animation: "slideR .25s cubic-bezier(.16,1,.3,1)" }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 10, display: "flex", alignItems: "center", gap: 4 }}><ILog />Atividade</h3>
            {activityList.length === 0 ? <p style={{ fontSize: 11, color: "#ddd", textAlign: "center", padding: "12px 0" }}>Nenhuma atividade</p> :
              activityList.map((a, i) => (
                <div key={a.id} style={{ padding: "6px 0", borderBottom: i < activityList.length - 1 ? "1px solid #f5f5f8" : "none" }}>
                  <div style={{ fontSize: 10.5, color: "#555", lineHeight: 1.4 }}>{a.text}</div>
                  <div style={{ fontSize: 9, color: "#ccc", marginTop: 1, fontFamily: "var(--fm)" }}>{ago(a.created_at)}</div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* FORM MODAL */}
      <Modal open={showForm} onClose={closeForm} title={editId ? "✏️ Editar" : "📋 Novo Processo"}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 12px" }}>
          <Fl label="Exportador *"><input value={form.exportador} onChange={e => updateField("exportador", e.target.value)} placeholder="Nome" style={ip} /></Fl>
          <Fl label="Reserva *"><input value={form.reserva} onChange={e => updateField("reserva", e.target.value)} placeholder="Nº Booking" style={ip} /></Fl>
          <Fl label="Data Retirada"><input type="date" value={form.data_retirada} onChange={e => updateField("data_retirada", e.target.value)} style={ip} /></Fl>
          <Fl label="Data Carregamento"><input type="date" value={form.data_carregamento} onChange={e => updateField("data_carregamento", e.target.value)} style={ip} /></Fl>
          <Fl label="Referência"><input value={form.referencia} onChange={e => updateField("referencia", e.target.value)} placeholder="REF." style={ip} /></Fl>
          <Fl label="Transportadora"><input value={form.transportadora} onChange={e => updateField("transportadora", e.target.value)} placeholder="Nome" style={ip} /></Fl>
          <Fl label="Quantidade"><input type="number" min={1} value={form.quantidade} onChange={e => updateField("quantidade", parseInt(e.target.value) || 1)} style={ip} /></Fl>
          <Fl label="Tipo Contêiner"><select value={form.tipo_container} onChange={e => updateField("tipo_container", e.target.value)} style={sl}>{CTYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></Fl>
          <Fl label="Etapa" span>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {STAGES.map(s => <button key={s.key} onClick={() => updateField("stage", s.key)} style={{ padding: "4px 9px", borderRadius: 7, fontSize: 10, fontWeight: 700, border: form.stage === s.key ? `2px solid ${s.color}` : "1px solid #e4e4ec", background: form.stage === s.key ? s.bg : "transparent", color: form.stage === s.key ? s.color : "#ccc", cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}>{s.icon}{s.label}</button>)}
            </div>
          </Fl>
          <Fl label="Comentários" span><textarea value={form.comentarios} onChange={e => updateField("comentarios", e.target.value)} placeholder="Observações..." rows={2} style={{ ...ip, resize: "vertical" }} /></Fl>
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={closeForm} style={{ padding: "8px 16px", borderRadius: 9, background: "transparent", border: "1px solid #e4e4ec", color: "#999", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button onClick={saveCard} style={{ padding: "8px 20px", borderRadius: 9, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: (!form.exportador || !form.reserva) ? 0.4 : 1 }}>{editId ? "Salvar" : "Criar"}</button>
        </div>
      </Modal>

      {/* DELETE CONFIRM */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Excluir Processo" w={370}>
        <p style={{ color: "#777", fontSize: 13, marginBottom: 14 }}>Tem certeza? Ação irreversível.</p>
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button onClick={() => setDeleteConfirm(null)} style={{ padding: "8px 16px", borderRadius: 9, background: "transparent", border: "1px solid #e4e4ec", color: "#999", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} style={{ padding: "8px 20px", borderRadius: 9, background: "#ef4444", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Excluir</button>
        </div>
      </Modal>
    </div>
  );
}
