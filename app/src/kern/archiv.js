/* Archiv-Lesewege - seit Welle D, Paket D5b, ein Kern-Modul.

   Was aus einem gespeicherten Gespraech weiter verwendet werden darf: der
   sichere Verlauf (ohne Befund, versteckte und gesperrte Nachrichten),
   die Daten fuer die Auswertung, die Belegpruefung und die Nutzbarkeit
   von Archivnotizen. Geprueft vor dem Umzug: felie-d5-archiv (D5a).
   Das Schreiben ins Archiv (saveChat) steht beim Abschlussauftrag
   (abschluss.js).

   Der urspruengliche Wortlaut folgt unveraendert. */

import { getSavedChats } from './gespraeche.js';
import { felieNotizPruefen, felieNotizenLesen } from './gedaechtnis.js';

/* DATA CONTRACT v6: origin and display location are separate. Keep legacy
   archive exclusions readable, but apply one predicate to every AI selector.
   Expo: move these operations to repositories with a real DB transaction. */
/* Eine Notiz ist nur nutzbar, solange die Stellen, auf die sie sich
   stuetzt, nutzbar sind. Bisher wurde nur die Notiz selbst gesperrt —
   eine Sperre auf der Ursprungsnachricht lief ins Leere, und eine
   anders formulierte Ableitung derselben Aussage ging weiter mit
   (Altlast A3, Pruefall F45). */
export function felieArchivBelegGesperrt(chat, notiz) {
  var aus = chat.kontextNachrichtenAuslassen || [];
  if (!aus.length) return false;
  var belege = (notiz && notiz.nachweis && notiz.nachweis.belege) || [];
  return belege.some(function (b) { return aus.indexOf(b.nachricht) >= 0; });
}

export function felieArchivNotizNutzbar(chat, notiz) {
  return !!(notiz && notiz.merken !== false &&
    (chat.kontextAuslassen || []).indexOf(notiz.id) < 0 &&
    (chat.begruessungAuslassen || []).indexOf(notiz.id) < 0 &&
    !felieArchivBelegGesperrt(chat, notiz) &&
    felieArchivNotizQuelle(chat, notiz));
}

export function felieArchivDaten() {
  var chats = getSavedChats().filter(function(c) {
    return felieNotizenLesen(c).some(function(n) { return felieArchivNotizNutzbar(c, n); });
  }).slice(-6).reverse();
  var out = [];
  chats.forEach(function(c) {
    felieNotizenLesen(c).forEach(function(n) {
      var quelle = felieArchivNotizNutzbar(c, n) && felieArchivNotizQuelle(c, n);
      if (quelle) out.push({ datum: c.timestamp, bearbeitetAm: n.nachweis && n.nachweis.bearbeitetAm || null,
        thema: n.thema || c.thema, quelle: quelle, notiz: n.text,
        zeitbezug: 'damaliger Stand; kein offener Auftrag und kein Beleg für Fortdauer' });
    });
  });
  return out;
}

export function felieArchivNotizQuelle(chat, notiz) {
  var text = notiz ? notiz.text : chat && chat.felie_lernt;
  if (!text || !text.trim()) return null;
  var q = notiz ? notiz.nachweis : chat.feldQuelle && chat.feldQuelle.felie_lernt;
  if (q && q.quelle === 'selbst') return 'von der Nutzerin bearbeitete Gedächtnisnotiz';
  if (q && q.quelle === 'zusammenfassung' && felieArchivFeldQuelle(text, q, chat.messages))
    return 'sinngemäße Notiz zu belegten Nutzerangaben; keine unabhängige Bestätigung';
  if (q && q.quelle === 'beleg' && felieArchivZitat(text, chat.messages)) return 'belegte Originalaussage aus einem früheren Gespräch';
  return null;
}
export function felieArchivZitat(text, messages) {
  if (!text || typeof text !== 'string') return false;
  var source = felieExtraktionsDaten(felieSichererVerlauf(messages));
  return source.some(function(m) {
    return m.rolle === 'user' && felieBeleg({ nachricht: m.id, beleg: text }, source, 220) === text;
  });
}

export function felieSichererVerlauf(hist) {
  return ohneBefunde(hist).filter(function(m) {
    return m && !m.hidden && !m.internal && !m.kontextAuslassen && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
  });
}

export function felieExtraktionsDaten(hist) {
  return felieSichererVerlauf(hist).map(function(m, i) {
    /* Was gesperrt ist, steht der erneuten Auswertung nicht zur
       Verfuegung — auch dann nicht, wenn es woertlich in der
       Ursprungsnachricht steht (E15, Pruefall F14). */
    return { id: i, rolle: m.role, text: m.inhaltBereinigt != null ? m.inhaltBereinigt : m.content };
  });
}

export function felieArchivFeldQuelle(text, q, messages) {
  if (q && q.quelle === 'zusammenfassung' && q.text === text) {
    var n = felieNotizPruefen({ text: text, belege: q.belege }, felieExtraktionsDaten(messages), 240);
    if (n) return { quelle: 'zusammenfassung', text: n.text, belege: n.belege };
  }
  if (felieArchivZitat(text, messages)) return { quelle: 'beleg' };
  return null;
}

export function felieBeleg(item, source, max) {
  if (!item || !Number.isInteger(item.nachricht) || typeof item.beleg !== 'string') return null;
  var s = source.find(function(m) { return m.id === item.nachricht && m.rolle === 'user'; });
  var quote = item.beleg.trim();
  if (!s || quote.length < 3 || quote.length > max || s.text.indexOf(quote) < 0) return null;
  if (s.text.trim().length <= max) return s.text.trim();
  // Bei langen Nachrichten nur ganze Sätze zulassen; "nicht" darf nicht
  // durch das Herausschneiden eines Teilsatzes verloren gehen.
  var pos = s.text.indexOf(quote), before = s.text.slice(0, pos), after = s.text.slice(pos + quote.length);
  if (!/(?:^|[.!?\n]\s*)$/.test(before) || !/[.!?]$/.test(quote) || !/^(?:\s|$)/.test(after)) return null;
  // Persönliche Inhalte werden als geprüftes Originalzitat übernommen, nicht
  // als unprüfbare Paraphrase. Relevanz/Korrekturen prüft zusätzlich die Nutzerin.
  return quote;
}

export function ohneBefunde(hist) {
  var fluechtig = false;
  return (Array.isArray(hist) ? hist : []).filter(function(m) {
    if (!m) return false;
    if (m.befund) fluechtig = true;
    return !fluechtig;
  });
}
