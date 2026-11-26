import type { GameSessionState, PersistedGameSession, UserProgressDB } from "../../../types/spec";

/** Tipos mínimos de la tabla según `supabase/schema.sql`. */
type DatabaseRecord<T> = T & Record<string, unknown>;

export interface Database {
  public: {
    Tables: {
      user_progress: {
        Row: DatabaseRecord<UserProgressDB>;
        Insert: DatabaseRecord<
          Pick<UserProgressDB, "user_id"> &
            Partial<Omit<UserProgressDB, "user_id">>
        >;
        Update: DatabaseRecord<Partial<UserProgressDB>>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      start_game_session: {
        Args: { p_user_id: string; p_session: GameSessionState };
        Returns: PersistedGameSession;
      };
      save_game_snapshot: {
        Args: { p_user_id: string; p_session: PersistedGameSession };
        Returns: boolean;
      };
      finish_game_session: {
        Args: { p_user_id: string; p_session_id: string; p_result: PersistedGameSession };
        Returns: PersistedGameSession;
      };
      change_error_vault: {
        Args: { p_user_id: string; p_question_id: string; p_add: boolean };
        Returns: undefined;
      };
      keep_alive: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
