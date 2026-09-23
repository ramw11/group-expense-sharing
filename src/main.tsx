import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import { AndroidApp } from "./platforms/android/AndroidApp";
import "./styles.css";

const RootApplication = Capacitor.getPlatform() === "android" ? AndroidApp : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootApplication />
  </StrictMode>,
);
