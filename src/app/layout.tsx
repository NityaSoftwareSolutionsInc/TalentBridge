import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { RequestLoaderProvider } from "@/components/RequestLoader";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TalentBridge",
  description: "Staffing relationship workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <RequestLoaderProvider>{children}</RequestLoaderProvider>
      </body>
    </html>
  );
}
