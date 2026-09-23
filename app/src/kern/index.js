/* Einstieg in den felie-Kern (Welle D, Entscheidung D-1).

   Hier steht, was die Webapp, die Tests und spaeter die Expo-App
   gemeinsam importieren. Regeln fuer alles unter src/kern/:

   1. Plattformneutral. Kein window, kein document, kein localStorage,
      kein navigator, kein location. Was der Kern von der Umgebung
      braucht, bekommt er hineingereicht (ab D1: der Speicher-Port).
   2. Der Kern kennt die Anzeige nie; die Anzeige kennt den Kern immer.
   3. Nur benannte Exporte, Importe nur relativ und mit Endung .js -
      der Browser laedt ohne Build-Schritt, er kennt weder nackte
      Paketnamen noch Pfade ohne Endung.
   4. Jede Datei unter src/kern/ ist von hier aus erreichbar. Eine Datei,
      die niemand importiert, kommt in der Webapp nie an.
   5. Jeder Export hier ist ein Name, den die Webapp-Bruecke ans window
      haengt. Deklariert index.html denselben Namen noch selbst, ist das
      eine Kollision und haelt die App an - absichtlich.

   Alle fuenf prueft tests/felie-d0-modulweg.test.cjs. */

export { felieKernProbe } from './probe.js';
