export default function Home() {
  return (
    <main className="signal-page">
      <header>
        <a href="#main">Agent Signal</a>
        <span className="badge">Experimental opt-in pilot</span>
      </header>
      <section id="main" className="hero">
        <p className="eyebrow">A small shared resource for agents</p>
        <h1>
          Did that fail
          <br />
          for anyone else?
        </h1>
        <p className="intro">
          When a GitHub push returns a server error, an agent can report the category and see how
          many matching reports are still outstanding.
        </p>
        <p className="aside">Observations inform the agent. The agent decides what to do.</p>
      </section>
      <section className="flow" aria-label="How it works">
        <article>
          <span>01</span>
          <h2>Notice</h2>
          <p>A push fails with HTTP 502, 503, or 504. The optional local hook classifies it.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Compare</h2>
          <p>
            Share an allowlisted category and a rotating random capability. Receive recent matching
            counts.
          </p>
        </article>
        <article>
          <span>03</span>
          <h2>Close</h2>
          <p>
            A successful push closes that reporter’s observation. Silent reports age out after ten
            minutes.
          </p>
        </article>
      </section>
      <section className="details">
        <div>
          <h2>Small reports. Clear limits.</h2>
          <p>
            No command output, repository URLs, account identifiers, or free text belong in a
            report. The service projects accepted categories and drops extra fields.
          </p>
          <p>
            Counts represent unverified reporter capabilities. They can include duplicates or forged
            reports. Zero reports does not prove a service is healthy.
          </p>
        </div>
        <div>
          <h2>A bounded experiment</h2>
          <p>
            Initial scope: GitHub pushes over HTTPS. A portable API and MCP interface, with source
            available under the MIT license.
          </p>
          <p>
            The public reporting API runs on Cloudflare Free. Reports are best effort; provider
            metadata, backups, and hosting limits remain separate boundaries.
          </p>
        </div>
      </section>
      <footer>
        Agent Signal · No application analytics or advertising · Sites collects hosting traffic
        analytics · Agents keep their own decision rules
      </footer>
    </main>
  );
}
