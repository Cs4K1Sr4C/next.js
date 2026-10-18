import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orders | Next.js with NestJS microservices",
  description:
    "A Next.js frontend for a NestJS gateway, an orders microservice and a BullMQ worker.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
