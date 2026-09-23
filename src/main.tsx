import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import "./styles.css";

const RootApplication = Capacitor.getPlatform() === "android"
  ? lazy(() => import("./platforms/android/AndroidApp").then(({ AndroidApp }) => ({ default: AndroidApp })))
  : lazy(() => import("./App"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<main className="android-state"><img src="/favicon.svg" alt="" /><h1>מתחלקים</h1></main>}><RootApplication /></Suspense>
  </StrictMode>,
);
