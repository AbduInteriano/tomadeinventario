"use client";

import { useMemo, useState } from "react";
import { FlashMessage } from "@/components/FlashMessage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Role } from "@prisma/client";
import {
  isAdminTecnologia,
  puedeEditarUsuario,
  puedeRestablecerPassword,
  roleLabel,
  rolesAsignablesPorSupervisor,
} from "@/lib/roles";

export interface UsuarioItem {
  id: string;
  nombre: string;
  username: string;
  role: Role;
  activo: boolean;
}

interface UsuariosClientProps {
  initialUsuarios: UsuarioItem[];
  currentUserId: string;
  currentUserRole: Role;
}

type Flash = { type: "success" | "error"; message: string } | null;

function RoleBadge({ role }: { role: Role }) {
  const styles =
    role === Role.ADMIN_TECNOLOGIA
      ? "bg-purple-100 text-purple-800"
      : role === Role.SUPERVISOR
        ? "bg-blue-100 text-blue-800"
        : "bg-slate-100 text-slate-600";

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${styles}`}>
      {roleLabel(role)}
    </span>
  );
}

const emptyCreate = {
  username: "",
  password: "",
  role: Role.TOMADOR as Role,
};

export function UsuariosClient({
  initialUsuarios,
  currentUserId,
  currentUserRole,
}: UsuariosClientProps) {
  const [usuarios, setUsuarios] = useState(initialUsuarios);
  const [flash, setFlash] = useState<Flash>(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    username: "",
    role: Role.TOMADOR as Role,
    restablecerPassword: false,
    nuevaPassword: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<UsuarioItem | null>(null);
  const [showInactivos, setShowInactivos] = useState(false);

  const isAdmin = isAdminTecnologia(currentUserRole);
  const rolesCrear = isAdmin
    ? [Role.TOMADOR, Role.SUPERVISOR, Role.ADMIN_TECNOLOGIA]
    : rolesAsignablesPorSupervisor();

  const activos = useMemo(() => usuarios.filter((u) => u.activo), [usuarios]);
  const inactivos = useMemo(() => usuarios.filter((u) => !u.activo), [usuarios]);

  function puedeGestionar(u: UsuarioItem): boolean {
    return (
      puedeEditarUsuario(currentUserId, currentUserRole, {
        id: u.id,
        role: u.role,
      }) === null
    );
  }

  function puedeCambiarPassword(u: UsuarioItem): boolean {
    return (
      puedeRestablecerPassword(currentUserId, currentUserRole, {
        id: u.id,
        role: u.role,
      }) === null
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFlash(null);

    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al crear" });
      return;
    }

    setUsuarios((prev) =>
      [...prev, data].sort((a, b) => a.username.localeCompare(b.username))
    );
    setCreateForm(emptyCreate);
    setShowCreate(false);
    setFlash({ type: "success", message: "Usuario creado" });
  }

  function startEdit(u: UsuarioItem) {
    setEditingId(u.id);
    setEditForm({
      username: u.username,
      role: u.role,
      restablecerPassword: false,
      nuevaPassword: "",
    });
  }

  async function handleUpdate(id: string) {
    setLoading(true);
    setFlash(null);

    const payload: Record<string, unknown> = {
      username: editForm.username,
      role: editForm.role,
    };

    if (editForm.restablecerPassword) {
      payload.restablecerPassword = true;
      if (editForm.nuevaPassword.trim()) {
        payload.nuevaPassword = editForm.nuevaPassword.trim();
      }
    }

    const res = await fetch(`/api/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al actualizar" });
      return;
    }

    setUsuarios((prev) =>
      prev
        .map((u) =>
          u.id === id
            ? {
                id: data.id,
                nombre: data.nombre,
                username: data.username,
                role: data.role,
                activo: data.activo,
              }
            : u
        )
        .sort(
          (a, b) =>
            Number(b.activo) - Number(a.activo) || a.username.localeCompare(b.username)
        )
    );
    setEditingId(null);

    if (data.passwordGenerada) {
      setFlash({
        type: "success",
        message: `Contraseña actualizada: ${data.passwordGenerada}`,
      });
    } else {
      setFlash({ type: "success", message: "Usuario actualizado" });
    }
  }

  async function handleReactivar(id: string) {
    setLoading(true);
    const res = await fetch(`/api/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: true }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al reactivar" });
      return;
    }

    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, activo: true } : u)));
    setFlash({ type: "success", message: "Usuario reactivado" });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setLoading(true);

    const res = await fetch(`/api/usuarios/${deleteTarget.id}`, { method: "DELETE" });
    const data = await res.json();
    setLoading(false);
    setDeleteTarget(null);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al desactivar" });
      return;
    }

    if (data.softDeleted) {
      setUsuarios((prev) =>
        prev.map((u) => (u.id === deleteTarget.id ? { ...u, activo: false } : u))
      );
    } else {
      setUsuarios((prev) => prev.filter((u) => u.id !== deleteTarget.id));
    }

    setFlash({ type: "success", message: data.message ?? "Listo" });
  }

  function renderUsuario(u: UsuarioItem) {
    const isSelf = u.id === currentUserId;
    const gestionar = puedeGestionar(u);
    const cambiarPwd = puedeCambiarPassword(u);

    if (editingId === u.id) {
      return (
        <li key={u.id} className="p-4">
          <div className="space-y-3">
            <input
              value={editForm.username}
              onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
              placeholder="Usuario"
            />
            {isAdmin && u.role !== Role.ADMIN_TECNOLOGIA && (
              <select
                value={editForm.role}
                onChange={(e) =>
                  setEditForm({ ...editForm, role: e.target.value as Role })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
              >
                {rolesCrear.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            )}
            {!isAdmin && u.role === Role.TOMADOR && (
              <select
                value={editForm.role}
                onChange={(e) =>
                  setEditForm({ ...editForm, role: e.target.value as Role })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
              >
                <option value={Role.TOMADOR}>Tomador</option>
                <option value={Role.SUPERVISOR}>Supervisor</option>
              </select>
            )}
            {cambiarPwd && (
              <>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={editForm.restablecerPassword}
                    onChange={(e) =>
                      setEditForm({ ...editForm, restablecerPassword: e.target.checked })
                    }
                  />
                  Nueva contraseña
                </label>
                {editForm.restablecerPassword && (
                  <input
                    type="text"
                    value={editForm.nuevaPassword}
                    onChange={(e) =>
                      setEditForm({ ...editForm, nuevaPassword: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
                    placeholder="Dejar vacío para generar automática"
                  />
                )}
              </>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="flex-1 rounded-lg border py-2.5 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleUpdate(u.id)}
                disabled={loading}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                Guardar
              </button>
            </div>
          </div>
        </li>
      );
    }

    return (
      <li key={u.id} className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">
              {u.username}
              {isSelf && <span className="ml-1 text-xs text-slate-400">(tú)</span>}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <RoleBadge role={u.role} />
            {!u.activo && (
              <span className="text-xs text-slate-400">Inactivo</span>
            )}
          </div>
        </div>
        {gestionar && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => startEdit(u)}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              Editar
            </button>
            {u.activo ? (
              <button
                type="button"
                onClick={() => setDeleteTarget(u)}
                className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600"
              >
                Desactivar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleReactivar(u.id)}
                disabled={loading}
                className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700"
              >
                Reactivar
              </button>
            )}
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-4">
      {flash && (
        <FlashMessage type={flash.type} message={flash.message} onDismiss={() => setFlash(null)} />
      )}

      {!showCreate ? (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white"
        >
          + Nuevo usuario
        </button>
      ) : (
        <form onSubmit={handleCreate} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <h3 className="mb-3 font-bold text-slate-900">Nuevo usuario</h3>
          <div className="space-y-3">
            <input
              required
              type="text"
              autoComplete="off"
              value={createForm.username}
              onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
              placeholder="Usuario (ej. juan.perez)"
            />
            <input
              required
              type="password"
              minLength={6}
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
              placeholder="Contraseña"
            />
            {isAdmin && (
              <select
                value={createForm.role}
                onChange={(e) =>
                  setCreateForm({ ...createForm, role: e.target.value as Role })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
              >
                {rolesCrear.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="flex-1 rounded-xl border py-3 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Guardando…" : "Crear"}
            </button>
          </div>
        </form>
      )}

      <section className="rounded-xl bg-white ring-1 ring-slate-200">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-700">Activos ({activos.length})</h3>
        </div>
        {activos.length === 0 ? (
          <p className="p-4 text-center text-sm text-slate-500">Sin usuarios activos.</p>
        ) : (
          <ul className="divide-y divide-slate-100">{activos.map(renderUsuario)}</ul>
        )}
      </section>

      {inactivos.length > 0 && (
        <section className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          <button
            type="button"
            onClick={() => setShowInactivos((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-700"
          >
            Inactivos ({inactivos.length})
            <span>{showInactivos ? "▲" : "▼"}</span>
          </button>
          {showInactivos && (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {inactivos.map(renderUsuario)}
            </ul>
          )}
        </section>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Desactivar usuario"
        message={
          deleteTarget
            ? `¿Desactivar a "${deleteTarget.username}"?`
            : ""
        }
        confirmLabel="Desactivar"
        loading={loading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
