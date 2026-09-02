import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Spinner } from "@/components/Spinner";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

const LOGO_BUCKET = "business-logos";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;


export type BusinessDetails = {
  name: string;
  category: string;
  logo_url: string;
  brand_color: string;
  description: string;
  welcome_message: string;
  phone: string;
  website: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postal_code: string;
  region: string;
  country: string;
};

export const emptyBusinessDetails: BusinessDetails = {
  name: "",
  category: "",
  logo_url: "",
  brand_color: "",
  description: "",
  welcome_message: "",
  phone: "",
  website: "",
  address_line1: "",
  address_line2: "",
  city: "",
  postal_code: "",
  region: "",
  country: "",
};

export const BUSINESS_CATEGORIES = [
  "Café & coffee",
  "Restaurant",
  "Bakery",
  "Bar & pub",
  "Beauty & salon",
  "Barbershop",
  "Spa & wellness",
  "Fitness & gym",
  "Retail & shop",
  "Grocery",
  "Car service",
  "Pet services",
  "Other",
];

export function businessDetailsFromRow(row: Record<string, unknown> | null | undefined): BusinessDetails {
  const s = (k: string) => (typeof row?.[k] === "string" ? (row[k] as string) : "");
  return {
    name: s("name"),
    category: s("category"),
    logo_url: s("logo_url"),
    brand_color: s("brand_color"),
    description: s("description"),
    welcome_message: s("welcome_message"),
    phone: s("phone"),
    website: s("website"),
    address_line1: s("address_line1"),
    address_line2: s("address_line2"),
    city: s("city"),
    postal_code: s("postal_code"),
    region: s("region"),
    country: s("country"),
  };
}

/** Convert form state into a DB payload (empty strings become null). */
export function businessDetailsToPayload(v: BusinessDetails) {
  const nn = (x: string) => (x.trim() ? x.trim() : null);
  return {
    name: v.name.trim(),
    category: nn(v.category),
    logo_url: nn(v.logo_url),
    brand_color: nn(v.brand_color),
    description: nn(v.description),
    welcome_message: nn(v.welcome_message),
    phone: nn(v.phone),
    website: nn(v.website),
    address_line1: nn(v.address_line1),
    address_line2: nn(v.address_line2),
    city: nn(v.city),
    postal_code: nn(v.postal_code),
    region: nn(v.region),
    country: nn(v.country),
  };
}

export function isBusinessDetailsValid(v: BusinessDetails) {
  return (
    v.name.trim().length > 1 &&
    v.category.trim().length > 0 &&
    v.address_line1.trim().length > 2 &&
    v.city.trim().length > 0 &&
    v.postal_code.trim().length > 0 &&
    v.country.trim().length > 0
  );
}

/** The form is also driven a section at a time by the onboarding wizard. */
export type BusinessFormSection = "basics" | "address" | "contact" | "about";

const ALL_SECTIONS: BusinessFormSection[] = ["basics", "address", "contact", "about"];

/** The fields each section requires before it can be considered complete. */
export function isSectionValid(v: BusinessDetails, section: BusinessFormSection) {
  switch (section) {
    case "basics":
      return v.name.trim().length > 1 && v.category.trim().length > 0;
    case "address":
      return (
        v.address_line1.trim().length > 2 &&
        v.city.trim().length > 0 &&
        v.postal_code.trim().length > 0 &&
        v.country.trim().length > 0
      );
    default:
      return true;
  }
}

type Props = {
  value: BusinessDetails;
  onChange: (next: BusinessDetails) => void;
  /** Render only these sections. Defaults to the whole form. */
  sections?: BusinessFormSection[];
  showErrors?: boolean;
};

export function BusinessForm({ value, onChange, sections = ALL_SECTIONS, showErrors = false }: Props) {
  const set = <K extends keyof BusinessDetails>(key: K, v: BusinessDetails[K]) =>
    onChange({ ...value, [key]: v });

  const show = (s: BusinessFormSection) => sections.includes(s);
  const invalid = (field: keyof BusinessDetails, min = 1) => showErrors && value[field].trim().length < min;
  const fieldProps = (field: keyof BusinessDetails, min = 1) => ({
    "aria-invalid": invalid(field, min),
    className: `mt-1.5 ${invalid(field, min) ? "border-destructive ring-1 ring-destructive focus-visible:ring-destructive" : ""}`,
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onPickLogo = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) { toast.error("Please sign in again"); return; }
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${uid}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) { toast.error(error.message); return; }
      const { data: signed, error: signErr } = await supabase.storage
        .from(LOGO_BUCKET)
        .createSignedUrl(path, TEN_YEARS);
      if (signErr || !signed?.signedUrl) { toast.error(signErr?.message ?? "Could not read the uploaded logo"); return; }
      set("logo_url", signed.signedUrl);
      toast.success("Logo uploaded");
    } finally {
      setUploading(false);
    }
  };


  return (
    <div className="space-y-7">
      {show("basics") && (
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Basics</h2>
        <div>
          <Label htmlFor="biz-name">Business name *</Label>
          <Input
            id="biz-name"
            required
            maxLength={100}
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="The Cookie Jar"
            {...fieldProps("name", 2)}
          />
        </div>
        <div>
          <Label htmlFor="biz-category">Category *</Label>
          <Select value={value.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger id="biz-category" {...fieldProps("category")}>
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Logo</Label>
          <div className="mt-1.5 flex items-center gap-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted/40 flex items-center justify-center">
              {value.logo_url ? (
                <img src={value.logo_url} alt="Business logo" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void onPickLogo(f);
                }}
              />
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Spinner size={16} label={null} className="mr-2" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                {value.logo_url ? "Replace logo" : "Upload logo"}
              </Button>
              {value.logo_url && (
                <Button type="button" variant="ghost" size="sm" onClick={() => set("logo_url", "")}>
                  <X className="mr-2 h-4 w-4" /> Remove
                </Button>
              )}
            </div>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">PNG, JPG or SVG, up to 5 MB.</p>
        </div>

        <div>
          <Label htmlFor="biz-color">Brand color</Label>
          <div className="mt-1.5 flex gap-2">
            <Input
              id="biz-color"
              maxLength={9}
              value={value.brand_color}
              onChange={(e) => set("brand_color", e.target.value)}
              placeholder="#7c3aed"
            />
            <input
              type="color"
              aria-label="Pick brand color"
              value={value.brand_color || "#7c3aed"}
              onChange={(e) => set("brand_color", e.target.value)}
              className="h-10 w-14 rounded-md border border-input"
            />
          </div>
        </div>
      </section>
      )}

      {show("address") && (
      <section className="space-y-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Address</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Used to show your loyalty program to customers nearby.
          </p>
        </div>
        <div>
          <Label htmlFor="biz-addr1">Street address *</Label>
          <Input
            id="biz-addr1"
            required
            maxLength={200}
            value={value.address_line1}
            onChange={(e) => set("address_line1", e.target.value)}
            placeholder="Storgata 12"
            {...fieldProps("address_line1", 3)}
          />
        </div>
        <div>
          <Label htmlFor="biz-addr2">Apt, suite, floor</Label>
          <Input
            id="biz-addr2"
            maxLength={200}
            value={value.address_line2}
            onChange={(e) => set("address_line2", e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="biz-city">City *</Label>
            <Input id="biz-city" required maxLength={100} value={value.city} onChange={(e) => set("city", e.target.value)} {...fieldProps("city")} />
          </div>
          <div>
            <Label htmlFor="biz-postal">Postal code *</Label>
            <Input id="biz-postal" required maxLength={20} value={value.postal_code} onChange={(e) => set("postal_code", e.target.value)} {...fieldProps("postal_code")} />
          </div>
          <div>
            <Label htmlFor="biz-region">Region / state</Label>
            <Input id="biz-region" maxLength={100} value={value.region} onChange={(e) => set("region", e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="biz-country">Country *</Label>
            <Input id="biz-country" required maxLength={100} value={value.country} onChange={(e) => set("country", e.target.value)} placeholder="Norway" {...fieldProps("country")} />
          </div>
        </div>
      </section>
      )}

      {show("contact") && (
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Contact</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="biz-phone">Phone</Label>
            <Input id="biz-phone" maxLength={30} value={value.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+47 …" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="biz-website">Website</Label>
            <Input id="biz-website" maxLength={200} value={value.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" className="mt-1.5" />
          </div>
        </div>
      </section>
      )}

      {show("about") && (
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">About (optional)</h2>
        <div>
          <Label htmlFor="biz-desc">Description</Label>
          <Textarea
            id="biz-desc"
            maxLength={600}
            rows={3}
            value={value.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Fresh-baked cookies and specialty coffee in the heart of town."
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="biz-welcome">Welcome message</Label>
          <Textarea
            id="biz-welcome"
            maxLength={300}
            rows={2}
            value={value.welcome_message}
            onChange={(e) => set("welcome_message", e.target.value)}
            placeholder="Thanks for joining our club — your first stamp is on us!"
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Sent as the first chat message when someone adds your card. Leave blank
            to use a default greeting.
          </p>
        </div>
      </section>
      )}
    </div>
  );
}
