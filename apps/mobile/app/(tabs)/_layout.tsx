import { Tabs } from "expo-router";
import { Home, ScanLine, BarChart3, Library, User } from "lucide-react-native";
import { useColors } from "../../src/theme";

export default function TabsLayout() {
  const c = useColors();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textTertiary,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          borderTopWidth: 1,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarIcon: ({ color, size }) => <ScanLine size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="decks"
        options={{
          title: "Bibliothek",
          tabBarIcon: ({ color, size }) => <Library size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Statistik",
          tabBarIcon: ({ color, size }) => <BarChart3 size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
      {/* Not a tab, but routable: the Home "Jetzt lernen" button (#609) opens
          this screen as the global due round (deck by deck). Deck-specific
          learning uses the /deck-review route instead. */}
      <Tabs.Screen
        name="learn"
        options={{
          href: null,
        }}
      />
      {/* Deck detail lives inside the tab group so the bottom bar stays
          visible while browsing a deck (like folder details). */}
      <Tabs.Screen
        name="deck/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="library-folder/[id]"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
