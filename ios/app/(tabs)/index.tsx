import { StatusBar } from "expo-status-bar";
import { QuestionScreen } from "@/src/screens/QuestionScreen";

export default function HomeScreen() {
  return (
    <>
      <StatusBar style="light" />
      <QuestionScreen onSubmit={() => {}} />
    </>
  );
}
