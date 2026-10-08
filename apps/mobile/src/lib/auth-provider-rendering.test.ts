import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Execute the actual screen's JSX with lightweight native hosts. This tests
// which controls/containers render, without a device or real auth requests.
const source = readFileSync(new URL("../../app/auth.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, jsxFactory: "React.createElement", jsxFragmentFactory: "React.Fragment" },
}).outputText;
type Node = { type: unknown; props: { children?: unknown[]; style?: Record<string, unknown> } };

function render(mode: string, providers: { google: boolean; apple: boolean }) {
  const react = {
    Fragment: "Fragment",
    createElement: (type: unknown, props: object | null, ...children: unknown[]): Node => ({ type, props: { ...props, children } }),
    useState: (initial: unknown) => [initial === "login" ? mode : (initial && typeof initial === "object" && "google" in initial ? providers : initial), () => {}],
    useEffect: () => {},
    useRef: () => ({ current: null }),
  };
  const native = Object.fromEntries(["Image", "ActivityIndicator", "KeyboardAvoidingView", "ScrollView", "Text", "TextInput", "TouchableOpacity", "View"].map(name => [name, name]));
  const modules: Record<string, unknown> = {
    react,
    "react-native": { ...native, Platform: { OS: "ios" }, useWindowDimensions: () => ({ height: 844 }), Alert: {}, Linking: {} },
    "expo-router": { useRouter: () => ({}) },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "lucide-react-native": { Apple: "Apple" },
    "../src/store/sessionStore": { useSessionStore: () => () => {} },
    "../src/theme": { spacing: {}, radius: {}, typography: {} },
  };
  const exports: { default?: () => Node } = {};
  new Function("require", "exports", "React", compiled)((name: string) => modules[name] ?? {}, exports, react);
  const nodes: Node[] = [];
  const text: string[] = [];
  function visit(value: unknown): void {
    if (typeof value === "string") { text.push(value); return; }
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (value && typeof value === "object" && "props" in value) {
      const node = value as Node;
      nodes.push(node);
      visit(node.props.children);
    }
  }
  visit(exports.default!());
  return { text: text.join(" "), nodes };
}

describe("auth screen provider visibility", () => {
  it.each(["login", "register"])("%s shows only enabled providers and keeps the email flow", mode => {
    for (const google of [false, true]) for (const apple of [false, true]) {
      const screen = render(mode, { google, apple });
      expect(screen.text.includes("Mit Google fortfahren")).toBe(google);
      expect(screen.text.includes("Mit Apple fortfahren")).toBe(apple);
      expect(screen.text.includes("oder mit E-Mail")).toBe(google || apple);
      expect(screen.nodes.some(node => node.type === "TextInput")).toBe(true);
      if (!google && !apple) {
        expect(screen.nodes.filter(node => node.type === "View" && node.props.style && "gap" in node.props.style && "marginBottom" in node.props.style)).toHaveLength(0);
      }
    }
  });

  it("reset stays email-only even when both providers are enabled", () => {
    const screen = render("reset", { google: true, apple: true });
    expect(screen.text).not.toContain("Mit Google fortfahren");
    expect(screen.text).not.toContain("Mit Apple fortfahren");
    expect(screen.text).not.toContain("oder mit E-Mail");
    expect(screen.nodes.some(node => node.type === "TextInput")).toBe(true);
  });
});
