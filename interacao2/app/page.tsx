"use client";

import { useState, useEffect } from "react";
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

const AUTO_DELETE_MS = 2 * 60 * 60 * 1000;
const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
const isToday = (d: string | null) => d === today();
const isTomorrow = (d: string | null) => d === tomorrow();
const isUrgent = (d: string | null) => isToday(d) || isTomorrow(d);
const isPast = (d: string | null) => { if (!d) return false; return d < today(); };
const STAGES: { key: Stage; label: string; icon: string; color: string; bg: string }[] = [
  { key: "sem_container", label: "Sem Container", icon: "📭", color: "#dc2626", bg: "#fef2f2" },
  { key: "contato_terminal", label: "Contato Terminal", icon: "📞", color: "#7c3aed", bg: "#f5f3ff" },
  { key: "aguardando", label: "Aguard. Estratégia", icon: "⏳", color: "#db2777", bg: "#fdf2f8" },
  { key: "liberado", label: "Liberado", icon: "✅", color: "#059669", bg: "#ecfdf5" },
  { key: "concluido", label: "Concluído", icon: "📦", color: "#0284c7", bg: "#f0f9ff" },
];
const CTYPES = ["20' Dry","40' Dry","40' HC","20' Reefer","40' Reefer","20' OT","40' OT","20' FR","40' FR"];
interface AppUser { email: string; name: string; role: "admin" | "user"; }
const fd = (d: string | null) => { if (!d) return "—"; return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }); };
const ff = (d: string | null) => { if (!d) return "—"; return new Date(d + "T12:00:00").toLocaleDateString("pt-BR"); };
const ago = (iso: string) => { const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000); if (m < 1) return "agora"; if (m < 60) return m+"min"; const h = Math.floor(m / 60); if (h < 24) return h+"h"; return Math.floor(h / 24)+"d"; };
const dateColor = (d: string | null) => { if (!d) return "#b0b0b0"; if (isPast(d)) return "#dc2626"; if (isToday(d)) return "#dc2626"; if (isTomorrow(d)) return "#ea580c"; return "#1a1a2e"; };
const dateLabel = (d: string | null) => { if (!d) return ""; if (isPast(d)) return "ATRASADO"; if (isToday(d)) return "HOJE"; if (isTomorrow(d)) return "AMANHÃ"; return ""; };

const IX = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IPlus = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const ISearch = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const ITrash = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>;
const IEdit = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IDown = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const ILog = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
const IOut = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IAlert = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const IChev = ({ d = "down" }: { d?: string }) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: d === "up" ? "rotate(180deg)" : "none", transition: "0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>;
const IMenu = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const IShield = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const ITimer = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3L2 6"/><path d="M22 6l-3-3"/><line x1="12" y1="1" x2="12" y2="3"/></svg>;

const ip: React.CSSProperties = { width: "100%", padding: "10px 14px", fontSize: 14, border: "2px solid #e2e2ea", borderRadius: 10, background: "#fff", color: "#1a1a2e", outline: "none", fontFamily: "'Nunito',sans-serif", boxSizing: "border-box", fontWeight: 600 };
const sl: React.CSSProperties = { ...ip, cursor: "pointer" };

function Modal({ open, onClose, title, children, w = 560 }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; w?: number }) {
  if (!open) return null;
  return (<div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}><div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: w, maxHeight: "92vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.15)", animation: "mIn .22s cubic-bezier(.16,1,.3,1)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: "2px solid #f0f0f4" }}><h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1a1a2e" }}>{title}</h2><button onClick={onClose} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", padding: 4, borderRadius: 8, display: "flex" }}><IX /></button></div><div style={{ padding: "20px 24px" }}>{children}</div></div></div>);
}
function Fl({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (<div style={{ gridColumn: span ? "1/-1" : undefined }}><label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#555", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</label>{children}</div>);
}

function LoginScreen({ onLogin }: { onLogin: (u: AppUser) => void }) {
  const [email, setEmail] = useState(""); const [pass, setPass] = useState(""); const [err, setErr] = useState(""); const [loading, setLoading] = useState(false); const [show, setShow] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), 80); }, []);
  const go = async () => { setLoading(true); setErr(""); try { const { data, error } = await supabase.from("users").select("*").eq("email", email.trim().toLowerCase()).eq("password_hash", pass).single(); if (error || !data) setErr("E-mail ou senha incorretos"); else onLogin({ email: data.email, name: data.name, role: data.role }); } catch { setErr("Erro de conexão"); } setLoading(false); };
  return (<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(155deg,#f2f4f8,#eaecf5,#f5f1f8)" }}><div style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 24, padding: "44px 40px", boxShadow: "0 20px 60px rgba(0,0,0,0.08)", opacity: show ? 1 : 0, transform: show ? "none" : "translateY(16px)", transition: "all .5s cubic-bezier(.16,1,.3,1)", margin: 16 }}><div style={{ textAlign: "center", marginBottom: 32 }}><div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-.04em", color: "#1a1a2e" }}>Inter<span style={{ color: "#6366f1" }}>ação</span></div><p style={{ fontSize: 13, color: "#999", marginTop: 6 }}>Controle de Liberação de Contêineres</p></div><div style={{ marginBottom: 16 }}><label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#555", marginBottom: 5, textTransform: "uppercase" }}>E-mail</label><input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} placeholder="seu@email.com" style={{ ...ip, padding: "12px 16px" }} /></div><div style={{ marginBottom: 8 }}><label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#555", marginBottom: 5, textTransform: "uppercase" }}>Senha</label><input type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} placeholder="••••••••" style={{ ...ip, padding: "12px 16px" }} /></div>{err && <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 10, background: "#fef2f2", color: "#dc2626", fontSize: 13, fontWeight: 700, marginTop: 12 }}><IAlert />{err}</div>}<button onClick={go} disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", marginTop: 18, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1, boxShadow: "0 6px 24px rgba(99,102,241,0.3)" }}>{loading ? "Entrando..." : "Entrar"}</button><p style={{ textAlign: "center", fontSize: 11, color: "#ccc", marginTop: 20 }}>Inter Shipping © {new Date().getFullYear()}</p></div></div>);
}

function ProcessCard({ card, stgData, onEdit, onDelete, onChangeStage, autoMin }: { card: ContainerProcess; stgData: typeof STAGES[0]; onEdit: (c: ContainerProcess) => void; onDelete: (id: string) => void; onChangeStage: (id: string, s: Stage) => void; autoMin: number | null; }) {
  const [open, setOpen] = useState(false);
  const past = isPast(card.data_retirada); const todayFlag = isToday(card.data_retirada); const tomorrowFlag = isTomorrow(card.data_retirada);
  const dColor = dateColor(card.data_retirada); const dLabel = dateLabel(card.data_retirada);
  const dColorC = dateColor(card.data_carregamento); const dLabelC = dateLabel(card.data_carregamento);
  return (<div style={{ background: (past || todayFlag) ? "#fff5f5" : tomorrowFlag ? "#fffbeb" : "#fff", border: past ? "2px solid #dc2626" : todayFlag ? "2px solid #ef4444" : tomorrowFlag ? "2px solid #f59e0b" : "1px solid #e8e8ee", borderRadius: 16, marginBottom: 10, overflow: "hidden", borderLeft: past ? "6px solid #dc2626" : todayFlag ? "6px solid #ef4444" : tomorrowFlag ? "6px solid #f59e0b" : `6px solid ${stgData.color}`, transition: "box-shadow .2s" }} onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 24px rgba(0,0,0,0.07)"; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}>
    <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", padding: "14px 18px", cursor: "pointer", gap: 12, flexWrap: "wrap" }}>
      {dLabel && <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 900, letterSpacing: ".05em", background: past ? "#dc2626" : todayFlag ? "#ef4444" : "#f59e0b", color: "#fff", animation: (past || todayFlag) ? "pulse 1.5s infinite" : "none", flexShrink: 0 }}>{past ? "⚠️" : "🔥"} {dLabel}</span>}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 800, background: stgData.bg, color: stgData.color, border: `2px solid ${stgData.color}30`, whiteSpace: "nowrap", flexShrink: 0 }}>{stgData.icon} {stgData.label}</span>
      <span style={{ fontSize: 17, fontWeight: 900, color: "#1a1a2e", flexShrink: 0, letterSpacing: "-.02em" }}>{card.exportador}</span>
      <span style={{ fontSize: 15, fontWeight: 800, color: stgData.color, fontFamily: "var(--fm)", flexShrink: 0 }}>{card.reserva}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: "#1a1a2e", background: "#f0f0f5", padding: "3px 10px", borderRadius: 6, flexShrink: 0 }}>{card.quantidade}× {card.tipo_container}</span>
      {card.transportadora && <span style={{ fontSize: 13, fontWeight: 700, color: "#444", flexShrink: 0 }}>🚛 {card.transportadora}</span>}
      {card.data_retirada && <span style={{ fontSize: 14, fontWeight: 900, color: dColor, fontFamily: "var(--fm)", flexShrink: 0, background: (past || todayFlag) ? "#fee2e2" : tomorrowFlag ? "#fff7ed" : "#f5f5f5", padding: "4px 10px", borderRadius: 7, border: (past || todayFlag) ? "1px solid #fca5a5" : "none" }}>📅 {fd(card.data_retirada)}</span>}
      {card.data_carregamento && <span style={{ fontSize: 12, fontWeight: 700, color: dColorC, fontFamily: "var(--fm)", flexShrink: 0, background: "#f0f5ff", padding: "3px 8px", borderRadius: 6 }}>🚢 {fd(card.data_carregamento)}{dLabelC && <span style={{ fontSize: 9, fontWeight: 900, marginLeft: 4, color: dColorC }}>{dLabelC}</span>}</span>}
      {card.stage === "liberado" && autoMin !== null && <span style={{ fontSize: 11, color: "#059669", fontFamily: "var(--fm)", background: "#ecfdf5", padding: "3px 8px", borderRadius: 6, fontWeight: 800, flexShrink: 0, display: "flex", alignItems: "center", gap: 3 }}><ITimer />{autoMin > 60 ? `${Math.floor(autoMin / 60)}h${autoMin % 60}m` : `${autoMin}min`}</span>}
      {card.referencia && <span style={{ fontSize: 12, fontWeight: 700, color: "#888", fontFamily: "var(--fm)", flexShrink: 0 }}>REF: {card.referencia}</span>}
      <div style={{ marginLeft: "auto", flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={e => { e.stopPropagation(); onEdit(card); }} style={{ background: "#f0eeff", border: "1px solid #ddd8ff", color: "#6366f1", cursor: "pointer", padding: "6px 8px", borderRadius: 8, display: "flex" }} title="Editar"><IEdit /></button>
        <button onClick={e => { e.stopPropagation(); onDelete(card.id); }} style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#ef4444", cursor: "pointer", padding: "6px 8px", borderRadius: 8, display: "flex" }} title="Excluir"><ITrash /></button>
        <IChev d={open ? "up" : "down"} />
      </div>
    </div>
    {!open && card.comentarios && <div style={{ padding: "0 18px 10px", marginTop: -4 }}><span style={{ fontSize: 12, color: "#888", fontWeight: 600, fontStyle: "italic" }}>💬 {card.comentarios.length > 80 ? card.comentarios.slice(0, 80) + "…" : card.comentarios}</span></div>}
    {open && (<div style={{ padding: "0 18px 18px", borderTop: "2px solid #f0f0f5", animation: "fUp .18s ease" }}>
      {card.comentarios && <div style={{ margin: "14px 0", padding: "10px 14px", borderRadius: 10, background: "#f8f8fc", fontSize: 14, color: "#444", lineHeight: 1.6, borderLeft: "4px solid #6366f1", fontWeight: 600 }}>💬 {card.comentarios}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "10px 18px", padding: "12px 0 16px" }}>
        <div><div style={{ fontSize: 10, color: "#999", fontWeight: 800, textTransform: "uppercase", marginBottom: 3 }}>Transportadora</div><div style={{ fontSize: 15, color: "#1a1a2e", fontWeight: 700 }}>{card.transportadora || "—"}</div></div>
        <div><div style={{ fontSize: 10, color: "#999", fontWeight: 800, textTransform: "uppercase", marginBottom: 3 }}>Data Retirada</div><div style={{ fontSize: 15, color: dColor, fontWeight: 900 }}>{ff(card.data_retirada)} {dLabel && <span style={{ fontSize: 10, background: dColor, color: "#fff", padding: "1px 6px", borderRadius: 4, marginLeft: 4 }}>{dLabel}</span>}</div></div>
        <div><div style={{ fontSize: 10, color: "#999", fontWeight: 800, textTransform: "uppercase", marginBottom: 3 }}>Data Carregamento</div><div style={{ fontSize: 15, color: dColorC, fontWeight: 900 }}>{ff(card.data_carregamento)}</div></div>
        <div><div style={{ fontSize: 10, color: "#999", fontWeight: 800, textTransform: "uppercase", marginBottom: 3 }}>Referência</div><div style={{ fontSize: 15, color: "#1a1a2e", fontWeight: 700 }}>{card.referencia || "—"}</div></div>
        <div><div style={{ fontSize: 10, color: "#999", fontWeight: 800, textTransform: "uppercase", marginBottom: 3 }}>Criado por</div><div style={{ fontSize: 14, color: "#555", fontWeight: 600 }}>{card.created_by || "—"}</div></div>
        <div><div style={{ fontSize: 10, color: "#999", fontWeight: 800, textTransform: "uppercase", marginBottom: 3 }}>Quando</div><div style={{ fontSize: 14, color: "#555", fontWeight: 600 }}>{card.created_at ? ago(card.created_at) + " atrás" : "—"}</div></div>
      </div>
      <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, color: "#999", fontWeight: 800, textTransform: "uppercase", marginBottom: 8 }}>Mover para:</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{STAGES.map(s => (<button key={s.key} onClick={() => onChangeStage(card.id, s.key)} style={{ padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 800, border: card.stage === s.key ? `3px solid ${s.color}` : "2px solid #e4e4ec", background: card.stage === s.key ? s.bg : "#fff", color: card.stage === s.key ? s.color : "#999", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: ".15s" }}>{s.icon} {s.label}</button>))}</div></div>
    </div>)}
  </div>);
}

export default function Page() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [cards, setCards] = useState<ContainerProcess[]>([]);
  const [activityList, setActivityList] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ stage: "sem_container" as Stage, exportador: "", reserva: "", data_retirada: "", data_carregamento: "", quantidade: 1, tipo_container: "40' HC", transportadora: "", referencia: "", comentarios: "" });
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("todos");
  const [filterDate, setFilterDate] = useState("todos");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!user) return; let m = true;
    const load = async () => { try { const [p, a] = await Promise.all([getProcesses(), getActivity()]); if (m) { setCards(p); setActivityList(a); } } catch (e) { console.error(e); } if (m) setLoading(false); };
    load();
    const s1 = subscribeToProcesses(() => { getProcesses().then(d => m && setCards(d)).catch(console.error); });
    const s2 = subscribeToActivity(() => { getActivity().then(d => m && setActivityList(d)).catch(console.error); });
    const iv = setInterval(() => { setTick(t => t + 1); autoDeleteLiberated().catch(console.error); }, 30000);
    return () => { m = false; s1.unsubscribe(); s2.unsubscribe(); clearInterval(iv); };
  }, [user]);

  const openNew = () => { setForm({ stage: "sem_container", exportador: "", reserva: "", data_retirada: "", data_carregamento: "", quantidade: 1, tipo_container: "40' HC", transportadora: "", referencia: "", comentarios: "" }); setEditId(null); setShowForm(true); setMobileMenu(false); };
  const openEdit = (c: ContainerProcess) => { setForm({ stage: c.stage, exportador: c.exportador, reserva: c.reserva, data_retirada: c.data_retirada || "", data_carregamento: c.data_carregamento || "", quantidade: c.quantidade, tipo_container: c.tipo_container, transportadora: c.transportadora || "", referencia: c.referencia || "", comentarios: c.comentarios || "" }); setEditId(c.id); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditId(null); };
  const saveCard = async () => {
    if (!form.exportador || !form.reserva || !user) return;
    try {
      if (editId) { const old = cards.find(c => c.id === editId); await updateProcess(editId, { stage: form.stage, exportador: form.exportador, reserva: form.reserva, data_retirada: form.data_retirada || null, data_carregamento: form.data_carregamento || null, quantidade: form.quantidade, tipo_container: form.tipo_container, transportadora: form.transportadora || null, referencia: form.referencia || null, comentarios: form.comentarios || null, liberated_at: form.stage === "liberado" && old?.stage !== "liberado" ? new Date().toISOString() : old?.liberated_at || null }); await addActivity(`✏️ Editou ${form.exportador} — ${form.reserva}`, user.name); }
      else { await createProcess({ stage: form.stage, exportador: form.exportador, reserva: form.reserva, data_retirada: form.data_retirada || null, data_carregamento: form.data_carregamento || null, quantidade: form.quantidade, tipo_container: form.tipo_container, transportadora: form.transportadora || null, referencia: form.referencia || null, comentarios: form.comentarios || null, created_by: user.name, liberated_at: form.stage === "liberado" ? new Date().toISOString() : null }); await addActivity(`📋 Criou ${form.exportador} — ${form.reserva}`, user.name); }
      setCards(await getProcesses());
    } catch (e) { console.error(e); }
    closeForm();
  };
  const changeStage = async (id: string, ns: Stage) => { if (!user) return; const c = cards.find(x => x.id === id); if (!c || c.stage === ns) return; try { await updateProcess(id, { stage: ns, liberated_at: ns === "liberado" ? new Date().toISOString() : c.liberated_at }); await addActivity(`➡️ ${c.exportador}: ${STAGES.find(s => s.key === c.stage)?.label} → ${STAGES.find(s => s.key === ns)?.label}`, user.name); setCards(await getProcesses()); } catch (e) { console.error(e); } };
  const handleDelete = async (id: string) => { if (!user) return; const c = cards.find(x => x.id === id); try { await deleteProcess(id); if (c) await addActivity(`🗑️ Excluiu ${c.exportador} — ${c.reserva}`, user.name); setCards(await getProcesses()); } catch (e) { console.error(e); } setDeleteConfirm(null); };
  const updateField = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const filtered = cards.filter(c => {
    if (filterStage !== "todos" && c.stage !== filterStage) return false;
    if (filterDate === "hoje" && !isToday(c.data_retirada)) return false;
    if (filterDate === "amanha" && !isTomorrow(c.data_retirada)) return false;
    if (filterDate === "atrasado" && !isPast(c.data_retirada)) return false;
    if (filterDate === "urgente" && !isUrgent(c.data_retirada) && !isPast(c.data_retirada)) return false;
    if (!search) return true; const q = search.toLowerCase();
    return [c.exportador, c.reserva, c.transportadora, c.referencia, c.comentarios].some(v => v?.toLowerCase().includes(q));
  });

  const exportCSV = () => { const h = ["Etapa","Data Retirada","Data Carregamento","Exportador","Reserva","Qtd","Tipo","Transportadora","REF","Comentários"]; const r = cards.map(c => [STAGES.find(s => s.key === c.stage)?.label, c.data_retirada, c.data_carregamento, c.exportador, c.reserva, c.quantidade, c.tipo_container, c.transportadora, c.referencia, c.comentarios]); const csv = [h, ...r].map(x => x.map(c => `"${c || ""}"`).join(",")).join("\n"); const b = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `interacao-${today()}.csv`; a.click(); };

  const totalC = cards.reduce((a, c) => a + (c.quantidade || 0), 0);
  const todayCount = cards.filter(c => isToday(c.data_retirada)).length;
  const urgentCount = cards.filter(c => isUrgent(c.data_retirada) || isPast(c.data_retirada)).length;
  const isAdmin = user?.role === "admin";

  if (!user) return <LoginScreen onLogin={setUser} />;
  if (loading) return (<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f5f9" }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 40, marginBottom: 12 }}>📦</div><p style={{ color: "#999", fontWeight: 700, fontSize: 16 }}>Carregando...</p></div></div>);

  return (
    <div style={{ minHeight: "100vh", background: "#f2f3f8" }}>
      <header style={{ background: "#fff", borderBottom: "2px solid #eeeef2", padding: "12px 20px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#6366f1,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, boxShadow: "0 4px 16px rgba(99,102,241,.25)" }}>📦</div>
            <div><h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-.03em", lineHeight: 1 }}>Inter<span style={{ color: "#6366f1" }}>ação</span></h1><p style={{ fontSize: 11, color: "#888", fontWeight: 700 }}>{cards.length} processos · {totalC} cnt{urgentCount > 0 && <span style={{ color: "#dc2626", fontWeight: 900 }}> · ⚠️ {urgentCount} urgente{urgentCount > 1 ? "s" : ""}</span>}</p></div>
          </div>
          <div className="desk" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ position: "relative" }}><div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#bbb" }}><ISearch /></div><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar exportador, reserva..." style={{ ...ip, width: 280, paddingLeft: 34, fontSize: 13, padding: "8px 12px 8px 34px", borderRadius: 10, background: "#f7f7fb", border: "2px solid #e8e8ee" }} /></div>
            <button onClick={() => setShowLog(!showLog)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 14px", borderRadius: 10, background: showLog ? "#f0eeff" : "#fff", border: "2px solid #e8e8ee", color: showLog ? "#6366f1" : "#888", fontSize: 12, fontWeight: 800, cursor: "pointer" }}><ILog />Log</button>
            <button onClick={exportCSV} style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 14px", borderRadius: 10, background: "#fff", border: "2px solid #e8e8ee", color: "#888", fontSize: 12, fontWeight: 800, cursor: "pointer" }}><IDown />CSV</button>
            <button onClick={openNew} style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 18px", borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 16px rgba(99,102,241,.3)" }}><IPlus />Novo Processo</button>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px 6px 10px", borderRadius: 10, background: "#f7f7fb", border: "2px solid #e8e8ee" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: isAdmin ? "linear-gradient(135deg,#f59e0b,#ef4444)" : "linear-gradient(135deg,#6366f1,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 900 }}>{user.name.split(" ").map(w => w[0]).join("").slice(0, 2)}</div>
              <div style={{ lineHeight: 1.2 }}><span style={{ fontSize: 12, fontWeight: 800, color: "#333", display: "block" }}>{user.name.split(" ")[0]}</span>{isAdmin && <span style={{ fontSize: 9, fontWeight: 900, color: "#f59e0b", display: "flex", alignItems: "center", gap: 2 }}><IShield />ADMIN</span>}</div>
              <button onClick={() => setUser(null)} style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", display: "flex", padding: 2 }}><IOut /></button>
            </div>
          </div>
          <button className="mob" onClick={() => setMobileMenu(!mobileMenu)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: 4, display: "flex" }}><IMenu /></button>
        </div>
        {mobileMenu && (<div className="mob" style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 8, animation: "fUp .2s ease" }}><div style={{ position: "relative" }}><div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#bbb" }}><ISearch /></div><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ ...ip, width: "100%", paddingLeft: 34, fontSize: 14, padding: "10px 12px 10px 34px" }} /></div><div style={{ display: "flex", gap: 6 }}><button onClick={openNew} style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><IPlus />Novo</button><button onClick={() => { setShowLog(!showLog); setMobileMenu(false); }} style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "#f7f7fb", border: "2px solid #e8e8ee", color: "#888", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><ILog />Log</button><button onClick={exportCSV} style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "#f7f7fb", border: "2px solid #e8e8ee", color: "#888", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><IDown />CSV</button></div><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 10, background: "#f7f7fb" }}><span style={{ fontSize: 13, fontWeight: 800, color: "#333" }}>{user.name}</span><button onClick={() => setUser(null)} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 12 }}><IOut /></button></div></div>)}
      </header>

      <div style={{ padding: "12px 20px 0" }}>
        <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 8 }}>
          <button onClick={() => setFilterStage("todos")} style={{ padding: "6px 16px", borderRadius: 9, fontSize: 12, fontWeight: 800, border: filterStage === "todos" ? "2px solid #6366f1" : "2px solid #e4e4ec", background: filterStage === "todos" ? "#f0eeff" : "#fff", color: filterStage === "todos" ? "#6366f1" : "#888", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>Todos ({cards.length})</button>
          {STAGES.map(s => { const n = cards.filter(c => c.stage === s.key).length; return <button key={s.key} onClick={() => setFilterStage(s.key)} style={{ padding: "6px 14px", borderRadius: 9, fontSize: 12, fontWeight: 800, border: filterStage === s.key ? `2px solid ${s.color}` : "2px solid #e4e4ec", background: filterStage === s.key ? s.bg : "#fff", color: filterStage === s.key ? s.color : "#bbb", cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>{s.icon} {s.label} ({n})</button>; })}
        </div>
        <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4 }}>
          {[{ key: "todos", label: "Todas as datas", color: "#888", bg: "#fff" },{ key: "urgente", label: `⚠️ Urgentes (${urgentCount})`, color: "#dc2626", bg: "#fef2f2" },{ key: "hoje", label: `🔥 Hoje (${todayCount})`, color: "#ef4444", bg: "#fef2f2" },{ key: "amanha", label: `⏰ Amanhã (${cards.filter(c => isTomorrow(c.data_retirada)).length})`, color: "#ea580c", bg: "#fff7ed" },{ key: "atrasado", label: `🚨 Atrasados (${cards.filter(c => isPast(c.data_retirada)).length})`, color: "#dc2626", bg: "#fef2f2" }].map(f => (<button key={f.key} onClick={() => setFilterDate(f.key)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 800, border: filterDate === f.key ? `2px solid ${f.color}` : "2px solid #e4e4ec", background: filterDate === f.key ? f.bg : "#fff", color: filterDate === f.key ? f.color : "#bbb", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{f.label}</button>))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 0, padding: "12px 20px 32px", minHeight: "calc(100vh - 180px)" }} className="mfull">
        <div style={{ flex: 1, minWidth: 0 }}>
          {filtered.length === 0 ? (<div style={{ textAlign: "center", padding: "60px 20px", color: "#bbb" }}><div style={{ fontSize: 44, marginBottom: 10 }}>📭</div><div style={{ fontSize: 16, fontWeight: 800 }}>Nenhum processo encontrado</div><div style={{ fontSize: 13, marginTop: 6 }}>Clique em &quot;Novo Processo&quot; para criar</div></div>) : filtered.map((card, i) => { const stgData = STAGES.find(s => s.key === card.stage)!; const libAt = card.liberated_at ? new Date(card.liberated_at) : null; const autoMin = libAt ? Math.max(0, Math.ceil((libAt.getTime() + AUTO_DELETE_MS - Date.now()) / 60000)) : null; return <div key={card.id} style={{ animation: `fUp .25s ${i * 0.02}s both` }}><ProcessCard card={card} stgData={stgData} onEdit={openEdit} onDelete={id => setDeleteConfirm(id)} onChangeStage={changeStage} autoMin={autoMin} /></div>; })}
          {filtered.length > 0 && <div style={{ padding: "12px 18px", fontSize: 13, color: "#aaa", fontWeight: 700, display: "flex", justifyContent: "space-between" }}><span>{filtered.length} processo{filtered.length !== 1 ? "s" : ""}</span><span style={{ fontFamily: "var(--fm)" }}>{filtered.reduce((a, c) => a + (c.quantidade || 0), 0)} contêineres</span></div>}
        </div>
        {showLog && (<div style={{ width: 250, flexShrink: 0, marginLeft: 14, background: "#fff", borderRadius: 16, border: "2px solid #eeeef2", padding: 14, overflow: "auto", maxHeight: "calc(100vh - 180px)", position: "sticky", top: 90, animation: "slideR .25s cubic-bezier(.16,1,.3,1)" }}><h3 style={{ fontSize: 13, fontWeight: 800, color: "#888", marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}><ILog />Atividade</h3>{activityList.length === 0 ? <p style={{ fontSize: 12, color: "#ccc", textAlign: "center", padding: "14px 0" }}>Nenhuma atividade</p> : activityList.map((a, i) => (<div key={a.id} style={{ padding: "8px 0", borderBottom: i < activityList.length - 1 ? "1px solid #f5f5f8" : "none" }}><div style={{ fontSize: 12, color: "#444", lineHeight: 1.5, fontWeight: 600 }}>{a.text}</div><div style={{ fontSize: 10, color: "#bbb", marginTop: 2, fontFamily: "var(--fm)" }}>{ago(a.created_at)}</div></div>))}</div>)}
      </div>

      <Modal open={showForm} onClose={closeForm} title={editId ? "✏️ Editar Processo" : "📋 Novo Processo"}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
          <Fl label="Exportador *"><input value={form.exportador} onChange={e => updateField("exportador", e.target.value)} placeholder="Nome do exportador" style={ip} /></Fl>
          <Fl label="Reserva (Booking) *"><input value={form.reserva} onChange={e => updateField("reserva", e.target.value)} placeholder="Nº da reserva" style={ip} /></Fl>
          <Fl label="Data de Retirada"><input type="date" value={form.data_retirada} onChange={e => updateField("data_retirada", e.target.value)} style={ip} /></Fl>
          <Fl label="Data de Carregamento"><input type="date" value={form.data_carregamento} onChange={e => updateField("data_carregamento", e.target.value)} style={ip} /></Fl>
          <Fl label="Referência"><input value={form.referencia} onChange={e => updateField("referencia", e.target.value)} placeholder="REF." style={ip} /></Fl>
          <Fl label="Transportadora"><input value={form.transportadora} onChange={e => updateField("transportadora", e.target.value)} placeholder="Nome" style={ip} /></Fl>
          <Fl label="Quantidade"><input type="number" min={1} value={form.quantidade} onChange={e => updateField("quantidade", parseInt(e.target.value) || 1)} style={ip} /></Fl>
          <Fl label="Tipo de Contêiner"><select value={form.tipo_container} onChange={e => updateField("tipo_container", e.target.value)} style={sl}>{CTYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></Fl>
          <Fl label="Etapa" span><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{STAGES.map(s => <button key={s.key} onClick={() => updateField("stage", s.key)} style={{ padding: "6px 14px", borderRadius: 9, fontSize: 12, fontWeight: 800, border: form.stage === s.key ? `3px solid ${s.color}` : "2px solid #e4e4ec", background: form.stage === s.key ? s.bg : "#fff", color: form.stage === s.key ? s.color : "#bbb", cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>{s.icon} {s.label}</button>)}</div></Fl>
          <Fl label="Comentários" span><textarea value={form.comentarios} onChange={e => updateField("comentarios", e.target.value)} placeholder="Observações, notas, instruções..." rows={3} style={{ ...ip, resize: "vertical" }} /></Fl>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={closeForm} style={{ padding: "10px 20px", borderRadius: 10, background: "#fff", border: "2px solid #e4e4ec", color: "#888", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
          <button onClick={saveCard} style={{ padding: "10px 28px", borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: (!form.exportador || !form.reserva) ? 0.4 : 1, boxShadow: "0 4px 16px rgba(99,102,241,.25)" }}>{editId ? "Salvar Alterações" : "Criar Processo"}</button>
        </div>
      </Modal>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="⚠️ Excluir Processo" w={400}>
        <p style={{ color: "#555", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Tem certeza que deseja excluir? Ação irreversível.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => setDeleteConfirm(null)} style={{ padding: "10px 20px", borderRadius: 10, background: "#fff", border: "2px solid #e4e4ec", color: "#888", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} style={{ padding: "10px 24px", borderRadius: 10, background: "#ef4444", border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Excluir</button>
        </div>
      </Modal>
    </div>
  );
}
