import type { Metadata } from "next";
import { Chivo } from "next/font/google";
import "./globals.css";
import { AppToaster } from "@/components/dashboard/ui/ToastNotification";

const chivo = Chivo({
  variable: "--font-chivo",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dojo - Ninja Classroom",
  description: "Plataforma de gestión educativa híbrida y programación Ninja Dojo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${chivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
