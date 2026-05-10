import { FriendsScreen } from "@/src/screens/FriendsScreen";
import { auth } from "@/src/lib/firebase";

export default function FriendsTab() {
  const user = auth().currentUser;
  return <FriendsScreen isSignedIn={user !== null} />;
}
