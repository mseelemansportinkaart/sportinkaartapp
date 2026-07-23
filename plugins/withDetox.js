const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withPlugins,
  withProjectBuildGradle,
} = require('expo/config-plugins');

/**
 * Detox config plugin (Android).
 *
 * `expo prebuild` regenerates `android/` from scratch, so the native wiring
 * Detox needs can't just be committed — it has to be re-applied on every
 * prebuild. This mirrors the steps in Detox's "Android setup" guide:
 *
 *   1. the Detox maven repo (ships inside the `detox` npm package)
 *   2. `androidTestImplementation` + `testBuildType` + the instrumentation runner
 *   3. the `DetoxTest.java` instrumentation class
 *   4. cleartext traffic to the emulator host, so the app can reach Metro
 *   5. Detox's proguard rules, needed for minified release builds
 *
 * This is a vendored equivalent of `@config-plugins/detox`, which we can't
 * depend on directly: it declares `peer expo@^53` and this project is on
 * Expo 54, which makes `npm ci` fail with ERESOLVE.
 */

// ---------------------------------------------------------------------------
// 1. android/build.gradle — Detox maven repo
// ---------------------------------------------------------------------------

const DETOX_MAVEN = [
  '',
  '// Detox ships its Android artifacts inside the npm package.',
  `def detoxMavenPath = new File(["node", "--print", "require.resolve('detox/package.json')"].execute(null, rootDir).text.trim(), "../Detox-android")`,
  'allprojects { repositories { maven { url(detoxMavenPath) } } }',
  '',
].join('\n');

const withDetoxProjectGradle = (config) =>
  withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('withDetox: expected a groovy android/build.gradle');
    }
    if (!config.modResults.contents.includes('detoxMavenPath')) {
      config.modResults.contents += DETOX_MAVEN;
    }
    return config;
  });

// ---------------------------------------------------------------------------
// 2. android/app/build.gradle — test dependency, test build type, runner
// ---------------------------------------------------------------------------

function pushGradleDependency(buildGradle, dependency) {
  if (buildGradle.includes(dependency)) return buildGradle;
  return buildGradle.replace(/dependencies\s?{/, `dependencies {\n    ${dependency}`);
}

function addDetoxDefaultConfigBlock(buildGradle) {
  if (buildGradle.includes('detox-plugin-default-config')) return buildGradle;
  return buildGradle.replace(
    /defaultConfig\s?{/,
    [
      'defaultConfig {',
      '        // detox-plugin-default-config',
      "        testBuildType System.getProperty('testBuildType', 'debug')",
      "        testInstrumentationRunner 'androidx.test.runner.AndroidJUnitRunner'",
    ].join('\n')
  );
}

function addDetoxProguardRules(buildGradle) {
  if (buildGradle.includes('detox/proguard-rules-app.pro')) return buildGradle;
  return buildGradle.replace(
    /proguardFiles getDefaultProguardFile\("proguard-android.txt"\),\s?"proguard-rules.pro"/,
    [
      'proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"',
      '            // Detox-specific additions to pro-guard',
      `            def detoxProguardRulesPath = new File(["node", "--print", "require.resolve('detox/package.json')"].execute(null, rootDir).text.trim(), "../android/detox/proguard-rules-app.pro")`,
      '            proguardFile(detoxProguardRulesPath)',
    ].join('\n')
  );
}

const withDetoxAppGradle = (config) =>
  withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('withDetox: expected a groovy android/app/build.gradle');
    }
    let contents = config.modResults.contents;
    contents = pushGradleDependency(contents, "implementation 'androidx.appcompat:appcompat:1.6.1'");
    contents = pushGradleDependency(contents, "androidTestImplementation('com.wix:detox:+')");
    contents = addDetoxDefaultConfigBlock(contents);
    contents = addDetoxProguardRules(contents);
    config.modResults.contents = contents;
    return config;
  });

// ---------------------------------------------------------------------------
// 3. DetoxTest.java
// ---------------------------------------------------------------------------

const detoxTestClass = (androidPackage) => `package ${androidPackage};

import com.wix.detox.Detox;
import com.wix.detox.config.DetoxConfig;

import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.LargeTest;
import androidx.test.rule.ActivityTestRule;

@RunWith(AndroidJUnit4.class)
@LargeTest
public class DetoxTest {
    @Rule
    public ActivityTestRule<MainActivity> mActivityRule = new ActivityTestRule<>(MainActivity.class, false, false);

    @Test
    public void runDetoxTests() {
        DetoxConfig detoxConfig = new DetoxConfig();
        detoxConfig.idlePolicyConfig.masterTimeoutSec = 90;
        detoxConfig.idlePolicyConfig.idleResourceTimeoutSec = 60;
        detoxConfig.rnContextLoadTimeoutSec = (${androidPackage}.BuildConfig.DEBUG ? 180 : 60);

        Detox.runTests(mActivityRule, detoxConfig);
    }
}
`;

const withDetoxTestClass = (config) =>
  withDangerousMod(config, [
    'android',
    async (config) => {
      const packageName = config.android?.package;
      if (!packageName) throw new Error('withDetox: android.package must be defined');
      const folder = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/androidTest/java',
        ...packageName.split('.')
      );
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, 'DetoxTest.java'), detoxTestClass(packageName), 'utf8');
      return config;
    },
  ]);

// ---------------------------------------------------------------------------
// 4. Cleartext traffic to the emulator host (10.0.2.2) and localhost
// ---------------------------------------------------------------------------

const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
      <domain includeSubdomains="true">10.0.2.2</domain><domain includeSubdomains="true">localhost</domain>
    </domain-config>
</network-security-config>`;

const withNetworkSecurityConfig = (config) => {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const folder = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(
        path.join(folder, 'network_security_config.xml'),
        NETWORK_SECURITY_CONFIG,
        'utf8'
      );
      return config;
    },
  ]);

  return withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    application.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return config;
  });
};

module.exports = (config) =>
  withPlugins(config, [
    withDetoxProjectGradle,
    withDetoxAppGradle,
    withDetoxTestClass,
    withNetworkSecurityConfig,
  ]);
