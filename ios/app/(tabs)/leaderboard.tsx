import { LeaderboardScreen } from "@/src/screens/LeaderboardScreen";
import auth from "@react-native-firebase/auth";

export default function LeaderboardTab() {
  const isSignedIn = auth().currentUser !== null;
  return <LeaderboardScreen isSignedIn={isSignedIn} />;
}
