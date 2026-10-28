// STATIC_EXPORT=1 builds a plain static site into ./out (used by `npm run package:linux`).
// Every page is client-rendered and data lives in localStorage, so no server code is needed.
const staticExport = process.env.STATIC_EXPORT === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(staticExport && {
    output: "export",
    // Emit /expenses/index.html instead of /expenses.html so any simple file server can serve it.
    trailingSlash: true,
    images: { unoptimized: true },
  }),
};

export default nextConfig;
