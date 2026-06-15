"use client";

import { useEffect, useId, useRef, useState, useCallback } from "react";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

function mapCameraError(err: unknown): string {
  if (!(err instanceof Error)) {
    return "No se pudo iniciar la cámara. Usa el campo manual para ingresar el código.";
  }

  const name = err.name;
  const msg = err.message.toLowerCase();

  if (name === "NotAllowedError" || msg.includes("permission") || msg.includes("notallowed")) {
    return "Permiso de cámara denegado. Toca el ícono de candado en la barra del navegador, permite la cámara y vuelve a abrir el escáner.";
  }
  if (name === "NotFoundError" || msg.includes("device not found") || msg.includes("no camera")) {
    return "No se detectó ninguna cámara en este dispositivo.";
  }
  if (name === "NotReadableError" || msg.includes("could not start") || msg.includes("in use")) {
    return "La cámara está en uso por otra aplicación. Ciérrala e intenta de nuevo.";
  }
  if (name === "SecurityError" || msg.includes("secure context") || msg.includes("https")) {
    return "La cámara requiere conexión segura (HTTPS) o abrir el sitio en localhost.";
  }
  if (name === "OverconstrainedError" || msg.includes("overconstrained")) {
    return "No se pudo usar la cámara trasera. Intenta de nuevo o ingresa el código manualmente.";
  }
  if (msg.includes("transition") || msg.includes("already") || msg.includes("running")) {
    return "El escáner se reinició. Cierra y vuelve a abrir la cámara.";
  }

  return `Error de cámara: ${err.message}. Puedes ingresar el código manualmente.`;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const reactId = useId().replace(/:/g, "");
  const containerId = `barcode-scanner-${reactId}`;
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const startingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  const handleScan = useCallback(
    (decodedText: string) => {
      const trimmed = decodedText.trim();
      if (!trimmed) return;

      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.code === trimmed && now - last.at < 2000) {
        return;
      }
      lastScanRef.current = { code: trimmed, at: now };
      onScan(trimmed);
    },
    [onScan]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    async function stopScanner() {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (!scanner) return;
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
        await scanner.clear();
      } catch {
        // ignore cleanup errors
      }
    }

    async function startWithConfig(
      scanner: import("html5-qrcode").Html5Qrcode,
      camera: string | { facingMode: string }
    ) {
      await scanner.start(
        camera,
        {
          fps: 10,
          qrbox: (w: number, h: number) => {
            const edge = Math.min(w, h);
            const width = Math.floor(edge * 0.9);
            return { width, height: Math.floor(width * 0.45) };
          },
          disableFlip: false,
        },
        handleScan,
        () => {}
      );
    }

    async function startScanner() {
      if (startingRef.current) return;
      startingRef.current = true;
      setStarting(true);
      setError(null);

      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode(containerId, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          useBarCodeDetectorIfSupported: true,
        });
        scannerRef.current = scanner;

        const attempts: Array<string | { facingMode: string }> = [
          { facingMode: "environment" },
          { facingMode: "user" },
        ];

        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras.length > 0) {
            const back =
              cameras.find((c) =>
                /back|rear|trasera|environment/i.test(c.label)
              ) ?? cameras[cameras.length - 1];
            attempts.unshift(back.id);
          }
        } catch {
          // getCameras can fail; facingMode still works on many devices
        }

        let lastErr: unknown = null;
        for (const camera of attempts) {
          if (cancelled) return;
          try {
            await startWithConfig(scanner, camera);
            if (!cancelled) {
              setStarting(false);
              setError(null);
            }
            return;
          } catch (err) {
            lastErr = err;
            try {
              if (scanner.isScanning) await scanner.stop();
            } catch {
              // ignore
            }
          }
        }

        throw lastErr ?? new Error("No se pudo iniciar ninguna cámara");
      } catch (err) {
        if (!cancelled) {
          setError(mapCameraError(err));
          setStarting(false);
        }
      } finally {
        startingRef.current = false;
      }
    }

    const timer = window.setTimeout(() => {
      if (!cancelled) startScanner();
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stopScanner();
    };
  }, [containerId, handleScan]);

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

      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden p-4">
        <div id={containerId} className="w-full max-w-md" style={{ minHeight: 240 }} />

        {starting && !error && (
          <p className="mt-4 text-center text-sm text-white/80">Iniciando cámara…</p>
        )}

        {error && (
          <div className="mt-4 max-w-md rounded-xl bg-red-900/90 p-4 text-center text-white">
            <p className="font-semibold">No se pudo usar la cámara</p>
            <p className="mt-2 text-sm leading-relaxed text-red-100">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-lg bg-white/20 px-4 py-2 text-sm font-medium"
            >
              Usar entrada manual
            </button>
          </div>
        )}

        {!error && (
          <p className="mt-4 max-w-md text-center text-sm text-white/70">
            Apunta al código de barras dentro del recuadro. El escaneo es automático.
          </p>
        )}
      </div>
    </div>
  );
}
