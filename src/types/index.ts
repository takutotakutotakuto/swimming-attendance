export interface AttendanceRecord {
  id: string;
  staff_name: string;
  work_date: string;
  facility_name: string;
  lesson_type: string;
  slots_60: number;
  slots_60_sub: number;
  slots_90: number;
  slots_special: number;
  slots_mt: number;
  slots_mt_sub: number;
  memo: string | null;
  created_at: string;
}

export interface AttendanceFormData {
  staff_name: string;
  work_date: string;
  facility_name: string;
  lesson_type: string;
  slots_60: number;
  slots_60_sub: number;
  slots_90: number;
  slots_special: number;
  slots_mt: number;
  slots_mt_sub: number;
  memo: string;
}
