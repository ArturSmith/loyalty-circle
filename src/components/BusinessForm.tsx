import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
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

type Props = {
  value: BusinessDetails;
  onChange: (next: BusinessDetails) => void;
};

export function BusinessForm({ value, onChange }: Props) {
  const set = <K extends keyof BusinessDetails>(key: K, v: BusinessDetails[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-7">
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
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="biz-category">Category *</Label>
          <Select value={value.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger id="biz-category" className="mt-1.5">
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
          <Label htmlFor="biz-logo">Logo URL</Label>
          <Input
            id="biz-logo"
            maxLength={500}
            value={value.logo_url}
            onChange={(e) => set("logo_url", e.target.value)}
            placeholder="https://…"
            className="mt-1.5"
          />
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
            className="mt-1.5"
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
            <Input id="biz-city" required maxLength={100} value={value.city} onChange={(e) => set("city", e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="biz-postal">Postal code *</Label>
            <Input id="biz-postal" required maxLength={20} value={value.postal_code} onChange={(e) => set("postal_code", e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="biz-region">Region / state</Label>
            <Input id="biz-region" maxLength={100} value={value.region} onChange={(e) => set("region", e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="biz-country">Country *</Label>
            <Input id="biz-country" required maxLength={100} value={value.country} onChange={(e) => set("country", e.target.value)} placeholder="Norway" className="mt-1.5" />
          </div>
        </div>
      </section>

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
          <p className="mt-1 text-xs text-muted-foreground">Shown to customers who add your card.</p>
        </div>
      </section>
    </div>
  );
}
