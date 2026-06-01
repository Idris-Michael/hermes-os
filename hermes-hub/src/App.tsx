import { lazy, Suspense, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import IntroScreen from "./components/overwatch/IntroScreen";
import GlobalCursor from "./components/GlobalCursor";
import RouteErrorBoundary from "./components/RouteErrorBoundary";

// Eager: landing page — must paint instantly.
import HomePage from "./pages/HomePage";

// Lazy: every other route ships in its own chunk and loads on demand.
const HermesAgentPage   = lazy(() => import("./pages/HermesAgentPage"));
const OpenClawPage      = lazy(() => import("./pages/OpenClawPage"));
const MemoryPage        = lazy(() => import("./pages/MemoryPage"));
const SkillsPage        = lazy(() => import("./pages/SkillsPage"));
const ActivityPage      = lazy(() => import("./pages/ActivityPage"));
const OverwatchPage     = lazy(() => import("./pages/OverwatchPage"));
const SystemPage        = lazy(() => import("./pages/SystemPage"));
const ProfilesPage      = lazy(() => import("./pages/ProfilesPage"));
const CheatsheetPage    = lazy(() => import("./pages/CheatsheetPage"));
const OnboardingPage    = lazy(() => import("./pages/OnboardingPage"));
const ECCPage           = lazy(() => import("./pages/ECCPage"));
const FlowPage          = lazy(() => import("./pages/FlowPage"));
const InstagramPage     = lazy(() => import("./pages/InstagramPage"));
const DiscoveryPage     = lazy(() => import("./pages/DiscoveryPage"));
const KnowledgeBasePage = lazy(() => import("./pages/KnowledgeBasePage"));
const ServicesPage      = lazy(() => import("./pages/ServicesPage"));
const CaseStudyPage     = lazy(() => import("./pages/CaseStudyPage"));
const ChatPage          = lazy(() => import("./pages/ChatPage"));
const UGCIntakePage     = lazy(() => import("./pages/UGCIntakePage"));
const UGCOrdersPage     = lazy(() => import("./pages/UGCOrdersPage"));
const UGCMetricsPage    = lazy(() => import("./pages/UGCMetricsPage"));

function RouteFallback() {
  return (
    <div className="flex items-center justify-center w-full h-full min-h-[60vh] text-[#D4A017] font-mono">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] opacity-80">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[#D4A017] opacity-70 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4A017]" />
        </span>
        loading module
      </div>
    </div>
  );
}

export default function App() {
  const skip = new URLSearchParams(window.location.search).get("skip") === "1";
  const [entered, setEntered] = useState(skip);

  if (!entered) {
    return <IntroScreen onEnter={() => setEntered(true)} />;
  }

  return (
    <BrowserRouter>
      <GlobalCursor />
      <div className="os-layout">
        <Sidebar />
        <div className="os-main">
          <TopBar />
          <main className="os-content">
            <RouteErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/skills" element={<SkillsPage />} />
                <Route path="/memory" element={<MemoryPage />} />
                <Route path="/activity" element={<ActivityPage />} />
                <Route path="/agents/hermes" element={<HermesAgentPage />} />
                <Route path="/agents/openclaw" element={<OpenClawPage />} />
                <Route path="/profiles" element={<ProfilesPage />} />
                <Route path="/overwatch" element={<OverwatchPage />} />
                <Route path="/system" element={<SystemPage />} />
                <Route path="/cheatsheet" element={<CheatsheetPage />} />
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/ecc" element={<ECCPage />} />
                <Route path="/flow" element={<FlowPage />} />
                <Route path="/instagram" element={<InstagramPage />} />
                <Route path="/discovery" element={<DiscoveryPage />} />
                <Route path="/knowledge" element={<KnowledgeBasePage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/case-study" element={<CaseStudyPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/ugc/new" element={<UGCIntakePage />} />
                <Route path="/ugc/orders" element={<UGCOrdersPage />} />
                <Route path="/ugc/metrics" element={<UGCMetricsPage />} />
              </Routes>
              </Suspense>
            </RouteErrorBoundary>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
