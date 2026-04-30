import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseKey);

// ═══ TYPES ═══

export type Stage =
  | "sem_container"
  | "contato_terminal"
  | "aguardando"
  | "aguardando_data_liberacao"
  | "aguardando_vistoria"
  | "aguardando_retirada"
  | "liberado"
  | "concluido";

export type UserRole = "admin" | "user";

export interface ContainerProcess {
  id: string;
  stage: Stage;
  exportador: string;
  reserva: string;
  data_retirada: string | null;
  data_carregamento: string | null;
  quantidade: number;
  tipo_container: string;
  transportadora: string | null;
  referencia: string | null;
  comentarios: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  liberated_at: string | null;
}

export interface ActivityLog {
  id: string;
  text: string;
  user_name: string;
  created_at: string;
}

export interface ClientNote {
  id: string;
  text: string;
  created_at: string;
  created_by?: string | null;
}

export interface ClientSpecific {
  id: string;
  client_name: string;
  notes: ClientNote[];
  created_at: string;
  updated_at: string;
}

// ═══ PROCESSES ═══

export async function getProcesses(): Promise<ContainerProcess[]> {
  const { data, error } = await supabase
    .from("container_processes")
    .select("*")
    .order("data_retirada", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data || []) as ContainerProcess[];
}

export async function createProcess(
  process: Omit<ContainerProcess, "id" | "created_at" | "updated_at">
): Promise<ContainerProcess> {
  const { data, error } = await supabase
    .from("container_processes")
    .insert(process)
    .select()
    .single();
  if (error) throw error;
  return data as ContainerProcess;
}

export async function updateProcess(
  id: string,
  updates: Partial<ContainerProcess>
): Promise<ContainerProcess> {
  const { data, error } = await supabase
    .from("container_processes")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ContainerProcess;
}

export async function deleteProcess(id: string): Promise<void> {
  const { error } = await supabase
    .from("container_processes")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ═══ ACTIVITY LOG ═══

export async function getActivity(): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw error;
  return (data || []) as ActivityLog[];
}

export async function addActivity(
  text: string,
  userName: string
): Promise<void> {
  const { error } = await supabase
    .from("activity_log")
    .insert({ text, user_name: userName });
  if (error) console.error("Activity log error:", error);
}

// ═══ CLIENT SPECIFICS (Particularidades dos Clientes) ═══

export async function getClientSpecifics(): Promise<ClientSpecific[]> {
  const { data, error } = await supabase
    .from("client_specifics")
    .select("*")
    .order("client_name", { ascending: true });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    ...r,
    notes: Array.isArray(r.notes) ? r.notes : [],
  })) as ClientSpecific[];
}

export async function createClientSpecific(
  clientName: string
): Promise<ClientSpecific> {
  const { data, error } = await supabase
    .from("client_specifics")
    .insert({ client_name: clientName.trim(), notes: [] })
    .select()
    .single();
  if (error) throw error;
  return { ...(data as any), notes: [] } as ClientSpecific;
}

export async function updateClientSpecific(
  id: string,
  updates: { client_name?: string; notes?: ClientNote[] }
): Promise<ClientSpecific> {
  const { data, error } = await supabase
    .from("client_specifics")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ClientSpecific;
}

export async function deleteClientSpecific(id: string): Promise<void> {
  const { error } = await supabase
    .from("client_specifics")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Busca cliente por nome (case-insensitive, trimmed).
 * Retorna null se não encontrar.
 */
export async function findClientByName(
  name: string
): Promise<ClientSpecific | null> {
  const clean = (name || "").trim();
  if (!clean) return null;
  const { data, error } = await supabase
    .from("client_specifics")
    .select("*")
    .ilike("client_name", clean)
    .limit(1);
  if (error) {
    console.error("findClientByName error:", error);
    return null;
  }
  if (!data || data.length === 0) return null;
  const row: any = data[0];
  return { ...row, notes: Array.isArray(row.notes) ? row.notes : [] } as ClientSpecific;
}

// ═══ REALTIME ═══

export function subscribeToProcesses(callback: (payload: any) => void) {
  return supabase
    .channel("container_processes_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "container_processes" },
      callback
    )
    .subscribe();
}

export function subscribeToActivity(callback: (payload: any) => void) {
  return supabase
    .channel("activity_log_changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "activity_log" },
      callback
    )
    .subscribe();
}

export function subscribeToClientSpecifics(callback: (payload: any) => void) {
  return supabase
    .channel("client_specifics_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "client_specifics" },
      callback
    )
    .subscribe();
}

// ═══ AUTO-DELETE LIBERATED (2h) ═══

export async function autoDeleteLiberated(): Promise<number> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: toDelete } = await supabase
    .from("container_processes")
    .select("id, exportador, reserva")
    .eq("stage", "liberado")
    .not("liberated_at", "is", null)
    .lt("liberated_at", twoHoursAgo);

  if (toDelete && toDelete.length > 0) {
    for (const proc of toDelete) {
      await deleteProcess(proc.id);
      await addActivity(
        `🤖 Auto-exclusão: ${proc.exportador} — ${proc.reserva} (liberado há 2h)`,
        "Sistema"
      );
    }
  }

  return toDelete?.length || 0;
}
