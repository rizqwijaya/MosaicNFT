import type { Handler } from "@netlify/functions";

// IPFS pinning proxy (§6a). Keeps the Pinata JWT server-side so it never
// reaches the browser. Accepts:
//   POST /api/pin?kind=file  (multipart form, field "file")
//   POST /api/pin?kind=json  (application/json metadata body)
// Returns { uri: "ipfs://<cid>" }.

const PINATA_JWT = process.env.PINATA_JWT;
const PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PIN_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }
  if (!PINATA_JWT) {
    return { statusCode: 500, body: "PINATA_JWT not configured" };
  }

  const kind = event.queryStringParameters?.kind ?? "json";

  try {
    if (kind === "json") {
      const metadata = JSON.parse(event.body || "{}");
      const res = await fetch(PIN_JSON_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PINATA_JWT}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pinataContent: metadata }),
      });
      if (!res.ok) return { statusCode: 502, body: await res.text() };
      const { IpfsHash } = (await res.json()) as { IpfsHash: string };
      return json({ uri: `ipfs://${IpfsHash}` });
    }

    // kind === "file": forward the incoming multipart body to Pinata.
    const contentType =
      event.headers["content-type"] || event.headers["Content-Type"] || "";
    const body = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64")
      : Buffer.from(event.body || "", "utf8");

    const res = await fetch(PIN_FILE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        "Content-Type": contentType,
      },
      body,
    });
    if (!res.ok) return { statusCode: 502, body: await res.text() };
    const { IpfsHash } = (await res.json()) as { IpfsHash: string };
    return json({ uri: `ipfs://${IpfsHash}` });
  } catch (err) {
    return { statusCode: 500, body: String(err) };
  }
};

function json(obj: unknown) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}
