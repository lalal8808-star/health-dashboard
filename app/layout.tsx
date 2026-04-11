import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWAManager from "./components/PWAManager";

export const metadata: Metadata = {
  title: "HealthLens AI - 멀티모달 건강 지표 분석 대시보드",
  description: "건강검진 결과지와 인바디 체성분 분석 결과를 AI가 분석하여 맞춤형 운동·식단 가이드를 제공하는 대사 관리 대시보드",
  keywords: ["건강", "인바디", "체성분", "AI", "대시보드", "운동", "식단"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HealthLens AI",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#38bdf8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <meta name="application-name" content="HealthLens AI" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="HealthLens AI" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/none" />
        <meta name="msapplication-TileColor" content="#0a0e1a" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body>
        <PWAManager />
        {children}
      </body>
    </html>
  );
}
