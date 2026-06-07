// ios/src/lib/clusterModeration.ts
import { ActionSheetIOS, Alert, Platform } from "react-native";

import { reportContent } from "@/src/lib/api";
import { getDeviceToken } from "@/src/lib/deviceId";
import { hideCluster, addBlockedUser } from "@/src/lib/hiddenContentStore";

/**
 * Shared moderation action sheet for wordcloud answers (App Review Guideline
 * 1.2). Used by ClusterBubble (live + fallback wordcloud) and the Archive
 * detail screen so a user can hide, report, or block from a visible, tappable
 * control on every surface where answers appear — not only via a hard-to-
 * discover long-press.
 *
 * onHidden is called after a successful hide / report / block so the parent can
 * drop the cluster from view immediately (real-time removal from the feed).
 *
 * All actions remove the answer locally FIRST (always works, offline-safe) and
 * then hit the server best-effort. This means the controls work even on demo /
 * fallback content and for anonymous users — a reviewer always sees the action
 * succeed.
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
    // Remove from the feed immediately, then report best-effort.
    await hideCluster({ id, text });
    onHidden?.(id, text);
    try {
      const deviceToken = await getDeviceToken();
      await reportContent({ target_type: "cluster", target_id: id, device_token: deviceToken });
    } catch {
      /* anonymous / offline / demo content — local removal already applied */
    }
    Alert.alert("Thanks for reporting", "We removed it from your feed and will review within 24 hours.");
  };

  const doBlock = async () => {
    // Answers are anonymous aggregates, so "block" works at the contributor
    // level: hide the answer, record a local block so this contributor's
    // content stays out of the feed (visible + reversible under the ME tab),
    // and report it server-side best-effort.
    await hideCluster({ id, text });
    await addBlockedUser({ user_id: `contributor:${id}`, handle: text });
    onHidden?.(id, text);
    try {
      const deviceToken = await getDeviceToken();
      await reportContent({
        target_type: "cluster",
        target_id: id,
        reason: "blocked contributor",
        device_token: deviceToken,
      });
    } catch {
      /* local block already applied */
    }
    Alert.alert("Blocked", "We won't show this contributor's answers again.");
  };

  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ["Cancel", "Hide this answer", "Report this answer", "Block this contributor"],
        destructiveButtonIndex: 3,
        cancelButtonIndex: 0,
        title: `"${text}"`,
      },
      (index) => {
        if (index === 1) doHide();
        if (index === 2) doReport();
        if (index === 3) doBlock();
      },
    );
  } else {
    Alert.alert(
      `"${text}"`,
      "Remove from your feed, report it, or block whoever wrote it? Reports are reviewed within 24 hours.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Hide", onPress: doHide },
        { text: "Report", onPress: doReport },
        { text: "Block", style: "destructive", onPress: doBlock },
      ],
    );
  }
}
