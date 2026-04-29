import type { Metadata, Viewport } from "next";
import "./globals.css";
import { EditorProvider } from "./contexts/EditorContext";

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "AI Context Editor",
  description: "进入 AI Context Editor 工作区。",
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
    title: "AI Context Editor",
    description: "进入 AI Context Editor 工作区。",
    type: "website",
    siteName: "AI Context Editor",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary",
    title: "AI Context Editor",
    description: "进入 AI Context Editor 工作区。",
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
