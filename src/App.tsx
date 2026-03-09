import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { DashboardPage } from "@/pages/DashboardPage";
import { TasksPage } from "@/pages/TasksPage";
import { AgentsPage } from "@/pages/AgentsPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { ActivityPage } from "@/pages/ActivityPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { useTheme } from "@/hooks/useTheme";
import { useNotifications } from "@/hooks/useNotifications";
import type { Page } from "@/lib/types";

const pages: Record<Page, React.FC> = {
  dashboard: DashboardPage,
  tasks: TasksPage,
  agents: AgentsPage,
  projects: ProjectsPage,
  activity: ActivityPage,
  settings: SettingsPage,
};

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const { theme } = useTheme();
  useNotifications();
  const PageComponent = pages[currentPage];

  const isDark = theme === "dark";

  return (
    <div className={`flex h-screen ${isDark ? "bg-zinc-950 text-zinc-200" : "bg-white text-zinc-900"}`}>
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className={`flex-1 overflow-auto p-6 ${isDark ? "" : "bg-zinc-50"}`} aria-label="Page content">
        <PageComponent />
      </main>
    </div>
  );
}

export default App;
