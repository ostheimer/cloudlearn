// Spiegel von apps/mobile/src/features/ads/adsMode.ts (#611).
//
// Belohn-Werbung ist nicht scharf: Sie braucht die AdMob-SSV-Rückrufadresse und
// die Produktions-Anzeigen-IDs (#149). Bis dahin zeigt die App eine ATTRAPPE,
// die KEINE Lernpunkte gibt.
//
// Warum das Web das wissen muss: Die LP-Seite listete „Werbung ansehen · +5 LP
// pro Video" als Weg zu neuen Punkten und schickte dafür in die App — also in
// einen Weg, der dort garantiert 0 LP liefert. Wer ihm folgte, hatte die App
// installiert und stand vor derselben leeren Hand.
//
// Bewusst eine Kopie und kein geteiltes Paket: App und Website werden getrennt
// ausgeliefert (vgl. #78). Damit die Kopie nicht heimlich veraltet, prüft
// ads-mode.test.ts die App-Datei und schlägt an, sobald die beiden Werte
// auseinanderlaufen.
//
// Umstellen auf true also NUR gemeinsam mit der App-Konstante.
export const REAL_ADS_ENABLED: boolean = false;
