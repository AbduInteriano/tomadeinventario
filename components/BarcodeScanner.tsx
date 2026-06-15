"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const containerId = "barcode-scanner-region";
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  const handleScan = useCallback(
    (decodedText: string) => {
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.code === decodedText && now - last.at < 2000) {
        return;
      }
      lastScanRef.current = { code: decodedText, at: now };
      onScan(decodedText);
    },
    [onScan]
  );

  useEffect(() => {
    let mounted = true;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;

        const cameras = await Html5Qrcode.getCameras();
        if (!cameras.length) {
          if (mounted) {
            setError("No se detectó ninguna cámara en este dispositivo.");
            setStarting(false);
          }
          return;
        }

        const backCamera =
          cameras.find(
            (c) =>
              c.label.toLowerCase().includes("back") ||
              c.label.toLowerCase().includes("trasera") ||
              c.label.toLowerCase().includes("rear")
          ) ?? cameras[cameras.length - 1];

        await scanner.start(
          backCamera.id,
          {
            fps: 10,
            qrbox: { width: 280, height: 160 },
            aspectRatio: 1.777,
          },
          handleScan,
          () => {}
        );

        if (mounted) setStarting(false);
      } catch (err) {
        if (!mounted) return;
        const message =
          err instanceof Error ? err.message : "Error al iniciar la cámara";
        if (
          message.toLowerCase().includes("permission") ||
          message.toLowerCase().includes("notallowed")
        ) {
          setError(
            "Permiso de cámara denegado. Activa el acceso a la cámara en la configuración del navegador y recarga la página."
          );
        } else {
          setError(message);
        }
        setStarting(false);
      }
    }

    startScanner();

    return () => {
      mounted = false;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      }
    };
  }, [handleScan]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
        <h2 className="text-lg font-semibold">Escanear código</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium active:bg-slate-600"
        >
          Cerrar
        </button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center p-4">
        <div
          id={containerId}
          className="w-full max-w-md overflow-hidden rounded-xl"
        />

        {starting && !error && (
          <p className="mt-4 text-center text-white/80">Iniciando cámara…</p>
        )}

        {error && (
          <div className="mt-4 max-w-md rounded-xl bg-red-900/80 p-4 text-center text-white">
            <p className="font-medium">No se pudo usar la cámara</p>
            <p className="mt-2 text-sm text-red-100">{error}</p>
            <p className="mt-3 text-sm text-red-200">
              Puedes ingresar el código manualmente en el campo de texto.
            </p>
          </div>
        )}

        <p className="mt-4 max-w-md text-center text-sm text-white/70">
          Apunta la cámara al código de barras. El escaneo es automático.
        </p>
      </div>
    </div>
  );
}
