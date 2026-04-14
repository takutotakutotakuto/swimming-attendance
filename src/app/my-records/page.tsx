"use client";

import { useState, useEffect, useCallback } from "react";
import { STAFF_NAMES, FACILITY_NAMES, LESSON_TYPES, SLOT_TYPES, SlotKey } from "@/config/settings";
import type { AttendanceRecord, AttendanceFormData } from "@/types";

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}年${m}月${d}日`;
}
function getLessonLabel(value: string): string {
  return LESSON_TYPES.find((t) => t.value === value)?.label ?? value;
}
function lessonOf(r: AttendanceRecord) { return r.slots_60 + r.slots_60_sub + r.slots_90 + r.slots_special; }
function mtOf(r: AttendanceRecord)     { return r.slots_mt + r.slots_mt_sub; }

function recordToForm(r: AttendanceRecord): AttendanceFormData {
  return {
    staff_name: r.staff_name,
    work_date: r.work_date,
    facility_name: r.facility_name,
    lesson_type: r.lesson_type,
    slots_60: r.slots_60,
    slots_60_sub: r.slots_60_sub,
    slots_90: r.slots_90,
    slots_special: r.slots_special,
    slots_mt: r.slots_mt,
    slots_mt_sub: r.slots_mt_sub,
    memo: r.memo ?? "",
  };
}

export default function MyRecordsPage() {
  const now = new Date();
  const [selectedStaff, setSelectedStaff] = useState("");
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords]   = useState<AttendanceRecord[]>([]);
  const [loading, setLoading]   = useState(false);
  const [editTarget, setEditTarget] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm]     = useState<AttendanceFormData | null>(null);
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!selectedStaff) return;
    setLoading(true);
    const params = new URLSearchParams({
      year: String(year), month: String(month), staff: selectedStaff,
    });
    try {
      const res  = await fetch(`/api/attendance?${params}`);
      const { data } = await res.json();
      setRecords(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [selectedStaff, year, month]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const prevMonth = () => { if (month === 1) { setYear((y) => y - 1); setMonth(12); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear((y) => y + 1); setMonth(1); } else setMonth((m) => m + 1); };

  const openEdit = (r: AttendanceRecord) => {
    setEditTarget(r);
    setEditForm(recordToForm(r));
    setSaveError(null);
  };
  const closeEdit = () => { setEditTarget(null); setEditForm(null); };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setEditForm((prev) => prev ? { ...prev, [e.target.name]: e.target.value } : prev);
  };
  const handleEditSlot = (key: SlotKey, delta: number) => {
    setEditForm((prev) => prev ? { ...prev, [key]: Math.max(0, (prev[key] as number) + delta) } : prev);
  };

  const handleSave = async () => {
    if (!editTarget || !editForm) return;
    setSaveError(null);
    if (!editForm.facility_name) return setSaveError("勤務場所を選択してください");
    if (!editForm.lesson_type)   return setSaveError("業務種別を選択してください");
    const total = SLOT_TYPES.reduce((s, t) => s + (editForm[t.key] as number), 0);
    if (total === 0) return setSaveError("コマ数を1つ以上入力してください");

    setSaving(true);
    try {
      const res = await fetch(`/api/attendance/${editTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "保存に失敗しました");
      }
      const { data } = await res.json();
      setRecords((prev) => prev.map((r) => r.id === editTarget.id ? data : r));
      closeEdit();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このレコードを削除しますか？")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/attendance/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除に失敗しました");
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  };

  // 集計
  const totalLesson = records.reduce((s, r) => s + lessonOf(r), 0);
  const totalMt     = records.reduce((s, r) => s + mtOf(r), 0);
  const workDays    = new Set(records.map((r) => r.work_date)).size;

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="mb-6 text-center">
        <div className="text-4xl mb-2">🌻</div>
        <h1 className="text-2xl font-bold text-blue-700">自分の勤務記録</h1>
        <p className="text-sm text-gray-500 mt-1">ジラソーレ</p>
      </div>

      {/* スタッフ選択 */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-1">名前を選んでください</label>
        <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">選択してください</option>
          {STAFF_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {/* 月セレクター */}
      {selectedStaff && (
        <div className="flex items-center justify-center gap-4 mb-6">
          <button onClick={prevMonth} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-600">◀</button>
          <span className="text-lg font-bold text-gray-800 min-w-[110px] text-center">{year}年{month}月</span>
          <button onClick={nextMonth} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-600">▶</button>
        </div>
      )}

      {loading && <div className="text-center py-8 text-gray-400">読み込み中...</div>}

      {!loading && selectedStaff && (
        <>
          {/* 月間サマリー */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-4 mb-6">
            <p className="text-sm font-semibold text-blue-700 mb-3">{year}年{month}月の集計</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-500">レッスン</p>
                <p className="text-2xl font-bold text-blue-800">{totalLesson}</p>
                <p className="text-xs text-gray-400">コマ</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">MT</p>
                <p className="text-2xl font-bold text-amber-700">{totalMt}</p>
                <p className="text-xs text-gray-400">コマ</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">勤務日数</p>
                <p className="text-2xl font-bold text-gray-800">{workDays}</p>
                <p className="text-xs text-gray-400">日</p>
              </div>
            </div>
          </div>

          {/* レコード一覧 */}
          {records.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">
              この月の記録はありません
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((r) => {
                const lesson = lessonOf(r);
                const mt     = mtOf(r);
                return (
                  <div key={r.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-800">{formatDate(r.work_date)}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r.facility_name}</span>
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{getLessonLabel(r.lesson_type)}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
                          {r.slots_60      > 0 && <span>60分：<b>{r.slots_60}</b></span>}
                          {r.slots_60_sub  > 0 && <span>代行60分：<b>{r.slots_60_sub}</b></span>}
                          {r.slots_90      > 0 && <span>90分：<b>{r.slots_90}</b></span>}
                          {r.slots_special > 0 && <span>特種：<b>{r.slots_special}</b></span>}
                          {r.slots_mt      > 0 && <span className="text-amber-600">MT：<b>{r.slots_mt}</b></span>}
                          {r.slots_mt_sub  > 0 && <span className="text-amber-600">代行MT：<b>{r.slots_mt_sub}</b></span>}
                          <span className="font-semibold text-blue-600">合計：{lesson + mt}コマ</span>
                        </div>
                        {r.memo && <p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">{r.memo}</p>}
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button onClick={() => openEdit(r)}
                          className="text-xs text-blue-500 hover:text-blue-700 border border-blue-200 rounded-lg px-2 py-1">
                          修正
                        </button>
                        <button onClick={() => handleDelete(r.id)} disabled={deletingId === r.id}
                          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 border border-red-200 rounded-lg px-2 py-1">
                          {deletingId === r.id ? "削除中" : "削除"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="mt-8 text-center">
        <a href="/" className="text-sm text-gray-400 hover:text-gray-600 underline">入力画面へ戻る</a>
      </div>

      {/* 修正モーダル */}
      {editTarget && editForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">記録を修正する</h2>
              <button onClick={closeEdit} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            {saveError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-lg text-red-600 text-sm">{saveError}</div>
            )}

            <div className="space-y-4">
              {/* 日付 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">日付</label>
                <input type="date" name="work_date" value={editForm.work_date} onChange={handleEditChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>

              {/* 勤務場所 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">勤務場所</label>
                <select name="facility_name" value={editForm.facility_name} onChange={handleEditChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">選択してください</option>
                  {FACILITY_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              {/* 業務種別 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">業務種別</label>
                <div className="grid grid-cols-3 gap-2">
                  {LESSON_TYPES.map((type) => (
                    <label key={type.value}
                      className={`flex items-center justify-center border rounded-xl px-3 py-2 cursor-pointer text-sm font-medium transition-colors ${
                        editForm.lesson_type === type.value
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-gray-300 bg-white text-gray-700"
                      }`}>
                      <input type="radio" name="lesson_type" value={type.value}
                        checked={editForm.lesson_type === type.value} onChange={handleEditChange} className="sr-only" />
                      {type.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* コマ数 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">コマ数</label>
                <div className="space-y-2">
                  {SLOT_TYPES.map((slot) => (
                    <div key={slot.key}
                      className="flex items-center justify-between border border-gray-300 rounded-xl px-4 py-2 bg-white">
                      <span className="text-sm font-medium text-gray-700 w-36">{slot.label}</span>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => handleEditSlot(slot.key, -1)}
                          className="w-8 h-8 rounded-full border border-gray-300 text-gray-600 font-bold flex items-center justify-center hover:bg-gray-100">−</button>
                        <span className="text-lg font-bold text-gray-800 w-5 text-center">{editForm[slot.key]}</span>
                        <button type="button" onClick={() => handleEditSlot(slot.key, 1)}
                          className="w-8 h-8 rounded-full border border-blue-400 text-blue-600 font-bold flex items-center justify-center hover:bg-blue-50">＋</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* メモ */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">メモ</label>
                <textarea name="memo" value={editForm.memo} onChange={handleEditChange} rows={4}
                  placeholder={`代行元のコーチ名前\n\n本数変更があった場合の理由\n\nその他、特記事項があれば記入してください`}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={closeEdit}
                className="flex-1 border border-gray-300 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50">
                キャンセル
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3 rounded-xl transition-colors">
                {saving ? "保存中..." : "保存する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
