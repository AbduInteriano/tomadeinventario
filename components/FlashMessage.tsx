"use client";

interface FlashMessageProps {
  type: "success" | "error";
  message: string;
  onDismiss?: () => void;
}

export function FlashMessage({ type, message, onDismiss }: FlashMessageProps) {
  return (
    <div
      role="alert"
      className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm ${
        type === "success"
          ? "bg-green-50 text-green-800 ring-1 ring-green-200"
          : "bg-red-50 text-red-800 ring-1 ring-red-200"
      }`}
    >
      <p>{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 font-medium opacity-70 active:opacity-100"
          aria-label="Cerrar"
        >
          ✕
        </button>
      )}
    </div>
  );
}
