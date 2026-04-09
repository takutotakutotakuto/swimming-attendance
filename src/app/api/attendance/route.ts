import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year      = searchParams.get("year");
  const month     = searchParams.get("month");
  const dateFrom  = searchParams.get("dateFrom");
  const dateTo    = searchParams.get("dateTo");
  const facility  = searchParams.get("facility");
  const staff     = searchParams.get("staff");

  let query = supabase
    .from("attendance_records")
    .select("*")
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (dateFrom && dateTo) {
    query = query.gte("work_date", dateFrom).lte("work_date", dateTo);
  } else if (year && month) {
    const paddedMonth = month.padStart(2, "0");
    const startDate   = `${year}-${paddedMonth}-01`;
    const lastDay     = new Date(Number(year), Number(month), 0).getDate();
    const endDate     = `${year}-${paddedMonth}-${lastDay}`;
    query = query.gte("work_date", startDate).lte("work_date", endDate);
  }

  if (facility) query = query.eq("facility_name", facility);
  if (staff)    query = query.eq("staff_name", staff);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { staff_name, work_date, facility_name, lesson_type,
          slots_60, slots_60_sub, slots_90, slots_special,
          slots_mt, slots_mt_sub, memo } = body;

  if (!staff_name || !work_date || !facility_name || !lesson_type) {
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("attendance_records")
    .insert([{
      staff_name, work_date, facility_name, lesson_type,
      slots_60:      slots_60      ?? 0,
      slots_60_sub:  slots_60_sub  ?? 0,
      slots_90:      slots_90      ?? 0,
      slots_special: slots_special ?? 0,
      slots_mt:      slots_mt      ?? 0,
      slots_mt_sub:  slots_mt_sub  ?? 0,
      memo: memo || null,
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
