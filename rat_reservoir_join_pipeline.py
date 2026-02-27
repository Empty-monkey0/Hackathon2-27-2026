"""
NYC Rat Reservoir - Dataset Download & Join Pipeline
=====================================================
Downloads data from NYC Open Data (Socrata API) and Kaggle,
then merges them into a unified dataset for the "Heat Score" analysis.

Requirements:
    pip install pandas sodapy scikit-learn geopandas shapely requests
"""

import pandas as pd
import numpy as np
from sodapy import Socrata
from sklearn.neighbors import BallTree
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings("ignore")

# ============================================================
# 1. DOWNLOAD DATASETS FROM NYC OPEN DATA (Socrata API)
# ============================================================

# No authentication needed for public datasets (but rate-limited)
# For higher limits, register an app token at https://data.cityofnewyork.us/profile/edit/developer_settings
client = Socrata("data.cityofnewyork.us", None)  # Replace None with your app_token if you have one

print("=" * 60)
print("STEP 1: Downloading datasets from NYC Open Data...")
print("=" * 60)

# --- 1a. Restaurant Inspection Results (43nn-pn8j) ---
# Filter for rodent-related violations only (violation codes: 04K, 04L, 04M, 04N, 08A)
# 04K = Evidence of rats, 04L = Evidence of mice, 04M = Live roaches (related), 
# 04N = Filth flies (related), 08A = Conditions conducive to pests
print("\n[1/4] Downloading Restaurant Inspections (rodent violations)...")
restaurant_results = client.get(
    "43nn-pn8j",
    where="violation_code IN ('04K', '04L', '04M', '04N', '08A')",
    limit=500000,  # Adjust as needed
    order="inspection_date DESC"
)
df_restaurants = pd.DataFrame.from_records(restaurant_results)
print(f"       → {len(df_restaurants):,} rodent-related restaurant violations downloaded")

# --- 1b. Rat Sightings / 311 Complaints (3q43-55fe) ---
print("\n[2/4] Downloading 311 Rat Sightings...")
rat_results = client.get(
    "3q43-55fe",
    limit=500000,
    order="created_date DESC"
)
df_rats = pd.DataFrame.from_records(rat_results)
print(f"       → {len(df_rats):,} rat sighting complaints downloaded")

# --- 1c. Rodent Inspections - DOHMH (p937-wjvj) ---
print("\n[3/4] Downloading DOHMH Rodent Inspections...")
rodent_insp_results = client.get(
    "p937-wjvj",
    limit=500000,
    order="inspection_date DESC"
)
df_rodent_insp = pd.DataFrame.from_records(rodent_insp_results)
print(f"       → {len(df_rodent_insp):,} rodent inspection records downloaded")

# --- 1d. DOB Construction Permits (rbx6-tga4) ---
print("\n[4/4] Downloading DOB Construction Permits...")
permits_results = client.get(
    "rbx6-tga4",
    limit=500000,
    order="approved_date DESC"
)
df_permits = pd.DataFrame.from_records(permits_results)
print(f"       → {len(df_permits):,} construction permit records downloaded")


# ============================================================
# 2. CLEAN & STANDARDIZE EACH DATASET
# ============================================================

print("\n" + "=" * 60)
print("STEP 2: Cleaning and standardizing datasets...")
print("=" * 60)

# --- 2a. Clean Restaurant Inspections ---
print("\n[1/4] Cleaning Restaurant Inspections...")
df_restaurants["inspection_date"] = pd.to_datetime(df_restaurants["inspection_date"], errors="coerce")
df_restaurants["latitude"] = pd.to_numeric(df_restaurants.get("latitude"), errors="coerce")
df_restaurants["longitude"] = pd.to_numeric(df_restaurants.get("longitude"), errors="coerce")
df_restaurants["zipcode"] = df_restaurants.get("zipcode", "").astype(str).str.strip()
df_restaurants["score"] = pd.to_numeric(df_restaurants.get("score"), errors="coerce")

# Keep relevant columns
restaurant_cols = [
    "camis", "dba", "boro", "zipcode", "street", "building",
    "latitude", "longitude", "inspection_date", "violation_code",
    "violation_description", "critical_flag", "score", "grade"
]
df_restaurants = df_restaurants[[c for c in restaurant_cols if c in df_restaurants.columns]]
df_restaurants = df_restaurants.dropna(subset=["latitude", "longitude"])
print(f"       → {len(df_restaurants):,} rows after cleaning")

# --- 2b. Clean Rat Sightings ---
print("\n[2/4] Cleaning Rat Sightings...")
df_rats["created_date"] = pd.to_datetime(df_rats.get("created_date"), errors="coerce")
df_rats["latitude"] = pd.to_numeric(df_rats.get("latitude"), errors="coerce")
df_rats["longitude"] = pd.to_numeric(df_rats.get("longitude"), errors="coerce")
df_rats["incident_zip"] = df_rats.get("incident_zip", "").astype(str).str[:5]

rat_cols = [
    "unique_key", "created_date", "incident_zip", "incident_address",
    "city", "borough", "latitude", "longitude",
    "descriptor", "location_type", "status"
]
df_rats = df_rats[[c for c in rat_cols if c in df_rats.columns]]
df_rats = df_rats.dropna(subset=["latitude", "longitude"])
print(f"       → {len(df_rats):,} rows after cleaning")

# --- 2c. Clean Rodent Inspections ---
print("\n[3/4] Cleaning Rodent Inspections...")
df_rodent_insp["inspection_date"] = pd.to_datetime(df_rodent_insp.get("inspection_date"), errors="coerce")
df_rodent_insp["latitude"] = pd.to_numeric(df_rodent_insp.get("latitude"), errors="coerce")
df_rodent_insp["longitude"] = pd.to_numeric(df_rodent_insp.get("longitude"), errors="coerce")
df_rodent_insp["zip_code"] = df_rodent_insp.get("zip_code", "").astype(str).str[:5]

rodent_cols = [
    "job_id", "inspection_date", "result", "zip_code", "borough_code",
    "latitude", "longitude", "community_district", "inspection_type"
]
df_rodent_insp = df_rodent_insp[[c for c in rodent_cols if c in df_rodent_insp.columns]]
df_rodent_insp = df_rodent_insp.dropna(subset=["latitude", "longitude"])
print(f"       → {len(df_rodent_insp):,} rows after cleaning")

# --- 2d. Clean Construction Permits ---
print("\n[4/4] Cleaning Construction Permits...")
df_permits["approved_date"] = pd.to_datetime(df_permits.get("approved_date"), errors="coerce")

# Try multiple possible column names for coordinates
for lat_col in ["latitude", "gis_latitude", "lat"]:
    if lat_col in df_permits.columns:
        df_permits["latitude"] = pd.to_numeric(df_permits[lat_col], errors="coerce")
        break

for lon_col in ["longitude", "gis_longitude", "lng"]:
    if lon_col in df_permits.columns:
        df_permits["longitude"] = pd.to_numeric(df_permits[lon_col], errors="coerce")
        break

# Get zip from available columns
for zip_col in ["postcode", "zip", "zipcode"]:
    if zip_col in df_permits.columns:
        df_permits["zipcode"] = df_permits[zip_col].astype(str).str[:5]
        break

permit_cols = ["job_filing_number", "approved_date", "latitude", "longitude", "zipcode",
               "borough", "job_type", "work_type"]
df_permits = df_permits[[c for c in permit_cols if c in df_permits.columns]]
if "latitude" in df_permits.columns:
    df_permits = df_permits.dropna(subset=["latitude", "longitude"])
print(f"       → {len(df_permits):,} rows after cleaning")


# ============================================================
# 3. JOIN STRATEGY: ZIP-CODE + SPATIAL PROXIMITY + TIME WINDOW
# ============================================================

print("\n" + "=" * 60)
print("STEP 3: Joining datasets...")
print("=" * 60)

# ------------------------------------------------------------------
# JOIN METHOD A: Zip-Code Aggregation (Block-Level Heat Score)
# This is the PRIMARY join — aggregates all signals per zip code
# ------------------------------------------------------------------
print("\n[Method A] Zip-code level aggregation...")

# Aggregate restaurant rodent violations per zip code
rest_by_zip = df_restaurants.groupby("zipcode").agg(
    restaurant_rodent_violations=("violation_code", "count"),
    restaurant_critical_count=("critical_flag", lambda x: (x == "Critical").sum()),
    restaurant_avg_score=("score", "mean"),
    restaurant_unique_locations=("camis", "nunique"),
    restaurant_latest_violation=("inspection_date", "max"),
).reset_index()
rest_by_zip = rest_by_zip.rename(columns={"zipcode": "zip_code"})

# Aggregate 311 rat sightings per zip code
rats_by_zip = df_rats.groupby("incident_zip").agg(
    rat_sighting_count=("unique_key", "count") if "unique_key" in df_rats.columns
        else ("created_date", "count"),
    rat_latest_sighting=("created_date", "max"),
    rat_earliest_sighting=("created_date", "min"),
).reset_index()
rats_by_zip = rats_by_zip.rename(columns={"incident_zip": "zip_code"})

# Aggregate rodent inspections per zip code
if "zip_code" in df_rodent_insp.columns:
    rodent_by_zip = df_rodent_insp.groupby("zip_code").agg(
        rodent_inspection_count=("inspection_date", "count"),
        rodent_active_rat_signs=("result", lambda x: x.str.contains("Rat Activity", case=False, na=False).sum()),
        rodent_latest_inspection=("inspection_date", "max"),
    ).reset_index()
else:
    rodent_by_zip = pd.DataFrame(columns=["zip_code"])

# Aggregate construction permits per zip code
if "zipcode" in df_permits.columns:
    permits_by_zip = df_permits.groupby("zipcode").agg(
        construction_permit_count=("approved_date", "count"),
        construction_latest_permit=("approved_date", "max"),
    ).reset_index()
    permits_by_zip = permits_by_zip.rename(columns={"zipcode": "zip_code"})
else:
    permits_by_zip = pd.DataFrame(columns=["zip_code"])

# ---- MERGE ALL ON ZIP CODE ----
print("       Merging on zip_code...")
df_merged = rest_by_zip.merge(rats_by_zip, on="zip_code", how="outer")
df_merged = df_merged.merge(rodent_by_zip, on="zip_code", how="outer")
df_merged = df_merged.merge(permits_by_zip, on="zip_code", how="outer")

# Fill NaN counts with 0
count_cols = [c for c in df_merged.columns if "count" in c or "violations" in c or "signs" in c or "locations" in c]
df_merged[count_cols] = df_merged[count_cols].fillna(0)

print(f"       → Zip-code merged dataset: {len(df_merged)} zip codes, {len(df_merged.columns)} features")


# ------------------------------------------------------------------
# JOIN METHOD B: Spatial Proximity Join (Restaurant ↔ Rat Sightings)
# Links each restaurant to nearby rat sightings within a radius
# ------------------------------------------------------------------
print("\n[Method B] Spatial proximity join (restaurant ↔ nearby rat sightings)...")

RADIUS_METERS = 200  # 200m radius (~1 city block)
EARTH_RADIUS_M = 6_371_000

def spatial_count_within_radius(target_df, source_df, target_lat, target_lon,
                                 source_lat, source_lon, radius_m=RADIUS_METERS):
    """Count how many source points fall within radius of each target point."""
    
    target_coords = np.radians(target_df[[target_lat, target_lon]].values)
    source_coords = np.radians(source_df[[source_lat, source_lon]].values)
    
    tree = BallTree(source_coords, metric="haversine")
    radius_rad = radius_m / EARTH_RADIUS_M
    
    counts = tree.query_radius(target_coords, r=radius_rad, count_only=True)
    return counts

# Only run if we have enough data (sample for speed)
SAMPLE_SIZE = 50_000  # Adjust based on your machine's memory

rest_sample = df_restaurants.drop_duplicates(subset=["camis"]).head(SAMPLE_SIZE).copy()

if len(rest_sample) > 0 and len(df_rats) > 0:
    print(f"       Computing nearby rat sightings for {len(rest_sample):,} restaurants...")
    rest_sample["nearby_rat_sightings"] = spatial_count_within_radius(
        rest_sample, df_rats,
        "latitude", "longitude",
        "latitude", "longitude",
        radius_m=RADIUS_METERS
    )
    
    # Also count nearby construction permits
    if len(df_permits) > 0 and "latitude" in df_permits.columns:
        print(f"       Computing nearby construction permits...")
        rest_sample["nearby_construction"] = spatial_count_within_radius(
            rest_sample, df_permits,
            "latitude", "longitude",
            "latitude", "longitude",
            radius_m=300  # 300m for construction
        )
    
    print(f"       → Spatial join complete. Average nearby rat sightings per restaurant: "
          f"{rest_sample['nearby_rat_sightings'].mean():.1f}")
else:
    print("       → Skipped: insufficient data for spatial join")


# ------------------------------------------------------------------
# JOIN METHOD C: Temporal Join (Time-windowed matching)
# For each restaurant violation, count rat sightings in the same
# zip code within ±90 days
# ------------------------------------------------------------------
print("\n[Method C] Temporal join (±90 day window per violation)...")

TIME_WINDOW_DAYS = 90

# Sample for performance
rest_temporal_sample = df_restaurants.dropna(subset=["inspection_date", "zipcode"]).head(20_000).copy()

if len(rest_temporal_sample) > 0 and len(df_rats) > 0:
    # Index rat sightings by zip for fast lookup
    rats_indexed = df_rats.dropna(subset=["created_date"]).copy()
    rats_by_zip_dict = {
        z: group["created_date"].values
        for z, group in rats_indexed.groupby("incident_zip")
    }
    
    def count_rats_in_window(row):
        zipcode = str(row["zipcode"])
        insp_date = row["inspection_date"]
        if zipcode not in rats_by_zip_dict or pd.isna(insp_date):
            return 0
        rat_dates = pd.to_datetime(rats_by_zip_dict[zipcode])
        window_start = insp_date - timedelta(days=TIME_WINDOW_DAYS)
        window_end = insp_date + timedelta(days=TIME_WINDOW_DAYS)
        return int(((rat_dates >= window_start) & (rat_dates <= window_end)).sum())
    
    print(f"       Computing for {len(rest_temporal_sample):,} restaurant violations...")
    rest_temporal_sample["rats_within_90days"] = rest_temporal_sample.apply(count_rats_in_window, axis=1)
    
    print(f"       → Average rat sightings within ±90 days in same zip: "
          f"{rest_temporal_sample['rats_within_90days'].mean():.1f}")
else:
    print("       → Skipped: insufficient data")


# ============================================================
# 4. COMPUTE THE "HEAT SCORE" PER ZIP CODE
# ============================================================

print("\n" + "=" * 60)
print("STEP 4: Computing Heat Score...")
print("=" * 60)

# Normalize each feature to 0-1 scale, then create weighted composite
from sklearn.preprocessing import MinMaxScaler

score_features = [
    "restaurant_rodent_violations",
    "restaurant_critical_count",
    "rat_sighting_count",
    "rodent_active_rat_signs",
    "rodent_inspection_count",
    "construction_permit_count",
]

# Only use features that exist
available_features = [f for f in score_features if f in df_merged.columns]
df_score = df_merged[["zip_code"] + available_features].copy()
df_score[available_features] = df_score[available_features].fillna(0)

# Normalize
scaler = MinMaxScaler()
df_score[available_features] = scaler.fit_transform(df_score[available_features])

# Weighted Heat Score
weights = {
    "restaurant_rodent_violations": 0.25,
    "restaurant_critical_count": 0.15,
    "rat_sighting_count": 0.30,       # Heaviest weight — real-time citizen reports
    "rodent_active_rat_signs": 0.15,
    "rodent_inspection_count": 0.05,
    "construction_permit_count": 0.10,  # Nearby construction disturbs rats
}

df_score["heat_score"] = sum(
    df_score[f] * weights.get(f, 0.1)
    for f in available_features
)

# Scale to 0–100
df_score["heat_score"] = (df_score["heat_score"] / df_score["heat_score"].max() * 100).round(1)

# Merge back
df_final = df_merged.merge(df_score[["zip_code", "heat_score"]], on="zip_code", how="left")
df_final = df_final.sort_values("heat_score", ascending=False)

print(f"\n       Top 10 Highest-Risk Zip Codes:")
print(f"       {'Zip':<10} {'Heat Score':<12} {'Rest. Violations':<18} {'Rat Sightings':<15} {'Active Rats'}")
print(f"       {'-'*70}")
for _, row in df_final.head(10).iterrows():
    print(f"       {row['zip_code']:<10} {row['heat_score']:<12.1f} "
          f"{int(row.get('restaurant_rodent_violations', 0)):<18} "
          f"{int(row.get('rat_sighting_count', 0)):<15} "
          f"{int(row.get('rodent_active_rat_signs', 0))}")


# ============================================================
# 5. SAVE OUTPUTS
# ============================================================

print("\n" + "=" * 60)
print("STEP 5: Saving outputs...")
print("=" * 60)

# Save the zip-code level merged dataset with heat scores
df_final.to_csv("rat_reservoir_heat_scores_by_zip.csv", index=False)
print(f"\n  ✓ rat_reservoir_heat_scores_by_zip.csv  ({len(df_final)} rows)")

# Save the restaurant-level spatial join
if "nearby_rat_sightings" in rest_sample.columns:
    rest_sample.to_csv("restaurant_spatial_risk.csv", index=False)
    print(f"  ✓ restaurant_spatial_risk.csv            ({len(rest_sample)} rows)")

# Save the temporal join
if "rats_within_90days" in rest_temporal_sample.columns:
    rest_temporal_sample.to_csv("restaurant_temporal_risk.csv", index=False)
    print(f"  ✓ restaurant_temporal_risk.csv            ({len(rest_temporal_sample)} rows)")

# Save individual cleaned datasets
df_restaurants.to_csv("cleaned_restaurant_violations.csv", index=False)
df_rats.to_csv("cleaned_rat_sightings.csv", index=False)
df_rodent_insp.to_csv("cleaned_rodent_inspections.csv", index=False)
df_permits.to_csv("cleaned_construction_permits.csv", index=False)
print(f"  ✓ Individual cleaned datasets saved")

print("\n" + "=" * 60)
print("DONE! All datasets joined and Heat Scores computed.")
print("=" * 60)
print("""
OUTPUT FILES:
  1. rat_reservoir_heat_scores_by_zip.csv  → Main output: heat score per zip code
  2. restaurant_spatial_risk.csv           → Each restaurant + nearby rat count
  3. restaurant_temporal_risk.csv          → Each violation + rats within ±90 days
  4. cleaned_*.csv                         → Individual cleaned datasets

NEXT STEPS:
  - Load rat_reservoir_heat_scores_by_zip.csv into Streamlit/Folium for mapping
  - Use time-series (ARIMA/Prophet) on rat_sighting_count for seasonal prediction
  - Feed features into a classifier to predict future high-risk zones
""")
