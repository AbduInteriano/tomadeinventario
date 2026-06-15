import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-3xl text-white shadow-lg">
          📦
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Inventarios</h1>
        <p className="mt-1 text-slate-500">Ingresa con tu cuenta asignada</p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
        <LoginForm />
      </div>
    </div>
  );
}
