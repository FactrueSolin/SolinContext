import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { EditorProvider } from "./contexts/EditorContext";

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
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
      <Script
        src="https://umami.cd.actrue.cn/script.js"
        data-website-id="26bb8f34-b62a-4725-8a4e-51c159b5bd9e"
        strategy="afterInteractive"
      />
    </html>
  );
}
