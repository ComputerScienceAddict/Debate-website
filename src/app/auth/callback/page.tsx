"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/** Email confirmation links land here (?code for PKCE, or implicit tokens in fragment). */
function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createClient();

    async function finish() {
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        router.replace(error ? "/" : "/");
        return;
      }

      for (let i = 0; i < 5; i++) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          router.replace("/");
          return;
        }
        await new Promise((r) => setTimeout(r, 120 * (i + 1)));
      }
      router.replace("/");
    }

    void finish();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 text-sm text-gray-600">
      Signing you in…
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-gray-600">
          Loading…
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
