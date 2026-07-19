import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import ChatBotComponent from "./components/ChatBot/ChatBootComponent";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://editech.dev"),
  title: {
    default: "Edison Dev | Full Stack Developer & Ethical Hacker",
    template: "%s | Edison Dev",
  },
  description: "Portfolio of Edison, a Full Stack Developer specializing in modern web technologies and Ethical Hacking.",
  keywords: ["Full Stack Developer", "Ethical Hacker", "React", "Next.js", "Cybersecurity", "Web Development", "Edison Dev"],
  authors: [{ name: "Edison Dev" }],
  creator: "Edison Dev",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Edison Dev | Full Stack Developer",
    description: "Portfolio of Edison, a Full Stack Developer and Ethical Hacker.",
    siteName: "Edison Dev",
    images: [
      {
        url: "/og-image.png", // Ensure this image exists in public/
        width: 1200,
        height: 630,
        alt: "Edison Dev Portfolio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Edison Dev | Full Stack Developer",
    description: "Portfolio of Edison, a Full Stack Developer and Ethical Hacker.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Edison Dev",
  "url": "https://editech.dev",
  "jobTitle": "Full Stack Developer & Ethical Hacker",
  "sameAs": [
    "https://github.com/editech-dev",
    // Add other social links if available
  ]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-green-400 focus:text-black focus:font-semibold focus:rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
        >
          Skip to content
        </a>
        <main id="main-content">
          {children}
        </main>
        <ChatBotComponent />
        <SpeedInsights />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
