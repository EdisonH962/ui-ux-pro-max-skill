# Frontline Squad

Cartoon-Team-Shooter im Browser: fünf Klassen, Bots, Team Deathmatch und Domination —
ohne Server, ohne Build-Schritt, ohne externe Assets.

Engine, Map, Modelle, Texturen, Sounds und UI sind vollständig eigenständig; Geometrie
und Texturen entstehen zur Laufzeit im Code.

## Starten

ES-Module brauchen HTTP — ein Doppelklick auf `index.html` (`file://`) reicht nicht:

```bash
cd projects/frontline-squad
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Läuft vollständig offline: three.js 0.186 liegt als Kopie in `vendor/` (MIT-Lizenz,
siehe `vendor/three-LICENSE.txt`), die benötigten Addons unter `vendor/addons/`.
Kein CDN, keine Bilddateien, keine Abhängigkeiten.

## Steuerung

| Aktion | Taste |
| --- | --- |
| Bewegen | `W` `A` `S` `D` |
| Zielen | Maus (Pointer Lock, Klick ins Bild) |
| Feuern | Linke Maustaste |
| Zielfernrohr (Sniper) | Rechte Maustaste |
| Springen | `Leertaste` |
| Sprint | `Shift` |
| Nachladen | `R` |
| Klassenfähigkeit | `Q` / `F` / `E` |
| Punktetafel | `Tab` (halten) |
| Pause | `Esc` |
| Klasse nach dem Tod wechseln | `1`–`5` |

Auf Touchgeräten erscheinen automatisch Stick, Blickfeld und Aktionsbuttons.

## Inhalt

**Klassen** — jede mit eigener Waffe, Statline und Fähigkeit:

| Klasse | Waffe | Fähigkeit |
| --- | --- | --- |
| Soldier | MK-7 Assault | Splittergranate |
| Gunner | Vulcan HMG (Anlaufzeit) | Bollwerk: 50 % Schadensreduktion |
| Medic | Vector SMG | Heilimpuls für alle Verbündeten im Umkreis |
| Sniper | Longshot R7 (Zoom) | Aufklärer-Puls: markiert Gegner durch Wände |
| Stealth | Breacher SG (Schrot) | Tarnfeld: fast unsichtbar, schneller; Feuern bricht die Tarnung |

**Modi** — Team Deathmatch (50 Abschüsse) und Domination (drei Punkte, 500 Tickets).
**Bots** — 4v4 bis 8v8, drei Schwierigkeitsgrade (Rekrut/Veteran/Elite).
**Map** — „Sandsturm-Basar": zwei Basen, zentraler Marktturm als umkämpfte Höhe,
zwei Innenhöfe als Flankenpunkte.
**Grafikstufen** — Niedrig/Mittel/Hoch im Menü; Touchgeräte starten automatisch auf Niedrig.

## Architektur

```
index.html          Importmap, HUD-Markup, Menü-/Pause-/Endscreen
css/style.css       HUD und Menü (Comic-Military-Look, responsive, Touch-Layout)
assets/             Drop-in-Punkt für echte Texturen (manifest.json), sonst leer
js/config.js        Balancing: Klassen, Waffen, Modi, Physik, Bot-Stufen
js/materials.js     Prozedurale Texturen und Materialbibliothek, UV-Skalierung pro Mesh
js/world.js         Map-Geometrie, Kollisionsboxen, Capture-Punkte, Navigationsgitter + A*
js/entities.js      Fighter-Basisklasse: Modell, Bewegung, Kollision, Hitscan, Fähigkeiten
js/player.js        Erste-Person-Kamera, Rückstoß, Viewmodel, Eingabeauswertung
js/bots.js          Bot-KI: Zielwahl, Wegfindung, Feuerdisziplin, Fähigkeitsnutzung
js/arena.js         Matchlogik: Trefferzone, Punkte, Killfeed, Granaten, Domination
js/fx.js            Gepoolte Effekte: Leuchtspur, Mündungsfeuer, Einschläge, Explosionen
js/hud.js           HUD, Minimap, Killfeed, Punktetafel, Endscreen
js/audio.js         Alle Sounds synthetisch über WebAudio erzeugt
js/main.js          Renderer, Menü, Matchaufbau, Spielschleife
```

### Mobiles Budget

Zielgerät ist das Handy, und dort limitieren **Draw Calls**, nicht Dreiecke. Gemessen im
Telefon-Viewport (390×844, dpr 2), Spiel läuft mit 12 Kämpfern:

| Stand | Draw Calls | Dreiecke |
| --- | --- | --- |
| vor der Optimierung | 234 | 36k |
| statische Geometrie gebatcht | 139 | 36k |
| Kämpfer auf ein Material verschmolzen | 100 | 39k |
| farbige Props mitgebatcht | 80 | 42k |

Drei Maßnahmen bringen das:

1. **`World.batchStatics()`** fasst alle unbeweglichen Teile pro Material zu je einem Mesh
   zusammen — aus 406 Einzelmeshes werden 12 Batches.
2. **Kämpfer** bestehen aus einem einzigen Material mit Vertex-Farben; nur die animierten
   Gruppen (Beine, Arme, Kopf, Waffe) bleiben getrennt. 24 Meshes pro Figur wurden 7.
3. **Einschusslöcher** liegen in einer `InstancedMesh` — beliebig viele Treffer kosten
   genau einen Draw Call.

Weil die Sichtprüfung nicht mehr gegen Mesh-Dreiecke laufen kann, sobald Geometrie
verschmolzen ist, testet `World.raycast()` die Kollisionsboxen analytisch (Slab-Methode).
Das ist für Quadergeometrie exakt und deutlich billiger — beim Aufbau des Wegnetzes
laufen mehrere tausend Sichtlinien durch diese Funktion.

### Grafikpipeline

Gerendert wird linear in ein Halbfloat-Target: `RenderPass` → Bloom → Vignette/Grade →
`OutputPass` (dort passieren Tone Mapping und Farbraum). Materialien sind `MeshStandard`
mit neutralem IBL aus `RoomEnvironment`, Sonne plus Hemisphärenlicht in physikalischen
Einheiten, ACES-Tone-Mapping bei Belichtung 0.95.

Aus jeder gezeichneten Textur werden zusätzlich eine **Normal-Map** (Sobel über die
Luminanz) und eine **Roughness-Map** abgeleitet. Deshalb hat Putz Relief und Ziegel
Fugentiefe, ohne dass eine einzige Bilddatei ausgeliefert wird. Kanten sind leicht
gefast (`RoundedBoxGeometry`), und eine **Umgebungsverschattung ist in Vertex-Farben
gebacken** — Kontaktverschattung ohne Laufzeitkosten, weil ein Screen-Space-Pass auf
Telefonen nicht im Budget liegt.

Jede Oberfläche bekommt ihre Textur aus `js/materials.js`, gezeichnet in ein Canvas und
kachelbar gemacht. Die UVs werden **pro Mesh** auf die Boxmaße umgerechnet
(`applyBoxUVs`), damit eine 30-Meter-Wand und eine 2-Meter-Kiste dieselbe Texeldichte
haben — sonst wirkt dieselbe Textur einmal grob und einmal verwaschen.

Die drei Grafikstufen greifen dort an, wo die Kosten wirklich liegen: Die niedrige Stufe
schaltet Schatten und IBL ab und rendert unterhalb der nativen Auflösung, weil das im
Messwert deutlich mehr bringt als das Abschalten der Post-Effekte allein.

### Technische Notizen

- **Navigationsgitter statt handgesetzter Wegpunkte.** `World.buildWaypoints()`
  rastert die Map in 3-Meter-Schritten ab, liest aus der Kollisionsliste jede
  Standfläche der jeweiligen Säule (Boden, Balkon, Dach), prüft Kopffreiheit und
  verbindet Nachbarn nur bei freier Sichtlinie. Größere Höhenunterschiede werden
  nur verbunden, wenn auf halbem Weg eine Zwischenstufe liegt — so entstehen
  Treppenverbindungen, aber keine unmöglichen Sprünge. A* läuft über einen
  Binärheap; Bots kürzen den Pfad zusätzlich per Sichtlinie ab.
- **Matrizen vor dem Raycast.** Die Navigation wird vor dem ersten Frame gebaut,
  darum wird `group.updateMatrixWorld(true)` explizit aufgerufen — sonst
  behandelt three.js jede Kollisionsbox als am Ursprung liegend.
- **Trefferberechnung** ist Hitscan mit zwei Boxen pro Figur (Kopf/Körper),
  Distanzabfall pro Waffe und Kopftreffer-Multiplikator; Schrot feuert neun
  Projektile pro Schuss.
- **Alle Sounds** entstehen aus Rauschpuffern und Oszillatoren — keine Audiodateien.

## Balancing anpassen

Alles Spielrelevante steht in `js/config.js`: Schaden, Feuerrate, Magazin,
Streuung, Reichweite und Abfall pro Waffe, HP und Tempo pro Klasse, Abklingzeiten,
Respawn-Zeit, Punktelimits und Bot-Zielgenauigkeit. Datei speichern, Seite neu
laden — kein Build.
