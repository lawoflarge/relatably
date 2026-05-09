import { useLocalSearchParams } from "expo-router";
import { ArchiveDetailScreen } from "@/src/screens/ArchiveDetailScreen";

export default function ArchiveDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ArchiveDetailScreen questionId={id ?? ""} />;
}
