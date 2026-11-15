import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ThemeProvider } from "./theme.jsx";
import { SettingsProvider } from "./settings/SettingsContext.jsx";
import { CircadianProvider } from "./env/CircadianContext.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { PlayerProvider } from "./player/PlayerContext.jsx";
import { ZenProvider } from "./ui/ZenMode.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SettingsProvider>
      <CircadianProvider>
        <ThemeProvider>
          <AuthProvider>
            <PlayerProvider>
              <ZenProvider>
                <App />
              </ZenProvider>
            </PlayerProvider>
          </AuthProvider>
        </ThemeProvider>
      </CircadianProvider>
    </SettingsProvider>
  </React.StrictMode>
);
