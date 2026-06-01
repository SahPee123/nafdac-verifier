import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NAFDAC Verify",
  description: "Verify if a product is NAFDAC approved — Nigeria's Registered Product Checker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
