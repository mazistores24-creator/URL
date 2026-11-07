import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import { randomBytes } from "node:crypto";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173"
}));
app.use(express.json());

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("MONGODB_URI environment variable is required.");
  process.exit(1);
}

const client = new MongoClient(mongoUri);
let links;

function createCode(length = 7) {
  const alphabet =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = randomBytes(length);

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function getBaseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Create a short link
app.post("/api/links", async (req, res) => {
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

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const link = {
      code: createCode(),
      originalUrl: parsedUrl.toString(),
      clicks: 0,
      createdAt: new Date()
    };

    try {
      await links.insertOne(link);

      return res.status(201).json({
        ...link,
        shortUrl: `${getBaseUrl(req)}/${link.code}`
      });
    } catch (error) {
      // MongoDB error 11000 means a generated code already exists.
      if (error.code !== 11000) {
        console.error(error);
        return res.status(500).json({ error: "Could not save the link." });
      }
    }
  }

  return res.status(500).json({
    error: "Could not generate a unique link. Try again."
  });
});

// List links and click counts
app.get("/api/links", async (req, res) => {
  try {
    const records = await links.find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(records.map((link) => ({
      code: link.code,
      originalUrl: link.originalUrl,
      shortUrl: `${getBaseUrl(req)}/${link.code}`,
      clicks: link.clicks,
      createdAt: link.createdAt
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load links." });
  }
});

// Redirect and count the click
app.get("/:code", async (req, res) => {
  try {
    const link = await links.findOneAndUpdate(
      { code: req.params.code },
      { $inc: { clicks: 1 } },
      { returnDocument: "before" }
    );

    if (!link) {
      return res.status(404).send("This short link was not found.");
    }

    return res.redirect(302, link.originalUrl);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Could not open this short link.");
  }
});

async function start() {
  try {
    await client.connect();

    const database = client.db("url_shortener");
    links = database.collection("links");

    await links.createIndex({ code: 1 }, { unique: true });

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`URL Shortener API listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Could not start the server:", error);
    process.exit(1);
  }
}

start();