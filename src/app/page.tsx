"use client";

import { useState, forwardRef } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale/ja";
import "react-datepicker/dist/react-datepicker.css";
import { STAFF_NAMES, FACILITY_NAMES, LESSON_TYPES, SLOT_TYPES, SlotKey } from "@/config/settings";
import type { AttendanceFormData } from "@/types";

registerLocale("ja", ja);

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function formatDateJa(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  const dow = WEEKDAYS[new Date(Number(y), Number(m) - 1, Number(d)).getDay()];
  return `${y}年${Number(m)}月${Number(d)}日（${dow}）`;
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

// カスタム日付入力（今のデザインをそのまま維持）
interface CustomDateInputProps {
  dateStr: string;
  value?: string;
  onClick?: () => void;
}
const CustomDateInput = forwardRef<HTMLDivElement, CustomDateInputProps>(
  ({ onClick, dateStr }, ref) => (
    <div
      ref={ref}
      onClick={onClick}
      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base bg-white cursor-pointer"
    >
      {dateStr
        ? <span className="text-gray-800">{dateStr}</span>
        : <span className="text-gray-400">日付を選択</span>
      }
    </div>
  )
);
CustomDateInput.displayName = "CustomDateInput";

const initialForm: AttendanceFormData = {
  staff_name: "",
  work_date: getTodayDate(),
  facility_name: "",
  lesson_type: "",
  slots_60: 0,
  slots_60_sub: 0,
  slots_90: 0,
  slots_special: 0,
  slots_mt: 0,
  slots_mt_sub: 0,
  memo: "",
};

export default function StaffInputPage() {
  const [form, setForm] = useState<AttendanceFormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSlot = (key: SlotKey, delta: number) => {
    setForm((prev) => ({
      ...prev,
      [key]: Math.max(0, (prev[key] as number) + delta),
    }));
  };

  const totalSlots = SLOT_TYPES.reduce((s, t) => s + (form[t.key] as number), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.staff_name)    return setError("スタッフ名を選択してください");
    if (!form.work_date)     return setError("日付を入力してください");
    if (!form.facility_name) return setError("勤務場所を選択してください");
    if (!form.lesson_type)   return setError("業務種別を選択してください");
    if (totalSlots === 0)    return setError("コマ数を1つ以上入力してください");

    setSubmitting(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "送信に失敗しました");
      }
      setSuccess(true);
      setForm({ ...initialForm, work_date: getTodayDate() });
      setTimeout(() => setSuccess(false), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="mb-8 text-center">
        <div className="text-4xl mb-2">🌻</div>
        <h1 className="text-2xl font-bold text-blue-700">勤怠入力</h1>
        <p className="text-sm text-gray-500 mt-1">ジラソーレ</p>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-300 rounded-xl text-center">
          <div className="text-2xl mb-1">✅</div>
          <p className="text-green-700 font-semibold text-lg">記録しました！</p>
          <p className="text-green-600 text-sm mt-1">勤怠情報が正常に保存されました</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* スタッフ名 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            スタッフ名 <span className="text-red-500">*</span>
          </label>
          <select name="staff_name" value={form.staff_name} onChange={handleChange}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">選択してください</option>
            {STAFF_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* 日付（月曜始まりカレンダー・今のデザイン） */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            日付 <span className="text-red-500">*</span>
          </label>
          <DatePicker
            locale="ja"
            calendarStartDay={1}
            selected={form.work_date ? new Date(form.work_date + "T00:00:00") : null}
            onChange={(date: Date | null) => {
              if (date) {
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, "0");
                const d = String(date.getDate()).padStart(2, "0");
                setForm((prev) => ({ ...prev, work_date: `${y}-${m}-${d}` }));
              }
            }}
            customInput={<CustomDateInput dateStr={formatDateJa(form.work_date)} />}
            wrapperClassName="w-full"
            renderCustomHeader={({ date, decreaseMonth, increaseMonth }) => (
              <div className="flex items-center justify-between px-3 py-1">
                <button onClick={decreaseMonth} className="text-white text-lg font-bold px-2 hover:opacity-70">‹</button>
                <span className="text-white font-bold text-base">
                  {date.getFullYear()}年{date.getMonth() + 1}月
                </span>
                <button onClick={increaseMonth} className="text-white text-lg font-bold px-2 hover:opacity-70">›</button>
              </div>
            )}
          />
        </div>

        {/* 勤務場所 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            勤務場所 <span className="text-red-500">*</span>
          </label>
          <select name="facility_name" value={form.facility_name} onChange={handleChange}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">選択してください</option>
            {FACILITY_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* 業務種別 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            業務種別 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {LESSON_TYPES.map((type) => (
              <label key={type.value}
                className={`flex items-center justify-center border rounded-xl px-3 py-3 cursor-pointer transition-colors text-sm font-medium ${
                  form.lesson_type === type.value
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-blue-400"
                }`}>
                <input type="radio" name="lesson_type" value={type.value}
                  checked={form.lesson_type === type.value} onChange={handleChange} className="sr-only" />
                {type.label}
              </label>
            ))}
          </div>
        </div>

        {/* コマ数入力 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            コマ数 <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {SLOT_TYPES.map((slot) => (
              <div key={slot.key}
                className="flex items-center justify-between border border-gray-300 rounded-xl px-4 py-3 bg-white">
                <span className="text-sm font-medium text-gray-700 w-36">{slot.label}</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => handleSlot(slot.key, -1)}
                    className="w-9 h-9 rounded-full border border-gray-300 text-gray-600 text-lg font-bold flex items-center justify-center hover:bg-gray-100">
                    −
                  </button>
                  <span className="text-xl font-bold text-gray-800 w-6 text-center">{form[slot.key]}</span>
                  <button type="button" onClick={() => handleSlot(slot.key, 1)}
                    className="w-9 h-9 rounded-full border border-blue-400 text-blue-600 text-lg font-bold flex items-center justify-center hover:bg-blue-50">
                    ＋
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* メモ */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            メモ（任意）
          </label>
          <textarea name="memo" value={form.memo} onChange={handleChange} rows={5}
            placeholder={`代行元のコーチ名前\n\n本数変更があった場合の理由\n\nその他、特記事項があれば記入してください`}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
        </div>

        {/* 送信ボタン */}
        <button type="submit" disabled={submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-4 rounded-xl text-lg transition-colors">
          {submitting ? "送信中..." : "記録する"}
        </button>

        {/* エラーメッセージ（ボタンの下） */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-red-600 text-sm text-center">
            {error}
          </div>
        )}
      </form>

      {/* 自分の記録へのリンク（目立つボタン） */}
      <div className="mt-8">
        <a href="/my-records"
          className="flex items-center justify-center gap-2 w-full bg-white border-2 border-blue-400 text-blue-600 font-bold py-4 rounded-xl text-base hover:bg-blue-50 transition-colors">
          📋 自分の勤務記録を確認・修正する
        </a>
      </div>
    </main>
  );
}
