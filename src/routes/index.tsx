import { createFileRoute } from "@tanstack/react-router";
import { RosterApp } from "@/components/roster/RosterApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pöttyös Beosztás – laboráns műszakbeosztó" },
      {
        name: "description",
        content:
          "Kéthavi munkaidőkeretes műszakbeosztás tejüzemi laboránsoknak: 7/19/8/4 műszakok, SZ/B/X/HO távollétek, napi létszám-ellenőrzés.",
      },
      { property: "og:title", content: "Pöttyös Beosztás – laboráns műszakbeosztó" },
      {
        property: "og:description",
        content: "Igazságos havi beosztás a valós kéthavi keret, előzmények és távollétek alapján.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RosterApp,
});
