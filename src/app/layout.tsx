import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import "./globals.css";
import "@/styles/figma-cursor.css";
import { FigmaCursor } from "@/components/shell/figma-cursor";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "RealSite — Virtual Property Tours",
  description: "AI spatial sales infrastructure for real estate developers",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "RealSite" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('realsite-sidebar-mode');document.documentElement.classList.toggle('dark',m==='dark');document.documentElement.classList.toggle('light',m!=='dark');document.documentElement.style.colorScheme=m==='dark'?'dark':'light';}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${geistMono.variable} font-sans bg-background text-foreground antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <TooltipProvider>
            <FigmaCursor />
            {children}
            <Toaster
              richColors
              closeButton
              position="top-center"
              expand
              visibleToasts={4}
              offset={16}
              toastOptions={{
                duration: 5000,
                classNames: {
                  toast: "realsite-toast",
                  title: "realsite-toast__title",
                  description: "realsite-toast__description",
                  success: "realsite-toast--success",
                  error: "realsite-toast--error",
                },
              }}
            />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
