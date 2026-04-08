import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await supabase
    .from("attendance_records")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { work_date, facility_name, lesson_type,
          slots_60, slots_60_sub, slots_90, slots_special,
          slots_mt, slots_mt_sub, memo } = body;

  const { data, error } = await supabase
    .from("attendance_records")
    .update({
      work_date, facility_name, lesson_type,
      slots_60:      slots_60      ?? 0,
      slots_60_sub:  slots_60_sub  ?? 0,
      slots_90:      slots_90      ?? 0,
      slots_special: slots_special ?? 0,
      slots_mt:      slots_mt      ?? 0,
      slots_mt_sub:  slots_mt_sub  ?? 0,
      memo: memo || null,
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
