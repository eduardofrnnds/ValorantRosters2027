"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { editorMessages, type EditorStatus } from "./organization-model";

/** Native form fallback, enhanced to retain entered values when validation fails. */
export function EditorForm({ children, action = "/admin/manage", multipart = false, messages = editorMessages }: { children: ReactNode; action?: string; multipart?: boolean; messages?: Record<EditorStatus, string> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true); setError("");
    try {
      const body = multipart ? data : new URLSearchParams(Array.from(data, ([key, value]) => [key, String(value)]));
      const response = await fetch(action, { method: "POST", headers: { Accept: "application/json" }, body });
      if (response.redirected) { router.push("/admin/login?status=required"); return; }
      const result = await response.json() as { status: EditorStatus; destination: string };
      if (result.status === "saved" && /^\/admin\/(organizations|players|rosters|transfers)(\/|\?|$)/.test(result.destination)) {
        setPending(false); router.push(result.destination); router.refresh(); return;
      }
      setError(Object.hasOwn(messages, result.status) ? messages[result.status] : messages.unavailable);
    } catch { setError(messages.unavailable); }
    setPending(false);
  }
  return (
    <form action={action} method="post" encType={multipart ? "multipart/form-data" : "application/x-www-form-urlencoded"} onSubmit={submit}>
      <fieldset disabled={pending} className="min-w-0 space-y-5 disabled:opacity-60">{children}</fieldset>
      {pending && <p role="status" className="mt-3 text-sm text-muted-foreground">Salvando…</p>}
      {error && <p role="alert" className="mt-3 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">{error}</p>}
    </form>
  );
}
