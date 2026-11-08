module.exports = ({ config }) => {
  const projectId = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId;
  return {
    ...config,
    // Over-the-air updates: JS and assets ship through EAS Update on the
    // build's channel; anything native still needs a store build.
    // Pinned so over-the-air updates reach every store build with the same native code (1.0.0 and 1.0.1 differ only in the start screen).
    runtimeVersion: '1.0.0',
    ...(projectId ? { updates: { url: `https://u.expo.dev/${projectId}`, checkAutomatically: 'ON_LOAD', fallbackToCacheTimeout: 0 } } : {}),
    plugins: [...(config.plugins || []), 'expo-notifications'],
    // Firebase (FCM) config for Android push; the file holds only public client identifiers.
    android: { ...config.android, googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json' },
    extra: {
      ...config.extra,
      ...(process.env.RACKETBUDDY_EU_API_URL ? { apiUrl: process.env.RACKETBUDDY_EU_API_URL } : {}),
      ...(process.env.RACKETBUDDY_US_API_URL ? { apiUrlUs: process.env.RACKETBUDDY_US_API_URL } : {}),
      ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
    },
  };
};
