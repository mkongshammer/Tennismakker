module.exports = ({ config }) => ({
  ...config,
  plugins: [...(config.plugins || []), 'expo-notifications'],
  android: { ...config.android, ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}) },
  extra: {
    ...config.extra,
    ...(process.env.RACKETBUDDY_EU_API_URL ? { apiUrl: process.env.RACKETBUDDY_EU_API_URL } : {}),
    ...(process.env.RACKETBUDDY_US_API_URL ? { apiUrlUs: process.env.RACKETBUDDY_US_API_URL } : {}),
    ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
  },
});
