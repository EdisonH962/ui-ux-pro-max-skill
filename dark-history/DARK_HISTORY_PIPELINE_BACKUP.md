# Dark History TikTok Pipeline — vollständiges Backup-Rezept

Stand: 03.09.2026 · Kanal: @coldfacts71 · Schema: **Higgsfield-only** (kein ElevenLabs,
keine eigene Musik — beschlossen nach Skript 3, weil ElevenLabs-Credits aufgebraucht waren
und der Nutzer das neue Schema explizit als dauerhaft bevorzugt: "wir behalten dieses
schema higgsfield ist besser").

Dieses Dokument ist bewusst so geschrieben, dass eine komplett neue Session (ohne
Gedächtnis an diese Unterhaltung) damit von null auf ein fertiges, gepostetes Video bauen
kann. Alles Rot-Markierte ("BUG") ist ein Fehler, der real aufgetreten ist — nicht
theoretisch.

Bereits fertiggestellt mit diesem Schema: Skript 3 (Radium Girls), Skript 4 (Kaspar
Hauser), Skript 5 (Mary Celeste), Skript 6 (Flannan Isles), Skript 7 (Molasses Flood),
Skript 8 (Green Children of Woolpit), Skript 9 (Somerton Man), Skript 10 (Princes in the
Tower), Skript 11 (Voynich Manuscript), Skript 12 (Tunguska Event), Skript 13 (Devil's
Footprints), Skript 14 (Amber Room), Skript 15 (Mad Gasser of Mattoon). Skript 1+2
(Hinterkaifeck, Dancing Plague) liefen noch mit dem alten ElevenLabs-Schema.

**Update 04.09.2026:** Skripte 6-10 liefen alle nach exakt diesem Schema durch — die
einzigen Probleme waren Anker-Wort-Treffer (siehe Abschnitt 3.2, Punkte 2+3, neu
ergänzt), nie die Rendering-Pipeline selbst. Ein einziges Bild (Skript 10, Szene 1) blieb
einmal mehrere Minuten in `generate_image_batch` auf "in_progress" hängen — einfach mit
gleichem Prompt neu angestoßen, lief beim zweiten Versuch normal durch (~15s).

**Update 04.09.2026 (zweite Runde):** Skripte 11-15 liefen ebenfalls alle sauber durch,
mit zwei weiteren Anker-Fallen (Abschnitt 3.2 um Punkt 3b/3c ergänzt): ein ungewöhnlicher
Ortsname ("Mattoon") und eine britisch/amerikanisch unterschiedlich geschriebene
Maßeinheit ("tonnes" → von Whisper als "tons" erkannt). Beide Male reichte ein Tausch
gegen ein Nachbarwort im selben Satz, Pipeline neu ab `python3 align.py` gestartet, alle
Downloads blieben erhalten. In 8 von 10 Fällen liefen alle 7 Anker beim ersten Versuch
durch — die Anker-Falle ist der einzige wiederkehrende Reibungspunkt im ganzen Schema.

---

## 0. Grundregeln (aus der Original-Checkliste des Nutzers)

- **Originalitätsregel:** eigenes Skript, eigene Bilder, eigene Stimme. Keine fremden
  Clips, keine Photo-Mode-Slideshow.
- **CTA-Pflicht (ab Skript 3):** Jedes Skript endet gesprochen mit einem Like/Follow-Aufruf.
  Fester Text, der ans Ende des Voiceover-Prompts angehängt wird:
  > "If this one got you, follow for more stories like it, and leave a like."
- Format 1080×1920 (9:16), Ziel-Länge grob 60–95 s (muss über 60 s für TikTok Creator
  Rewards).
- Jedes Bild: `no people` im Prompt (Originalitätsregel — keine KI-Personen, die echten
  Personen ähneln könnten), cinematic photorealistic, muted/desaturated, subtle film grain,
  "ominous true-crime documentary mood".

---

## 1. Bilder — `generate_image_batch`

Modell: `nano_banana_2` (routet manchmal intern auf `nano_banana_flash`, optisch
konsistent). `aspect_ratio: "9:16"`. 8 Requests parallel, ein `index` pro Szene aus der
Bildliste.

Prompt-Muster pro Szene:
```
<Motiv aus der Bildliste>, cinematic photorealistic still, muted desaturated colors,
subtle film grain, ominous true-crime documentary mood, no people
```
Für Szenen vor Erfindung der Fotografie (z. B. Kaspar Hauser 1828, Mary Celeste 1872 für
das Schiffsmotiv): stattdessen ein Gravur-/Lithographie-Stil anfordern, z. B.
`"Historical 19th century engraving illustration ..., period lithograph art style, sepia
and grey tones ... no photorealistic elements"`.

Danach: `jobs_wait` (max. 12 Jobs pro Aufruf, hier passen 8 Bilder + 1 Audio-Job locker in
einen Aufruf), bis `all_terminal: true`. Fehlgeschlagene Einzelbilder einfach mit demselben
Prompt erneut über `generate_image_batch` senden (kam einmal bei Skript 3 vor, lief beim
zweiten Versuch durch).

---

## 2. Voiceover — `generate_audio`

```
model: "seed_audio"
voice_type: "preset"
voice_id: "30fc8796-ceb6-4a66-b3a7-4a145ef7f346"   # Preset "Arthur", tiefe erzählende Stimme
prompt: "<komplettes Skript inkl. CTA-Satz am Ende>"
```
Kosten: sehr günstig (~0,5–1 Credit für ein komplettes ~85s-Skript, im Gegensatz zu
ElevenLabs' ~950 Credits pro Take).

Falls das Skript ein separates "Hook" (0–3s) UND einen eigenen "Voiceover"-Text hat, die
sich am Anfang teilweise überschneiden (kam bei Skript 5 vor): den Hook-Satz als
Eröffnung nehmen (er enthält oft eine zusätzliche pointierte Zeile, die im Voiceover-Text
fehlt) und danach den Voiceover-Text ab der ersten *neuen* Information fortsetzen —
nicht beides hintereinander sprechen lassen, das wirkt redundant.

---

## 3. Downloads + Ausrichtung + Rendering — ALLES IN EINEM `sandbox_exec`-Aufruf

**Kritischste Regel der ganzen Pipeline:** Die Higgsfield-Sandbox wird zwischen
`sandbox_exec`-Aufrufen sehr unzuverlässig recycelt — manchmal nach Sekunden, manchmal
überlebt sie mehrere Aufrufe. Verlass dich NIE darauf, dass eine Datei aus einem früheren
Aufruf noch da ist. Baue den kompletten Ablauf (Download → Whisper-Alignment →
ffmpeg-Audiomix → higgsedit-Build → Render → ffprobe-Check → Upload) als EINEN
zusammenhängenden Bash-Befehl mit `&&`/`;`-Verkettung und führe ihn mit
`background: true` aus. Danach mit kurzen Folgeaufrufen `cat status.txt` pollen.

**BUG (aufgetreten, gefixt):** Niemals den eigenen Befehl zusätzlich selbst mit `( ... ) &`
in eine Subshell packen, wenn `sandbox_exec` schon `background: true` bekommt — das ist
doppeltes Backgrounding. Das Tool trackt dann nur den äußeren Wrapper (der sofort fertig
ist), während die eigentliche Arbeit in einem verwaisten Kindprozess weiterläuft, der beim
nächsten Sandbox-Recycle sang- und klanglos stirbt, ohne dass `status.txt` je vollständig
wird. Der Befehl-String selbst ist bereits der Job — kein zusätzliches `&` davor setzen.

### 3.1 `align.py` — Whisper-Alignment + Szenen-Timing + Caption-Generierung + edit.js

Vollständiges, getestetes Template (Python 3, läuft in der Sandbox, `faster-whisper` ist
vorinstalliert):

```python
import json, re, subprocess
from faster_whisper import WhisperModel

model = WhisperModel("base.en", device="cpu", compute_type="int8")
segments, info = model.transcribe("voice.wav", word_timestamps=True, language="en")

words = []
for seg in segments:
    for w in seg.words:
        words.append((w.word.strip(), w.start, w.end))

ffdur = float(subprocess.check_output(
    ["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0","voice.wav"]
).decode().strip())

LEAD = 0.4   # Sekunden Stille vor Sprachbeginn (Video startet trotzdem sofort mit Bild 1)
TAIL = 0.8   # Sekunden Nachlauf/Fade am Ende
TOTAL = LEAD + ffdur + TAIL

# ANCHORS: pro Skript neu bestimmen — siehe Abschnitt 3.2 "Anker-Wörter wählen"
ANCHORS = ["wort1", "wort2", "..."]          # N Anker -> N+1 Szenen
SCENE_FILES = ["01.png", "02.png", "..."]     # muss len(ANCHORS)+1 Einträge haben,
                                               # in der Reihenfolge, wie sie im Video erscheinen sollen
                                               # (NICHT zwingend die Download-Reihenfolge!)

def norm(w):
    return re.sub(r"[^a-z]", "", w.lower())

anchor_times = []
ptr = 0
for a in ANCHORS:
    found = None
    for i in range(ptr, len(words)):
        if norm(words[i][0]) == a:
            found = words[i][1]
            ptr = i + 1
            break
    if found is None:
        raise SystemExit(f"ANCHOR_NOT_FOUND:{a}")
    anchor_times.append(found)

scene_starts = [0.0] + [t + LEAD for t in anchor_times]
scene_ends = scene_starts[1:] + [TOTAL]
scenes = []
for f, s, e in zip(SCENE_FILES, scene_starts, scene_ends):
    scenes.append({"file": f, "at": round(s, 3), "dur": round(e - s, 3)})

# Captions: 2-3 Wörter / max ~20 Zeichen pro Chunk, neue Gruppe bei Sprechpause > 0.55s
chunks, cur = [], []
for (w, s, e) in words:
    if cur and (s - cur[-1][2] > 0.55 or sum(len(x[0]) + 1 for x in cur) >= 20 or len(cur) >= 3):
        chunks.append(cur); cur = []
    cur.append((w, s, e))
if cur:
    chunks.append(cur)

captions = []
for i, ch in enumerate(chunks):
    txt = " ".join(w for w, _, _ in ch)
    at = ch[0][1] + LEAD
    end = ch[-1][2] + LEAD
    nxt = chunks[i + 1][0][1] + LEAD if i + 1 < len(chunks) else TOTAL
    dur = min(end - at + 0.15, nxt - at - 0.02)
    dur = max(dur, 0.2)
    captions.append({"text": txt, "at": round(at, 3), "dur": round(dur, 3)})

json.dump({"total": TOTAL, "scenes": scenes, "captions": captions}, open("timing.json", "w"), indent=2)

# --- edit.js generieren (echte higgsedit-API, siehe Abschnitt 4 — KEIN JSX, plain JS!) ---
lines = []
lines.append('/** @type {import("./fable").BuildScript} */')
lines.append('export default async function edit({ project, text, rect, media }) {')
lines.append('  const p = await project({ size: "1080x1920", fps: 30, background: "#000000" });')
lines.append('  const voice = await p.add("assets/vo_final.mp3");')
lines.append(f'  p.cut(voice, {{ at: 0, dur: {TOTAL:.3f} }});')
for i, sc in enumerate(scenes):
    lines.append(f'  const img{i} = await p.add("assets/{sc["file"]}");')
for i, sc in enumerate(scenes):
    zoom_in = (i % 2 == 0)
    frm, to = (1.0, 1.12) if zoom_in else (1.12, 1.0)
    lines.append(
        f'  p.compose(media({{ file: img{i}, x: 0, y: 0, width: 1080, height: 1920, '
        f'fit: "cover", animate: [{{ property: "scale", from: {frm}, to: {to}, at: 0, '
        f'duration: {sc["dur"]:.3f}, easing: "linear" }}] }}), '
        f'{{ dur: {sc["dur"]:.3f}, at: {sc["at"]:.3f}, name: "scene-{i}" }});'
    )
for cap in captions:
    safe = json.dumps(cap["text"])
    lines.append(
        f'  p.compose(text({safe}, {{ y: 1480, width: 940, align: "center", '
        f'fontFamily: "Anton", fontSize: 78, color: "#ffffff", lineHeight: 1.1, '
        f'shadow: {{ x: 0, y: 3, blur: 10, color: "rgba(0,0,0,0.85)" }} }}), '
        f'{{ dur: {cap["dur"]:.3f}, at: {cap["at"]:.3f} }});'
    )
lines.append(
    f'  p.compose(rect({{ x: 0, y: 0, width: 1080, height: 1920, fill: "#000000", '
    f'animate: [{{ property: "opacity", from: 0, to: 1, at: 0, duration: 0.6 }}] }}), '
    f'{{ dur: 0.6, at: {TOTAL-0.6:.3f} }});'
)
lines.append('}')
open("edit_generated.js", "w").write("\n".join(lines))
print(f"ALIGN_OK total={TOTAL:.3f} scenes={len(scenes)} captions={len(captions)}")
```

### 3.2 Anker-Wörter wählen (pro Skript neu, manuell)

Für N Bild-Szenen braucht man N−1 Anker-Wörter (Übergangspunkte). Regeln, die sich
bewährt haben:

1. Wähle für jeden Szenenübergang das **erste Wort des neuen Gedankens**, das im
   *gesamten* Skript-Text (inkl. CTA!) garantiert **nur einmal** vorkommt.
2. **Keine Zahlwörter/Ordinalzahlen** als Anker (z. B. "Ten", "1828", **"fifteenth"**) —
   Whisper transkribiert Zahlen inkonsistent mal als Ziffern, mal als ausgeschriebene
   Wörter, das bricht den `norm()`-Vergleich. Trat real bei Skript 6 und 7 auf ("January
   fifteenth, 1919" → `ANCHOR_NOT_FOUND:fifteenth`), obwohl es ein ausgeschriebenes
   Ordinalwort war, kein Zahlzeichen.
3. **Keine zusammengesetzten/seltenen Wörter** als Anker (z. B. "oilskin",
   "codebreakers", "reburied") — Whisper (Modell `base.en`) transkribiert diese oft als
   zwei getrennte Tokens (z. B. "code breakers") oder gar nicht wie geschrieben, wodurch
   `norm()` keinen Treffer findet. Trat real bei Skript 6 ("oilskin" → `hooks`), Skript 9
   ("codebreakers" → `naval`) und Skript 10 ("reburied" → `westminster`) auf. Faustregel:
   nur gebräuchliche, einfache Alltagswörter oder Eigennamen als Anker verwenden, die man
   im Zweifel auch in einem Wörterbuch für Grundschulenglisch findet.
3b. **Vorsicht bei ungewöhnlichen Eigennamen** (Ortsnamen, Personennamen abseits
    gängiger Vornamen/Nachnamen) — z. B. "Mattoon" (Illinois) wurde von Whisper nicht
    erkannt. Bei kleinen/unbekannten Orts- oder Institutsnamen lieber ein Wort aus dem
    umgebenden Satz nehmen, das ein normales Alltagswort ist.
3c. **Britisch/amerikanische Schreib-/Ausspracheunterschiede meiden** — "tonnes" wurde
    von Whisper als "tons" erkannt (das Modell ist auf amerikanisches Englisch trainiert).
    Andere Kandidaten mit demselben Risiko: "colour"/"color", "metre"/"meter",
    "centre"/"center" — falls solche Wörter im Skript vorkommen, nicht als Anker nutzen.
3d. **Anker = erstes Wort des neuen Beats, NIE ein Wort vom Satzende — und die
    Vorwärtssuche vorher am Skripttext simulieren.** Zwei reale Fehler bei der
    Nachprüfung von Skript 16–30 (Whisper hatte alle Anker gefunden, `ALIGN_OK`, trotzdem
    war der Schnitt falsch):
    - Skript 24: Anker `case` und `against` sollten Szene 4 ("The case against her …")
      und Szene 5 ("Against that: no blood …") starten. Aber "case" und "against" stehen
      in "The case against her" DIREKT NEBENEINANDER — die Vorwärtssuche fand `against`
      sofort 0,3 s nach `case`. Ergebnis: Gerichtssaal-Bild 0,3 s, Wohnzimmer 37 s.
    - Skript 26/28: Anker `mountain` ("… the mountain opened.") bzw. `speak` ("… it
      began to speak.") standen am SATZENDE des Beats, nicht am Anfang — die Szene
      dauerte dadurch nur 1–2 s (bis zum nächsten Anker), das Bild blitzte nur auf.
    Regel: Für jeden Übergang das erste (oder zweite) Wort des neuen Absatzes nehmen,
    und vor dem Rendern die Suche deterministisch prüfen — Skripttext + CTA in Wörter
    splitten, `norm()` anwenden, die 7 Anker sequentiell ab `ptr` suchen und die
    Wortanzahl pro Szene ausgeben. Jede Szene unter ~8 Wörtern (≈3 s) ist verdächtig,
    1–4 Wörter sind ein Fehler. Das kostet 2 Sekunden und hätte alle drei Fälle vorab
    gefangen. Als Sicherheitsnetz nach dem Render: `ffmpeg -vf
    "select='gte(scene,0.08)',metadata=print"` liefert die Schnittzeitpunkte, daraus die
    Szenendauern berechnen — ohne `timing.json` aus der (recycelten) Sandbox.
4. Bei `ANCHOR_NOT_FOUND` (Fehler bricht `align.py` mit `set -e` sauber ab, bevor
   irgendetwas gerendert/hochgeladen wird): NICHT von vorne anfangen. Nur die betroffene
   Zeile in der bereits geschriebenen `align.py` in der Sandbox per `sed -i` patchen
   (ein Ersatzwort aus dem gleichen Satz wählen) und die Pipeline ab `python3 align.py`
   erneut anstoßen — Downloads und alle Bilder/Audio bleiben unangetastet erhalten,
   solange man im selben Sandbox-Fenster bleibt.
5. Prüfe Mehrfachvorkommen von Hand (z. B. "bag" kam bei Kaspar Hauser zweimal vor — kein
   Problem, weil die sequentielle Suche ab dem letzten Treffer weitersucht und so
   automatisch das *nächste* Vorkommen nimmt, aber im Zweifel ein eindeutigeres Wort
   wählen).
6. Die Bildreihenfolge in `SCENE_FILES` muss NICHT der Generierungs-Reihenfolge
   entsprechen — bei Kaspar Hauser wurden 8 Bilder generiert, aber in der Reihenfolge
   `["01.png","03.png","02.png","06.png","04.png","05.png","07.png","08.png"]` in die
   Timeline gesetzt, weil die Erzählung nicht linear zur Bildliste war.

### 3.3 Audio fertigstellen (ffmpeg) — läuft NACH `align.py`, VOR higgsedit

```bash
TOT=$(python3 -c "import json;print(json.load(open('timing.json'))['total'])")
FADEOUT=$(python3 -c "print($TOT-0.8)")
ffmpeg -y -v error -i voice.wav -af \
  "adelay=400|400,apad=pad_dur=0.8,afade=t=in:st=0:d=0.3,afade=t=out:st=${FADEOUT}:d=0.8" \
  -t $TOT assets/vo_final.mp3
```
Kein Musik-Mix mehr nötig (das war das alte ElevenLabs-Schema) — die Musik kommt jetzt
erst beim TikTok-Publish aus der Commercial Music Library (Abschnitt 6).

### 3.4 higgsedit — Projekt bauen und rendern

**BUG Nr. 1 (aufgetreten bei Skript 4, seither immer vorab gefixt):** `higgsedit fonts
list` zeigt "Anton" als eingebaute Schrift — das heißt aber NUR, dass sie ohne
Netzwerkzugriff vendort werden kann, NICHT dass sie automatisch verfügbar ist! Wird
`higgsedit fonts add <projekt> "Anton"` vergessen, rendert `higgsedit render --engine
node` den kompletten Clip klaglos mit einer Fallback-Schrift durch (kein Fehler, keine
Warnung im Render-Log) — der Bug fällt erst auf, wenn man testweise `higgsedit frame`
aufruft, was bei fehlender Schrift hart abbricht. **Deshalb: `fonts add` IMMER direkt
nach `init` und VOR `build` ausführen, nie danach prüfen.**

**BUG Nr. 2 (aufgetreten bei Skript 4, seither vermieden):** `higgsedit frame <dir>
<sekunden> --out <pfad>` hängt den `--out`-Pfad intern per `path.join()` (nicht
`path.resolve()`) an das Projektverzeichnis an. Ein absolut aussehender Pfad wie
`/home/user/proj/renders/proof.png` landet dadurch bei
`/home/user/proj/home/user/proj/renders/proof.png` — verdoppelt! **Deshalb: bei
`higgsedit frame`/`render`/`build` IMMER nur relative Pfade verwenden** (z. B.
`renders/proof.png`), nie absolute.

**BUG Nr. 3 (aufgetreten bei Skript 19+20, seither immer vorab gefixt):** `higgsedit
init <dir> ...` MUSS die Größe/FPS-Flags bekommen (`higgsedit init <dir>` ganz ohne
Flags bricht mit `Error: higgsedit init <dir>` ab). Wichtiger: `higgsedit build
<edit.js>` löst die `"assets/..."`-Pfade IM SCRIPT relativ zum aktuellen Arbeitsverzeichnis
auf, NICHT relativ zum Projektverzeichnis, das man als Pfad übergibt! Läuft `build` aus
`/home/user/work<N>` heraus (auch mit absolutem Pfad zum `edit.js`), sucht es die Assets
unter `/home/user/work<N>/assets/...` und bricht mit `Error: not a file:
.../assets/vo_final.mp3` ab, obwohl die Datei unter `/home/user/proj<N>/assets/` liegt.
**Deshalb: vor `build` UND `render` IMMER erst `cd /home/user/proj<N>` ausführen, dann
nur mit relativen Pfaden arbeiten (`edit.js`, `.`, `renders/final.mp4`).**

Korrekte Befehlsreihenfolge:
```bash
rm -rf /home/user/proj
higgsedit init /home/user/proj --size 1080x1920 --fps 30    # Flags nicht vergessen (Bug 3)!
mkdir -p /home/user/proj/assets
cp assets/*.png assets/vo_final.mp3 /home/user/proj/assets/
cp edit_generated.js /home/user/proj/edit.js
higgsedit fonts add /home/user/proj "Anton"        # VOR build, nicht vergessen!
cd /home/user/proj                                 # WICHTIG (Bug 3) — sonst findet build die Assets nicht
higgsedit build edit.js
higgsedit render . --engine node --out renders/final.mp4   # Node-Engine = ~4x schneller als Chrome
```
`--engine node` teilt den Render automatisch in Shards auf (bei ~85s Video: 3
Worker-Prozesse, je ~14–30s CPU-Zeit, insgesamt 1–3 Minuten).

**BUG Nr. 4 (Upload nach media_upload):** Der `curl -X PUT`-Upload zur presigned
S3-URL schlägt mit `403 SignatureDoesNotMatch` fehl, wenn der `Content-Type`-Header
fehlt — die Signatur ist über `content-type;host` gebildet (siehe
`X-Amz-SignedHeaders`), ein PUT ohne den Header (z. B. `curl -X PUT --upload-file ...`
ohne `-H`) liefert eine andere Signatur-Basis. **Deshalb IMMER exakt** `curl -X PUT -H
"Content-Type: video/mp4" --upload-file final.mp4 "<upload_url>"` **verwenden** — der
Content-Type muss zum `content_type`-Wert passen, den man beim `media_upload`-Aufruf
angegeben hat (steht auch in dessen `instructions`-Feld).

---

## 4. Die echte higgsedit-Skript-API (fable.d.ts) — Kurzreferenz

Ein Edit ist **plain JavaScript** (`.js`/`.mjs`), **kein JSX** nötig. Datei exportiert eine
`async function edit({ project, text, rect, media, group, ... })`.

Wichtigste Methoden von `p = await project({...})`:
- `p.add(file)` → `Handle` (Bild/Video/Audio importieren, gibt Referenz zurück, kein Pfad)
- `p.cut(handle, {at, from, dur, fit})` → Footage auf die "Spine" (Hauptspur) legen.
  Funktioniert genauso für audio-only Dateien (nur Ton, kein Bild) — perfekt für die
  durchgehende Voiceover-Spur.
- `p.compose(node | node[], {dur, at, name})` → EIN Overlay/Beat oberhalb der Spine, mit
  eigener Startzeit/Dauer. Für jede Bild-Szene UND jeden Caption-Chunk ein eigener
  `compose()`-Aufruf. Später deklarierte `compose()`-Calls liegen optisch über früheren
  (deshalb: erst alle Bild-Szenen, dann alle Captions deklarieren).
- `p.render(out, {draft, shards, concurrency})` — NICHT im Skript aufrufen, wenn man
  danach separat `higgsedit render --engine node` per CLI nutzen will (die CLI-Variante
  ist die schnelle Node-Engine; ein `p.render()` im Skript würde vermutlich die
  langsamere Chrome-Engine nutzen).
- `p.frame(time, out)` — einzelnes Frame als PNG rendern (Debug/Proof).

Node-Fabriken (zweites Argument von `ctx`, direkt in `p.compose()` verwendbar):
- `media({file, x, y, width, height, fit: "cover", animate: [...]})` — Ken-Burns-Zoom via
  `animate: [{property:"scale", from:1.0, to:1.12, at:0, duration:<szenendauer>,
  easing:"linear"}]`. Reine 2D-Skalierung, im Compositor um die Mitte, Überstand wird
  automatisch vom Canvas abgeschnitten.
- `text(content, {y, width, align, fontFamily, fontSize, color, lineHeight, shadow:
  {x,y,blur,color}})` — **kein natives Stroke/Outline-Property!** Der "Kontur"-Look wird
  über einen kräftigen `shadow` simuliert (z. B. `blur:10, color:"rgba(0,0,0,0.85)"`),
  keine echte Outline. `x` weglassen = horizontal zentriert in der Szene.
- `rect({x,y,width,height,fill,animate})` — für den Fade-to-Black am Ende (Rechteck über
  alles, `opacity` 0→1 gegen Ende der Timeline).

Eingebaute Fonts ohne Netzwerk (aber IMMER erst `fonts add` nötig!): Anton, Archivo
Black, Bebas Neue, Caveat, DM Sans, Inter, ... (`higgsedit fonts list` für die volle
Liste).

---

## 5. Verifikation vor dem Upload

```bash
ffprobe -v error -show_entries format=duration:stream=codec_type,codec_name,width,height,r_frame_rate \
  -of default=noprint_wrappers=0 /home/user/proj/renders/final.mp4
```
Erwartete Werte: `width=1080 height=1920`, `codec_name=h264` (Video) + `codec_name=aac`
(Audio), Dauer > 60s.

Ein einzelnes kleines Proof-Frame (nicht mehrere/Kontaktabzug — größere Sammelbilder
kommen bei der Chat-Übertragung beschädigt an):
```bash
higgsedit frame /home/user/proj 42 --out renders/proof.png   # relativer Pfad! (Bug 2)
convert renders/proof.png -resize 140x -quality 40 renders/proof_small.jpg
```
Dann `base64 -w0 proof_small.jpg` im Sandbox-Call ausgeben, lokal dekodieren, **MD5
gegenprüfen** bevor man das Bild ansieht (Transfer kann bei größeren Dateien korrumpieren).

---

## 6. Upload + TikTok-Publish

### 6.1 Video hochladen
```
media_upload(filename: "<name>.mp4", content_type: "video/mp4")
→ liefert upload_url (presigned S3 PUT, 24h gültig) + media_id + finale CloudFront-url
```
Im selben (!) `sandbox_exec`-Aufruf, der auch rendert, am Ende:
```bash
curl -f -X PUT -H "Content-Type: video/mp4" --upload-file /home/user/proj/renders/final.mp4 '<upload_url>'
```
Danach vom Haupt-Thread aus: `media_confirm(media_id, type: "video")`.

**Wichtig:** Die fertige MP4-Datei kann NICHT direkt in den Chat geliefert werden — der
CloudFront-Host von Higgsfield ist für den lokalen Sandbox-Netzwerkzugriff gesperrt
(bestätigter Dauerzustand, kein Zufallsfehler). Nur der Link funktioniert, im Browser des
Nutzers.

### 6.2 TikTok-Account
```
tiktok_accounts()  → liefert connector_id (bei @coldfacts71 aktuell:
                      ee2623ee-62e9-4b20-9883-60effd5b52b8, Status "active")
```
Falls Status "error": `tiktok_reconnect`. Falls keine Accounts: `tiktok_connect`
(liefert eine Autorisierungs-URL, die der Nutzer im Browser bestätigen muss).

### 6.3 Musik aus der TikTok Commercial Music Library
```
tiktok_music_trending(connector_id, genre: "EPIC", limit: 6)
```
Dem Nutzer 3-4 Tracks zur Auswahl vorlegen (per AskUserQuestion). Bereits verwendete
Tracks (nicht zwingend wechseln, aber Abwechslung schadet nicht):
- Skript 3: Falling Skies – Trailerhead
- Skript 4: Glory Seeker – Trailerhead
- Skript 5: Serenata Immortale – Trailerhead
(alle aus Genre "EPIC" — Alternativen im selben Genre: Invictus, Nirvana, "BGM for game
battle...")

### 6.4 Publish-Flow
```
tiktok_prepare_publish(connector_id, mode:"DIRECT_POST", media_type:"VIDEO",
                        video_url:<CloudFront-url aus media_upload>, title:<Caption ≤150 Zeichen>,
                        privacy_level:"PUBLIC_TO_EVERYONE", allow_comment/duet/stitch:true,
                        is_aigc:true)
→ liefert publish_session_id + required_confirmations-Liste

tiktok_publish(connector_id, publish_session_id, mode, media_type, title,
               privacy_level:"PUBLIC_TO_EVERYONE", allow_comment/duet/stitch:true, is_aigc:true,
               commercial_content_disclosure:{enabled:false, your_brand:false, branded_content:false},
               music_sound_id:<song_clip_id aus tiktok_music_trending>,
               music_sound_volume:15, video_original_sound_volume:100,
               user_confirmed:true, preview_confirmed:true, music_usage_confirmed:true,
               processing_notice_acknowledged:true, privacy_level_selected_by_user:true,
               interaction_settings_selected_by_user:true,
               commercial_content_disclosure_selected_by_user:true)
→ liefert publish_id

tiktok_publish_status(connector_id, publish_id)   # Status "PROCESSING_DOWNLOAD" ist normal,
                                                    # TikTok braucht ein paar Minuten
```
`music_sound_volume: 15` entspricht der Vorgabe "max. 15% Lautstärke unter der Stimme"
aus der Original-Checkliste; `video_original_sound_volume: 100` lässt die Stimme voll
durch.

---

## 7. Checkliste für ein neues Skript (Kurzfassung)

1. Vollständigen Skript-Text (inkl. CTA anhängen!) + Bildliste vom Nutzer holen/haben.
2. 8 Bild-Prompts nach dem Muster aus Abschnitt 1 bauen, `generate_image_batch`.
3. `generate_audio` mit `seed_audio` + Voice-ID "Arthur", kompletter Text inkl. CTA.
4. `jobs_wait` bis alle fertig, fehlgeschlagene Bilder einzeln neu anstoßen.
5. `media_upload` für den Ziel-Dateinamen → Upload-URL merken.
6. Anker-Wörter von Hand aus dem Skript-Text bestimmen (Abschnitt 3.2).
7. EINEN großen `sandbox_exec`-Aufruf mit `background:true` bauen: Downloads → `align.py`
   (mit den neuen ANCHORS/SCENE_FILES) → ffmpeg → higgsedit init → **fonts add** → build →
   render (relative Pfade!) → ffprobe → proof frame (relativer Pfad!) → curl-Upload.
8. Mit kurzen Folgeaufrufen `status.txt` pollen bis "DONE".
9. `media_confirm`, Proof-Frame per base64 holen, MD5 prüfen, ansehen.
10. `tiktok_accounts` → `tiktok_music_trending` → Nutzer Track wählen lassen
    (AskUserQuestion) → `tiktok_prepare_publish` → `tiktok_publish` → `tiktok_publish_status`.

---

## 8. Bereits verbrauchte IDs / Referenzen (Stand 03.09.2026)

- TikTok connector_id (@coldfacts71): `ee2623ee-62e9-4b20-9883-60effd5b52b8`
- Higgsfield Voice-Preset "Arthur": `30fc8796-ceb6-4a66-b3a7-4a145ef7f346`
- Bildmodell: `nano_banana_2` (Fallback-Routing manchmal auf `nano_banana_flash`)
- Sprachmodell: `seed_audio` (ByteDance Seed Audio 1.0)
