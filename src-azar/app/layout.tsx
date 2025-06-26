import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "SnapPair: Video Chat with New People | Connect Instantly",
  description:
    "A leading global video chat platform for online meeting experiences (OME). Discover 1v1 video chat for instant connections with new people.",
  keywords:
    "video chat, meet new people, online chat, webcam chat, random chat, video call, social networking",
  authors: [{ name: "SnapPair LLC" }],
  creator: "SnapPair LLC",
  publisher: "SnapPair LLC",
  robots: "index, follow",
  metadataBase: new URL("https://snappair.com"),
  icons: {
    icon: "/logo-circle.png",
    shortcut: "/logo-circle.png",
    apple: "/logo-circle.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://snappair.com",
    siteName: "SnapPair",
    title: "SnapPair: Video Chat with New People | Connect Instantly",
    description:
      "A leading global video chat platform for online meeting experiences (OME). Discover 1v1 video chat for instant connections with new people.",
    images: [
      {
        url: "/logo-circle.png",
        width: 512,
        height: 512,
        alt: "SnapPair Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    site: "@snappair",
    creator: "@snappair",
    title: "SnapPair: Video Chat with New People | Connect Instantly",
    description:
      "A leading global video chat platform for online meeting experiences (OME). Discover 1v1 video chat for instant connections with new people.",
    images: ["/logo-circle.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} font-sans bg-black text-white min-h-screen`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
