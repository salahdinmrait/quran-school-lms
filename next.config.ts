import type { NextConfig } from "next";

// Beveiligingsheaders op elk antwoord. Bewust zonder script-src: de oude
// webpagina's en /dev draaien op Next.js, dat inline scripts gebruikt. De
// strikte CSP voor de webapp staat in quran-school-app/vercel.json; de waarden
// hieronder zijn daar gelijk aan, omdat de webapp /api en /dev doorstuurt.
const beveiligingsheaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: beveiligingsheaders }];
  },
};

export default nextConfig;
