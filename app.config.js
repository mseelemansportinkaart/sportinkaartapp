/**
 * Dynamic Expo config.
 *
 * `app.json` stays the source of truth — it is passed in as `config` here and
 * we only layer on top of it. The one thing we add is the Detox native wiring,
 * and only when `DETOX_BUILD=1`: it adds an instrumentation runner and permits
 * cleartext traffic to the emulator host, neither of which belongs in a build
 * that ships to users.
 *
 *   DETOX_BUILD=1 npx expo prebuild --platform android
 */
module.exports = ({ config }) => {
  if (process.env.DETOX_BUILD !== '1') {
    return config;
  }

  return {
    ...config,
    plugins: [...(config.plugins ?? []), './plugins/withDetox'],
  };
};
