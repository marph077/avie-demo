/* Kennenlernen: die Schritte als Daten (Welle D, AL-73).

   Was jeder Schritt des Kennenlernens zeigt - Titel, felies Hinweis,
   Optionen - und die Regeln seiner Auswahl (multi, max, entweder,
   groups). Bis AL-73 stand die Tabelle in index.html als Rumpf von
   klV2Definition und wurde bei jedem Aufruf neu gebaut; die vier festen
   Schluss-Schritte standen als Liste am Ende von klV2Schritte. Jetzt sind
   beide Daten im Kern: Expo bekommt die Schritte, ohne das Kennenlernen
   der Webapp zu erben. Die Tabelle ist woertlich uebernommen, samt ihrer
   Kommentare; die Pruefsumme je Schritt steht in
   tests/felie-al73-kl-schritte.test.cjs.

   Ablauf und Anzeige bleiben in index.html. Ob Kinder, Zyklus und
   Beschwerden dazukommen, haengt am Stand des Kennenlernens;
   klV2Schritte setzt die Folge dort zusammen.

   Eingefroren: bis AL-73 bekam jeder Aufruf eine eigene Kopie, eine
   Aenderung durch einen Aufrufer blieb bei ihm. Jetzt teilen sich alle
   Aufrufer eine Tabelle - eingefroren kann keiner sie fuer die anderen
   veraendern. Heute schreibt kein Aufrufer hinein (gemessen am 23.09.).

   Das Feld group liest heute niemand; es ist mit uebernommen, nicht
   entfernt. */

function tiefFrieren(o) {
  Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object') tiefFrieren(o[k]); });
  return Object.freeze(o);
}

export const KL_SCHRITTE = tiefFrieren({
  name: { title: 'Wie darf ich dich nennen?', hint: '', group: 'Über dich' },
  alter: { title: 'Wie alt bist du?', hint: 'Dein Alter hilft mir, Dinge passend für deine Lebensphase zu erklären.', group: 'Über dich' },
  leben: { title: 'Wie sieht deine aktuelle Lebenssituation aus?', hint: 'Wie du gerade lebst, hilft mir Vorschläge besser an deinen Alltag anzupassen. Wähl alles aus, was auf dich zutrifft — gern auch mehreres.', group: 'Über dich', multi: true,
    /* Die Gruppentrenner standen frueher als feste Indizes im Renderer
       (i===0, 2, 4). Beim Einschieben zweier Familienoptionen waeren sie
       still verrutscht und haetten "Arbeit & Alltag" mitten in die
       Familie gesetzt — ein Fehler, der nur visuell auffaellt. Sie
       stehen jetzt neben den Optionen, die sie betreffen. */
    groups: { 0: 'Zusammenleben', 2: 'Familie', 6: 'Arbeit & Alltag' },
    /* "Kinder" und "keine Kinder" duerfen nicht beide leuchten: die
       Angabe ginge als Widerspruch ins Gedaechtnis und felie wuerde
       danach zu Kindern nachfragen, die es nicht gibt. Bewusst nur
       dieses eine Paar — "keine Kinder" mit "Kinderwunsch" oder mit
       "schwanger" ist eine gueltige Lebenslage, keine Kollision. */
    entweder: [['Kinder', 'keine Kinder']],
    options: ['alleinlebend', 'Partnerschaft', 'Kinder', 'keine Kinder', 'Kinderwunsch', 'schwanger', 'Elternzeit', 'Vollzeit', 'Teilzeit', 'selbstständig', 'anderes'] },
  kinder: { title: 'Magst du etwas zu deinen Kindern ergänzen?', hint: 'Du hast Kinder erwähnt. Wenn du magst, sag mir kurz, wie viele und wie alt sie sind. Das hilft mir, deine familiären Aufgaben bei Alltagsideen zu berücksichtigen.', group: 'Über dich' },
  themen: { title: 'Was beschäftigt dich gerade am meisten?', hint: 'Lass uns jetzt einen passenden Einstieg für dich finden. Du musst es nicht perfekt formulieren. Erzähl einfach, was gerade bei dir los ist.', group: 'Dein Anliegen', multi: true, max: 3,
    options: ['Schlaf', 'Stress', 'Energie', 'Stimmung', 'Körper', 'Zyklus', 'Ernährung', 'Bewegung', 'Mental Load', 'Familie', 'Arbeit', 'Etwas anderes'] },
  gefuehl: { title: 'Wie fühlst du dich damit?', hint: 'Gleiche Themen fühlen sich oft bei jedem anders an. Sag mir, wie es sich für dich anfühlt — dann kann ich darauf eingehen, was dein Anliegen bei dir auslöst.', group: 'Dein Anliegen', multi: true, max: 2,
    options: ['erschöpft', 'gestresst', 'angespannt', 'überfordert', 'unsicher', 'gereizt', 'traurig', 'neugierig', 'ausgeglichen', 'eigentlich ganz gut', 'schwer zu sagen'] },
  ziel: { title: 'Was möchtest du besser verstehen?', hint: 'Manche möchten sich selbst besser verstehen, andere einfach wissen, worauf sie achten können. Das hilft mir einzuschätzen, welche Erklärungen dir helfen könnten. Es ist aber auch in Ordnung, wenn du es noch nicht weißt.', group: 'Dein Anliegen', multi: true, max: 3,
    options: ['warum ich mich so fühle', 'was mich beeinflusst', 'was mir guttut', 'meinen Körper besser verstehen', 'meine Stimmung besser einordnen', 'Zusammenhänge erkennen', 'Veränderungen bei mir verstehen', 'wissen, worauf ich achten kann', 'weiß ich noch nicht'] },
  koerper: { title: 'Gibt es körperliche oder hormonelle Themen, die ich berücksichtigen sollte?', hint: 'Was in deinem Körper gerade los ist, behalte ich im Hinterkopf und kann es in unseren Gesprächen berücksichtigen. Die Angaben sind freiwillig.', group: 'Dein Körper', multi: true,
    options: ['natürlicher Zyklus', 'hormonelle Verhütung', 'Schwangerschaft', 'Stillzeit', 'Perimenopause / Wechseljahre', 'bekannte körperliche Themen', 'nichts davon', 'später'] },
  zyklus: { title: 'Möchtest du ungefähr sagen, wo du gerade stehst?', hint: 'Wo du in deinem Zyklus ungefähr stehst, kann mir dabei helfen zu verstehen, welche Körpersignale du gerade fühlst. Deine eigene Einschätzung genügt, genau muss es nicht sein.', group: 'Dein Körper',
    options: ['Periode', 'kurz danach', 'Zyklusmitte', 'kurz vor der Periode', 'weiß ich nicht'] },
  beschwerden: { title: 'Seit wann beschäftigt dich das?', hint: 'Ob dich das erst seit Kurzem begleitet oder schon länger, macht für mich einen Unterschied. Ein ungefährer Zeitraum reicht völlig.', group: 'Dein Körper' },
  daten: { title: 'Möchtest du ein Wearable verknüpfen?', hint: 'Wenn du magst, kannst du Daten aus deinem Wearable ins Gespräch holen. Nötig ist das nicht, ich komme auch ohne aus. Es gibt uns eventuell zusätzlich Aufschluss über deine Körper- und Gefühlslage.', group: 'Deine Daten',
    options: ['Wearable verknüpfen', 'Ohne Wearable weiter'] },
  schlafqualitaet: { title: 'Wie hat sich deine letzte Nacht angefühlt?', hint: 'Wie du deine Nacht selbst erlebt hast, sagt mir oft mehr als jede Zahl. Erzähl mir, wie sich die letzte angefühlt hat.', group: 'Deine Daten',
    options: ['kaum geschlafen', 'oft wach', 'unruhig', 'okay', 'ruhig', 'erholsam'] },
  schlafroutine: { title: 'Wie sieht deine Schlafroutine meist aus?', hint: 'Wann dein Tag endet und wann er beginnt, sagt mir viel über deinen Rhythmus. Damit kann ich Ideen für deinen Abend besser an deinen Tagesablauf anpassen.', group: 'Deine Daten' },
  /* Der Abschluss hatte als einziger Schritt keine Bubble — felie fuehrt
     zwoelf Schritte lang das Gespraech und schweigt ausgerechnet bei der
     Uebergabe. Der Hinweis auf die Selbstreflexion stand vorher mitten in
     der Schlaffrage und unterbrach sie; als Ausblick gehoert er hierher.
     Die beiden Ortsangaben tragen die echten Bedienlabels ("Gedächtnis"
     in der Navigation, "Selbstreflexion" als Pille auf der Startseite) —
     ein erfundener Name waere schlimmer als gar kein Hinweis.
     Zweigeteilt, weil die Ruecksicht auf ihre Angaben dazwischen
     gehoert: erst verabschieden, dann wiedergeben, was angekommen ist,
     dann sagen, wo es liegt. Am Stueck stand der Verweis aufs
     Gedaechtnis vor dem, worauf er sich bezieht. */
  zusammenfassung: { title: 'So können wir anfangen:', group: 'Dein Einstieg',
    hint: 'Das war\u2019s mit dem Kennenlernen, danke für deine Zeit.',
    hintDanach: 'Das Wichtigste habe ich mir gemerkt — ändern kannst du das jederzeit im Abschnitt **Gedächtnis**. Wie es dir gerade geht, kannst du später auf der Startseite unter **Selbstreflexion** festhalten.' }
});

/* Die vier Schritte, mit denen jedes Kennenlernen endet, in dieser Folge. */
export const KL_SCHRITTE_ENDE = Object.freeze(['daten', 'schlafqualitaet', 'schlafroutine', 'zusammenfassung']);

/* Die Definition eines Schritts; unbekannt: undefined. Wie bisher ein
   einfacher Zugriff auf die Tabelle. */
export function klV2Definition(key) {
  return KL_SCHRITTE[key];
}
