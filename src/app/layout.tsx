import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "VEGORA | The Art of Dressing", template: "%s | VEGORA" },
  description: "Explore VEGORA's considered point of view on dressing for women and men.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
