import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";
import "./resume.css";
import "./print.css";

/**
 * The resume font. Swap the import and this call to change it; everything else
 * reads the --font-resume-serif variable through app/resume.css.
 */
const resumeSerif = Source_Serif_4({
  variable: "--font-resume-serif",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Resume Builder",
  description: "Local resume builder with a live, print-accurate preview.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${resumeSerif.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
