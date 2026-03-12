import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Test Manager | QA Platform for Test Operations",
  description:
    "Centralize test plans, suites, cases, runs, and evidence in one modern test management platform.",
};

export default function Home() {
  return <LandingPage />;
}
