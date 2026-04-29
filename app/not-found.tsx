import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 py-12 text-[var(--foreground)]">
      <section className="w-full max-w-md text-center">
        <p className="text-sm font-semibold text-[var(--primary)]">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          页面不存在
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          这个地址没有对应的页面，可能已经移动或被删除。
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          返回首页
        </Link>
      </section>
    </main>
  );
}
