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

/* Seit F6d-1: Profil-Anschluss (einwilligung.js). Name, Alter und
   Einwilligungen bleiben Variablen der Webapp; gelesen und geschrieben wird
   beim Aufruf ueber index.html (felieWebappProfilLesen/-Schreiben). */
kern.felieProfilVerbinden({
  lesen: function () { return window.felieWebappProfilLesen(); },
  schreiben: function (p) { return window.felieWebappProfilSchreiben(p); }
});

/* Seit F2a fragt der Kern das Modell an (modell.js). Das Netz ist
   felieFetch aus index.html, beim Aufruf nachgeschlagen (netz-fetch.js).
   Persoenlichkeit, Ritual-Flag und die Uebergabe aus dem Kennenlernen
   kommen aus der Webapp; der Startseiten-Kontext ist seit F5b der des
   Kerns (felieHomeKontext am window). Nachgeschlagen wird beim Aufruf. */
kern.felieNetzVerbinden(felieFetchPort(window));
kern.felieModellVerbinden({
  personalitaet: function () { return window._personality || window.loadPersonality(); },
  ritualFrisch: function () { return window._felieRitualFrisch; },
  homeKontext: function () { return window.felieHomeKontext(); },
  kennenlernenKontext: function () { return window.klUebergabeKontext(); }
});

/* Seit F2b fuehrt der Kern das Gespraech (gespraech.js): die Sitzung liegt
   dort, unabhaengig vom Bildschirm. Die Webapp liest und schreibt sie
   weiter unter ihren alten Namen - als Sicht auf den Kern, wie den
   Zyklus-Zustand seit D7b; chatHistory ist das Array des Kerns selbst (unten ans window).
   Angezeigt wird hier: eine Rueckfrage (addMsg), das Ergebnis eines
   Abschlusses (gespraechAbschliessen), das Ende ohne Abschluss (Loader). */
const SITZUNG_SICHT = {
  _felieRequestPending: 'laeuft', _felieSessionGeneration: 'generation', _lastCut: 'abgeschnitten',
  _felieRueckblickOffen: 'rueckblickOffen', _felieRueckblickAuswahl: 'rueckblickAuswahl', _felieAktiverArchivChat: 'aktiverArchivChat'
};
Object.keys(SITZUNG_SICHT).forEach(function (name) {
  Object.defineProperty(window, name, {
    configurable: true,
    get: function () { return kern.felieSitzung()[SITZUNG_SICHT[name]]; },
    set: function (wert) { kern.felieSitzung()[SITZUNG_SICHT[name]] = wert; }
  });
});
kern.felieGespraechVerbinden({
  nachrichtZeigen: function (text) { window.addMsg(text, 'felie'); },
  abschliessen: function (ergebnis, verlauf, auftrag) { window.gespraechAbschliessen(ergebnis, verlauf, auftrag); },
  ohneAbschluss: function () { window.hideFelieLoader(); }
});

/* Seit F5a fuehrt der Kern das Kennenlernen (aufnahme.js): sein Stand
   liegt dort, die Webapp sieht ihn weiter als window._klState. Name und
   Alter setzt die Webapp in ihre Profil-Variablen (klProfilSetzen), das
   Profil und den Entwurf schreibt sie selbst (saveUserProfile,
   klEntwurfSpeichern); den Verlauf spiegelt sie in klHistory. */
Object.defineProperty(window, '_klState', {
  configurable: true,
  get: function () { return kern.felieKlStand(); },
  set: function (wert) { kern.felieKlStandSetzen(wert); }
});
/* Das Kennenlernen, an das das erste Gespraech anschliesst (seit der
   F5c-Vorarbeit im Kern) - Sicht wie _klState. */
Object.defineProperty(window, '_felieOnboardingChatId', {
  configurable: true,
  get: function () { return kern.felieKlUebergabeChat(); },
  set: function (wert) { kern.felieKlUebergabeChatSetzen(wert); }
});
kern.felieKlVerbinden({
  profilSetzen: function (p) { window.klProfilSetzen(p); },
  profilSichern: function () { return window.saveUserProfile(); },
  entwurfSichern: function () { return window.klEntwurfSpeichern(); },
  verlauf: function (v) { window.klVerlaufUebernehmen(v); }
});

/* Seit F5b fuehrt der Kern die Startseite (startseite.js). Gezeigt wird
   hier: der Satz (felieHomeTextZeigen), das Leeren der Rueckmeldung zur
   Selbstreflexion, die Anzeige nach der Landung; die Webapp sagt, ob die
   Startseite aufgebaut und sichtbar ist, und baut sie neu auf. Alles beim
   Aufruf nachgeschlagen. */
kern.felieStartseiteVerbinden({
  textZeigen: function (t) { window.felieHomeTextZeigen(t); },
  ritualLeeren: function (frisch) { window._felieRitualEchoText = null; if (frisch) window._felieRitualFrisch = null; window.renderRitualEcho(false); },
  ersterEinstieg: function () { return window.klErsterEinstiegZeigen(); },
  einstiegGezeigt: function () { window.klEinstiegAnzeigen(); },
  bereit: function () { return !!document.getElementById('home-open-question'); },
  sichtbar: function () { return window.felieHomeIstSichtbar(); },
  neuAufbauen: function () { window.homeInit(false); },
  kennenlernenSichern: function () { window.klEntwurfSpeichern(); },
  uebergabeGestartet: function () { var el = document.getElementById('kl-first-step'); if (el) el.hidden = true; }
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
