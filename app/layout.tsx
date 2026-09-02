import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mid UI",
  description: "Mid UI component library.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en"><body>{children}</body></html>
  );
}
