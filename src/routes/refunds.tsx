import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection, SELLER_NAME, SUPPORT_EMAIL } from "@/components/LegalLayout";

export const Route = createFileRoute("/refunds")({
  head: () => ({
    meta: [
      { title: "Refund Policy — Clubcarder" },
      { name: "description", content: "Clubcarder offers a 30-day money-back guarantee on business subscriptions. Refunds are handled by Paddle." },
      { property: "og:title", content: "Refund Policy — Clubcarder" },
      { property: "og:description", content: "30-day money-back guarantee on Clubcarder business subscriptions." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://clubcarder.com/refunds" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://clubcarder.com/refunds" }],
  }),
  component: RefundsPage,
});

function RefundsPage() {
  return (
    <LegalLayout title="Refund Policy" updated="30 July 2026">
      <p>
        Clubcarder is operated by <strong className="text-foreground">{SELLER_NAME}</strong>. We want you to be happy
        with your subscription.
      </p>

      <LegalSection heading="30-day money-back guarantee">
        <p>
          If you are not satisfied with your Clubcarder business subscription, you can request a full refund within
          30 days of your order date. This applies to change of mind as well as technical problems we cannot resolve.
        </p>
      </LegalSection>

      <LegalSection heading="How to request a refund">
        <p>
          Refunds are processed by our payment provider and Merchant of Record, Paddle. To request one, visit{" "}
          <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">paddle.net</a> with your order email or
          receipt, or email us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will arrange it for
          you.
        </p>
      </LegalSection>

      <LegalSection heading="Cancellations and renewals">
        <p>
          You can cancel your subscription at any time from your billing settings. Cancelling stops future renewals; you
          keep access until the end of the period you have already paid for. Refunds outside the 30-day window are
          considered case by case — just get in touch.
        </p>
        <p>
          Full details of Paddle's handling of refunds are in the{" "}
          <a href="https://www.paddle.com/legal/refund-policy" target="_blank" rel="noopener noreferrer">
            Paddle Refund Policy
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
