import type { Metadata } from "next";
import { Inter, Manrope, Source_Serif_4 } from "next/font/google";
import { RequestLoaderProvider } from "@/components/RequestLoader";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-auth-sans",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-auth-display",
  display: "swap",
});

const siteUrl = (process.env.APP_BASE_URL || "http://localhost:3011").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TalentBridge",
    template: "%s · TalentBridge",
  },
  description:
    "Staffing relationship workspace — candidates, clients, submissions and next actions in one hub.",
  applicationName: "TalentBridge",
  keywords: ["TalentBridge", "Contact Manager", "staffing", "recruiting", "submissions"],
  authors: [{ name: "TalentBridge" }],
  creator: "TalentBridge",
  publisher: "TalentBridge",
  icons: {
    icon: [
      { url: "/favicon-v2.ico", sizes: "16x16" },
      { url: "/favicon-v2.ico", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon-v2.ico"],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "TalentBridge",
    title: "TalentBridge · Contact Manager",
    description:
      "The staffing relationship hub. Connect candidates, clients, requirements and submissions with a mandatory next action.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "TalentBridge Contact Manager",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TalentBridge · Contact Manager",
    description:
      "The staffing relationship hub. Connect candidates, clients, requirements and submissions with a mandatory next action.",
    images: [
      {
        url: "/twitter-image",
        width: 1200,
        height: 630,
        alt: "TalentBridge Contact Manager",
      },
    ],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} ${sourceSerif.variable}`}>
      <body className="font-sans antialiased">
        <RequestLoaderProvider>{children}</RequestLoaderProvider>
      </body>
    </html>
  );
}
