import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIME 策略研究台 | 自然语言选股与证据解释",
  description: "从自然语言研究意图到可编辑条件与可核验数据证据。校招笔试可操作原型。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
