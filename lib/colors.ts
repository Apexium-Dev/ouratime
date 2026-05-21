// Design System Colors
export const colors = {
  primary: {
    main: "#008080",
    light: "#26a69a",
    dark: "#004d4d",
  },
  secondary: {
    main: "#F6F5F4",
    light: "#f9f8f8",
    dark: "#a59f96",
  },
  tertiary: {
    main: "#A96039",
    light: "#dcc8b5",
    dark: "#813429",
  },
  neutral: {
    main: "#050505",
    light: "#8c8c8c",
    dark: "#050505",
  },
} as const;

// Button Styles
export const buttonStyles = {
  primary: {
    background: colors.primary.main,
    color: "#FFFFFF",
  },
  secondary: {
    background: colors.secondary.main,
    color: colors.neutral.main,
  },
  inverted: {
    background: colors.neutral.main,
    color: "#FFFFFF",
  },
  outlined: {
    background: "transparent",
    border: `2px solid ${colors.primary.main}`,
    color: colors.primary.main,
  },
} as const;
