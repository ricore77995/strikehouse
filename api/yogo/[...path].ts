import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawUrl = req.url || "";
  const yogoPathAndQuery = rawUrl.replace(/^\/api\/yogo\//, "");
  const targetUrl = `https://api.yogo.dk/${yogoPathAndQuery}`;

  const response = await fetch(targetUrl, {
    headers: {
      accept: "application/json",
      origin: "https://strikershouse.yogobooking.pt",
      referer: "https://strikershouse.yogobooking.pt/",
    },
  });

  const data = await response.text();

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=60");
  res.status(response.status).send(data);
}
