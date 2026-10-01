/* Startseite: Besuch, Begruessung, Bezug, Ereignisse (F5b, 28.09.2026).

   Bis F5 stand die Startseite in index.html (D-20: "bleibt in der Webapp
   bis F5"). Hier steht jetzt alles davon, was ohne Bildschirm auskommt:
   welche Art Besuch das ist, ob felie neu gruesst, worauf sie sich
   bezieht (genau EIN Punkt, M16), was nach einem Gespraech oder einer
   Aenderung im Gedaechtnis dasteht, wann die Landung nach dem
   Kennenlernen endet - und das Loeschen eines Gespraechs. Webapp und App
   zeigen nur noch an.

   Woertlich uebernommen: Namen, Texte und Kommentare aus index.html. Den
   Gesamtablauf haelt tests/felie-f5-start-gate.test.cjs, die Schwellen und
   Reihenfolgen tests/felie-f5-start-ablauf.test.cjs - beide vor dem Umzug
   gegen die Webapp geschrieben.

   Seit F5c Schritt 6 auch die Karten "Deine letzten Gespraeche"
   (felieStartseiteGespraeche, felieGespraechInArbeitTitel/-Text,
   felieThemaSymbol - frueher fillHomeThemen und themeIcon in index.html)
   und das Vorbereiten nach "Ja, dort anfangen" (felieKlStartseiteVorbereiten,
   frueher in klV2StartApp); festgehalten vorher in
   tests/felie-f5c-startseite.test.cjs.

   Anzeige-Port (felieStartseiteVerbinden), beim Aufruf nachgeschlagen:
     textZeigen(text)          den Satz der Startseite zeigen; setzt auch
                               felieHomeZustand().text (ohne Port: nur das)
     ritualLeeren(frisch)      die Rueckmeldung der Selbstreflexion leeren
     ersterEinstieg()          die Landung nach dem Kennenlernen zeigen, wenn
                               sie gilt -> true (ohne Port: felieKlErsterEinstieg)
     einstiegGezeigt()         nach dem Einstieg: Eingabe zeigen o. ae.
     bereit()                  ist die Startseite aufgebaut (ohne Port: true)
     sichtbar()                ist sie gerade sichtbar (ohne Port: true)
     neuAufbauen()             sie neu aufbauen (Rueckkehr aus dem Hintergrund)
     uebergabeGestartet()      das erste Gespraech nach dem Kennenlernen hat begonnen */

import { felieSpeicherLesen, felieSpeicherSchreiben } from './speicher.js';
import { felieStore } from './store.js';
import { felieEpisoden, felieFakten, felieStandFehler, felieNotizenLesen, felieVorschlaegeAufraeumen } from './gedaechtnis.js';
import { felieAbschlussLaeuft, felieAbschlussVerwerfen, felieGespraecheInArbeit, felieKrisenTitel } from './abschluss.js';
import { getSavedChats } from './gespraeche.js';
import { felieNotizSchluessel } from './text.js';
import { felieAngabenDaten, felieGespraecheDaten, felieKontextProfil, felieKontextDaten, felieRueckblickDaten } from './kontext.js';
import { felieRequest, felieDatenBlock, felieReplyText } from './modell.js';
import { felieVorgangPort, felieBrueckeGespraechId, felieBrueckeAltlinksLoeschen, felieBrueckeBefehl } from './bruecke.js';
import { felieSitzung, felieSitzungNeu, chatHistory } from './gespraech.js';
import { felieAngabeAnzeige } from './anzeige.js';
import { felieKlStand, klV2StartseitenText, felieKlUebergabeStarten, felieKlUebergabeChatSetzen } from './aufnahme.js';
import { FELIE_EINSTELLUNGEN_TEXTE, felieDatenverarbeitungErlaubt } from './einwilligung.js';

var homeStand = null;
var anzeige = null;

export function felieStartseiteVerbinden(port) { anzeige = port || null; }
export function felieStartseiteZuruecksetzen() { homeStand = null; anzeige = null; }

function port(name) { return anzeige && typeof anzeige[name] === 'function' ? anzeige[name] : null; }
function textZeigen(text) {
  var p = port('textZeigen');
  if (p) p(text); else felieHomeZustand().text = text;
}
function ritualLeeren(frisch) { var p = port('ritualLeeren'); if (p) p(!!frisch); }
function bereit() { var p = port('bereit'); return p ? !!p() : true; }
function sichtbar() { var p = port('sichtbar'); return p ? !!p() : true; }
function ersterEinstieg() { var p = port('ersterEinstieg'); return p ? !!p() : felieKlErsterEinstieg(); }

/* Der Startscreen hat einen eigenen, kleinen Kontext und einen Besuchszustand.
   Ansichtswechsel erzeugen keinen neuen Gruß. Aktuelle Handlungen ersetzen
   ihn sofort; verspätete Modellantworten dürfen diese Rückmeldung nicht überholen. */
export function felieHomeZustand() {
  if (!homeStand) {
    var zuletzt = 0;
    try { zuletzt = Number(felieSpeicherLesen('felie_home_zuletzt')) || 0; } catch (e) {}
    homeStand = { text: '', anlass: '', revision: 0, pending: null,
      zuletzt: zuletzt, imHintergrund: false, erneuern: false };
  }
  return homeStand;
}

export function felieHomeBesuch(zuletzt, jetzt) {
  if (!Number.isFinite(zuletzt) || zuletzt <= 0 || zuletzt > jetzt) return 'erster_besuch';
  if (new Date(zuletzt).toLocaleDateString('de-DE') !== new Date(jetzt).toLocaleDateString('de-DE')) return 'neuer_tag';
  return jetzt - zuletzt >= 30 * 60000 ? 'nach_pause' : 'kurze_rueckkehr';
}

export function felieHomeZeitMerken(jetzt) {
  var s = felieHomeZustand();
  s.zuletzt = jetzt || Date.now();
  try { felieSpeicherSchreiben('felie_home_zuletzt', String(s.zuletzt)); } catch (e) {}
}

/* ══ Der Anknuepfungspunkt der Begruessung ══════════════════════
   Seit M16 waehlt die APP genau EINEN Punkt und gibt ihn im Feld `bezug`
   mit. Rangfolge (Marcel, 17.09.): zuerst das Befristete - ein offenes
   Thema, dann das juengste Gespraech, zuletzt eine dauerhafte Angabe.
   Einmal ANGEBOTEN, faellt ein Punkt dauerhaft aus der Auswahl: ob sie
   geantwortet hat, laesst sich nicht zuverlaessig feststellen, und zweimal
   dasselbe zu fragen ist in beiden Faellen falsch. */
export function felieBezugFeld() { return 'begruessungBezuege'; }

export function felieBezugVerbraucht() {
  try { return felieStore().zusatz[felieBezugFeld()] || {}; } catch (e) { return {}; }
}

/* Die Zyklusfrage des Kennenlernens ist eine technische Selbstauskunft,
   kein Thema, das sie mitgebracht hat (Befund 17.09., M19). Ausgeschlossen
   wird nur die AUSWAHL fuer die Begruessung; die Episode bleibt im
   Gedaechtnis und im Kontext. */
export function felieBezugAusgeschlossen() { return ['zyklus']; }

/* Welches Kennenlern-Feld steckt hinter der Episode? Leer, wenn sie im
   Gespraech entstanden ist. */
export function felieBezugKlFeld(e) {
  var id = String((e && e.id) || '');
  return id.indexOf('aufnahme:') === 0 ? id.split(':').pop() : '';
}

/* Nennt ein Punkt seine eigene DAUER, ist "ist das noch so?" eine
   Bestandsabfrage (M20, M26). Woher der Punkt kommt, spielt keine Rolle. */
export function felieBezugDauer(text) {
  var t = String(text || '');
  if (/\bseit\s+[^.,;]{0,24}\b(tag|tage|tagen|woche|wochen|monat|monate|monaten|jahr|jahre|jahren)\b/i.test(t)) return true;
  if (/\bseit\s+(l[äa]ngerem|einiger zeit|geraumer zeit|einer weile|ewigkeiten)\b/i.test(t)) return true;
  /* "..., das seit mehreren Wochen anhaelt" faellt schon oben; das hier
     faengt "haelt weiter an" und "haelt schon lange an". */
  if (/\bh[äa]lt\s+[^.,;]{0,20}\ban\b/i.test(t)) return true;
  return false;
}

export function felieBezugNachfrage(feld, text) {
  if (feld === 'beschwerden' || felieBezugDauer(text))
    return 'Frage NICHT, ob es das noch gibt — das protokolliert nur einen Zustand. '
      + 'Der Punkt nennt seine Dauer selbst; frage stattdessen, ob sie inzwischen Klarheit darüber hat, in dieser Art: '
      + '„Hast du Klarheit über das körperliche Thema, das dich seit drei Wochen beschäftigt?" '
      + 'Nimm dabei IHRE Worte für die Sache, nicht diese Beispielworte. '
      + 'Der Ausweg auf ein anderes Thema bleibt auch hier.';
  return '';
}

export function felieBezugTauglich(e) {
  var id = String((e && e.id) || '');
  if (id.indexOf('aufnahme:') !== 0) return true;
  return felieBezugAusgeschlossen().indexOf(id.split(':').pop()) < 0;
}

export function felieBegruessungBezug(chats, offen) {
  var weg = felieBezugVerbraucht();
  var frei = function (schluessel) { return !Object.prototype.hasOwnProperty.call(weg, schluessel); };

  /* (1) Das juengste offene Thema. */
  var t = (offen || []).find(function (e) {
    return e.id && frei('thema:' + e.id) && felieBezugTauglich(e); });
  if (t) {
    var feld = felieBezugKlFeld(t), nachfrage = felieBezugNachfrage(feld, t.text);
    var b = { art: 'thema', schluessel: 'thema:' + t.id, text: t.text,
      hinweis: nachfrage
        ? 'ein Thema von ihr, das laenger laeuft — keine Tageslage und kein Beleg fuer Fortdauer'
        : 'ein offenes Thema von ihr; zeitlich begrenzt und deshalb wahrscheinlich noch aktuell' };
    if (nachfrage) b.nachfrage = nachfrage;
    return b;
  }

  /* (2) Das juengste Gespraech mit Zusammenfassung. */
  var g = (chats || []).find(function (c) {
    return c.zusammenfassung && frei('gespraech:' + (c.id || c.timestamp)); });
  if (g) {
    var gb = { art: 'gespraech', schluessel: 'gespraech:' + (g.id || g.timestamp),
      text: g.zusammenfassung.text, thema: g.thema || null,
      datum: new Date(g.timestamp).toLocaleDateString('de-DE'),
      hinweis: 'euer Gespraech von diesem Tag; damaliger Stand, kein Beleg fuer Fortdauer' };
    /* Auch eine Zusammenfassung kann eine Dauer nennen — dann gilt
       dieselbe Regel wie beim offenen Thema. */
    var gn = felieBezugNachfrage('', g.zusammenfassung.text);
    if (gn) gb.nachfrage = gn;
    return gb;
  }

  /* (3) Zuletzt eine dauerhafte Angabe - mit Datum und Alter (AL-06); der
     Text selbst bleibt in der Gegenwart, wie in der Gedaechtnis-Karte. */
  var f = null;
  try { f = felieFakten().find(function (x) { return x.id && frei('angabe:' + x.id); }); } catch (e) {}
  if (f) return { art: 'angabe', schluessel: 'angabe:' + f.id, text: f.text,
    datum: Number.isFinite(f.bestaetigtAm || f.erfasstAm)
      ? new Date(f.bestaetigtAm || f.erfasstAm).toLocaleDateString('de-DE') : null,
    alterTage: f.alterTage,
    hinweis: 'eine dauerhafte Angabe; gilt laenger und ist selten das, was sie gerade bewegt' };

  return null;
}

/* Ueber den Vorgang (in der Webapp felieDatenAendern). */
export function felieBezugVerbrauchen(bezug) {
  if (!bezug || !bezug.schluessel) return;
  try {
    felieVorgangPort()(function (store) {
      var feld = felieBezugFeld();
      store.zusatz[feld] = store.zusatz[feld] || {};
      store.zusatz[feld][bezug.schluessel] = Date.now();
    });
  } catch (e) {}
}

export function felieHomeKontext(besuch, anlass) {
  var jetzt = Date.now(), d = new Date(jetzt), chat = null;
  var chats = getSavedChats().filter(function(c) { return Number.isFinite(c.timestamp) && c.timestamp <= jetzt; });
  chats.sort(function(a, b) { return b.timestamp - a.timestamp; });
  /* Aktueller Kontext ja, Archiv nein (E11, Pruefall F21): vom letzten
     Gespraech bleibt das Datum; der Inhalt steht in gespraeche. */
  if (chats.length)
    chat = { datum: new Date(chats[0].timestamp).toLocaleDateString('de-DE'),
      zeitbezug: 'letztes Gespräch; der Inhalt steht in gespraeche' };
  var offen = felieEpisoden({ nurAktuell: true }).filter(function(e) {
    return e.text && Number.isFinite(e.faelligBis) && e.faelligBis > jetzt;
  }).map(function(e) {
    var ts = Math.max.apply(Math, [e.bearbeitetAm, e.zuletztAm, e.erfasstAm].filter(function(t) {
      return Number.isFinite(t) && t <= jetzt;
    }).concat([0]));
    /* Die Kennung wird fuer die Auswahl des Anknuepfungspunkts gebraucht
       und vor dem Senden wieder entfernt. */
    return { id: e.id, text: e.text, aktualisiertAm: ts, status: 'offen' };
  }).sort(function(a, b) { return b.aktualisiertAm - a.aktualisiertAm; });
  var gesehen = {};
  offen = offen.filter(function(e) {
    var key = felieNotizSchluessel(e.text);
    if (Object.prototype.hasOwnProperty.call(gesehen, key)) return false;
    gesehen[key] = true; return true;
  });
  /* Ausgewaehlt wird aus ALLEN offenen Themen, mitgesendet werden zwei. */
  var bezug = felieBegruessungBezug(chats, offen);
  offen = offen.slice(0, 2).map(function (e) {
    return { text: e.text, aktualisiertAm: e.aktualisiertAm, status: e.status }; });
  var anlassText = anlass === 'gespraech_beendet'
      ? 'Gespräch gerade beendet und gespeichert; die Nutzerin ist eben zur Startseite zurückgekehrt'
    : anlass === 'gespraech_verlassen'
      ? 'Gespräch gerade ohne Speichern verlassen; es gibt dazu keine Notiz'
    : anlass === 'kennenlernen'
      ? 'Kennenlernen gerade abgeschlossen; die Nutzerin steht zum ersten Mal auf der Startseite'
      : 'Startseite geöffnet';

  /* Womit sie anfangen wollte - faellt weg, sobald sie danach etwas
     korrigiert hat (dieselbe Regel wie in klUebergabeKontext). */
  var einstieg = null;
  var kl = felieKlStand();
  if (anlass === 'kennenlernen' && kl && kl.landing && kl.landing.active && !kl.contextChanged)
    einstieg = { wahl: kl.landing.choice, angenommenerVorschlag: kl.landing.plan || null,
      hinweis: 'Von ihr eben ausgewählt. Nicht erneut danach fragen.' };

  return { anlass: anlassText, besuch: besuch || 'erster_besuch',
    datum: d.toLocaleDateString('de-DE'), uhrzeit: d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    tageszeit: d.getHours() < 12 ? 'Morgen' : d.getHours() < 18 ? 'Tag' : 'Abend',
    name: felieKontextProfil().userName || null,
    /* Seit M12: die aktuellen Angaben und die Gespraechszusammenfassungen,
       aus derselben Quelle und durch dieselben Sperren wie im Chat (M10). */
    merknotizen: felieAngabenDaten(),
    gespraeche: felieGespraecheDaten(3),
    /* Genau EIN Anknuepfungspunkt, von der App gewaehlt. */
    bezug: bezug,
    letztesGespraech: chat, offeneEpisoden: offen,
    einstieg: einstieg || undefined };
}

export function felieHomeFallback(ctx) {
  var gruss = ctx.besuch === 'kurze_rueckkehr' ? 'Schön, dass du wieder da bist'
    : ctx.tageszeit === 'Morgen' ? 'Guten Morgen' : ctx.tageszeit === 'Abend' ? 'Guten Abend' : 'Hallo';
  gruss += (ctx.name ? ', ' + ctx.name : '') + '.';
  // Ohne Modell keine semantische Umformulierung erraten. Geprueft wird,
  // OB zuletzt gesprochen wurde - nicht, was dabei notiert wurde (M4).
  return gruss + (ctx.letztesGespraech
    ? ' Wenn du magst, knüpfen wir an unser letztes Gespräch an – oder du erzählst, was dir heute wichtig ist.'
    : ' Hier ist Raum für das, was dir gerade wichtig ist.');
}

export function felieHomeBegruessen() {
  if (ersterEinstieg()) return Promise.resolve();
  var s = felieHomeZustand();
  if (!bereit()) return Promise.resolve();
  /* F6d-1 (D-1 A): nach dem Widerruf der feste Satz statt einer Begruessung;
     keine Anfrage (felieRequest sperrt ohnehin, der Fallback-Gruss darf den
     Satz aber nicht verdecken). */
  if (!felieDatenverarbeitungErlaubt()) {
    s.pending = null; s.erneuern = false; ++s.revision;
    s.text = FELIE_EINSTELLUNGEN_TEXTE.ohneEinwilligung;
    textZeigen(s.text);
    return Promise.resolve();
  }
  if (s.text && felieHomeBesuch(s.zuletzt, Date.now()) === 'neuer_tag') s.erneuern = true;
  if (felieHomeFluechtigSchritt(s, sichtbar())) s.erneuern = true;
  if (!s.erneuern && (s.text || s.pending)) {
    if (s.text) textZeigen(s.text);
    return s.pending || Promise.resolve();
  }
  var besuch = felieHomeBesuch(s.zuletzt, Date.now());
  /* Der Anlass geht mit in den Kontext. */
  var anlassOffen = s.anlassOffen; s.anlassOffen = null;
  /* Nach einem Gespraech fragt die Startseite das Modell NICHT (AL-01): der
     Kontext kennt das eben beendete Gespraech noch nicht. Stehen bleibt der
     feste Satz aus felieHomeEreignis(); erneuern wird bewusst
     zurueckgesetzt. Die naechste echte Begruessung kommt beim naechsten
     Besuch - dann ist das Gespraech archiviert und im Kontext. */
  if (anlassOffen === 'gespraech_beendet' || anlassOffen === 'gespraech_verlassen') {
    s.erneuern = false;
    s.anlass = anlassOffen;
    ++s.revision;
    s.pending = null;
    return Promise.resolve();
  }
  var ctx = felieHomeKontext(besuch, anlassOffen);
  /* Verbraucht wird beim ANBIETEN; hier und nicht in felieHomeKontext, weil
     der auch nur lesend aufgerufen wird (felieKontextFuer('startseite')). */
  felieBezugVerbrauchen(ctx.bezug);
  s.erneuern = false; s.anlass = anlassOffen || 'oeffnen';
  var revision = ++s.revision;
  felieHomeZeitMerken();
  ritualLeeren(true);
  /* Sofort einen vollstaendigen Einstieg anbieten, auch offline. */
  if (!anlassOffen || !s.text) textZeigen(felieHomeFallback(ctx));
  var pending = felieRequest('willkommen', [{ role: 'user', content: felieDatenBlock('startscreen', ctx) }],
    { context: false }).then(function(data) {
      if (s.revision !== revision) return;
      var text = felieReplyText(data).trim();
      if (!text || data.stop_reason === 'max_tokens') return;
      textZeigen(text);
    }).catch(function() {
      // Der bereits sichtbare Fallback bleibt bestehen.
    }).finally(function() { if (s.revision === revision) s.pending = null; });
  s.pending = pending;
  return pending;
}

/* Ein Zitat aus ihren eigenen Worten, gekuerzt an der Wortgrenze. */
export function felieHomeZitat(text, max) {
  var t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  var g = max || 64;
  if (t.length <= g) return t;
  var kurz = t.slice(0, g);
  var luecke = kurz.lastIndexOf(' ');
  if (luecke > Math.floor(g / 2)) kurz = kurz.slice(0, luecke);
  return kurz.replace(/[\s,.;:!?–—-]+$/, '') + ' …';
}

/* Die Rueckmeldung nach einem Handgriff im Gedaechtnis nennt, was sich
   geaendert hat (M8, 17.09.) - zitiert wird IHR Wortlaut, wie sie ihn im
   Gedaechtnis liest (seit B-5b ohne "Sie"). Fehlt die Angabe, was passiert
   ist, bleibt es beim festen Satz. */
export function felieHomeAenderungssatz(d) {
  if (!d || !d.was || !d.wie) return null;
  var t = felieHomeZitat(felieAngabeAnzeige(d.text));
  var z = t ? '„' + t + '“' : null;
  if (d.was === 'gespraech') return 'Das Gespräch ist gelöscht.';
  if (d.was === 'notiz') {
    if (d.wie === 'geloescht') return 'Deine Notiz ist gelöscht. Das Gespräch bleibt im Archiv.';
    return t ? 'Ich habe deine Notiz so übernommen: ' + t
             : 'Ich habe deine Notiz übernommen.';
  }
  var thema = d.was === 'thema';
  if (d.wie === 'geloescht') {
    if (thema) return z ? z + ' behalte ich nicht mehr im Blick.'
                        : 'Das offene Thema ist gelöscht.';
    return z ? z + ' ist aus meinem Gedächtnis gelöscht.'
             : 'Die Erinnerung ist aus meinem Gedächtnis gelöscht.';
  }
  if (!t) return null;
  if (d.wie === 'verlaengert') return d.tage
    ? 'Ich behalte es weitere ' + d.tage + ' Tage im Blick: ' + t
    : 'Ich behalte es weiter im Blick: ' + t;
  if (d.wie === 'neu') return thema ? 'Ich behalte das im Blick: ' + t
                                    : 'Ich habe mir gemerkt: ' + t;
  if (d.wie === 'formulierung') return 'Ich habe es so notiert, wie du es gesagt hast: ' + t;
  if (d.wie === 'bestaetigung') return 'Ich behalte es genau so: ' + t;
  return thema ? 'Gut — im Blick behalte ich jetzt: ' + t
               : 'Gut — ich merke mir jetzt: ' + t;
}

/* Die Bestaetigung steht, bis die Startseite das naechste Mal SICHTBAR von
   neuem aufgebaut wird - in zwei Schritten, damit ein Hintergrunddurchlauf
   sie nicht abraeumt, bevor sie sie gelesen hat. */
export function felieHomeFluechtigSchritt(s, istSichtbar) {
  if (!s || !s.text || !s.fluechtig || !istSichtbar) return false;
  if (!s.fluechtigGesehen) { s.fluechtigGesehen = true; return false; }
  s.fluechtig = false; s.fluechtigGesehen = false;
  return true;
}

/* Drei Fassungen des Abschieds nach einem Gespraech, REIHUM statt
   zufaellig; der Zeiger ueberlebt einen Neustart (AL-01). */
export function felieAbschiedssatz() {
  var saetze = [
    'Liegt dir sonst gerade noch etwas auf dem Herzen, über das du mit mir sprechen möchtest?',
    'Falls dir noch ein Thema auf dem Herzen liegt, über das du mit mir sprechen möchtest, bin ich für dich da.',
    'Ich bin für dich da, falls dir noch ein Thema einfällt, über das du mit mir sprechen möchtest.'
  ];
  var i = 0;
  try { i = Number(felieSpeicherLesen('felie_abschied_index')) || 0; } catch (e) {}
  if (!Number.isFinite(i) || i < 0) i = 0;
  i = i % saetze.length;
  try { felieSpeicherSchreiben('felie_abschied_index', String((i + 1) % saetze.length)); } catch (e) {}
  return saetze[i];
}

export function felieHomeEreignis(art, detail) {
  var s = felieHomeZustand();
  var texte = {
    /* Nur Rueckfallwert; angezeigt wird die reihum gewaehlte Fassung. */
    gespraech_beendet: 'Liegt dir sonst gerade noch etwas auf dem Herzen, über das du mit mir sprechen möchtest?',
    gespraech_verlassen: 'Du kannst hier in Ruhe weitermachen, wenn du möchtest.',
    gedaechtnis_geaendert: 'Deine Änderungen im Gedächtnis sind gespeichert.',
    /* "mein", nicht "dein": das Gedaechtnis ist felies, die Angaben darin
       sind ihre. */
    gedaechtnis_geloescht: 'Die ausgewählte Erinnerung ist aus meinem Gedächtnis gelöscht.'
  };
  if (art !== 'selbstreflexion' && !texte[art]) return;
  ++s.revision; s.pending = null;
  /* Nach einem Gespraech: erneuern und Anlass merken (die naechste Runde
     setzt beides wieder zurueck, AL-01). Die Gedaechtnis-Meldungen bleiben
     fest: sie bestaetigen einen Handgriff, den sie gerade selbst getan hat. */
  var nachGespraech = art === 'gespraech_beendet' || art === 'gespraech_verlassen';
  s.erneuern = nachGespraech;
  s.anlassOffen = nachGespraech ? art : null;
  felieHomeZeitMerken();
  /* Der Einstiegstext nach dem Kennenlernen bleibt bei der Selbstreflexion
     stehen (M25): sie ERGAENZT den Einstieg, sie ersetzt ihn nicht. */
  var einstiegBehalten = art === 'selbstreflexion' && s.anlass === 'kennenlernen' && !!s.text;
  if (art === 'selbstreflexion') {
    // Die vorhandene zweite Bubble übernimmt die Rückmeldung zur Reflexion.
    if (!einstiegBehalten && (!s.text || s.anlass !== 'oeffnen')) textZeigen('Hier ist Raum für das, was dir gerade wichtig ist.');
  } else {
    ritualLeeren(false);
    /* Nur die beiden Gedaechtnismeldungen sind fluechtig. */
    s.fluechtig = !nachGespraech;
    s.fluechtigGesehen = false;
    var fest = art === 'gespraech_beendet' ? felieAbschiedssatz() : texte[art];
    textZeigen(felieHomeAenderungssatz(detail) || fest);
  }
  s.anlass = einstiegBehalten ? 'kennenlernen' : art;
}

/* Vordergrund und Hintergrund. Zurueck nach einer Pause oder an einem
   neuen Tag: neu aufbauen - aber nicht waehrend eines Gespraechs oder
   einer Bearbeitung (sichtbar()). */
export function felieHomeSichtbarkeit(aktiv) {
  var s = felieHomeZustand(), jetzt = Date.now();
  if (!aktiv) {
    if (!s.imHintergrund) felieHomeZeitMerken(jetzt);
    s.imHintergrund = true; return;
  }
  if (!s.imHintergrund) return;
  s.imHintergrund = false;
  var besuch = felieHomeBesuch(s.zuletzt, jetzt);
  if (besuch !== 'kurze_rueckkehr') s.erneuern = true;
  var neu = port('neuAufbauen');
  if (sichtbar() && neu) neu();
}

/* Die Landung nach dem Kennenlernen (frueher der Kern von
   klErsterEinstiegZeigen): steht der Einstieg noch, zeigt die Startseite
   klV2StartseitenText statt eines Grusses. Ein neuer Tag oder eine Pause
   beenden die Landung; eine spaetere Handlung (etwa die Selbstreflexion)
   behaelt ihre eigene Rueckmeldung. */
export function felieKlErsterEinstieg() {
  var s = felieKlStand();
  if (!s || ['reflexion','bereit'].indexOf(s.stage) < 0) return false;
  if (s.stage === 'reflexion') { s.stage = 'bereit'; felieKlEintragen(); }
  var home = felieHomeZustand();
  if (s.flow === 2 && s.landing) {
    if (s.landing.active === false) return false;
    var visit = felieHomeBesuch(home.zuletzt || s.landing.ts, Date.now());
    if (visit === 'neuer_tag' || visit === 'nach_pause') { s.landing.active = false; felieKlEintragen(); return false; }
    // A later deliberate action (e.g. self-reflection) keeps its own home response.
    if (home.text && home.anlass && home.anlass !== 'kennenlernen') return false;
  }
  ++home.revision; home.pending = null; home.erneuern = false; home.anlass = 'kennenlernen'; felieHomeZeitMerken();
  textZeigen(s.flow === 2 ? klV2StartseitenText() : 'Du kannst dich erst einmal umschauen oder hier direkt weitersprechen. Was möchtest du mir erzählen?');
  var p = port('einstiegGezeigt'); if (p) p();
  return true;
}
/* Den geaenderten Stand des Kennenlernens sichern (Webapp: klEntwurfSpeichern). */
function felieKlEintragen() {
  var p = port('kennenlernenSichern');
  if (p) { p(); return; }
  try { felieSpeicherSchreiben('felie_onboarding_v1', JSON.stringify(felieKlStand())); } catch (e) {}
}

/* Verteiler der Kontexte je Zweck (Rest von D-20). */
export function felieKontextFuer(zweck, opts) {
  opts = opts || {};
  if (zweck === 'startseite') return felieHomeKontext(opts.besuch, opts.anlass);
  if (zweck === 'rueckblick') return felieRueckblickDaten(opts.gespraeche);
  /* fortsetzung teilt sich die Auswahl mit dem aktuellen Gespraech; genau
     dieses Gespraech faellt heraus (Pruefall F25). */
  if (zweck === 'fortsetzung') {
    return felieKontextDaten([opts.gespraechId != null ? opts.gespraechId
      : felieSitzung().aktiverArchivChat]);
  }
  return felieKontextDaten();
}

/* Ein Gespraech loeschen (Rest von D-20): Archiv, Ableitungen im
   Gedaechtnis und - ist es das Kennenlernen - dessen Verweis. Ergebnis:
   true, wenn geloescht; die Anzeige raeumt danach selbst auf. */
export function felieGespraechLoeschen(id) {
  var auftragId = null;
  var ok = !!felieVorgangPort()(function(s, chats) {
    var c = chats.find(function(x) { return (x.id || x.timestamp) == id; });
    if (!c) throw felieStandFehler('Gespräch fehlt');
    auftragId = c.auftragId || null;
    /* F6c (E09): Vorschlaege aus diesem Gespraech gehen mit. */
    felieVorschlaegeAufraeumen(s, function (v) { return v.gespraechId != null && String(v.gespraechId) === String(id); });
    var cid = felieBrueckeGespraechId(c);
    felieBrueckeAltlinksLoeschen(cid);
    felieBrueckeBefehl({ kind: 'deleteConversation', conversationId: cid });
    var behalten = chats.filter(function(x) { return x !== c; });
    chats.splice.apply(chats, [0, chats.length].concat(behalten));
    var kl = felieKlStand();
    if (c.onboardingId && kl && kl.id === c.onboardingId) {
      kl.archiveId = null; kl.contextChanged = true;
    }
  });
  /* F6a (Befund 4): ein laufender oder wartender Auftrag dieses Gespraechs
     verschwindet mit - sonst legte die fertige Auswertung es neu an. */
  if (ok && auftragId) felieAbschlussVerwerfen(auftragId);
  return ok;
}

/* Ihre Antwort aus dem Feld der Startseite (frueher der Kern von
   homeUserReply): ein neues Gespraech ohne Thema. Das erste nach dem
   Kennenlernen bekommt dessen Uebergabe (felieKlUebergabeStarten); die
   Begruessung steht darin als felies erste Nachricht - nur zur Anzeige
   ("stumm"), ins Modell geht ihre Nachricht. Ergebnis { begruessung, text }
   oder null (leer, oder eine Anfrage laeuft); senden tut der Aufrufer
   (callFelie(text)), damit er vorher anzeigen kann.
   opts: begruessung (sonst der Text der Startseite), zusatz (die
   Rueckmeldung der Selbstreflexion, ein eigener Absatz), sitzungNeu
   (Voreinstellung true; die Webapp setzt die Sitzung selbst zurueck). */
export function felieStartseiteAntworten(text, opts) {
  var t = String(text == null ? '' : text).trim();
  opts = opts || {};
  if (!t || felieSitzung().laeuft) return null;
  if (opts.sitzungNeu !== false) { felieSitzungNeu(); felieKlUebergabeChatSetzen(null); }
  if (felieKlUebergabeStarten()) { var p = port('uebergabeGestartet'); if (p) p(); }
  var begruessung = opts.begruessung != null ? String(opts.begruessung) : felieHomeZustand().text || '';
  if (begruessung === '…') begruessung = '';
  if (opts.zusatz) begruessung += (begruessung ? '\n\n' : '') + opts.zusatz;
  chatHistory.length = 0;
  return { begruessung: begruessung, text: t };
}

/* ── Deine letzten Gespraeche (seit F5c Schritt 6, woertlich aus
   fillHomeThemen, themeIcon, felieGespraechInArbeitTitel/-Text) ────── */

/* Symbol je Thema, nach Stichwort; das erste passende gewinnt ("Stress im
   Job" ist Arbeit). Der Name ohne "i-": die Webapp setzt #i-<name>, die App
   ihr eigenes Symbol gleichen Namens. */
export function felieThemaSymbol(thema) {
  var t = (thema || '').toLowerCase();
  if (/schlaf|müde|insomn|nacht|wach/.test(t)) return 'moon';
  if (/job|arbeit|beruf|chef|kolleg|büro|karriere/.test(t)) return 'box';
  if (/stress|druck|überforder|hektik|last/.test(t)) return 'bolt';
  if (/kind|familie|schwanger|mutter|baby|eltern/.test(t)) return 'heart';
  if (/beziehung|partner|liebe|ehe|freund|date/.test(t)) return 'heart';
  if (/zyklus|hormon|periode|menstr|pms|eisprung/.test(t)) return 'bloom';
  if (/energie|erschöpf|kraftlos|antrieb|müdigkeit/.test(t)) return 'battery';
  if (/sport|bewegung|training|lauf|fitness/.test(t)) return 'run';
  if (/ernähr|essen|appetit|gewicht|hunger/.test(t)) return 'bowl';
  if (/angst|sorge|grüb|panik|unruhe/.test(t)) return 'wind';
  return 'chat';
}

export function felieGespraechInArbeitTitel(a) {
  /* Laeuft die Auswertung gerade, ist es „von eben" — die Uhrzeit sagt
     der Nutzerin nichts, was sie nicht weiss. Nur ein liegengebliebener
     Auftrag (nach Neustart) traegt seine Zeit. */
  if (felieAbschlussLaeuft(a.id)) return 'Gespräch von eben';
  var t = '';
  try { t = new Date(a.ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); } catch (e) {}
  return 'Gespräch von ' + t;
}

/* Was der Platzhalter sagt: waehrend die Auswertung laeuft, dass felie
   liest; liegt der Auftrag ohne laufende Auswertung, dass es nachgeholt
   wird. Kein Fachbegriff, keine Schuldzuweisung. */
export function felieGespraechInArbeitText(a) {
  var laeuft = felieAbschlussLaeuft(a.id);
  if (laeuft) return 'felie liest gerade nach …';
  return 'Wird beim nächsten Öffnen fertig verarbeitet.';
}

/* Die Karten der Startseite: zuerst, was gerade entsteht; danach die
   fertigen, neueste zuerst - zusammen hoechstens drei. Ohne Gespraech eine
   leere Liste (die Anzeige zeigt ihren Hinweis). Texte unmaskiert; die
   Webapp maskiert beim Zeichnen. */
export function felieStartseiteGespraeche() {
  var chats;
  try { chats = getSavedChats(); } catch (e) { chats = []; }
  var inArbeit = felieGespraecheInArbeit();
  var karten = inArbeit.slice(0, 3).map(function (a) {
    /* laedt: die Auswertung laeuft - die App zeigt Tipp-Punkte statt des
       Titels, bis der Titel der Zusammenfassung da ist (Marcel 29.09.). */
    return { inArbeit: true, laedt: felieAbschlussLaeuft(a.id), id: a.id, titel: felieGespraechInArbeitTitel(a), unterzeile: felieGespraechInArbeitText(a), symbol: felieThemaSymbol('') };
  });
  var recent = (chats || []).slice(-Math.max(0, 3 - Math.min(3, inArbeit.length))).reverse();
  return karten.concat(recent.map(function (c) {
    var d = '';
    try { d = new Date(c.timestamp).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' }); } catch (e) {}
    var anzahl = felieNotizenLesen(c).length;
    var sub = (d || '') + (anzahl ? ' · ' + anzahl + (anzahl === 1 ? ' Notiz' : ' Notizen') : '') + (c.erkenntnis ? ' · ' + c.erkenntnis : '');
    /* B-9a: frueher Eintrag - die Auswertung laeuft noch (oder wird nach
       einem Neustart nachgeholt): derselbe Satz wie auf der Karte "in Arbeit". */
    if (c.auswertungLaeuft) sub = felieGespraechInArbeitText({ id: c.auftragId });
    /* F6a: laeuft - die App oeffnet diese Karte noch nicht (A-4 B). */
    return { inArbeit: false, laeuft: c.auswertungLaeuft ? true : undefined, id: c.id || c.timestamp, titel: felieKrisenTitel(c.thema) || 'Gespräch', unterzeile: sub, symbol: felieThemaSymbol(c.thema) };
  }));
}

/* Nach "Ja, dort anfangen" (frueher in klV2StartApp): die Startseite
   beginnt mit der Landung - eine neue Revision, keine offene Anfrage,
   kein alter Text, Anlass "kennenlernen", Zeit gemerkt. Danach zeigt
   felieKlErsterEinstieg den Einstieg. */
export function felieKlStartseiteVorbereiten() {
  var home = felieHomeZustand();
  ++home.revision; home.pending = null; home.text = ''; home.anlass = 'kennenlernen'; home.erneuern = false;
  felieHomeZeitMerken();
}

