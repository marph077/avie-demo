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
   ist. Inline-Code, der zur Parse-Zeit laeuft, sieht die Kern-Namen noch
   nicht. Seit D0b startet die App deshalb erst aus dem Waechter heraus
   (felieAppStarten); tests/felie-d0b-startreihenfolge.test.cjs haelt
   fest, dass kein Parse-Zeit-Aufruf einen Kern-Namen erreicht. */

import * as kern from '../kern/index.js';
import { felieLocalStoragePort } from './speicher-localstorage.js';
import { felieFetchPort } from './netz-fetch.js';

/* Seit D1b liest und schreibt der Kern ueber einen Speicher-Port. Er wird
   verbunden, bevor irgendein Name ans window kommt: Inline-Code kann den
   Kern erst danach erreichen, und dann ist der Port schon da. */
kern.felieSpeicherVerbinden(felieLocalStoragePort(window));

/* Seit D1c oeffnet die Bruecke im Kern einen Speichervorgang ueber einen
   Rueckruf, nicht ueber den globalen Namen. Den Vorgang fuehrt bis D1d
   die Webapp (felieDatenAendern in index.html); nachgeschlagen wird erst
   beim Aufruf. */
kern.felieVorgangVerbinden(function (aenderung) { return window.felieDatenAendern(aenderung); });

/* Seit D2b rechnen Signale und Zyklus im Kern; seit D7b liegt auch der
   Zyklus-Zustand dort (felieZyklusLesen/felieZyklusSetzen,
   felieKoerperZeit/felieKoerperZeitSetzen). Kein Rueckruf mehr. */

/* Seit D3b schreibt und liest der Kern das Gedaechtnis. Das letzte
   Gespraech (window._letzteChatId) und die Meldung an die Startseite
   (felieHomeEreignis) bleiben in der Webapp; nachgeschlagen wird erst
   beim Aufruf. Seit D4b setzt der Kern das letzte Gespraech auch. */
kern.felieGedaechtnisVerbinden({
  letzterChat: function () { return window._letzteChatId; },
  letzterChatSetzen: function (id) { window._letzteChatId = id; },
  ereignis: function (art, detail) { window.felieHomeEreignis(art, detail); }
});

/* Seit D4b fuehrt der Kern den Abschlussauftrag, seit D5b schreibt er
   auch das Archiv selbst. Die Sicherung (felieAutosave) bleibt in der
   Webapp. */
kern.felieAbschlussVerbinden({
  sichern: function () { window.felieAutosave(); }
});

/* Seit D5b stellt der Kern die Kontext-Daten zusammen. Profil (userName,
   klAnswers: Deklarationen mit let/const, also nicht am window, aber im
   gemeinsamen globalen Geltungsbereich), offenes Archivgespraech und
   Rueckblick-Auswahl bleiben in der Webapp. */
kern.felieKontextVerbinden({
  profil: function () {
    return { userName: typeof userName !== 'undefined' ? userName : undefined,
      klAnswers: typeof klAnswers !== 'undefined' ? klAnswers : undefined };
  },
  aktiverArchivChat: function () { return window._felieAktiverArchivChat; },
  rueckblickAuswahl: function () { return window._felieRueckblickAuswahl; }
});

/* Seit F2a fragt der Kern das Modell an (modell.js). Das Netz ist
   felieFetch aus index.html, beim Aufruf nachgeschlagen (netz-fetch.js).
   Persoenlichkeit, Ritual-Flag, Startseiten- und Kennenlernen-Kontext
   bleiben in der Webapp (F5, F6); nachgeschlagen wird erst beim Aufruf. */
kern.felieNetzVerbinden(felieFetchPort(window));
kern.felieModellVerbinden({
  personalitaet: function () { return window._personality || window.loadPersonality(); },
  ritualFrisch: function () { return window._felieRitualFrisch; },
  homeKontext: function () { return window.felieHomeKontext(); },
  kennenlernenKontext: function () { return window.klUebergabeKontext(); }
});

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
