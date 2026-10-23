import { I18nProvider } from "@/lib/i18n";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import "./globals.css";

export const metadata = {
  title: "Kuuma Obutonde: report pollution",
  description:
    "Take a photo of pollution or damage to the environment, in a street, market, wetland or anywhere else. We record where you are. NEMA reviews it.",
  appleWebApp: { capable: true, title: "Kuuma Obutonde", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1a6b55",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>{children}</I18nProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
