import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import { AndroidFoundationSpike } from "./platforms/android/AndroidFoundationSpike";
import "./styles.css";

const RootApplication = Capacitor.getPlatform() === "android" ? AndroidFoundationSpike : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootApplication />
  </StrictMode>,
);
