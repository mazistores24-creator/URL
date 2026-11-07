import express from "express";
import cors from "cors";
import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

const database = new DatabaseSync("./urls.db");

database.exec(`
  CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    original_url TEXT NOT NULL,
    clicks INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const insertLink = database.prepare(
  "INSERT INTO links (code, original_url) VALUES (?, ?)"
);
const findLink = database.prepare(
  "SELECT code, original_url, clicks, created_at FROM links WHERE code = ?"
);
const listLinks = database.prepare(
  "SELECT code, original_url, clicks, created_at FROM links ORDER BY id DESC"
);
const incrementClicks = database.prepare(
  "UPDATE links SET clicks = clicks + 1 WHERE code = ?"
);

function createCode(length = 7) {
  const alphabet =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = randomBytes(length);

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function getBaseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

// Create a short link
app.post("/api/links", (req, res) => {
  const { url } = req.body ?? {};

  if (typeof url !== "string" || url.length > 2048) {
    return res.status(400).json({ error: "Enter a URL under 2,048 characters." });
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: "Enter a valid URL." });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: "Only HTTP and HTTPS links are allowed." });
  }

  // Retry in the unlikely event that a generated code already exists.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createCode();

    try {
      insertLink.run(code, parsedUrl.toString());

      return res.status(201).json({
        code,
        originalUrl: parsedUrl.toString(),
        shortUrl: `${getBaseUrl(req)}/${code}`,
        clicks: 0
      });
    } catch (error) {
      if (!String(error.message).includes("UNIQUE")) {
        console.error(error);
        return res.status(500).json({ error: "Could not save the link." });
      }
    }
  }

  return res.status(500).json({ error: "Could not generate a unique link. Try again." });
});

// List links and click counts
app.get("/api/links", (req, res) => {
  const links = listLinks.all().map((link) => ({
    code: link.code,
    originalUrl: link.original_url,
    shortUrl: `${getBaseUrl(req)}/${link.code}`,
    clicks: link.clicks,
    createdAt: link.created_at
  }));

  res.json(links);
});

// Redirect and count the click
app.get("/:code", (req, res) => {
  const link = findLink.get(req.params.code);

  if (!link) {
    return res.status(404).send("This short link was not found.");
  }

  incrementClicks.run(req.params.code);
  return res.redirect(302, link.original_url);
});

app.listen(PORT, () => {
  console.log(`URL Shortener API running at http://localhost:${PORT}`);
});