"use client";

import { signOut } from "next-auth/react";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
}

export function AppHeader({ title, subtitle }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{title}</h1>
          {subtitle && (
            <p className="text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 active:bg-slate-100"
        >
          Salir
        </button>
      </div>
    </header>
  );
}

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_PROGRESO: "En progreso",
  PAUSADA: "Pausada",
  EN_PROCESO: "En proceso",
  COMPLETADA: "Finalizada",
  ABIERTO: "Abierto",
  CERRADO: "Cerrado",
};

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: "bg-slate-100 text-slate-600",
  EN_PROGRESO: "bg-amber-100 text-amber-800",
  PAUSADA: "bg-blue-100 text-blue-800",
  EN_PROCESO: "bg-amber-100 text-amber-800",
  COMPLETADA: "bg-green-100 text-green-800",
  ABIERTO: "bg-green-100 text-green-800",
  CERRADO: "bg-slate-200 text-slate-600",
};

export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTADO_COLORS[estado] ?? "bg-slate-100 text-slate-700"}`}
    >
      {ESTADO_LABELS[estado] ?? estado}
    </span>
  );
}
