/* Store, Revision, Bereinigen und der dauerhafte Datensatz - seit
   Welle D, Paket D1b, ein Kern-Modul.

   Bis D1b standen diese Teile in index.html und hielten ihren Zustand in
   window._felieStore, _felieRev, _felieDatensatz und
   _felieDatensatzVerworfen. Jetzt ist das Modulzustand; wer ihn von aussen
   braucht, nimmt die Zugriffsfunktionen am Ende der Datei. Gelesen und
   geschrieben wird ueber den Speicher-Port (speicher.js).

   Der urspruengliche Wortlaut folgt unveraendert; geaendert sind nur die
   Zugriffe auf window und localStorage. */

import { FELIE_STORE_KEY, FELIE_DATENSATZ_KEY, felieSpeicherLesen, felieSpeicherSchreiben, felieSpeicherStandMerken } from './speicher.js';
import { felieRepoKlon } from './repository.js';

let store = null;
let rev = 0;
let datensatz = null;
let datensatzVerworfen = false;

export const FELIE_AUFBEWAHRUNG = 365 * 24 * 60 * 60 * 1000;

export function felieStore() {
  if (!store) {
    store = { version: 1, signale: [], fakten: [], episoden: [], zusatz: {} };
  }
  return store;
}

/* Jede Aenderung erhoeht die Revision. Der abgeleitete View cached
   darauf, damit haeufige Lesezugriffe nicht jedes Mal neu rechnen. */
/* Seit D1b: der Cache des Views (manualBodyData) liegt in der Webapp und
   vergleicht die Revision selbst. Ihn hier zusaetzlich zu leeren war
   doppelt und faellt weg. */
export function felieRevision(inkrement) {
  if (inkrement) rev = rev + 1;
  return rev;
}

export function felieBereinigen() {
  var jetzt = Date.now();
  var s = felieStore();

  /* Signale: harte Frist auf den Messzeitpunkt, keine Verlaengerung. */
  s.signale = s.signale.filter(function(e) { return (jetzt - e.ts) <= FELIE_AUFBEWAHRUNG; });

  /* Fakten: Frist laeuft auf bestaetigtAm. Stabile Fakten verfallen
     nicht durch Nichterwaehnung. */
  s.fakten = s.fakten.filter(function(f) {
    if (f.klasse === 'stabil') return true;
    return (jetzt - (f.bestaetigtAm || f.erfasstAm)) <= FELIE_AUFBEWAHRUNG;
  });

  /* Episoden: ein abgelaufener Faden wird NICHT mehr automatisch
     geschlossen. Er bleibt offen stehen, wird im Gedaechtnis ausgegraut
     und fragt dort "Noch aktuell?" — ueber das Ende eines persoenlichen
     Themas entscheidet die Nutzerin, nicht eine Frist. Aus dem Kontext
     fuer das Modell faellt er trotzdem heraus: dafuer sorgt der Filter
     nurAktuell in felieEpisoden(), damit felie nichts von sich aus
     aufgreift, dessen Zeit um ist.
       Nur ausdruecklich geschlossene Faeden verfallen nach der Frist. */
  s.episoden = s.episoden.filter(function(e) {
    return e.status === 'offen' || (jetzt - e.zuletztAm) <= FELIE_AUFBEWAHRUNG;
  });

  felieRevision(true);
}

/* ── Persistenz ───────────────────────────────────────────────────── */

export function felieStoreSpeichern() {
  try { felieSpeicherSchreiben(FELIE_STORE_KEY, JSON.stringify(felieStore())); return true; } catch (e) { return false; }
}

export function felieStoreLaden() {
  try {
    var d = JSON.parse(felieSpeicherLesen(FELIE_STORE_KEY) || 'null');
    if (d && d.version === 1) {
      store = {
        version: 1,
        signale:  d.signale  || [],
        fakten:   d.fakten   || [],
        episoden: d.episoden || [],
        zusatz:   d.zusatz   || {}
      };
      felieRevision(true);
      felieBereinigen();
      /* Erst jetzt, mit geladener Projektion: der Datensatz vergleicht
         seinen Fingerabdruck gegen genau diese Listen. */
      try { felieDatensatzLaden(); } catch (e) {}
      return true;
    }
  } catch (e) {}
  /* Kein Altstand: ein Datensatz kann trotzdem vorliegen (geleerte
     Projektion, zurueckgespielte Sicherung). */
  try { felieDatensatzLaden(); } catch (e) {}
  return false;
}

/* ── Der Datensatz bleibt — M6 ────────────────────────────────────────
   Bis M5 war die Bruecke je Speichervorgang zustandslos: saeen, Befehle
   anwenden, zurueckprojizieren, verwerfen. Was der Vertrag traegt und die
   Altform nicht kennt — Revisionen, Belege, Sperren, Hinweise — entstand
   dabei jedes Mal neu aus zwei flachen Listen und war danach wieder weg.
   Genau das machte die Sperre nachrichtengenau statt aussagegenau: ohne
   dauerhafte Revisionen gibt es nichts, woran eine Ableitung haengen
   koennte (Pruefaelle F06, F13, F14).

   Jetzt bleibt der GEDAECHTNISTEIL des Datensatzes bestehen. Gespraeche
   und Nachrichten werden weiterhin je Vorgang aus felie_saved_chats
   gesaet: dort liegt der Bestand, den das Archiv anzeigt, und zwei
   Wahrheiten darueber waere genau der Fehler, den dieses Paket
   beseitigt. Belege zeigen auf Nachrichten-Kennungen, die sich aus
   Gespraechskennung und Position ergeben — verschiebt sich eine
   Position, faellt der Beleg weg, statt ueber Textgleichheit neu
   zugeordnet zu werden (F45). */

export function felieDatensatzTeile() {
  return ['entries', 'revisions', 'evidence', 'exclusions', 'conflicts',
    'changeNotices', 'mutationReceipts', 'importRecords', 'legacyHerkunft'];
}

/* Was nach einem Vorgang bestehen bleibt. Bewusst ohne Gespraeche,
   Nachrichten und Zusammenfassungen. */
export function felieDatensatzMerken(d) {
  if (!d) return null;
  var k = { meta: d.meta, profileBase: d.profileBase, referents: d.referents };
  felieDatensatzTeile().forEach(function (t) { k[t] = d[t]; });
  datensatz = felieRepoKlon(k);
  return datensatz;
}

/* Der dauerhafte Teil wird SYNCHRON geschrieben, im selben Block wie die
   Projektion. Damit gilt fuer beide dasselbe Alles-oder-nichts: der
   vorhandene catch stellt im Fehlerfall alle Schluessel zurueck. Ein
   asynchroner Schreibweg daneben koennte genau hier auseinanderlaufen —
   sichtbarer Stand geschrieben, Datensatz nicht — und der naechste Start
   wuerde stillschweigend mit dem aelteren Gedaechtnis weiterarbeiten. */
/* Fingerabdruck der Projektion, die zu diesem Datensatz gehoert. Er
   beantwortet eine einzige Frage beim Start: hat seither jemand die
   flachen Listen geschrieben, der den Datensatz nicht kennt? Das kann ein
   aelterer Client sein, eine zurueckgespielte Sicherung aus der Zeit
   davor oder ein Eingriff von Hand. In all diesen Faellen waere es
   falsch, den gehaltenen Datensatz weiter als Wahrheit zu nehmen: er
   wuerde die neueren sichtbaren Angaben stillschweigend verdraengen
   (Pruefaelle F32, F34, F42). */
export function felieProjektionAbdruck() {
  try {
    var st = felieStore();
    var kurz = function (liste) {
      return (liste || []).map(function (e) {
        return [e.id, e.text, e.bestaetigtAm || '', e.quelle || ''].join('~'); }).sort().join('|');
    };
    return kurz(st.fakten) + '#' + kurz(st.episoden);
  } catch (e) { return null; }
}

export function felieDatensatzSpeichern() {
  var k = felieDatensatzStand();
  if (!k) return false;
  k.projektionsAbdruck = felieProjektionAbdruck();
  felieSpeicherSchreiben(FELIE_DATENSATZ_KEY, JSON.stringify(k));
  return true;
}

export function felieDatensatzLaden() {
  try {
    var roh = felieSpeicherLesen(FELIE_DATENSATZ_KEY);
    if (!roh) return false;
    var k = JSON.parse(roh);
    if (!k || !k.meta || k.meta.schemaVersion !== 2 || !Array.isArray(k.entries)) return false;
    /* Neuer als der Datensatz heisst: der Datensatz ist nicht mehr die
       Wahrheit. Dann wird er verworfen und beim naechsten Vorgang aus dem
       sichtbaren Stand neu aufgebaut — die Angaben der Nutzerin bleiben,
       die Revisionshistorie geht verloren. Das ist der ehrliche Preis;
       das Gegenteil waere, ihre neueren Angaben stillschweigend zu
       ueberschreiben. */
    if (k.projektionsAbdruck != null && k.projektionsAbdruck !== felieProjektionAbdruck()) {
      datensatz = null;
      datensatzVerworfen = true;
      return false;
    }
    datensatz = k;
    datensatzVerworfen = false;
    return true;
  } catch (e) { return false; }
}

export function felieDatensatzStand() {
  return datensatz || null;
}

/* ── Zugriff von aussen (seit D1b) ────────────────────────────────────
   Die Webapp setzt den Store beim Zurueckrollen eines gescheiterten
   Speicherns auf den vorherigen Stand zurueck, und felieDatenAendern
   sichert und stellt den Datensatz samt Verworfen-Merker wieder her.
   Die Revision bleibt dabei, wie vorher, unberuehrt. */
export function felieStoreSetzen(s) {
  store = s || null;
}

export function felieDatensatzSetzen(k, verworfen) {
  datensatz = k || null;
  datensatzVerworfen = verworfen === true;
}

/* Wurde beim letzten Laden ein ueberholter Datensatz verworfen? Nur zur
   Pruefung; kein Ablauf haengt daran. */
export function felieDatensatzVerworfen() {
  return datensatzVerworfen;
}

/* Die Nutzerdaten sind geloescht: der Arbeitsspeicher folgt dem Speicher
   (AL-89). doResetUserData leert die Schluessel und laedt danach neu.
   Scheitert das Neuladen oder gibt es keines (Expo), stand bis D1b die
   Datensatz-Kopie noch hier, und der naechste Vorgang schrieb die
   geloeschten Eintraege zurueck. Geleert werden Store, Datensatz und
   Fremd-Merker; die Revision steigt, damit kein abgeleiteter View den
   alten Stand zeigt. Der Speicher-Port bleibt verbunden. */
export function felieArbeitsspeicherLeeren() {
  store = null;
  datensatz = null;
  datensatzVerworfen = false;
  felieSpeicherStandMerken();
  felieRevision(true);
}

/* Frischer Modulzustand fuer eine neue Laufzeit (felieKernZuruecksetzen).
   Nicht dasselbe wie das Loeschen der Nutzerdaten (oben). */
export function felieStoreZuruecksetzen() {
  store = null;
  rev = 0;
  datensatz = null;
  datensatzVerworfen = false;
}
