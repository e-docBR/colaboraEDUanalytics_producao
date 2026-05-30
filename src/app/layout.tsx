import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "colaboraEDU Analytics",
  description: "Analytics escolar para atas, notas, desempenho de alunos e relatórios.",
  keywords: ["colaboraEDU Analytics", "Gestão Escolar", "Dashboard", "Educação", "Notas", "Relatórios"],
  authors: [{ name: "colaboraEDU" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "colaboraEDU Analytics",
    description: "Analytics escolar para atas, notas, desempenho de alunos e relatórios.",
    siteName: "colaboraEDU Analytics",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "colaboraEDU Analytics",
    description: "Analytics escolar para atas, notas, desempenho de alunos e relatórios.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
