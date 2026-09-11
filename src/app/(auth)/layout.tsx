import Link from 'next/link';

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            PRAXA
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-6 py-12 sm:py-20">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
