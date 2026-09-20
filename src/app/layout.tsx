import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BAD TIMING — Check the date before you send the invitation",
  description: "A pre-invitation checker that finds outside conflicts and proposes the smallest practical adjustment.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
