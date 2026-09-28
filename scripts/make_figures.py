"""Render the README and portfolio figures from the scraped listings.

Applies the same standardisation as notebooks/02_explore_rental_market.ipynb,
then writes PNGs to assets/figures/. Run from anywhere:

    python scripts/make_figures.py
"""

from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "figures"

SURFACE = "#fcfcfb"
INK = "#0b0b0b"
MUTED = "#52514e"
GRID = "#e4e3de"
APARTMENT = "#2a78d6"
HOUSE = "#eb6834"

MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]
POSTCODES = ["Dublin 1", "Dublin 2", "Dublin 3", "Dublin 4", "Dublin 5",
             "Dublin 6", "Dublin 6W", "Dublin 7", "Dublin 8", "Dublin 9",
             "Dublin 10", "Dublin 11", "Dublin 12", "Dublin 13", "Dublin 14",
             "Dublin 15", "Dublin 16", "Dublin 17", "Dublin 18", "Dublin 20",
             "Dublin 22", "Dublin 24"]

plt.rcParams.update({
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE,
    "savefig.facecolor": SURFACE, "font.family": "sans-serif",
    "font.sans-serif": ["Helvetica Neue", "Helvetica", "Arial", "DejaVu Sans"],
    "font.size": 11, "text.color": INK, "axes.labelcolor": MUTED,
    "xtick.color": MUTED, "ytick.color": MUTED, "axes.edgecolor": GRID,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.spines.left": False, "axes.grid": True, "axes.grid.axis": "y",
    "grid.color": GRID, "grid.linewidth": 0.8, "axes.axisbelow": True,
    "axes.titlesize": 15, "axes.titleweight": "medium", "axes.titlepad": 34,
    "axes.titlelocation": "left", "legend.frameon": False,
    "xtick.major.size": 0, "ytick.major.size": 0,
})


def load():
    df = pd.read_csv(ROOT / "data" / "dublin_rental_listings.csv")
    df["Location"] = df["Location"].replace({
        "Dublin City Sth.": "Dublin City South",
        "Dublin City Nth.": "Dublin City North",
        "Nth. Co D": "North County Dublin",
        "North  Co Dublin": "North County Dublin",
        "Nth. Co Dublin": "North County Dublin",
        "North Co Dublin": "North County Dublin",
        "South  Co Dublin": "South County Dublin",
        "South Co Dublin": "South County Dublin",
    })
    df["Contact"] = df["Contact"].replace({"Estate  Agent": "Estate Agent"})
    return df


def grouped_bars(ax, table, fmt=None):
    width = 0.38
    x = range(len(table))
    for offset, (column, colour) in zip((-width / 2, width / 2),
                                        (("Apartment", APARTMENT), ("House", HOUSE))):
        ax.bar([i + offset for i in x], table[column], width,
               color=colour, edgecolor=SURFACE, linewidth=1.5, label=column)
    ax.set_xticks(list(x), table.index)
    ax.legend(loc="lower left", ncols=2, bbox_to_anchor=(0, 1.0),
              borderaxespad=0.2, handlelength=1.2)
    if fmt:
        ax.yaxis.set_major_formatter(fmt)


def save(fig, name):
    fig.tight_layout()
    fig.savefig(OUT / name, dpi=200)
    plt.close(fig)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    df = load()
    euro = plt.FuncFormatter(lambda v, _: f"€{v:,.0f}")

    missing = df.isna().sum()
    missing = missing[missing > 0].sort_values()
    fig, ax = plt.subplots(figsize=(10, 3.6))
    ax.barh(missing.index, missing.values, color=MUTED, height=0.55)
    ax.grid(axis="x"); ax.grid(axis="y", visible=False)
    for name, value in missing.items():
        ax.text(value + 3, name, f"{value}", va="center", color=INK)
    ax.set_title(f"Missing values in {len(df):,} scraped listings")
    ax.set_xlabel("Listings with no value")
    save(fig, "missing-values.png")

    per_month = df.groupby(["Month", "Type"]).size().unstack().loc[MONTHS]
    per_month.index = [m[:3] for m in per_month.index]
    fig, ax = plt.subplots(figsize=(10, 5))
    grouped_bars(ax, per_month)
    ax.set_title("Listings per month, by property type")
    ax.set_ylabel("Listings")
    save(fig, "listings-per-month.png")

    by_postcode = (df.dropna(subset=["Postcode"])
                   .groupby(["Postcode", "Type"])["Price"].median().unstack()
                   .loc[POSTCODES])
    by_postcode.index = [p.replace("Dublin ", "D") for p in by_postcode.index]
    fig, ax = plt.subplots(figsize=(11, 5))
    grouped_bars(ax, by_postcode, euro)
    ax.set_title("Median monthly rent by postcode")
    save(fig, "median-rent-by-postcode.png")

    by_bedrooms = df.groupby(["Bedrooms", "Type"])["Price"].median().unstack()
    by_bedrooms.index = [f"{b} bed" for b in by_bedrooms.index]
    fig, ax = plt.subplots(figsize=(10, 4.6))
    grouped_bars(ax, by_bedrooms.fillna(0), euro)
    ax.set_title("Median monthly rent by bedrooms")
    save(fig, "median-rent-by-bedrooms.png")

    print(f"Wrote {len(list(OUT.glob('*.png')))} figures to {OUT}")


if __name__ == "__main__":
    main()
