import { Bell } from "lucide-react";
import { useLocation } from "react-router-dom";

const LABELS: Record<string, string> = {
  "/": "Home",
  "/skills": "Skills",
  "/memory": "Memory",
  "/activity": "Activity",
  "/agents/hermes": "Agents / hermes",
  "/agents/openclaw": "Agents / openclaw",
  "/overwatch": "Systems / overwatch",
};

export default function TopBar() {
  const { pathname } = useLocation();
  const label = LABELS[pathname] || pathname.replace("/", "").replace(/\//g, " / ");

  return (
    <header className="os-topbar">
      <div className="flex items-center gap-1 text-sm flex-1">
        <span style={{ color: "#6b7280" }}>Operator</span>
        <span style={{ color: "#374151" }}>/</span>
        <span style={{ color: "#9ca3af" }}>local</span>
        {label && label !== "Home" && (
          <>
            <span style={{ color: "#374151" }}>/</span>
            <span style={{ color: "#d1d5db" }}>{label.split(" / ").pop()}</span>
          </>
        )}
      </div>
      <button className="text-gray-500 hover:text-gray-300 cc-press p-1 rounded">
        <Bell size={16} />
      </button>
    </header>
  );
}
