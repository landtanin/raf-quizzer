import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Card = {
  question: string;
  answers: string[];
};

type EvalResult = {
  matched: number[];
  missed: number[];
  scores: number[];
};

const STORAGE_KEY = "quizzer-deck";

const fallbackDeck: Card[] = [
  {
    question: "TK1.1 – Inclusion of a change control process",
    answers: [
      "variations, baseline, CCP aligns this with governance structures and organisational strategy",
      "traceable decision making – delegated authority, accountability, auditability (=transparency for SH)",
      "benefit realisation chances, before/while escalating/rebaselining",
      "undermines cost, schedule, quality baselines, affect entire departments' operations",
      "sponsors to make better decisions",
    ],
  },
  {
    question: "TK1.2 – Capturing and recording change requests",
    answers: [
      "reviews: risk, schedule, cost – deviation from tolerated variance",
      "change request form, clear, standardised",
      "change log/register, (5 options with +/-)",
    ],
  },
  {
    question: "TK1.3 – High-level impact of a proposed change",
    answers: [
      "Generic Impact Assessment: SMEs/key SH, working assumptions, Iterative estimation",
      "risk and opp assessment techniques",
      "benefits, cost (CB analysis), time, quality, resource & dependencies (scenario anal.)",
    ],
  },
  {
    question: "TK1.4 – Justifying approval, rejection, or deferral",
    answers: [
      "compare change against BC, benefits realisation plan and portfolio/strategy alignment/fit",
      "decision gate criteria, risk appetite and contingency availability",
      "SH influence/own some of the reqs",
      "Quantitative aspect (cost/benefit, NPV, earned value)",
    ],
  },
  {
    question: "TK1.5 – Communicating outcomes",
    answers: [
      "openness and alignment with SH, Ethical thing to do and aligns with audit and assurance processes",
      "continuous improvement – organisational knowledge management",
      "informed decisions, re baseline plans and budgets promptly",
    ],
  },
  {
    question: "TK1.6 – Applying an approved change",
    answers: [
      "formal authorisation",
      "update the baselines for each",
      "communicate",
      "review change as part of continuous improvement and benefits review",
      "configuration control to ensure outputs match approved specs",
    ],
  },
  {
    question: "TK1.7 – Patterns of change and trend analysis",
    answers: [
      "statistical trend analysis (below), moving averages, regression analysis, comparative analysis",
      "PM to then characterise the trend – direction, strength",
      "descriptive, diagnostic, predictive",
      "limitations: bias in interpretation, size of sample",
      "verification, identified or suspected",
    ],
  },
];

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (text: string) => {
  const norm = normalize(text);
  return norm ? Array.from(new Set(norm.split(" "))) : [];
};

const similarity = (a: string, b: string) => {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  if (!aTokens.length || !bTokens.length) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.includes(token)) overlap += 1;
  }
  return (2 * overlap) / (aTokens.length + bTokens.length); // Dice coefficient on tokens
};

function evaluate(userInput: string, answers: string[], threshold: number): EvalResult {
  const userLines = userInput.split(/\n+/).map(normalize).filter(Boolean);
  const pooledInput = normalize(userInput);
  const pools = pooledInput ? [pooledInput, ...userLines] : userLines;

  const matched: number[] = [];
  const missed: number[] = [];
  const scores: number[] = [];

  answers.forEach((answer, idx) => {
    const normAns = normalize(answer);
    let bestScore = 0;
    for (const line of pools) {
      bestScore = Math.max(bestScore, similarity(normAns, line));
    }
    scores.push(bestScore);
    if (bestScore >= threshold) {
      matched.push(idx);
    } else {
      missed.push(idx);
    }
  });

  return { matched, missed, scores };
}

const cleanDeck = (raw: unknown): Card[] => {
  if (!Array.isArray(raw)) return [];
  const deck: Card[] = [];
  raw.forEach((item, idx) => {
    if (!item || typeof item !== "object") return;
    const q = typeof (item as { question?: unknown }).question === "string" ? (item as any).question.trim() : `Question ${idx + 1}`;
    const answers = Array.isArray((item as { answers?: unknown }).answers)
      ? ((item as any).answers as unknown[]).map((ans) => (typeof ans === "string" ? ans.trim() : "")).filter(Boolean)
      : [];
    if (q && answers.length) {
      deck.push({ question: q, answers });
    }
  });
  return deck;
};

const mulberry32 = (seed: number) => {
  let t = seed + 0x6d2b79f5;
  return () => {
    t |= 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleWithSeed = (cards: Card[], seed: number) => {
  const rng = mulberry32(seed);
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

function App() {
  const [deck, setDeck] = useState<Card[]>(fallbackDeck);
  const [orderSeed, setOrderSeed] = useState<number>(() => Date.now());
  const [index, setIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [threshold, setThreshold] = useState(0.55);
  const [result, setResult] = useState<EvalResult | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = cleanDeck(JSON.parse(saved));
      if (parsed.length) {
        setDeck(parsed);
        return;
      }
    }

    fetch("/deck.json")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const parsed = cleanDeck(data);
        if (parsed.length) {
          setDeck(parsed);
        }
      })
      .catch(() => {
        // Fall back to built-in sample deck
      });
  }, []);

  const orderedDeck = useMemo(() => shuffleWithSeed(deck, orderSeed), [deck, orderSeed]);
  const card = orderedDeck[index];

  const handleCheck = () => {
    if (!card) return;
    const evaluation = evaluate(userAnswer, card.answers, threshold);
    setResult(evaluation);
    setShowAnswers(true);
  };

  const handleNext = () => {
    setIndex((prev) => (orderedDeck.length ? (prev + 1) % orderedDeck.length : 0));
    setUserAnswer("");
    setResult(null);
    setShowAnswers(false);
  };

  const handleRestart = () => {
    setIndex(0);
    setUserAnswer("");
    setResult(null);
    setShowAnswers(false);
    setOrderSeed(Date.now());
  };

  const handleUpload = async (file?: File | null) => {
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = cleanDeck(JSON.parse(text));
      if (!parsed.length) {
        setStatus("Could not find any cards in that file.");
        return;
      }
      setDeck(parsed);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      setIndex(0);
      setUserAnswer("");
      setResult(null);
      setShowAnswers(false);
      setStatus(`Loaded ${parsed.length} cards from ${file.name}`);
    } catch {
      setStatus("File was not valid JSON.");
    }
  };

  const handleResetDeck = () => {
    setDeck(fallbackDeck);
    localStorage.removeItem(STORAGE_KEY);
    setIndex(0);
    setUserAnswer("");
    setResult(null);
    setShowAnswers(false);
    setStatus("Reverted to sample deck.");
  };

  const matchedCount = result?.matched.length ?? 0;
  const totalAnswers = card?.answers.length ?? 0;

  return (
    <div className="shell">
      <header className="top-bar">
        <div>
          <div className="eyebrow">RAF quizzer</div>
          <h1>Spot-check your notes</h1>
        </div>
        <div className="pill">
          <span>{orderedDeck.length} cards</span>
        </div>
      </header>

      <section className="card-panel">
        <div className="progress">
          <span className="muted">Card</span>
          <span>
            {orderedDeck.length ? index + 1 : 0} / {orderedDeck.length || 0}
          </span>
        </div>

        {card ? (
          <>
            <div className="question">
              <p className="question-label">Question</p>
              <p className="question-text">{card.question}</p>
            </div>

            <label className="input-label" htmlFor="answer">
              Your answer
            </label>
            <textarea
              id="answer"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Type everything you remember…"
              rows={5}
            />

            <div className="controls">
              <button className="primary" onClick={handleCheck}>
                Check
              </button>
              <button onClick={() => setShowAnswers((v) => !v)}>
                {showAnswers ? "Hide answers" : "Show answers"}
              </button>
              <button onClick={handleNext}>Next</button>
              <button onClick={handleRestart} className="ghost">
                Shuffle & restart
              </button>
            </div>

            <div className="sliders">
              <div>
                <label htmlFor="threshold" className="input-label">
                  Match leniency ({Math.round(threshold * 100)}%)
                </label>
                <input
                  type="range"
                  id="threshold"
                  min={0.3}
                  max={0.85}
                  step={0.05}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                />
                <p className="muted small">Lower = more forgiving, higher = stricter.</p>
              </div>
            </div>

            {(showAnswers || result) && (
              <div className="answers">
                <div className="answer-header">
                  <div className="eyebrow">Answer key</div>
                  {result && (
                    <div className={matchedCount === totalAnswers ? "tag success" : "tag"}>
                      {matchedCount} / {totalAnswers} matched
                    </div>
                  )}
                </div>
                <div className="answers-grid">
                  {card.answers.map((ans, idx) => {
                    const isHit = result?.matched.includes(idx);
                    const score = result?.scores[idx] ?? 0;
                    return (
                      <div key={ans + idx} className={`answer-chip ${isHit ? "hit" : "miss"}`}>
                        <div className="answer-score">{Math.round(score * 100)}%</div>
                        <div>{ans}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <p>Upload a deck to begin.</p>
        )}
      </section>

      <section className="deck-actions">
        <div className="eyebrow">Load deck</div>
        <div className="upload-row">
          <label className="upload-button">
            Upload JSON
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => handleUpload(e.target.files?.[0])}
            />
          </label>
          <button onClick={handleResetDeck} className="ghost">
            Use sample
          </button>
        </div>
        <p className="muted small">
          Expected format: <code>[{"{ question: string, answers: string[] }"}]</code>. You can export this from the provided
          parser script.
        </p>
        {status && <div className="status">{status}</div>}
      </section>
    </div>
  );
}

export default App;
