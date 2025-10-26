import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Chat with Maps - Powered by Google AI",
  description: "Interactive AI chat with integrated Google Maps for location-based queries",
  keywords: "AI chat, Google Maps, Gemini, chatbot, location search",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-gray-900 text-white">
        {children}
      </body>
    </html>
  );
}
