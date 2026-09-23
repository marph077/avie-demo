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
