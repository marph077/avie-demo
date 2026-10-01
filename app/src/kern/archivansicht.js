/* Archivansicht - seit F6a (Marcel 29.09., docs/f6a-archiv-ist-soll.md).

   Was eine Archivkarte zeigt und was sie anbietet, fuer Webapp und App:
   - der Zustand der Karte (felieArchivZustand) und sein Satz;
   - die Regel fuer "Notizen ergaenzen" (felieArchivErgaenzbar);
   - "Notizen ergaenzen" selbst (felieArchivNotizenErgaenzen). Bis F6a
     stand es als felieArchivNotizErstellen in index.html und schrieb
     felie_saved_chats am Vorgang vorbei (Befund 1, D-9). Zusammenfuehren,
     Nummerierung, Sperre und Konfliktpruefung sind wortgleich im Ergebnis;
     statt Meldungen liefert es ein Ergebnis, die Meldung zeigt die
     Oberflaeche (FELIE_ARCHIV_TEXTE);
   - die Namensform alter Zusammenfassungen (felieTextMitName, bis F6a in
     index.html);
   - die Kartendaten (felieArchivKarten).
   Texte freigegeben: docs/freigabe.md (F6a). */

import { felieNotizSchluessel } from './text.js';
import { getSavedChats, felieArchivKartenDatum } from './gespraeche.js';
import { felieNotizenLesen, felieNotizVorschau } from './gedaechtnis.js';
import { felieArchivFeldQuelle, felieSichererVerlauf } from './archiv.js';
import { felieAbschlussLaeuft, felieArchivNotizenGrund, felieGespraecheInArbeit, felieKrisenTitel } from './abschluss.js';
import { felieGespraechInArbeitText, felieGespraechInArbeitTitel } from './startseite.js';
import { felieNotizErzeugen } from './modell.js';
import { felieArchivVerlauf } from './gespraech.js';
import { felieVorgangPort } from './bruecke.js';
import { felieKontextProfil } from './kontext.js';
import { felieAngabeAnzeige } from './anzeige.js';

/* Freigegeben (Marcel 29.09.): neu sind nichts, ausgefallen, die beiden
   Punkte des langen Drueckens und loeschenTitel; der Rest 1:1 Webapp. Die
   Saetze fuer "laeuft" und "nachholen" kommen aus der Startseite
   (felieGespraechInArbeitText). */
export const FELIE_ARCHIV_TEXTE = Object.freeze({
  kopf: 'Archiv', kopfUnterzeile: 'Gespeicherte Gespräche',
  leerTitel: 'Noch keine gespeicherten Gespräche', leerText: 'Wenn du einen Chat mit felie beendest und speicherst, erscheint er hier.',
  teilweise: 'Noch nicht vollständig verarbeitet. Bereits erfasste Notizen bleiben erhalten.',
  nichts: 'Zu diesem Gespräch gibt es keine Notizen.',
  ausgefallen: 'Die Notizen konnten nicht erstellt werden. Du kannst sie ergänzen.',
  ergaenzen: 'Notizen ergänzen', ergaenzenLaeuft: 'Notizen werden ergänzt…', oeffnen: 'Chat öffnen',
  /* Meldungen zu den Ergebnissen von felieArchivNotizenErgaenzen. */
  geloescht_gesperrt: 'Eine frühere Notiz wurde bewusst gelöscht. Die automatische Ergänzung bleibt deshalb aus.',
  bearbeitet: 'Deine inzwischen bearbeiteten Notizen bleiben erhalten. Bitte starte die Ergänzung bei Bedarf erneut.',
  nichts_neu: 'Es konnte keine zusätzliche Notiz erstellt werden. Dein Gespräch bleibt erhalten.',
  fehler: 'Die Notizen konnten gerade nicht ergänzt werden. Bitte versuche es später erneut.',
  menueOeffnen: 'Öffnen', menueLoeschen: 'Löschen',
  loeschenTitel: 'Gespräch löschen?',
  /* seit F6d-2 (Marcel 30.09., Nr. 8) statt "Unabhaengig eingetragene Profilangaben" */
  loeschenText: 'Dieses Gespräch und die daraus entstandenen Erinnerungen werden dauerhaft entfernt. Deine eigenen Angaben unter „Über dich“ bleiben erhalten.',
  abbrechen: 'Abbrechen', loeschen: 'Löschen', alleAnsehen: 'Alle ansehen'
});

/* ── Zustand der Karte (AL-97) ───────────────────────────────────── */

/* laeuft      frueher Eintrag (B-9a), die Auswertung laeuft in dieser Sitzung
   nachholen   frueher Eintrag, die App endete vorher; wird nachgeholt
   vollstaendig
   nichts      die Auswertung lief durch und fand nichts
   teilweise   einiges erfasst, der Rest fehlt (auch aeltere Eintraege)
   ausgefallen die Auswertung scheiterte (Notlauf) */
export function felieArchivZustand(chat) {
  if (!chat) return 'vollstaendig';
  if (chat.auswertungLaeuft) return felieAbschlussLaeuft(chat.auftragId) ? 'laeuft' : 'nachholen';
  if (chat.notizenStatus !== 'unvollstaendig') return 'vollstaendig';
  return chat.notizenGrund === 'nichts' || chat.notizenGrund === 'ausgefallen' ? chat.notizenGrund : 'teilweise';
}

export function felieArchivZustandText(chat) {
  var z = felieArchivZustand(chat);
  if (z === 'laeuft' || z === 'nachholen') return felieGespraechInArbeitText({ id: chat.auftragId });
  return z === 'vollstaendig' ? '' : FELIE_ARCHIV_TEXTE[z];
}

/* "Notizen ergaenzen" (A-2 A): nur bei teilweise und ausgefallen, dazu bei
   den aeltesten Eintraegen ohne Notizliste (wie bisher); nie, solange die
   Auswertung laeuft oder nachgeholt wird, nie bei "nichts", nie ohne eine
   Nachricht der Nutzerin. */
export function felieArchivErgaenzbar(chat) {
  if (!chat || !felieSichererVerlauf(chat.messages).some(function (m) { return m.role === 'user'; })) return false;
  var z = felieArchivZustand(chat);
  return z === 'teilweise' || z === 'ausgefallen' || (z === 'vollstaendig' && !Array.isArray(chat.notizen));
}

/* ── Notizen ergaenzen ──────────────────────────────────────────── */

/* Sperre gegen den Doppelstart (bis F6a window._felieArchivPending). */
let ergaenzend = {};

export function felieArchivErgaenzungLaeuft(id) {
  return !!ergaenzend[id];
}

export function felieArchivansichtZuruecksetzen() {
  ergaenzend = {};
}

function finde(chats, id) {
  return chats.filter(function (c) { return (c.id || c.timestamp) === id; })[0] || null;
}

/* Die Aenderung am Eintrag, oder null, wenn nichts dazukommt. Wortgleich
   zur Webapp bis F6a (Notizen, Nummern, Status, Fassung); neu (selbst
   entschieden, F6a): fehlt dem Eintrag die Zusammenfassung oder traegt er
   nur "Unser Gespräch" - nach einem Ausfall -, kommen sie aus der
   Ergaenzung dazu, wie beim spaeten Fertigwerden (archivVervollstaendigen). */
function ergaenzung(current, summary) {
  var verlauf = felieArchivVerlauf(current);
  var liste = felieNotizenLesen(current, true).filter(function (n) { return n.text || n.ursprungstext || n.nachweis; });
  var anzahl = liste.length;
  felieNotizenLesen(summary).forEach(function (n) {
    var schluessel = felieNotizSchluessel(n.text);
    if (liste.some(function (e) { return felieNotizSchluessel(e.text) === schluessel ||
      (e.ursprungstext && felieNotizSchluessel(e.ursprungstext) === schluessel); })) return;
    var q = felieArchivFeldQuelle(n.text, n.nachweis, verlauf);
    if (!q) return;
    var nummer = liste.length;
    while (liste.some(function (e) { return e.id === 'notiz:' + nummer; })) nummer++;
    liste.push({ id: 'notiz:' + nummer, art: n.art, thema: n.thema, text: n.text,
      merken: n.merken !== false, nachweis: q });
  });
  var status = summary.notizenStatus || 'vollstaendig';
  var aenderung = { notizen: liste, notizenStatus: status, version: 5 };
  var neuZf = !current.zusammenfassung && summary.zusammenfassung && summary.zusammenfassung.text;
  if (neuZf) aenderung.zusammenfassung = { text: summary.zusammenfassung.text,
    nachweis: felieArchivFeldQuelle(summary.zusammenfassung.text, summary.zusammenfassung.nachweis, verlauf) };
  var neuTitel = (!current.thema || current.thema === 'Unser Gespräch') && summary.thema && summary.thema !== 'Unser Gespräch';
  if (neuTitel) aenderung.thema = felieKrisenTitel(summary.thema) || summary.thema;
  aenderung.notizenGrund = felieArchivNotizenGrund({ notizenStatus: status, notizen: liste,
    zusammenfassung: aenderung.zusammenfassung || current.zusammenfassung }, summary.notizenGrund);
  var zustandNeu = felieArchivZustand({ notizenStatus: status, notizenGrund: aenderung.notizenGrund });
  var changed = liste.length > anzahl || !Array.isArray(current.notizen) || current.notizenStatus !== status
    || neuZf || neuTitel || zustandNeu !== felieArchivZustand(current);
  return changed ? aenderung : null;
}

/* Ergebnis: 'ok' (geschrieben), 'laeuft' (eine Ergaenzung oder die
   Auswertung des Gespraechsendes laeuft), 'fehlt' (kein solcher Eintrag,
   auch: inzwischen geloescht), 'geloescht_gesperrt' (eine alte Notiz wurde
   bewusst geloescht - keine Neuerzeugung, die sie zurueckbraechte),
   'bearbeitet' (inzwischen geaendert - nichts ueberschrieben), 'nichts_neu',
   'fehler', 'ueberholt' (Kontowechsel; nichts geschrieben, keine Meldung). */
export async function felieArchivNotizenErgaenzen(id) {
  var chat = finde(getSavedChats(), id);
  if (!chat) return 'fehlt';
  if (ergaenzend[id]) return 'laeuft';
  var z = felieArchivZustand(chat);
  if (z === 'laeuft' || z === 'nachholen') return 'laeuft';
  var vorhanden = felieNotizenLesen(chat, true), vorher = JSON.stringify(vorhanden);
  if (!Array.isArray(chat.notizen) && vorhanden.some(function (n) {
    return !n.text && n.nachweis && n.nachweis.quelle === 'selbst';
  })) return 'geloescht_gesperrt';
  ergaenzend[id] = true;
  try {
    var summary;
    /* AL-105: ohne gesperrte Stellen, der Index bleibt die Kennung. Nach
       einem Kontowechsel bricht die Auswertung selbst ab (felieUeberholt). */
    try { summary = await felieNotizErzeugen(felieArchivVerlauf(chat), vorhanden); }
    catch (e) { return e && e.felieUeberholt ? 'ueberholt' : 'fehler'; }
    var current = finde(getSavedChats(), id);
    if (!current) return 'fehlt';
    if (JSON.stringify(felieNotizenLesen(current, true)) !== vorher) return 'bearbeitet';
    var aenderung = ergaenzung(current, summary);
    if (!aenderung) return 'nichts_neu';
    var ok = felieVorgangPort()(function (s, chats) {
      var c = finde(chats, id);
      if (!c) throw new Error('Gespräch fehlt');
      Object.keys(aenderung).forEach(function (k) {
        if (aenderung[k] === undefined) delete c[k]; else c[k] = aenderung[k];
      });
      felieNotizVorschau(c);
    });
    return ok ? 'ok' : 'fehler';
  } finally {
    delete ergaenzend[id];
  }
}

/* ── Namensform alter Zusammenfassungen (bis F6a in index.html) ─────
   "Sie", "Die Nutzerin", "Nutzerin" am Anfang werden zum Namen aus dem
   Profil. Ein Name, der selbst wie das ersetzte Wort aussieht, bleibt weg -
   er waere beim Zurueckschreiben nicht zu unterscheiden. */
function anzeigeName() {
  var n = felieKontextProfil().userName;
  n = typeof n === 'string' ? n.replace(/\s+/g, ' ').trim() : '';
  return (!n || /^sie$/i.test(n)) ? '' : n;
}

export function felieTextMitName(text) {
  var t = text == null ? '' : String(text);
  var n = anzeigeName();
  if (!n || !t) return t;
  return t.replace(/^(Sie|Die Nutzerin|Nutzerin)(?=\s)/, n);
}

/* ── Kartendaten ────────────────────────────────────────────────── */

/* Zuerst, was gerade entsteht (Karte "in Arbeit"), dann die Eintraege,
   neueste zuerst. Texte unmaskiert. Eine Karte mit Zusammenfassung zeigt
   sie (E08), sonst ihre Notizen als knappe Angabe (B-5b). */
export function felieArchivKarten() {
  var chats;
  try { chats = getSavedChats(); } catch (e) { chats = []; }
  var karten = felieGespraecheInArbeit().map(function (a) {
    var d = new Date(a.ts || Date.now()), laeuft = felieAbschlussLaeuft(a.id);
    return { inArbeit: true, laedt: laeuft, id: a.id, titel: felieGespraechInArbeitTitel(a),
      datum: d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · '
        + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      zusammenfassung: null, notizen: [], zustand: laeuft ? 'laeuft' : 'nachholen',
      zustandText: felieGespraechInArbeitText(a), ergaenzbar: false };
  });
  return karten.concat(chats.slice().reverse().map(function (c) {
    var titel = felieKrisenTitel(c.thema) || 'Gespräch';
    var zf = c.zusammenfassung && c.zusammenfassung.text ? felieTextMitName(c.zusammenfassung.text) : null;
    return { inArbeit: false, laedt: false, id: c.id || c.timestamp, titel: titel, datum: felieArchivKartenDatum(c),
      zusammenfassung: zf,
      notizen: zf ? [] : felieNotizenLesen(c).map(function (n) {
        return { id: n.id, thema: felieKrisenTitel(n.thema) || titel, text: felieAngabeAnzeige(n.text) };
      }),
      zustand: felieArchivZustand(c), zustandText: felieArchivZustandText(c), ergaenzbar: felieArchivErgaenzbar(c) };
  }));
}
