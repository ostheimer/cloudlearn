import { Tabs } from "expo-router";
import { Home, ScanLine, Brain, Library, User } from "lucide-react-native";
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
        name="learn"
        options={{
          title: "Lernen",
          tabBarIcon: ({ color, size }) => <Brain size={size} color={color} />,
          tabBarStyle: {
            display: "none",
          },
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
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="library-course/[id]"
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
