/** Full arXiv category taxonomy. `id` is for API only — UI shows `label`. */
export type CategoryOption = {
  id: string;
  label: string;
  group: string;
};

const CS = "Computer Science";
const ECON = "Economics";
const EESS = "Electrical Engineering and Systems Science";
const MATH = "Mathematics";
const ASTRO = "Astrophysics";
const CONDMAT = "Condensed Matter";
const GRQC = "General Relativity and Quantum Cosmology";
const HEPEX = "High Energy Physics - Experiment";
const HEPLAT = "High Energy Physics - Lattice";
const HEPPH = "High Energy Physics - Phenomenology";
const HEPTH = "High Energy Physics - Theory";
const MATHPH = "Mathematical Physics";
const NLIN = "Nonlinear Sciences";
const NUCLEX = "Nuclear Experiment";
const NUCLTH = "Nuclear Theory";
const PHYSICS = "Physics";
const QUANT = "Quantum Physics";
const QBIO = "Quantitative Biology";
const QFIN = "Quantitative Finance";
const STAT = "Statistics";
const BROWSE = "Browse";

export const FEED_CATEGORIES: CategoryOption[] = [
  { id: "all", label: "Everything", group: BROWSE },

  // Computer Science
  { id: "cs.AI", label: "Artificial Intelligence", group: CS },
  { id: "cs.AR", label: "Hardware Architecture", group: CS },
  { id: "cs.CC", label: "Computational Complexity", group: CS },
  { id: "cs.CE", label: "Computational Engineering, Finance, and Science", group: CS },
  { id: "cs.CG", label: "Computational Geometry", group: CS },
  { id: "cs.CL", label: "Computation and Language", group: CS },
  { id: "cs.CR", label: "Cryptography and Security", group: CS },
  { id: "cs.CV", label: "Computer Vision and Pattern Recognition", group: CS },
  { id: "cs.CY", label: "Computers and Society", group: CS },
  { id: "cs.DB", label: "Databases", group: CS },
  { id: "cs.DC", label: "Distributed, Parallel, and Cluster Computing", group: CS },
  { id: "cs.DL", label: "Digital Libraries", group: CS },
  { id: "cs.DM", label: "Discrete Mathematics", group: CS },
  { id: "cs.DS", label: "Data Structures and Algorithms", group: CS },
  { id: "cs.ET", label: "Emerging Technologies", group: CS },
  { id: "cs.FL", label: "Formal Languages and Automata Theory", group: CS },
  { id: "cs.GL", label: "General Literature", group: CS },
  { id: "cs.GR", label: "Graphics", group: CS },
  { id: "cs.GT", label: "Computer Science and Game Theory", group: CS },
  { id: "cs.HC", label: "Human-Computer Interaction", group: CS },
  { id: "cs.IR", label: "Information Retrieval", group: CS },
  { id: "cs.IT", label: "Information Theory", group: CS },
  { id: "cs.LG", label: "Machine Learning", group: CS },
  { id: "cs.LO", label: "Logic in Computer Science", group: CS },
  { id: "cs.MA", label: "Multiagent Systems", group: CS },
  { id: "cs.MM", label: "Multimedia", group: CS },
  { id: "cs.MS", label: "Mathematical Software", group: CS },
  { id: "cs.NA", label: "Numerical Analysis", group: CS },
  { id: "cs.NE", label: "Neural and Evolutionary Computing", group: CS },
  { id: "cs.NI", label: "Networking and Internet Architecture", group: CS },
  { id: "cs.OH", label: "Other Computer Science", group: CS },
  { id: "cs.OS", label: "Operating Systems", group: CS },
  { id: "cs.PF", label: "Performance", group: CS },
  { id: "cs.PL", label: "Programming Languages", group: CS },
  { id: "cs.RO", label: "Robotics", group: CS },
  { id: "cs.SC", label: "Symbolic Computation", group: CS },
  { id: "cs.SD", label: "Sound", group: CS },
  { id: "cs.SE", label: "Software Engineering", group: CS },
  { id: "cs.SI", label: "Social and Information Networks", group: CS },
  { id: "cs.SY", label: "Systems and Control", group: CS },

  // Economics
  { id: "econ.EM", label: "Econometrics", group: ECON },
  { id: "econ.GN", label: "General Economics", group: ECON },
  { id: "econ.TH", label: "Theoretical Economics", group: ECON },

  // EESS
  { id: "eess.AS", label: "Audio and Speech Processing", group: EESS },
  { id: "eess.IV", label: "Image and Video Processing", group: EESS },
  { id: "eess.SP", label: "Signal Processing", group: EESS },
  { id: "eess.SY", label: "Systems and Control", group: EESS },

  // Mathematics
  { id: "math.AC", label: "Commutative Algebra", group: MATH },
  { id: "math.AG", label: "Algebraic Geometry", group: MATH },
  { id: "math.AP", label: "Analysis of PDEs", group: MATH },
  { id: "math.AT", label: "Algebraic Topology", group: MATH },
  { id: "math.CA", label: "Classical Analysis and ODEs", group: MATH },
  { id: "math.CO", label: "Combinatorics", group: MATH },
  { id: "math.CT", label: "Category Theory", group: MATH },
  { id: "math.CV", label: "Complex Variables", group: MATH },
  { id: "math.DG", label: "Differential Geometry", group: MATH },
  { id: "math.DS", label: "Dynamical Systems", group: MATH },
  { id: "math.FA", label: "Functional Analysis", group: MATH },
  { id: "math.GM", label: "General Mathematics", group: MATH },
  { id: "math.GN", label: "General Topology", group: MATH },
  { id: "math.GR", label: "Group Theory", group: MATH },
  { id: "math.GT", label: "Geometric Topology", group: MATH },
  { id: "math.HO", label: "History and Overview", group: MATH },
  { id: "math.IT", label: "Information Theory", group: MATH },
  { id: "math.KT", label: "K-Theory and Homology", group: MATH },
  { id: "math.LO", label: "Logic", group: MATH },
  { id: "math.MG", label: "Metric Geometry", group: MATH },
  { id: "math.MP", label: "Mathematical Physics", group: MATH },
  { id: "math.NA", label: "Numerical Analysis", group: MATH },
  { id: "math.NT", label: "Number Theory", group: MATH },
  { id: "math.OA", label: "Operator Algebras", group: MATH },
  { id: "math.OC", label: "Optimization and Control", group: MATH },
  { id: "math.PR", label: "Probability", group: MATH },
  { id: "math.QA", label: "Quantum Algebra", group: MATH },
  { id: "math.RA", label: "Rings and Algebras", group: MATH },
  { id: "math.RT", label: "Representation Theory", group: MATH },
  { id: "math.SG", label: "Symplectic Geometry", group: MATH },
  { id: "math.SP", label: "Spectral Theory", group: MATH },
  { id: "math.ST", label: "Statistics Theory", group: MATH },

  // Astrophysics
  { id: "astro-ph.CO", label: "Cosmology and Nongalactic Astrophysics", group: ASTRO },
  { id: "astro-ph.EP", label: "Earth and Planetary Astrophysics", group: ASTRO },
  { id: "astro-ph.GA", label: "Astrophysics of Galaxies", group: ASTRO },
  { id: "astro-ph.HE", label: "High Energy Astrophysical Phenomena", group: ASTRO },
  { id: "astro-ph.IM", label: "Instrumentation and Methods for Astrophysics", group: ASTRO },
  { id: "astro-ph.SR", label: "Solar and Stellar Astrophysics", group: ASTRO },

  // Condensed Matter
  { id: "cond-mat.dis-nn", label: "Disordered Systems and Neural Networks", group: CONDMAT },
  { id: "cond-mat.mes-hall", label: "Mesoscale and Nanoscale Physics", group: CONDMAT },
  { id: "cond-mat.mtrl-sci", label: "Materials Science", group: CONDMAT },
  { id: "cond-mat.other", label: "Other Condensed Matter", group: CONDMAT },
  { id: "cond-mat.quant-gas", label: "Quantum Gases", group: CONDMAT },
  { id: "cond-mat.soft", label: "Soft Condensed Matter", group: CONDMAT },
  { id: "cond-mat.stat-mech", label: "Statistical Mechanics", group: CONDMAT },
  { id: "cond-mat.str-el", label: "Strongly Correlated Electrons", group: CONDMAT },
  { id: "cond-mat.supr-con", label: "Superconductivity", group: CONDMAT },

  { id: "gr-qc", label: "General Relativity and Quantum Cosmology", group: GRQC },
  { id: "hep-ex", label: "High Energy Physics - Experiment", group: HEPEX },
  { id: "hep-lat", label: "High Energy Physics - Lattice", group: HEPLAT },
  { id: "hep-ph", label: "High Energy Physics - Phenomenology", group: HEPPH },
  { id: "hep-th", label: "High Energy Physics - Theory", group: HEPTH },
  { id: "math-ph", label: "Mathematical Physics", group: MATHPH },

  // Nonlinear Sciences
  { id: "nlin.AO", label: "Adaptation and Self-Organizing Systems", group: NLIN },
  { id: "nlin.CD", label: "Chaotic Dynamics", group: NLIN },
  { id: "nlin.CG", label: "Cellular Automata and Lattice Gases", group: NLIN },
  { id: "nlin.PS", label: "Pattern Formation and Solitons", group: NLIN },
  { id: "nlin.SI", label: "Exactly Solvable and Integrable Systems", group: NLIN },

  { id: "nucl-ex", label: "Nuclear Experiment", group: NUCLEX },
  { id: "nucl-th", label: "Nuclear Theory", group: NUCLTH },

  // Physics
  { id: "physics.acc-ph", label: "Accelerator Physics", group: PHYSICS },
  { id: "physics.ao-ph", label: "Atmospheric and Oceanic Physics", group: PHYSICS },
  { id: "physics.app-ph", label: "Applied Physics", group: PHYSICS },
  { id: "physics.atm-clus", label: "Atomic and Molecular Clusters", group: PHYSICS },
  { id: "physics.atom-ph", label: "Atomic Physics", group: PHYSICS },
  { id: "physics.bio-ph", label: "Biological Physics", group: PHYSICS },
  { id: "physics.chem-ph", label: "Chemical Physics", group: PHYSICS },
  { id: "physics.class-ph", label: "Classical Physics", group: PHYSICS },
  { id: "physics.comp-ph", label: "Computational Physics", group: PHYSICS },
  { id: "physics.data-an", label: "Data Analysis, Statistics and Probability", group: PHYSICS },
  { id: "physics.ed-ph", label: "Physics Education", group: PHYSICS },
  { id: "physics.flu-dyn", label: "Fluid Dynamics", group: PHYSICS },
  { id: "physics.gen-ph", label: "General Physics", group: PHYSICS },
  { id: "physics.geo-ph", label: "Geophysics", group: PHYSICS },
  { id: "physics.hist-ph", label: "History and Philosophy of Physics", group: PHYSICS },
  { id: "physics.ins-det", label: "Instrumentation and Detectors", group: PHYSICS },
  { id: "physics.med-ph", label: "Medical Physics", group: PHYSICS },
  { id: "physics.optics", label: "Optics", group: PHYSICS },
  { id: "physics.plasm-ph", label: "Plasma Physics", group: PHYSICS },
  { id: "physics.pop-ph", label: "Popular Physics", group: PHYSICS },
  { id: "physics.soc-ph", label: "Physics and Society", group: PHYSICS },
  { id: "physics.space-ph", label: "Space Physics", group: PHYSICS },

  { id: "quant-ph", label: "Quantum Physics", group: QUANT },

  // Quantitative Biology
  { id: "q-bio.BM", label: "Biomolecules", group: QBIO },
  { id: "q-bio.CB", label: "Cell Behavior", group: QBIO },
  { id: "q-bio.GN", label: "Genomics", group: QBIO },
  { id: "q-bio.MN", label: "Molecular Networks", group: QBIO },
  { id: "q-bio.NC", label: "Neurons and Cognition", group: QBIO },
  { id: "q-bio.OT", label: "Other Quantitative Biology", group: QBIO },
  { id: "q-bio.PE", label: "Populations and Evolution", group: QBIO },
  { id: "q-bio.QM", label: "Quantitative Methods", group: QBIO },
  { id: "q-bio.SC", label: "Subcellular Processes", group: QBIO },
  { id: "q-bio.TO", label: "Tissues and Organs", group: QBIO },

  // Quantitative Finance
  { id: "q-fin.CP", label: "Computational Finance", group: QFIN },
  { id: "q-fin.EC", label: "Economics", group: QFIN },
  { id: "q-fin.GN", label: "General Finance", group: QFIN },
  { id: "q-fin.MF", label: "Mathematical Finance", group: QFIN },
  { id: "q-fin.PM", label: "Portfolio Management", group: QFIN },
  { id: "q-fin.PR", label: "Pricing of Securities", group: QFIN },
  { id: "q-fin.RM", label: "Risk Management", group: QFIN },
  { id: "q-fin.ST", label: "Statistical Finance", group: QFIN },
  { id: "q-fin.TR", label: "Trading and Market Microstructure", group: QFIN },

  // Statistics
  { id: "stat.AP", label: "Applications", group: STAT },
  { id: "stat.CO", label: "Computation", group: STAT },
  { id: "stat.ME", label: "Methodology", group: STAT },
  { id: "stat.ML", label: "Machine Learning", group: STAT },
  { id: "stat.OT", label: "Other Statistics", group: STAT },
  { id: "stat.TH", label: "Statistics Theory", group: STAT },
];

export const DEFAULT_CATEGORY = "cs.LG";
export const DEFAULT_CATEGORIES = [DEFAULT_CATEGORY];

export function isKnownCategory(id: string): boolean {
  return FEED_CATEGORIES.some((c) => c.id === id);
}

/** Dedupe, drop unknown, enforce Everything exclusivity, never empty. */
export function normalizeCategories(ids: string[]): string[] {
  const known = [...new Set(ids.filter(isKnownCategory))];
  if (known.includes("all")) return ["all"];
  if (known.length === 0) return [...DEFAULT_CATEGORIES];
  return known;
}

/** arXiv API search_query: AND intersection of selected cats. */
export function categoriesToSearchQuery(ids: string[]): string {
  const cats = normalizeCategories(ids);
  if (cats.length === 1 && cats[0] === "all") return "all:*";
  if (cats.length === 1) return `cat:${cats[0]}`;
  return cats.map((c) => `cat:${c}`).join(" AND ");
}
