import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Languages } from "lucide-react";
import { nb } from "./nb";

export type AppLanguage = "en" | "nb";

const STORAGE_KEY = "clubcarder_language";
const translatedAttributes = ["aria-label", "placeholder", "title", "alt"] as const;
const textRecords = new WeakMap<Text, { source: string; rendered: string }>();
const attributeRecords = new WeakMap<Element, Map<string, { source: string; rendered: string }>>();

function translateDynamic(source: string): string {
  const direct = (nb as Record<string, string>)[source];
  if (direct) return direct;

  const rules: Array<[RegExp, (...parts: string[]) => string]> = [
    [/^Get (\d+) stamps? to earn present:$/, (count) => `Samle ${count} ${count === "1" ? "stempel" : "stempler"} for å få en gave:`],
    [/^(\d+) businesses?$/, (count) => `${count} ${count === "1" ? "bedrift" : "bedrifter"}`],
    [/^(\d+) loyalty programs?$/, (count) => `${count} ${count === "1" ? "lojalitetsprogram" : "lojalitetsprogrammer"}`],
    [/^(\d+) locations?$/, (count) => `${count} ${count === "1" ? "sted" : "steder"}`],
    [/^(\d+) days? left$/, (count) => `${count} ${count === "1" ? "dag" : "dager"} igjen`],
    [/^(\d+) stamps? remaining$/, (count) => `${count} ${count === "1" ? "stempel" : "stempler"} igjen`],
    [/^(\d+) more stamps? to unlock \(step (\d+)\)$/, (count, step) => `${count} ${count === "1" ? "stempel" : "stempler"} til opplåsing (trinn ${step})`],
    [/^(\d+) unread$/, (count) => `${count} uleste`],
    [/^Refreshes in (\d+)s$/, (seconds) => `Fornyes om ${seconds} s`],
    [/^(\d+) active cards?$/, (count) => `${count} aktive ${count === "1" ? "kort" : "kort"}`],
    [/^(\d+) of (\d+) stamps$/, (current, total) => `${current} av ${total} stempler`],
    [/^Step (\d+)$/, (step) => `Trinn ${step}`],
    [/^Step (\d+) of (\d+)$/, (step, total) => `Trinn ${step} av ${total}`],
    [/^Stamp (\d+)$/, (step) => `Stempel ${step}`],
    [/^Created (.+)$/, (date) => `Opprettet ${date}`],
    [/^Submitted (.+)$/, (date) => `Sendt inn ${date}`],
    [/^Joined (.+)$/, (date) => `Ble med ${date}`],
    [/^(.+) away$/, (distance) => `${distance} unna`],
    [/^Open (.+) business page$/, (name) => `Åpne bedriftssiden til ${name}`],
    [/^Open (.+) customer activity$/, (name) => `Åpne kundeaktiviteten til ${name}`],
    [/^Open details for (.+)$/, (card) => `Åpne detaljer for ${card}`],
    [/^(.+) was submitted to the platform moderation team\.$/, (name) => `${name} ble sendt til plattformmoderering.`],
    [/^(.+) was not accepted\. Update the details and submit it again\.$/, (name) => `${name} ble ikke godkjent. Oppdater detaljene og send inn på nytt.`],
    [/^(.+) has been accepted and published\.$/, (name) => `${name} er godkjent og publisert.`],
    [/^(.+) from (.+) is ready to use\.$/, (card, business) => `${card} fra ${business} er klart til bruk.`],
    [/^(.+) added stamp (\d+) to (.+)\.$/, (business, step, card) => `${business} la til stempel ${step} på ${card}.`],
    [/^(.+) is now available on (.+)\.$/, (reward, card) => `${reward} er nå tilgjengelig på ${card}.`],
    [/^Stamp activity across the last (\d+) days\.$/, (days) => `Stempelaktivitet de siste ${days} dagene.`],
    [/^Stamp activity across all time\.$/, () => "Stempelaktivitet for hele perioden."],
    [/^Current progress of customers who joined during the last (\d+) days\.$/, (days) => `Nåværende fremgang for kunder som ble med de siste ${days} dagene.`],
    [/^(\d+) customers? are close to a reward$/, (count) => `${count} ${count === "1" ? "kunde er" : "kunder er"} nær en belønning`],
    [/^(\d+) rewards? have waited over 30 days$/, (count) => `${count} ${count === "1" ? "belønning har" : "belønninger har"} ventet i over 30 dager`],
    [/^(\d+) inactive customers?$/, (count) => `${count} inaktive ${count === "1" ? "kunde" : "kunder"}`],
    [/^Return visits are down (\d+)%$/, (amount) => `Gjenbesøk er redusert med ${amount} %`],
    [/^(\d+) active · (\d+) return visits · (\d+) rewards redeemed$/, (active, visits, rewards) => `${active} aktive · ${visits} gjenbesøk · ${rewards} innløste belønninger`],
  ];
  for (const [pattern, replacement] of rules) {
    const match = source.match(pattern);
    if (match) return replacement(...match.slice(1));
  }
  return source;
}

function preserveWhitespace(source: string, translated: string) {
  const leading = source.match(/^\s*/)?.[0] ?? "";
  const trailing = source.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

function localizedValue(source: string, language: AppLanguage) {
  if (language === "en") return source;
  const trimmed = source.trim();
  if (!trimmed) return source;
  return preserveWhitespace(source, translateDynamic(trimmed));
}

function localizeTextNode(node: Text, language: AppLanguage) {
  const current = node.nodeValue ?? "";
  let record = textRecords.get(node);
  if (!record || current !== record.rendered) {
    record = { source: current, rendered: current };
    textRecords.set(node, record);
  }
  const next = localizedValue(record.source, language);
  record.rendered = next;
  if (current !== next) node.nodeValue = next;
}

function localizeElement(element: Element, language: AppLanguage) {
  if (element.closest("[data-i18n-ignore]")) return;
  let records = attributeRecords.get(element);
  if (!records) {
    records = new Map();
    attributeRecords.set(element, records);
  }
  for (const attribute of translatedAttributes) {
    const current = element.getAttribute(attribute);
    if (current === null) continue;
    let record = records.get(attribute);
    if (!record || current !== record.rendered) {
      record = { source: current, rendered: current };
      records.set(attribute, record);
    }
    const next = localizedValue(record.source, language);
    record.rendered = next;
    if (current !== next) element.setAttribute(attribute, next);
  }
}

function localizeTree(root: Node, language: AppLanguage) {
  if (root.nodeType === Node.TEXT_NODE) {
    const parent = root.parentElement;
    if (parent && !parent.closest("[data-i18n-ignore]") && !["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) {
      localizeTextNode(root as Text, language);
    }
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) localizeElement(root as Element, language);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement;
      if (parent && !parent.closest("[data-i18n-ignore]") && !["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) localizeTextNode(node as Text, language);
    } else {
      localizeElement(node as Element, language);
    }
    node = walker.nextNode();
  }
}

type LanguageContextValue = {
  language: AppLanguage;
  locale: "en-US" | "nb-NO";
  setLanguage: (language: AppLanguage) => void;
  t: (english: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("en");

  useEffect(() => {
    let alive = true;
    void (async () => {
      let saved: string | null = null;
      try {
        saved = window.localStorage.getItem(STORAGE_KEY);
      } catch {}
      if (saved !== "en" && saved !== "nb") {
        try {
          const { Preferences } = await import("@capacitor/preferences");
          saved = (await Preferences.get({ key: STORAGE_KEY })).value;
        } catch {}
      }
      const preferred: AppLanguage = saved === "en" || saved === "nb"
        ? saved
        : /^(nb|nn|no)(-|$)/i.test(window.navigator.language)
          ? "nb"
          : "en";
      if (alive) setLanguageState(preferred);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    void import("@capacitor/preferences")
      .then(({ Preferences }) => Preferences.set({ key: STORAGE_KEY, value: next }))
      .catch(() => {});
  }, []);

  useLayoutEffect(() => {
    document.documentElement.lang = language;
    localizeTree(document.body, language);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") localizeTree(mutation.target, language);
        mutation.addedNodes.forEach((node) => localizeTree(node, language));
        if (mutation.type === "attributes") localizeElement(mutation.target as Element, language);
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...translatedAttributes],
    });
    return () => observer.disconnect();
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    locale: language === "nb" ? "nb-NO" : "en-US",
    setLanguage,
    t: (english) => language === "nb" ? translateDynamic(english) : english,
  }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside LanguageProvider");
  return value;
}

export function LanguageSwitcher({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-border bg-card/90 p-1 shadow-sm ${className}`}
      role="group"
      aria-label={t("Language")}
    >
      {!compact && <Languages className="ml-1.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />}
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${language === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        aria-pressed={language === "en"}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage("nb")}
        className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${language === "nb" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        aria-pressed={language === "nb"}
      >
        NO
      </button>
    </div>
  );
}
