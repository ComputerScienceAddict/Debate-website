"use client";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body className="antialiased">
        <main className="flex min-h-screen items-center justify-center bg-[#f8f7f4] px-6 text-[#121212]">
          <div className="w-full max-w-md rounded-xl border border-zinc-300 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-bold">Critical app error</h1>
            <p className="mt-2 text-sm text-zinc-600">
              {error.message || "A global error occurred."}
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-5 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Reload app
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
