import type { Metadata } from "next";
import "./globals.css";
import { ConnectionStatus } from "@/components/connection-status";
export const metadata: Metadata = {
  title: "Weekly — Your adaptive planner",
  description: "Space for the week ahead.",
  appleWebApp: { capable: true, title: "Weekly", statusBarStyle: "default" },
  icons: { apple: "/icon-192.png" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body>
        <ConnectionStatus />
        {children}
      </body>
    </html>
  );
}
