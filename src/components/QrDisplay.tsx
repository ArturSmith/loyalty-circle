import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

export function QrDisplay({ value, size = 240, className }: { value: string; size?: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      color: { dark: "#1a1a2e", light: "#00000000" },
      errorCorrectionLevel: "M",
    }).then(() => setReady(true));
  }, [value, size]);

  return (
    <div className={className} style={{ width: size, height: size }}>
      <canvas ref={canvasRef} className={ready ? "opacity-100 transition-opacity" : "opacity-0"} />
    </div>
  );
}
