import { FriendsScreen } from "@/src/screens/FriendsScreen";
import auth from "@react-native-firebase/auth";

export default function FriendsTab() {
  const user = auth().currentUser;
  return <FriendsScreen isSignedIn={user !== null} myUid={user?.uid ?? null} />;
}
