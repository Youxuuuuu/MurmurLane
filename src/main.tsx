import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { createProductionDependencies } from "./app/composition/createProductionDependencies";
import "./index.css";
import { registerServiceWorker } from "./registerServiceWorker";

const dependencies = createProductionDependencies(import.meta.env);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App dependencies={dependencies} />
  </React.StrictMode>,
);

registerServiceWorker();
