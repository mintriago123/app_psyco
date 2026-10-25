import type { UserProgressDB } from "../../../types/spec";

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
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
