import { createFileRoute } from "@tanstack/react-router";
import { CustomerVouchers } from "@/components/CustomerVouchers";

export const Route = createFileRoute("/_authenticated/vouchers")({
  head: () => ({
    meta: [
      { title: "My vouchers — ClubCarder" },
      { name: "description", content: "All the rewards you've unlocked: show a voucher to the business to redeem it." },
      { property: "og:title", content: "My vouchers — ClubCarder" },
      { property: "og:description", content: "All the rewards you've unlocked with your ClubCarder loyalty cards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerVouchers,
});
