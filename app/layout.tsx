import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NegoBrief — Know what to negotiate",
  description:
    "An evidence-backed contract negotiation copilot for Indian freelancers. Informational assistance, not legal advice.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
