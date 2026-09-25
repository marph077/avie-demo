/* Anzeige-Logik des Gespraechsbildschirms (Welle F, F2: Kern zuerst,
   F-11). Bis F2 in index.html (TOPICS, openTopicSheetNew, addMsg, mdToHtml,
   now, felieAnfrageFehler); die Webapp nutzt sie mit, die App baut darauf.
   Nur Daten und Text - wie etwas aussieht (Kachelfarbe, HTML, native
   Textteile), entscheidet die Oberflaeche.

   Tests: tests/felie-f2-anzeige.test.cjs (vor dem Umzug geschrieben). */

import { cycleDayPart, cycleRefresh, felieZyklusLesen } from './zyklus.js';
import { felieBaueAltSicht } from './signale.js';

/* ── Themen ─────────────────────────────────────────────────────── */
/* Eine einzige Themenliste (AL-46). Das Themen-Sheet baut daraus, der Kopf
   des Gespraechs sucht darin ueber den key. "msg" ist der versteckte
   Einstieg, den felie beantwortet; "eroeffnung" ist ein fester Satz der App
   fuer die Faelle, in denen es nichts zu fragen gibt. Die Kachelfarbe
   gehoert der Oberflaeche (Webapp: TOPICS_FARBE; App: D5). */
export const FELIE_THEMEN = [
  { key: 'eigenes', icon: 'chat', name: 'Mein Thema',
    hint: 'Ich möchte etwas besprechen', msg: null,
    eroeffnung: 'Erzähl einfach, was gerade los ist.' },
  { key: 'bewegung', icon: 'run', name: 'Bewegung & Energie',
    /* Hinweis war "Training & Zyklusphase" (AL-47): aus einer Zyklusphase
       folgt laut K7 keine Leistungsfaehigkeit und keine Sportvorgabe - die
       Kachel versprach genau das, was der Prompt felie verbietet. */
    hint: 'Bewegung, die in deinen Tag passt',
    msg: 'Ich möchte über Bewegung und Energie sprechen' },
  { key: 'stress', icon: 'calm', name: 'Stress & Mental Load',
    /* Hinweis war "Nervensystem & Erholung" (AL-48): physiologische Rahmung
       fuer ein Alltagsthema. K6 nennt die Woerter, die hier passen -
       Erschoepfung, Ueberlastung, am Limit. */
    hint: 'Belastung & Erholung',
    msg: 'Ich möchte über meinen Stresslevel und Mental Load sprechen' },
  { key: 'zyklus', icon: 'bloom', name: 'Zyklus & Hormone',
    hint: 'Zyklus verstehen',
    msg: 'Ich möchte über meinen Zyklus und meine Hormone sprechen' },
  { key: 'schlaf', icon: 'moon', name: 'Schlaf & Erholung',
    /* Hinweis war "Schlafqualitaet verbessern" (AL-48): ein Wirkversprechen
       ueber eine Koerperfunktion. Die Kachel nennt jetzt das Thema, nicht
       sein Ergebnis. */
    hint: 'Abende, Nächte, Routinen',
    msg: 'Ich möchte über meinen Schlaf sprechen' },
  { key: 'ernaehrung', icon: 'bowl', name: 'Ernährung & Körper',
    /* Hinweis war "Zyklusbasiert essen" (AL-47), gleiche Begruendung. */
    hint: 'Essen im Alltag',
    msg: 'Ich möchte über Ernährung und meinen Körper sprechen' }
];

/* Die Themen, wie das Sheet sie zeigt. Dynamisch sind nur die beiden
   Hinweiszeilen, die von Live-Daten abhaengen (Zyklustag, Schlaf der
   letzten Nacht); aufgefrischt, sonst zeigte die Kachel den Zyklustag vom
   Tag der Eingabe. */
export function felieThemenListe() {
  var cd = null, mb = null;
  try { cd = cycleRefresh(); } catch (e) { cd = felieZyklusLesen(); }
  try { mb = felieBaueAltSicht(); } catch (e) { mb = null; }
  var hinweis = {};
  if (cd && !cd.stale) hinweis.zyklus = cd.phase + cycleDayPart(cd, ' · ');
  if (mb && mb.sleepStr) hinweis.schlaf = mb.sleepStr + ' letzte Nacht';
  return FELIE_THEMEN.map(function (t) {
    return { key: t.key, icon: t.icon, name: t.name, hinweis: hinweis[t.key] || t.hint, msg: t.msg, eroeffnung: t.eroeffnung };
  });
}

export function felieThema(key) {
  return FELIE_THEMEN.filter(function (t) { return t.key === key; })[0] || null;
}

/* ── Antworten aufbereiten ──────────────────────────────────────── */
/* [[NEED:body]] steht nicht mehr im Prompt. Der Marker wird nur noch
   herausgefiltert, falls das Modell ihn aus Gewohnheit setzt - sonst
   stuende die Zeichenfolge sichtbar im Gespraech. [[NEED:cycle]] meldet
   zyklusGewuenscht (Webapp: Knopf "Zyklus eintragen", App: ab F6). */
export function felieAntwortAufbereiten(roh) {
  var text = roh == null ? '' : String(roh);
  var zyklus = /\[\[NEED:cycle\]\]/i.test(text);
  text = text.replace(/\[\[NEED:(cycle|body)\]\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();
  return { text: text, zyklusGewuenscht: zyklus, teile: felieTextTeile(text) };
}

/* **fett** als Teile; Zeilenumbrueche bleiben im Text. Ein offenes ** ohne
   Gegenstueck bleibt Text (wie mdToHtml bisher). */
export function felieTextTeile(text) {
  var s = text == null ? '' : String(text), teile = [], re = /\*\*([^*]+)\*\*/g, stelle = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > stelle) teile.push({ text: s.slice(stelle, m.index), fett: false });
    teile.push({ text: m[1], fett: true });
    stelle = re.lastIndex;
  }
  if (stelle < s.length || !teile.length) teile.push({ text: s.slice(stelle), fett: false });
  return teile;
}

/* ── Uhrzeit, Fehlertext ────────────────────────────────────────── */
export function felieUhrzeit(d) {
  d = d || new Date();
  return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
}

export function felieAnfrageFehler(e) {
  return e && e.felieHinweis ? e.felieHinweis : 'Die Verbindung hat gerade nicht geklappt. Bitte versuche es noch einmal.';
}
