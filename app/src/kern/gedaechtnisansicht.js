/* Gedaechtnisansicht - seit F6b (Marcel 30.09., G-1 bis G-5;
   docs/f6b-gedaechtnis-ist-soll.md).

   Das Ansichtsmodell des Gedaechtnisses fuer Webapp und App. Bis F6b stand
   es am DOM in index.html (showGedaechtnis, ged*, felieSnipSchreiben,
   themeCategory, relativeTime); geprueft vor dem Umzug:
   tests/felie-f6b-gedaechtnis-webapp. Das Ergebnis ist wortgleich, bis auf
   Marcels Entscheidungen:
   - G-1 A: Zaehler und Puls zaehlen genau, was unter "Neu" steht
     (felieGedaechtnisNeuAnzahl) - bis F6b zaehlte der Puls den ganzen
     Schwung, auch Geloeschtes, und keine geaenderte Angabe;
   - G-2 A: "Neu" kann Aenderungen aus mehreren Gespraechen tragen, deshalb
     ueberall die Mehrzahl ("aus unseren letzten Gespraechen");
   - G-3 A: felie spricht in der Ich-Form; G-4 A: "länger".

   "neu" ist der beim Oeffnen festgehaltene Stand (felieGedaechtnisNeuFesthalten):
   die Hervorhebung bleibt fuer diese Ansicht stehen, auch wenn "Neu"
   inzwischen als gesehen gilt; beim naechsten Oeffnen ist sie weg.
   Geschrieben wird nur ueber den Vorgang (D-9). */

import { felieNotizText } from './text.js';
import { felieStore } from './store.js';
import { felieNotizSchluessel } from './text.js';
import { getSavedChats } from './gespraeche.js';
import { felieNeueSnippets, felieNeueSnippetsGesehen, felieNeuHinweis } from './neu-hinweise.js';
import { FELIE_FADEN_VERLAENGERUNG, FELIE_SNIP_MAX, felieChatFeldSetzen, felieChatNotizSetzen, felieEpisode, felieEpisoden,
  felieEpisodeVerlaengern, felieErinnerungBearbeiten, felieFakten, felieFaktSetzen, felieVorschlaegeRoh, felieVorschlaegeAufraeumen } from './gedaechtnis.js';
import { felieProfil } from './einwilligung.js';
import { felieGedaechtnisNotizen } from './kontext.js';
import { felieArchivNotizQuelle } from './archiv.js';
import { felieAngabeAnzeige, felieAngabeSubjekt, felieAngabeZurueck } from './anzeige.js';
import { felieVorgangPort } from './bruecke.js';
import { felieHomeEreignis } from './startseite.js';

/* Freigegeben (Marcel 30.09.): neu die Ich-Form (G-3), die Mehrzahl (G-2)
   und "länger" (G-4); der Rest 1:1 aus der Webapp. */
export const FELIE_GEDAECHTNIS_TEXTE = Object.freeze({
  kopf: 'Gedächtnis', kopfUnterzeile: 'Was ich mir über dich gemerkt habe',
  tabs: Object.freeze({ neu: 'Neu', aktuell: 'Aktuell', gespraeche: 'Gespräche', ueberdich: 'Über dich' }),
  neuTitel: 'Neu', neuUnterzeile: 'Neue Erinnerungen aus unseren letzten Gesprächen.',
  neuLeer: 'Nichts Neues. Nach einem Gespräch findest du hier, was ich mir daraus gemerkt habe — bis du es einmal angesehen hast.',
  aktuellTitel: 'GERADE AKTUELL', aktuellUnterzeile: 'Themen, die ich vorübergehend im Blick behalte.',
  aktuellLeer: 'Nichts Offenes. Hier kannst du zeitlich begrenzte Themen festhalten — ich frage später einmal nach, ob sie noch aktuell sind.',
  voruebergehend: 'vorübergehend', nochAktuell: 'Noch aktuell?', ja: 'Ja', nein: 'Nein',
  fadenErgaenzen: 'Offenes Thema ergänzen', fadenFeld: 'Was gerade läuft',
  fadenPlatzhalter: 'Kurz und als Stichpunkt, z.B. „Abgabe nächste Woche“', fadenFeldBeschriftung: 'Neues offenes Thema',
  fadenFrist: 'Vermutlich vorbei', abbrechen: 'Abbrechen', hinzufuegen: 'Hinzufügen',
  gespraecheTitel: 'AUS UNSEREN GESPRÄCHEN', gespraecheUnterzeile: 'Was ich mir aus unseren Gesprächen gemerkt habe.',
  gespraecheLeer: 'Noch nichts. Je öfter wir sprechen, desto mehr sammelt sich hier.',
  alle: 'Alle', ueberDich: 'Über dich', wenigerAnzeigen: 'Weniger anzeigen',
  ungeprueft: 'Ältere, ungeprüfte Notiz. Ich nutze sie nicht automatisch; du kannst sie korrigieren.',
  langeNicht: ' · lange nicht erwähnt', aktualisiert: 'Aktualisiert', berichtigt: 'Berichtigt',
  loeschenTitel: 'Erinnerung löschen?',
  loeschenFakt: 'Ich lösche diese Erinnerung und beziehe sie nicht mehr in meine Antworten ein.',
  loeschenFaden: 'Dieses offene Thema wird entfernt. Ich frage dann nicht mehr von mir aus danach.',
  loeschenLernt: 'Dieser Satz wird gelöscht. Das Gespräch selbst bleibt im Archiv aufrufbar.',
  bearbeiten: 'Bearbeiten', loeschen: 'Löschen', uebernehmen: 'Übernehmen',
  /* F6c, freigegeben Marcel 30.09. */
  zuKlaeren: 'Zu klären', zuKlaerenUnterzeile: 'Hilf mir bitte kurz, was davon stimmt.',
  bisher: 'Bisher: ', neuVorschlag: 'Neu: ', soLassen: 'So lassen',
  /* F6d-2 "Über dich" (U-1 A, Unterzeile B; Name, Alter und Formular 1:1
     aus dem Profil der Webapp), freigegeben Marcel 30.09. */
  ueberDichTitel: 'ÜBER DICH', ueberDichUnterzeile: 'Deine Angaben und was ich aus unseren Gesprächen über dich weiß.',
  name: 'Name', alter: 'Alter', leer: '—',
  faktErgaenzen: 'Etwas über dich ergänzen', faktFeld: 'Etwas über dich',
  faktPlatzhalter: 'Kurz und als Stichpunkt, z.B. „Arbeitet in Wechselschicht“', kategorie: 'Kategorie',
  herkunft: Object.freeze({ selbst: 'von dir', kennenlernen: 'aus dem Kennenlernen', gespraech: 'aus unserem Gespräch' })
});

/* "34 Jahre" (wie profileSummary der Webapp). */
export function felieGedaechtnisJahre(n) { return n + ' Jahre'; }

/* "Alle n anzeigen", "n× erwähnt", Neu-Zeile und VoiceOver des Zaehlers. */
export function felieGedaechtnisAlleAnzeigen(n) { return 'Alle ' + n + ' anzeigen'; }
export function felieGedaechtnisErwaehnt(n) { return n + '× erwähnt'; }
export function felieGedaechtnisNeuZeile(n) {
  return n === 1 ? 'Neu aus unseren letzten Gesprächen' : n + ' neu aus unseren letzten Gesprächen';
}
export function felieGedaechtnisNeuStatus(n) {
  if (!n) return '';
  return n === 1 ? 'Eine neue Erinnerung aus unseren letzten Gesprächen' : n + ' neue Erinnerungen aus unseren letzten Gesprächen';
}

/* Reihenfolge fest, nicht nach Anzahl: eine Gliederung, die bei jedem
   neuen Eintrag umsortiert, ist keine Gliederung. */
export const FELIE_GED_KAT_LABEL = Object.freeze({ familie: 'Familie', arbeit: 'Arbeit', gesundheit: 'Gesundheit',
  beziehung: 'Beziehung', wohnen: 'Wohnen', allgemein: 'Allgemein' });
export const FELIE_GED_KAT_ORDER = Object.freeze(['familie', 'arbeit', 'gesundheit', 'beziehung', 'wohnen', 'allgemein']);
/* Fristen fuer selbst angelegte Themen: eine Groessenordnung antippen, kein Datum. */
export const FELIE_GED_FRISTEN = Object.freeze([['7', 'diese Woche'], ['14', 'zwei Wochen'], ['30', 'diesen Monat'], ['90', 'länger']]);
/* Wie viele Gespraechssaetze ungefragt sichtbar sind. */
export const FELIE_GED_LERNT_SICHTBAR = 6;
/* Die Register: "Neu" vorn (dorthin fuehrt der Puls), dann das zeitlich
   Begrenzte, der Dauerbestand, rechts "Über dich" (F6d-2, U-1 A). Welche
   sichtbar sind: felieGedaechtnisTabs. */
export const FELIE_GED_TABS = Object.freeze(['neu', 'aktuell', 'gespraeche', 'ueberdich']);
/* Die Altersbaender aus dem Kennenlernen (bis F6d RU_BANDS der Webapp). */
export const FELIE_ALTERSBAENDER = Object.freeze([{ v: 'u30', l: 'unter 30' }, { v: '30-39', l: '30\u201339' },
  { v: '40-47', l: '40\u201347' }, { v: '48-55', l: '48\u201355' }, { v: '56+', l: '56+' }]);

/* Themengruppe eines Titels (bis F6b themeCategory in index.html, dieselben
   Stichworte). symbol: der Name des Symbols (Webapp #i-<name>). */
export function felieThemaKategorie(thema) {
  var t = (thema || '').toLowerCase();
  if (/schlaf|müde|insomn|nacht|wach/.test(t)) return { key: 'schlaf', label: 'Schlaf', symbol: 'moon' };
  if (/job|arbeit|beruf|chef|kolleg|büro|karriere/.test(t)) return { key: 'job', label: 'Job & Arbeit', symbol: 'chart' };
  if (/stress|druck|überforder|hektik|last/.test(t)) return { key: 'stress', label: 'Stress', symbol: 'bolt' };
  if (/kind|familie|schwanger|mutter|baby|eltern/.test(t)) return { key: 'kind', label: 'Kinder & Familie', symbol: 'heart' };
  if (/beziehung|partner|liebe|ehe|freund|date/.test(t)) return { key: 'beziehung', label: 'Beziehung', symbol: 'heart' };
  if (/zyklus|hormon|periode|menstr|pms|eisprung/.test(t)) return { key: 'zyklus', label: 'Zyklus', symbol: 'bloom' };
  if (/energie|erschöpf|kraftlos|antrieb|müdigkeit/.test(t)) return { key: 'energie', label: 'Energie', symbol: 'battery' };
  if (/sport|bewegung|training|lauf|fitness/.test(t)) return { key: 'sport', label: 'Sport', symbol: 'run' };
  if (/ernähr|essen|appetit|gewicht|hunger/.test(t)) return { key: 'ernaehrung', label: 'Ernährung', symbol: 'bowl' };
  if (/angst|sorge|grüb|panik|unruhe/.test(t)) return { key: 'angst', label: 'Ängste', symbol: 'wind' };
  return { key: 'sonstiges', label: 'Sonstiges', symbol: 'chat' };
}

/* Wann (bis F6b relativeTime in index.html): "gerade eben", "vor Kurzem",
   "heute Abend", "gestern Morgen", "vor 3 Tagen", "vor einer Woche",
   "am 4. September". */
export function felieZeitRelativ(ts, jetztMs) {
  if (!ts) return '';
  var d = new Date(ts);
  var now = new Date(jetztMs == null ? Date.now() : jetztMs);
  var diffMin = (now - d) / 60000;
  function tageszeit(h) {
    if (h < 5) return 'Nacht';
    if (h < 11) return 'Morgen';
    if (h < 14) return 'Mittag';
    if (h < 18) return 'Nachmittag';
    if (h < 22) return 'Abend';
    return 'Nacht';
  }
  if (diffMin < 3) return 'gerade eben';
  if (diffMin < 90) return 'vor Kurzem';
  var tz = tageszeit(d.getHours());
  var startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var dayDiff = Math.round((startToday - startThat) / 86400000);
  if (dayDiff === 0) return 'heute ' + tz;
  if (dayDiff === 1) return 'gestern ' + tz;
  if (dayDiff <= 6) return 'vor ' + dayDiff + ' Tagen';
  if (dayDiff <= 13) return 'vor einer Woche';
  /* F6c-M4 B (Marcel 30.09.): ab zwoelf Monaten kein Datum ohne Jahr,
     sondern der Zeitraum wie im Kontext (felieZeitraum). */
  var monate = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()) - (now.getDate() < d.getDate() ? 1 : 0);
  if (monate >= 12) return 'vor über einem Jahr';
  return 'am ' + d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
}

/* ── Neu ────────────────────────────────────────────────────────── */

/* Was beim Oeffnen unter "Neu" steht: was hinzugekommen ist UND was sich
   geaendert hat, jede Angabe genau einmal (Pruefall F28). */
export function felieGedaechtnisNeuFesthalten() {
  var n = felieNeueSnippets();
  var ids = n.gesehen ? [] : n.ids.slice();
  if (!n.gesehen) n.hinweise.forEach(function (h) { if (ids.indexOf(h.id) < 0) ids.push(h.id); });
  return { ids: ids, hinweise: n.gesehen ? [] : n.hinweise.slice() };
}

function istNeu(neu, id) { return !!(neu && neu.ids && neu.ids.length && id && neu.ids.indexOf(id) >= 0); }

function hinweisFuer(neu, id) {
  /* Ohne festgehaltene Hinweise (Ansicht nicht geoeffnet) gilt der Merkzettel. */
  if (!neu || !neu.hinweise) return felieNeuHinweis(id);
  return (neu.hinweise || []).filter(function (x) { return x.id === id; })[0] || null;
}

/* Die Eintraege unter "Neu" (Angaben und offene Themen), die es noch gibt. */
export function felieGedaechtnisNeueEintraege(neu) {
  var liste = neu && neu.ids;
  if (!liste || !liste.length) return [];
  var raus = [];
  try { felieFakten().forEach(function (f) { if (liste.indexOf(f.id) >= 0) raus.push({ art: 'fakt', e: f }); }); } catch (e) {}
  try { felieEpisoden({ status: 'offen' }).forEach(function (ep) { if (liste.indexOf(ep.id) >= 0) raus.push({ art: 'faden', e: ep }); }); } catch (e) {}
  return raus;
}

/* G-1 A: die Zahl fuer Zaehler und Puls = was "Neu" jetzt zeigen wuerde;
   seit F6c (V-4) mit den Vorschlaegen, die sie noch nicht gesehen hat. */
export function felieGedaechtnisNeuAnzahl() {
  return felieGedaechtnisNeueEintraege(felieGedaechtnisNeuFesthalten()).length
    + felieVorschlaege().filter(function (v) { return !v.gesehen; }).length;
}

/* "Neu" angesehen: der Merkzettel und die Vorschlaege gelten als gesehen
   (die Vorschlaege bleiben stehen, bis sie antwortet, V-3). */
export function felieGedaechtnisNeuGesehen() {
  var geaendert = felieNeueSnippetsGesehen();
  if (felieVorschlaege().some(function (v) { return !v.gesehen; })) {
    felieVorgangPort()(function (s) {
      ((s.zusatz || {}).vorschlaege || []).forEach(function (v) { v.gesehen = true; });
    });
    geaendert = true;
  }
  return geaendert;
}

/* Liegt ein Vorschlag offen, beginnt das Gedaechtnis bei "Neu" (V-3). */
/* "Neu" nur, wenn dort mindestens ein Eintrag steht - neu oder "Zu klären"
   (Marcel 30.09.; nach dem Ansehen haelt ein offener Vorschlag es offen). */
export function felieGedaechtnisTabs(neu) {
  var da = felieGedaechtnisNeueEintraege(neu).length || felieVorschlaege().length;
  return FELIE_GED_TABS.filter(function (k) { return k !== 'neu' || da; });
}

export function felieGedaechtnisStartTab(neu) {
  return felieGedaechtnisNeueEintraege(neu).length || felieVorschlaege().length ? 'neu' : 'gespraeche';
}

/* ── Vorschlaege (F6c, Marcel 30.09.) ─────────────────────────────── */

/* Die offenen Vorschlaege, deren Eintrag und Gespraech es noch gibt. bisher:
   die heutige Fassung des Eintrags. */
export function felieVorschlaege() {
  var eintraege = {};
  try { felieFakten().forEach(function (f) { eintraege['angabe:' + f.id] = f; }); } catch (e) {}
  try { felieEpisoden({ status: 'offen' }).forEach(function (e) { eintraege['thema:' + e.id] = e; }); } catch (e) {}
  var chats = {};
  try { getSavedChats().forEach(function (c) { chats[String(c.id || c.timestamp)] = true; }); } catch (e) {}
  return felieVorschlaegeRoh().filter(function (v) {
    return eintraege[v.art + ':' + v.zielId] && (v.gespraechId == null || chats[String(v.gespraechId)]);
  }).map(function (v) {
    return { id: v.id, art: v.art, zielId: v.zielId, bisher: eintraege[v.art + ':' + v.zielId].text, neu: v.neu,
      gespraechId: v.gespraechId, notiertAm: v.notiertAm, gesehen: !!v.gesehen };
  });
}

/* Fuers Gedaechtnis-Blatt: knapp angezeigt (B-5b), mit dem Zeitpunkt. */
export function felieGedaechtnisVorschlagZeilen(jetztMs) {
  return felieVorschlaege().map(function (v) {
    return { id: v.id, art: v.art, bisher: felieAngabeAnzeige(v.bisher), neu: felieAngabeAnzeige(v.neu), zeit: felieZeitRelativ(v.notiertAm, jetztMs) };
  });
}

/* Uebernehmen: die neue Fassung wird der Eintrag (ihre Entscheidung, also
   ihre Quelle), der Vorschlag geht. Danach der feste Satz auf der Startseite. */
export function felieVorschlagUebernehmen(id) {
  var v = felieVorschlaege().filter(function (x) { return x.id === id; })[0];
  if (!v) return false;
  var ok = felieVorgangPort()(function (s) {
    if (!felieErinnerungBearbeiten(v.art === 'thema' ? 'faden' : 'fakt', v.zielId, v.neu, undefined, { still: true })) throw new Error('Eintrag fehlt');
    felieVorschlaegeAufraeumen(s, function (x) { return x.id === id; });
  });
  if (ok) felieHomeEreignis('gedaechtnis_geaendert');
  return !!ok;
}

/* So lassen: alles bleibt, der Vorschlag geht; derselbe Wert kommt nicht
   wieder (V-5, gemerkt je Eintrag). */
export function felieVorschlagLassen(id) {
  var v = felieVorschlaegeRoh().filter(function (x) { return x.id === id; })[0];
  if (!v) return false;
  var ok = felieVorgangPort()(function (s) {
    felieVorschlaegeAufraeumen(s, function (x) { return x.id === id; });
    s.zusatz.vorschlaegeAbgelehnt.push({ zielId: v.zielId, schluessel: felieNotizSchluessel(v.neu), gespraechId: v.gespraechId });
  });
  if (ok) felieHomeEreignis('gedaechtnis_geaendert');
  return !!ok;
}

/* ── Register "Gespräche": Notizen und Angaben in einer Karte ─────── */

export function felieGedaechtnisSelbstauskunft(f) { return f.quelle === 'selbst' || f.quelle === 'kennenlernen'; }

/* Angaben in fester Kategorienfolge. */
export function felieGedaechtnisFaktenSortiert(filter) {
  var fakten = [];
  try { fakten = felieFakten().filter(filter); } catch (e) {}
  var rang = function (k) { return FELIE_GED_KAT_ORDER.indexOf(FELIE_GED_KAT_LABEL[k] ? k : 'allgemein'); };
  return fakten.sort(function (a, b) { return rang(a.kategorie) - rang(b.kategorie); });
}

/* Die Notizen je Themengruppe. Form wie gedLerntDaten der Webapp (die
   Webapp liest sie weiter so): groups[key] = { key, label, symbol,
   entries: [{ id, timestamp, thema, notizId, felie_lernt, feldQuelle,
   messages }] }, order nach Anzahl, total = Notizen + Angaben aus Gespraechen. */
export function felieGedaechtnisNotizGruppen() {
  var mit = [];
  felieGedaechtnisNotizen('sichtbar').forEach(function (e) {
    var c = e.chat, n = e.notiz;
    mit.push({ id: c.id || c.timestamp, timestamp: c.timestamp, thema: n.feld ? c.thema : n.thema || c.thema,
      notizId: n.id, felie_lernt: n.text, feldQuelle: { felie_lernt: n.nachweis }, messages: c.messages });
  });
  var groups = {}, order = [];
  mit.forEach(function (c) {
    var cat = felieThemaKategorie(c.thema || '');
    if (!groups[cat.key]) { groups[cat.key] = { key: cat.key, label: cat.label, symbol: cat.symbol, entries: [] }; order.push(cat.key); }
    groups[cat.key].entries.push(c);
  });
  order.sort(function (a, b) { return groups[b].entries.length - groups[a].entries.length; });
  /* Seit F6d-2 nur Notizen: die Angaben stehen unter "Über dich". */
  return { groups: groups, order: order, notizen: mit.length, fakten: 0, total: mit.length };
}

/* Eine Angabe als Zeile: knapp angezeigt (B-5b), Kategorie, "lange nicht
   erwaehnt" ab 180 Tagen, Aenderungshinweis mit dem alten Wortlaut. */
export function felieGedaechtnisFaktZeile(f, neu) {
  var kat = FELIE_GED_KAT_LABEL[f.kategorie] ? f.kategorie : 'allgemein';
  var hw = null;
  try { hw = hinweisFuer(neu, f.id); } catch (e) {}
  return { art: 'fakt', id: f.id, text: felieAngabeAnzeige(f.text), roh: f.text, subjekt: felieAngabeSubjekt(f.text),
    kategorie: f.kategorie, katLabel: FELIE_GED_KAT_LABEL[kat], langeNicht: f.alterTage > 180,
    aenderung: hw && hw.vorher ? { art: hw.art === 'corrected' ? 'berichtigt' : 'aktualisiert', vorher: hw.vorher } : null,
    neu: istNeu(neu, f.id), klasse: f.klasse, quelle: f.quelle || 'gespraech', max: FELIE_SNIP_MAX.fakt,
    /* F6c: wann notiert, dezent an jedem Eintrag */
    zeit: felieZeitRelativ(f.notiertAm) };
}

/* filter: 'all' oder ein Themenschluessel. Ein Filter, dessen Inhalt
   verschwunden ist, faellt auf 'all' zurueck (filter im Ergebnis) - auch der
   fruehere Filter 'ueberdich' (bis F6d-2: die Angaben aus Gespraechen; die
   stehen jetzt im Register "Über dich"). alle: alle Notizen statt der
   ersten sechs. */
export function felieGedaechtnisGespraeche(neu, filter, alle, jetztMs) {
  var d = felieGedaechtnisNotizGruppen();
  var sel = filter || 'all';
  if (sel !== 'all' && !d.groups[sel]) sel = 'all';
  var chips = [{ key: 'all', label: FELIE_GEDAECHTNIS_TEXTE.alle, symbol: null, anzahl: d.total, aktiv: sel === 'all' }]
    .concat(d.order.map(function (k) { var g = d.groups[k]; return { key: k, label: g.label, symbol: g.symbol, anzahl: g.entries.length, aktiv: sel === k }; }));
  var raus = { total: d.total, notizen: d.notizen, fakten: 0, filter: sel, chips: d.total ? chips : [],
    zeilen: [], faktZeilen: [], gesamt: 0, mehr: null, neuAnzahl: 0 };
  if (!d.total) return raus;
  var eintraege = [];
  (sel === 'all' ? d.order : [sel]).forEach(function (k) { d.groups[k].entries.forEach(function (c) { eintraege.push(c); }); });
  eintraege.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
  raus.gesamt = eintraege.length;
  var zeigen = alle ? eintraege : eintraege.slice(0, FELIE_GED_LERNT_SICHTBAR);
  raus.zeilen = zeigen.map(function (c) {
    return { art: 'lernt', id: c.id, notizId: c.notizId, text: felieAngabeAnzeige(c.felie_lernt), roh: c.felie_lernt,
      subjekt: felieAngabeSubjekt(c.felie_lernt), thema: c.thema || 'Gespräch', zeit: felieZeitRelativ(c.timestamp, jetztMs),
      ungeprueft: !felieArchivNotizQuelle(c), max: FELIE_SNIP_MAX.chatlernt };
  });
  if (raus.gesamt > FELIE_GED_LERNT_SICHTBAR) raus.mehr = alle ? 'weniger' : 'alle';
  return raus;
}

/* ── Register "Über dich" (F6d-2, U-1 A) ─────────────────────────── */

/* Herkunft einer Angabe: was sie selbst eingetragen oder bearbeitet hat,
   heisst "von dir" (wie felieAngabeIhre, F6c). */
function herkunft(f) {
  var H = FELIE_GEDAECHTNIS_TEXTE.herkunft;
  if (f.quelle === 'selbst' || f.bearbeitetAm || f.bearbeitetVon === 'selbst') return H.selbst;
  return f.quelle === 'kennenlernen' ? H.kennenlernen : H.gespraech;
}

/* Name und Alter (wert zum Bearbeiten, anzeige wie im Profil der Webapp)
   und alle Angaben in Kategorienfolge mit Herkunft. */
export function felieGedaechtnisUeberDich(neu) {
  var G = FELIE_GEDAECHTNIS_TEXTE;
  var p = felieProfil(), k = p.klAnswers || {};
  var exakt = k.alterExact != null && k.alterExact !== '' ? String(k.alterExact) : '';
  var band = FELIE_ALTERSBAENDER.filter(function (b) { return b.v === k.alter; })[0];
  var fakten = felieGedaechtnisFaktenSortiert(function () { return true; });
  return {
    name: { wert: p.userName || '', anzeige: p.userName || G.leer },
    alter: { wert: exakt, anzeige: exakt ? felieGedaechtnisJahre(exakt) : band ? band.l : (k.alter || G.leer) },
    zeilen: fakten.map(function (f) { var z = felieGedaechtnisFaktZeile(f, neu); z.herkunft = herkunft(f); return z; }),
    anzahl: fakten.length
  };
}

/* ── Register "Aktuell": offene Themen ─────────────────────────────── */

/* Nach Frist sortiert, ohne Frist zuletzt. Kein Datum heisst NICHT
   abgelaufen (M28). Abgelaufen: ausgegraut, "Noch aktuell?" statt Stift. */
export function felieGedaechtnisFaeden(neu, jetztMs) {
  var offen = [];
  try { offen = felieEpisoden({ status: 'offen' }); } catch (e) {}
  var jetzt = jetztMs == null ? Date.now() : jetztMs, weit = Number.MAX_SAFE_INTEGER;
  offen = offen.slice().sort(function (a, b) {
    return (Number.isFinite(a.faelligBis) ? a.faelligBis : weit) - (Number.isFinite(b.faelligBis) ? b.faelligBis : weit); });
  return offen.map(function (e) {
    return { art: 'faden', id: e.id, text: felieAngabeAnzeige(e.text), roh: e.text, subjekt: felieAngabeSubjekt(e.text),
      abgelaufen: Number.isFinite(e.faelligBis) && e.faelligBis < jetzt, erwaehnungen: e.erwaehnungen || 1,
      neu: istNeu(neu, e.id), max: FELIE_SNIP_MAX.faden, zeit: felieZeitRelativ(e.notiertAm || e.erfasstAm, jetztMs) };
  });
}

/* Register "Neu": Angaben und Themen, hier nie ausgegraut. */
export function felieGedaechtnisNeu(neu) {
  return felieGedaechtnisNeueEintraege(neu).map(function (n) {
    if (n.art === 'fakt') return felieGedaechtnisFaktZeile(n.e, neu);
    return { art: 'faden', id: n.e.id, text: felieAngabeAnzeige(n.e.text), roh: n.e.text, subjekt: felieAngabeSubjekt(n.e.text),
      abgelaufen: false, erwaehnungen: 1, neu: true, max: FELIE_SNIP_MAX.faden, zeit: felieZeitRelativ(n.e.notiertAm || n.e.erfasstAm) };
  });
}

/* Die Zahlen an den Registern. */
export function felieGedaechtnisTabZahlen(neu) {
  var z = { neu: 0, aktuell: 0, gespraeche: 0, ueberdich: 0 };
  var offen = 0;
  try { offen = felieVorschlaege().length; } catch (e) {}
  try { z.aktuell = felieEpisoden({ status: 'offen' }).length; } catch (e) {}
  try { z.gespraeche = felieGedaechtnisNotizGruppen().total; } catch (e) {}
  try { z.ueberdich = felieFakten().length; } catch (e) {}
  z.neu = felieGedaechtnisNeueEintraege(neu).length + offen;
  return z;
}

/* ── Aktionen ───────────────────────────────────────────────────── */

/* Was die Eingabe am Ende schreibt (felieSnipUebernehmen der Webapp):
   Leerraum zusammengezogen, auf max gekuerzt; leer oder unveraendert
   heisst nichts schreiben (null). Angezeigt und bearbeitet wird knapp,
   gespeichert mit "Sie" (B-5b, felieAngabeZurueck). */
export function felieGedaechtnisEingabe(eingabe, alt, subjekt, max) {
  var neu = String(eingabe == null ? '' : eingabe).replace(/\s+/g, ' ').trim();
  var grenze = max || 240;
  if (neu.length > grenze) neu = neu.slice(0, grenze).trim();
  if (!neu || neu === (alt || '')) return null;
  return felieAngabeZurueck(neu, alt, subjekt);
}

/* Die Bearbeiten-Weiche (felieSnipSchreiben der Webapp): Angabe und Thema
   ueber den Speicher, eine Gespraechsnotiz am Gespraech, eine alte Notiz
   ohne Kennung am Feld felie_lernt. Ergebnis wie die Kern-Funktion dahinter. */
export function felieGedaechtnisSchreiben(art, id, notizId, wert) {
  if (art === 'fakt' || art === 'faden') return felieErinnerungBearbeiten(art, id, wert);
  if (art === 'lernt') {
    var cid = typeof id === 'string' ? parseInt(id, 10) : id;
    return notizId ? felieChatNotizSetzen(cid, notizId, wert) : felieChatFeldSetzen(cid, { felie_lernt: wert });
  }
  return false;
}

export function felieGedaechtnisLoeschText(art) {
  var T = FELIE_GEDAECHTNIS_TEXTE;
  return art === 'faden' ? T.loeschenFaden : art === 'lernt' ? T.loeschenLernt : T.loeschenFakt;
}

/* Loeschen je Art; eine Gespraechsnotiz leert nur ihren Satz, das
   Gespraech bleibt im Archiv. */
export function felieGedaechtnisLoeschen(art, id, notizId) {
  if (art === 'fakt' || art === 'faden') return !!felieErinnerungBearbeiten(art, id, null);
  if (art === 'lernt') return felieGedaechtnisSchreiben('lernt', id, notizId, '') !== false;
  return false;
}

/* Ein offenes Thema selbst anlegen, mit Frist in Tagen (FELIE_GED_FRISTEN).
   felie bestaetigt es auf der Startseite. */
export function felieFadenAnlegen(text, tage) {
  var t = felieNotizText(text);
  if (!t) return false;
  var n = parseInt(tage, 10) || 14;
  var ok = felieVorgangPort()(function () {
    felieEpisode({ text: t.slice(0, FELIE_SNIP_MAX.faden), faelligBis: Date.now() + n * 86400000 });
  });
  if (ok) felieHomeEreignis('gedaechtnis_geaendert', { was: 'thema', wie: 'neu', text: t });
  return !!ok;
}

/* "Etwas über dich ergänzen" (bis F6d-2 gedFaktAnlegen der Webapp): ihre
   eigene Angabe, dauerhaft, in der gewaehlten Kategorie. */
export function felieFaktAnlegen(text, kategorie) {
  var t = felieNotizText(text);
  if (!t) return false;
  var kat = FELIE_GED_KAT_LABEL[kategorie] ? kategorie : 'allgemein';
  var ok = felieVorgangPort()(function () {
    felieFaktSetzen({ text: t.slice(0, FELIE_SNIP_MAX.fakt), kategorie: kat, klasse: 'stabil', quelle: 'selbst' });
  });
  if (ok) felieHomeEreignis('gedaechtnis_geaendert', { was: 'angabe', wie: 'neu', text: t });
  return !!ok;
}

export function felieFadenNochAktuellText(id) {
  var e = null;
  try { e = felieStore().episoden.find(function (x) { return x.id === id; }); } catch (err) {}
  if (!e) return null;
  return '„' + e.text + '"\n\nJa — ich behalte es weitere ' + FELIE_FADEN_VERLAENGERUNG
    + ' Tage im Blick. Nein — ich entferne es aus meinem Gedächtnis.';
}

/* "Noch aktuell?": Ja verlaengert um 14 Tage, Nein loescht (dieselbe
   Wirkung wie Loeschen). */
export function felieFadenNochAktuell(id, ja) {
  var e = null;
  try { e = felieStore().episoden.find(function (x) { return x.id === id; }); } catch (err) {}
  if (!e) return false;
  if (!ja) return felieGedaechtnisLoeschen('faden', id);
  var ok = felieVorgangPort()(function () { if (!felieEpisodeVerlaengern(id)) throw new Error('Thema fehlt'); });
  if (ok) felieHomeEreignis('gedaechtnis_geaendert', { was: 'thema', wie: 'verlaengert', text: e.text, tage: FELIE_FADEN_VERLAENGERUNG });
  return !!ok;
}
