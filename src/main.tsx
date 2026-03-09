import ReactDOM from "react-dom/client";
import { ThemeProvider } from "./hooks/useTheme";
import App from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
