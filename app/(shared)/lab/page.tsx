"use client";

import { Button } from "@gorth-com/primitive/custom/button";
import { useAuth } from "@/hooks/use-auth";
import { useLabAuthQuery } from "@/queries/lab";
import { Spinner } from "@gorth-com/primitive/pattern/spinner";

export default function LabPage() {
  const { authenticated, loading, signingIn, login } = useAuth();
  const query = useLabAuthQuery(authenticated);
  const result = query.data ?? query.error?.message ?? null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">SSO token verification lab</h1>
        <p className="text-muted-foreground text-sm">
          App server nhận token, gửi sang SSO xác thực và trả về claims an toàn.
        </p>
      </section>

      {!loading && !authenticated ? (
        <Button
          disabled={signingIn}
          aria-busy={signingIn}
          onClick={() => login("/lab")}
        >
          Sign in with SSO
        </Button>
      ) : null}

      <Button
        variant="outline"
        onClick={() => void query.refetch()}
        disabled={query.isFetching || !authenticated}
      >
        {query.isFetching ? (
          <Spinner variant="infinite" size={16} />
        ) : (
          "Verify access token"
        )}
      </Button>

      <pre className="bg-muted max-h-[32rem] overflow-auto rounded-md border p-4 text-xs">
        {JSON.stringify(result, null, 2)}
      </pre>
    </main>
  );
}
