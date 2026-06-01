import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { FriendsScreen } from "@/src/screens/FriendsScreen";
import { auth } from "@/src/lib/firebase";

export default function FriendsTab() {
  // currentUser is null until Firebase async-restores the persisted session on
  // cold start, so read it reactively rather than once at mount.
  const [isSignedIn, setIsSignedIn] = useState(() => auth().currentUser !== null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth(), (u) => setIsSignedIn(u !== null));
    return () => unsub();
  }, []);
  return <FriendsScreen isSignedIn={isSignedIn} />;
}
