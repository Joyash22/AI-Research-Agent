"use client";
import { useState, useRef } from "react";
import styles from "./page.module.css";

// ── API helper (calls your local Next.js route, not Anthropic directly) ──────
async function callClaude(system, userContent, maxTokens = 1000) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.content[0].text.trim();
}

// ── Agent definitions ─────────────────────────────────────────────────────────
const AGENTS = [
  {
    key: "search",
    name: "Search Agent",
    icon: "🔍",
    color: "#185FA5",
    bg: "#E6F1FB",
    run: (query, context) =>
      callClaude(
        "You are a web search agent. Given a research query, simulate retrieving the top 4 most relevant search results from the web and academic databases. For each result return: title, source/URL (make it realistic), year, and a 2-sentence snippet. Format as JSON array with fields: title, source, year, snippet. Return ONLY valid JSON.",
        `Query: "${query}"\nContext: ${context}`,
        800
      ),
  },
  {
    key: "rag",
    name: "RAG Agent",
    icon: "🗄️",
    color: "#0F6E56",
    bg: "#E1F5EE",
    run: (query, docs) =>
      callClaude(
        "You are a Retrieval-Augmented Generation agent. Given a query and documents, extract the 3-5 most relevant passages. Return a JSON array with fields: chunk, source, relevance_score (0.0-1.0). Return ONLY valid JSON.",
        `Query: "${query}"\nDocuments:\n${docs}`,
        800
      ),
  },
  {
    key: "summarize",
    name: "Summarization Agent",
    icon: "📝",
    color: "#534AB7",
    bg: "#EEEDFE",
    run: (content) =>
      callClaude(
        "You are a summarization agent. Summarize the research content clearly and academically. Include: key findings, methodology insights, and implications.",
        content,
        800
      ),
  },
  {
    key: "factcheck",
    name: "Fact-check Agent",
    icon: "✅",
    color: "#854F0B",
    bg: "#FAEEDA",
    run: (claims) =>
      callClaude(
        "You are a fact verification agent. Assess each claim for accuracy. Return a JSON array with fields: claim, verdict (verified/uncertain/disputed), confidence (high/medium/low), note. Return ONLY valid JSON.",
        `Claims:\n${claims}`,
        800
      ),
  },
  {
    key: "citation",
    name: "Citation Agent",
    icon: "📚",
    color: "#993556",
    bg: "#FBEAF0",
    run: (sources) =>
      callClaude(
        "You are a citation agent. Generate APA 7th edition citations. Return a JSON object with: apa (array of APA strings), intext (array of short keys like [Author, Year]). Return ONLY valid JSON.",
        `Sources:\n${sources}`,
        600
      ),
  },
  {
    key: "report",
    name: "Report Agent",
    icon: "📄",
    color: "#3B6D11",
    bg: "#EAF3DE",
    run: (query, findings, citations) =>
      callClaude(
        "You are a research report writer. Write a structured literature review with: Abstract, Introduction, Key Findings (with inline citations like [Author, Year]), Discussion, Conclusion, and Limitations.",
        `Research Question: "${query}"\n\nFindings:\n${findings}\n\nCitations:\n${citations}`,
        1000
      ),
  },
];

function safeParse(raw) {
  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return null;
  }
}

// ── Components ────────────────────────────────────────────────────────────────
function AgentCard({ agent, status, output, expanded, onToggle }) {
  return (
    <div className={`agent-card ${status === "running" ? "agent-running" : ""}`}
      style={{ borderColor: status === "running" ? agent.color : undefined }}>
      <div className="agent-header" onClick={output ? onToggle : undefined}
        style={{ background: status === "running" ? agent.bg : undefined, cursor: output ? "pointer" : "default" }}>
        <span className="agent-icon">{agent.icon}</span>
        <span className="agent-name">{agent.name}</span>
        <span className="agent-status" style={{
          color: status === "done" ? "#3B6D11" : status === "running" ? agent.color : status === "error" ? "#A32D2D" : "#888"
        }}>
          {status === "done" ? "✓ Done" : status === "running" ? "● Running…" : status === "error" ? "✗ Error" : "Waiting"}
        </span>
        {output && <span className="expand-icon">{expanded ? "▲" : "▼"}</span>}
      </div>
      {expanded && output && (
        <pre className="agent-output">{output}</pre>
      )}
    </div>
  );
}

function DocCard({ doc, onRemove }) {
  return (
    <div className="doc-card">
      <span>📄</span>
      <div className="doc-info">
        <div className="doc-name">{doc.name}</div>
        <div className="doc-meta">{(doc.size / 1024).toFixed(1)} KB</div>
      </div>
      <button className="doc-remove" onClick={() => onRemove(doc.name)}>×</button>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function ResearchAgent() {
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState([]);
  const [docTexts, setDocTexts] = useState({});
  const [running, setRunning] = useState(false);
  const [statuses, setStatuses] = useState({});
  const [outputs, setOutputs] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [report, setReport] = useState("");
  const [citations, setCitations] = useState([]);
  const [sources, setSources] = useState([]);
  const [tab, setTab] = useState("pipeline");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const fileRef = useRef();

  const setStatus = (key, val) => setStatuses(p => ({ ...p, [key]: val }));
  const setOutput = (key, val) => setOutputs(p => ({ ...p, [key]: val }));

  const handleFiles = async (files) => {
    for (const f of files) {
      if (f.size > 500000) continue;
      const text = await f.text().catch(() => `[Binary: ${f.name}]`);
      setDocs(p => [...p, { name: f.name, size: f.size }]);
      setDocTexts(p => ({ ...p, [f.name]: text.slice(0, 3000) }));
    }
  };

  const removeDoc = (name) => {
    setDocs(p => p.filter(d => d.name !== name));
    setDocTexts(p => { const n = { ...p }; delete n[name]; return n; });
  };

  const run = async () => {
    if (!query.trim() || running) return;
    setRunning(true);
    setError("");
    setReport("");
    setCitations([]);
    setSources([]);
    setStatuses({});
    setOutputs({});
    setExpanded(null);
    setTab("pipeline");

    try {
      const docContext = Object.entries(docTexts)
        .map(([name, text]) => `--- ${name} ---\n${text}`)
        .join("\n\n") || "No documents uploaded.";

      // 1. Search
      setStatus("search", "running");
      const searchRaw = await AGENTS[0].run(query, docContext);
      setOutput("search", searchRaw);
      setStatus("search", "done");
      setSources(safeParse(searchRaw) || []);

      // 2. RAG
      setStatus("rag", "running");
      const ragRaw = await AGENTS[1].run(query, docContext + "\n\nSearch:\n" + searchRaw);
      setOutput("rag", ragRaw);
      setStatus("rag", "done");

      // 3. Summarize
      setStatus("summarize", "running");
      const summary = await AGENTS[2].run(`Query: ${query}\nRAG: ${ragRaw}\nSearch: ${searchRaw}`);
      setOutput("summarize", summary);
      setStatus("summarize", "done");

      // 4. Fact-check
      setStatus("factcheck", "running");
      const factRaw = await AGENTS[3].run(summary);
      setOutput("factcheck", factRaw);
      setStatus("factcheck", "done");

      // 5. Citations
      setStatus("citation", "running");
      const sourceList = (safeParse(searchRaw) || [])
        .map(s => `${s.title} | ${s.source} | ${s.year}`).join("\n");
      const citRaw = await AGENTS[4].run(sourceList || "General sources, 2024");
      setOutput("citation", citRaw);
      setStatus("citation", "done");
      const citData = safeParse(citRaw);
      if (citData?.apa) setCitations(citData.apa);

      // 6. Report
      setStatus("report", "running");
      const findings = `Summary:\n${summary}\n\nFact Check:\n${factRaw}\n\nRAG Chunks:\n${ragRaw}`;
      const finalReport = await AGENTS[5].run(query, findings, citRaw);
      setOutput("report", finalReport);
      setStatus("report", "done");
      setReport(finalReport);
      setTab("report");

    } catch (e) {
      setError(e.message);
    }
    setRunning(false);
  };

  const copyReport = () => {
    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <main className="main">
      <div className="container">

        {/* Header */}
        <div className="header">
          <div className="header-icon">🧠</div>
          <div>
            <h1 className="header-title">AI Research Agent</h1>
            <p className="header-sub">Multi-agent · RAG · Citations · Report generation</p>
          </div>
        </div>

        {/* Query */}
        <section className="section">
          <label className="section-label">❓ Research question</label>
          <div className="input-row">
            <input
              className="query-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && run()}
              placeholder="e.g. What are the latest advances in RAG for LLMs?"
              disabled={running}
            />
            <button className="run-btn" onClick={run} disabled={running || !query.trim()}>
              {running ? "Running…" : "▶ Run"}
            </button>
          </div>
        </section>

        {/* Document Upload */}
        <section className="section">
          <label className="section-label">📂 Document ingestion (optional)</label>
          <div
            className="dropzone"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFiles([...e.dataTransfer.files]); }}
          >
            <div className="drop-icon">📎</div>
            <div>Drop PDFs / TXT files here, or click to browse</div>
            <div className="drop-hint">Max 500 KB per file · used as RAG context</div>
          </div>
          <input ref={fileRef} type="file" multiple accept=".txt,.pdf,.md,.csv"
            style={{ display: "none" }} onChange={e => handleFiles([...e.target.files])} />
          {docs.map(d => <DocCard key={d.name} doc={d} onRemove={removeDoc} />)}
        </section>

        {/* Tabs */}
        <div className="tabs">
          {[["pipeline", "Agent pipeline"], ["report", "📄 Report"], ["sources", "📚 Sources"]].map(([key, label]) => (
            <button key={key} className={`tab ${tab === key ? "tab-active" : ""}`} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>

        {/* Pipeline Tab */}
        {tab === "pipeline" && (
          <div>
            {AGENTS.map(agent => (
              <AgentCard key={agent.key} agent={agent}
                status={statuses[agent.key] || "idle"}
                output={outputs[agent.key]}
                expanded={expanded === agent.key}
                onToggle={() => setExpanded(p => p === agent.key ? null : agent.key)}
              />
            ))}
            {error && <div className="error-box">⚠ {error}</div>}
            {!running && !error && !report && (
              <div className="empty-state">Enter a question above and click Run to start all 6 agents.</div>
            )}
          </div>
        )}

        {/* Report Tab */}
        {tab === "report" && (
          <div>
            {report ? (
              <>
                <div className="report-box">{report}</div>
                <button className="copy-btn" onClick={copyReport}>
                  {copied ? "✓ Copied!" : "📋 Copy report"}
                </button>
              </>
            ) : (
              <div className="empty-state">Run the pipeline first to generate a report.</div>
            )}
          </div>
        )}

        {/* Sources Tab */}
        {tab === "sources" && (
          <div>
            {sources.length > 0 && (
              <>
                <div className="section-label" style={{ marginBottom: 10 }}>Retrieved sources</div>
                {sources.map((s, i) => (
                  <div key={i} className="source-card">
                    <div className="source-title">{s.title}</div>
                    <div className="source-meta">{s.source} · {s.year}</div>
                    <div className="source-snippet">{s.snippet}</div>
                  </div>
                ))}
              </>
            )}
            {citations.length > 0 && (
              <>
                <div className="section-label" style={{ margin: "16px 0 10px" }}>APA 7th edition citations</div>
                {citations.map((c, i) => (
                  <div key={i} className="citation-card">{c}</div>
                ))}
              </>
            )}
            {sources.length === 0 && citations.length === 0 && (
              <div className="empty-state">Run the pipeline to retrieve sources and citations.</div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
