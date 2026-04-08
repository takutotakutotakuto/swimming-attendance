import { createClient } from "@supabase/supabase-js";
import type { AttendanceRecord } from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      attendance_records: {
        Row: AttendanceRecord;
        Insert: Omit<AttendanceRecord, "id" | "created_at">;
        Update: Partial<Omit<AttendanceRecord, "id" | "created_at">>;
      };
    };
  };
};
