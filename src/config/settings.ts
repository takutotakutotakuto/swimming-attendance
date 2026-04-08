// ==============================
// ここを編集してリストを変更できます
// ==============================

// スタッフ名リスト
export const STAFF_NAMES: string[] = [
  "秋葉",
  "米野",
  "西山",
  "中川",
  "岡崎",
  "田中",
  "三浦",
  "多田",
];

// 施設名リスト
export const FACILITY_NAMES: string[] = [
  "東武練馬",
  "大泉学園",
  "東京体育館",
  "ゆりかご幼稚園",
  "その他（PT）",
];

// 勤務日数を他の施設と合算しない施設（別列でカウント）
export const SEPARATE_FACILITIES = ["ゆりかご幼稚園", "その他（PT）"] as const;

// PT施設名（集計列が異なる）
export const PT_FACILITY = "その他（PT）";

// 業務種別
export const LESSON_TYPES = [
  { value: "kids",    label: "キッズ" },
  { value: "adult",   label: "成人"   },
  { value: "private", label: "PT"     },
] as const;

export type LessonTypeValue = (typeof LESSON_TYPES)[number]["value"];

// コマ種別
export const SLOT_TYPES = [
  { key: "slots_60",      label: "60分",            isLesson: true  },
  { key: "slots_mt",      label: "MT（30分）",      isLesson: false },
  { key: "slots_60_sub",  label: "代行60分",        isLesson: true  },
  { key: "slots_mt_sub",  label: "代行MT",          isLesson: false },
  { key: "slots_special", label: "特種レッスン60分", isLesson: true  },
  { key: "slots_90",      label: "90分",            isLesson: true  },
] as const;

export type SlotKey = (typeof SLOT_TYPES)[number]["key"];
