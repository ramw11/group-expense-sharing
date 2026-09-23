import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ramw11.groupexpenses",
  appName: "מתחלקים",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SystemBars: {
      insetsHandling: "native",
      style: "DARK",
    },
  },
};

export default config;
