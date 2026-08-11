import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { createProductionDependencies } from "./app/composition/createProductionDependencies";
import "./index.css";
import "./components/voice/voice-ui.css";
import "./components/voice/voice-composer.css";
import { registerServiceWorker } from "./registerServiceWorker";
import { AudioPlaybackCoordinatorProvider } from "./components/voice/AudioPlaybackCoordinator";

const VoiceUiPreview = import.meta.env.DEV
  ? lazy(() => import("./dev/VoiceUiPreview").then((module) => ({ default: module.VoiceUiPreview })))
  : null;

const dependencies = createProductionDependencies(import.meta.env);

const isVoiceUiPreview = import.meta.env.DEV && window.location.pathname === "/dev/voice-ui";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AudioPlaybackCoordinatorProvider>
      {isVoiceUiPreview && VoiceUiPreview ? (
        <Suspense fallback={null}><VoiceUiPreview /></Suspense>
      ) : <App dependencies={dependencies} />}
    </AudioPlaybackCoordinatorProvider>
  </React.StrictMode>,
);

registerServiceWorker();
