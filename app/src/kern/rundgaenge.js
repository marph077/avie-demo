/* Rundgaenge der App (F6g-1): Schritte als Daten - Ziel (der Name, unter dem
   die App ein Element anmeldet; null: ohne Ziel, Blase in der Mitte), Text
   (Fett in **...**), nurWennDa (der Schritt entfaellt, wenn sein Ziel gerade
   nicht da ist, z. B. der Reiter "Neu"). Der Rundgang zeigt nur; er wechselt
   nichts in der App.

   Wortlaute freigegeben (Marcel 01.10., docs/f6g-rundgaenge-ist-soll.md
   Abschnitt 4: Webapp-Wortlaute, wo sie stimmen; angepasst oder neu, wo der
   Aufbau der App anders ist oder eine Aussage nicht mehr stimmte - R4, R5).
   "App-Guide" gesehen: derselbe Schluessel wie in der Webapp. */
import { felieSpeicherLesen, felieSpeicherSchreiben } from './speicher.js';

function frieren(o) {
  Object.values(o).forEach(function (v) { if (v && typeof v === 'object') frieren(v); });
  return Object.freeze(o);
}

export const FELIE_RUNDGANG_TEXTE = frieren({
  appGuide: 'App-Guide',
  erklaerung: 'Erklärung',
  hilfe: 'App-Guide ansehen',
  weiter: 'Weiter →',
  los: 'Los geht\'s ✦',
  ueberspringen: 'Überspringen'
});

export const FELIE_RUNDGAENGE = frieren({
  startseite: [
    { ziel: null, text: 'Schön, dass du da bist. Ich bin **felie** — deine persönliche Begleiterin. Lass mich dir kurz zeigen, wie ich aufgebaut bin.' },
    { ziel: ['startseite-blase', 'startseite-eingabe'], text: 'Wenn du hereinschaust, begrüße ich dich und stelle dir eine **Frage** — immer mit Blick darauf, worüber wir zuletzt gesprochen haben. Hier **antwortest du mir** — schreib einfach, was dir auf dem Herzen liegt. Daraus wird unser Gespräch, ganz ohne Urteilen.' },
    { ziel: 'startseite-ritualkarte', text: 'Hier siehst du, was du mir heute erzählt hast: **Nacht, Energie und Stimmung**. Ein Tipp auf die Karte öffnet deine **Selbstreflexion** — dort trägst du in einem Moment ein, wie es dir geht. Solange von heute noch nichts da ist, steht hier „noch keine Angaben von heute“ — das ist alles. **Kein Haken, keine Serie, kein schlechtes Gewissen.**' },
    { ziel: 'startseite-zyklus', text: 'Darunter steht deine **Zyklusphase** — oder deine Lebensphase, wenn du keinen Zyklus einträgst. Ein Tipp klappt die Einzelheiten auf.' },
    { ziel: 'neuer-chat', text: 'Über **Neuer Chat** startest du jederzeit ein Gespräch mit mir — zu einem bestimmten Thema oder einfach frei drauflos. Ich erinnere mich an das, was wir schon besprochen haben.' },
    { ziel: 'archiv', text: 'Im **Archiv** findest du deine gespeicherten Gespräche und die Notizen zu allen wichtigen besprochenen Themen. So kannst du frühere Inhalte jederzeit wieder aufrufen.' },
    { ziel: 'gedaechtnis', text: 'In meinem **Gedächtnis** siehst du, was ich von dir mitgenommen habe — was gerade läuft, meine Notizen aus unseren Gesprächen und was ich über dich weiß. Du kannst dort alles ändern, ergänzen oder löschen.' },
    { ziel: 'startseite-einstellungen', text: 'Oben rechts liegen deine **Einstellungen**: wie ich mit dir spreche, deine Einwilligungen, dein Konto und Hilfe.' },
    { ziel: null, text: 'Das war\'s schon. Du bestimmst das Tempo — schreib mir einfach, wenn du magst. Ich freue mich auf dich.' }
  ],
  spiegel: [
    { ziel: null, text: 'Hier ist deine **Selbstreflexion**: was du mir heute erzählt hast — und was sich mit der Zeit bei dir zeigt.' },
    { ziel: 'spiegel-selbstreflexion', text: 'Hier trägst du in einem Moment ein, wie deine Nacht war, wie viel Energie du hast und wie du dich fühlst.' },
    { ziel: 'spiegel-heute', text: 'Darunter steht, **was ich heute von dir weiß**. Tippe auf eine Zeile, um etwas zu ändern. Am Morgen fängt die Liste neu an — was du mir vorher erzählt hast, behalte ich trotzdem.' },
    { ziel: 'spiegel-muster', text: 'Und hier, **was bei dir zusammenhängt** — sobald ich genug Reflexionen von dir habe. Vorher sage ich dir das ehrlich, statt etwas zu behaupten.' }
  ],
  /* Ziele sind die Reiter, nicht die Karten: der Rundgang wechselt keinen
     Reiter und markiert "Neu" nicht als gesehen (R2). */
  gedaechtnis: [
    { ziel: null, text: 'Das ist mein **Gedächtnis**. Hier liegt alles, was ich von dir mitbekommen habe — und du siehst es vollständig. Jeder Eintrag lässt sich ändern, ergänzen oder löschen. Nichts davon musst du pflegen: was ich für eine Antwort brauche, frage ich dich einfach.' },
    { ziel: 'tab-neu', nurWennDa: true, text: '**Neu** — was aus deinem letzten Gespräch dazugekommen ist, bis du es einmal angesehen hast. Nach unserem Kennenlernen steht hier, was ich mir daraus gemerkt habe.' },
    { ziel: 'tab-aktuell', text: '**Aktuell** — Themen, die ich eine Weile mitdenke, z.B. „Abgabe nächste Woche“. Abhaken musst du nichts: wenn die Zeit um ist, frage ich hier einmal nach, ob es noch aktuell ist.' },
    { ziel: 'tab-gespraeche', text: '**Gespräche** — meine Notizen vom Ende eines Gesprächs, nach Themen filterbar. Löschen entfernt nur die Notiz; das Gespräch bleibt im Archiv.' },
    { ziel: 'tab-ueberdich', text: '**Über dich** — deine Angaben und was ich aus unseren Gesprächen über dich weiß. Hier kannst du auch selbst etwas ergänzen.' }
  ],
  /* Bei leerem Archiv zeigt die App waehrend des Rundgangs die Beispielkarte
     (G-5 A); sie meldet sich unter demselben Namen an. */
  archiv: [
    { ziel: null, text: 'Dein **Archiv** enthält deine gespeicherten Gesprächsverläufe und die zusammengefassten Notizen dazu. Wie viele Notizen entstehen, hängt von den wichtigen neuen Inhalten ab. Was ich mir daraus über dich gemerkt habe, findest du auch im **Gedächtnis**.' },
    { ziel: 'archiv-erste-karte', text: 'Jedes Gespräch zeigt eine kurze Zusammenfassung und seine **Notizen**. Tippe auf „Chat öffnen“, um wieder einzusteigen.' }
  ]
});

/* Die Beispielkarte im Archiv (G-5 A): 1:1 aus der Webapp, nur waehrend
   des Archiv-Rundgangs bei leerem Archiv, ohne "Chat öffnen". */
export const FELIE_RUNDGANG_BEISPIEL = frieren({
  marke: 'Beispiel',
  titel: 'Schlaf & Energie',
  notizen: [
    ['Abendroutine', 'Möchte vor dem Schlafen weniger Zeit am Handy verbringen.'],
    ['Erholung', 'Geht zur Entspannung gern spazieren.']
  ]
});

/* Die Schritte eines Rundgangs fuer die Anzeige; da(ziel) sagt, ob ein
   bedingtes Ziel gerade da ist (ohne da: alle). */
export function felieRundgang(name, da) {
  var liste = FELIE_RUNDGAENGE[name];
  if (!liste) return [];
  return liste.filter(function (s) { return !s.nurWennDa || typeof da !== 'function' || !!da(s.ziel); });
}

/* Knopf "App-Guide" (G-2 A): sichtbar, bis sie den Rundgang einmal geoeffnet
   hat; danach Einstellungen › Hilfe "App-Guide ansehen". */
export function felieAppGuideGesehen() {
  try { return !!felieSpeicherLesen('felie_guide_home'); } catch (e) { return false; }
}
export function felieAppGuideGesehenSetzen() {
  try { felieSpeicherSchreiben('felie_guide_home', '1'); } catch (e) {}
}
