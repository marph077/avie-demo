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

   6. Keine freien Namen ausser JS-Standard und eigenen Importen - der
      Kern ruft nichts, was nur in index.html steht.

   Alle sechs prueft tests/felie-d0-modulweg.test.cjs.

   Stand D1b: Repository (repository.js), Texthelfer (text.js), Speicher-Port
   und Schluessel (speicher.js), Store und Datensatz (store.js), Neu-Hinweise
   (neu-hinweise.js), gespeicherte Gespraeche lesen (gespraeche.js).
   Seit D1c: Bruecke Altbestand <-> Repository mit Vorgangs-Port (bruecke.js).
   Seit D1d: der Speichervorgang (vorgang.js).
   Seit D2b: Signale (signale.js) und Zyklus (zyklus.js).
   Seit D3b: Gedaechtnis-Inhalt (gedaechtnis.js).
   Seit D4b: Abschlussauftrag und Pruefung der Auswertung (abschluss.js).
   Seit D5b: Selbstauskunft (selbstauskunft.js), Archiv-Lesewege
   (archiv.js), Kontext-Daten (kontext.js); saveChat in abschluss.js. */

export { felieKernProbe } from './probe.js';

/* Ganze Module mit export *: die Liste der Namen ist dann das Modul
   selbst, nicht eine zweite, von Hand gepflegte Aufzaehlung (AL-25).
   Die Kehrseite - export * laesst einen Namen still fallen, den zwei
   Module exportieren - prueft tests/felie-d0-modulweg.test.cjs (C6). */
export * from './text.js';
export * from './repository.js';
export * from './speicher.js';
export * from './store.js';
export * from './neu-hinweise.js';
export * from './gespraeche.js';
export * from './bruecke.js';
export * from './vorgang.js';
export * from './zyklus.js';
export * from './signale.js';
export * from './gedaechtnis.js';
export * from './selbstauskunft.js';
export * from './archiv.js';
export * from './kontext.js';
export * from './abschluss.js';

import { felieRepoUhrSetzen, felieRepoZufallSetzen } from './repository.js';
import { felieSpeicherVerbinden } from './speicher.js';
import { felieStoreZuruecksetzen } from './store.js';
import { felieBrueckeZuruecksetzen } from './bruecke.js';
import { felieVorgangZuruecksetzen } from './vorgang.js';
import { felieKoerperVerbinden } from './zyklus.js';
import { felieGedaechtnisVerbinden } from './gedaechtnis.js';
import { felieAbschlussVerbinden, felieAbschlussZuruecksetzen } from './abschluss.js';
import { felieKontextVerbinden } from './kontext.js';

/* Setzt jeden Modulzustand des Kerns zurueck, auch den Speicher-Port. Die
   Tests rufen es vor jeder frischen Laufzeit und verbinden danach ihre
   Ports (Speicher, Vorgang, Koerperdaten, Gedaechtnis, Abschluss, Kontext). Die Webapp ruft es nie: das Loeschen der Nutzerdaten ist etwas
   anderes und laesst den Port verbunden. */
export function felieKernZuruecksetzen() {
  felieRepoUhrSetzen(null);
  felieRepoZufallSetzen(null);
  felieSpeicherVerbinden(null);
  felieStoreZuruecksetzen();
  felieBrueckeZuruecksetzen();
  felieVorgangZuruecksetzen();
  felieKoerperVerbinden(null);
  felieGedaechtnisVerbinden(null);
  felieAbschlussZuruecksetzen();
  felieAbschlussVerbinden(null);
  felieKontextVerbinden(null);
}
