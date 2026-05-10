/**
 * Expo config plugin: enable CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES.
 *
 * Why: @react-native-firebase + useFrameworks=static (required by
 * react-native-google-mobile-ads) makes Xcode reject every #import inside
 * RNFB framework modules that pulls a React-Core header. Standard
 * cocoapods workaround is a build setting set on every pod target via
 * post_install. We INJECT into the existing post_install block (CocoaPods
 * only honors the last `post_install` declared, so a second block would
 * silently break Expo's react_native_post_install).
 */
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MARKER = "# === relatably: allow non-modular includes ===";
const INJECTED_LINES = `  ${MARKER}
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
  end
`;

module.exports = function withNonModularIncludes(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        "Podfile",
      );
      if (!fs.existsSync(podfilePath)) return cfg;
      let contents = fs.readFileSync(podfilePath, "utf-8");
      if (contents.includes(MARKER)) return cfg;

      // Locate the LAST `post_install do |installer|` block and inject our
      // lines just before its closing `end`. The Expo template has one
      // canonical block at file level; we don't want to add a second.
      const blockRe =
        /(post_install do \|installer\|[\s\S]*?\n)(end\b\s*$)/m;
      if (blockRe.test(contents)) {
        contents = contents.replace(blockRe, `$1${INJECTED_LINES}$2`);
      } else {
        // Fallback: append a new block. This branch should never run for
        // a healthy Expo template, but is here so a stripped Podfile
        // doesn't silently miss the fix.
        contents =
          contents.trimEnd() +
          `

post_install do |installer|
${INJECTED_LINES}end
`;
      }

      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};
