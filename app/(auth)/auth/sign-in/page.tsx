"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import InternalServerErrorPage from "@gorth-com/primitive/pages/internal-server-error";
import { LoadingScreen } from "@/features/shared/loading";
import { useAuth } from "@/hooks/use-auth";

export default function Page() {
  const router = useRouter();
  const { authenticated, loading, signingIn, error, login } = useAuth();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (loading || error || failed) return;
    if (authenticated) {
      router.replace("/");
      return;
    }
    if (started.current || signingIn) return;
    started.current = true;
    async function start() {
      try {
        await login("/");
      } catch {
        setFailed(true);
      }
    }
    void start();
  }, [authenticated, loading, signingIn, error, failed, login, router]);

  if (error || failed) return <InternalServerErrorPage />;

  return <LoadingScreen />;
}
