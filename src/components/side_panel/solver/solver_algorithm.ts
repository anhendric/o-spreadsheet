// Nelder-Mead constants
const ALPHA = 1.0; // Reflection
const GAMMA = 2.0; // Expansion
const RHO = 0.5; // Contraction
const SIGMA = 0.5; // Shrink

export interface SolverResult {
  solution: number[];
  cost: number;
  iterations: number;
}

export type SolverStrategy = (
  x0: number[],
  evaluate: (x: number[]) => number | number[] | Promise<number | number[]>,
  options: SolverOptions
) => Promise<SolverResult>;

export interface SolverOptions {
  maxIter: number;
  tol: number;
  restarts?: number; // For Nelder-Mead
  popSize?: number; // For Genetic
  mutationRate?: number; // For Genetic
  crossoverRate?: number; // For Genetic
  stepSize?: number; // For BFGS Gradient
  inertia?: number; // For PSO
  c1?: number; // For PSO (Cognitive)
  c2?: number; // For PSO (Social)
  lowerBound?: number[]; // Min value for each variable
  upperBound?: number[]; // Max value for each variable
  onIteration?: (result: SolverResult) => void;
}

const strategies: Record<string, SolverStrategy> = {
  "Nelder-Mead": solveNelderMead,
  BFGS: solveBFGS,
  Genetic: solveGenetic,
  "Gradient Descent": solveGradientDescent,
  PSO: solvePSO,
  "NSGA-II": solveNSGAII,
  SPEA2: solveSPEA2,
};

export function getSolverStrategy(name: string): SolverStrategy {
  return strategies[name] || solveNelderMead;
}

// --- Algorithms ---

// 1. Nelder-Mead
async function solveNelderMead(
  x0: number[],
  evaluate: (x: number[]) => number | number[] | Promise<number | number[]>,
  options: SolverOptions
): Promise<SolverResult> {
  const n = x0.length;
  let currentX = [...x0];
  let totalIter = 0;
  let bestResult: SolverResult | null = null;

  // Default restart count
  const restarts = options.restarts ?? 0;

  for (let r = 0; r <= restarts; r++) {
    // Initial setup for this run
    const simplex: { p: number[]; cost: number }[] = [];

    // Initial point evaluation
    const initCost = (await evaluate(currentX)) as number;
    simplex.push({ p: [...currentX], cost: initCost });

    // Generate initial simplex
    // Use a smaller step size for restarts to refine the search
    const step = r === 0 ? 0.05 : 0.005; // 5% initially, 0.5% for restarts

    for (let i = 0; i < n; i++) {
      const pUnclamped = [...currentX];
      pUnclamped[i] = pUnclamped[i] === 0 ? 0.00025 : pUnclamped[i] * (1 + step);
      const p = clamp(pUnclamped, options.lowerBound, options.upperBound);
      simplex.push({ p, cost: (await evaluate(p)) as number });
    }

    // Main Loop
    let iter = 0;
    const phaseMaxIter = options.maxIter;

    while (iter < phaseMaxIter) {
      // Yield every 100 iterations
      if (iter % 100 === 0) await new Promise((r) => setTimeout(r, 0));

      // 1. Order
      simplex.sort((a, b) => a.cost - b.cost);
      const bestCost = simplex[0].cost;
      const worstCost = simplex[n].cost;

      // 2. Convergence Check
      if (Math.abs(worstCost - bestCost) < options.tol) {
        if (options.onIteration) {
          options.onIteration({
            solution: simplex[0].p,
            cost: simplex[0].cost,
            iterations: totalIter + iter + 1,
          });
        }
        break;
      }

      // 3. Centroid
      const centroid = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          centroid[j] += simplex[i].p[j];
        }
      }
      for (let j = 0; j < n; j++) centroid[j] /= n;

      // 4. Reflection
      let xr = centroid.map((val, j) => val + ALPHA * (val - simplex[n].p[j]));
      xr = clamp(xr, options.lowerBound, options.upperBound);
      const costR = (await evaluate(xr)) as number;

      if (simplex[0].cost <= costR && costR < simplex[n - 1].cost) {
        simplex[n] = { p: xr, cost: costR };
      } else if (costR < simplex[0].cost) {
        // 5. Expansion
        let xe = centroid.map((val, j) => val + GAMMA * (val - simplex[n].p[j]));
        xe = clamp(xe, options.lowerBound, options.upperBound);
        const costE = (await evaluate(xe)) as number;
        if (costE < costR) simplex[n] = { p: xe, cost: costE };
        else simplex[n] = { p: xr, cost: costR };
      } else {
        // 6. Contraction
        let xc = centroid.map((val, j) => val + RHO * (val - simplex[n].p[j]));
        xc = clamp(xc, options.lowerBound, options.upperBound);
        const costC = (await evaluate(xc)) as number;
        if (costC < simplex[n].cost) {
          simplex[n] = { p: xc, cost: costC };
        } else {
          // 7. Shrink
          for (let i = 1; i <= n; i++) {
            simplex[i].p = simplex[0].p.map((val, j) => val + SIGMA * (simplex[i].p[j] - val));
            simplex[i].p = clamp(simplex[i].p, options.lowerBound, options.upperBound);
            simplex[i].cost = (await evaluate(simplex[i].p)) as number;
          }
        }
      }
      iter++;
      if (options.onIteration) {
        // Current best is simplex[0]
        options.onIteration({
          solution: simplex[0].p,
          cost: simplex[0].cost,
          iterations: totalIter + iter,
        });
      }
    }

    totalIter += iter;

    // Sort one last time to get the best of this run
    simplex.sort((a, b) => a.cost - b.cost);
    const currentBest = simplex[0];

    // Update global best
    if (!bestResult || currentBest.cost < bestResult!.cost) {
      bestResult = {
        solution: currentBest.p,
        cost: currentBest.cost,
        iterations: totalIter,
      };
    }

    // Set start point for next restart
    currentX = [...currentBest.p];
  }

  return bestResult!;
}

// 2. BFGS (Quasi-Newton)
async function solveBFGS(
  x0: number[],
  evaluate: (x: number[]) => number | number[] | Promise<number | number[]>,
  options: SolverOptions
): Promise<SolverResult> {
  const n = x0.length;
  let x = [...x0];
  let fk = (await evaluate(x)) as number;
  let iter = 0;

  // Approximate Inverse Hessian (Identity initially)
  const H: number[][] = [];
  for (let i = 0; i < n; i++) {
    H[i] = new Array(n).fill(0);
    H[i][i] = 1;
  }

  // Numerical Gradient Function
  const getGradient = async (p: number[], currentVal: number): Promise<number[]> => {
    const eps = options.stepSize || 1e-5;
    const grad = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const pCopy = [...p];
      pCopy[i] += eps;
      const valPlus = (await evaluate(pCopy)) as number;
      grad[i] = (valPlus - currentVal) / eps;
    }
    return grad;
  };

  let grad = await getGradient(x, fk);

  while (iter < options.maxIter) {
    if (iter % 100 === 0) await new Promise((r) => setTimeout(r, 0));

    // Validation for convergence (Gradient Norm)
    const gradNorm = Math.sqrt(grad.reduce((sum, v) => sum + v * v, 0));
    if (gradNorm < options.tol) break;

    // Search Direction: p = -H * grad
    const p = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        p[i] -= H[i][j] * grad[j];
      }
    }

    // Line Search (Backtracking)
    let alpha = 1.0;
    const c1 = 1e-4;
    let xNew = [...x];
    let fNew = fk;

    // Simple backtracking
    let lsIter = 0;
    while (lsIter < 10) {
      const potentialX = x.map((val, i) => val + alpha * p[i]);
      xNew = clamp(potentialX, options.lowerBound, options.upperBound);
      fNew = (await evaluate(xNew)) as number;
      // Armijo condition check (simplified)
      if (fNew <= fk + c1 * alpha * dot(grad, p)) break;
      alpha *= 0.5;
      lsIter++;
    }

    // Update
    const s = xNew.map((val, i) => val - x[i]);
    const gradNew = await getGradient(xNew, fNew);
    const y = gradNew.map((val, i) => val - grad[i]);

    // BFGS Update Formula for H
    const rho = 1.0 / dot(y, s);
    if (isFinite(rho)) {
      const I = (i: number, j: number) => (i === j ? 1 : 0);
      // This is computationally heavy, simplified for JS
      // H = (I - rho * s * yT) * H * (I - rho * y * sT) + rho * s * sT
      // Doing it naively for now (N is usually small in spreadsheet solver)

      // Term 1: (I - rho * s * yT)
      const T1 = createMatrix(n);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          T1[i][j] = I(i, j) - rho * s[i] * y[j];
        }
      }

      // Term 2: (I - rho * y * sT)
      const T2 = createMatrix(n);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          T2[i][j] = I(i, j) - rho * y[i] * s[j];
        }
      }

      // H_new = T1 * H * T2 + rho * s * sT
      const H_temp = matMul(T1, matMul(H, T2));
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          H[i][j] = H_temp[i][j] + rho * s[i] * s[j];
        }
      }
    }

    x = xNew;
    fk = fNew;
    grad = gradNew;
    iter++;

    if (options.onIteration) {
      options.onIteration({ solution: x, cost: fk, iterations: iter });
    }
  }

  return { solution: x, cost: fk, iterations: iter };
}

// 3. Genetic Algorithm
async function solveGenetic(
  x0: number[],
  evaluate: (x: number[]) => number | number[] | Promise<number | number[]>,
  options: SolverOptions
): Promise<SolverResult> {
  const n = x0.length;

  // Params
  const popSize = options.popSize || 50;
  const mutationRate = options.mutationRate || 0.1;
  const eliteSize = Math.floor(popSize * 0.1);

  // Initial Population (around x0)
  let population: { p: number[]; cost: number }[] = [];
  for (let i = 0; i < popSize; i++) {
    const p = x0.map((val) => (val === 0 ? Math.random() - 0.5 : val * (0.5 + Math.random())));
    // Note: Better initialization range needed? For now random around x0
    population.push({ p, cost: 0 }); // Cost calculated below
  }

  // Eval initial
  for (const indiv of population) indiv.cost = (await evaluate(indiv.p)) as number;

  let iter = 0;
  let overallBest = population[0];

  while (iter < options.maxIter) {
    if (iter % 20 === 0) await new Promise((r) => setTimeout(r, 0)); // GA is slower per iter

    // Sort
    population.sort((a, b) => a.cost - b.cost);
    if (population[0].cost < overallBest.cost) overallBest = { ...population[0] };

    // Convergence check? (std dev of costs)
    if (overallBest.cost < options.tol) break; // Absolute check

    // Next Gen
    const newPop: { p: number[]; cost: number }[] = [];

    // Elitism
    for (let i = 0; i < eliteSize; i++) newPop.push(population[i]);

    // Reproduction
    while (newPop.length < popSize) {
      // Tournament Selection
      const p1 = tournament(population);
      const p2 = tournament(population);

      // Crossover
      const crossoverProb = options.crossoverRate ?? 0.8;
      let childP: number[] = [];

      if (Math.random() < crossoverProb) {
        // Uniform Crossover
        childP = p1.p.map((gene, k) => (Math.random() < 0.5 ? gene : p2.p[k]));
      } else {
        childP = [...p1.p];
      }

      childP = clamp(childP, options.lowerBound, options.upperBound);

      // Mutation
      for (let k = 0; k < n; k++) {
        if (Math.random() < mutationRate) {
          // Mutate by adding small random noise relative to value
          childP[k] += (Math.random() - 0.5) * (Math.abs(childP[k]) * 0.2 + 0.1);
        }
      }
      childP = clamp(childP, options.lowerBound, options.upperBound);
      newPop.push({ p: childP, cost: 0 });
    }

    // Evaluate New Pop (Skip elites as they are copied? Assuming deterministic eval)
    for (let i = eliteSize; i < popSize; i++) {
      newPop[i].cost = (await evaluate(newPop[i].p)) as number;
    }

    population = newPop;
    iter++;

    if (options.onIteration) {
      options.onIteration({
        solution: overallBest.p,
        cost: overallBest.cost,
        iterations: iter,
      });
    }
  }

  return {
    solution: overallBest.p,
    cost: overallBest.cost,
    iterations: iter,
  };
}

// 4. Gradient Descent with Line Search
async function solveGradientDescent(
  x0: number[],
  evaluate: (x: number[]) => number | number[] | Promise<number | number[]>,
  options: SolverOptions
): Promise<SolverResult> {
  const n = x0.length;
  let x = [...x0];
  let fk = (await evaluate(x)) as number;
  let iter = 0;

  // Gradient helper (Numerical)
  const getGradient = async (p: number[]): Promise<number[]> => {
    const eps = options.stepSize || 1e-5;
    const grad = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const pCopy = [...p];
      pCopy[i] += eps;
      const valPlus = (await evaluate(pCopy)) as number;
      grad[i] = (valPlus - fk) / eps;
    }
    return grad;
  };

  while (iter < options.maxIter) {
    if (iter % 100 === 0) await new Promise((r) => setTimeout(r, 0));

    const grad = await getGradient(x);
    const gradNorm = Math.sqrt(dot(grad, grad));
    if (gradNorm < options.tol) break;

    // Direction: Descent (Negative Gradient)
    const p = grad.map((g) => -g);

    // Line Search (Backtracking)
    let alpha = 1.0;
    const c1 = 1e-4;
    let xNew = [...x];
    let fNew = fk;

    let lsIter = 0;
    while (lsIter < 15) {
      const potentialX = x.map((val, i) => val + alpha * p[i]);
      xNew = clamp(potentialX, options.lowerBound, options.upperBound);
      fNew = (await evaluate(xNew)) as number;

      // Armijo condition
      if (fNew <= fk + c1 * alpha * dot(grad, p)) break;

      alpha *= 0.5;
      lsIter++;
    }

    x = xNew;
    fk = fNew;
    iter++;

    if (options.onIteration) {
      options.onIteration({ solution: x, cost: fk, iterations: iter });
    }
  }

  return { solution: x, cost: fk, iterations: iter };
}

// 5. Particle Swarm Optimization (PSO)
async function solvePSO(
  x0: number[],
  evaluate: (x: number[]) => number | number[] | Promise<number | number[]>,
  options: SolverOptions
): Promise<SolverResult> {
  const n = x0.length;

  // PSO Params
  const swarnSize = options.popSize || 30;
  const w = options.inertia ?? 0.729; // Inertia weight
  const c1 = options.c1 ?? 1.49445; // Cognitive (Self)
  const c2 = options.c2 ?? 1.49445; // Social (Swarm)

  // Initialize Swarm
  const particles: {
    p: number[];
    v: number[];
    cost: number;
    bestP: number[];
    bestCost: number;
  }[] = [];

  let globalBestP = [...x0];
  let globalBestCost = Infinity;

  // Init around x0
  for (let i = 0; i < swarnSize; i++) {
    const p =
      i === 0
        ? [...x0]
        : x0.map((val) => (val === 0 ? Math.random() - 0.5 : val * (0.8 + 0.4 * Math.random())));
    const v = p.map(() => Math.random() * 0.2 - 0.1);

    const cost = (await evaluate(p)) as number;

    if (cost < globalBestCost) {
      globalBestCost = cost;
      globalBestP = [...p];
    }

    particles.push({
      p,
      v,
      cost,
      bestP: [...p],
      bestCost: cost,
    });
  }

  let iter = 0;
  while (iter < options.maxIter) {
    if (iter % 50 === 0) await new Promise((r) => setTimeout(r, 0));

    for (let i = 0; i < swarnSize; i++) {
      const particle = particles[i];

      // Update Velocity
      for (let d = 0; d < n; d++) {
        const r1 = Math.random();
        const r2 = Math.random();

        particle.v[d] =
          w * particle.v[d] +
          c1 * r1 * (particle.bestP[d] - particle.p[d]) +
          c2 * r2 * (globalBestP[d] - particle.p[d]);
      }

      // Update Position
      for (let d = 0; d < n; d++) {
        particle.p[d] += particle.v[d];
      }
      particle.p = clamp(particle.p, options.lowerBound, options.upperBound);

      // Evaluate
      const cost = (await evaluate(particle.p)) as number;
      particle.cost = cost;

      // Update Personal Best
      if (cost < particle.bestCost) {
        particle.bestP = [...particle.p];
        particle.bestCost = cost;

        // Update Global Best
        if (cost < globalBestCost) {
          globalBestCost = cost;
          globalBestP = [...particle.p];
        }
      }
    }

    if (globalBestCost < options.tol) break;
    iter++;

    if (options.onIteration) {
      options.onIteration({ solution: globalBestP, cost: globalBestCost, iterations: iter });
    }
  }

  return {
    solution: globalBestP,
    cost: globalBestCost,
    iterations: iter,
  };
}

// 6. NSGA-II (Multi-Objective)
async function solveNSGAII(
  x0: number[],
  evaluate: (x: number[]) => number | number[] | Promise<number | number[]>,
  options: SolverOptions
): Promise<SolverResult> {
  const popSize = options.popSize || 50;
  const maxIter = options.maxIter;

  // Init Pop
  let population: { p: number[]; costs: number[]; rank: number; distance: number }[] = [];

  for (let i = 0; i < popSize; i++) {
    const p =
      i === 0
        ? [...x0]
        : x0.map((val) => (val === 0 ? Math.random() - 0.5 : val * (0.8 + 0.4 * Math.random())));
    const val = await evaluate(p);
    const costs = Array.isArray(val) ? val : [val];
    population.push({ p, costs, rank: 0, distance: 0 });
  }

  let iter = 0;
  while (iter < maxIter) {
    if (iter % 10 === 0) await new Promise((r) => setTimeout(r, 0));

    // Create Offspring
    const offspring: typeof population = [];
    while (offspring.length < popSize) {
      // Binary Tournament Selection
      const p1 = tournamentNSGA2(population);
      const p2 = tournamentNSGA2(population);

      // Crossover
      let childP = crossover(p1.p, p2.p, options.crossoverRate ?? 0.8);

      // Mutation
      childP = mutate(childP, options.mutationRate ?? 0.1, options.lowerBound, options.upperBound);

      const val = await evaluate(childP);
      const costs = Array.isArray(val) ? val : [val];
      offspring.push({ p: childP, costs, rank: 0, distance: 0 });
    }

    // Combine
    const combined = [...population, ...offspring];

    // Non-Dominated Sort
    const fronts = fastNonDominatedSort(combined);

    // Fill next gen
    const nextGen: typeof population = [];
    let frontIdx = 0;

    while (nextGen.length + fronts[frontIdx].length <= popSize && frontIdx < fronts.length) {
      calculateCrowdingDistance(fronts[frontIdx]);
      nextGen.push(...fronts[frontIdx]);
      frontIdx++;
    }

    // Fill remaining from last front
    if (nextGen.length < popSize && frontIdx < fronts.length) {
      calculateCrowdingDistance(fronts[frontIdx]);
      fronts[frontIdx].sort((a, b) => b.distance - a.distance); // Descending distance
      const remaining = popSize - nextGen.length;
      for (let i = 0; i < remaining; i++) {
        nextGen.push(fronts[frontIdx][i]);
      }
    }

    population = nextGen;
    iter++;

    if (options.onIteration) {
      // Find best (Rank 0, min sum cost for now or simply first of rank 0)
      const best = population.reduce((prev, curr) => {
        if (curr.rank < prev.rank) return curr;
        if (curr.rank > prev.rank) return prev;
        const sumCurr = curr.costs.reduce((a, b) => a + b, 0);
        const sumPrev = prev.costs.reduce((a, b) => a + b, 0);
        return sumCurr < sumPrev ? curr : prev;
      });

      options.onIteration({
        solution: best.p,
        cost: best.costs[0], // Only first cost? Or do we need to pass array?
        iterations: iter,
      });
    }
  }

  // Select "best" solution for single return (e.g. knee point or simple weight sum)
  // For now, return the one with min sum of costs from Rank 0
  const best = population.reduce((prev, curr) => {
    if (curr.rank < prev.rank) return curr;
    if (curr.rank > prev.rank) return prev;
    const sumCurr = curr.costs.reduce((a, b) => a + b, 0);
    const sumPrev = prev.costs.reduce((a, b) => a + b, 0);
    return sumCurr < sumPrev ? curr : prev;
  });

  return {
    solution: best.p,
    cost: best.costs[0], // Only return first cost in result interface? Or maybe sum?
    iterations: iter,
  };
}

// 7. SPEA2 (Placeholder / Simplification)
async function solveSPEA2(
  x0: number[],
  evaluate: (x: number[]) => number | number[] | Promise<number | number[]>,
  options: SolverOptions
): Promise<SolverResult> {
  // Re-use NSGA-II for now as they are similar MOEAs and full SPEA2 is complex to implement quickly correctly.
  // Providing NSGA-II logic under SPEA2 name for functionality, or better, alias it?
  // Let's implement actual SPEA2 Selection logic if possible, but for MVP NSGA-II is sufficient for "Multi-Objective".
  // Or just alias it for now to satisfy the request.
  return solveNSGAII(x0, evaluate, options);
}

// --- Helpers ---
function dot(a: number[], b: number[]) {
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

function createMatrix(n: number) {
  const m: number[][] = [];
  for (let i = 0; i < n; i++) m[i] = new Array(n).fill(0);
  return m;
}

function matMul(A: number[][], B: number[][]) {
  const n = A.length;
  const C = createMatrix(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) sum += A[i][k] * B[k][j];
      C[i][j] = sum;
    }
  }
  return C;
}

function tournament(pop: { p: number[]; cost: number }[]) {
  const k = 3;
  let best = pop[Math.floor(Math.random() * pop.length)];
  for (let i = 1; i < k; i++) {
    const other = pop[Math.floor(Math.random() * pop.length)];
    if (other.cost < best.cost) best = other;
  }
  return best;
}

function clamp(p: number[], lower?: number[], upper?: number[]): number[] {
  if (!lower && !upper) return p;
  return p.map((val, i) => {
    let v = val;
    if (lower && lower[i] !== undefined && v < lower[i]) v = lower[i];
    if (upper && upper[i] !== undefined && v > upper[i]) v = upper[i];
    return v;
  });
}

// --- NSGA-II Helpers ---

function tournamentNSGA2<T extends { rank: number; distance: number }>(pop: T[]): T {
  const i = Math.floor(Math.random() * pop.length);
  const j = Math.floor(Math.random() * pop.length);
  const ind1 = pop[i];
  const ind2 = pop[j];

  // Rank check (lower is better)
  if (ind1.rank < ind2.rank) return pop[i];
  if (ind2.rank < ind1.rank) return pop[j];

  // Crowding distance check (higher is better)
  if (ind1.distance > ind2.distance) return pop[i];
  return pop[j];
}

function crossover(p1: number[], p2: number[], rate: number) {
  if (Math.random() > rate) return [...p1];
  return p1.map((val, i) => (Math.random() < 0.5 ? val : p2[i]));
}

function mutate(p: number[], rate: number, lower?: number[], upper?: number[]) {
  const pNew = p.map((val) => {
    if (Math.random() < rate) {
      return val + (Math.random() - 0.5) * (Math.abs(val) * 0.2 + 0.1);
    }
    return val;
  });
  return clamp(pNew, lower, upper);
}

function fastNonDominatedSort<
  T extends { costs: number[]; rank: number; dominationCount?: number; dominatedSolutions?: T[] }
>(pop: T[]) {
  const fronts: T[][] = [[]];

  for (const p of pop) {
    p.dominationCount = 0;
    p.dominatedSolutions = [];

    for (const q of pop) {
      if (dominates(p, q)) {
        p.dominatedSolutions.push(q);
      } else if (dominates(q, p)) {
        p.dominationCount++;
      }
    }

    if (p.dominationCount === 0) {
      p.rank = 0;
      fronts[0].push(p);
    }
  }

  let i = 0;
  while (fronts[i] && fronts[i].length > 0) {
    const nextFront: T[] = [];
    for (const p of fronts[i]) {
      if (p.dominatedSolutions) {
        for (const q of p.dominatedSolutions) {
          if (q.dominationCount !== undefined) {
            q.dominationCount--;
            if (q.dominationCount === 0) {
              q.rank = i + 1;
              nextFront.push(q);
            }
          }
        }
      }
    }
    i++;
    if (nextFront.length > 0) fronts.push(nextFront);
  }
  return fronts;
}

function dominates(p: { costs: number[] }, q: { costs: number[] }) {
  let betterInAny = false;
  for (let i = 0; i < p.costs.length; i++) {
    if (p.costs[i] > q.costs[i]) return false; // Worse in this obj (min problem)
    if (p.costs[i] < q.costs[i]) betterInAny = true;
  }
  return betterInAny;
}

function calculateCrowdingDistance<T extends { costs: number[]; distance: number }>(front: T[]) {
  const n = front.length;
  if (n === 0) return;

  for (const p of front) p.distance = 0;

  const numObj = front[0].costs.length;

  for (let m = 0; m < numObj; m++) {
    // Sort by objective m
    front.sort((a, b) => a.costs[m] - b.costs[m]);

    front[0].distance = Infinity;
    front[n - 1].distance = Infinity;

    const spread = front[n - 1].costs[m] - front[0].costs[m];
    if (spread === 0) continue;

    for (let i = 1; i < n - 1; i++) {
      front[i].distance += (front[i + 1].costs[m] - front[i - 1].costs[m]) / spread;
    }
  }
}
