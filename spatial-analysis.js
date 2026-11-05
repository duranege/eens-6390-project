(function (global) {
  "use strict";

  function seededRandom(seed) {
    let state = (Number(seed) >>> 0) || 1;
    return function () {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  const knnCache = new WeakMap();

  function buildKnn(features, requestedK) {
    const n = features.length;
    const k = Math.max(2, Math.min(Math.floor(Number(requestedK) || 8), n - 1));
    let countyCache = knnCache.get(features);
    if (!countyCache) {
      countyCache = new Map();
      knnCache.set(features, countyCache);
    }
    if (countyCache.has(k)) return countyCache.get(k);
    const coordinates = features.map(feature => {
      const xy = feature.geometry && feature.geometry.coordinates;
      if (!Array.isArray(xy) || !Number.isFinite(Number(xy[0])) || !Number.isFinite(Number(xy[1]))) {
        throw new Error("Every bridge needs valid projected point coordinates.");
      }
      return [Number(xy[0]), Number(xy[1])];
    });
    const neighbors = Array.from({ length: n }, () => new Set());
    const pairs = new Set();

    for (let i = 0; i < n; i += 1) {
      const nearest = [];
      for (let j = 0; j < n; j += 1) {
        if (i === j) continue;
        const dx = coordinates[i][0] - coordinates[j][0];
        const dy = coordinates[i][1] - coordinates[j][1];
        nearest.push({ index: j, distance: dx * dx + dy * dy, id: String(features[j].properties.brid) });
      }
      nearest.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
      for (const item of nearest.slice(0, k)) {
        neighbors[i].add(item.index);
        neighbors[item.index].add(i);
        pairs.add(i < item.index ? `${i}:${item.index}` : `${item.index}:${i}`);
      }
    }
    const result = { neighborIndices: neighbors.map(items => Array.from(items).sort((a, b) => a - b)), pairCount: pairs.size, k };
    countyCache.set(k, result);
    return result;
  }

  function bridgeValue(feature, variable) {
    const properties = feature.properties || {};
    switch (variable) {
      case "poor_flag": return properties.brcond === "Poor" ? 1 : 0;
      case "closure_severity": return [properties.br50, properties.br100, properties.br500].filter(Boolean).length;
      case "br50": return properties.br50 ? 1 : 0;
      case "br100": return properties.br100 ? 1 : 0;
      case "br500": return properties.br500 ? 1 : 0;
      case "bradt_log1p": return Math.log1p(Number(properties.bradt));
      default: return Number(properties[variable]);
    }
  }

  function calculate(features, adjacency, options) {
    const settings = options || {};
    if (!Array.isArray(features) || features.length < 2) {
      throw new Error("At least two counties are required.");
    }
    const variable = settings.variable || "br_poorper";
    const weightType = settings.weights === "rook" ? "rook" : "queen";
    const permutations = Math.max(1, Math.min(9999, Math.floor(Number(settings.permutations) || 999)));
    const seed = Math.floor(Number(settings.seed) || 54321);
    const fips = features.map(feature => String(feature.properties.FIPS).padStart(5, "0"));
    const expectedOrder = adjacency && adjacency.fipsOrder;

    if (!adjacency || !Array.isArray(expectedOrder) || expectedOrder.length !== fips.length ||
        expectedOrder.some((id, index) => String(id).padStart(5, "0") !== fips[index])) {
      throw new Error("County order does not match the prepared spatial weights.");
    }

    const weightSet = adjacency.weights && adjacency.weights[weightType];
    if (!weightSet || !weightSet.neighbors) throw new Error("The selected county weights are unavailable.");
    const indexByFips = new Map(fips.map((id, index) => [id, index]));
    const neighborIndices = fips.map(id => {
      const neighbors = weightSet.neighbors[id];
      if (!Array.isArray(neighbors) || neighbors.length === 0) {
        throw new Error(`County ${id} has no neighbors in the prepared weights.`);
      }
      return neighbors.map(neighbor => {
        const index = indexByFips.get(String(neighbor).padStart(5, "0"));
        if (index === undefined || fips[index] === id) {
          throw new Error(`The prepared weights contain an invalid neighbor for county ${id}.`);
        }
        return index;
      });
    });

    const values = features.map(feature => Number(feature.properties[variable]));
    const label = settings.variableLabel || variable;
    return calculateWithNeighbors(features, values, neighborIndices, {
      unit: "county",
      variable,
      variableLabel: label,
      weights: weightType === "queen" ? "Queen contiguity" : "Rook contiguity",
      pairCount: Number(weightSet.pairCount),
      permutations,
      seed
    });
  }

  function calculateBridgeCounty(features, options) {
    const settings = options || {};
    if (!Array.isArray(features) || features.length < 10) {
      throw new Error("At least 10 bridge records are needed for a county-scale analysis.");
    }
    const variable = settings.variable || "poor_flag";
    const permutations = Math.max(1, Math.min(9999, Math.floor(Number(settings.permutations) || 999)));
    const seed = Math.floor(Number(settings.seed) || 54321);
    const knn = buildKnn(features, settings.neighbors || 8);
    const labels = {
      poor_flag: "Poor-condition bridge indicator (Poor = 1)",
      brage: "Bridge age (years)",
      bradt: "Average daily traffic",
      bradt_log1p: "Log(1 + average daily traffic)",
      closure_severity: "Modeled closure severity (0–3 scenarios)",
      br50: "50-year modeled closure indicator",
      br100: "100-year modeled closure indicator",
      br500: "500-year modeled closure indicator"
    };
    const values = features.map(feature => bridgeValue(feature, variable));
    const sourceValues = features.map(feature => {
      const properties = feature.properties;
      if (variable === "poor_flag") return properties.brcond === "Poor" ? 1 : 0;
      if (variable === "closure_severity") return [properties.br50, properties.br100, properties.br500].filter(Boolean).length;
      if (variable === "bradt_log1p") return Number(properties.bradt);
      if (["br50", "br100", "br500"].includes(variable)) return properties[variable] ? 1 : 0;
      return Number(properties[variable]);
    });
    return calculateWithNeighbors(features, values, knn.neighborIndices, {
      unit: "bridge",
      sourceValues,
      variable,
      variableLabel: settings.variableLabel || labels[variable] || variable,
      weights: `${knn.k}-nearest-neighbor union, row-standardized`,
      neighborsPerBridge: knn.k,
      pairCount: knn.pairCount,
      permutations,
      seed
    });
  }

  function calculateWithNeighbors(features, values, neighborIndices, settings) {
    if (values.some(value => !Number.isFinite(value))) {
      throw new Error("The selected variable contains missing or non-numeric values.");
    }
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const centered = values.map(value => value - mean);
    const denominator = centered.reduce((sum, value) => sum + value * value, 0);
    if (!Number.isFinite(denominator) || denominator <= 0) {
      throw new Error("The selected variable is constant in this scope; Moran’s I is undefined.");
    }

    function spatialLag(input) {
      return neighborIndices.map(neighbors => {
        let sum = 0;
        for (const neighbor of neighbors) sum += input[neighbor];
        return sum / neighbors.length;
      });
    }

    function statistic(input) {
      let crossProduct = 0;
      let sumSquares = 0;
      for (let index = 0; index < input.length; index += 1) {
        const neighbors = neighborIndices[index];
        let lag = 0;
        for (const neighbor of neighbors) lag += input[neighbor];
        crossProduct += input[index] * (lag / neighbors.length);
        sumSquares += input[index] * input[index];
      }
      return crossProduct / sumSquares;
    }

    const observed = statistic(centered);
    const observedLag = spatialLag(centered);
    const lagMean = observedLag.reduce((sum, value) => sum + value, 0) / observedLag.length;
    const standardDeviation = Math.sqrt(denominator / centered.length);
    const ids = features.map(feature => settings.unit === "county"
      ? String(feature.properties.FIPS).padStart(5, "0")
      : String(feature.properties.brid));
    const scatter = centered.map((value, index) => ({
      id: ids[index],
      label: settings.unit === "county" ? `${features[index].properties.CountyName} County` : `Bridge ${ids[index]}`,
      county: features[index].properties.CountyName || features[index].properties.brcounty,
      rawValue: settings.sourceValues ? settings.sourceValues[index] : values[index],
      analysisValue: values[index],
      x: value / standardDeviation,
      y: (observedLag[index] - lagMean) / standardDeviation
    }));

    const random = seededRandom(settings.seed);
    const permuted = centered.slice();
    const simulated = new Array(settings.permutations);
    let upperTailCount = 0;
    for (let run = 0; run < settings.permutations; run += 1) {
      for (let index = permuted.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [permuted[index], permuted[swapIndex]] = [permuted[swapIndex], permuted[index]];
      }
      const value = statistic(permuted);
      simulated[run] = value;
      if (value >= observed - 1e-12) upperTailCount += 1;
    }

    return {
      unit: settings.unit,
      variable: settings.variable,
      variableLabel: settings.variableLabel,
      weights: settings.weights,
      neighborsPerBridge: settings.neighborsPerBridge || null,
      n: features.length,
      pairCount: settings.pairCount,
      permutations: settings.permutations,
      seed: settings.seed,
      observed,
      pValue: (upperTailCount + 1) / (settings.permutations + 1),
      pResolution: 1 / (settings.permutations + 1),
      scatter,
      simulated
    };
  }

  global.IbisSpatialAnalysis = { calculate, calculateBridgeCounty };
})(window);