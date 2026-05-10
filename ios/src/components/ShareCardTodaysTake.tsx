import { View, Text, StyleSheet } from "react-native";
import { palette, shadow, radii } from "../theme/tokens";

interface Props {
  questionText: string;
  userAnswer: string;
  date: string;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

export function ShareCardTodaysTake({ questionText, userAnswer, date }: Props) {
  return (
    <View testID="share-card-todays-take" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.brand}>RELATABLY</Text>
        <Text style={styles.date}>{date}</Text>
      </View>
      <Text style={styles.yourTake}>your take —</Text>
      <Text style={styles.question}>{questionText}</Text>
      <View style={styles.answerBox}>
        <Text style={styles.answerText}>{userAnswer.toUpperCase()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: palette.cream,
    padding: 96,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    color: palette.ink,
    fontSize: 56,
    fontFamily: "BagelFatOne",
    letterSpacing: 2,
  },
  date: {
    color: palette.inkSoft,
    fontSize: 36,
    fontFamily: "HankenGrotesk_700",
  },
  yourTake: {
    color: palette.inkSoft,
    fontSize: 40,
    fontFamily: "HankenGrotesk_700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 96,
  },
  question: {
    color: palette.ink,
    fontSize: 64,
    fontFamily: "BagelFatOne",
    lineHeight: 80,
  },
  answerBox: {
    borderColor: palette.ink,
    borderWidth: 6,
    padding: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.xl,
    backgroundColor: palette.cream2,
    // sticker shadow
    shadowColor: palette.ink,
    shadowOffset: shadow.l.offset,
    shadowRadius: shadow.l.radius,
    shadowOpacity: shadow.l.opacity,
    elevation: shadow.l.elevation,
  },
  answerText: {
    color: palette.pink,
    fontSize: 96,
    fontFamily: "BagelFatOne",
    letterSpacing: 2,
    textAlign: "center",
  },
});
