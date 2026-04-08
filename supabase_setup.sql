-- Supabase テーブル作成SQL
-- Supabaseダッシュボードの「SQL Editor」で実行してください

DROP TABLE IF EXISTS attendance_records;

CREATE TABLE attendance_records (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_name   TEXT NOT NULL,
  work_date    DATE NOT NULL,
  facility_name TEXT NOT NULL,
  lesson_type  TEXT NOT NULL,
  slots_60      INTEGER NOT NULL DEFAULT 0,  -- 60分
  slots_60_sub  INTEGER NOT NULL DEFAULT 0,  -- 代行60分
  slots_90      INTEGER NOT NULL DEFAULT 0,  -- 90分
  slots_special INTEGER NOT NULL DEFAULT 0,  -- 特種レッスン60分
  slots_mt      INTEGER NOT NULL DEFAULT 0,  -- MT（30分）
  slots_mt_sub  INTEGER NOT NULL DEFAULT 0,  -- 代行MT
  memo         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_attendance_work_date  ON attendance_records(work_date);
CREATE INDEX idx_attendance_staff_name ON attendance_records(staff_name);
CREATE INDEX idx_attendance_facility   ON attendance_records(facility_name);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations" ON attendance_records
  FOR ALL USING (true) WITH CHECK (true);
