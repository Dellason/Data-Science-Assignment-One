import { useEffect, useMemo, useState } from "react";
import { MONTHS, PAGES_PER_QUARTER, euro, type Listing } from "./data";

type Request = { quarter: number; page: number; found: number | null };

function crawl(listings: Listing[]): Request[] {
  const requests: Request[] = [];
  PAGES_PER_QUARTER.forEach((pages, q) => {
    const total = listings.filter(l => Math.floor(l.month / 3) === q).length;
    for (let p = 1; p <= pages; p++) {
      // The notebook records totals, not per-page counts, so spread them evenly.
      const found = Math.floor(total / pages) + (p <= total % pages ? 1 : 0);
      requests.push({ quarter: q + 1, page: p, found });
    }
    requests.push({ quarter: q + 1, page: pages + 1, found: null });
  });
  return requests;
}

const url = (r: Request) => `Q${r.quarter}-page${String(r.page).padStart(2, "0")}.html`;

export function ScraperReplay({ listings }: { listings: Listing[] }) {
  const requests = useMemo(() => crawl(listings), [listings]);
  const [done, setDone] = useState(0);
  const [playing, setPlaying] = useState(false);
  const finished = done >= requests.length;

  useEffect(() => {
    if (!playing || finished) return;
    const id = window.setInterval(() => setDone(d => Math.min(d + 1, requests.length)), 70);
    return () => window.clearInterval(id);
  }, [playing, finished, requests.length]);

  const shown = requests.slice(0, done);
  const parsed = shown.reduce((sum, r) => sum + (r.found ?? 0), 0);
  const log = shown.slice(-14);

  return (
    <div className="grid-2">
      <div className="panel" style={{ display: "grid", gap: 18, alignContent: "start" }}>
        <div className="stat-row" style={{ margin: 0 }}>
          <div className="stat"><b>{shown.filter(r => r.found !== null).length}</b><span>pages read</span></div>
          <div className="stat"><b>{parsed.toLocaleString("en-IE")}</b><span>listings parsed</span></div>
          <div className="stat"><b>{shown.filter(r => r.found === null).length}</b><span>404s, one per quarter</span></div>
        </div>
        <div className="quarters" aria-label="Pages per quarter">
          {PAGES_PER_QUARTER.map((pages, q) => {
            const mine = shown.filter(r => r.quarter === q + 1);
            return (
              <div className="quarter" key={q}>
                <b>Q{q + 1}</b>
                <div className="pages" aria-hidden="true">
                  {Array.from({ length: pages + 1 }, (_, i) => {
                    const r = mine[i];
                    return <i key={i} className={r ? (r.found === null ? "miss" : "done") : ""} />;
                  })}
                </div>
                <span className="small muted">{mine.filter(r => r.found !== null).length} of {pages}</span>
              </div>
            );
          })}
        </div>
        <div className="row">
          <button type="button" className="button" onClick={() => { if (finished) setDone(0); setPlaying(p => finished || !p); }}>
            {playing && !finished ? "Pause" : finished ? "Replay the crawl" : done ? "Resume" : "Run the scraper"}
          </button>
          <button type="button" className="button ghost" disabled={finished} onClick={() => { setPlaying(false); setDone(d => d + 1); }}>Next request</button>
          <button type="button" className="button ghost" onClick={() => { setPlaying(false); setDone(requests.length); }}>Skip to the end</button>
        </div>
        <p className="small muted">
          The page counts and 404s are the ones the real crawl hit. The site has since gone offline, so this replays the crawl rather than repeating it.
        </p>
      </div>
      <div className="terminal" role="log" aria-live="off" aria-label="Scraper request log">
        {log.length === 0 && <span className="dim">$ python collect_rental_data.py</span>}
        {log.map(r => (
          <div key={url(r)}>
            <span className="dim">GET </span>{url(r)}{" "}
            {r.found === null
              ? <span className="miss">404 Not Found → next quarter</span>
              : <span className="ok">200 · {r.found} listings</span>}
          </div>
        ))}
        {finished && <div className="ok">Saved {parsed.toLocaleString("en-IE")} rows to dublin_rental_listings.csv</div>}
      </div>
    </div>
  );
}

function markup(l: Listing) {
  const rows: [string, string | null][] = [
    ["Price", `€${l.price.toLocaleString("en-IE")} per month`],
    ["Location", `${l.rawLocation ?? l.location}${l.postcode ? ` — ${l.postcode}` : ""}`],
    ["Bedrooms", String(l.bedrooms)],
    ["Bathrooms", String(l.bathrooms)],
    ["Parking", l.parkingImputed ? null : l.parking ? "Yes" : "No"],
    ["Garden", l.gardenRule ? null : l.garden ? "Yes" : "No"],
    ["Lease Length", l.leaseImputed ? null : `${l.lease} months`],
    ["Contact", l.rawContact ?? (l.agent ? "Estate Agent" : "Owner")],
  ];
  return rows;
}

export function ParseDemo({ listings }: { listings: Listing[] }) {
  // Start on a listing whose raw text needed cleaning, so the demo has something to show.
  const interesting = useMemo(() => listings.filter(l => l.rawLocation || l.parkingImputed || l.gardenRule || l.leaseImputed), [listings]);
  const [index, setIndex] = useState(0);
  const l = interesting[index % interesting.length] ?? listings[0];
  const rows = markup(l);
  const next = () => setIndex(i => (i * 7 + 13) % interesting.length);

  return (
    <div className="grid-2" style={{ marginTop: 28 }}>
      <div className="panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ fontSize: "var(--step-0)" }}>One listing, as the page served it</h3>
          <button type="button" className="button ghost" onClick={next}>Show another listing</button>
        </div>
        <div className="code-block" aria-label="Listing markup">
{`<li>
  <span class="record">${MONTHS[l.month]} 2025 — ${l.type}</span>
  <table>
${rows.filter(([, v]) => v !== null).map(([k, v], i) => `    <tr><td class="v${(i % 2) + 1}">${k}</td><td>${v}</td></tr>`).join("\n")}
  </table>
</li>`}
        </div>
        <p className="small muted">Markup rebuilt from this listing's values, following the page structure documented in the collection notebook. Missing rows are the gaps cleaning had to fill.</p>
      </div>
      <div className="panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
        <h3 style={{ fontSize: "var(--step-0)" }}>The row it became</h3>
        <table className="data">
          <tbody>
            <tr><th>Month</th><td>{MONTHS[l.month]}</td><td className="muted">split from the header</td></tr>
            <tr><th>Type</th><td>{l.type}</td><td className="muted">split from the header</td></tr>
            <tr><th>Price</th><td>{euro(l.price)}</td><td className="muted">text stripped, kept as a number</td></tr>
            <tr><th>Location</th><td>{l.location}</td><td className="muted">{l.rawLocation ? <>was <code>{l.rawLocation}</code></> : "already standard"}</td></tr>
            <tr><th>Postcode</th><td>{l.postcode ?? "—"}</td><td className="muted">{l.postcode ? "split after the dash" : "County Dublin has none"}</td></tr>
            <tr><th>Parking</th><td>{l.parking ? "Yes" : "No"}</td><td className="muted">{l.parkingImputed ? "missing; predicted by a model" : "as listed"}</td></tr>
            <tr><th>Garden</th><td>{l.garden ? "Yes" : "No"}</td><td className="muted">{l.gardenRule === "apartment" ? "missing; apartments have none" : l.gardenRule ? "missing; houses almost always do" : "as listed"}</td></tr>
            <tr><th>Lease</th><td>{l.lease} months</td><td className="muted">{l.leaseImputed ? "missing; the median and mode" : "as listed"}</td></tr>
            <tr><th>Contact</th><td>{l.agent ? "Estate Agent" : "Owner"}</td><td className="muted">{l.rawContact ? "double space removed" : "as listed"}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
