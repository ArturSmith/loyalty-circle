import { resolvePaddlePrice } from "@/utils/payments.functions";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export type PaddleCheckoutError = {
  name: "checkout.error" | "checkout.payment.error";
  type?: string;
  code?: string;
  detail?: string;
  documentation_url?: string;
};

type PaddleEvent = PaddleCheckoutError | { name?: string; [key: string]: unknown };
type PaddleEventListener = (event: PaddleEvent) => void;
const paddleEventListeners = new Set<PaddleEventListener>();

type PaddleGlobal = {
  Environment: { set(environment: "sandbox" | "production"): void };
  Initialize(options: { token: string; eventCallback: (event: PaddleEvent) => void }): void;
  Checkout: {
    open(options: Record<string, unknown>): void;
    close(): void;
  };
};

declare global {
  interface Window {
    Paddle: PaddleGlobal;
  }
}

export function getPaddleEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

let paddleInitialized = false;
let paddleInitialization: Promise<void> | null = null;

function publishPaddleEvent(event: PaddleEvent) {
  paddleEventListeners.forEach((listener) => listener(event));
}

export function subscribeToPaddleEvents(listener: PaddleEventListener) {
  paddleEventListeners.add(listener);
  return () => {
    paddleEventListeners.delete(listener);
  };
}

export function isPaddleCheckoutError(event: PaddleEvent): event is PaddleCheckoutError {
  return event.name === "checkout.error" || event.name === "checkout.payment.error";
}

export function closePaddleCheckout() {
  try {
    window.Paddle?.Checkout?.close();
  } catch {
    // The error is still surfaced if Paddle has already closed its overlay.
  }
}

export function describePaddleCheckoutError(error: PaddleCheckoutError): string {
  if (error.code === "transaction_default_checkout_url_not_set") {
    return "The payment provider is missing its default checkout URL. Please contact support and mention this checkout configuration error.";
  }
  if (error.code?.includes("price") || error.code === "entity_not_found") {
    return "This plan is not available in the current payment environment. Please contact support and mention the price configuration error.";
  }
  if (error.code === "no_payment_methods_available") {
    return "No supported payment method is available for this device or location.";
  }
  const detail = error.detail?.trim();
  const code = error.code?.trim();
  if (detail && code) return `${detail} (${code})`;
  return (
    detail ||
    (code ? `Payment provider error: ${code}` : "The payment provider could not load checkout.")
  );
}

export async function initializePaddle() {
  if (paddleInitialized) return;
  if (!clientToken) throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");
  if (paddleInitialization) return paddleInitialization;

  paddleInitialization = new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      paddleInitialization = null;
      reject(new Error("Paddle.js timed out while loading"));
    }, 12_000);
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://cdn.paddle.com/paddle/v2/paddle.js"]',
    );
    const finish = () => {
      window.clearTimeout(timeout);
      try {
        if (!window.Paddle) throw new Error("Paddle.js did not load");
        const paddleJsEnv = getPaddleEnvironment() === "sandbox" ? "sandbox" : "production";
        window.Paddle.Environment.set(paddleJsEnv);
        window.Paddle.Initialize({ token: clientToken, eventCallback: publishPaddleEvent });
        paddleInitialized = true;
        resolve();
      } catch (error) {
        paddleInitialization = null;
        reject(error);
      }
    };
    if (existing && window.Paddle) return finish();
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
      document.head.appendChild(script);
    }
    script.addEventListener("load", finish, { once: true });
    script.addEventListener(
      "error",
      () => {
        window.clearTimeout(timeout);
        paddleInitialization = null;
        reject(new Error("Paddle.js could not be loaded"));
      },
      { once: true },
    );
  });

  return paddleInitialization;
}

export async function getPaddlePriceId(priceId: string): Promise<string> {
  const environment = getPaddleEnvironment();
  return resolvePaddlePrice({ data: { priceId, environment } });
}
