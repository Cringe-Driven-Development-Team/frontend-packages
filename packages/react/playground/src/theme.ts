import { createContext } from "@cdd-team/react";

export type Theme = "light" | "dark";

export const ThemeContext = createContext<Theme>("light");
