/* Gespraechsablauf (Welle F, F2b): die Sitzung eines Gespraechs, Senden,
   Rueckblick, Nachrichten an das Modell, Abschluss, Verwerfen, Fortsetzen
   aus dem Archiv - ohne Oberflaeche.

   Bis F2b in index.html (callFelie, apiMsgs, generateChatSummary,
   discardChatAndClose, reopenSavedChat, felieSessionZuruecksetzen und die
   Rueckblick-Helfer). Der Wortlaut folgt unveraendert; geaendert ist, was
   an der Oberflaeche hing:
   - Der Zustand der Sitzung liegt hier (felieSitzung), unabhaengig vom
     Bildschirm - D2 (Minimieren, Mini-Leiste) braucht das. Die Webapp
     sieht ihn ueber Zugriffe am window (_felieRequestPending,
     _felieSessionGeneration, _lastCut, _felieRueckblickOffen,
     _felieRueckblickAuswahl, _felieAktiverArchivChat), wie cycleData seit
     D7b; chatHistory ist das Array hier selbst.
   - Die Oberflaeche reicht hinein (felieGespraechVerbinden), beim Aufruf
     nachgeschlagen:
       nachrichtZeigen(text)          -> Rueckfrage im Gespraech anzeigen
       abschliessen(ergebnis, verlauf, auftrag) -> das Ergebnis anzeigen
                                         (gespraechAbschliessen)
       ohneAbschluss()                -> kein Abschluss noetig (Loader aus)
   - Der Gespraechszeiger (_letzteChatId) bleibt Oberflaeche (F-5); der
     Kern setzt ihn ueber felieGedaechtnisVerbinden wie bisher, und
     Meldungen an die Startseite gehen wie bisher ueber
     felieGedaechtnisEreignis.

   Tests: tests/felie-f2b-gespraech.test.cjs (vor dem Umzug geschrieben),
   tests/felie-al101-rueckblick-verwerfen.test.cjs. */

import { felieRequest, felieReplyText, felieDatenBlock, felieNotizErzeugen } from './modell.js';
import { felieKontextDaten, felieProfilDaten } from './kontext.js';
import { felieThema } from './anzeige.js';
import { felieLauf, felieLaufPruefen, felieUeberholt } from './lauf.js';
import { FELIE_LAUFEND_KEY, felieSpeicherLesen, felieSpeicherLoeschen, felieSpeicherSchreiben } from './speicher.js';
import { felieSichererVerlauf } from './archiv.js';
import { felieAbschiedNachtragen, felieAbschlussAnlegen, felieAbschlussNotlaufNotiz, felieArchivNachholen } from './abschluss.js';
import { felieStelleBereinigt } from './bruecke.js';
import { getSavedChats } from './gespraeche.js';
import { felieGedaechtnisEreignis, felieGedaechtnisLetzterChatSetzen } from './gedaechtnis.js';

/* Das Array selbst bleibt immer dasselbe (die Webapp haelt es unter dem
   Namen chatHistory); geleert wird es mit length = 0. */
export const chatHistory = [];

const sitzung = { laeuft: false, generation: 0, abgeschnitten: false,
  rueckblickOffen: null, rueckblickAuswahl: null, aktiverArchivChat: null, fortsetzungAb: null,
  /* Fester Eroeffnungssatz des Themas - nur fuer die Anzeige nach einem
     Neustart (Marcel 11 B), nie im Verlauf (AL-45). */
  eroeffnung: null,
  /* F4-6 A: grenzeErreicht - die letzte Antwort hat das freie Kontingent
     aufgebraucht (felie_grenze); abschiedOffen - Kennung des Gespraechs,
     dessen Abschied noch aussteht; abgeschlossen - der Abschied ist da,
     die Eingabe ist zu. */
  grenzeErreicht: false, abschiedOffen: null, abgeschlossen: false,
  /* F4-7 A: das gespeicherte Thema des Gespraechs (Schluessel aus
     FELIE_THEMEN, von der Oberflaeche) fuer den Block abschluss. */
  gespraechThema: null };

export function felieSitzung() {
  return sitzung;
}

let umgebung = null;
export function felieGespraechVerbinden(u) {
  umgebung = u || null;
}
function melden(name) {
  var f = umgebung && umgebung[name];
  if (typeof f !== 'function') return undefined;
  return f.apply(null, Array.prototype.slice.call(arguments, 1));
}

/* Frischer Modulzustand fuer eine neue Laufzeit (felieKernZuruecksetzen). */
export function felieGespraechZuruecksetzen() {
  chatHistory.length = 0;
  sitzung.laeuft = false; sitzung.generation = 0; sitzung.abgeschnitten = false;
  sitzung.rueckblickOffen = null; sitzung.rueckblickAuswahl = null; sitzung.aktiverArchivChat = null;
  sitzung.fortsetzungAb = null; sitzung.eroeffnung = null;
  /* F4-6 A: auch beim Kontowechsel - B erbt weder Grenze noch Abschluss von A. */
  sitzung.grenzeErreicht = false; sitzung.abschiedOffen = null; sitzung.abgeschlossen = false; sitzung.gespraechThema = null;
  letzteGrenze = null;
  umgebung = null;
}

/* ── Rueckblick ─────────────────────────────────────────────────── */
/* Rueckblick: erkennen, klaeren, erst dann ausliefern.
   Entschieden am 17.09.: bei mehreren passenden Gespraechen fragt felie
   EINMAL nach, und erst die Antwort waehlt aus. Ohne Antwort geht kein
   Rueckblick an das Modell — ersatzweise die letzten Gespraeche
   beizulegen bleibt ausgeschlossen (E11, Pruefaelle F22, F23).

   Die Absicht wird an ausdruecklichen Ruckwaertsbezuegen erkannt, nicht
   geraten. Faellt die Erkennung aus, passiert nichts Schlimmes: es bleibt
   ein normales Gespraech ohne Archivbeigabe. Das ist die richtige
   Fehlerrichtung. */
/* Als Funktion, nicht als Konstante: die bestehenden Regressionen laden
   nur eine feste Liste von Variablendeklarationen in ihren Testkontext.
   Eine neue Konstante waere dort schlicht nicht vorhanden — derselbe
   Fehler ist in M2a schon einmal passiert. */
export function felieRueckblickMarker() {
  return ['haben wir', 'hatten wir', 'habe ich dir', 'erzählt', 'besprochen',
    'geredet', 'gesprochen', 'letztes mal', 'damals', 'neulich',
    'erinnerst du dich', 'weißt du noch', 'worüber'];
}

export function felieRueckblickAbsicht(text) {
  var t = String(text || '').toLowerCase();
  if (!t) return false;
  return felieRueckblickMarker().some(function (m) { return t.indexOf(m) >= 0; });
}

/* Welche gespeicherten Gespraeche passen zu dieser Frage? Verglichen
   wird gegen Thema und eigene Worte — nicht gegen die Notizen, die
   seit M6 ohnehin kein Modellfutter mehr sind. */
export function felieRueckblickKandidaten(text) {
  var woerter = String(text || '').toLowerCase()
    .replace(/[^a-zäöüß0-9 ]/g, ' ').split(/\s+/)
    .filter(function (w) { return w.length >= 5 && felieRueckblickMarker().indexOf(w) < 0; });
  if (!woerter.length) return [];
  return getSavedChats().filter(function (c) {
    var heu = ((c.thema || '') + ' ' + (c.messages || []).map(function (m) {
      return m && m.role === 'user' ? m.content : ''; }).join(' ')).toLowerCase();
    return woerter.some(function (w) { return heu.indexOf(w) >= 0; });
  });
}

export function felieRueckblickFrage(kandidaten) {
  var teile = kandidaten.slice(0, 4).map(function (c) {
    return (c.thema || 'unser Gespräch') + ' vom '
      + new Date(c.timestamp).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  });
  return 'Dazu finde ich mehrere Gespräche: ' + teile.join(', ')
    + '. Welches meinst du?';
}

/* Der einzige Zugang fuer den Chat. Drei Ausgaenge, keine Zwischentoene. */
export function felieRueckblickAnfrage(text) {
  /* Steht eine Rueckfrage offen, ist die naechste Nachricht ihre
     Antwort — auch ohne Rueckwaertsbezug darin. „Das ueber die
     Wohnungssuche." ist eine Antwort, kein neues Anliegen. */
  var offen = sitzung.rueckblickOffen;
  if (offen && offen.length) {
    var wahl = felieRueckblickAuswahlLesen(text, offen);
    sitzung.rueckblickOffen = null;
    if (!wahl) return { modus: 'kein' };
    return { modus: 'rueckblick', gespraeche: [wahl] };
  }
  if (!felieRueckblickAbsicht(text)) return { modus: 'kein' };
  var k = felieRueckblickKandidaten(text);
  if (!k.length) return { modus: 'kein' };
  if (k.length === 1) return { modus: 'rueckblick',
    gespraeche: [String(k[0].id || k[0].timestamp)] };
  sitzung.rueckblickOffen = k.map(function (c) {
    return { id: String(c.id || c.timestamp), thema: c.thema || '', timestamp: c.timestamp }; });
  return { modus: 'rueckfrage', frage: felieRueckblickFrage(k),
    kandidaten: sitzung.rueckblickOffen };
}

/* Die Antwort der Nutzerin auf die Rueckfrage. Erkannt wird, was sie
   tatsaechlich schreibt: ein Datum, ein Monat oder ein Wort aus dem
   Thema. Bleibt es unklar, wird NICHT geraten — dann gibt es keinen
   Rueckblick, und sie kann es noch einmal sagen. */
export function felieRueckblickAuswahlLesen(text, kandidaten) {
  var t = String(text || '').toLowerCase();
  var treffer = kandidaten.filter(function (k) {
    var d = new Date(k.timestamp);
    var tag = String(d.getDate());
    var monat = d.toLocaleDateString('de-DE', { month: 'long' }).toLowerCase();
    if (t.indexOf(tag + '.') >= 0 || (t.indexOf(monat) >= 0 && t.indexOf(tag) >= 0)) return true;
    return (k.thema || '').toLowerCase().split(/\s+/).some(function (w) {
      return w.length >= 5 && t.indexOf(w) >= 0; });
  });
  return treffer.length === 1 ? treffer[0].id : null;
}

/* ── Zeitbezug einer Fortsetzung (F2b-1, P2.2) ───────────────────── */
/* Gemessen F2b: beim Fortsetzen gingen die alten Nachrichten ohne Datum an
   das Modell; "morgen ist mein Termin" las sich wie heute gesagt. Jeder
   Eintrag im Verlauf traegt deshalb seine Uhrzeit (zeit, nicht im Rumpf
   an das Modell), und der Kontext nennt das Datum des alten Teils:
   - beim Fortsetzen aus dem Archiv immer (Marcel, 25.09.),
   - im selben Gespraech nach einer Pause ab FELIE_FORTSETZUNG_PAUSE
     (Minimieren ueber Nacht, D2) oder ueber einen Tageswechsel - danach
     meinen "heute" und "morgen" einen anderen Tag (selbst entschieden,
     Register).
   Massgeblich ist die juengste solche Luecke. */
export const FELIE_FORTSETZUNG_PAUSE = 6 * 3600000;

export function felieFortsetzungFaellig(vorher, nachher) {
  if (!Number.isFinite(vorher) || !Number.isFinite(nachher) || nachher < vorher) return false;
  if (nachher - vorher >= FELIE_FORTSETZUNG_PAUSE) return true;
  return new Date(vorher).toDateString() !== new Date(nachher).toDateString();
}

export function felieFortsetzungDaten() {
  /* Kandidaten sind die Luecken im Verlauf (jeweils die Nachricht davor)
     und beim Fortsetzen aus dem Archiv dessen letzte Nachricht. Es gilt
     die juengste von einem frueheren Tag - der Tag wiegt schwerer als die
     Uhrzeit ("morgen" von gestern); gibt es keine, die juengste von heute. */
  var kandidaten = [], vorher = null;
  if (Number.isFinite(sitzung.fortsetzungAb)) kandidaten.push(sitzung.fortsetzungAb);
  chatHistory.forEach(function (m) {
    if (!m || !Number.isFinite(m.zeit)) return;
    if (vorher !== null && felieFortsetzungFaellig(vorher, m.zeit)) kandidaten.push(vorher);
    vorher = m.zeit;
  });
  if (!kandidaten.length) return null;
  var jetzt = new Date(), heute = jetzt.toDateString();
  var frueher = kandidaten.filter(function (t) { return new Date(t).toDateString() !== heute; });
  var ab = Math.max.apply(null, frueher.length ? frueher : kandidaten);
  var alt = new Date(ab), datum = alt.toLocaleDateString('de-DE');
  if (frueher.length) return { datum: datum,
    zeitbezug: 'Der frühere Teil dieses Gesprächs ist vom ' + datum + '; Zeitangaben darin wie „heute“, „morgen“ oder „gerade“ beziehen sich auf diesen Tag, nicht auf heute.' };
  /* Am selben Tag zaehlt die Uhrzeit ("gerade", "gleich", "heute Abend"). */
  var uhrzeit = uhr(alt);
  return { datum: datum, uhrzeit: uhrzeit,
    zeitbezug: 'Der frühere Teil dieses Gesprächs ist von heute (' + datum + '), ' + uhrzeit + ' Uhr; jetzt ist es ' + uhr(jetzt) + ' Uhr. Zeitangaben darin wie „gerade“ oder „gleich“ beziehen sich auf diese Uhrzeit.' };
}

function uhr(d) {
  return d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2);
}

/* Der Kontext einer Anfrage mit Fortsetzung: dasselbe wie sonst, das
   Datum des alten Teils direkt nach dem heutigen. Ohne Fortsetzung
   undefined - dann baut felieRequest den Kontext wie bisher. */
function fortsetzungKontext() {
  var f = felieFortsetzungDaten();
  if (!f) return undefined;
  var ctx = felieKontextDaten(), raus = { datum: ctx.datum, fortsetzung: f };
  Object.keys(ctx).forEach(function (k) { if (k !== 'datum') raus[k] = ctx[k]; });
  return { context: raus };
}

/* ── Nachrichten an das Modell ──────────────────────────────────── */
export function apiMsgs() {
  return chatHistory.filter(function(m) { return !m.kontextAuslassen; }).map(function(m) { return { role: m.role,
    content: m.hidden || m.internal ? felieDatenBlock('app_ereignis', { text: m.content }) : m.content }; });
}

/* ── Senden ─────────────────────────────────────────────────────── */
export function callFelie(userMessage, opts) {
  opts = opts || {};
  if (sitzung.laeuft) return Promise.reject(new Error('Eine Antwort wird bereits vorbereitet'));
  if (sitzung.abgeschlossen || sitzung.abschiedOffen) return Promise.reject(new Error('Das Gespräch ist abgeschlossen'));
  var entry = { role: 'user', content: userMessage, hidden: !!opts.hidden, internal: !!opts.hidden, zeit: Date.now() };
  chatHistory.push(entry);

  /* Rueckblick: passen mehrere Gespraeche, fragt felie EINMAL nach und
     ruft dafuer kein Modell. Erst die Antwort waehlt aus; ohne Antwort
     gibt es keinen Rueckblick (F22, F23). Die Rueckfrage kostet nichts
     und behauptet nichts — der Fehlerfall ist ein normales Gespraech. */
  var rb = null;
  try { rb = opts.hidden ? null : felieRueckblickAnfrage(userMessage); } catch (e) {}
  if (rb && rb.modus === 'rueckfrage') {
    chatHistory.push({ role: 'assistant', content: rb.frage, zeit: Date.now() });
    try { melden('nachrichtZeigen', rb.frage); } catch (e) {}
    return Promise.resolve(rb.frage);
  }
  sitzung.rueckblickAuswahl = rb && rb.modus === 'rueckblick' ? rb.gespraeche : null;


  // Der Chat waehlt seine Rueckfrage nach dem Anliegen. Ein Stichwort wie
  // „muede“ reserviert keine Koerperdaten-Abfrage und verdraengt keine Hilfe.
  sitzung.laeuft = true;
  var generation = sitzung.generation;
  var lauf = felieLauf();
  return felieRequest('chat', apiMsgs(), Object.assign({ lauf: lauf }, fortsetzungKontext())).then(function(data) {
    /* F3: nach einem Kontowechsel gehoert diese Antwort niemandem mehr hier. */
    felieLaufPruefen(lauf);
    if (generation !== sitzung.generation) throw new Error('Gespräch wurde gewechselt');
    var reply = felieReplyText(data);
    chatHistory.push({ role: 'assistant', content: reply, zeit: Date.now() });
    sitzung.abgeschnitten = data.stop_reason === 'max_tokens';
    /* F4-6 A: diese Antwort hat das freie Kontingent aufgebraucht - die
       Oberflaeche zeigt sie und ruft dann felieGrenzeAbschliessen. */
    sitzung.grenzeErreicht = data.felie_grenze === true;
    return reply;
  }).catch(function(err) {
    /* F3: scheitert die Anfrage erst nach einem Kontowechsel, gehoert auch
       der Fehler dem frueheren Lauf - keine Meldung im neuen Konto. */
    if (lauf !== felieLauf() && !(err && err.felieUeberholt)) throw felieUeberholt();
    throw err;
  }).finally(function() { if (lauf === felieLauf()) sitzung.laeuft = false; });
}

/* ── Abschied an der Grenze des Freikontingents (F4-6 A, Marcel 28.09.) ──
   Nach der Antwort, die das Kontingent aufgebraucht hat: die Auswertung
   startet, ohne dass jemand auf sie wartet (Zusatz 1), und felie bittet
   ohne neue Nachricht der Nutzerin um ihren Abschied - letzter Eintrag
   der Anfrage ist der Block abschluss (felieAbschlussRegel im Worker, der
   die Regel nur im Zustand grenze anhaengt). Das Gespraech wird mit
   "Abschied offen" gesichert: endet die App vorher, erscheint der
   Abschied beim naechsten Oeffnen (Zusatz 2); die Auswertung holt der
   Mechanismus fuer wartende Auftraege nach.
   auswerten(verlauf, { sicherungBehalten: true }) startet die Auswertung
   (Webapp: generateChatSummary, App: felieAppAbschliessen); zusatz wie
   bei felieGespraechSichern ({ thema, entwurf } der Oberflaeche). */
var letzteGrenze = null;

export function felieGrenzeAbschliessen(auswerten, zusatz) {
  var kennung = 'grenze-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  var letzte = chatHistory[chatHistory.length - 1];
  if (letzte) letzte.grenzeKennung = kennung;
  sitzung.grenzeErreicht = false;
  sitzung.abschiedOffen = kennung;
  if (zusatz && typeof zusatz.thema === 'string') sitzung.gespraechThema = zusatz.thema;
  felieGespraechSichern(zusatz || {});
  var verlauf = chatHistory.slice();
  var auswertung = null;
  try { auswertung = Promise.resolve(auswerten(verlauf, { sicherungBehalten: true, thema: sitzung.gespraechThema })).catch(function () {}); }
  catch (e) { auswertung = Promise.resolve(); }
  letzteGrenze = { kennung: kennung, auswertung: auswertung, lauf: felieLauf() };
  return { kennung: kennung, auswertung: auswertung };
}

/* Nach erfolgreichem Kauf (F4b, Marcel 28.09.): weiter im selben Chat,
   wie "Chat oeffnen" an der Archivkarte - das Archivgespraech mit dieser
   Grenze wird wiederhergestellt (Verlauf samt Abschied sichtbar), die
   Eingabe ist offen, beim naechsten Speichern bleibt es eine Karte
   (F2b-2). Laeuft die Auswertung noch, wird auf sie gewartet. Liefert
   { chat, sichtbar, thema } oder null. */
export function felieGrenzeFortsetzen() {
  var g = letzteGrenze;
  if (!g) return Promise.resolve(null);
  return Promise.resolve(g.auswertung).then(function () {
    felieLaufPruefen(g.lauf);
    try { felieArchivNachholen(); } catch (e) {}
    var chat = getSavedChats().filter(function (c) {
      return Array.isArray(c.messages) && c.messages.some(function (m) { return m && m.grenzeKennung === g.kennung; });
    })[0];
    if (!chat) return null;
    felieSitzungNeu();
    var sichtbar = felieGespraechWiederherstellen(chat) || [];
    letzteGrenze = null;
    return { chat: chat, sichtbar: sichtbar, thema: sitzung.gespraechThema };
  });
}

/* Der Block abschluss an das Modell: leer (F4-11 A, Marcel 28.09.) - so
   endet felies Abschied nach dem Satz ueber die naechsten Gespraeche
   (Regel v6-abschied ohne Thema, gemessen 8/8 ohne Einladung). Was sie
   ueber Abo und Archiv wissen muss, setzt die App davor
   (felieAbschiedVorsatz). Die Notiz der
   Auswertung gibt es im parallelen Ablauf noch nicht (Zusatz 1). */
export function felieAbschlussBlock() {
  return {};
}

/* Der Vorsatz von felies Abschied an der Grenze (freigegeben Marcel
   28.09., ersetzt den Einladungssatz aus F4-11 A): ein fester Text der App
   VOR felies Rueckblick in derselben Blase - er sagt, warum das Gespraech
   endet (bewusste Aenderung von AL-62: das Abo wird genannt, als Text der
   App, nicht vom Modell; AL-61/65 bleiben). Mit ihrem Namen, wenn das
   Profil ihn kennt; mit dem gespeicherten Thema (Kachelname, "und" statt
   "&"; die Kacheltitel bleiben unveraendert), sonst ohne Thema - "Mein
   Thema", unbekannte und aeltere Eintraege. Nie ein vom Modell
   abgeleitetes Thema. */
export function felieAbschiedVorsatz(themaSchluessel, name) {
  var t = themaSchluessel && themaSchluessel !== 'eigenes' ? felieThema(themaSchluessel) : null;
  var anfang = name ? name + ', ich hoffe' : 'Ich hoffe';
  var weiter = t ? 'Wenn du weiter mit mir über ' + t.name.replace(/\s*&\s*/g, ' und ') + ' sprechen möchtest, geht das mit dem Monatsabo.'
    : 'Wenn du weiter mit mir sprechen möchtest, geht das mit dem Monatsabo.';
  return anfang + ', du konntest einen ersten Eindruck von mir gewinnen. ' + weiter + ' Unser bisheriges Gespräch habe ich für dich im Archiv abgelegt.';
}

/* Liefert felies Abschied, null ohne Abschied (Reserve verbraucht, 402).
   Ein Netzfehler laesst den Abschied offen (naechster Versuch beim
   Oeffnen); nach einem Kontowechsel gehoert er niemandem mehr hier. */
export function felieAbschiedHolen() {
  if (!sitzung.abschiedOffen) return Promise.resolve(null);
  if (sitzung.laeuft) return Promise.reject(new Error('Eine Antwort wird bereits vorbereitet'));
  var kennung = sitzung.abschiedOffen;
  var msgs = apiMsgs().concat([{ role: 'user', content: felieDatenBlock('abschluss', felieAbschlussBlock()) }]);
  sitzung.laeuft = true;
  var generation = sitzung.generation;
  var lauf = felieLauf();
  var fertig = function (m) {
    sitzung.abschiedOffen = null;
    sitzung.abgeschlossen = true;
    felieGespraechSicherungLoeschen();
    if (m) { try { felieAbschiedNachtragen(kennung, m); } catch (e) {} }
  };
  return felieRequest('chat', msgs, Object.assign({ lauf: lauf }, fortsetzungKontext())).then(function (data) {
    felieLaufPruefen(lauf);
    if (generation !== sitzung.generation) throw new Error('Gespräch wurde gewechselt');
    /* Der feste Vorsatz der App vor felies Rueckblick, gleiche Blase. */
    var name = null;
    try { name = felieProfilDaten().name || null; } catch (e) { name = null; }
    var text = felieAbschiedVorsatz(sitzung.gespraechThema, name) + '\n\n' + felieReplyText(data).replace(/^\s+|\s+$/g, '');
    var m = { role: 'assistant', content: text, zeit: Date.now(), abschied: true };
    chatHistory.push(m);
    fertig(m);
    return text;
  }).catch(function (err) {
    if (lauf !== felieLauf() || (err && err.felieUeberholt)) throw (err && err.felieUeberholt ? err : felieUeberholt());
    /* Die Reserve reicht nicht mehr: ohne Abschied, aber abgeschlossen. */
    if (err && err.felieAboNoetig) { fertig(null); return null; }
    throw err;
  }).finally(function () { if (lauf === felieLauf()) sitzung.laeuft = false; });
}

/* ── Einstieg ueber ein Thema (seit F2, bis dahin homeStartChat) ─── */
export const FELIE_EINSTIEG_ERSATZ = 'Ich bin gleich für dich da.';

/* wahl: Schluessel eines Themas oder ein freier Satz (dashStartChat).
   Liefert { thema, sofort, antwort }: bei "Mein Thema" steht sofort der
   feste Satz und es gibt keine Anfrage - er geht bewusst NICHT in den
   Verlauf, er ist Text der App (AL-45). Sonst geht der Einstieg versteckt
   an felie; antwort ist ihre Antwort, bei einem Fehler der Ersatzsatz.
   Die Sitzung setzt der Aufrufer neu (felieSitzungNeu). */
export function felieThemaStarten(wahl) {
  var thema = felieThema(wahl);
  var msg = thema ? thema.msg : wahl;
  chatHistory.length = 0;
  /* F4-9 A: das gewaehlte Thema (auch "Mein Thema") - es geht mit ins
     Archiv und traegt eine Fortsetzung. */
  sitzung.gespraechThema = thema ? thema.key : null;
  sitzung.eroeffnung = thema && !msg ? thema.eroeffnung : null;
  if (thema && !msg) return { thema: thema, sofort: thema.eroeffnung, antwort: null };
  return { thema: thema, sofort: null,
    antwort: callFelie(msg, { hidden: true }).catch(function (e) {
      if (e && e.felieUeberholt) throw e;   /* F3: kein Ersatzsatz im Gespraech eines anderen Kontos */
      if (e && e.felieAboNoetig) throw e;   /* F4: ohne Abo kein neues Gespraech - die App zeigt die Paywall */
      return FELIE_EINSTIEG_ERSATZ;
    }) };
}

/* ── Weiterschreiben (seit F2, bis dahin continueFelie) ─────────── */
export const FELIE_WEITERSCHREIBEN_AUFTRAG = 'Schreib genau dort weiter, wo du gerade abgebrochen hast. '
  + 'Keine Begrüßung, keine Wiederholung, keine Einleitung — setz einfach den Satz fort.';

/* Setzt eine vom Token-Limit gekappte Antwort fort; liefert den Text
   ohne Marker. Ob auch die Fortsetzung gekappt wurde, steht danach in
   felieSitzung().abgeschnitten. */
export function felieWeiterschreiben() {
  return callFelie(FELIE_WEITERSCHREIBEN_AUFTRAG, { hidden: true }).then(function (reply) {
    return reply.replace(/\[\[NEED:(cycle|body)\]\]/gi, '').trim();
  });
}

/* ── Abschluss ──────────────────────────────────────────────────── */
export function generateChatSummary(historySnapshot, opts) {
  felieGedaechtnisEreignis('gespraech_beendet');
  /* Speichern beendet das laufende Gespraech: seine Sicherung faellt weg
     (Marcel, 2 A). Der Verlauf ist ab hier im Abschlussauftrag. An der
     Grenze (F4-6 A) bleibt sie, bis felies Abschied da ist - die
     Auswertung startet in der App erst nach der Hintergrundzeit von iOS
     und loeschte sonst "Abschied offen". */
  if (!(opts && opts.sicherungBehalten)) felieGespraechSicherungLoeschen();
  var history = felieSichererVerlauf(historySnapshot || chatHistory);
  /* Fortsetzung eines Archivgespraechs (F2b-2): derselbe Eintrag wird
     fortgeschrieben. Ohne neue Nachricht der Nutzerin gibt es nichts
     abzuschliessen. */
  var ziel = fortsetzungZiel(history);
  if (ziel === false) { melden('ohneAbschluss'); return Promise.resolve(); }
  if (ziel) history = felieFortsetzungVerlauf(ziel, history);
  else history = history.map(function (m) { var e = Object.assign({}, m); delete e.archivIndex; return e; });
  if (!history.some(function(m) { return m.role === 'user'; })) {
    felieGedaechtnisLetzterChatSetzen(null); melden('ohneAbschluss');
    return Promise.resolve();
  }
  /* Der Verlauf wird VOR der Auswertung als Auftrag gesichert (A2). Bis
     zum 18.09. entschied hier der Gespraechszaehler: begann die Nutzerin
     waehrend der rund 36 Sekunden Auswertung ein neues Gespraech, wurde
     das Ergebnis stumm verworfen — kein Archiveintrag, kein wartender
     Auftrag. Ein Gespraechswechsel darf einen abgeschlossenen Verlauf
     nicht loeschen; er gehoert in dasselbe Archiv. Was verspaetete
     Ergebnisse tatsaechlich unzulaessig macht, ist ein Datenreset — dafuer
     traegt der Auftrag die Datenepoche. */
  /* F4-9 A: das gewaehlte Thema - ausdruecklich vom Aufrufer (die App
     startet die Auswertung verzoegert; inzwischen kann ein neues Gespraech
     begonnen haben), sonst das der Sitzung; eine Fortsetzung erbt es. */
  var gewaehlt = opts && Object.prototype.hasOwnProperty.call(opts, 'thema') ? opts.thema : sitzung.gespraechThema;
  if (!gewaehlt && ziel && typeof ziel.gewaehltesThema === 'string') gewaehlt = ziel.gewaehltesThema;
  var auftrag = felieAbschlussAnlegen(history, ziel ? (ziel.id || ziel.timestamp) : undefined, gewaehlt || null);
  /* F3: die Auswertung gehoert ihrem Lauf. Nach einem Kontowechsel wird
     nichts gemeldet und nichts geschrieben - der Auftrag liegt schon im
     Bestand dieses Kontos und wird dort nachgeholt. */
  var lauf = felieLauf();
  return felieNotizErzeugen(history, undefined, undefined, { lauf: lauf }).then(function(summary) {
    if (lauf !== felieLauf()) return;
    melden('abschliessen', summary, history, auftrag);
  }).catch(function() {
    if (lauf !== felieLauf()) return;
    /* Fehlgeschlagene Notiz: das Gespraech wird trotzdem archiviert und
       traegt notizenStatus 'unvollstaendig' — die Archivkarte zeigt das
       an und bietet dort das erneute Erzeugen. Ohne Pop-up ist die
       Archivkarte die einzige Stelle, an der das sichtbar wird. */
    melden('abschliessen', felieAbschlussNotlaufNotiz(), history, auftrag);
  });
}

/* Das Archivgespraech, das fortgeschrieben wird: null ohne Fortsetzung
   (oder wenn der Eintrag inzwischen fehlt), false ohne neue Nachricht der
   Nutzerin. */
function fortsetzungZiel(history) {
  if (!history.some(function (m) { return m.archivIndex != null; })) return null;
  if (!history.some(function (m) { return m.archivIndex == null && m.role === 'user'; })) return false;
  var id = sitzung.aktiverArchivChat;
  var chat = getSavedChats().filter(function (c) { return (c.id || c.timestamp) === id; })[0];
  if (!chat || !Array.isArray(chat.messages) || !chat.messages.length) return null;
  /* Nur wenn jede alte Nachricht ihren Index behaelt (aeltere Eintraege
     mit versteckten Eintraegen: wie bisher ein neuer Eintrag). */
  var ohneMarke = chat.messages.map(function (m) { var e = Object.assign({}, m); delete e.kontextAuslassen; return e; });
  if (felieSichererVerlauf(ohneMarke).length !== chat.messages.length) return null;
  return chat;
}

/* Der Verlauf fuer Auswertung und Archiv beim Fortschreiben: die alten
   Nachrichten des Eintrags unveraendert an ihrem Index (gesperrte mit
   Marke gesperrt, bereinigte mit inhaltBereinigt - wie beim Fortsetzen),
   dahinter die neuen. Der Index ist die Kennung, auf die Belege, Sperren
   und Gedaechtnis verweisen. */
export function felieFortsetzungVerlauf(chat, history) {
  var aus = chat.kontextNachrichtenAuslassen || [];
  var alt = chat.messages.map(function (m, i) {
    var e = Object.assign({}, m);
    delete e.kontextAuslassen;
    e.archivIndex = i;
    var gesperrt = !!m.kontextAuslassen || aus.indexOf(i) >= 0;
    if (!gesperrt && m.role === 'user' && typeof m.content === 'string') {
      var rein = felieStelleBereinigt(chat, i, m.content);
      if (rein === null) gesperrt = true;
      else if (rein !== m.content) e.inhaltBereinigt = rein;
    }
    if (gesperrt) e.gesperrt = true;
    return e;
  });
  var neu = history.filter(function (m) { return m.archivIndex == null; })
    .map(function (m) { return Object.assign({}, m); });
  return alt.concat(neu);
}

/* Der gespeicherte Verlauf eines Eintrags fuer eine erneute Auswertung
   (Ergaenzen der Karte): dieselbe Sicht wie beim Fortschreiben. AL-105:
   bis F2b ging chat.messages roh hinein, eine gesperrte Stelle damit
   wieder an das Modell. */
export function felieArchivVerlauf(chat) {
  return felieFortsetzungVerlauf(chat, []);
}

/* ── Ohne Netz (N6, F2) ─────────────────────────────────────────── */
/* Nach einer Anfrage, die ohne Netz scheiterte (felieOhneNetz): die
   unbeantwortete Nachricht der Nutzerin verlaesst den Verlauf und geht
   zurueck ins Eingabefeld - sonst stuenden beim naechsten Senden zwei
   Nachrichten ohne Antwort hintereinander. Liefert den Text oder null. */
export function felieNachrichtZuruecknehmen() {
  var m = chatHistory[chatHistory.length - 1];
  if (!m || m.role !== 'user' || m.hidden || m.internal) return null;
  chatHistory.pop();
  return m.content;
}

/* ── Laufendes Gespraech sichern (F2, Marcel 2 A) ───────────────── */
/* iOS beendet Apps im Hintergrund; Minimieren verspricht, dass nichts
   endet (D2). Die App sichert deshalb nach jeder Nachricht, beim
   Minimieren und beim Wechsel in den Hintergrund; nach einem Neustart
   erscheint das Gespraech als Mini-Leiste. Speichern und Verwerfen
   loeschen die Sicherung (generateChatSummary, felieGespraechVerwerfen).
   Gesichert wird nur, was ihres ist: mindestens eine eigene Nachricht
   oder ein begonnener Text - ein nur geoeffnetes Thema nicht.
   zusatz: { thema, entwurf } aus der Oberflaeche. */
export function felieGespraechSichern(zusatz) {
  zusatz = zusatz || {};
  /* F4-6 A: nach felies Abschied ist das Gespraech zu und im Archiv - es
     kommt nach einem Neustart nicht als laufendes zurueck. */
  if (sitzung.abgeschlossen) { felieGespraechSicherungLoeschen(); return false; }
  var entwurf = typeof zusatz.entwurf === 'string' ? zusatz.entwurf : '';
  var eigenes = chatHistory.some(function (m) { return m.role === 'user' && !m.hidden && !m.internal; });
  if (!eigenes && !entwurf.trim()) { felieGespraechSicherungLoeschen(); return false; }
  felieSpeicherSchreiben(FELIE_LAUFEND_KEY, JSON.stringify({
    version: 1, gesichertAm: Date.now(),
    verlauf: chatHistory.map(function (m) { return Object.assign({}, m); }),
    sitzung: { aktiverArchivChat: sitzung.aktiverArchivChat, fortsetzungAb: sitzung.fortsetzungAb,
      abgeschnitten: sitzung.abgeschnitten, abschiedOffen: sitzung.abschiedOffen || null },
    thema: zusatz.thema || null, entwurf: entwurf,
    /* Nur Anzeige (Marcel 11 B): geht nicht in den Verlauf zurueck. */
    eroeffnung: sitzung.eroeffnung || null }));
  return true;
}

/* Die Sicherung oder null (keine, kaputt, fremde Fassung). */
export function felieGespraechSicherung() {
  try {
    var s = JSON.parse(felieSpeicherLesen(FELIE_LAUFEND_KEY) || 'null');
    if (!s || s.version !== 1 || !Array.isArray(s.verlauf) || !s.sitzung) return null;
    return s;
  } catch (e) { return null; }
}

export function felieGespraechSicherungLoeschen() {
  try { felieSpeicherLoeschen(FELIE_LAUFEND_KEY); } catch (e) {}
}

/* Nach einem Neustart: Verlauf und Sitzung wie vor dem Ende der App.
   Liefert { thema, entwurf, eroeffnung, sichtbar } - sichtbar wie
   felieGespraechWiederherstellen; eroeffnung nur fuer die Anzeige vor dem
   Verlauf (Marcel 11 B). */
export function felieGespraechWiederaufnehmen(s) {
  chatHistory.length = 0;
  s.verlauf.forEach(function (m) { chatHistory.push(Object.assign({}, m)); });
  sitzung.aktiverArchivChat = s.sitzung.aktiverArchivChat == null ? null : s.sitzung.aktiverArchivChat;
  sitzung.fortsetzungAb = Number.isFinite(s.sitzung.fortsetzungAb) ? s.sitzung.fortsetzungAb : null;
  sitzung.abgeschnitten = !!s.sitzung.abgeschnitten;
  sitzung.eroeffnung = typeof s.eroeffnung === 'string' ? s.eroeffnung : null;
  /* F4-6 A, Zusatz 2: der Abschied steht noch aus. */
  sitzung.abschiedOffen = typeof s.sitzung.abschiedOffen === 'string' ? s.sitzung.abschiedOffen : null;
  sitzung.gespraechThema = typeof s.thema === 'string' ? s.thema : null;
  sitzung.abgeschlossen = false;
  sitzung.grenzeErreicht = false;
  var sichtbar = chatHistory.filter(function (m) { return !m.hidden && !m.internal; })
    .map(function (m) { return { text: m.content, von: m.role === 'user' ? 'user' : 'felie' }; });
  return { thema: s.thema || null, entwurf: s.entwurf || '', eroeffnung: sitzung.eroeffnung, sichtbar: sichtbar };
}

/* ── Verwerfen, Neubeginn ───────────────────────────────────────── */

/* Der Teil von discardChatAndClose ohne Oberflaeche: nichts wird
   gespeichert (P3), eine offene Rueckfrage faellt mit (AL-101). */
export function felieGespraechVerwerfen() {
  chatHistory.length = 0;
  sitzung.rueckblickOffen = null;
  sitzung.rueckblickAuswahl = null;
  sitzung.fortsetzungAb = null;
  sitzung.eroeffnung = null;
  felieGespraechSicherungLoeschen();
  felieGedaechtnisEreignis('gespraech_verlassen');
}

/* Der Teil von felieSessionZuruecksetzen, der zur Sitzung gehoert. Die
   Webapp leert daneben Gespraechszeiger und Kennenlernen-Kennung. */
export function felieSitzungNeu() {
  sitzung.aktiverArchivChat = null;
  sitzung.gespraechThema = null;
  sitzung.grenzeErreicht = false;
  sitzung.abschiedOffen = null;
  sitzung.abgeschlossen = false;
  /* AL-101: eine offene Rueckblick-Rueckfrage gehoert zu ihrem Gespraech.
     Blieb sie stehen, las das naechste Gespraech seine erste Nachricht als
     Auswahl. */
  sitzung.rueckblickOffen = null;
  sitzung.rueckblickAuswahl = null;
  sitzung.abgeschnitten = false;
  sitzung.fortsetzungAb = null;
  sitzung.eroeffnung = null;
  sitzung.generation = sitzung.generation + 1;
}

/* ── Fortsetzen aus dem Archiv ──────────────────────────────────── */
/* Der Teil von reopenSavedChat ohne Oberflaeche: das Gespraech wird zum
   aktiven Archivgespraech, sein Verlauf 1:1 wiederhergestellt. Liefert die
   sichtbaren Nachrichten zum Anzeigen, oder null, wenn die Karte keinen
   gespeicherten Verlauf hat (dann felieGespraechWiedereinstieg). */
export function felieGespraechWiederherstellen(chat) {
  sitzung.aktiverArchivChat = chat.id || chat.timestamp;
  /* F4-9 A: die Fortsetzung uebernimmt das gewaehlte Thema; aeltere
     Eintraege haben keins. */
  sitzung.gespraechThema = typeof chat.gewaehltesThema === 'string' ? chat.gewaehltesThema : null;
  chatHistory.length = 0;
  /* Der alte Teil: seine letzte Nachricht, bei aelteren Karten ohne
     Uhrzeit am Eintrag der Zeitpunkt des Gespraechs. */
  var zeiten = (chat.messages || []).map(function (m) { return m && m.zeit; }).filter(Number.isFinite);
  sitzung.fortsetzungAb = zeiten.length ? Math.max.apply(null, zeiten)
    : Number.isFinite(chat.timestamp) ? chat.timestamp : null;
  if (Array.isArray(chat.messages) && chat.messages.length) {
    var sichtbar = [];
    // Exakten Verlauf 1:1 wiederherstellen
    chat.messages.forEach(function(m, index) {
      var e = Object.assign({}, m);
      e.kontextAuslassen = !!m.kontextAuslassen || (chat.kontextNachrichtenAuslassen || []).indexOf(index) >= 0;
      /* Eine berichtigte oder geloeschte Aussage darf aus ihrer
         Ursprungsstelle nicht neu gewonnen werden — die Stelle faellt
         weg, der Rest der Nachricht bleibt verwendbar (Pruefall F14).
         Bleibt nichts Tragfaehiges uebrig, ist die Nachricht draussen.
         (Gemessen F2b, AL-103: nach dem Loeschen einer Angabe sperrt
         felieArchivVerlaufSperren meist die ganze Nachricht samt Antwort.) */
      if (!e.kontextAuslassen && m.role === 'user' && typeof m.content === 'string') {
        var rein = felieStelleBereinigt(chat, index, m.content);
        if (rein === null) e.kontextAuslassen = true;
        else if (rein !== m.content) e.inhaltBereinigt = rein;
      }
      if (m.hidden) e.hidden = true;
      /* Herkunft fuer das Fortschreiben (F2b-2); geht nicht an das Modell. */
      e.archivIndex = index;
      chatHistory.push(e);
      if (!m.hidden) sichtbar.push({ text: m.content, von: m.role === 'user' ? 'user' : 'felie' });
    });
    return sichtbar;
  }
  // Kein gespeicherter Verlauf (aeltere Karte) → felie steigt anhand der Erkenntnisse neu ein
  chatHistory.push({ role: 'user', hidden: true, internal: true,
    content: 'Ein älteres Gespräch wurde geöffnet; es liegen keine überprüfbaren Originalaussagen vor.' });
  return null;
}

/* Wiedereinstieg bei einer Karte ohne Verlauf: felie fragt das Modell
   (Modus wiedereinstieg) und haengt ihre Antwort an. Liefert den Text;
   scheitert die Anfrage, einen festen Satz. */
export function felieGespraechWiedereinstieg(chat) {
  var lauf = felieLauf();
  return felieRequest('wiedereinstieg', apiMsgs(), Object.assign({ lauf: lauf }, fortsetzungKontext()))
    .then(function(data){
      felieLaufPruefen(lauf);
      var t = felieReplyText(data) ||
        ('Schön, dass du nochmal an „' + (chat.thema||'unser Thema') + '" anknüpfst. Magst du erzählen, wo du gerade stehst?');
      chatHistory.push({ role: 'assistant', content: t, zeit: Date.now() });
      return t;
    }, function(e){
      /* F3: weder nach einem Kontowechsel noch bei einem Fehler danach in
         das Gespraech eines anderen Kontos. */
      if ((e && e.felieUeberholt) || lauf !== felieLauf()) throw (e && e.felieUeberholt ? e : felieUeberholt());
      var t = 'Die Verbindung hat gerade nicht geklappt. Du kannst hier schreiben, womit du weitergehen möchtest.';
      chatHistory.push({ role: 'assistant', content: t, zeit: Date.now() });
      return t;
    });
}
