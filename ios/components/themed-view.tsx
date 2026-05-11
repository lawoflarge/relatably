import { View, type ViewProps } from 'react-native';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor: _darkColor, ...otherProps }: ThemedViewProps) {
  const backgroundColor = lightColor ?? '#fff';

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
