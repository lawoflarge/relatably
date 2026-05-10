/**
 * Expo config plugin: enable CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES.
 *
 * Why: @react-native-firebase + useFrameworks=static (required by
 * react-native-google-mobile-ads) makes Xcode reject every #import inside
 * RNFB framework modules that pulls a React-Core header (RCTConvert.h,
 * RCTBridgeModule.h, RCTEventEmitter.h). The standard cocoapods workaround
 * is a post_install hook that sets the build setting for every pod target.
 *
 * Apple-side this is a normal Objective-C compile-flag relaxation, no
 * runtime impact.
 */
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const HOOK_MARKER = "# === relatably: allow non-modular includes ===";

const HOOK = `
${HOOK_MARKER}
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
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
      if (contents.includes(HOOK_MARKER)) return cfg;
      // Append at end of file. Multiple post_install blocks are safe in
      // CocoaPods >= 1.11; cocoapods runs them in order.
      contents = contents.trimEnd() + "\n" + HOOK;
      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};
