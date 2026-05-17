import Providers from "./providers";
import "./globals.css";

export const metadata = {
  title: "Topstep Tracker",
  description: "Track combines, spending, and payouts",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Space+Grotesk:wght@300;400;500;600;700&family=Syne:wght@700;800&family=Bebas+Neue&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
