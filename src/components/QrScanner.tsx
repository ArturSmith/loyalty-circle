import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export function QrScanner({ onScan, paused }: { onScan: (text: string) => void; paused?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const lastRef = useRef<{ text: string; ts: number } | null>(null);

  useEffect(() => {
    if (paused) {
      // A deliberate next scan can read the same QR immediately. The short
      // debounce below only suppresses repeated frames within one scan.
      lastRef.current = null;
      return;
    }
    const reader = new BrowserMultiFormatReader();
    let stopFn: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
          if (cancelled || !result) return;
          const text = result.getText();
          const now = Date.now();
          if (lastRef.current && lastRef.current.text === text && now - lastRef.current.ts < 2000) return;
          lastRef.current = { text, ts: now };
          onScan(text);
        });
        if (cancelled) controls.stop();
        else stopFn = () => controls.stop();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Camera unavailable");
      }
    })();

    return () => { cancelled = true; stopFn?.(); };
  }, [onScan, paused]);

  if (error) {
    return <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">Camera error: {error}</div>;
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
      <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-gold/70 animate-pulse" />
    </div>
  );
}
