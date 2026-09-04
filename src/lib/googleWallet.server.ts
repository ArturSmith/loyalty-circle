/**
 * Google Wallet (Loyalty passes) — server-only helpers.
 *
 * Requires three secrets:
 *   GOOGLE_WALLET_ISSUER_ID       – numeric issuer id from the Google Pay & Wallet Console
 *   GOOGLE_WALLET_SA_EMAIL        – service account email
 *   GOOGLE_WALLET_SA_PRIVATE_KEY  – service account private key (PEM, PKCS#8)
 *
 * Optional:
 *   GOOGLE_WALLET_CLASS_REVIEW_STATUS – "APPROVED" once the issuer is approved,
 *                                       otherwise classes stay restricted to
 *                                       allow-listed test accounts.
 *
 * Everything is implemented with WebCrypto + fetch so it runs on the edge runtime.
 */

const WALLET_API = "https://walletobjects.googleapis.com/walletobjects/v1";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";
const SAVE_URL = "https://pay.google.com/gp/v/save/";

export type WalletConfig = {
  issuerId: string;
  clientEmail: string;
  privateKey: string;
  /** `reviewStatus` sent on every loyalty class. */
  reviewStatus: "UNDER_REVIEW" | "APPROVED";
};

export function getWalletConfig(): WalletConfig | null {
  const issuerId = process.env["GOOGLE_WALLET_ISSUER_ID"];
  const clientEmail = process.env["GOOGLE_WALLET_SA_EMAIL"];
  const privateKey = process.env["GOOGLE_WALLET_SA_PRIVATE_KEY"];
  if (!issuerId || !clientEmail || !privateKey) return null;
  // Staging keeps the default so test passes never reach real users, while
  // production opts in explicitly now that the issuer class was approved.
  const reviewStatus =
    process.env["GOOGLE_WALLET_CLASS_REVIEW_STATUS"]?.toUpperCase() === "APPROVED"
      ? "APPROVED"
      : "UNDER_REVIEW";
  return { issuerId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n"), reviewStatus };
}


/* ------------------------------------------------------------------ crypto */

function base64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let cachedKey: CryptoKey | null = null;

async function getSigningKey(pem: string): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  cachedKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return cachedKey;
}

export async function signJwt(payload: Record<string, unknown>, config: WalletConfig): Promise<string> {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const key = await getSigningKey(config.privateKey);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${body}`),
  );
  return `${header}.${body}.${base64url(signature)}`;
}

/* -------------------------------------------------------------- api access */

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(config: WalletConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt(
    {
      iss: config.clientEmail,
      scope: SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    config,
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`Google auth failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

async function walletFetch(
  config: WalletConfig,
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; json: any }> {
  const token = await getAccessToken(config);
  const res = await fetch(`${WALLET_API}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

/* ----------------------------------------------------------------- helpers */

const strip = (id: string) => id.replace(/-/g, "");

export function classIdFor(config: WalletConfig, templateId: string): string {
  return `${config.issuerId}.tpl${strip(templateId)}`;
}

export function objectIdFor(config: WalletConfig, instanceId: string): string {
  return `${config.issuerId}.obj${strip(instanceId)}`;
}

function hexColor(value: string | null | undefined, fallback: string): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

/**
 * Google rasterises `programLogo` itself and rejects anything it cannot decode.
 * Business logos here are frequently SVG (the card editor accepts SVG uploads),
 * and a rejected image fails the whole class write — so unsupported formats are
 * dropped rather than sent. The pass simply renders without a logo.
 */
export function usableLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!/^https:\/\//i.test(url)) return null;
  const path = url.split(/[?#]/)[0] ?? "";
  if (/\.svg$/i.test(path)) return null;
  return url;
}

export type ClassInput = {
  templateId: string;
  title: string;
  businessName: string;
  accentColor: string | null;
  logoUrl: string | null;
  homepageUrl: string;
};

export async function ensureLoyaltyClass(config: WalletConfig, input: ClassInput): Promise<string> {
  const id = classIdFor(config, input.templateId);
  const body: Record<string, unknown> = {
    id,
    issuerName: input.businessName,
    programName: input.title,
    reviewStatus: config.reviewStatus,
    hexBackgroundColor: hexColor(input.accentColor, "#1a1a2e"),
    homepageUri: { uri: input.homepageUrl, description: "Open in ClubCarder" },
  };
  const logoUrl = usableLogoUrl(input.logoUrl);
  if (logoUrl) {
    body["programLogo"] = {
      sourceUri: { uri: logoUrl },
      contentDescription: { defaultValue: { language: "en-US", value: `${input.businessName} logo` } },
    };
  }


  const existing = await walletFetch(config, `/loyaltyClass/${encodeURIComponent(id)}`);
  if (existing.ok) {
    // Staging and production share an issuer, and a class id is derived only
    // from the issuer and the template — so both environments address the very
    // same class. A staging deploy patching `reviewStatus: UNDER_REVIEW` over a
    // live class would un-publish it and break passes real customers already
    // hold. Review status is therefore only ever allowed to move forwards.
    const patch = { ...body };
    if (existing.json?.reviewStatus === "APPROVED" && config.reviewStatus !== "APPROVED") {
      delete patch["reviewStatus"];
    }
    await walletFetch(config, `/loyaltyClass/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return id;
  }

  const created = await walletFetch(config, `/loyaltyClass`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!created.ok) {
    throw new Error(`Could not create wallet program: ${JSON.stringify(created.json)}`);
  }
  return id;
}

export type ObjectInput = {
  instanceId: string;
  classId: string;
  businessName: string;
  cardTitle: string;
  stampsCount: number;
  totalSteps: number;
  nextReward: string | null;
  claimUrl: string;
  bgColor: string | null;
  /** A frozen business's cards cannot be stamped, so the pass is greyed out. */
  frozen?: boolean;
  /** Anonymous passes link to a claim page; owned cards link back to the wallet. */
  linkLabel?: string;
};

function objectBody(config: WalletConfig, input: ObjectInput) {
  return {
    id: objectIdFor(config, input.instanceId),
    classId: input.classId,
    state: input.frozen ? "INACTIVE" : "ACTIVE",
    hexBackgroundColor: hexColor(input.bgColor, "#1a1a2e"),
    accountName: input.businessName,
    accountId: input.instanceId,
    loyaltyPoints: {
      label: "Stamps",
      balance: { string: `${input.stampsCount} / ${input.totalSteps}` },
    },
    barcode: {
      type: "QR_CODE",
      value: `stempel:card:${input.instanceId}`,
      alternateText: input.cardTitle,
    },
    textModulesData: input.nextReward
      ? [{ header: "Next reward", body: input.nextReward, id: "next_reward" }]
      : [],
    linksModuleData: {
      uris: [
        {
          uri: input.claimUrl,
          description: input.linkLabel ?? "Save this card to your account",
          id: "claim",
        },
      ],
    },
  };
}


export async function createLoyaltyObject(config: WalletConfig, input: ObjectInput): Promise<string> {
  const id = objectIdFor(config, input.instanceId);
  const existing = await walletFetch(config, `/loyaltyObject/${encodeURIComponent(id)}`);
  if (!existing.ok) {
    const created = await walletFetch(config, `/loyaltyObject`, {
      method: "POST",
      body: JSON.stringify(objectBody(config, input)),
    });
    if (!created.ok) throw new Error(`Could not create wallet pass: ${JSON.stringify(created.json)}`);
  }
  return id;
}

export async function updateLoyaltyObject(config: WalletConfig, input: ObjectInput): Promise<void> {
  const id = objectIdFor(config, input.instanceId);
  const res = await walletFetch(config, `/loyaltyObject/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(objectBody(config, input)),
  });
  if (!res.ok) throw new Error(`Could not update wallet pass: ${JSON.stringify(res.json)}`);
}

export async function buildSaveUrl(
  config: WalletConfig,
  objectId: string,
  origins: string[],
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwt = await signJwt(
    {
      iss: config.clientEmail,
      aud: "google",
      typ: "savetowallet",
      iat: now,
      origins,
      payload: { loyaltyObjects: [{ id: objectId }] },
    },
    config,
  );
  return `${SAVE_URL}${jwt}`;
}
