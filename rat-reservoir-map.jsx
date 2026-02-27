import { useState, useMemo, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════
// NYC RAT RESERVOIR — INTERACTIVE HEAT MAP
// Real ZIP code centroids plotted on SVG map of NYC
// ═══════════════════════════════════════════════════════════

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

// Real approximate centroids for NYC ZIP codes (lat, lng)
const ZIP_GEO = {
  // Manhattan
  "10001":[40.7506,-73.9971],"10002":[40.7157,-73.9863],"10003":[40.7317,-73.9893],
  "10009":[40.7265,-73.9797],"10011":[40.7418,-74.0002],"10012":[40.7258,-73.9981],
  "10013":[40.7198,-74.0030],"10014":[40.7340,-74.0054],"10016":[40.7459,-73.9781],
  "10019":[40.7654,-73.9862],"10021":[40.7693,-73.9588],"10023":[40.7764,-73.9827],
  "10025":[40.7990,-73.9680],"10027":[40.8116,-73.9535],"10029":[40.7917,-73.9438],
  "10031":[40.8252,-73.9496],"10033":[40.8486,-73.9346],"10034":[40.8677,-73.9234],
  "10036":[40.7590,-73.9890],"10038":[40.7092,-74.0024],
  // Brooklyn
  "11201":[40.6934,-73.9897],"11205":[40.6946,-73.9661],"11206":[40.7022,-73.9424],
  "11207":[40.6710,-73.8943],"11211":[40.7128,-73.9517],"11215":[40.6694,-73.9866],
  "11216":[40.6811,-73.9498],"11217":[40.6824,-73.9777],"11220":[40.6414,-74.0105],
  "11221":[40.6907,-73.9283],"11225":[40.6631,-73.9543],"11226":[40.6468,-73.9564],
  "11229":[40.6014,-73.9433],"11230":[40.6211,-73.9659],"11233":[40.6787,-73.9196],
  "11234":[40.6044,-73.9183],"11235":[40.5843,-73.9488],"11236":[40.6396,-73.9013],
  "11238":[40.6796,-73.9631],"11249":[40.7110,-73.9650],
  // Queens
  "11101":[40.7478,-73.9256],"11102":[40.7722,-73.9262],"11103":[40.7627,-73.9116],
  "11104":[40.7447,-73.9207],"11106":[40.7621,-73.9315],"11354":[40.7680,-73.8279],
  "11355":[40.7513,-73.8202],"11356":[40.7842,-73.8411],"11358":[40.7609,-73.7961],
  "11361":[40.7653,-73.7712],"11368":[40.7498,-73.8527],"11372":[40.7518,-73.8839],
  "11373":[40.7390,-73.8785],"11374":[40.7267,-73.8614],"11375":[40.7207,-73.8452],
  "11377":[40.7445,-73.9049],"11378":[40.7248,-73.9087],"11385":[40.7006,-73.8896],
  "11415":[40.7073,-73.8283],"11421":[40.6937,-73.8575],
  // Bronx
  "10451":[40.8203,-73.9235],"10452":[40.8377,-73.9230],"10453":[40.8530,-73.9133],
  "10454":[40.8069,-73.9188],"10455":[40.8149,-73.9079],"10456":[40.8310,-73.9086],
  "10457":[40.8477,-73.8990],"10458":[40.8625,-73.8880],"10459":[40.8260,-73.8937],
  "10460":[40.8419,-73.8803],"10461":[40.8461,-73.8427],"10462":[40.8372,-73.8615],
  "10463":[40.8815,-73.9071],"10465":[40.8225,-73.8230],"10467":[40.8726,-73.8715],
  "10468":[40.8699,-73.9005],"10469":[40.8697,-73.8480],"10470":[40.8949,-73.8657],
  "10472":[40.8302,-73.8696],"10473":[40.8193,-73.8582],
  // Staten Island
  "10301":[40.6436,-74.0771],"10302":[40.6321,-74.1374],"10303":[40.6311,-74.1660],
  "10304":[40.6076,-74.0930],"10305":[40.5964,-74.0754],"10306":[40.5714,-74.1278],
  "10307":[40.5124,-74.2427],"10308":[40.5517,-74.1500],"10309":[40.5302,-74.2198],
  "10310":[40.6322,-74.1164],"10312":[40.5454,-74.1803],"10314":[40.5989,-74.1632],
};

const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];
const BOROUGH_COLORS = { Manhattan: "#FF6B35", Brooklyn: "#4ECDC4", Queens: "#45B7D1", Bronx: "#F7DC6F", "Staten Island": "#BB8FCE" };

const ZIP_TO_BOROUGH = {};
Object.entries({
  Manhattan: ["10001","10002","10003","10009","10011","10012","10013","10014","10016","10019","10021","10023","10025","10027","10029","10031","10033","10034","10036","10038"],
  Brooklyn: ["11201","11205","11206","11207","11211","11215","11216","11217","11220","11221","11225","11226","11229","11230","11233","11234","11235","11236","11238","11249"],
  Queens: ["11101","11102","11103","11104","11106","11354","11355","11356","11358","11361","11368","11372","11373","11374","11375","11377","11378","11385","11415","11421"],
  Bronx: ["10451","10452","10453","10454","10455","10456","10457","10458","10459","10460","10461","10462","10463","10465","10467","10468","10469","10470","10472","10473"],
  "Staten Island": ["10301","10302","10303","10304","10305","10306","10307","10308","10309","10310","10312","10314"]
}).forEach(([b, zips]) => zips.forEach(z => ZIP_TO_BOROUGH[z] = b));

function generateZipRiskData() {
  const rand = seededRandom(42);
  const data = [];
  Object.entries(ZIP_GEO).forEach(([zip, [lat, lng]]) => {
    const borough = ZIP_TO_BOROUGH[zip];
    const density = borough === "Manhattan" ? 1.4 : borough === "Brooklyn" ? 1.1 : borough === "Bronx" ? 1.2 : borough === "Queens" ? 0.8 : 0.4;
    const restaurantCount = Math.floor(15 + rand() * 50 * density);
    const complaints90d = Math.floor(rand() * 45 * density);
    const violations90d = Math.floor(rand() * 20 * density);
    const constructionSites = Math.floor(rand() * 8 * density);
    const avgBuildingAge = Math.floor(1910 + rand() * 80);

    const rawScore = Math.min(100, Math.round(
      (complaints90d / 45 * 28) +
      (violations90d / 20 * 25) +
      ((2025 - avgBuildingAge) > 80 ? 22 : (2025 - avgBuildingAge) > 50 ? 12 : 5) +
      (constructionSites / 8 * 18) +
      (rand() * 10)
    ));

    const isReservoir = rawScore > 70;
    const trend = rand() > 0.5 ? "rising" : rand() > 0.3 ? "stable" : "declining";

    data.push({
      zip, lat, lng, borough, restaurantCount,
      complaints90d, violations90d, constructionSites,
      avgBuildingAge, heatScore: rawScore, isReservoir, trend,
      criticalRestaurants: Math.floor(restaurantCount * (rawScore / 300)),
    });
  });
  return data;
}

// Mercator projection for NYC area
function project(lat, lng, bounds, width, height, padding) {
  const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * (width - padding * 2) + padding;
  const y = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * (height - padding * 2) + padding;
  return [x, y];
}

function scoreToColor(score, alpha = 1) {
  if (score > 70) return `rgba(255, 58, 48, ${alpha})`;
  if (score > 50) return `rgba(255, 160, 30, ${alpha})`;
  if (score > 35) return `rgba(255, 210, 60, ${alpha})`;
  return `rgba(50, 210, 120, ${alpha})`;
}

function trendIcon(trend) {
  if (trend === "rising") return "↑";
  if (trend === "declining") return "↓";
  return "→";
}

function trendColor(trend) {
  if (trend === "rising") return "#FF3A30";
  if (trend === "declining") return "#32D278";
  return "#FFD23C";
}

export default function RatReservoirMap() {
  const [hoveredZip, setHoveredZip] = useState(null);
  const [selectedZip, setSelectedZip] = useState(null);
  const [filterBorough, setFilterBorough] = useState("All");
  const [showReservoirsOnly, setShowReservoirsOnly] = useState(false);
  const [mapLayer, setMapLayer] = useState("heat"); // heat | borough | construction
  const svgRef = useRef(null);

  const allData = useMemo(() => generateZipRiskData(), []);

  const filtered = useMemo(() => {
    let d = allData;
    if (filterBorough !== "All") d = d.filter(z => z.borough === filterBorough);
    if (showReservoirsOnly) d = d.filter(z => z.isReservoir);
    return d;
  }, [allData, filterBorough, showReservoirsOnly]);

  const stats = useMemo(() => ({
    total: filtered.length,
    reservoirs: filtered.filter(z => z.isReservoir).length,
    avgScore: filtered.length > 0 ? (filtered.reduce((s, z) => s + z.heatScore, 0) / filtered.length).toFixed(1) : 0,
    totalComplaints: filtered.reduce((s, z) => s + z.complaints90d, 0),
    totalViolations: filtered.reduce((s, z) => s + z.violations90d, 0),
    rising: filtered.filter(z => z.trend === "rising").length,
  }), [filtered]);

  const selectedData = selectedZip ? allData.find(z => z.zip === selectedZip) : null;

  const MAP_W = 720;
  const MAP_H = 640;
  const PAD = 40;

  const bounds = useMemo(() => {
    const lats = Object.values(ZIP_GEO).map(c => c[0]);
    const lngs = Object.values(ZIP_GEO).map(c => c[1]);
    return {
      minLat: Math.min(...lats) - 0.015,
      maxLat: Math.max(...lats) + 0.015,
      minLng: Math.min(...lngs) - 0.015,
      maxLng: Math.max(...lngs) + 0.015,
    };
  }, []);

  const getColor = useCallback((zip) => {
    if (mapLayer === "borough") return BOROUGH_COLORS[zip.borough] || "#666";
    if (mapLayer === "construction") {
      const intensity = Math.min(zip.constructionSites / 8, 1);
      return `rgba(255, 160, 30, ${0.2 + intensity * 0.8})`;
    }
    return scoreToColor(zip.heatScore);
  }, [mapLayer]);

  const getRadius = useCallback((zip) => {
    const base = mapLayer === "construction"
      ? 4 + zip.constructionSites * 1.5
      : 5 + (zip.heatScore / 100) * 12;
    return Math.max(4, base);
  }, [mapLayer]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#08080F",
      color: "#E0E0EC",
      fontFamily: "'Instrument Sans', 'DM Sans', system-ui, sans-serif",
      WebkitFontSmoothing: "antialiased",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        @keyframes pulseRing { 0% { r: 14; opacity: 0.6; } 100% { r: 28; opacity: 0; } }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glow { 0%, 100% { filter: drop-shadow(0 0 4px rgba(255,58,48,0.5)); } 50% { filter: drop-shadow(0 0 10px rgba(255,58,48,0.8)); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{
        padding: "24px 32px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "linear-gradient(180deg, rgba(255,58,48,0.03) 0%, transparent 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, #FF3A30, #FF6B35)", fontSize: 18,
          }}>🗺️</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: -0.5, fontFamily: "'Instrument Sans', sans-serif", color: "#fff" }}>
              Rat Reservoir Heat Map
            </h1>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase" }}>
              92 NYC ZIP Codes — Risk-Scored & Geo-Plotted
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div style={{ display: "flex", height: "calc(100vh - 88px)", overflow: "hidden" }}>

        {/* ── LEFT SIDEBAR ── */}
        <div style={{
          width: 280, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.05)",
          overflowY: "auto", padding: "20px 18px",
          background: "rgba(255,255,255,0.01)",
        }}>
          {/* Controls */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 10, fontFamily: "'IBM Plex Mono', monospace" }}>Filters</div>
            <select value={filterBorough} onChange={e => setFilterBorough(e.target.value)} style={{
              width: "100%", padding: "8px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 12, cursor: "pointer", outline: "none", marginBottom: 8,
            }}>
              <option value="All" style={{ background: "#15151F" }}>All Boroughs</option>
              {BOROUGHS.map(b => <option key={b} value={b} style={{ background: "#15151F" }}>{b}</option>)}
            </select>

            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8, marginTop: 14, fontFamily: "'IBM Plex Mono', monospace" }}>Map Layer</div>
            {[["heat", "Risk Heat Score"], ["borough", "Borough View"], ["construction", "Construction Activity"]].map(([id, label]) => (
              <button key={id} onClick={() => setMapLayer(id)} style={{
                display: "block", width: "100%", padding: "7px 12px", marginBottom: 4, borderRadius: 6,
                border: mapLayer === id ? "1px solid rgba(255,107,53,0.3)" : "1px solid rgba(255,255,255,0.05)",
                background: mapLayer === id ? "rgba(255,107,53,0.1)" : "transparent",
                color: mapLayer === id ? "#FF6B35" : "rgba(255,255,255,0.45)",
                fontSize: 12, cursor: "pointer", textAlign: "left", fontWeight: 500,
              }}>{label}</button>
            ))}

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, cursor: "pointer", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              <input type="checkbox" checked={showReservoirsOnly} onChange={e => setShowReservoirsOnly(e.target.checked)}
                style={{ accentColor: "#FF3A30" }} />
              Reservoirs only
            </label>
          </div>

          {/* Stats */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12, fontFamily: "'IBM Plex Mono', monospace" }}>Summary</div>
            {[
              ["ZIP Codes", stats.total, "#fff"],
              ["Active Reservoirs", stats.reservoirs, "#FF3A30"],
              ["Avg Heat Score", stats.avgScore, "#FFA01E"],
              ["90d Complaints", stats.totalComplaints.toLocaleString(), "#4ECDC4"],
              ["90d Violations", stats.totalViolations.toLocaleString(), "#FF6B35"],
              ["Trend Rising ↑", stats.rising, "#FF3A30"],
            ].map(([k, v, c]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{k}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: c, fontFamily: "'IBM Plex Mono', monospace" }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
              {mapLayer === "heat" ? "Risk Legend" : mapLayer === "borough" ? "Boroughs" : "Construction"}
            </div>
            {mapLayer === "heat" && (
              <>
                {[
                  ["Critical (70-100)", "#FF3A30"],
                  ["Elevated (50-70)", "#FFA01E"],
                  ["Moderate (35-50)", "#FFD23C"],
                  ["Low (0-35)", "#32D278"],
                ].map(([label, color]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}44`, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{label}</span>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #FF3A30", background: "transparent", flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Pulsing = Reservoir</span>
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 10, lineHeight: 1.5 }}>
                  Dot size = Heat Score magnitude. Click any dot for details.
                </div>
              </>
            )}
            {mapLayer === "borough" && BOROUGHS.map(b => (
              <div key={b} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: BOROUGH_COLORS[b], flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{b}</span>
              </div>
            ))}
            {mapLayer === "construction" && (
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                Dot size and opacity represent active construction permits. Construction activity displaces rodent colonies to adjacent blocks.
              </div>
            )}
          </div>

          {/* Top Reservoirs List */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 16 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12, fontFamily: "'IBM Plex Mono', monospace" }}>Top Reservoirs</div>
            {allData.filter(z => z.isReservoir).sort((a, b) => b.heatScore - a.heatScore).slice(0, 10).map((z, i) => (
              <div key={z.zip} onClick={() => setSelectedZip(selectedZip === z.zip ? null : z.zip)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 3,
                  borderRadius: 6, cursor: "pointer", transition: "background 0.15s",
                  background: selectedZip === z.zip ? "rgba(255,58,48,0.12)" : "transparent",
                  border: selectedZip === z.zip ? "1px solid rgba(255,58,48,0.2)" : "1px solid transparent",
                }}
                onMouseEnter={e => { if (selectedZip !== z.zip) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={e => { if (selectedZip !== z.zip) e.currentTarget.style.background = "transparent"; }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(255,58,48,0.15)", color: "#FF3A30", fontSize: 10, fontWeight: 700,
                  fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>ZIP {z.zip}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{z.borough}</div>
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: "#FF3A30",
                  fontFamily: "'IBM Plex Mono', monospace",
                }}>{z.heatScore}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── MAP AREA ── */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* SVG Map */}
          <svg ref={svgRef} viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            style={{ width: "100%", height: "100%", display: "block" }}>
            <defs>
              <radialGradient id="mapBg">
                <stop offset="0%" stopColor="rgba(255,107,53,0.02)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="softGlow">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            <rect width={MAP_W} height={MAP_H} fill="url(#mapBg)" />

            {/* Grid lines */}
            {Array.from({ length: 9 }, (_, i) => {
              const y = PAD + i * ((MAP_H - PAD * 2) / 8);
              return <line key={`h${i}`} x1={PAD} y1={y} x2={MAP_W - PAD} y2={y} stroke="rgba(255,255,255,0.02)" strokeWidth={0.5} />;
            })}
            {Array.from({ length: 9 }, (_, i) => {
              const x = PAD + i * ((MAP_W - PAD * 2) / 8);
              return <line key={`v${i}`} x1={x} y1={PAD} x2={x} y2={MAP_H - PAD} stroke="rgba(255,255,255,0.02)" strokeWidth={0.5} />;
            })}

            {/* Connections between nearby reservoirs */}
            {filtered.filter(z => z.isReservoir).map((z, i, arr) => {
              const [x1, y1] = project(z.lat, z.lng, bounds, MAP_W, MAP_H, PAD);
              return arr.slice(i + 1).filter(z2 => {
                const dist = Math.sqrt((z.lat - z2.lat) ** 2 + (z.lng - z2.lng) ** 2);
                return dist < 0.025;
              }).map(z2 => {
                const [x2, y2] = project(z2.lat, z2.lng, bounds, MAP_W, MAP_H, PAD);
                return <line key={`${z.zip}-${z2.zip}`} x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="rgba(255,58,48,0.12)" strokeWidth={1} strokeDasharray="4 4" />;
              });
            })}

            {/* Borough labels (faint) */}
            {filterBorough === "All" && [
              ["Manhattan", 40.758, -73.985],
              ["Brooklyn", 40.650, -73.960],
              ["Queens", 40.735, -73.855],
              ["Bronx", 40.852, -73.890],
              ["S.I.", 40.580, -74.155],
            ].map(([name, lat, lng]) => {
              const [x, y] = project(lat, lng, bounds, MAP_W, MAP_H, PAD);
              return (
                <text key={name} x={x} y={y} textAnchor="middle" fill="rgba(255,255,255,0.08)"
                  fontSize={name === "S.I." ? 12 : 15} fontWeight={700}
                  fontFamily="'Instrument Sans', sans-serif" letterSpacing={2}>
                  {name.toUpperCase()}
                </text>
              );
            })}

            {/* Data points */}
            {filtered.map(z => {
              const [x, y] = project(z.lat, z.lng, bounds, MAP_W, MAP_H, PAD);
              const r = getRadius(z);
              const color = getColor(z);
              const isHovered = hoveredZip === z.zip;
              const isSelected = selectedZip === z.zip;

              return (
                <g key={z.zip}
                  onMouseEnter={() => setHoveredZip(z.zip)}
                  onMouseLeave={() => setHoveredZip(null)}
                  onClick={() => setSelectedZip(selectedZip === z.zip ? null : z.zip)}
                  style={{ cursor: "pointer" }}>

                  {/* Reservoir pulse ring */}
                  {z.isReservoir && mapLayer === "heat" && (
                    <circle cx={x} cy={y} r={r + 4} fill="none" stroke="rgba(255,58,48,0.4)" strokeWidth={1.5}>
                      <animate attributeName="r" from={r + 2} to={r + 18} dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Glow backdrop */}
                  <circle cx={x} cy={y} r={r * 2} fill={color} opacity={0.08} filter="url(#softGlow)" />

                  {/* Main dot */}
                  <circle cx={x} cy={y} r={isHovered || isSelected ? r + 3 : r}
                    fill={color} opacity={0.85}
                    stroke={isSelected ? "#fff" : isHovered ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.1)"}
                    strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 0.5}
                    style={{ transition: "r 0.2s, stroke-width 0.2s, opacity 0.2s", filter: z.isReservoir && mapLayer === "heat" ? "url(#glow)" : "none" }}
                  />

                  {/* ZIP label on hover */}
                  {(isHovered || isSelected) && (
                    <text x={x} y={y - r - 8} textAnchor="middle" fill="#fff" fontSize={10} fontWeight={600}
                      fontFamily="'IBM Plex Mono', monospace">
                      {z.zip}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Scale indicator */}
            <g transform={`translate(${MAP_W - PAD - 100}, ${MAP_H - PAD + 10})`}>
              <line x1={0} y1={0} x2={80} y2={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
              <line x1={0} y1={-3} x2={0} y2={3} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
              <line x1={80} y1={-3} x2={80} y2={3} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
              <text x={40} y={14} textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize={8}
                fontFamily="'IBM Plex Mono', monospace">~3 miles</text>
            </g>
          </svg>

          {/* ── HOVER TOOLTIP ── */}
          {hoveredZip && !selectedZip && (() => {
            const z = allData.find(d => d.zip === hoveredZip);
            if (!z) return null;
            const [px, py] = project(z.lat, z.lng, bounds, MAP_W, MAP_H, PAD);
            return (
              <div style={{
                position: "absolute",
                left: `${(px / MAP_W) * 100}%`,
                top: `${(py / MAP_H) * 100}%`,
                transform: "translate(-50%, -120%)",
                pointerEvents: "none",
                animation: "fadeSlideUp 0.15s ease",
              }}>
                <div style={{
                  background: "rgba(15,15,25,0.95)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, padding: "12px 16px", backdropFilter: "blur(16px)",
                  minWidth: 180, boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>ZIP {z.zip}</span>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 700,
                      background: z.isReservoir ? "rgba(255,58,48,0.2)" : "rgba(255,255,255,0.06)",
                      color: z.isReservoir ? "#FF3A30" : "rgba(255,255,255,0.5)",
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}>{z.isReservoir ? "RESERVOIR" : "NORMAL"}</span>
                  </div>
                  <div style={{ fontSize: 11, color: BOROUGH_COLORS[z.borough], marginBottom: 8 }}>{z.borough}</div>
                  <div style={{ display: "flex", gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: scoreToColor(z.heatScore), fontFamily: "'IBM Plex Mono', monospace" }}>{z.heatScore}</div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>HEAT SCORE</div>
                    </div>
                    <div style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", paddingLeft: 14, fontSize: 10, color: "rgba(255,255,255,0.5)", lineHeight: 1.8 }}>
                      {z.complaints90d} complaints<br />
                      {z.violations90d} violations<br />
                      {z.restaurantCount} restaurants
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── SELECTED DETAIL PANEL ── */}
          {selectedData && (
            <div style={{
              position: "absolute", top: 20, right: 20, width: 320,
              background: "rgba(12,12,20,0.96)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
              backdropFilter: "blur(20px)", animation: "fadeSlideUp 0.25s ease",
            }}>
              {/* Header */}
              <div style={{
                padding: "18px 20px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: `linear-gradient(135deg, ${scoreToColor(selectedData.heatScore, 0.08)}, transparent)`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Instrument Sans', sans-serif" }}>ZIP {selectedData.zip}</div>
                    <div style={{ fontSize: 12, color: BOROUGH_COLORS[selectedData.borough], marginTop: 2 }}>{selectedData.borough}</div>
                  </div>
                  <button onClick={() => setSelectedZip(null)} style={{
                    background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 6,
                    width: 28, height: 28, color: "rgba(255,255,255,0.4)", cursor: "pointer",
                    fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>✕</button>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 10 }}>
                  <div style={{
                    fontSize: 42, fontWeight: 800, color: scoreToColor(selectedData.heatScore),
                    fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1,
                  }}>{selectedData.heatScore}</div>
                  <div>
                    <div style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                      color: selectedData.isReservoir ? "#FF3A30" : "rgba(255,255,255,0.4)",
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}>{selectedData.isReservoir ? "🔴 RESERVOIR" : "NORMAL"}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <span style={{ color: trendColor(selectedData.trend), fontSize: 14 }}>{trendIcon(selectedData.trend)}</span>
                      <span style={{ fontSize: 11, color: trendColor(selectedData.trend), textTransform: "capitalize" }}>{selectedData.trend}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {[
                    ["Restaurants", selectedData.restaurantCount, "#FF6B35"],
                    ["Critical", selectedData.criticalRestaurants, "#FF3A30"],
                    ["90d Complaints", selectedData.complaints90d, "#4ECDC4"],
                    ["90d Violations", selectedData.violations90d, "#FFA01E"],
                    ["Construction", selectedData.constructionSites, "#BB8FCE"],
                    ["Avg Bldg Age", selectedData.avgBuildingAge, "#FFD23C"],
                  ].map(([label, value, color]) => (
                    <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4, fontFamily: "'IBM Plex Mono', monospace" }}>{label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Risk bar */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6, fontFamily: "'IBM Plex Mono', monospace" }}>Risk Breakdown</div>
                  <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.04)", overflow: "hidden", display: "flex" }}>
                    <div style={{ width: `${Math.min(selectedData.complaints90d / 45 * 28, 28)}%`, background: "#4ECDC4", transition: "width 0.5s" }} />
                    <div style={{ width: `${Math.min(selectedData.violations90d / 20 * 25, 25)}%`, background: "#FF6B35", transition: "width 0.5s" }} />
                    <div style={{ width: `${(2025 - selectedData.avgBuildingAge) > 80 ? 22 : 10}%`, background: "#FFD23C", transition: "width 0.5s" }} />
                    <div style={{ width: `${Math.min(selectedData.constructionSites / 8 * 18, 18)}%`, background: "#BB8FCE", transition: "width 0.5s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                    <span style={{ color: "#4ECDC4" }}>311</span>
                    <span style={{ color: "#FF6B35" }}>Violations</span>
                    <span style={{ color: "#FFD23C" }}>Age</span>
                    <span style={{ color: "#BB8FCE" }}>Construction</span>
                  </div>
                </div>

                {/* Recommendation */}
                {selectedData.isReservoir && (
                  <div style={{
                    padding: "12px 14px", borderRadius: 8, fontSize: 11, lineHeight: 1.6,
                    background: "rgba(255,58,48,0.06)", border: "1px solid rgba(255,58,48,0.12)",
                    color: "rgba(255,255,255,0.6)",
                  }}>
                    <strong style={{ color: "#FF3A30" }}>⚡ Recommended Action:</strong> Coordinate DOHMH + Sanitation sweep. {selectedData.criticalRestaurants} restaurant{selectedData.criticalRestaurants !== 1 ? "s" : ""} require priority inspection. {selectedData.constructionSites > 3 ? "Active construction is likely displacing colonies." : ""}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
