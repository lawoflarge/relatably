import React from "react";
import { ScrollView, Text, View } from "react-native";

type Props = { children: React.ReactNode };
type State = { error: Error | null; info: string };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: "" };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: "" };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    this.setState({ info: info?.componentStack ?? "" });
    console.error("[Relatably ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView style={{ flex: 1, backgroundColor: "#FFF7E8" }} contentContainerStyle={{ padding: 24, paddingTop: 80 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#1A1A1A", marginBottom: 12 }}>
            Relatably hit a snag.
          </Text>
          <Text style={{ fontSize: 14, color: "#1A1A1A", marginBottom: 16 }}>
            {String(this.state.error.message || this.state.error)}
          </Text>
          <Text style={{ fontSize: 11, color: "#4A4541", fontFamily: "Courier" }}>
            {String(this.state.error.stack || "no stack")}
          </Text>
          {this.state.info ? (
            <>
              <Text style={{ fontSize: 12, color: "#4A4541", marginTop: 16, marginBottom: 4, fontWeight: "700" }}>
                Component stack
              </Text>
              <Text style={{ fontSize: 10, color: "#4A4541", fontFamily: "Courier" }}>{this.state.info}</Text>
            </>
          ) : null}
        </ScrollView>
      );
    }
    return <View style={{ flex: 1 }}>{this.props.children}</View>;
  }
}
