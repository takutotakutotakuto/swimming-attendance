"use client";

import { useState, useEffect, useCallback } from "react";
import { FACILITY_NAMES, STAFF_NAMES, LESSON_TYPES, SLOT_TYPES, SEPARATE_FACILITIES, PT_FACILITY } from "@/config/settings";
import type { AttendanceRecord } from "@/types";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const dow = WEEKDAYS[new Date(Number(y), Number(m) - 1, Number(d)).getDay()];
  return `${y}年${m}月${d}日（${dow}）`;
}

function getLessonLabel(value: string): string {
  return LESSON_TYPES.find((t) => t.value === value)?.label ?? value;
}

function lessonOf(r: AttendanceRecord): number {
  return r.slots_60 + r.slots_60_sub + r.slots_90; // 特種レッスンは含まない
}
function specialOf(r: AttendanceRecord): number {
  return r.slots_special;
}
function mtOf(r: AttendanceRecord): number {
  return r.slots_mt + r.slots_mt_sub;
}

function toCSV(records: AttendanceRecord[]): string {
  const header = ["日付","スタッフ名","勤務場所","業務種別",
    ...SLOT_TYPES.map((t) => t.label), "レッスン計","特種計","MT計","合計","メモ"].join(",");
  const rows = records.map((r) => [
    r.work_date, r.staff_name, r.facility_name, getLessonLabel(r.lesson_type),
    r.slots_60, r.slots_60_sub, r.slots_90, r.slots_special, r.slots_mt, r.slots_mt_sub,
    lessonOf(r), specialOf(r), mtOf(r), lessonOf(r) + specialOf(r) + mtOf(r),
    `"${(r.memo ?? "").replace(/"/g, '""')}"`,
  ].join(","));
  return [header, ...rows].join("\n");
}

type ViewMode = "staff" | "facility";

interface ColData {
  lesson: number; special: number; mt: number;
  slots_60: number; slots_90: number; // PT用
}
interface SummaryRow {
  name: string;
  byCol: Record<string, ColData>;
  totalLesson: number;
  totalSpecial: number;
  totalMt: number;
  workDays: number;
  separateDays: Record<string, number>;
}

// 給与計算期間: 前月26日〜当月25日
// 「〇月分」= その月の26日までが締め日
function getInitialPeriod() {
  const now = new Date();
  const d = now.getDate();
  // 26日以降は翌月分
  if (d >= 26) {
    const m = now.getMonth() + 2; // 来月
    if (m > 12) return { year: now.getFullYear() + 1, month: 1 };
    return { year: now.getFullYear(), month: m };
  }
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function getPeriodDates(year: number, month: number) {
  // 前月26日
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const dateFrom  = `${prevYear}-${String(prevMonth).padStart(2, "0")}-26`;
  // 当月25日
  const dateTo    = `${year}-${String(month).padStart(2, "0")}-25`;
  return { dateFrom, dateTo };
}

export default function AdminPage() {
  const init = getInitialPeriod();
  const [year, setYear]               = useState(init.year);
  const [month, setMonth]             = useState(init.month);
  const [facilityFilter, setFacilityFilter] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [viewMode, setViewMode]       = useState<ViewMode>("staff");
  const [records, setRecords]         = useState<AttendanceRecord[]>([]);
  const [loading, setLoading]         = useState(true);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { dateFrom, dateTo } = getPeriodDates(year, month);
    const params = new URLSearchParams({ dateFrom, dateTo });
    if (facilityFilter) params.set("facility", facilityFilter);
    if (staffFilter)    params.set("staff", staffFilter);
    try {
      const res = await fetch(`/api/attendance?${params}`);
      if (!res.ok) throw new Error("データの取得に失敗しました");
      const { data } = await res.json();
      setRecords(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [year, month, facilityFilter, staffFilter]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

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

  const handleCSV = () => {
    const blob = new Blob(["\uFEFF" + toCSV(records)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ジラソーレ勤怠_${year}年${month}月分.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const prevMonth = () => { if (month === 1) { setYear((y) => y - 1); setMonth(12); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear((y) => y + 1); setMonth(1); } else setMonth((m) => m + 1); };

  // ---- 集計 ----
  const emptyCol = (): ColData => ({ lesson: 0, special: 0, mt: 0, slots_60: 0, slots_90: 0 });
  const buildSummary = (groupKey: "staff_name" | "facility_name"): SummaryRow[] => {
    type Entry = { byCol: Record<string, ColData>; dates: Set<string>; sepDates: Record<string, Set<string>> };
    const map: Record<string, Entry> = {};
    for (const r of records) {
      const key    = r[groupKey];
      const colKey = groupKey === "staff_name" ? r.facility_name : r.staff_name;
      if (!map[key]) map[key] = { byCol: {}, dates: new Set(), sepDates: {} };
      if (!map[key].byCol[colKey]) map[key].byCol[colKey] = emptyCol();
      map[key].byCol[colKey].lesson   += lessonOf(r);
      map[key].byCol[colKey].special  += specialOf(r);
      map[key].byCol[colKey].mt       += mtOf(r);
      map[key].byCol[colKey].slots_60 += r.slots_60;
      map[key].byCol[colKey].slots_90 += r.slots_90;
      if ((SEPARATE_FACILITIES as readonly string[]).includes(r.facility_name)) {
        if (!map[key].sepDates[r.facility_name]) map[key].sepDates[r.facility_name] = new Set();
        map[key].sepDates[r.facility_name].add(r.work_date);
      } else {
        map[key].dates.add(r.work_date);
      }
    }
    return Object.entries(map).map(([name, v]) => ({
      name,
      byCol: v.byCol,
      totalLesson:  Object.values(v.byCol).reduce((s, x) => s + x.lesson, 0),
      totalSpecial: Object.values(v.byCol).reduce((s, x) => s + x.special, 0),
      totalMt:      Object.values(v.byCol).reduce((s, x) => s + x.mt, 0),
      workDays:     v.dates.size,
      separateDays: Object.fromEntries(Object.entries(v.sepDates).map(([f, s]) => [f, s.size])),
    })).sort((a, b) => (b.totalLesson + b.totalSpecial + b.totalMt) - (a.totalLesson + a.totalSpecial + a.totalMt));
  };

  const staffSummary    = buildSummary("staff_name");
  const facilitySummary = buildSummary("facility_name");
  const colKeys = viewMode === "staff" ? FACILITY_NAMES : STAFF_NAMES;
  const rows    = viewMode === "staff" ? staffSummary : facilitySummary;
  const grandLesson  = rows.reduce((s, r) => s + r.totalLesson, 0);
  const grandSpecial = rows.reduce((s, r) => s + r.totalSpecial, 0);
  const grandMt      = rows.reduce((s, r) => s + r.totalMt, 0);

  // 別カウント施設列はスタッフ別のみ表示
  const YURIKAGO = "ゆりかご幼稚園";
  // 通常施設：ゆりかごとPT以外
  const regularColKeys = viewMode === "staff"
    ? FACILITY_NAMES.filter(f => f !== PT_FACILITY && f !== YURIKAGO)
    : STAFF_NAMES;
  const isStaffView = viewMode === "staff";

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">管理者ダッシュボード</h1>
          <p className="text-sm text-gray-500 mt-1">ジラソーレ 勤怠管理</p>
        </div>
        <a href="/" className="text-sm text-blue-600 hover:underline border border-blue-300 rounded-lg px-3 py-2">
          入力画面へ
        </a>
      </div>

      {/* 月セレクター */}
      <div className="flex items-center gap-4 mb-2">
        <button onClick={prevMonth} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-600">◀</button>
        <span className="text-xl font-bold text-gray-800 min-w-[140px] text-center">{year}年{month}月分</span>
        <button onClick={nextMonth} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-600">▶</button>
      </div>
      {/* 集計期間表示 */}
      {(() => {
        const { dateFrom, dateTo } = getPeriodDates(year, month);
        const [fy, fm, fd] = dateFrom.split("-");
        const [ty, tm, td] = dateTo.split("-");
        return (
          <p className="text-xs text-gray-400 mb-6 text-center">
            集計期間：{fy}年{fm}月{fd}日 〜 {ty}年{tm}月{td}日
          </p>
        );
      })()}

      {/* フィルター */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">全スタッフ</option>
          {STAFF_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={facilityFilter} onChange={(e) => setFacilityFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">全施設</option>
          {FACILITY_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button onClick={handleCSV} disabled={records.length === 0}
          className="ml-auto bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          CSV出力
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-lg text-red-600 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-16 text-gray-400">読み込み中...</div>
      ) : (
        <>
          {/* 集計テーブル */}
          <section className="mb-8">
            <div className="flex gap-2 mb-3">
              {(["staff", "facility"] as ViewMode[]).map((mode) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    viewMode === mode ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}>
                  {mode === "staff" ? "スタッフ別" : "施設別"}
                </button>
              ))}
            </div>

            {rows.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">
                この期間の記録はありません
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                <table className="text-sm w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    {/* 1行目 */}
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-900 sticky left-0 bg-gray-50 min-w-[72px]">
                        {viewMode === "staff" ? "スタッフ" : "施設"}
                      </th>
                      {regularColKeys.map((key) => (
                        <th key={key} colSpan={3} className="text-center px-2 py-2 font-semibold text-gray-900 border-l border-gray-200 whitespace-nowrap">{key}</th>
                      ))}
                      <th colSpan={3} className="text-center px-2 py-2 font-semibold text-gray-900 border-l border-gray-300">合計</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-900 border-l border-gray-200 whitespace-nowrap">勤務日数</th>
                      {isStaffView && (
                        <th colSpan={2} className="text-center px-2 py-2 font-semibold text-gray-900 border-l border-gray-200 whitespace-nowrap">ゆりかご幼稚園</th>
                      )}
                      {isStaffView && (
                        <th colSpan={2} className="text-center px-2 py-2 font-semibold text-gray-900 border-l border-gray-200 whitespace-nowrap">その他（PT）</th>
                      )}
                    </tr>
                    {/* 2行目 */}
                    <tr className="border-b border-gray-200">
                      <th className="sticky left-0 bg-gray-50"></th>
                      {regularColKeys.map((key) => (
                        <>
                          <th key={key+"-l"} className="text-center px-2 py-1 text-xs text-blue-600 font-medium border-l border-gray-100">レッスン</th>
                          <th key={key+"-m"} className="text-center px-2 py-1 text-xs text-amber-600 font-medium">MT</th>
                          <th key={key+"-s"} className="text-center px-2 py-1 text-xs text-purple-600 font-medium">特</th>
                        </>
                      ))}
                      <th className="text-center px-2 py-1 text-xs text-blue-600 font-medium border-l border-gray-300">レッスン</th>
                      <th className="text-center px-2 py-1 text-xs text-amber-600 font-medium">MT</th>
                      <th className="text-center px-2 py-1 text-xs text-purple-600 font-medium">特</th>
                      <th className="border-l border-gray-200"></th>
                      {isStaffView && (
                        <>
                          <th className="text-center px-2 py-1 text-xs text-blue-600 font-medium border-l border-gray-200">レッスン</th>
                          <th className="text-center px-2 py-1 text-xs text-green-700 font-medium">日数</th>
                          <th className="text-center px-2 py-1 text-xs text-blue-600 font-medium border-l border-gray-200">60分</th>
                          <th className="text-center px-2 py-1 text-xs text-blue-600 font-medium">90分</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const yk   = row.byCol[YURIKAGO];
                      const pt   = row.byCol[PT_FACILITY];
                      const ykDays = row.separateDays[YURIKAGO] ?? 0;
                      return (
                        <tr key={row.name} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900 sticky left-0 bg-white whitespace-nowrap">{row.name}</td>
                          {regularColKeys.map((key) => {
                            const cell = row.byCol[key];
                            return (
                              <>
                                <td key={key+"-l"} className="text-center px-2 py-3 text-blue-700 border-l border-gray-100">{cell?.lesson || <span className="text-gray-300">—</span>}</td>
                                <td key={key+"-m"} className="text-center px-2 py-3 text-amber-600">{cell?.mt || <span className="text-gray-300">—</span>}</td>
                                <td key={key+"-s"} className="text-center px-2 py-3 text-purple-600">{cell?.special || <span className="text-gray-300">—</span>}</td>
                              </>
                            );
                          })}
                          <td className="text-center px-2 py-3 font-bold text-blue-700 border-l border-gray-300">{row.totalLesson || <span className="text-gray-300">—</span>}</td>
                          <td className="text-center px-2 py-3 font-bold text-amber-600">{row.totalMt || <span className="text-gray-300">—</span>}</td>
                          <td className="text-center px-2 py-3 font-bold text-purple-600">{row.totalSpecial || <span className="text-gray-300">—</span>}</td>
                          <td className="text-center px-3 py-3 text-green-700 font-medium border-l border-gray-200">
                            {row.workDays > 0 ? `${row.workDays}日` : <span className="text-gray-300">—</span>}
                          </td>
                          {isStaffView && (
                            <>
                              <td className="text-center px-2 py-3 text-blue-700 border-l border-gray-200">{yk?.lesson || <span className="text-gray-300">—</span>}</td>
                              <td className="text-center px-2 py-3 text-green-700 font-medium">{ykDays > 0 ? `${ykDays}日` : <span className="text-gray-300">—</span>}</td>
                              <td className="text-center px-2 py-3 text-blue-700 border-l border-gray-200">{pt?.slots_60 || <span className="text-gray-300">—</span>}</td>
                              <td className="text-center px-2 py-3 text-blue-700">{pt?.slots_90 || <span className="text-gray-300">—</span>}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                    {/* 合計行 */}
                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                      <td className="px-4 py-3 text-gray-900 sticky left-0 bg-gray-100">合計</td>
                      {regularColKeys.map((key) => {
                        const colL = rows.reduce((s, r) => s + (r.byCol[key]?.lesson  ?? 0), 0);
                        const colM = rows.reduce((s, r) => s + (r.byCol[key]?.mt      ?? 0), 0);
                        const colS = rows.reduce((s, r) => s + (r.byCol[key]?.special ?? 0), 0);
                        return (
                          <>
                            <td key={key+"-l"} className="text-center px-2 py-3 text-blue-700 border-l border-gray-200">{colL || "—"}</td>
                            <td key={key+"-m"} className="text-center px-2 py-3 text-amber-600">{colM || "—"}</td>
                            <td key={key+"-s"} className="text-center px-2 py-3 text-purple-600">{colS || "—"}</td>
                          </>
                        );
                      })}
                      <td className="text-center px-2 py-3 text-blue-700 border-l border-gray-300">{grandLesson || "—"}</td>
                      <td className="text-center px-2 py-3 text-amber-600">{grandMt || "—"}</td>
                      <td className="text-center px-2 py-3 text-purple-600">{grandSpecial || "—"}</td>
                      <td className="text-center px-3 py-3 text-gray-400 border-l border-gray-200">—</td>
                      {isStaffView && (() => {
                        const ykL  = rows.reduce((s, r) => s + (r.byCol[YURIKAGO]?.lesson  ?? 0), 0);
                        const pt60 = rows.reduce((s, r) => s + (r.byCol[PT_FACILITY]?.slots_60 ?? 0), 0);
                        const pt90 = rows.reduce((s, r) => s + (r.byCol[PT_FACILITY]?.slots_90 ?? 0), 0);
                        return (
                          <>
                            <td className="text-center px-2 py-3 text-blue-700 border-l border-gray-200">{ykL || "—"}</td>
                            <td className="text-center px-2 py-3 text-gray-400">—</td>
                            <td className="text-center px-2 py-3 text-blue-700 border-l border-gray-200">{pt60 || "—"}</td>
                            <td className="text-center px-2 py-3 text-blue-700">{pt90 || "—"}</td>
                          </>
                        );
                      })()}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 全レコード一覧 */}
          <section>
            <h2 className="text-lg font-bold text-gray-700 mb-3">全レコード一覧</h2>
            {records.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">
                この期間・条件の記録はありません
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
                            <span className="font-semibold text-gray-800">{r.staff_name}</span>
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r.facility_name}</span>
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{getLessonLabel(r.lesson_type)}</span>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">計{lesson + mt}コマ</span>
                          </div>
                          <div className="text-sm text-gray-500 mb-1">{formatDate(r.work_date)}</div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                            {r.slots_60      > 0 && <span className="text-blue-700">60分：<b>{r.slots_60}</b></span>}
                            {r.slots_60_sub  > 0 && <span className="text-blue-700">代行60分：<b>{r.slots_60_sub}</b></span>}
                            {r.slots_90      > 0 && <span className="text-blue-700">90分：<b>{r.slots_90}</b></span>}
                            {r.slots_special > 0 && <span className="text-purple-600">特種：<b>{r.slots_special}</b></span>}
                            {r.slots_mt      > 0 && <span className="text-amber-600">MT：<b>{r.slots_mt}</b></span>}
                            {r.slots_mt_sub  > 0 && <span className="text-amber-600">代行MT：<b>{r.slots_mt_sub}</b></span>}
                          </div>
                          {/* メモを赤字で表示 */}
                          {r.memo && (
                            <p className="text-xs text-red-600 mt-1 whitespace-pre-wrap">{r.memo}</p>
                          )}
                        </div>
                        <button onClick={() => handleDelete(r.id)} disabled={deletingId === r.id}
                          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 border border-red-200 rounded-lg px-2 py-1 flex-shrink-0 transition-colors">
                          {deletingId === r.id ? "削除中" : "削除"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
