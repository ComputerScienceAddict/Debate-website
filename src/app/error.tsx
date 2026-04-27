"use client";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f7f4] px-6 text-[#121212]">
      <div className="w-full max-w-md rounded-xl border border-zinc-300 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
