import type { Metadata } from "next";
import "./globals.css";
import { EditorProvider } from "./contexts/EditorContext";

export const metadata: Metadata = {
  title: "AI Context Editor",
  description: "可视化编辑AI对话上下文",
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
