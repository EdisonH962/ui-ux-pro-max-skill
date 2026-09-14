# Blitz Brigade — Open Remake

Ein spielbarer Nachbau des 2019 abgeschalteten Gameloft-Shooters *Blitz Brigade*:
Cartoon-Team-Shooter, fünf Klassen, Team Deathmatch und Domination, komplett im
Browser, ohne Server, ohne Build-Schritt.

**Nichts davon stammt von Gameloft.** Engine, Map, Modelle, Sounds und UI sind neu
geschrieben bzw. zur Laufzeit prozedural erzeugt. Es ist ein inoffizielles,
nicht-kommerzielles Fanprojekt.

## Starten

ES-Module brauchen HTTP — ein Doppelklick auf `index.html` (`file://`) reicht nicht:

```bash
cd projects/blitz-brigade-remake
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Läuft vollständig offline: three.js liegt als Kopie in `vendor/` (MIT-Lizenz,
siehe `vendor/three-LICENSE.txt`). Kein CDN, keine Assets, keine Abhängigkeiten.

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

## Architektur

```
index.html          Importmap, HUD-Markup, Menü-/Pause-/Endscreen
css/style.css       HUD und Menü (Comic-Military-Look, responsive, Touch-Layout)
js/config.js        Balancing: Klassen, Waffen, Modi, Physik, Bot-Stufen
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
