import type { Metadata, Viewport } from "next";
import { Inter, Nunito } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ArtifactPanelProvider } from "@/contexts/artifact-panel-context";
import { ArtifactSidePanel } from "@/components/duckpond/artifact-side-panel";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "The Duck - Natural AI Conversations",
  description: "Your personal duck that quacks back - a friendly AI chat assistant with personalized experiences and model flexibility.",
  keywords: ["AI", "chat", "LLM", "OpenRouter", "Ollama", "conversation", "duck"],
  authors: [{ name: "The Duck Team" }],
  icons: {
    icon: "/duck-favicon.svg",
    shortcut: "/duck-favicon.svg",
    apple: "/duck-favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${nunito.variable} ${inter.variable} font-nunito antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <ArtifactPanelProvider>
              {children}
              <ArtifactSidePanel />
              <Toaster />
            </ArtifactPanelProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
