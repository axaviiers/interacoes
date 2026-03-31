import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export type Stage =
  | "sem_container"
  | "contato_terminal"
  | "aguardando"
  | "liberado"
  | "concluido";

export interface ContainerRelease {
  id: string;
  stage: Stage;
  exportador: string;
  reserva: string;
  data_retirada: string | null;
  data_carregamento: string | null;
  quantidade: number;
  tipo_container: string;
  transportadora: string;
  referencia: string;
  comentarios: string;
  created_by: string;
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

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
}

// ══════════════════════════════════════════════
// DATABASE OPERATIONS
// ══════════════════════════════════════════════

export const db = {
  // ─── Container Releases ───
  async getAll() {
    const { data, error } = await supabase
      .from("container_releases")
      .select("*")
      .order("data_retirada", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data as ContainerRelease[];
  },

  async create(release: Omit<ContainerRelease, "id" | "created_at" | "updated_at">) {
    const { data, error } = await supabase
      .from("container_releases")
      .insert(release)
      .select()
      .single();
    if (error) throw error;
    return data as ContainerRelease;
  },

  async update(id: string, updates: Partial<ContainerRelease>) {
    const { data, error } = await supabase
      .from("container_releases")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as ContainerRelease;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("container_releases")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async changeStage(id: string, newStage: Stage) {
    const updates: Partial<ContainerRelease> = {
      stage: newStage,
      updated_at: new Date().toISOString(),
    };
    // Registrar quando entrou em "liberado" para auto-exclusão
    if (newStage === "liberado") {
      updates.liberated_at = new Date().toISOString();
    }
    return this.update(id, updates);
  },

  async deleteExpiredLiberados() {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("container_releases")
      .delete()
      .eq("stage", "liberado")
      .not("liberated_at", "is", null)
      .lt("liberated_at", twoHoursAgo)
      .select();
    if (error) throw error;
    return data as ContainerRelease[];
  },

  // ─── Activity Log ───
  async getActivity(limit = 50) {
    const { data, error } = await supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as ActivityLog[];
  },

  async logActivity(text: string, userName: string) {
    const { error } = await supabase
      .from("activity_log")
      .insert({ text, user_name: userName });
    if (error) throw error;
  },

  // ─── Auth ───
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return data as UserProfile;
  },

  // ─── Realtime ───
  subscribeToReleases(callback: (payload: any) => void) {
    return supabase
      .channel("container_releases_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "container_releases" },
        callback
      )
      .subscribe();
  },

  subscribeToActivity(callback: (payload: any) => void) {
    return supabase
      .channel("activity_log_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log" },
        callback
      )
      .subscribe();
  },
};
