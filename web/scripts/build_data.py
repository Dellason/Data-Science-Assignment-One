"""Build the JSON the website reads, from the scraped listings.

Reproduces the cleaning in notebooks/02_explore_rental_market.ipynb, keeps
both the raw and the filled value of every imputed field, and fits the rent
estimator. Writes web/public/data/{listings,model}.json:

    python web/scripts/build_data.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.model_selection import KFold

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "web" / "public" / "data"

MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]
LOCATIONS = {
    "Dublin City Sth.": "Dublin City South", "Dublin City Nth.": "Dublin City North",
    "Nth. Co D": "North County Dublin", "North  Co Dublin": "North County Dublin",
    "Nth. Co Dublin": "North County Dublin", "North Co Dublin": "North County Dublin",
    "South  Co Dublin": "South County Dublin", "South Co Dublin": "South County Dublin",
}


def clean(raw):
    df = raw.copy()
    df["Location"] = df["Location"].replace(LOCATIONS)
    df["Contact"] = df["Contact"].replace({"Estate  Agent": "Estate Agent"})

    garden_rule = pd.Series(None, index=df.index, dtype=object)
    apartments = df["Garden"].isna() & (df["Type"] == "Apartment")
    garden_rule[apartments] = "apartment"
    df.loc[apartments, "Garden"] = "No"
    north_county = df["Garden"].isna() & (df["Location"] == "North County Dublin")
    garden_rule[north_county] = "north-county-house"
    df.loc[north_county, "Garden"] = "Yes"
    rest = df["Garden"].isna()
    garden_rule[rest] = "house"
    df.loc[rest, "Garden"] = "Yes"

    df["Lease Length"] = df["Lease Length"].fillna(12)

    # Jessica's parking model, exactly as in the notebook.
    known = df[df["Parking"].notna()]
    missing = df[df["Parking"].isna()]
    columns = ["Location", "Type", "Bedrooms", "Bathrooms", "Price"]
    x_train = pd.get_dummies(known[columns], prefix="", prefix_sep="", drop_first=True, dtype=int)
    x_test = pd.get_dummies(missing[columns], prefix="", prefix_sep="", drop_first=True, dtype=int)
    model = LogisticRegression(C=1e42, solver="liblinear").fit(x_train, known["Parking"])
    df.loc[missing.index, "Parking"] = model.predict(x_test)
    return df, garden_rule


def area(row):
    return row["Postcode"] if isinstance(row["Postcode"], str) else row["Location"]


def features(df, areas):
    X = pd.DataFrame(index=df.index)
    X["house"] = (df["Type"] == "House").astype(float)
    for a in areas[1:]:
        X[f"area:{a}"] = (df["Area"] == a).astype(float)
    for b in (2, 3, 4, 5):
        X[f"beds:{b}"] = (df["Bedrooms"] == b).astype(float)
    X["baths"] = df["Bathrooms"].astype(float)
    X["parking"] = (df["Parking"] == "Yes").astype(float)
    X["garden"] = (df["Garden"] == "Yes").astype(float)
    return X


def fit_estimator(df):
    areas = sorted(df["Area"].unique(), key=lambda a: (not a.startswith("Dublin "), a))
    X = features(df, areas).to_numpy()
    y = np.log(df["Price"].to_numpy())

    residuals = np.empty_like(y)
    for train, test in KFold(5, shuffle=True, random_state=42).split(X):
        m = Ridge(alpha=1.0).fit(X[train], y[train])
        residuals[test] = y[test] - m.predict(X[test])
    predicted = np.exp(y - residuals)
    actual = df["Price"].to_numpy()
    mae = float(np.mean(np.abs(actual - predicted)))
    r2 = float(1 - np.sum((actual - predicted) ** 2) / np.sum((actual - actual.mean()) ** 2))
    within = float(np.mean(np.abs(actual - predicted) / actual <= 0.15))

    model = Ridge(alpha=1.0).fit(X, y)
    names = features(df, areas).columns
    return {
        "intercept": float(model.intercept_),
        "baseline": {"area": areas[0], "bedrooms": 1, "type": "Apartment"},
        "coefficients": {n: round(float(c), 6) for n, c in zip(names, model.coef_)},
        "interval": [round(float(np.quantile(residuals, 0.1)), 6),
                     round(float(np.quantile(residuals, 0.9)), 6)],
        "evaluation": {"folds": 5, "mae": round(mae), "r2": round(r2, 3),
                       "withinFifteenPercent": round(within, 3)},
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    raw = pd.read_csv(ROOT / "data" / "dublin_rental_listings.csv")
    df, garden_rule = clean(raw)
    df["Area"] = df.apply(area, axis=1)

    rows = []
    for i in df.index:
        r, c = raw.loc[i], df.loc[i]
        row = {
            "id": int(i),
            "month": MONTHS.index(c["Month"]),
            "type": c["Type"],
            "price": int(c["Price"]),
            "location": c["Location"],
            "postcode": c["Postcode"] if isinstance(c["Postcode"], str) else None,
            "bedrooms": int(c["Bedrooms"]),
            "bathrooms": int(c["Bathrooms"]),
            "parking": c["Parking"] == "Yes",
            "garden": c["Garden"] == "Yes",
            "lease": int(c["Lease Length"]),
            "agent": c["Contact"] == "Estate Agent",
        }
        # Only what cleaning changed is recorded, to keep the file small.
        if r["Location"] != c["Location"]:
            row["rawLocation"] = r["Location"]
        if r["Contact"] != c["Contact"]:
            row["rawContact"] = r["Contact"]
        if pd.isna(r["Parking"]):
            row["parkingImputed"] = True
        if isinstance(garden_rule[i], str):
            row["gardenRule"] = garden_rule[i]
        if pd.isna(r["Lease Length"]):
            row["leaseImputed"] = True
        rows.append(row)

    (OUT / "listings.json").write_text(json.dumps(rows, separators=(",", ":")))
    estimator = fit_estimator(df)
    (OUT / "model.json").write_text(json.dumps(estimator, indent=1))
    print(f"{len(rows)} listings; estimator {estimator['evaluation']}")


if __name__ == "__main__":
    main()
