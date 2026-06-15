"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      username: username.trim().toLowerCase(),
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Usuario o contraseña incorrectos");
      return;
    }

    const sessionRes = await fetch("/api/auth/session");
    const session = await sessionRes.json();

    if (session?.user?.role === "SUPERVISOR") {
      router.push("/supervisor");
    } else {
      router.push("/tomador");
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">
          Usuario
        </label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
          placeholder="nombre.usuario"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-blue-600 py-4 text-base font-semibold text-white shadow-sm active:bg-blue-700 disabled:opacity-60"
      >
        {loading ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
