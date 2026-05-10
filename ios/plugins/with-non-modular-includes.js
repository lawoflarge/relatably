/**
 * Expo config plugin: enable modular headers globally so RNFB framework
 * modules can include React-Core headers under useFrameworks=static.
 *
 * Why: @react-native-firebase + useFrameworks=static (required by
 * react-native-google-mobile-ads) makes Xcode reject every #import inside
 * RNFB framework modules that pulls a React-Core header. Adding
 * `use_modular_headers!` at the Podfile top level promotes all pods to
 * modular header layout, eliminating the non-modular-include errors.
 *
 * Cleaner than the CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES
 * approach because we don't need to inject inside a `post_install` block
 * (which has tricky nested do/end matching).
 */
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MARKER = "# === relatably: use_modular_headers ===";
const INJECTED = `\n${MARKER}\nuse_modular_headers!\n`;

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

      // Insert just before the first `target 'main' do` (or any target).
      // `use_modular_headers!` must be at file scope, before any target block.
      const targetMatch = contents.match(/^target\s+['"]\w+['"]\s+do/m);
      if (targetMatch) {
        const idx = targetMatch.index;
        contents = contents.slice(0, idx) + INJECTED + "\n" + contents.slice(idx);
      } else {
        // Fallback: append at end of the top-level setup section. Anything
        // valid in a Podfile preamble works since `use_modular_headers!`
        // doesn't reference any block-local state.
        contents = contents.trimEnd() + INJECTED;
      }

      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};
