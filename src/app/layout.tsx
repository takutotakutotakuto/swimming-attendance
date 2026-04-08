import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ジラソーレ 勤怠管理",
  description: "スタッフの勤怠を記録・管理するアプリです",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
