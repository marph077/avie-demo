/* Gespeicherte Gespraeche lesen - seit Welle D, Paket D1b, ein
   Kern-Modul. Nur der Lesezugriff: die Bruecke (D1c) braucht ihn im Kern.
   Das Schreiben (saveChat und die Archivpfade) bleibt bis D5 in index.html.

   Der urspruengliche Wortlaut folgt unveraendert; geaendert ist nur der
   Zugriff auf localStorage. */

import { felieSpeicherLesen } from './speicher.js';

export function getSavedChats() {
  try {
    var list = JSON.parse(felieSpeicherLesen('felie_saved_chats') || '[]');
    return Array.isArray(list) ? list.filter(function(c) { return c && typeof c === 'object'; }) : [];
  } catch(e) { return []; }
}

/* Die Datumszeile einer Archivkarte (F2b-2, Wortlaut freigegeben von
   Marcel am 25.09.): "4. Sept. 2026 · 14:30", nach einer Fortsetzung
   "4. Sept. 2026 · fortgesetzt am 25. Sept." - ohne Uhrzeit, das Jahr beim
   zweiten Datum nur, wenn es ein anderes ist. fortgesetzt traegt immer
   die letzte Fortsetzung. */
export function felieArchivKartenDatum(chat) {
  var d = new Date(chat.timestamp);
  var datum = d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
  if (!Number.isFinite(chat.fortgesetzt)) return datum + ' · ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  var f = new Date(chat.fortgesetzt);
  var form = f.getFullYear() === d.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' };
  return datum + ' · fortgesetzt am ' + f.toLocaleDateString('de-DE', form);
}
