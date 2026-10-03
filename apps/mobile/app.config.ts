import type { ConfigContext, ExpoConfig } from "expo/config";

const { validateProductionEnvironment } = require("./scripts/release-config.cjs") as {
  validateProductionEnvironment: (environment: NodeJS.ProcessEnv) => void;
};

export default ({ config }: ConfigContext): ExpoConfig => {
  if (process.env.EXPO_PUBLIC_APP_ENV === "production" || process.env.EAS_BUILD_PROFILE === "production") {
    validateProductionEnvironment(process.env);
  }
  return ({
  ...config,
  name: "Room5",
  slug: "room5",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "room5",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.room5.app",
  },
  android: {
    package: "com.room5.app",
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 24,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
        },
      },
    ],
  ],
  });
};
