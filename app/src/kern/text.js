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

/* Titel hoechstens 60 Zeichen (F6a, Befund 5): bis dahin schnitt der Kern
   mitten im Wort ("... mit dem Partn"). Jetzt am letzten Leerzeichen, ohne
   Satzzeichen davor, mit "…"; ein einziges langes Wort hart. */
export function felieTitelKuerzen(text) {
  var t = felieNotizText(text);
  if (t.length <= 60) return t;
  var schnitt = t.slice(0, 59), i = schnitt.lastIndexOf(' ');
  return (i > 0 ? schnitt.slice(0, i) : schnitt).replace(/[\s,;:.\-–—]+$/, '') + '…';
}

/* Ein menschlich gerundeter Zeitraum fuer den Kontext (F6c, Marcel 30.09.):
   felie spricht in Zeitraeumen, nie mit Kalenderdatum. In Ortszeit, nach
   Kalendertagen (nicht 24-Stunden-Bloecken); Wochen ab Montag.
     0 / 1 / 2 Tage     heute / gestern / vorgestern
     3-6 Tage           am <Wochentag>
     Vorwoche           letzte Woche
     Woche davor        vorletzte Woche
     3-4 Wochen         vor drei / vier Wochen
     5-8 Wochen         vor etwa einem Monat
     2-11 Monate        vor zwei ... elf Monaten
     ab 12 Monaten      vor ueber einem Jahr */
var ZEITRAUM_TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
var ZEITRAUM_ZAHL = ['', 'einem', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf'];
export function felieZeitraum(ts, jetztMs) {
  if (ts == null || !Number.isFinite(Number(ts)) || !ts) return '';
  var d = new Date(Number(ts)), n = new Date(jetztMs == null ? Date.now() : jetztMs);
  var tagD = new Date(d.getFullYear(), d.getMonth(), d.getDate()), tagN = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  var tage = Math.round((tagN - tagD) / 86400000);
  if (tage <= 0) return 'heute';
  if (tage === 1) return 'gestern';
  if (tage === 2) return 'vorgestern';
  if (tage <= 6) return 'am ' + ZEITRAUM_TAGE[d.getDay()];
  var montag = function (t) { var x = new Date(t); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  var wochen = Math.round((montag(tagN) - montag(tagD)) / (7 * 86400000));
  if (wochen <= 1) return 'letzte Woche';
  if (wochen === 2) return 'vorletzte Woche';
  if (wochen <= 4) return 'vor ' + ZEITRAUM_ZAHL[wochen] + ' Wochen';
  var monate = (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth()) - (n.getDate() < d.getDate() ? 1 : 0);
  if (wochen <= 8 || monate < 2) return 'vor etwa einem Monat';
  if (monate <= 11) return 'vor ' + ZEITRAUM_ZAHL[monate] + ' Monaten';
  return 'vor über einem Jahr';
}

/* Der Zeitraum im Text der Angabe (F6c-M1 A, Marcel 30.09.), wie im
   Beispiel "Ihre letzte Periode war vor 14 Tagen (notiert letzte Woche)." -
   vor dem Satzzeichen am Ende. Gemessen: als eigenes Feld ordnete felie
   kuenftige Angaben ("naechste Woche") weiter als kuenftig ein. */
export function felieTextMitZeitraum(text, zeitraum, hinweis) {
  var t = text == null ? '' : String(text);
  if (!t || !zeitraum) return t;
  var klammer = ' (notiert ' + zeitraum + (hinweis ? '; ' + hinweis : '') + ')';
  var m = /([.!?]+)$/.exec(t);
  return m ? t.slice(0, -m[1].length) + klammer + m[1] : t + klammer;
}

/* F6c-M3 A (Marcel 30.09.): feste Zukunftswoerter, deren Zeit seit dem
   Notieren vorbei ist ("naechste Woche", notiert vorletzte Woche). Gemessen:
   mit dem Zeitraum allein nahm felie sie weiter als kuenftig (3/3) und
   erfand einmal ein Datum. Gespeichert bleibt der Text, wie formuliert; der
   Hinweis entsteht bei der Anfrage. "ab morgen" ist ein Beginn, kein Termin;
   "Morgen"/"morgens" sind keine Zukunftswoerter. Tage in Ortszeit, Wochen ab
   Montag - wie felieZeitraum. */
var ZEIT_VORBEI = /(^|[^A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df])(ab\s+)?([Hh]eute|[\u00dc\u00fc]bermorgen|morgen|(?:[Nn]\u00e4chste[nr]?|[Kk]ommende[nr]?|[Dd]iese[nr]?)\s+Woche)(?![A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df])/g;
export function felieZeitVorbei(text, ts, jetztMs) {
  if (!text || ts == null || !Number.isFinite(Number(ts)) || !ts) return '';
  var d = new Date(Number(ts)), n = new Date(jetztMs == null ? Date.now() : jetztMs);
  var tagD = new Date(d.getFullYear(), d.getMonth(), d.getDate()), tagN = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  var tage = Math.round((tagN - tagD) / 86400000);
  var montag = function (t) { var x = new Date(t); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  var wochen = Math.round((montag(tagN) - montag(tagD)) / (7 * 86400000));
  var vorbei = [], m;
  ZEIT_VORBEI.lastIndex = 0;
  while ((m = ZEIT_VORBEI.exec(String(text)))) {
    if (m[2]) continue;
    var wort = m[3].charAt(0).toLowerCase() + m[3].slice(1);
    var um = /^heute/.test(wort) ? tage >= 1 : /^\u00fcbermorgen/.test(wort) ? tage >= 3 : wort === 'morgen' ? tage >= 2
      : /^diese/.test(wort) ? wochen >= 1 : wochen >= 2;
    if (um && vorbei.indexOf(wort) < 0) vorbei.push(wort);
  }
  if (!vorbei.length) return '';
  var liste = vorbei.map(function (w) { return '\u201e' + w + '\u201c'; });
  var zuletzt = liste.pop();
  return (liste.length ? liste.join(', ') + ' und ' + zuletzt + ' liegen' : zuletzt + ' liegt') + ' inzwischen zur\u00fcck';
}
