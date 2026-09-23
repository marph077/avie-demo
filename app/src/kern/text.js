/* Texthelfer fuer Notizen und Erinnerungen - seit Welle D, Paket D1a, im Kern.

   Das Repository braucht felieNotizSchluessel, um beim Vergessen gleiche
   Aussagen zu erkennen. Beide Funktionen standen bis D1a in index.html und
   werden dort weiter an vielen Stellen gerufen; die Bruecke haengt sie
   unter demselben Namen ans window. Woertlich uebernommen. */

export function felieNotizText(text) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
}

export function felieNotizSchluessel(text) {
  return felieNotizText(text).toLowerCase().replace(/[.!?]+$/, '');
}
