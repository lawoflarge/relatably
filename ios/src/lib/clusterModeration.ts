// ios/src/lib/clusterModeration.ts
import { ActionSheetIOS, Alert, Platform } from "react-native";

import { reportContent } from "@/src/lib/api";
import { getDeviceToken } from "@/src/lib/deviceId";
import { hideCluster } from "@/src/lib/hiddenContentStore";

/**
 * Shared moderation action sheet for wordcloud answers (App Review Guideline
 * 1.2). Used by ClusterBubble (live + fallback wordcloud) and the Archive
 * detail screen so a user can hide or report ANY answer from a visible,
 * tappable control on every surface where answers appear — not only via a
 * hard-to-discover long-press.
 *
 * onHidden is called after a successful hide or report so the parent can drop
 * the cluster from view immediately (real-time removal from the feed).
 */
export function openClusterModerationSheet(
  id: string,
  text: string,
  onHidden?: (id: string, text: string) => void,
): void {
  const doHide = async () => {
    try {
      await hideCluster({ id, text });
      onHidden?.(id, text);
    } catch (err) {
      Alert.alert("Couldn't hide", err instanceof Error ? err.message : String(err));
    }
  };

  const doReport = async () => {
    try {
      const deviceToken = await getDeviceToken();
      await reportContent({ target_type: "cluster", target_id: id, device_token: deviceToken });
      // Also hide locally so the reporter doesn't keep seeing it while the
      // report is reviewed.
      await hideCluster({ id, text });
      onHidden?.(id, text);
      Alert.alert("Thanks for reporting", "We removed it from your feed and will review within 24 hours.");
    } catch (err) {
      Alert.alert("Couldn't report", err instanceof Error ? err.message : "report failed");
    }
  };

  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ["Cancel", "Hide this answer", "Report this answer"],
        destructiveButtonIndex: 2,
        cancelButtonIndex: 0,
        title: `"${text}"`,
      },
      (index) => {
        if (index === 1) doHide();
        if (index === 2) doReport();
      },
    );
  } else {
    Alert.alert(
      `"${text}"`,
      "Remove from your feed or report it? Reports are reviewed within 24 hours.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Hide", onPress: doHide },
        { text: "Report", style: "destructive", onPress: doReport },
      ],
    );
  }
}
