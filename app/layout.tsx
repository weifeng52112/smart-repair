import type { Metadata } from "next";
import "./globals.css";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "智能报修小助手",
  description: "填一张报修单，AI 立刻给出自助排查建议。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased">
        <PageHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-24 pt-8">{children}</main>
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
          智能报修小助手 · 协同开发实训项目
        </footer>
      </body>
    </html>
  );
}
