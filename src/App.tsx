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

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const { theme } = useTheme();
  useNotifications();

  const isDark = theme === "dark";

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard": return <DashboardPage onNavigate={setCurrentPage} />;
      case "tasks": return <TasksPage />;
      case "agents": return <AgentsPage />;
      case "projects": return <ProjectsPage />;
      case "activity": return <ActivityPage />;
      case "settings": return <SettingsPage />;
    }
  };

  return (
    <div className={`flex h-screen ${isDark ? "bg-[#0a0a0f] text-gray-200" : "bg-white text-gray-900"}`}>
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className={`flex-1 overflow-auto p-8 ${isDark ? "" : "bg-gray-50"}`} aria-label="Page content">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
