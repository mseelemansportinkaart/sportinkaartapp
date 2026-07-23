/**
 * Detox configuration.
 *
 * `ios/` and `android/` are not committed (this is a managed Expo project), so
 * they have to be generated before any of these build commands will work:
 *
 *   DETOX_BUILD=1 npx expo prebuild --platform ios
 *   DETOX_BUILD=1 npx expo prebuild --platform android
 *
 * `DETOX_BUILD=1` pulls in `plugins/withDetox.js`, which adds the native Detox
 * wiring that prebuild doesn't generate on its own. See `app.config.js`.
 *
 * The device names are env-overridable because CI doesn't get to pick them:
 * the iOS runner only has whatever simulators its Xcode ships, and the Android
 * emulator is created by `reactivecircus/android-emulator-runner` under its own
 * AVD name.
 */

/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: '__tests__/e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/Sportinkaart.app',
      build:
        'xcodebuild -workspace ios/Sportinkaart.xcworkspace -scheme Sportinkaart -configuration Debug -sdk iphonesimulator -destination "generic/platform=iOS Simulator" -derivedDataPath ios/build CODE_SIGNING_ALLOWED=NO',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/Sportinkaart.app',
      build:
        'xcodebuild -workspace ios/Sportinkaart.xcworkspace -scheme Sportinkaart -configuration Release -sdk iphonesimulator -destination "generic/platform=iOS Simulator" -derivedDataPath ios/build CODE_SIGNING_ALLOWED=NO',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      testBinaryPath: 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
      build:
        'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug && cd ..',
      reversePorts: [8081],
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      testBinaryPath:
        'android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk',
      build:
        'cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release && cd ..',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: process.env.DETOX_IOS_DEVICE || 'iPhone 16',
      },
    },
    attached: {
      type: 'android.attached',
      device: {
        adbName: '.*',
      },
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: process.env.DETOX_AVD_NAME || 'Pixel_4_API_30',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
    'android.att.debug': {
      device: 'attached',
      app: 'android.debug',
    },
    'android.att.release': {
      device: 'attached',
      app: 'android.release',
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
    'android.emu.release': {
      device: 'emulator',
      app: 'android.release',
    },
  },
};
