import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection, SELLER_NAME, SUPPORT_EMAIL } from "@/components/LegalLayout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — ClubCarder" },
      { name: "description", content: "The terms and conditions for using ClubCarder digital loyalty cards, operated by Muzaev AS." },
      { property: "og:title", content: "Terms & Conditions — ClubCarder" },
      { property: "og:description", content: "Terms governing the use of ClubCarder by businesses and customers." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://clubcarder.com/terms" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://clubcarder.com/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalLayout title="Terms & Conditions" updated="30 July 2026">
      <p>
        ClubCarder is operated by <strong className="text-foreground">{SELLER_NAME}</strong> ("we", "us", "ClubCarder").
        These Terms & Conditions govern your use of the ClubCarder website and service at clubcarder.com. By creating an
        account or continuing to use the service, you agree to these terms. If you are using ClubCarder on behalf of a
        business, you confirm you have authority to bind that business; if you use it as an individual, you confirm you
        are of legal age in your country.
      </p>

      <LegalSection heading="1. The service">
        <p>
          ClubCarder provides digital loyalty stamp cards. Businesses design cards and stamp them by scanning customer
          QR codes; customers collect stamps and redeem rewards. Business features are offered on a paid subscription
          with a free trial period. Customer accounts are free.
        </p>
      </LegalSection>

      <LegalSection heading="2. Your account">
        <ul>
          <li>You must provide accurate information and keep it up to date.</li>
          <li>You are responsible for keeping your credentials confidential and for all activity under your account.</li>
          <li>Rewards, offers, and their fulfilment are the sole responsibility of the issuing business, not ClubCarder.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Acceptable use">
        <p>You must not misuse the service. In particular, you must not:</p>
        <ul>
          <li>use ClubCarder for any unlawful purpose, or for fraud, spam, or deceptive offers;</li>
          <li>infringe the intellectual property or privacy rights of others, including uploading logos or artwork you have no right to use;</li>
          <li>interfere with the security or integrity of the service — no malware, probing, scraping, or circumventing technical limits;</li>
          <li>reverse engineer, resell, or redistribute the service.</li>
        </ul>
        <p>
          If you believe content on ClubCarder infringes your rights, contact us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and
          we will review and remove infringing material. Repeat infringers lose access.
        </p>
      </LegalSection>

      <LegalSection heading="4. Licence and intellectual property">
        <p>
          We grant you a limited, non-exclusive, non-transferable right to use ClubCarder within your selected plan.
          {" "}{SELLER_NAME} retains all ownership of the service, its software, documentation, and branding. You keep
          ownership of the content you upload, and grant us a limited licence to host and process it solely to provide
          the service.
        </p>
      </LegalSection>

      <LegalSection heading="5. Service level">
        <p>
          We work to keep ClubCarder available and reliable, but we do not guarantee uninterrupted or error-free
          operation. To the fullest extent permitted by law, all implied warranties, including merchantability and
          fitness for a particular purpose, are disclaimed.
        </p>
      </LegalSection>

      <LegalSection heading="6. Payments, billing and subscriptions">
        <p>
          Subscription pricing is shown on our <a href="/pricing">Pricing page</a>. Subscriptions renew automatically
          each billing period until cancelled, and you can cancel at any time from your billing settings or through the
          customer portal.
        </p>
        <p>
          Payment, billing, tax, cancellation and refund mechanics are handled by Paddle and are governed by the{" "}
          <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer">
            Paddle Buyer Terms
          </a>
          . See also our <a href="/refunds">Refund Policy</a>.
        </p>
      </LegalSection>

      <LegalSection heading="7. Merchant of Record">
        <p>
          Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all
          our orders. Paddle provides all customer service inquiries and handles returns.
        </p>
      </LegalSection>

      <LegalSection heading="8. Suspension and termination">
        <p>
          We may suspend or terminate access for material breach of these terms, non-payment, security or fraud risk, or
          repeated or serious policy violations. You may stop using the service at any time. When a business
          subscription ends, card stamping is paused, but existing cardholders can still view their cards and redeem
          rewards they have already earned. On account deletion, we remove or anonymise your data as described in our{" "}
          <a href="/privacy">Privacy Notice</a>.
        </p>
      </LegalSection>

      <LegalSection heading="9. Liability">
        <p>
          To the extent permitted by law, our aggregate liability is limited to the fees you paid in the 12 months
          before the claim, and we exclude indirect, consequential, or special damages including loss of profits, data,
          or goodwill. Nothing in these terms limits liability for fraud, death, or personal injury caused by
          negligence. You indemnify us against claims arising from your content, your unlawful use, or your breach of
          these terms.
        </p>
      </LegalSection>

      <LegalSection heading="10. General">
        <p>
          These terms are governed by the laws of Norway, and disputes fall to the courts of Norway, unless mandatory
          local law says otherwise. You may not assign these terms without our consent; we may assign them in a merger
          or acquisition. Neither party is liable for delays caused by events beyond its reasonable control. We may
          update these terms and will post the revised version here with a new date.
        </p>
      </LegalSection>

      <LegalSection heading="11. Contact">
        <p>
          {SELLER_NAME} — <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
