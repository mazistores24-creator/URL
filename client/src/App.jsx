import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function App() {
  const [url, setUrl] = useState("");
  const [links, setLinks] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState("");

  async function loadLinks() {
    try {
      const response = await fetch(`${API_URL}/api/links`);
      if (!response.ok) throw new Error("Could not load links.");
      setLinks(await response.json());
    } catch {
      setError("Could not connect to the server. Check that the backend is running.");
    }
  }

  useEffect(() => {
    loadLinks();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not shorten that URL.");
      }

      setUrl("");
      await loadLinks();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(link) {
    try {
      await navigator.clipboard.writeText(link.shortUrl);
      setCopiedCode(link.code);
      window.setTimeout(() => setCopiedCode(""), 1800);
    } catch {
      setError("Could not copy the link. You can select and copy it manually.");
    }
  }

  return (
    <main className="container py-5">
      <header className="text-center mb-5">
        <div className="brand-mark" aria-hidden="true">↗</div>
        <p className="eyebrow mb-2">LINKSHORT</p>
        <h1 className="display-5 fw-bold">Make your links shorter.</h1>
        <p className="text-secondary">
          Turn a long URL into a short link you can share anywhere.
        </p>
      </header>

      <section className="card composer-card mx-auto mb-5">
        <div className="card-body p-4 p-md-5">
          <form onSubmit={handleSubmit}>
            <label htmlFor="url" className="form-label fw-semibold">
              Paste your long URL
            </label>
            <div className="input-group input-group-lg">
              <input
                id="url"
                className="form-control"
                type="url"
                placeholder="https://example.com/your/very/long/link"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
              />
              <button className="btn btn-primary px-4" disabled={loading}>
                {loading ? "Creating…" : "Shorten link"}
              </button>
            </div>
            {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
          </form>
        </div>
      </section>

      <section className="mx-auto links-section">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 fw-bold mb-0">Your links</h2>
          <span className="badge rounded-pill text-bg-light">
            {links.length} total
          </span>
        </div>

        {links.length === 0 ? (
          <div className="empty-state text-center p-5">
            <div className="empty-icon">↗</div>
            <h3 className="h6 fw-bold mt-3">No links yet</h3>
            <p className="text-secondary mb-0">
              Your shortened links will show up here.
            </p>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {links.map((link) => (
              <article className="card link-card" key={link.code}>
                <div className="card-body p-3 p-md-4">
                  <div className="d-flex flex-column flex-md-row justify-content-between gap-3">
                    <div className="min-w-0">
                      <a
                        className="short-link fw-semibold"
                        href={link.shortUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {link.shortUrl}
                      </a>
                      <div className="original-url text-secondary text-truncate mt-1">
                        {link.originalUrl}
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-3">
                      <div className="click-count text-center">
                        <strong>{link.clicks}</strong>
                        <span>clicks</span>
                      </div>
                      <button
                        className="btn btn-outline-primary"
                        type="button"
                        onClick={() => copyLink(link)}
                      >
                        {copiedCode === link.code ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="text-center text-secondary small mt-5">
        Links and click counts are saved in your local database.
      </footer>
    </main>
  );
}