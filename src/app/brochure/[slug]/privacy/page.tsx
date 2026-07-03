"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import "@/styles/brochure-intelligence.css";

type PublicBrochure = {
  title: string;
  slug: string;
  page_count: number;
  viewer_mode: string;
};

export default function BrochurePrivacyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [brochure, setBrochure] = useState<PublicBrochure | null>(null);

  useEffect(() => {
    void fetch(`/api/brochures/public/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setBrochure(data);
      })
      .catch(() => setBrochure(null));
  }, [slug]);

  const items = [
    "Your name, phone number, and optional email when you submit the form.",
    "Basic brochure usage information, such as pages opened and sections visible on screen.",
    "Actions you choose, such as download, call, WhatsApp, enquiry, or site visit buttons.",
    "Device and source details, such as mobile or desktop, browser, campaign source, and referrer.",
  ];

  const rights = [
    "Ask the company for access to your information.",
    "Ask for correction or deletion where applicable.",
    "Ask the team to stop follow-up communication.",
    "Use the brochure without any hidden background collection before you give consent.",
  ];

  return (
    <main className="bi-privacy-page">
      <section className="bi-privacy-card">
        <Link href={`/brochure/${slug}`} className="bi-privacy-back">
          <ArrowLeft className="h-4 w-4" />
          Back to brochure
        </Link>

        <div className="bi-public-badge mt-6">
          <ShieldCheck className="h-4 w-4" />
          Data-use details
        </div>
        <h1>{brochure?.title ?? "Smart Brochure"}</h1>
        <p className="bi-privacy-intro">
          This page explains what information is used when you choose to open the smart brochure. The goal is to help
          the team respond with relevant details about pricing, layouts, availability, or site visits.
        </p>

        <div className="bi-privacy-summary">
          <span><FileText className="h-4 w-4" /> {brochure?.page_count ?? "—"} pages</span>
          <span>{brochure?.viewer_mode === "flipbook" ? "Flipbook" : "PDF"} viewer</span>
          <span>Consent required before viewing</span>
        </div>

        <div className="bi-privacy-grid">
          <div>
            <h2>Information used</h2>
            <ul>
              {items.map((item) => (
                <li key={item}>
                  <CheckCircle2 className="h-4 w-4" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Your choices</h2>
            <ul>
              {rights.map((item) => (
                <li key={item}>
                  <CheckCircle2 className="h-4 w-4" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bi-privacy-note">
          We do not show raw IP addresses to sales users. The brochure is designed for consent-based follow-up, not
          hidden surveillance.
        </div>
      </section>
    </main>
  );
}
