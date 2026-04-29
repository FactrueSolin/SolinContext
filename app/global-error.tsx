"use client";

import "./globals.css";
import Link from "next/link";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="zh-CN">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 py-12 text-[var(--foreground)]">
          <section className="w-full max-w-md text-center">
            <p className="text-sm font-semibold text-[var(--destructive)]">
              页面加载失败
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              出现了一点问题
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              请重试一次，或返回首页重新进入工作区。
            </p>
            {error.digest ? (
              <p className="mt-3 text-xs text-slate-500">
                错误编号：{error.digest}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                重试
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                返回首页
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
