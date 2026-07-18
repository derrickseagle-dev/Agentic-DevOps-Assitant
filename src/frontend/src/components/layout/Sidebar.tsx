import { NavLink } from "react-router-dom";
import { LayoutDashboard, GitBranch, Settings, Activity, Play } from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/pipelines", icon: GitBranch, label: "Pipelines" },
  { to: "/pipelines", icon: Play, label: "Runs" },
  { to: "/repositories", icon: GitBranch, label: "Repositories" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="flex w-60 flex-col border-r border-[#252540] bg-[#131320]">
      <div className="flex h-14 items-center gap-3 border-b border-[#252540] px-4">
        <Activity className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold tracking-tight">PipelineForge</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-[#8888a0] hover:bg-[#1a1a2e] hover:text-[#e4e4f0]"
              }`
            }
            end={item.to === "/"}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[#252540] p-3">
        <div className="rounded-lg bg-[#1a1a2e] p-3 text-xs text-[#8888a0]">
          <p className="font-medium text-[#e4e4f0]">Beta Preview</p>
          <p className="mt-1">PipelineForge v0.1.0</p>
        </div>
      </div>
    </aside>
  );
}
