// --- F-Distribution Helpers ---

/**
 * Log Gamma function (Lanczos approximation)
 * Used for Beta function calculation.
 */
function logGamma(z: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  const x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/**
 * Regularized Incomplete Beta function I_x(a, b)
 * Computed using continued fraction representation.
 */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x === 0) return 0;
  if (x === 1) return 1;

  const bt =
    x === 0 || x === 1
      ? 0
      : Math.exp(
          logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
        );

  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(x, a, b)) / a;
  } else {
    // Symmetry relation
    return 1 - (bt * betacf(1 - x, b, a)) / b;
  }
}

/**
 * Continued fraction for Incomplete Beta function
 */
function betacf(x: number, a: number, b: number): number {
  const MAXIT = 100;
  const EPS = 3.0e-7;
  const FPMIN = 1.0e-30;

  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1.0) < EPS) break;
  }
  return h;
}

/**
 * F-Distribution CDF
 * P(X <= x) where X ~ F(d1, d2)
 * Relation to Beta: I_{d1*x / (d1*x + d2)} (d1/2, d2/2)
 */
export function fDistributionCDF(x: number, d1: number, d2: number): number {
  if (x < 0) return 0;
  const val = (d1 * x) / (d1 * x + d2);
  return incompleteBeta(val, d1 / 2, d2 / 2);
}

/**
 * Inverse F-Distribution (Quantile function)
 * Finds x such that P(X <= x) = p
 */
export function fDistributionInverse(p: number, d1: number, d2: number): number {
  if (p < 0 || p > 1) return NaN;
  if (p === 0) return 0;
  if (p === 1) return Infinity;

  let min = 0;
  let max = 10; // Initial guess

  // Expand search range if needed
  while (fDistributionCDF(max, d1, d2) < p) {
    if (max > 1e10) break; // Avoid infinite loop
    min = max;
    max *= 2;
  }

  const tolerance = 1e-6;
  let iter = 0;
  while (iter < 100) {
    const mid = (min + max) / 2;
    const val = fDistributionCDF(mid, d1, d2);
    if (Math.abs(val - p) < tolerance) return mid;

    if (val < p) {
      min = mid;
    } else {
      max = mid;
    }
    iter++;
  }
  return (min + max) / 2;
}

// --- ANOVA Calculations ---

export interface AnovaResult {
  summary: {
    groups: string[];
    count: number[];
    sum: number[];
    average: number[];
    variance: number[];
  };
  anova: {
    source: string[];
    ss: number[];
    df: number[];
    ms: number[];
    f: number[];
    pValue: number[];
    fCrit: number[];
  };
}

export function calculateOneWayAnova(
  data: number[][],
  groupNames: string[],
  alpha: number = 0.05
): AnovaResult {
  const k = data.length; // Number of groups
  const nPerGroup = data.map((group) => group.length);
  const N = nPerGroup.reduce((a, b) => a + b, 0); // Total observations

  if (k < 2 || N <= k) {
    throw new Error("Insufficient data for ANOVA");
  }

  // 1. Summary Statistics
  const sums = data.map((group) => group.reduce((a, b) => a + b, 0));
  const averages = data.map((group) =>
    group.length ? group.reduce((a, b) => a + b, 0) / group.length : 0
  );
  const variances = data.map((group, i) => {
    if (group.length <= 1) return 0;
    const avg = averages[i];
    // Sample variance: sum((x - mean)^2) / (n - 1)
    const sumSqDiff = group.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0);
    return sumSqDiff / (group.length - 1);
  });

  // 2. ANOVA Table Calculations

  // Grand Mean
  const totalSum = sums.reduce((a, b) => a + b, 0);

  // SS Total = sum(x^2) - (sum(x))^2 / N
  let sumSqTotal = 0;
  for (const group of data) {
    for (const val of group) {
      sumSqTotal += val * val;
    }
  }
  const correctionFactor = (totalSum * totalSum) / N;
  const ssTotal = sumSqTotal - correctionFactor;

  // SS Between (Treatment) = sum( (sum_i)^2 / n_i ) - CF
  let sumSqGroups = 0;
  for (let i = 0; i < k; i++) {
    if (nPerGroup[i] > 0) {
      sumSqGroups += (sums[i] * sums[i]) / nPerGroup[i];
    }
  }
  const ssBetween = sumSqGroups - correctionFactor;

  // SS Within (Error) = SS Total - SS Between
  const ssWithin = ssTotal - ssBetween;

  // Degrees of Freedom
  const dfBetween = k - 1;
  const dfWithin = N - k; // N - k
  const dfTotal = N - 1;

  // Mean Squares
  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;

  // F Statistic
  const fStat = msWithin === 0 ? NaN : msBetween / msWithin;

  // P-Value and F-Critical
  // P-value is 1 - CDF(fStat)
  const pValue = isNaN(fStat) ? NaN : 1 - fDistributionCDF(fStat, dfBetween, dfWithin);
  const fCrit = fDistributionInverse(1 - alpha, dfBetween, dfWithin);

  return {
    summary: {
      groups: groupNames,
      count: nPerGroup,
      sum: sums,
      average: averages,
      variance: variances,
    },
    anova: {
      source: ["Between Groups", "Within Groups", "Total"],
      ss: [ssBetween, ssWithin, ssTotal],
      df: [dfBetween, dfWithin, dfTotal],
      ms: [msBetween, msWithin, NaN],
      f: [fStat, NaN, NaN],
      pValue: [pValue, NaN, NaN],
      fCrit: [fCrit, NaN, NaN],
    },
  };
}

export function calculateTwoWayAnovaRep(
  data: number[][][], // [rowGroup][colGroup][replication]
  rowLabels: string[],
  colLabels: string[],
  alpha: number
): any {
  // Implementation for Two-Way ANOVA with replication
  // Placeholder structure
  return { error: "Not Implemented Yet" };
}
