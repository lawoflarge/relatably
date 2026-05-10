import { LeaderboardScreen } from "@/src/screens/LeaderboardScreen";
import { auth } from "@/src/lib/firebase";

export default function LeaderboardTab() {
  const isSignedIn = auth().currentUser !== null;
  return <LeaderboardScreen isSignedIn={isSignedIn} />;
}
