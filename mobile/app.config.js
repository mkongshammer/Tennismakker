module.exports = ({ config }) => ({
  ...config,
  plugins: [...(config.plugins || []), 'expo-notifications'],
  android: { ...config.android, ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}) },
  extra: { ...config.extra, ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}) },
});
