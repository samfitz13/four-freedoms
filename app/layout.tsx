import type { Metadata } from "next";
import Script from "next/script";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "freedom-four — Four freedoms. One instrument.",
    template: "%s · freedom-four",
  },
  description:
    "A personal instrument for Financial, Location, Time, and Health freedom. Measure. Reflect. Compound.",
  metadataBase: new URL("https://freedom-four.app"),
  openGraph: {
    title: "freedom-four",
    description: "Four freedoms. One instrument.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <Script id="theme-preference" strategy="beforeInteractive">
          {`try {
            const theme = localStorage.getItem("freedom-four-theme");
            if (theme === "light" || theme === "dark") {
              document.documentElement.classList.add(theme);
            }
            const glass = localStorage.getItem("freedom-four-glass");
            if (glass === "full" || glass === "solid") {
              document.documentElement.dataset.glass = glass;
            }
          } catch { /* System preference still works without storage. */ }`}
        </Script>
      </head>
      <body className="antialiased">
        <div className="daybreak-scene" aria-hidden />
        {children}
      </body>
    </html>
  );
}
