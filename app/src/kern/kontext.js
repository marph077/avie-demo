/* Kontext-Daten - seit Welle D, Paket D5b, ein Kern-Modul.

   Was felie im Gespraech ueber die Nutzerin weiss (felieKontextDaten):
   Profil, Signale, Zyklus, Geraetevergleiche, beobachtete Muster,
   Angaben, Themen, Gedaechtnisnotizen, fruehere Gespraeche und der
   ausdrueckliche Rueckblick; dazu das Koerperbild fuer das Archiv
   (bodySnapshotText). Geprueft vor dem Umzug: felie-d5-kontext (D5a).

   In der Webapp bleiben der Verteiler felieKontextFuer und die
   Startseite (felieHomeKontext, Begruessungsbezug) - Entscheidung D-20.

   Geaendert sind nur drei Zugriffe: Profil, offenes Archivgespraech und
   Rueckblick-Auswahl kommen ueber die verbundene Umgebung
   (felieKontextVerbinden).

   Der urspruengliche Wortlaut folgt unveraendert. */

import { felieRepoFind } from './repository.js';
import { FELIE_AUFBEWAHRUNG, felieDatensatzStand, felieStore } from './store.js';
import { getSavedChats } from './gespraeche.js';
import { felieStelleBereinigt } from './bruecke.js';
import { cycleMidnight, cycleRefresh } from './zyklus.js';
import { felieBand, felieIstFrisch, felieSignalVerwendbar, felieVerlauf } from './signale.js';
import { FELIE_MERK_VERNEINUNG, felieEpisoden, felieErinnerungAusChat, felieFakten, felieMerkWortDrin, felieMerkWorte, felieNotizenLesen } from './gedaechtnis.js';
import { FELIE_SKALEN, felieStimmungLabel, felieStimmungListe, felieStufenWort } from './selbstauskunft.js';
import { felieArchivNotizNutzbar, felieArchivNotizQuelle } from './archiv.js';

/* Umgebung der Kontext-Daten (seit D5b, wie D-11/D-13). Drei Dinge weiss
   nur die Webapp: das Profil aus dem Kennenlernen (userName, klAnswers),
   welches Archivgespraech gerade geoeffnet ist (_felieAktiverArchivChat)
   und welche Gespraeche die Nutzerin fuer einen Rueckblick gewaehlt hat
   (_felieRueckblickAuswahl). Nachgeschlagen wird beim Aufruf. Unverbunden
   gibt es kein Profil, kein offenes Archivgespraech und keine Auswahl. */
let umgebung = null;

export function felieKontextVerbinden(u) {
  umgebung = u || null;
}

export function felieKontextProfil() {
  return (umgebung && typeof umgebung.profil === 'function' ? umgebung.profil() : null) || {};
}

export function felieKontextAktiverArchivChat() {
  return umgebung && typeof umgebung.aktiverArchivChat === 'function' ? umgebung.aktiverArchivChat() : undefined;
}

export function felieKontextRueckblickAuswahl() {
  return umgebung && typeof umgebung.rueckblickAuswahl === 'function' ? umgebung.rueckblickAuswahl() : undefined;
}

/* Koerperzeilen fuer den Prompt: Selbstauskunft in Worten mit Alter,
   Geraetewerte klar als solche benannt. Eine Quelle statt drei Kopien. */
export function felieKoerperZeilen() {
  var records = felieSignalDaten();
  return records.length ? records.map(function(e) {
    return e.bezeichnung + ': ' + e.wert + (e.einheit ? ' (' + e.einheit + ')' : '')
      + ' — Quelle: ' + e.quelle + ', ' + e.datum + (e.aktuell ? ', aktuell' : ', historisch; nicht heute');
  }).join('\n') + '\n' : 'Keine aktuellen Angaben vorhanden; Befinden und Messwerte sind unbekannt.\n';
}

/* ══════════════════════════════════════════════════════════════════════
   KOMBINATIONSMUSTER — zweite Musterklasse
   ──────────────────────────────────────────────────────────────────────
   Muster aus der Selbstreflexion selbst, ohne Zyklusbezug. Funktioniert
   damit fuer alle Nutzerinnen und ist handlungsfaehiger: "nach schlechten
   Naechten trifft dich Anspannung haerter" ist ein Hebel, eine Phase ist
   es nicht.

   Drei Regeln halten das ehrlich:

   1. GEGENPROBE statt Haeufigkeit. Kommen "schlecht geschlafen" in 60 %
      und "gestresst" in 50 % der Eintraege vor, treten beide in rund 30 %
      ZUFAELLIG gemeinsam auf. Gezaehlt wird deshalb nie das gemeinsame
      Auftreten, sondern der Unterschied zwischen "nach schlechten
      Naechten" und "nach guten Naechten".

   2. FESTE HYPOTHESEN. Bei drei Signalen, davon eines mit elf
      Kategorien, findet ein Alles-gegen-alles-Test garantiert etwas.
      Geprueft wird nur die Liste unten.

   3. RICHTUNG AUS DER ZEIT. Schlafqualitaet ist rueckblickend ("wie war
      deine Nacht"), Stimmung und Energie sind gegenwaertig. Der Schlaf
      liegt also davor. Das ist die einzige saubere Asymmetrie in den
      Daten, deshalb gehen alle Hypothesen von der Nacht aus.

   Ausgabe als ANZAHL, nicht als Prozent: bei sieben Eintraegen ist
   "71 %" Scheingenauigkeit.
   ══════════════════════════════════════════════════════════════════════ */

/* Elf Stimmungen zu drei Gruppen: einzeln haette jede n=2 und nichts
   waere je belastbar. */
export const FELIE_STIMMUNG_GRUPPE = {
  gut: 'tragend', motiviert: 'tragend', ruhig: 'tragend',
  neutral: 'neutral', nachdenklich: 'neutral',
  gereizt: 'belastend', unsicher: 'belastend', muede: 'belastend',
  traurig: 'belastend', gestresst: 'belastend', ueberfordert: 'belastend'
};

export function felieStimmungGruppe(wert) {
  var liste = felieStimmungListe(wert);
  /* Eine belastende Nennung genuegt: "müde und gut" ist keine gute Lage. */
  for (var i = 0; i < liste.length; i++) {
    if (FELIE_STIMMUNG_GRUPPE[liste[i]] === 'belastend') return 'belastend';
  }
  for (var j = 0; j < liste.length; j++) {
    if (FELIE_STIMMUNG_GRUPPE[liste[j]] === 'tragend') return 'tragend';
  }
  return liste.length ? 'neutral' : null;
}

/* Die Signale liegen als einzelne Eintraege im Store. Fuer eine
   Kombination muessen sie zum selben Tag gehoeren — sonst vergleicht man
   die Nacht von Montag mit der Stimmung von Freitag. */
export function felieTagesbilder() {
  var tage = {};
  ['schlafqualitaet', 'energie', 'anspannung', 'stimmung'].forEach(function (key) {
    var liste;
    try { liste = felieVerlauf(key, { quelle: 'selbst' }); } catch (e) { return; }
    liste.forEach(function (e) {
      var d = new Date(e.ts); d.setHours(0, 0, 0, 0);
      var k = d.getTime();
      tage[k] = tage[k] || { tag: k };
      /* Bei mehreren Angaben am selben Tag gilt die letzte. */
      tage[k][key] = e.wert;
    });
  });
  return Object.keys(tage).map(function (k) { return tage[k]; })
    .sort(function (a, b) { return a.tag - b.tag; });
}

/* Bedingung: schlechte Nacht heisst Band "niedrig", also die unteren
   drei der sechs Stufen. Alles darueber gilt als Gegenprobe. */
export function felieSchlechteNacht(t) {
  if (t.schlafqualitaet == null) return null;
  return felieBand('schlafqualitaet', t.schlafqualitaet, 'selbst') === 'niedrig';
}

export const FELIE_HYPOTHESEN = [
  {
    id: 'nacht-stimmung',
    /* Ergebnis: null wenn der Tag dazu nichts hergibt. */
    ergebnis: function (t) {
      var g = felieStimmungGruppe(t.stimmung);
      return g == null ? null : (g === 'belastend');
    },
    text: function (a, b) {
      return 'Nach schlechten Nächten fühlst du dich häufiger belastet — '
        + 'an ' + a.treffer + ' von ' + a.n + ' solchen Tagen, '
        + 'nach guten Nächten an ' + b.treffer + ' von ' + b.n + '.';
    }
  },
  {
    id: 'nacht-energie',
    ergebnis: function (t) {
      if (t.energie == null) return null;
      return felieBand('energie', t.energie, 'selbst') === 'niedrig';
    },
    text: function (a, b) {
      return 'Nach schlechten Nächten ist deine Energie häufiger niedrig — '
        + 'an ' + a.treffer + ' von ' + a.n + ' solchen Tagen, '
        + 'nach guten Nächten an ' + b.treffer + ' von ' + b.n + '.';
    }
  },
  {
    id: 'nacht-anspannung',
    ergebnis: function (t) {
      if (t.anspannung == null) return null;
      return felieBand('anspannung', t.anspannung, 'selbst') === 'hoch';
    },
    text: function (a, b) {
      return 'Nach schlechten Nächten trifft dich Anspannung härter — '
        + 'an ' + a.treffer + ' von ' + a.n + ' solchen Tagen, '
        + 'nach guten Nächten an ' + b.treffer + ' von ' + b.n + '.';
    }
  }
];

/* Mindestens drei Tage pro Bedingung, und der Unterschied muss deutlich
   sein — feine Effekte sind bei rund 50 Sitzungen im Jahr nicht
   nachweisbar, und das zu behaupten waere unehrlich. */
export const FELIE_KOMBI_MIN    = 3;
export const FELIE_KOMBI_FAKTOR = 2;

export function felieKombiMuster() {
  var tage = felieTagesbilder();
  var out = [];

  FELIE_HYPOTHESEN.forEach(function (h) {
    var schlecht = { n: 0, treffer: 0 }, gut = { n: 0, treffer: 0 };
    tage.forEach(function (t) {
      var bedingung = felieSchlechteNacht(t);
      if (bedingung === null) return;
      var erg = h.ergebnis(t);
      if (erg === null) return;
      var zelle = bedingung ? schlecht : gut;
      zelle.n++;
      if (erg) zelle.treffer++;
    });

    /* Beide Zellen brauchen Belegung. Ohne Gegenprobe ist die Aussage
       wertlos, egal wie viele Treffer auf der einen Seite stehen. */
    if (schlecht.n < FELIE_KOMBI_MIN || gut.n < FELIE_KOMBI_MIN) return;
    var qA = schlecht.treffer / schlecht.n;
    var qB = gut.treffer / gut.n;
    /* Nulldivision vermeiden und den Fall "nie in der Gegenprobe"
       trotzdem zulassen, wenn die Seite selbst deutlich belegt ist. */
    var deutlich = (qB === 0) ? (qA >= 0.6) : (qA / qB >= FELIE_KOMBI_FAKTOR);
    if (!deutlich || qA <= qB) return;

    out.push({ id: h.id, text: h.text(schlecht, gut), schlecht: schlecht, gut: gut,
      von: tage.length ? new Date(tage[0].tag).toISOString() : null,
      bis: tage.length ? new Date(tage[tage.length - 1].tag).toISOString() : null,
      hinweis: 'Kleine beobachtete Stichprobe, kein Nachweis einer Ursache; nicht auf heute übertragbar.' });
  });

  return { muster: out, tage: tage.length };
}

export function bodySnapshotText() {
  var z = felieZyklusDaten();
  return felieKoerperZeilen().trim() + (z.phase ? ' · Grobe Kalenderschätzung: ' + z.phase : ' · Zyklus: unbekannt');
}

/* Wurde aus dieser Notiz bereits eine Angabe? Entschieden wird an der
   QUELLE, nicht am Wortlaut: eine Angabe, die sich auf dieselbe Stelle
   im Gespraech stuetzt, IST diese Notiz — nur in der Form, die felie
   weiterverwendet. Beide nebeneinander zu zeigen hiess, denselben
   Sachverhalt zweimal zu behaupten (E03, E04, Pruefall F04).

   Am Wortlaut liesse sich das nicht entscheiden: „Sie hat einen Mann
   kennengelernt und lebt nun mit ihm zusammen" und „Sie lebt mit ihrem
   Partner zusammen" sind verschieden geschrieben und meinen dasselbe.
   Das zu erkennen waere geraten; dieselbe Belegstelle ist eine Tatsache.

   Sichtbar bleibt die Notiz im Archiv, bei ihrem Gespraech. */
export function gedNotizGedeckt(chat, notiz, fakten, chats) {
  var text = notiz && notiz.text;
  if (!text) return false;
  var belege = (notiz.nachweis && notiz.nachweis.belege) || [];
  if (!belege.length) return false;

  /* Gedeckt wird ueber ALLE Angaben aus diesem Gespraech zusammen, nicht
     ueber eine einzelne. Eine Notiz, die zwei Sachverhalte nennt, wurde
     sonst von keiner der beiden Angaben gedeckt und blieb als Dublette
     stehen — genau der Fall, den E04 ausschliesst.

     Zwei Bedingungen, beide notwendig:
       die Belegstellen der Notiz liegen im Belegraum der Angaben, und
       jedes Inhaltswort der Notiz kommt in den Angaben vor.
     Die zweite haelt das offen, was E04 ausdruecklich schuetzt: ein
     Gefuehl, ein Anliegen oder ein offenes Thema neben der Angabe bleibt
     eine eigene Information und verschwindet nicht mit. */
  var ausChat = fakten.filter(function (f) { return felieErinnerungAusChat(f, chat, chats); });
  if (!ausChat.length) return false;

  var stellen = {};
  ausChat.forEach(function (f) {
    (f.belege || []).forEach(function (b) { stellen[b.nachricht] = true; }); });
  if (!belege.every(function (b) { return stellen[b.nachricht]; })) return false;

  var worte = [];
  ausChat.forEach(function (f) {
    felieMerkWorte(f.text).forEach(function (w) { if (worte.indexOf(w) < 0) worte.push(w); }); });
  var eigene = felieMerkWorte(text);
  if (!eigene.length) return false;
  /* Verneinungen trennen: „keine Kinder" und „Kinder" sind nie dasselbe. */
  var verneintNotiz = FELIE_MERK_VERNEINUNG.test(String(text));
  var verneintAngaben = ausChat.some(function (f) { return FELIE_MERK_VERNEINUNG.test(String(f.text)); });
  if (verneintNotiz !== verneintAngaben) return false;

  /* Eine Notiz, die sich auf MEHRERE Stellen des Gespraechs stuetzt und
     deren Stellen alle von Angaben gedeckt sind, ist eine
     Zusammenfassung — unabhaengig davon, wie sie formuliert ist. Genau
     diese Form entstand unter dem alten Auftrag ("Nutzerin teilt mit,
     ... Parallel wurde ..."), und ihre Erzaehlwoerter wuerden jede
     Wortpruefung ueberstehen. Sie gehoert ins Archiv, nicht ins
     Gedaechtnis (E08); verloren geht dabei nichts, weil das Archiv sie
     weiterhin zeigt.
       Bei einer Notiz zu EINER Stelle entscheidet der Inhalt: dort
     schuetzt die Wortpruefung das, was E04 ausdruecklich offenhaelt —
     ein Gefuehl oder Anliegen neben der Angabe. */
  /* Eine Altnotiz (ohne art) ist unter dem alten Auftrag entstanden und
     fasst das Gespraech zusammen — mit Erzaehlwoertern wie „Nutzerin
     teilt mit", die jede Wortpruefung ueberstehen wuerden. Sind ihre
     Belegstellen von Angaben gedeckt, gehoert sie ins Archiv und nicht
     ins Gedaechtnis (E08). Verloren geht nichts: das Archiv zeigt sie
     weiterhin.
       Eine Notiz nach neuem Vertrag traegt genau EINEN Sachverhalt. Bei
     ihr entscheidet der Inhalt, und die Wortpruefung haelt offen, was
     E04 ausdruecklich schuetzt: ein Gefuehl oder Anliegen neben der
     Angabe bleibt eine eigene Information. */
  var offen = eigene.filter(function (w) { return !felieMerkWortDrin(w, worte); });
  /* Altnotizen (ohne art): gedeckt, ES SEI DENN, ein nicht gedecktes
     Inhaltswort traegt ein Gefuehl, eine Sorge oder ein Anliegen. Aus
     „Ich lebe allein und fuehle mich damit einsam" verdraengte der
     Wohnfakt sonst die Einsamkeit (Supervisor-Abnahme 18.09., A4) —
     waehrend „einen Mann kennengelernt und lebt nun mit ihm zusammen"
     neben „lebt mit ihrem Partner zusammen" derselbe Sachverhalt bleibt
     (F04). Gleiche Quelle heisst nicht gleicher Informationsgehalt; bei
     Unsicherheit bleibt die zusaetzliche Information erhalten. */
  if (notiz.art !== 'notiz') return !offen.some(felieMerkWortEigenstaendig);

  return !offen.length;
}

/* Woerter, die eine eigene Information neben einer Angabe tragen: ein
   Gefuehl, eine Belastung, eine Sorge oder ein Anliegen (E04). Nur fuer
   die Migration von Altnotizen; neue Notizen tragen genau einen
   Sachverhalt und werden vollstaendig am Inhalt geprueft. Praefixe in der
   Schreibweise von felieMerkWorte (ohne Umlaute). */
export function felieMerkWortEigenstaendig(wort) {
  var w = String(wort || '');
  return ['einsam', 'angst', 'sorg', 'belast', 'traur', 'trauer', 'uberford', 'erschopf', 'stress',
    'unsicher', 'hilflos', 'wut', 'wuten', 'schuld', 'scham', 'frust', 'verzweif', 'uberwalt',
    'kummer', 'niedergeschl', 'antriebslos', 'hoffnungslos', 'unruh', 'nervos', 'panik',
    'mochte', 'wunsch', 'wunscht', 'vorhaben', 'plant', 'hofft', 'klaren', 'frage', 'entscheid']
    .some(function (p) { return w.indexOf(p) === 0; });
}

/* ── Zulaessige Erinnerungen: EINE Auswahl fuer Anzeige und Kontext ────
   Bis zum 18.09. (Supervisor-Abnahme, A3) gab es zwei Wege: das sichtbare
   Gedaechtnis las die Notizen aller Gespraeche, der Modellkontext bekam
   nur die Fakten (merknotizen) und die Zusammenfassungen (gespraeche).
   Eine Notiz, die weder Fakt noch Teil der Zusammenfassung war, stand
   sichtbar im Gedaechtnis und erreichte felie nie.

   Jetzt schoepfen beide aus dieser Funktion. Die Sichten:
     'sichtbar'  Gedaechtnis-Karte: merken, nicht durch einen Fakt gedeckt
                 (E04/E08; gedNotizGedeckt).
     'kontext'   normaler Chat: zusaetzlich die Sperren aus Korrekturen
                 und Loeschungen (E15; felieArchivNotizNutzbar) und ohne das
                 gerade fortgesetzte Gespraech — dessen Verlauf IST der
                 Chat. Groessenbegrenzung erledigt der Aufrufer ueber die
                 juengsten Eintraege, nie ueber den internen Typ.
   Begruessung und Rueckblick haben eigene, engere Sichten: die
   Begruessung greift genau EINEN Bezug auf (felieBegruessungBezug), der
   Rueckblick ausgewaehlte Gespraeche im Volltext (felieRueckblickDaten).
   Beides ist dort dokumentiert. */
export function felieGedaechtnisNotizen(sicht, ohne) {
  var out = [];
  var alleChats = [];
  try { alleChats = getSavedChats() || []; } catch (e) { return out; }
  /* Aus dem Speicher, nicht aus der abgeleiteten Sicht: Belege und
     Gespraechszuordnung stehen nur dort. Beruecksichtigt werden nur
     Angaben, die auch sichtbar sind. */
  var alleFakten = [];
  try {
    var sichtbar = {};
    felieFakten().forEach(function (f) { sichtbar[f.id] = true; });
    alleFakten = felieStore().fakten.filter(function (f) { return sichtbar[f.id]; });
  } catch (e) {}
  var schon = [];
  if (sicht === 'kontext') {
    schon = (felieKontextRueckblickAuswahl() || []).map(String);
    [felieKontextAktiverArchivChat()].concat(ohne || []).forEach(function (id) {
      if (id != null) schon.push(String(id));
    });
  }
  alleChats.forEach(function(c) {
    if (schon.indexOf(String(c.id || c.timestamp)) >= 0) return;
    felieNotizenLesen(c).filter(function(n) {
      if (n.merken === false) return false;
      if (gedNotizGedeckt(c, n, alleFakten, alleChats)) return false;
      if (sicht === 'kontext' && !felieArchivNotizNutzbar(c, n)) return false;
      return true;
    }).forEach(function(n) { out.push({ chat: c, notiz: n }); });
  });
  return out;
}

/* Die Notizen fuer den Modellkontext: juengste zuerst, hoechstens max.
   Gleiche Form wie ein Eintrag in gespraeche, damit der Prompt sie gleich
   behandelt: damaliger Stand, kein Beleg fuer Fortdauer. */
export function felieNotizenDaten(max, ohne) {
  var grenze = max || 12;
  var liste = felieGedaechtnisNotizen('kontext', ohne);
  liste.sort(function (a, b) { return (b.chat.timestamp || 0) - (a.chat.timestamp || 0); });
  return liste.slice(0, grenze).map(function (e) {
    return { datum: e.chat.timestamp, thema: e.notiz.feld ? e.chat.thema : e.notiz.thema || e.chat.thema,
      text: e.notiz.text, quelle: felieArchivNotizQuelle(e.chat, e.notiz),
      zeitbezug: 'damaliger Stand; kein offener Auftrag und kein Beleg für Fortdauer' };
  });
}

/* Die Profilbasis im Modellkontext: Name und Alter. Sonst nichts.

   Bis M4 gingen hier zusaetzlich kinder, alltag, wuensche und notiz mit —
   direkt aus klAnswers, also aus der Antwortablage des Kennenlernens.
   Dieselben Angaben stehen laengst als Eintraege im Gedaechtnis, weil
   klV2Sichern sie dort anlegt. Das Modell bekam sie damit zweimal, aus
   zwei Quellen, die sich unabhaengig voneinander aendern koennen: eine
   Korrektur im Gedaechtnis erreichte die klAnswers-Kopie nie, und felie
   sprach danach weiter auf dem alten Stand (I15, Pruefall F40).

   Die Angaben verschwinden dadurch nicht — die Profilansicht liest
   klAnswers unveraendert weiter. Sie sind nur keine zweite
   Modellquelle mehr. Altbestaende, die nie zu Eintraegen wurden, holt
   die Migration in M6 nach; bis dahin stehen sie sichtbar im Profil,
   aber felie stuetzt sich nicht mehr darauf. */
export function felieProfilDaten() {
  var p = felieKontextProfil();
  var a = typeof p.klAnswers === 'object' ? p.klAnswers : {};
  return { name: p.userName || null,
    alter: Number.isInteger(a.alterExact) ? a.alterExact : null,
    alterErfasstAm: a.alterErfasstAm || null,
    altersband: a.alterExact == null ? a.alter || null : null };
}

export function felieSignalDaten() {
  var out = [], jetzt = Date.now();
  var labels = { stimmung: 'Stimmung', schlafqualitaet: 'Nacht', energie: 'Energie', anspannung: 'Anspannung',
    schlaf: 'Schlafdauer', hrv: 'HRV', rhr: 'Ruhepuls', recovery: 'Erholungswert des Geräts',
    deep: 'Tiefschlaf', rem: 'REM-Schlaf', temp: 'Temperaturabweichung von der Gerätebasis', wachphasen: 'Wachphasen' };
  var units = { schlaf: 'min', hrv: 'ms', rhr: 'bpm', recovery: 'Gerätescore/100', deep: 'min', rem: 'min', temp: '°C Differenz', wachphasen: 'Anzahl' };
  Object.keys(labels).forEach(function(key) {
    var sources = ['selbst', 'messung', 'screenshot'];
    sources.forEach(function(quelle) {
      var entries = felieStore().signale.filter(function(e) {
        return felieSignalVerwendbar(e) && e.key === key && e.quelle === quelle && Number.isFinite(e.ts)
          && e.ts <= jetzt && jetzt - e.ts <= FELIE_AUFBEWAHRUNG;
      }).sort(function(a, b) { return b.ts - a.ts; });
      var e = entries[0];
      if (!e) return;
      var selbst = quelle === 'selbst';
      // Alte Screenshotimporte ohne Provenienz wurden früher als Oura verbucht.
      // Nicht als explizit berichtete Energie oder Stress ausgeben.
      if (!selbst && (key === 'energie' || key === 'anspannung')) return;
      var wert = selbst && key === 'stimmung' ? felieStimmungLabel(e.wert)
        : selbst && FELIE_SKALEN[key] ? felieStufenWort(key, e.wert) : e.wert;
      if (wert == null || wert === '') return;
      var meta = e.meta || {};
      out.push({ signal: key, bezeichnung: labels[key], wert: wert, einheit: selbst && FELIE_SKALEN[key] ? 'Selbstauskunft in Worten' : units[key] || 'Selbstauskunft',
        quelle: quelle, geraet: meta.geraet || null,
        zeitpunkt: new Date(e.ts).toISOString(), datum: new Date(e.ts).toLocaleDateString('de-DE'),
        aktuell: felieIstFrisch(e, jetzt), datumsquelle: meta.datumsquelle || 'Eintragszeitpunkt',
        bestaetigt: meta.bestaetigt === true, importiertAm: meta.importiertAm || null });
    });
  });
  return out;
}

export function felieZyklusDaten() {
  var cd = cycleRefresh();
  if (!cd) return { status: 'unbekannt', grund: 'Kein bestätigter Periodenstart' };
  /* cd.estimated ist mit dem Zweig in populateZyklusCard entfallen (AL-12):
     das Feld wird nirgends gesetzt. */
  if (cd.unknown || cd.stale || !cd.lastPeriod || cd.cycleDay == null)
    return { status: 'unbekannt', grund: cd.unknown ? 'Lebensphase oder Zyklus bewusst unbekannt' : 'Keine belastbare aktuelle Kalenderzuordnung',
      /* Die Lebensphase gehoert in den Kontext: sonst fragt felie nach dem
         Zyklus einer Nutzerin, die ihre Schwangerschaft gerade angegeben
         hat. Herkunft mitgeben, damit eine Voreinstellung aus dem
         Kennenlernen nicht wie eine bestaetigte Angabe behandelt wird. */
      lebensphase: cd.lebensphase || (cd.unknown ? cd.phase : null) || null,
      lebensphaseHerkunft: (cd.lebensphase || cd.unknown) ? (cd.quelle === 'kennenlernen' ? 'aus dem Kennenlernen übernommen, nicht erneut bestätigt' : 'selbst im Zyklusbereich gewählt') : null,
      letzterBestaetigterStart: cd.lastPeriod || null };
  return { status: 'grobe Kalenderschätzung', letzterBestaetigterStart: cd.lastPeriod,
    angenommeneLaenge: cd.selectedLen, tagSeitBestaetigtemStart: cd.cycleDay,
    /* Laeuft der Zyklus innerhalb einer angegebenen Lebensphase, muss das
       Modell das wissen: eine Kalenderphase in den Wechseljahren oder der
       Stillzeit ist noch weniger belastbar als sonst. */
    lebensphase: cd.lebensphase || null,
    /* Innerhalb der Kulanz laeuft der Zyklustag weiter, obwohl die
       erwartete Periode vorbei ist. Ohne diese Angabe wuerde das Modell
       einen Tag 31 als gewoehnlichen Zyklustag lesen. Ausdruecklich ohne
       Deutung: eine ausgebliebene Periode hat viele Gruende. */
    periodeUeberfaelligTage: cd.ueberfaellig != null ? cd.ueberfaellig : null,
    phase: cd.phase, hormoneGemessen: false };
}

/* ══ Gesprächskontext für den laufenden Chat ══════════════════════
   Bis M4 hing an JEDER Chatanfrage das Feld `archiv` mit den Notizen der
   letzten sechs Gespraeche. M4 hat es entfernt, weil eine korrigierte
   Angabe in der anders formulierten Notiz weiterlebte: die Korrektur
   erreichte den Fakt, nicht die Notiz (F20, F21, F25).

   Der Preis war groesser als gedacht - felie wusste im normalen Chat
   nichts mehr von frueheren Gespraechen und wirkte entsprechend.

   Seit M6 gibt es das, was M4 fehlte: eine Korrektur sperrt die
   BELEGSTELLE im Gespraech (felieArchivQuelleSperren), und
   felieArchivBelegGesperrt filtert alles heraus, was auf dieser Stelle
   steht - unabhaengig davon, wie es formuliert ist. Seit M7 gibt es
   ausserdem genau EINE Zusammenfassung je Gespraech statt einer
   Notizsammlung.

   Damit ist der Kontext wieder tragbar. Zurueck kommt nicht das alte
   Feld, sondern das neue Objekt, durch dieselben Pruefungen gefiltert
   wie das Archiv.

   Altgespraeche haben noch keine Zusammenfassung; dort sind es ihre
   Notizen OHNE art - nach dem Vertrag von M7 ist genau das ihre
   damalige Zusammenfassung. Notizen mit art='notiz' bleiben draussen:
   die gehoeren ins Gedaechtnis, nicht in den Gespraechsrueckblick. */
export function felieGespraecheDaten(max, ohne) {
  var grenze = max || 6;
  var chats = [];
  try { chats = getSavedChats() || []; } catch (e) { return []; }
  /* Ein ausdruecklich gewaehlter Rueckblick liegt schon im Volltext bei.
     Dasselbe Gespraech zweimal einzuspeisen waere Gewichtung durch
     Wiederholung.
       Dasselbe gilt fuer ein fortgesetztes Archivgespraech: sein Verlauf
     IST der laufende Chat. Die Zusammenfassung daneben zu legen hiesse,
     dem Modell dieselbe Sache zweimal zu sagen - einmal im Wortlaut und
     einmal in felies Nacherzaehlung (Pruefall F25). */
  var schon = (felieKontextRueckblickAuswahl() || []).map(String);
  /* NUR das gerade geoeffnete Archivgespraech, nicht das zuletzt
     gespeicherte. `_letzteChatId` stand hier bis zum 17.09. mit drin und
     war ein Fehler: saveChat setzt es auf das eben abgeschlossene
     Gespraech, und damit fehlte auf der Startseite ausgerechnet das, worum
     es gerade ging — felie griff nach dem vorletzten. Fuer die Dublette
     beim Fortsetzen (F25) reicht `_felieAktiverArchivChat`; nur das setzt
     reopenSavedChat, und `felieKontextFuer('fortsetzung')` nennt sein
     Gespraech ohnehin ausdruecklich. */
  [felieKontextAktiverArchivChat()].concat(ohne || []).forEach(function (id) {
    if (id != null) schon.push(String(id));
  });
  var out = [];
  for (var i = chats.length - 1; i >= 0 && out.length < grenze; i--) {
    var c = chats[i];
    var cid = String(c.id || c.timestamp);
    if (schon.indexOf(cid) >= 0) continue;
    var text = null, quelle = null;
    if (c.zusammenfassung && c.zusammenfassung.text) {
      var z = { id: 'zusammenfassung:' + cid, merken: true,
        text: c.zusammenfassung.text, nachweis: c.zusammenfassung.nachweis };
      if (felieArchivNotizNutzbar(c, z)) { text = z.text; quelle = felieArchivNotizQuelle(c, z); }
    }
    if (!text) {
      /* Kein Zusammenfassungsobjekt: dann sind die Notizen das, was von
         diesem Gespraech ueberhaupt aufgeschrieben wurde - das Archiv
         zeigt bei so einem Gespraech genau sie (felieNotizenHtml).

         Die erste Fassung schloss hier Notizen mit art='notiz' aus, weil
         die ins Gedaechtnis gehoeren (E08). Der Live-Abzug vom 17.09.
         zeigte die Folge: drei gespeicherte Gespraeche, `gespraeche: []`
         - beide Wege zu, und felie wusste weiterhin nichts. Die Regel
         gilt dort, wo es etwas zu unterscheiden GIBT: liegt eine
         Zusammenfassung vor, hat sie Vorrang und die Notizen bleiben
         draussen. Liegt keine vor, sind die Notizen die einzige Spur. */
      var alt = [];
      try {
        alt = felieNotizenLesen(c).filter(function (n) {
          return felieArchivNotizNutzbar(c, n);
        });
      } catch (e) { alt = []; }
      if (alt.length) {
        text = alt.map(function (n) { return n.text; }).join(' ');
        quelle = felieArchivNotizQuelle(c, alt[0]);
      }
    }
    if (!text) continue;
    out.push({ datum: c.timestamp, thema: c.thema || 'Gespräch',
      zusammenfassung: text, quelle: quelle,
      zeitbezug: 'damaliger Stand; kein offener Auftrag und kein Beleg für Fortdauer' });
  }
  return out;
}

/* Ausdruecklicher Rueckblick auf ausgewaehlte Gespraeche. Nichts wird
   automatisch beigelegt: ohne Auswahl gibt es keinen Rueckblick. */
export function felieRueckblickDaten(gespraechIds) {
  var ids = (gespraechIds || []).map(String);
  if (!ids.length) return { zweck: 'rueckblick', gespraeche: [], hinweis: 'Ohne ausgewähltes Gespräch kein Rückblick.' };
  var chats = getSavedChats().filter(function (c) {
    return ids.indexOf(String(c.id || c.timestamp)) >= 0; });
  /* Was der Rueckblick liefert, sind die eigenen Worte der Nutzerin und
     die Fassungen, die damals galten — keine Paraphrase.

     Die Altnotizen gehen NICHT mehr als Text mit. Sie sind
     Zusammenfassungen ohne Bindung an eine Aussage: eine Korrektur kann
     sie nicht gezielt erreichen, und eine Sperre haette sie nur ganz
     treffen koennen, mitsamt allem Unbeteiligten darin (Pruefaelle F06,
     F13). Beides ist geraten. Die Nachrichten der Nutzerin dagegen sind
     die Urquelle, und eine Berichtigung sperrt darin genau die Stelle,
     an der die ueberholte Aussage stand.

     Sichtbar bleiben die Notizen unveraendert im Archiv — sie sind ihre
     Gespraechsnotizen, nicht Modellfutter. */
  var raus = [];
  chats.forEach(function (c) {
    var cid = String(c.id || c.timestamp);
    var eigene = [];
    (c.messages || []).forEach(function (m, i) {
      if (!m || m.role !== 'user' || typeof m.content !== 'string') return;
      var text = felieStelleBereinigt(c, i, m.content);
      if (text) eigene.push(text);
    });
    var damals = felieRueckblickAussagen(cid);
    if (!eigene.length && !damals.length) return;
    raus.push({ datum: new Date(c.timestamp).toLocaleDateString('de-DE'),
      thema: c.thema || 'Unser Gespräch', eigeneWorte: eigene, aussagen: damals,
      zeitbezug: 'damaliger Stand; kein Beleg für Fortdauer' });
  });
  return { zweck: 'rueckblick', gespraeche: raus,
    hinweis: 'Ausdrücklich ausgewählter Rückblick. Historischen Stand mit Datum benennen und vom aktuellen Stand getrennt halten. Die Angaben sind die eigenen Worte der Nutzerin von damals; berichtigte Stellen fehlen bewusst und dürfen nicht ergänzt werden.' };
}

/* Gehoert diese Fassung zu diesem Gespraech? Zwei Wege, und beide
   werden gebraucht:

     ueber die Belege — der Normalfall bei allem, was sauber belegt ist.
       Nachrichten-Kennungen entstehen als "<Gespraech>-m<Position>";
       daraus laesst sich das Gespraech ablesen, ohne Nachrichten im
       dauerhaften Datensatz zu halten.
     ueber den Altlink — fuer Eintraege ohne aufloesbaren Beleg. Das ist
       die einzige Herkunftsangabe, die der Altbestand hat.

   Der erste Weg fehlte zunaechst, und zwar genau dort, wo alles richtig
   lief: eine gut belegte Angabe hat KEINEN Altlink (der entsteht nur,
   wenn sich der Beleg nicht aufloesen laesst). Der Rueckblick lieferte
   dadurch nur die eigenen Worte und keine einzige Fassung. */
export function felieRueckblickGehoert(d, r, cid) {
  var treffer = false;
  (r.supportSets || []).forEach(function (set) {
    (set || []).forEach(function (id) {
      var ev = felieRepoFind(d.evidence, id);
      if (!ev || !ev.locator || ev.locator.kind !== 'message') return;
      var mid = String(ev.locator.messageId || '');
      var i = mid.lastIndexOf('-m');
      if (i > 0 && mid.slice(0, i) === cid) treffer = true;
    });
  });
  if (treffer) return true;
  var link = (d.legacyHerkunft || []).filter(function (l) { return l.entryId === r.entryId; })[0];
  return !!(link && link.conversationIds.indexOf(cid) >= 0);
}

export function felieRueckblickAussagen(cid) {
  var d = felieDatensatzStand();
  if (!d || !Array.isArray(d.revisions)) return [];
  var raus = [];
  d.revisions.forEach(function (r) {
    if (!r.text || r.historicalUse !== 'allowed') return;
    if (r.status !== 'current' && r.status !== 'superseded') return;
    if (!felieRueckblickGehoert(d, r, cid)) return;
    if (raus.indexOf(r.text) < 0) raus.push(r.text);
  });
  return raus;
}

/* `ohne` nennt Gespraeche, deren Inhalt an dieser Anfrage schon haengt -
   beim Fortsetzen der bereinigte Originalverlauf. Der Aufrufer sagt es,
   statt dass die Funktion es aus einem globalen Merker erraet. */
/* Die aktuellen Angaben, so wie das Modell sie sieht. Ausgelagert, weil
   seit M12 zwei Zwecke dieselbe Liste brauchen: das laufende Gespraech
   und die Begruessung auf der Startseite. Zwei Fassungen davon waeren
   zwei Wahrheiten. */
export function felieAngabenDaten() {
  return felieFakten().map(function(f) {
    /* Kategorie und Herkunft gehen jetzt als eigene Felder mit. Vorher
       stand die Einordnung als Praefix im Text ("Hormoneller Kontext nach
       eigener Angabe: …") — das las sich im Profil wie ein Formularfeld
       und war der einzige Weg, dem Modell zu sagen, WOHER die Angabe
       stammt. Zwei getrennte Aufgaben, jetzt auch zwei getrennte Felder.
         'kennenlernen' war bisher mit den Gespraechsfakten in einen Topf
       geworfen und trug die Warnung "kann überholt sein" — dabei ist es
       ihre eigene Auskunft. */
    return { text: f.text, kategorie: f.kategorie, klasse: f.klasse,
      alterTage: f.alterTage, bestaetigtAm: f.bestaetigtAm,
      quelle: f.bearbeitetAm ? 'von der Nutzerin korrigiert; ersetzt frühere Fassungen' : f.quelle === 'selbst' ? 'von der Nutzerin selbst eingetragen'
        : f.quelle === 'kennenlernen' ? 'Selbstauskunft aus dem Kennenlernen'
        : 'aus einem Gespräch mitgenommen, kann überholt sein' };
  });
}

export function felieKontextDaten(ohne) {
  var fakten = felieAngabenDaten();
  var episoden = felieEpisoden({ nurAktuell: true }).map(function(e) {
    return { text: e.text, status: e.status, faelligBis: e.faelligBis };
  });
  var muster = [];
  try { var km = felieKombiMuster(); muster = (km.muster || []).slice(0, 2); } catch (e) {}
  return { datum: new Date().toLocaleDateString('de-DE'), profil: felieProfilDaten(),
    signale: felieSignalDaten(), zyklus: felieZyklusDaten(), geraeteVergleiche: felieGeraeteVergleiche(),
    merknotizen: fakten, offeneEpisoden: episoden,
    /* Sichtbare Gedaechtnisnotizen, die weder Fakt noch Teil einer
       Zusammenfassung sind (A3, 18.09.). Dieselbe Auswahl wie die
       Gedaechtnis-Karte, zusaetzlich durch Sperren und Korrekturen
       gefiltert; die juengsten zwoelf. */
    notizen: felieNotizenDaten(12, ohne),
    /* Zur Geschichte dieser Stelle: Bis M4 hingen an jeder Anfrage die
       Notizen der letzten sechs Gespraeche; dort lebte eine korrigierte
       Angabe in ihrer alten Fassung weiter, weil die Korrektur den Fakt
       erreichte und die anders formulierte Archivnotiz nicht (Pruefaelle
       F20, F21, F25). M4 loeste das durch Weglassen (E11). Seit M10 sind
       die Gespraeche wieder dabei — als Zusammenfassung je Gespraech,
       durch die Sperren aus M6/M10 gefiltert, mit Zeitbezug.
         Entscheidung B1 vom 18.09. (Supervisor-Abnahme): E11 gilt als
       fortgeschrieben, dieser Stand ist der Zielzustand. Was E11 schuetzt,
       bleibt geprueft: keine berichtigte oder geloeschte Aussage erreicht
       den Kontext (felieArchivNotizNutzbar), aktueller Stand und
       Vergangenheit sind getrennt (zeitbezug), und ein ausdruecklicher
       Rueckblick bleibt ein eigener Zweck (felieRueckblickDaten). */
    zweck: 'aktuelles_gespraech',
    gespraeche: felieGespraecheDaten(6, ohne),
    /* Nur bei ausdruecklicher Auswahl, und dann sichtbar getrennt vom
       aktuellen Stand. Ohne Auswahl ist das Feld nicht da — der normale
       Chat bekommt weiterhin kein Archiv (E11). */
    rueckblick: felieKontextRueckblickAuswahl() && felieKontextRueckblickAuswahl().length
      ? felieRueckblickDaten(felieKontextRueckblickAuswahl()) : undefined,
    berechneteMuster: { quelle: 'App-Berechnung; Beobachtung, keine Ursache', eintraege: muster } };
}

export function felieGeraeteVergleiche() {
  if (felieStore().zusatz.messKontoVerifiziert !== true) return [];
  var history = (felieStore().zusatz || {}).messHistory30;
  if (!Array.isArray(history)) return [];
  var daily = {};
  history.forEach(function(h) {
    var d = h && cycleMidnight(h.day);
    if (d && d <= cycleMidnight(new Date()) && Date.now() - d.getTime() <= 30 * 86400000) daily[h.day] = h;
  });
  var keys = Object.keys(daily).sort();
  if (keys.length < 4) return [];
  var last = daily[keys[keys.length - 1]], end = cycleMidnight(last.day).getTime();
  var prior = keys.filter(function(k) { var t = cycleMidnight(k).getTime(); return t < end && end - t <= 7 * 86400000; });
  var units = { sleepMins: 'min', hrv: 'ms', rhr: 'bpm', readiness: 'Oura Readiness/100', deep: 'min', rem: 'min' };
  var out = [];
  Object.keys(units).forEach(function(field) {
    var observed = prior.filter(function(k) { return typeof daily[k][field] === 'number' && Number.isFinite(daily[k][field]); });
    if (observed.length < 3 || typeof last[field] !== 'number' || !Number.isFinite(last[field])) return;
    var avg = observed.reduce(function(sum, k) { return sum + daily[k][field]; }, 0) / observed.length;
    out.push({ quelle: 'messung', signal: field, einheit: units[field], von: observed[0], bis: observed[observed.length - 1],
      naechte: observed.length, durchschnitt: Math.round(avg * 10) / 10,
      vergleichstag: last.day, vergleichswert: last[field], differenz: Math.round((last[field] - avg) * 10) / 10,
      hinweis: 'Beschreibender Vergleich desselben Geräts; keine medizinische Bewertung und keine Ursache.' });
  });
  return out;
}
