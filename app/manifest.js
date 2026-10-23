// Served by Next.js at /manifest.webmanifest. Lets phones install the app
// ("Add to Home screen") and open it full screen like a normal app.
export default function manifest() {
  return {
    name: "Kuuma Obutonde: report pollution",
    short_name: "Kuuma Obutonde",
    description:
      "Report pollution or damage to the environment to NEMA, even without signal.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f7f3",
    theme_color: "#1a6b55",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
