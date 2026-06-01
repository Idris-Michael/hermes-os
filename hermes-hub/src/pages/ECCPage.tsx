import { useState } from "react";

const SKILLS = [
  { id: "agent-introspection-debugging", category: "dev" },
  { id: "agent-sort", category: "dev" },
  { id: "ai-regression-testing", category: "testing" },
  { id: "android-clean-architecture", category: "mobile" },
  { id: "angular-developer", category: "frontend" },
  { id: "api-design", category: "dev" },
  { id: "backend-patterns", category: "dev" },
  { id: "code-tour", category: "dev" },
  { id: "coding-standards", category: "dev" },
  { id: "continuous-learning-v2", category: "dev" },
  { id: "council", category: "dev" },
  { id: "database-migrations", category: "data" },
  { id: "django-patterns", category: "data" },
  { id: "e2e-testing", category: "testing" },
  { id: "error-handling", category: "dev" },
  { id: "eval-harness", category: "testing" },
  { id: "fastapi-patterns", category: "data" },
  { id: "frontend-design-direction", category: "frontend" },
  { id: "frontend-patterns", category: "frontend" },
  { id: "frontend-slides", category: "frontend" },
  { id: "golang-patterns", category: "dev" },
  { id: "golang-testing", category: "testing" },
  { id: "iterative-retrieval", category: "dev" },
  { id: "make-interfaces-feel-better", category: "frontend" },
  { id: "mcp-server-patterns", category: "dev" },
  { id: "motion-ui", category: "frontend" },
  { id: "nestjs-patterns", category: "dev" },
  { id: "plankton-code-quality", category: "dev" },
  { id: "postgres-patterns", category: "data" },
  { id: "prisma-patterns", category: "data" },
  { id: "production-audit", category: "dev" },
  { id: "python-patterns", category: "dev" },
  { id: "python-testing", category: "testing" },
  { id: "rust-patterns", category: "dev" },
  { id: "rust-testing", category: "testing" },
  { id: "skill-scout", category: "dev" },
  { id: "strategic-compact", category: "dev" },
  { id: "tdd-workflow", category: "testing" },
  { id: "verification-loop", category: "testing" },
  { id: "windows-desktop-e2e", category: "testing" },
];

const AGENTS = [
  { id: "architect", desc: "System design & scalability decisions", model: "opus" },
  { id: "tdd-guide", desc: "Write-tests-first enforcement, 80%+ coverage", model: "sonnet" },
  { id: "code-reviewer", desc: "Code quality, patterns, best practices", model: "sonnet" },
  { id: "security-reviewer", desc: "Security vulnerabilities, OWASP Top 10", model: "opus" },
  { id: "build-error-resolver", desc: "Diagnose and fix build failures", model: "sonnet" },
  { id: "refactor-cleaner", desc: "Dead code cleanup, architecture debt", model: "sonnet" },
  { id: "planner", desc: "Implementation planning & task breakdown", model: "opus" },
  { id: "e2e-runner", desc: "End-to-end test execution on critical flows", model: "sonnet" },
  { id: "doc-updater", desc: "Documentation generation and updates", model: "sonnet" },
  { id: "performance-optimizer", desc: "Profiling, bottleneck identification", model: "sonnet" },
  { id: "typescript-reviewer", desc: "TypeScript/JavaScript specific review", model: "sonnet" },
  { id: "python-reviewer", desc: "Python specific review", model: "sonnet" },
  { id: "rust-reviewer", desc: "Rust specific review", model: "sonnet" },
  { id: "go-reviewer", desc: "Go specific review", model: "sonnet" },
  { id: "gsd-planner", desc: "GSD phase planning with dependency analysis", model: "sonnet" },
  { id: "gsd-executor", desc: "GSD plan execution with atomic commits", model: "sonnet" },
  { id: "gsd-debugger", desc: "Scientific-method bug investigation", model: "opus" },
  { id: "gsd-verifier", desc: "Phase goal achievement verification", model: "sonnet" },
  { id: "visual-designer", desc: "Visual ad creative & image generation", model: "sonnet" },
  { id: "copy-writer", desc: "Platform-compliant ad copy generation", model: "sonnet" },
  { id: "audit-meta", desc: "Meta Ads pixel, creative & audience audit", model: "sonnet" },
  { id: "audit-google", desc: "Google Ads conversion, keywords, PMax audit", model: "sonnet" },
  { id: "chief-of-staff", desc: "Multi-agent orchestration & coordination", model: "opus" },
];

const COMMANDS = [
  { id: "feature-dev", desc: "Full feature development workflow" },
  { id: "code-review", desc: "Trigger code review cycle" },
  { id: "security-scan", desc: "Security vulnerability scan" },
  { id: "test-coverage", desc: "Coverage report & gap analysis" },
  { id: "quality-gate", desc: "Pre-merge quality gate check" },
  { id: "pr", desc: "Create pull request with analysis" },
  { id: "plan-prd", desc: "Generate PRD from requirements" },
  { id: "refactor-clean", desc: "Dead code & architecture cleanup" },
  { id: "save-session", desc: "Save session context to memory" },
  { id: "cost-report", desc: "Token usage & cost analysis" },
  { id: "harness-audit", desc: "Audit the Claude Code harness" },
  { id: "skill-health", desc: "Check skill installation health" },
  { id: "ecc-guide", desc: "ECC usage guide & documentation" },
  { id: "multi-plan", desc: "Multi-agent parallel planning" },
  { id: "multi-execute", desc: "Multi-agent parallel execution" },
  { id: "hookify", desc: "Configure automation hooks" },
  { id: "learn", desc: "Continuous learning from session" },
  { id: "evolve", desc: "Self-improve agent instincts" },
  { id: "prp-plan", desc: "PRP methodology planning" },
  { id: "prp-implement", desc: "PRP methodology implementation" },
];

const CATEGORY_COLORS: Record<string, { dot: string; badge: string; label: string }> = {
  dev:      { dot: "#818cf8", badge: "rgba(129,140,248,0.12)", label: "Dev" },
  frontend: { dot: "#f472b6", badge: "rgba(244,114,182,0.12)", label: "Frontend" },
  testing:  { dot: "#22c55e", badge: "rgba(34,197,94,0.12)",   label: "Testing" },
  data:     { dot: "#2dd4bf", badge: "rgba(45,212,191,0.12)",  label: "Data" },
  mobile:   { dot: "#f59e0b", badge: "rgba(245,158,11,0.12)",  label: "Mobile" },
};

const MODEL_COLOR: Record<string, string> = {
  opus:   "#D4A017",
  sonnet: "#818cf8",
  haiku:  "#2dd4bf",
};

const STACK_SUPPORT = [
  {
    id: "agentpedia",
    name: "Agentpedia",
    url: "https://agentpedia.codes/rules",
    what: "Curated Claude/LLM system prompt rules by category",
    color: "#818cf8",
    badge: "RULES",
    items: ["Agentic AI", "Python", "TypeScript", "React", "Next.js", "DevOps", "Security", "Testing", "Data Science", "Automation", "REST API", "Web Scraping"],
    highlight: "AI Prompt Engineer · Security Audit Agent · Strong Reasoner & Planner",
  },
  {
    id: "aitmpl",
    name: "AI Templates",
    url: "https://www.aitmpl.com/agents/",
    what: "421 pre-built Claude Code agent definitions marketplace",
    color: "#D4A017",
    badge: "AGENTS",
    items: ["business-marketing", "ai-specialists", "development-team", "devops-infrastructure", "security", "data-ai", "deep-research-team", "obsidian-ops-team", "podcast-creator-team", "ui-analysis", "expert-advisors"],
    highlight: "Business & Marketing · UI/UX Designer · Prompt Engineer (10k+ uses)",
  },
  {
    id: "skillsmp",
    name: "SkillsMP",
    url: "https://skillsmp.com/categories",
    what: "Manus agent skill marketplace — 1M+ skills across all domains",
    color: "#22c55e",
    badge: "SKILLS",
    items: ["Sales & Marketing (126k)", "LLM & AI (70k)", "Data Analysis (9.6k)", "E-commerce (3.6k)", "Automation (21k)", "Architecture Patterns", "Backend", "Frontend", "Testing", "CI/CD", "Content Creation"],
    highlight: "Sales & Marketing 126k · Data Analysis 9.6k · most relevant for agency work",
  },
  {
    id: "skillhub",
    name: "SkillHub",
    url: "https://skillhub.club/",
    what: "Community skill registry for Claude, Codex, Gemini, OpenCode — 87k skills",
    color: "#f472b6",
    badge: "REGISTRY",
    items: ["ui-ux-pro-max", "systematic-debugging", "mcp-builder", "subagent-driven-development", "nuwa-skill", "skill-creator", "cloudflare-workers-ai", "Development", "Frontend", "Backend", "AI/ML", "Productivity", "Writing"],
    highlight: "npx @skill-hub/cli · ui-ux-pro-max · mcp-builder (Anthropic official)",
  },
  {
    id: "claude-secret-codes",
    name: "Claude Secret Codes",
    url: "local://sandbox/Claude_Secret_Codes.pdf",
    what: "Local PDF — advanced Claude prompting techniques and hidden capabilities",
    color: "#2dd4bf",
    badge: "LOCAL",
    items: ["Advanced prompting", "Hidden capabilities", "Chain-of-thought", "Agent patterns", "System prompt tricks"],
    highlight: "PDF at Desktop/Sandbox/Claude_Secret_Codes.pdf",
  },
];

type Tab = "agents" | "skills" | "commands" | "rules" | "stack";

export default function ECCPage() {
  const [activeTab, setActiveTab] = useState<Tab>("agents");
  const [search, setSearch] = useState("");

  const filteredAgents  = AGENTS.filter(a  => a.id.includes(search) || a.desc.toLowerCase().includes(search));
  const filteredSkills  = SKILLS.filter(s  => s.id.includes(search));
  const filteredCommands = COMMANDS.filter(c => c.id.includes(search) || c.desc.toLowerCase().includes(search));

  const RULES_LANGS = ["common", "typescript", "python", "golang", "rust", "web", "angular", "kotlin", "java", "php", "ruby", "swift", "cpp", "dart", "csharp"];

  return (
    <div className="relative min-h-screen p-6 text-white bg-[#020503] overflow-y-auto">
      {/* Cyber Brackets VFX overlays */}
      <div className="absolute inset-x-8 inset-y-6 pointer-events-none z-0 border border-white/[0.015] rounded-2xl">
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#D4A017]/20 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#D4A017]/20 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#D4A017]/20 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#D4A017]/20 rounded-br-lg" />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold bg-[#D4A017]/15 border border-[#D4A017]/30 text-[#D4A017] shadow-md">
              ⚡
            </div>
            <h1 className="text-white font-bold text-2xl tracking-wide font-sans">
              Everything Claude Code
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold tracking-wider bg-[#D4A017]/12 text-[#D4A017] border border-[#D4A017]/25">
              INSTALLED
            </span>
          </div>
          <p className="text-xs text-gray-500 font-mono">
            {AGENTS.length} agents · {SKILLS.length}+ skills · {COMMANDS.length} commands · {RULES_LANGS.length} rule sets · active environment
          </p>
        </div>
        <div className="relative">
          <input
            value={search}
            onChange={e => setSearch(e.target.value.toLowerCase())}
            placeholder="Search core definitions..."
            className="text-xs px-3.5 py-2 rounded-lg bg-black/40 border border-white/10 text-gray-200 outline-none w-64 focus:border-[#D4A017]/50 focus:bg-black/60 transition-all font-mono"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="relative z-10 flex gap-2 mb-6 border-b border-white/5 pb-0">
        {(["agents", "skills", "commands", "rules", "stack"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`text-xs px-4 py-2.5 capitalize transition-all duration-200 font-sans tracking-wider font-semibold border-b-2 cc-press relative ${
              activeTab === t 
                ? "text-[#D4A017] border-[#D4A017]" 
                : "text-gray-500 border-transparent hover:text-gray-300"
            }`}
            style={{ background: "none" }}
          >
            {t === "stack" ? "Stack Support" : t}
            <span className={`ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded ${
              activeTab === t ? "bg-[#D4A017]/15 text-[#D4A017]" : "bg-white/5 text-gray-600"
            }`}>
              {t === "agents" ? AGENTS.length : t === "skills" ? SKILLS.length : t === "commands" ? COMMANDS.length : t === "rules" ? RULES_LANGS.length : STACK_SUPPORT.length}
            </span>
          </button>
        ))}
      </div>

      {/* Agents */}
      {activeTab === "agents" && (
        <div className="relative z-10 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
          {filteredAgents.map(agent => {
            const glowClass = agent.model === "opus" ? "cc-press hover:border-[#D4A017]/40 hover:shadow-[0_0_15px_rgba(212,160,23,0.15)]" : "cc-press hover:border-[#818cf8]/40 hover:shadow-[0_0_15px_rgba(129,140,248,0.15)]";
            return (
              <div key={agent.id} className={`cc-glass rounded-xl p-4 flex items-start gap-3.5 transition-all duration-200 ${glowClass}`}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold font-mono"
                     style={{ 
                       background: `${MODEL_COLOR[agent.model]}18`, 
                       border: `1px solid ${MODEL_COLOR[agent.model]}35`, 
                       color: MODEL_COLOR[agent.model],
                       textShadow: `0 0 8px ${MODEL_COLOR[agent.model]}40`
                     }}>
                  {agent.id[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-white text-xs font-bold font-mono truncate tracking-wide">
                      {agent.id}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider flex-shrink-0"
                          style={{ 
                            background: `${MODEL_COLOR[agent.model]}15`, 
                            color: MODEL_COLOR[agent.model], 
                            border: `1px solid ${MODEL_COLOR[agent.model]}25` 
                          }}>
                      {agent.model}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-gray-400 font-sans">{agent.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Skills */}
      {activeTab === "skills" && (
        <div className="relative z-10 flex flex-wrap gap-2.5">
          {filteredSkills.map(skill => {
            const cat = CATEGORY_COLORS[skill.category];
            return (
              <div key={skill.id} className="cc-glass flex items-center gap-2.5 px-3.5 py-2 rounded-xl transition-all duration-200 cc-press hover:bg-black/50"
                   style={{ border: `1px solid ${cat.dot}25` }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse shadow-[0_0_8px_currentColor]" style={{ background: cat.dot, color: cat.dot }} />
                <span className="text-xs font-mono font-medium text-gray-200">
                  {skill.id}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold tracking-wider uppercase ml-1" 
                      style={{ background: cat.badge, color: cat.dot }}>
                  {cat.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Commands */}
      {activeTab === "commands" && (
        <div className="relative z-10 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {filteredCommands.map(cmd => (
            <div key={cmd.id} className="cc-glass rounded-xl p-4 flex items-center gap-4.5 transition-all duration-200 cc-press hover:border-[#D4A017]/30 hover:shadow-[0_0_15px_rgba(212,160,23,0.1)]">
              <span className="text-xs font-mono font-bold text-[#D4A017] tracking-wider" style={{ textShadow: "0 0 8px rgba(212,160,23,0.25)" }}>
                /{cmd.id}
              </span>
              <span className="text-xs text-gray-400 font-sans flex-1">{cmd.desc}</span>
            </div>
          ))}
        </div>
      )}

      {/* Stack Support */}
      {activeTab === "stack" && (
        <div className="relative z-10 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))" }}>
          {STACK_SUPPORT.map(s => (
            <div key={s.id} className="cc-glass rounded-xl p-5 transition-all duration-200 cc-press hover:border-white/20"
                 style={{ border: `1px solid ${s.color}25` }}>
              {/* Header */}
              <div className="flex items-start justify-between mb-3.5">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 font-mono"
                       style={{ 
                         background: `${s.color}18`, 
                         border: `1px solid ${s.color}35`, 
                         color: s.color,
                         textShadow: `0 0 8px ${s.color}30`
                       }}>
                    {s.name[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-bold font-sans tracking-wide">{s.name}</span>
                      <span className="text-[9px] px-2 py-0.5 rounded font-mono font-bold tracking-widest"
                            style={{ background: `${s.color}18`, color: s.color, border: `1px solid ${s.color}25` }}>
                        {s.badge}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{s.what}</p>
                  </div>
                </div>
                {!s.url.startsWith("local://") && (
                  <a href={s.url} target="_blank" rel="noreferrer"
                     className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0 ml-2 transition-all duration-200 border cc-press"
                     style={{ 
                       background: `${s.color}12`, 
                       color: s.color, 
                       borderColor: `${s.color}25`, 
                       textDecoration: "none",
                       fontSize: 10,
                       fontWeight: 600
                     }}>
                    Open ↗
                  </a>
                )}
              </div>
              {/* Highlight */}
              <div className="text-xs px-3 py-2.5 rounded-lg mb-3.5 font-mono leading-relaxed"
                   style={{ background: `${s.color}08`, borderLeft: `3px solid ${s.color}50`, color: "#9ca3af" }}>
                {s.highlight}
              </div>
              {/* Categories/items */}
              <div className="flex flex-wrap gap-1.5">
                {s.items.map(item => (
                  <span key={item} className="text-[10px] px-2.5 py-0.5 rounded font-mono border bg-white/[0.02] border-white/[0.04] text-gray-400">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rules */}
      {activeTab === "rules" && (
        <div className="relative z-10 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {RULES_LANGS.map(lang => (
            <div key={lang} className="cc-glass rounded-xl p-4 transition-all duration-200 cc-press hover:border-white/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: lang === "common" ? "#D4A017" : "#818cf8" }} />
                <span className="text-xs font-bold text-white capitalize font-sans tracking-wider">
                  {lang}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["coding-style", "testing", "patterns", "security", "hooks"].map(rule => (
                  <span key={rule} className="text-[9px] px-2 py-0.5 rounded font-mono bg-white/[0.03] text-gray-500 uppercase tracking-wide">
                    {rule}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
