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

  function calculate(features, adjacency, options) {
    const settings = options || {};
    const variable = settings.variable || "br_poorper";
    const weightType = settings.weights === "rook" ? "rook" : "queen";
    const permutations = Math.max(1, Math.min(9999, Math.floor(Number(settings.permutations) || 999)));
    const seed = Math.floor(Number(settings.seed) || 54321);
    if (!Array.isArray(features) || features.length < 2) {
      throw new Error("At least two counties are required.");
    }
    const fips = features.map(feature => String(feature.properties.FIPS).padStart(5, "0"));
    const expectedOrder = adjacency && adjacency.fipsOrder;

    if (!adjacency || !Array.isArray(expectedOrder) || expectedOrder.length !== fips.length ||
        expectedOrder.some((id, index) => String(id).padStart(5, "0") !== fips[index])) {
      throw new Error("County order does not match the prepared spatial weights.");
    }

    const values = features.map(feature => Number(feature.properties[variable]));
    if (values.some(value => !Number.isFinite(value))) {
      throw new Error("The selected county variable contains missing or non-numeric values.");
    }

    const weightSet = adjacency.weights && adjacency.weights[weightType];
    if (!weightSet || !weightSet.neighbors) {
      throw new Error("The selected spatial weights are unavailable.");
    }

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

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const centered = values.map(value => value - mean);
    const denominator = centered.reduce((sum, value) => sum + value * value, 0);
    if (!Number.isFinite(denominator) || denominator <= 0) {
      throw new Error("The selected county variable is constant; Moran's I is undefined.");
    }

    function spatialLag(input) {
      return neighborIndices.map(neighbors => {
        let sum = 0;
        for (const neighbor of neighbors) sum += input[neighbor];
        return sum / neighbors.length;
      });
    }

    function statistic(input) {
      const lag = spatialLag(input);
      let crossProduct = 0;
      let sumSquares = 0;
      for (let index = 0; index < input.length; index += 1) {
        crossProduct += input[index] * lag[index];
        sumSquares += input[index] * input[index];
      }
      return crossProduct / sumSquares;
    }

    const observed = statistic(centered);
    const observedLag = spatialLag(centered);
    const lagMean = observedLag.reduce((sum, value) => sum + value, 0) / observedLag.length;
    const standardDeviation = Math.sqrt(denominator / centered.length);
    const scatter = centered.map((value, index) => ({
      fips: fips[index],
      name: features[index].properties.CountyName,
      x: value / standardDeviation,
      y: (observedLag[index] - lagMean) / standardDeviation
    }));

    const random = seededRandom(seed);
    const permuted = centered.slice();
    const simulated = new Array(permutations);
    let upperTailCount = 0;
    for (let run = 0; run < permutations; run += 1) {
      for (let index = permuted.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [permuted[index], permuted[swapIndex]] = [permuted[swapIndex], permuted[index]];
      }
      const value = statistic(permuted);
      simulated[run] = value;
      if (value >= observed - 1e-12) upperTailCount += 1;
    }

    return {
      variable,
      weights: weightType,
      n: features.length,
      pairCount: Number(weightSet.pairCount),
      permutations,
      seed,
      observed,
      pValue: (upperTailCount + 1) / (permutations + 1),
      pResolution: 1 / (permutations + 1),
      scatter,
      simulated
    };
  }

  global.IbisSpatialAnalysis = { calculate };
})(window);