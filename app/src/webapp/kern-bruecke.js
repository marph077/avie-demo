/* Webapp-Bruecke zum Kern (Welle D, D0).

   Laedt den Kern als ES-Modul und haengt jeden Export ans window, damit
   der verbliebene Inline-Code in index.html ihn unter seinem bisherigen
   globalen Namen findet. Diese Datei gehoert NUR zur Webapp; Tests und
   Expo importieren src/kern/index.js direkt.

   Zwei Zusicherungen:

   1. Kein vorhandener Name wird ueberschrieben. Eine Funktion, die in
      index.html noch deklariert ist UND im Kern steht, waere zweimal da;
      welche gilt, hinge an der Ladereihenfolge, und nichts braeche.
      Genau diese Fehlerform (still anders) wird hier zum Halt: die
      Kollision landet in FELIE_KERN.kollisionen, der Waechter in
      index.html zeigt den Fehlerschirm. Das gilt auch fuer Namen, die
      der Browser selbst belegt (name, status, open ...).
   2. FELIE_KERN wird als LETZTES gesetzt. Steht es im window, ist jeder
      Export angekommen. Bricht der Import oder diese Datei vorher ab,
      fehlt es - und der Waechter sieht das bei DOMContentLoaded.

   Achtung Zeitpunkt: Module laufen erst, NACHDEM das Dokument geparst
   ist. Inline-Code, der zur Parse-Zeit laeuft (heute initApp), sieht die
   Kern-Namen noch nicht. Das regelt Paket D0b, bevor D1 Logik verschiebt. */

import * as kern from '../kern/index.js';

const namen = Object.keys(kern).sort();
const kollisionen = [];

for (const name of namen) {
  if (name in window) {
    kollisionen.push(name);
    continue;
  }
  window[name] = kern[name];
}

window.FELIE_KERN = Object.freeze({
  namen: Object.freeze(namen),
  kollisionen: Object.freeze(kollisionen)
});
