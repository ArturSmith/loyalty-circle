import { useEffect, useRef, useState } from "react";
// Imported lazily in the effect below: the package's Node build pulls in
// modules the server runtime can't load, which crashes server rendering.

export function QrDisplay({ value, size = 240, className }: { value: string; size?: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;
    void import("qrcode").then(({ default: QRCode }) => {
      if (cancelled || !canvasRef.current) return;
      return QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 1,
        color: { dark: "#1a1a2e", light: "#00000000" },
        errorCorrectionLevel: "M",
      }).then(() => {
        if (!cancelled) setReady(true);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  return (
    <div
      className={className}
      style={{ width: size, maxWidth: "100%", aspectRatio: "1 / 1" }}
    >
      <canvas
        ref={canvasRef}
        // The QR library writes fixed inline dimensions. Override those display
        // dimensions so narrow dialogs can shrink the canvas with its wrapper.
        className={`h-full! w-full! ${ready ? "opacity-100 transition-opacity" : "opacity-0"}`}
      />
    </div>
  );
}
