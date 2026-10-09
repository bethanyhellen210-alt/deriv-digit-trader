// Vercel serverless endpoint. Configure LICENSE_KEY in Vercel Project Settings > Environment Variables.
module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const expected = process.env.LICENSE_KEY;
  if (!expected) {
    return res.status(503).json({ ok: false, error: "License key is not configured by the site owner." });
  }
  const supplied = typeof req.body?.key === "string" ? req.body.key : "";
  if (supplied.length !== expected.length || supplied !== expected) {
    return res.status(401).json({ ok: false, error: "Invalid access key." });
  }
  return res.status(200).json({ ok: true });
};
