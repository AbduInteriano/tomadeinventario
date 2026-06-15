import Link from "next/link";

const links = [
  { href: "/supervisor", label: "Inicio", exact: true },
  { href: "/supervisor/inventarios", label: "Inventarios" },
  { href: "/tomador", label: "Conteo" },
  { href: "/supervisor/puntos", label: "Puntos" },
  { href: "/supervisor/productos", label: "Productos" },
  { href: "/supervisor/usuarios", label: "Usuarios" },
];

interface SupervisorNavProps {
  currentPath: string;
}

export function SupervisorNav({ currentPath }: SupervisorNavProps) {
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-lg gap-1 overflow-x-auto px-4 py-2">
        {links.map((link) => {
          const active =
            link.exact
              ? currentPath === link.href
              : currentPath.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 active:bg-slate-100"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
