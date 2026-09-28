# Dublin rent, door by door

An interactive site for the Dublin rental analysis. Visitors set a budget and watch a door map of Dublin's postcodes light up, explore any area's listings, estimate a rent with a model trained on the data, replay the scraper's crawl, and flip the cleaning decisions to see what they changed.

**Live:** https://jjmensah.github.io/enam_portfolio/lab/dublin/, served from the portfolio's `public/lab/dublin/`. Run `npm run lab:dublin` in `enam_portfolio` to publish a new build.

## Sections

| Section | What it does |
| --- | --- |
| Door map | Each postcode is a Georgian door placed roughly where it sits (odd north of the Liffey, even south). Colour is median rent; a lit fanlight means the median fits the budget. |
| Explore | Every area ranked against the budget, all listings in the chosen area, medians by bedrooms, and supply by month. |
| Estimate | Ridge regression on log rent with an honest error band, a factor-by-factor breakdown, and the closest real listings. |
| Scraper replay | Replays the crawl with the real page counts and 404s, and turns one listing's markup into its cleaned row. |
| Cleaning | The spelling fixes and the four gap decisions, plus a switch comparing them with deleting incomplete rows. |
| Data | Downloads the cleaned CSV, with imputed values flagged. |

## Run it

```bash
npm ci
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
npm run preview    # serve dist/
```

`dist/` uses relative paths, so it can be hosted from any domain or subpath.

## Rebuild the data

`public/data/` is generated from `../data/dublin_rental_listings.csv`. The script repeats the notebook's cleaning, including Jessica's parking model, and fits the estimator:

```bash
pip install pandas scikit-learn
npm run data
```

It prints the estimator's cross-validated error. The last build reported a typical error of €613 and an R² of 0.609 over five folds.

## Stack

React, TypeScript and Vite. Charts are hand-drawn SVG using `d3-scale` and `d3-array`. Schibsted Grotesk and JetBrains Mono are bundled locally.
