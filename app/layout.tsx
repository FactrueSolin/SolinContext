import type { Metadata, Viewport } from "next";
import "./globals.css";
import { EditorProvider } from "./contexts/EditorContext";

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "AI Context Editor - 可视化编辑 AI 上下文",
  description:
    "可视化编辑 AI 对话上下文，支持 Anthropic 格式消息编辑、流式生成、A/B 对比等功能。轻松构建和管理 AI 对话上下文。",
  keywords: [
    "AI",
    "Context Editor",
    "AI 上下文编辑器",
    "Anthropic",
    "Claude",
    "对话编辑",
    "可视化编辑",
    "流式生成",
    "A/B 对比",
  ],
  openGraph: {
    title: "AI Context Editor - 可视化编辑 AI 上下文",
    description:
      "可视化编辑 AI 对话上下文，支持 Anthropic 格式消息编辑、流式生成、A/B 对比等功能。",
    type: "website",
    siteName: "AI Context Editor",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary",
    title: "AI Context Editor - 可视化编辑 AI 上下文",
    description:
      "可视化编辑 AI 对话上下文，支持 Anthropic 格式消息编辑、流式生成、A/B 对比等功能。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <EditorProvider>
          {children}
        </EditorProvider>
      </body>
    </html>
  );
}
