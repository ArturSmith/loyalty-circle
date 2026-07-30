import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection, SELLER_NAME, SUPPORT_EMAIL } from "@/components/LegalLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — Clubcarder" },
      { name: "description", content: "How Muzaev AS collects, uses, shares, and protects personal data in Clubcarder digital loyalty cards." },
      { property: "og:title", content: "Privacy Notice — Clubcarder" },
      { property: "og:description", content: "What data Clubcarder collects, why, who it is shared with, and your rights." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://clubcarder.com/privacy" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://clubcarder.com/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Notice" updated="30 July 2026">
      <p>
        This notice explains how <strong className="text-foreground">{SELLER_NAME}</strong>, the operator of Clubcarder
        (clubcarder.com), handles personal data. {SELLER_NAME} is the data controller for the personal data described
        here. This page is maintained by {SELLER_NAME} to answer common privacy questions about Clubcarder.
      </p>

      <LegalSection heading="What we collect and why">
        <ul>
          <li><strong className="text-foreground">Account data</strong> (name, email, login credentials, authentication provider) — to create and secure your account. Legal basis: performance of our contract with you.</li>
          <li><strong className="text-foreground">Business profile data</strong> (business name, logo, card designs, rewards) — to run your loyalty program. Legal basis: contract.</li>
          <li><strong className="text-foreground">Loyalty activity</strong> (which cards you hold, stamp counts, timestamps, redemptions) — to show progress to customers and analytics to the issuing business. Legal basis: contract.</li>
          <li><strong className="text-foreground">Support messages</strong> you send us — to answer you. Legal basis: legitimate interest in supporting our users.</li>
          <li><strong className="text-foreground">Technical data</strong> (IP address, device and browser information, error logs, basic usage telemetry) — for security, fraud prevention, and improving the product. Legal basis: legitimate interests.</li>
        </ul>
        <p>
          Payment card details are never collected or stored by us; they are handled by Paddle. When a business issues a
          card, that business can see the cardholder's stamp activity and progress for its own cards.
        </p>
      </LegalSection>

      <LegalSection heading="Who we share data with">
        <ul>
          <li><strong className="text-foreground">Service providers / subprocessors</strong> — hosting, database and authentication infrastructure, email delivery, and error monitoring, acting on our instructions.</li>
          <li><strong className="text-foreground">Paddle</strong>, our Merchant of Record, for the sale of subscriptions, subscription management, payments, tax compliance, and invoicing.</li>
          <li><strong className="text-foreground">Businesses you interact with</strong> — a business sees the loyalty activity on the cards it issued to you.</li>
          <li><strong className="text-foreground">Professional advisers</strong> (legal, accounting) and <strong className="text-foreground">authorities</strong>, where required by law.</li>
        </ul>
        <p>We do not sell personal data.</p>
      </LegalSection>

      <LegalSection heading="International transfers">
        <p>
          Some of our providers process data outside the EEA/UK. Where that happens, transfers are protected by an
          adequacy decision or by Standard Contractual Clauses with appropriate additional safeguards.
        </p>
      </LegalSection>

      <LegalSection heading="Retention">
        <p>
          We keep account and loyalty data for as long as your account is active. If you delete your account or a card,
          the associated data is deleted or anonymised, normally within 30 days, except where we must keep records
          longer for legal, tax, or fraud-prevention reasons. Billing records held by Paddle follow their own retention
          rules.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>
          Subject to applicable law, you have the right to access, rectify, erase, restrict, or port your data, to
          object to processing based on legitimate interests, and to withdraw consent where processing is based on it.
          You can also complain to your local data protection supervisory authority (in Norway, Datatilsynet). Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will respond within one month.
        </p>
      </LegalSection>

      <LegalSection heading="Security">
        <p>
          We use appropriate technical and organisational measures, including encryption in transit, row-level access
          controls in our database, and restricted administrative access. No online service can be completely secure, so
          please use a strong, unique password.
        </p>
      </LegalSection>

      <LegalSection heading="Cookies and local storage">
        <p>
          We use strictly necessary cookies and browser local storage to keep you signed in and to remember your
          session. We do not use advertising cookies. You can clear or block storage in your browser settings, but the
          service will not work while signed out.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          {SELLER_NAME} — <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
