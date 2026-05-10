/**
 * Expo config plugin: combined fix for @react-native-firebase + useFrameworks=static.
 *
 * Three patches, applied at file top + inside the existing post_install:
 *   1. `$RNFirebaseAsStaticFramework = true` -- RNFB-specific global that
 *      tells RNFB pods to wrap themselves correctly under static frameworks.
 *   2. `use_modular_headers!` -- forces all pods to modular header layout
 *      so framework modules can include each other's headers.
 *   3. `CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES` --
 *      backstop build setting set on every target in post_install for any
 *      pod that still resists.
 *
 * The post_install patch uses a do/end depth counter (not regex) so it
 * always lands inside the existing post_install block instead of the
 * first nested `end`.
 */
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const TOP_MARKER = "# === relatably: rnfb static framework + modular headers ===";
const TOP_INJECT = `\n${TOP_MARKER}\n$RNFirebaseAsStaticFramework = true\nuse_modular_headers!\n`;

// Inject before `target 'main' do` block: use invertase's pre-built
// FirebaseFirestore frameworks. This skips the entire gRPC source compile
// (which keeps failing with "gRPC-Core.modulemap not found" under
// use_modular_headers!). The :git+tag must match the firebase-ios-sdk
// version pinned by RNFB v22.4.0 (11.15.0 -- see node_modules/@react-native-firebase/app/package.json).
const TARGET_MARKER = "# === relatably: prebuilt firestore ===";
const TARGET_INJECT = `
  ${TARGET_MARKER}
  pod 'FirebaseAuth', :modular_headers => true
  pod 'FirebaseAuthInterop', :modular_headers => true
  pod 'FirebaseCore', :modular_headers => true
  pod 'FirebaseCoreExtension', :modular_headers => true
  pod 'FirebaseCoreInternal', :modular_headers => true
  pod 'GoogleUtilities', :modular_headers => true
  pod 'FirebaseFirestore', :git => 'https://github.com/invertase/firestore-ios-sdk-frameworks.git', :tag => '11.15.0'
`;

const POST_MARKER = "# === relatably: clang allow non-modular includes ===";
const POST_INJECT_LINES = [
  `    ${POST_MARKER}`,
  `    installer.pods_project.targets.each do |t|`,
  `      t.build_configurations.each do |bc|`,
  `        bc.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'`,
  `      end`,
  `    end`,
  ``,
];

/** Find the byte index of the matching `end` for a `do |installer|` block. */
function findMatchingEnd(src, openIdx) {
  // openIdx is right after `post_install do |installer|`.
  let i = openIdx;
  let depth = 1; // we're inside one block (post_install)
  while (i < src.length && depth > 0) {
    // Skip strings and comments (basic).
    if (src[i] === "#" && (i === 0 || src[i - 1] !== "$")) {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    // Match word "do" at start of token (followed by space or |).
    if (
      (src.slice(i, i + 3) === "do " || src.slice(i, i + 3) === "do\n" || src.slice(i, i + 3) === "do|")
      && (i === 0 || /\W/.test(src[i - 1]))
    ) {
      depth++;
      i += 2;
      continue;
    }
    // Match word "end" as standalone token.
    if (src.slice(i, i + 3) === "end" && (i === 0 || /\W/.test(src[i - 1])) && (i + 3 === src.length || /\W/.test(src[i + 3]))) {
      depth--;
      if (depth === 0) return i;
      i += 3;
      continue;
    }
    i++;
  }
  return -1;
}

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
      let changed = false;

      // 1+2: top-level injection (RNFB static + modular headers).
      if (!contents.includes(TOP_MARKER)) {
        const targetMatch = contents.match(/^target\s+['"]\w+['"]\s+do/m);
        if (targetMatch && typeof targetMatch.index === "number") {
          contents =
            contents.slice(0, targetMatch.index) +
            TOP_INJECT +
            "\n" +
            contents.slice(targetMatch.index);
        } else {
          contents = contents.trimEnd() + TOP_INJECT;
        }
        changed = true;
      }

      // 4: inject prebuilt Firestore pod inside the target 'main' do block.
      if (!contents.includes(TARGET_MARKER)) {
        // Find target 'main' do (or whichever target).
        const targetOpen = contents.match(/^target\s+['"]\w+['"]\s+do\b/m);
        if (targetOpen && typeof targetOpen.index === "number") {
          // Insert right after that line.
          const lineEnd = contents.indexOf("\n", targetOpen.index);
          if (lineEnd !== -1) {
            contents =
              contents.slice(0, lineEnd + 1) +
              TARGET_INJECT +
              contents.slice(lineEnd + 1);
            changed = true;
          }
        }
      }

      // 3: inject CLANG_ALLOW inside the existing post_install block.
      if (!contents.includes(POST_MARKER)) {
        const openMarker = "post_install do |installer|";
        const startIdx = contents.indexOf(openMarker);
        if (startIdx !== -1) {
          const bodyStart = startIdx + openMarker.length;
          const matchingEnd = findMatchingEnd(contents, bodyStart);
          if (matchingEnd !== -1) {
            const injection = "\n" + POST_INJECT_LINES.join("\n") + "  ";
            contents =
              contents.slice(0, matchingEnd) +
              injection +
              contents.slice(matchingEnd);
            changed = true;
          }
        }
      }

      if (changed) fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};
