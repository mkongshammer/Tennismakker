module.exports = ({ config }) => {
  const projectId = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId;
  return {
    ...config,
    // Over-the-air updates: JS and assets ship through EAS Update on the
    // build's channel; anything native still needs a store build.
    runtimeVersion: { policy: 'appVersion' },
    ...(projectId ? { updates: { url: `https://u.expo.dev/${projectId}`, checkAutomatically: 'ON_LOAD', fallbackToCacheTimeout: 0 } } : {}),
    plugins: [...(config.plugins || []), 'expo-notifications'],
    android: { ...config.android, ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}) },
    extra: {
      ...config.extra,
      ...(process.env.RACKETBUDDY_EU_API_URL ? { apiUrl: process.env.RACKETBUDDY_EU_API_URL } : {}),
      ...(process.env.RACKETBUDDY_US_API_URL ? { apiUrlUs: process.env.RACKETBUDDY_US_API_URL } : {}),
      ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
    },
  };
};
