# Screen-Dokumentation — Ist-Zustand (iPhone 16 Pro)

Exakte Beschreibung aller Screens wie sie derzeit im Code implementiert sind.  
Gerät: iPhone 16 Pro (393 × 852 pt, 3× Retina).  
Screenshots aufgenommen im iOS Simulator (Xcode 26.2, iOS 26.2).

Stand: 2026-02-16

Screenshots in `screenshots/` — **echte Simulator-Screenshots** (iPhone 16 Pro, 1179×2556px @3x).

| # | Screen | Datei | Status |
|---|--------|-------|--------|
| 1 | Auth (Login) | `screenshots/01-auth-login.png` | Simulator |
| 2 | Home | `screenshots/02-home.png` | Simulator (mit Testdaten) |
| 3 | Scan | `screenshots/03-scan.png` | Simulator |
| 4 | Lernen (Empty State) | `screenshots/04-learn.png` | Simulator |
| 4b | Lernen (Aktiv, Karte 1 von 3) | `screenshots/04-learn-active.png` | Simulator (mit Testdaten) |
| 5 | Bibliothek | `screenshots/05-library.png` | Simulator (mit Deck) |
| 6 | Profil | `screenshots/06-profile.png` | Simulator |
| 7 | Paywall | `screenshots/07-paywall.png` | Simulator |
| 8 | Deck-Detail | `screenshots/09-deck-detail.png` | Simulator (mit Karten) |
| 9 | Quiz/Test | `screenshots/10-quiz.png` | Simulator |
| 10 | Match | `screenshots/11-match.png` | Simulator |
| 11 | Image Occlusion | `screenshots/12-occlusion.png` | Simulator |
| 12 | Bibliothek: Kurse-Tab | `screenshots/05b-library-courses.png` | Simulator (mit Kurs) |
| 13 | Bibliothek: Ordner-Tab | `screenshots/05c-library-folders.png` | Simulator (mit Ordner) |
| 14 | Kurs-Detail | `screenshots/13-course-detail.png` | Simulator (mit Deck) |
| 15 | Ordner-Detail | `screenshots/14-folder-detail.png` | Simulator (mit Deck) |

---

## Design-Tokens (aus `src/theme.ts`)

### Light Mode
| Token | Wert |
|-------|------|
| `primary` | `#6366f1` (Indigo) |
| `background` | `#f8fafc` |
| `surface` | `#ffffff` |
| `surfaceSecondary` | `#f1f5f9` |
| `border` | `#e2e8f0` |
| `text` | `#0f172a` |
| `textSecondary` | `#64748b` |
| `textTertiary` | `#94a3b8` |
| `success` | `#10b981` |
| `warning` | `#f59e0b` |
| `error` | `#ef4444` |
| `info` | `#3b82f6` |

### Dark Mode
| Token | Wert |
|-------|------|
| `primary` | `#818cf8` |
| `background` | `#0f172a` |
| `surface` | `#1e293b` |
| `text` | `#f1f5f9` |

### Spacing
`xs:4  sm:8  md:12  lg:16  xl:20  xxl:24  xxxl:32`

### Radius
`sm:8  md:12  lg:16  xl:20  full:9999`

### Typography (Font-Größen)
`xs:11  sm:13  base:15  lg:17  xl:20  xxl:24  xxxl:32`

---

## Tab-Bar (Bottom, `(tabs)/_layout.tsx`)

| Position | Name | Icon | Besonderes |
|----------|------|------|------------|
| 1 | Home | `Home` (lucide) | |
| 2 | Scan | `ScanLine` | |
| 3 | Lernen | `Brain` | Tab-Bar wird beim Öffnen ausgeblendet (`display: "none"`) |
| 4 | Bibliothek | `Library` | |
| 5 | Profil | `User` | |

- Aktive Farbe: `primary`
- Inaktive Farbe: `textTertiary`
- Hintergrund: `surface`, Border oben `border` 1px, paddingTop 4
- Label: 11px, fontWeight 600
- Header aller Tab-Screens: `headerShown: false` (eigener Custom-Header pro Screen)

Versteckte Routen im Tab-Kontext (kein Tab-Icon, `href: null`):
- `library-course/[id]` — Kurs-Detail aus Bibliothek
- `library-folder/[id]` — Ordner-Detail aus Bibliothek

---

## 1. Home — `(tabs)/index`

> Screenshot: `screenshots/02-home.png`

**SafeAreaView**, Hintergrund `background`, padding `xl` (20), gap `lg` (16).

### 1.1 Header
- Text „clearn", fontSize `xxxl` (32), fontWeight `800`, color `text`, letterSpacing -0.5
- Darunter: „Foto — Karte — Wissen", fontSize `base` (15), color `textSecondary`, marginTop `xs` (4)

### 1.2 Streak-Banner
- View, Hintergrund `warningLight` wenn streak > 0, sonst `surfaceSecondary`
- Border `warning` wenn streak > 0, sonst `border`, borderWidth 1
- borderRadius `lg` (16), padding `lg` (16), flexDirection row, gap `md` (12)
- Links: Kreis 48×48, borderRadius 24, Hintergrund `warning` mit opacity 0.25 (wenn streak > 0)
  - Icon `Flame` 26px, fill wenn streak > 0
- Mitte: Streak-Zahl (fontSize 28, fontWeight 800), darunter Status-Text (fontSize `sm`)
- Rechts (optional): `Award`-Icon 16px + „Best: X" wenn longestStreak > 0

### 1.3 Tagesziel-Card
- View, Hintergrund `surface`, borderRadius `lg`, padding `lg`, border `border` 1px
- Zeile: `Target`-Icon 18px + „Tagesziel" (base, semibold) | rechts: „X/10 Karten" (sm, bold, grün wenn erreicht)
- Darunter: Fortschrittsbalken 8px hoch, `surfaceSecondary` Hintergrund, gefüllter Teil `primary` (oder `success` wenn 100%)

### 1.4 Stat-Cards (3er-Reihe)
Drei Karten nebeneinander (flex: 1), gap `sm` (8):

| Karte | Icon | Zahl | Label |
|-------|------|------|-------|
| Fällig | `BookOpen` 18px in 36×36 Box (`primaryLight` wenn > 0) | fontSize 22, extrabold | „Fällig" xs |
| Decks | `Layers` 18px in 36×36 Box `surfaceSecondary` | fontSize 22, extrabold | „Decks" xs |
| Genauigkeit | `TrendingUp` 18px in 36×36 Box (`successLight` wenn ≥ 70%) | „X%" oder „—" | „Genauigkeit" xs |

Jede Karte: `surface`, borderRadius `lg`, padding `md`, border 1px, shadow sm, alignItems center.

### 1.5 Letztes Deck (optional)
- TouchableOpacity, Hintergrund `surface`, borderRadius `lg`, padding `lg`, border 1px, shadow sm
- Links: `Clock`-Icon 18px in 40×40 Box (`primaryLight`)
- „Zuletzt gelernt" (xs, textTertiary) + Deck-Titel (base, semibold)
- Rechts: `ChevronRight` 18px textTertiary
- onPress → `/deck/[id]`

### 1.6 Action-Buttons
- **„X Karten lernen"** (nur wenn dueCount > 0): Hintergrund `primary`, borderRadius `lg`, padding `lg`, shadow md. Icon `BookOpen` 20px weiß + Text (lg, bold, weiß) + `ChevronRight`. → `/(tabs)/learn`
- **„Neuen Text scannen"**: Hintergrund `primary` (oder `surface` + border wenn fällige Karten existieren). Icon `ScanLine` 20px + Text lg bold. → `/(tabs)/scan`

### Zustände
- Loading: `ActivityIndicator` zentriert
- Fehler: roter Text
- Kein Deck: kein „Letztes Deck"-Abschnitt
- Keine fälligen Karten: kein „Lernen"-Button

---

## 2. Scan — `(tabs)/scan`

> Screenshot: `screenshots/03-scan.png`

Hat 3 Modi: `choose`, `camera`, `text`.

### 2.1 Modus „choose" (Standard)
**SafeAreaView + ScrollView**, padding `lg`, gap `lg`.

- Titel: „Lernmaterial erfassen" (xxl, bold)

**Drei große Aktions-Buttons** (jeweils TouchableOpacity, borderRadius `lg`, padding `xl`, shadow md, flexDirection row):

| # | Hintergrund | Icon | Titel | Untertitel |
|---|-------------|------|-------|------------|
| 1 | `primary` (#6366f1) | `Camera` 24px in 48×48 halbtransparenter Box | „Foto aufnehmen" (lg, bold, weiß) | „Lehrbuch, Tafel, Notizen fotografieren" |
| 2 | `success` (#10b981) | `ImageIcon` 24px | „Aus Galerie wählen" | „Vorhandenes Foto oder Screenshot" |
| 3 | `warning` (#f59e0b) | `PenLine` 24px | „Text eingeben" | „Text tippen oder einfügen" |

Jeder Button hat rechts `ChevronRight` 20px halbtransparent.

**Info-Box** darunter:
- Hintergrund `infoLight`, borderRadius `md`, padding 14
- `Lightbulb` 18px `info` links + Text: „Gemini AI analysiert dein Material…" (sm, `info`)

### 2.2 Modus „camera"
- SafeAreaView schwarz (#000), `CameraView` fullscreen, facing „back"
- Unten zentriert: Shutter-Button (72×72, borderRadius 36, weiß, border 4px halbtransparent)
- Darunter: `X`-Icon + „Abbrechen" (lg, semibold, weiß)

### 2.3 Modus „text"
- Header: „Text eingeben" (xxl, bold) + rechts „Zurück" mit X-Icon (primary)
- TextInput multiline, minHeight 180, border, borderRadius md, padding 14, `surface`
- Optional: „Beispieltext laden"-Button (`surfaceSecondary`)
- Button „Flashcards generieren" (`primary` oder grau wenn disabled), mit `Sparkles`-Icon

### 2.4 Ergebnis-Ansicht (nach Scan)
- Titel: „Ergebnis" (xxl, bold)
- Optional: Bildvorschau (120px hoch, borderRadius md)
- Deck-Titel (xl, bold) wenn vorhanden
- „X Karten generiert" + „via model" rechts
- Kartenliste: Jede Karte `surface`, borderRadius md, border 1px. Front bold base, Back textSecondary sm+1. Tags als Badges (xs, `surfaceSecondary`)
- Button „Speichern & Lernen" (`success`, `Save`-Icon, lg bold weiß)
- Button „Neuen Scan starten" (`surfaceSecondary`, `RotateCcw`-Icon)

---

## 3. Lernen — `(tabs)/learn`

> Screenshot Aktiv: `screenshots/04-learn-active.png`  
> Screenshot Empty State: `screenshots/04-learn.png`

**Tab-Bar ausgeblendet.** GestureHandlerRootView + SafeAreaView, padding `lg`, gap `md`.

### 3.1 Header (3-Spalten)
- Links: X-Button (34×34, borderRadius full, `surfaceSecondary`, `X` 16px)
- Mitte: Titel (xxl, bold, zentriert) → i18n „reviewHeadline"
- Rechts: Auto-Play Button (`Play`/`Pause` 14px, Pill-Form) + Speed-Button (Timer + „Xs") + Flip-Button (`ArrowLeftRight`)

### 3.2 Fortschritt
- Text „X / Y" zentriert (sm, medium, textSecondary)
- Fortschrittsbalken 4px, `surfaceSecondary`, gefüllt `primary` (oder `success` bei 100%)

### 3.3 Swipe-Counter
- Links: Roter Counter (swipedLeft, auf `ratingAgain` 20% Hintergrund)
- Rechts: Grüner Counter (swipedRight, auf `ratingGood` 20% Hintergrund)
- Beide: minWidth 32, borderRadius sm, sm bold

### 3.4 Karte (zentral, absolute Positionierung)
- Animated.View, `surface`, borderRadius `xl` (20), padding `xxl`, border 1px `border`, shadow lg
- **Vorderseite**: Text xxl semibold, zentriert, lineHeight 36. Darunter „Tippen zum Umdrehen" (base, textTertiary) wenn nicht aufgedeckt
- **Rückseite**: Gleich, aber border 1.5px `primary`
- **Swipe-Overlay links**: „NOCHMAL" (32px, extrabold, weiß, letterSpacing 2) auf rgba(239,68,68,0.85) — fadet ab 20% Threshold ein
- **Swipe-Overlay rechts**: „GEMERKT" auf rgba(16,185,129,0.85) — gleiche Fade-Logik
- Tinder-artige Rotation: max 15° bei Vollausschlag
- Fly-Out-Animation: 1.6× Bildschirmbreite, velocity-basierte Duration
- Snap-Back: Spring(damping 8, stiffness 35, mass 1.6)

### 3.5 Rating-Buttons (4er-Reihe)
| Button | Label | Farbe |
|--------|-------|-------|
| 1 | „Nochmal" | `ratingAgain` (#ef4444) |
| 2 | „Schwer" | `ratingHard` (#f59e0b) |
| 3 | „Gut" | `ratingGood` (#10b981) |
| 4 | „Leicht" | `ratingEasy` (#3b82f6) |

Alle: flex 1, borderRadius md, paddingVertical 14, Text weiß bold sm.

### 3.6 Bottom-Row
- Links: Zurück-Pfeil (`ArrowLeft` 22px in 44×44 Kreis, `surfaceSecondary`), disabled wenn canGoBack=false (opacity 0.3)
- Mitte: Hinweis-Text (xs, textTertiary) i18n
- Rechts: `Volume2` 22px (TTS, primary wenn aktiv) + `Star` 22px (warning wenn gestarrt, fill), jeweils 44×44 Touch-Area

### Zustände
- Loading: Spinner + „Karten werden geladen…"
- Keine Karten: `CheckCircle2` 36px in 72×72 Kreis (`surfaceSecondary`), „Keine fälligen Karten", „Neu laden"-Button
- Abgeschlossen: Grüner Kreis (`successLight`), „Session abgeschlossen", Kartenzahl, „Neu laden"-Button

---

## 4. Bibliothek — `(tabs)/decks`

> Screenshot: `screenshots/05-library.png`

**SafeAreaView**, padding `lg`, gap `md`.

### 4.1 Header
- „Bibliothek" (xxl, bold) links
- „+ Neu" Button rechts: `primary`, borderRadius md, paddingH 14, paddingV sm. `Plus` 16px (strokeWidth 3) + Text (base, bold, weiß)

### 4.2 Segmented Control
- 3 Segmente: „Decks | Kurse | Ordner"
- Container: `surfaceSecondary`, borderRadius md, padding 3
- Aktiver Tab: `surface` Hintergrund, shadow sm, Text bold
- Inaktiver Tab: transparent, Text medium `textSecondary`
- Jedes Segment: flex 1, paddingVertical sm, borderRadius sm

### 4.3 Suchfeld
- `Search`-Icon 18px `textTertiary` absolut links (left 14, top 14)
- TextInput: border 1px `border`, borderRadius md, paddingV md, paddingLeft 42, `surface`, Text `text`
- Placeholder: „Suchen…" (textTertiary)

### 4.4 Listen-Inhalt

**Deck-Item:**
- TouchableOpacity, `surface`, borderRadius md, padding 14, border 1px, shadow sm
- Row: `Layers` 18px primary + Titel (semibold, base, flex 1) + `ChevronRight` 18px
- Tags als Badges darunter (xs, `surfaceSecondary`, paddingH sm, paddingV 2, borderRadius sm)
- Datum darunter (xs, textTertiary)

**Kurs-Item:**
- Wie Deck, aber Icon: 28×28 farbiger Kreis (course.color oder primary) mit `BookOpen` 14px weiß
- Titel + optionale Description (sm, textSecondary)
- Datum

**Ordner-Item:**
- Icon: 28×28 Kreis (`warningLight` oder folder.color) mit `FolderOpen` 14px
- Titel + Datum

**Empty States:**
- 64×64 Kreis (`surfaceSecondary`) + passendes Icon 28px (`Layers`/`BookOpen`/`FolderOpen`)
- Text (base, textSecondary, zentriert)

### 4.5 Footer-Hinweis
- „Gedrückt halten zum Bearbeiten/Löschen" (xs, textTertiary, zentriert)

### 4.6 Variante: Kurse-Tab
> Screenshot: `screenshots/05b-library-courses.png`

Segmented Control auf „Kurse" aktiv:
- Kurs-Items mit farbigem Icon-Kreis (28×28, course.color oder `primary`) + `BookOpen` 14px weiß
- Titel (semibold, base) + optionale Beschreibung (sm, textSecondary)
- Datum (xs, textTertiary)
- `ChevronRight` rechts
- Tap → `library-course/[id]`

### 4.7 Variante: Ordner-Tab
> Screenshot: `screenshots/05c-library-folders.png`

Segmented Control auf „Ordner" aktiv:
- Ordner-Items mit farbigem Icon-Kreis (28×28, `warningLight` oder folder.color) + `FolderOpen` 14px
- Titel (semibold, base)
- Datum (xs, textTertiary)
- `ChevronRight` rechts
- Tap → `library-folder/[id]`

---

## 5. Kurs-Detail — `(tabs)/library-course/[id]`

> Screenshot: `screenshots/13-course-detail.png`

**Tab-Bar bleibt sichtbar.** SafeAreaView edges bottom, padding `lg`.  
Header via `navigation.setOptions()`: Zurück „Bibliothek", dynamischer Titel, Drei-Punkte-Menü rechts.

### 5.1 Header-Right
- TouchableOpacity 34×34, alignItems/justifyContent center
- `MoreVertical` 20px `text`

### 5.2 Kurs-Card
- `surface`, borderRadius lg, padding lg, border 1px, shadow md
- Row: 44×44 Quadrat (borderRadius md, `primary`) mit `BookOpen` 22px weiß
- Rechts: Kurs-Titel (lg, bold) + „X Decks" (sm, textSecondary)

### 5.3 Sektion „DECKS IN DIESEM KURS"
- Label: sm, semibold, textSecondary, uppercase, letterSpacing 0.8

### 5.4 Deck-Liste oder Empty State
- Deck-Items: `surface`, borderRadius md, padding 14, border 1px, shadow sm. `Layers` 18px primary + Titel + `ChevronRight`
- Empty: 64×64 Kreis `surfaceSecondary` + `Layers` 28px + „Noch keine Decks in diesem Kurs.\nFüge Decks über das Drei-Punkte-Menü im Deck hinzu."

---

## 6. Ordner-Detail — `(tabs)/library-folder/[id]`

> Screenshot: `screenshots/14-folder-detail.png`

Gleiche Struktur wie Kurs-Detail, aber:
- Icon: 44×44 `warningLight` mit `FolderOpen` 22px `warning`
- Untertitel: „X Einträge"
- Sektionen: „Unterordner" (falls vorhanden) + „Decks"
- Unterordner-Items: 28×28 `warningLight` Kreis + `FolderIcon` 14px + Titel + Chevron
- Navigation zu Unterordnern: rekursiv via `buildLibraryFolderRoute()`

---

## 7. Deck-Detail — `deck/[id]`

> Screenshot: `screenshots/09-deck-detail.png`

**Kein Tab-Bar** (Root-Stack, außerhalb `(tabs)`).  
Header via `Stack.Screen options`: Zurück-Titel „Decks", dynamischer Deck-Titel, `headerTintColor: primary`, `headerStyle: { backgroundColor: background }`.

### 7.1 Header-Right
- Row: Optional `Download` 16px success (wenn Offline) + `MoreVertical` 22px `text` (hitSlop 8)
- Tap auf MoreVertical → DeckActionSheet

### 7.2 Sub-Header (unterhalb System-Header)
SafeAreaView edges bottom, padding `lg`, gap `md`.
- Row: „X Karten" (base, textSecondary, medium) | rechts: „+ Karte" Button (`primary`, borderRadius md, paddingH 14, paddingV sm, `Plus` 16px strokeWidth 3 + Text base bold weiß)

### 7.3 Lernmodus-Buttons (3er-Reihe, nur wenn ≥ 2 Karten)
| Button | Hintergrund | Icon | Label |
|--------|-------------|------|-------|
| Test | `primaryLight` | `Brain` 16px primary | „Test" (sm, semibold, primary) |
| Match | `accentLight` (#f5f3ff) | `Puzzle` 16px accent (#8b5cf6) | „Match" |
| Occlusion | `infoLight` (#eff6ff) | `ImagePlus` 16px info (#3b82f6) | „Occlusion" |

Alle: flex 1, borderRadius md, paddingV md, row, zentriert, gap sm.

### 7.4 Kartenliste
- ScrollView mit RefreshControl, gap sm+2, paddingBottom xxl
- **Jede Karte** (TouchableOpacity, onPress → Edit, onLongPress → Alert):
  - `surface`, borderRadius md, padding 14, border 1px, shadow sm
  - **Top-Row**: „#1 · Basic" oder „Lückentext" (xs, textTertiary, medium) | rechts: `Star` 16px (warning/fill oder textTertiary) + Schwierigkeit-Label (xs, bold, uppercase, farbig: easy=success, medium=warning, hard=error)
  - **Front**: Text (semibold, base, text), numberOfLines 2
  - **Trennlinie**: 1px `borderLight`, marginV sm
  - **Back**: Text (sm+1, textSecondary), numberOfLines 2
- **Empty State**: 64×64 Kreis `surfaceSecondary` + `CreditCard` 28px textTertiary + „Noch keine Karten in diesem Deck.\nTippe '+ Karte' oder scanne neuen Inhalt."
- **Footer-Hinweis**: „Tippe auf eine Karte zum Bearbeiten · Halte gedrückt für mehr Optionen" (xs, textTertiary, zentriert)

### 7.5 DeckActionSheet (Bottom Sheet Modal)
Aktionen: Offline speichern, Bearbeiten, Zu Kurs hinzufügen, Zu Ordner, Duplizieren, Teilen, Details, Löschen.

### 7.6 CardEditor Modal (pageSheet, slide)
- Header: `surface`, borderBottom 1px, padding lg
  - Links: X 18px + „Abbrechen" (textSecondary)
  - Mitte: „Karte bearbeiten" / „Neue Karte" (lg, bold)
  - Rechts: Check 18px + „Speichern" (primary wenn valid, sonst textTertiary)
- **Felder**:
  - „VORDERSEITE (FRAGE)": Label (sm, semibold, uppercase, textSecondary, letterSpacing 0.5) + TextInput multiline minHeight 80
  - „RÜCKSEITE (ANTWORT)": gleich
  - „KARTENTYP": 2 Buttons „Basic" | „Lückentext" (border 2px primary wenn aktiv, `primaryLight`)
  - „SCHWIERIGKEIT": 3 Buttons „Leicht" (success) | „Mittel" (warning) | „Schwer" (error), border 2px farbig wenn aktiv

### 7.7 Weitere Modals
- **CoursePickerModal**: Kurs-Auswahl zum Hinzufügen
- **FolderPickerModal**: Ordner-Auswahl
- **DeckEditModal**: Titel und Tags bearbeiten
- **DeckDetailsModal**: Deck-Statistiken

---

## 8. Profil — `(tabs)/profile`

> Screenshot: `screenshots/06-profile.png`

**SafeAreaView**, padding `lg`, gap `lg`.

### 8.1 Titel
- „Profil" (xxl, bold)

### 8.2 Account-Card
- `surface`, borderRadius lg, padding lg, border 1px, shadow sm
- **E-Mail-Zeile**: 40×40 Box `primaryLight` + `Mail` 18px primary | Label „E-MAIL" (xs, uppercase, semibold, textTertiary, letterSpacing 0.5) + Wert (base, medium)
- Trennlinie (1px `borderLight`)
- **Abo-Zeile**: 40×40 Box `warningLight` + `Crown` 18px warning | Label „ABO-STUFE" + Tier-Text (base, semibold)
- Wenn Free: „Upgrade"-Button (`primaryLight`, borderRadius sm, paddingH md, paddingV 6)

### 8.3 Design-Card
- 40×40 Box (`primaryLight` wenn dark, sonst `surfaceSecondary`) + `Moon`/`Sun` 18px
- „Design" (base, semibold) + Status-Text (xs, textTertiary)
- 3 Buttons nebeneinander: „System" | „Hell" | „Dunkel"
  - Aktiv: `primary` Hintergrund, Text weiß
  - Inaktiv: `surfaceSecondary`, Text textSecondary

### 8.4 Erinnerungs-Card
- Row: 40×40 Box + `Bell` 18px | „Tägliche Erinnerung" + Untertitel | Switch rechts
- Wenn aktiv: Trennlinie + Uhrzeit-Zeile (40×40 + `Clock` + „Uhrzeit" | Wert „19:00" in primary bold)

### 8.5 Sprache
- `Globe` 16px + „Sprache" (base, semibold)
- 2 Buttons nebeneinander: „Deutsch" | „English"
  - Aktiv: `primary`, Text weiß, kein Border
  - Inaktiv: `surface`, border 1px

### 8.6 Spacer (flex: 1)

### 8.7 Abmelden
- `errorLight` Hintergrund, border rgba(239,68,68,0.2), borderRadius md, paddingV 16
- `LogOut` 18px error + „Abmelden" (lg, bold, error)

### 8.8 Version
- „clearn.ai v0.3.0" (xs, textTertiary, zentriert)

---

## 9. Auth — `auth`

> Screenshot: `screenshots/01-auth-login.png`

**SafeAreaView + KeyboardAvoidingView + ScrollView**, flexGrow 1, justifyContent center, padding `xxl`.

### 9.1 Logo
- 72×72 Box (`primaryLight`, borderRadius lg) + `BookOpen` 36px primary
- „clearn" (xxxl, extrabold, letterSpacing -0.5)
- „Foto — Flashcards — Wissen" (base, textSecondary)

### 9.2 Titel
- Login: „Willkommen zurück", Register: „Konto erstellen", Reset: „Passwort zurücksetzen"
- (xxl, bold, zentriert, marginBottom xxl)

### 9.3 Formular
- E-Mail Label (sm, semibold, textSecondary) + TextInput (`surface`, border 1px, borderRadius md, padding 14)
- Passwort (wenn nicht Reset): gleich, secureTextEntry
- Passwort bestätigen (nur Register): gleich
- Login-Modus: „Passwort vergessen?" Link (primary, sm+1, rechtsbündig)

### 9.4 Submit-Button
- `primary` (oder textTertiary wenn loading), borderRadius md, paddingV 16
- Text: „Anmelden" / „Registrieren" / „Link senden" (lg, bold, weiß)
- Loading: ActivityIndicator

### 9.5 Modus-Wechsel
- „Noch kein Konto? **Registrieren**" / „Bereits ein Konto? **Anmelden**"
- marginTop xxl, zentriert

---

## 10. Paywall — `paywall`

> Screenshot: `screenshots/07-paywall.png`

**Root-Stack** mit Header „Upgrade", Zurück. SafeAreaView + ScrollView, padding `lg`, gap `md`.

### 10.1 Header-Texte
- Titel (xxxl, bold)
- Untertitel (base, textSecondary) — i18n

### 10.2 Aktuelle Stufe
- `surface`, borderRadius lg, border 1px, padding lg
- Label „Aktuelles Abo" (sm, textSecondary)
- Tier-Name (xl, bold)

### 10.3 Angebote (wenn tier=free)
- Pro Angebot: `surface`, borderRadius lg, border 1px, padding lg, shadow sm
  - Titel (lg, bold), Description (sm, textSecondary), Preis (base, bold, primary)
  - Bei Kauf: ActivityIndicator
- „Käufe wiederherstellen" Button (`surfaceSecondary`, borderRadius md, paddingV 12)

### 10.4 Wenn nicht free
- „Weiter" Button (`primary`)

### 10.5 Verfügbarkeits-Warnung (optional)
- `warningLight` Box mit `warning` Border

### 10.6 Zurück-Link
- „Zurück" (textSecondary, zentriert)

---

## 11. Quiz — `quiz`

> Screenshot: `screenshots/10-quiz.png`

**Root-Stack**, Header „Quiz" + Zurück. SafeAreaView, padding lg, gap md.

### 11.1 Fortschritt
- „Frage X von Y" (sm, textSecondary, zentriert)
- Fortschrittsbalken 6px
- Timer: `Timer` 14px + „Xs" (xs, textTertiary)

### 11.2 Frage
- True/False: Card mit Front/Back-Paarung + „Stimmt diese Zuordnung?"
- Multiple Choice: Frage-Text (xl, bold)
- 4 Antwort-Buttons (oder 2 bei T/F): `surface`, borderRadius md, padding 14-16, border 1px
  - Nach Antwort: grün (korrekt) mit `CheckCircle2` oder rot (falsch) mit `XCircle`
  - „Weiter →" Button erscheint nach Antwort

### 11.3 Ergebnis
- Pokal-Icon (`Trophy` 48px in 80×80 `warningLight` Kreis)
- „Quiz beendet!" (xxl, extrabold)
- Score „X/Y richtig" (xxxl, extrabold, primary)
- Prozent-Balken
- Zeit (sm, textSecondary)
- „Nochmal spielen" + „Zurück zum Deck" Buttons

---

## 12. Match — `match`

> Screenshot: `screenshots/11-match.png`

**Root-Stack**, Header „Match" + Zurück. SafeAreaView, padding lg.

### 12.1 Top-Bar
- Timer: `Timer` 16px + formatierte Zeit (base, bold)
- Fehler: `Zap` 16px + Fehleranzahl (base, bold, error)

### 12.2 Spielfeld
- 2-Spalten-Grid (gap sm+2), flexWrap wrap
- Kacheln: `surface`, borderRadius md, padding md, border 1px
  - Breite: (SCREEN_WIDTH - 3×lg - sm-2) / 2
  - Text base, zentriert
  - Ausgewählt: border 2px primary, `primaryLight` Hintergrund
  - Gematcht: `success` border, `successLight` Hintergrund, opacity 0.7
  - Falsch: `error` border (kurz)

### 12.3 Ergebnis
- Pokal-Icon + „Alle Paare gefunden!" (xxl, extrabold)
- Zeit + Fehler
- „Nochmal" + „Zurück" Buttons

---

## 13. Image Occlusion — `occlusion`

> Screenshot: `screenshots/12-occlusion.png`

**Root-Stack**, Header „Image Occlusion" + Zurück. SafeAreaView.

### 13.1 Kein Bild
- 80×80 Kreis (`surfaceSecondary`) + `ImagePlus` 40px
- „Bild für Image Occlusion auswählen" (base, textSecondary)
- „Bild auswählen" Button (primary, lg, bold, weiß, borderRadius lg, shadow md)
- Info-Box (`infoLight`): `HelpCircle` + Erklärungstext

### 13.2 Mit Bild
- Bildvorschau (volle Breite, 80% Höhe), PanResponder für Rechteck-Zeichnen
- Gezeichnete Rechtecke: primary mit 30% Opacity, border 2px primary dashed
- Toolbar darunter: „Bereich zeichnen" Toggle (`Square`-Icon, primary wenn aktiv) + „Verschieben" (`Move`)
- Regionen-Liste: Card pro Region (surface, borderRadius md, border 1px)
  - TextInput für Label + `Trash2` Löschen-Button
- „Als Deck speichern" Button (primary, `Check`-Icon)

---

## Pflege

Bei jeder Code-Änderung an einem Screen:
1. Beschreibung in dieser Datei aktualisieren
2. Wireframe bei Bedarf neu generieren
3. ROADMAP.md Eintrag ergänzen

Stand: 2026-02-16

---

## Soll-Konzept (Ziel-UI)

Basierend auf dem dokumentierten Ist-Zustand: priorisierte UI-Verbesserungen nach User Impact.  
Referenz: ROADMAP.md Feature-Prioritäten A–D.

### Priorität 1 — Kritisch (direkt sichtbar, hoher Impact)

#### Home-Screen
- **Kurs-/Ordner-Kontext auf Lern-CTA**: „X Karten lernen"-Button zeigt aus welchem Deck/Kurs (z.B. „3 Karten aus ‚Deutsch Vokabeln' lernen"). Nutzer weiß was ihn erwartet.
- **Streak-Banner verbessern**: Bei 0-Streak dezenter leerer Zustand (kein Icon), bei aktivem Streak Flammen-Animation. Aktuell zu viel Platz für 0-Streak.
- **Datum + nächste Fälligkeit**: Unter dem Tagesziel „Nächste Karte fällig in: 2h" statt nur Zahl.

#### Lernen-Screen
- **Kartenanzahl im Tab-Icon**: Badge-Zahl auf dem „Lernen"-Tab-Icon zeigt fällige Karten (wie iOS Mail). User sieht sofort wie viele Karten warten, ohne den Tab zu öffnen.
- **Flip-Button auch ohne Geste**: Zusätzlicher Tap-Bereich für Nutzer die keine Swipe-Geste kennen (onboarding hint nach dem ersten Launch).
- **Lautsprecher-Button prominenter**: Derzeit sehr klein unten rechts. Auf der Karte selbst als sekundäre Aktion.
- **Session-Zusammenfassung verbessern**: Nach dem Abschluss: Karten-Performance pro Bewertung (X× Nochmal, X× Schwer, X× Gut, X× Leicht) als horizontale Balken.

#### Bibliothek-Screen
- **Deck-Items mit Kartenanzahl**: In der Deck-Liste die Anzahl Karten und fällige Karten anzeigen (z.B. „12 Karten · 3 fällig"). Nutzer sieht den Lernstatus ohne die Deck-Detail-Seite öffnen zu müssen.
- **Letzte Aktivität in der Liste**: Zeitstempel lesbarer machen (z.B. „Heute", „Gestern", „vor 3 Tagen" statt Datum).
- **Kurs-Icon in Farbe**: Kurs-Items zeigen bereits einen farbigen Kreis — konsistent machen (Icon-Größe 16px statt 14px, mehr Kontrast).

### Priorität 2 — Wichtig (verbessert UX deutlich)

#### Kurs-/Ordner-Detail-Screen
- **Deck-Vorschau-Cover**: Jedes Deck in der Liste zeigt die ersten 1-2 Karten-Vorderseiten als Preview (Font-Preview in graue Box). Gibt visuellen Kontext.
- **Header-Titel immer sichtbar**: Titel soll auch bei Navigation via Deep-Link korrekt angezeigt werden (vollständig mit GET-Endpoint gelöst, nach Deployment aktiv).
- **„Alle lernen"-Button**: CTA im Kurs/Ordner-Detail um alle fälligen Karten des Kurses/Ordners in einer Session zu starten.

#### Scan-Screen
- **Deck-Auswahl nach Scan verbessern**: Dropdown/Picker für vorhandene Decks eleganter gestalten (aktuell einfaches Alert). Modal mit Suche + „Neues Deck" Option.
- **Scan-Ergebnis-Preview**: Vor dem Speichern direkt die generierten Karten swipebar anzeigen (Vorschau wie Karteikarten).
- **Kamera-UI**: Shutter-Button größer (88×88), Hinweis-Text für optimale Foto-Qualität.

#### Auth-Screen
- **Apple Sign-In / Google Sign-In**: Social-Login-Buttons unter dem E-Mail-Formular (Requires OAuth setup). Aktuell nur E-Mail/Passwort.
- **„Passwort vergessen" Flow verbessern**: Klarerer Feedback-Text nach dem Versenden des Reset-Links.

### Priorität 3 — Qualitätssteigerung (polishing)

#### Learn-Screen
- **Bounce-Feedback bei falschem Swipe**: Wenn Nutzer Karte nur leicht anhebt und loslässt, Karte kurz in Richtung der Bewegung andeuten und zurückspringen. Taktiles Feedback.
- **Dark Mode**: Hintergrund in Dark Mode leicht dunkelblau statt reines Schwarz (Augen schonen).
- **Swipe-Anleitung beim ersten Mal**: Einmalige Onboarding-Animation zeigt Swipe-Geste.

#### Profil-Screen
- **Statistik-Zusammenfassung**: Kurze Review-History direkt auf der Profil-Seite (Lernstreak-Kalender als 7-Tage-Übersicht).
- **Account-Details erweiterbar**: Avatar/Profilbild uploadbar, Anzeigename einstellbar.
- **Version + Changelog**: Tap auf die Versionsnummer öffnet ein What's New Modal.

#### Deck-Detail-Screen
- **Karten-Vorschau-Modus**: Swipeable Kartenvorschau (nicht Lernen, nur Blättern) direkt aus der Deck-Detail-Seite.
- **Bulk-Aktionen**: Mehrere Karten selektieren und gemeinsam löschen/verschieben/exportieren.

### Nicht-Ziele (bewusst ausgeschlossen)

- **Web-App als Feature-Parität**: Web ist Scaffold, fokus bleibt Mobile.
- **Soziale Features**: Keine Kommentare/Likes auf Karten, kein Activity-Feed.
- **Gamification-Exzesse**: Keine Level-Ups oder virtuelle Währung — Streak + Tagesziel reicht.

### Nächste Umsetzungsschritte (empfohlen)

1. **Tab-Badge für fällige Karten** (klein, 1-2h): `TabBar`-Konfiguration in `_layout.tsx` mit `tabBarBadge` von Expo Router. Größter UX-Impact.
2. **Deck-Items mit Kartenanzahl in der Bibliothek** (mittel, 2-4h): `listDecks` API-Response um `cardCount` und `dueCount` erweitern.
3. **„Alle lernen"-Button in Kurs/Ordner-Detail** (mittel, 2-4h): Alle fälligen Karten des Kurses/Ordners laden und Learn-Screen damit starten.
