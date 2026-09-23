/* Gedaechtnis - seit Welle D, Paket D3b, ein Kern-Modul.

   Angaben und Themen schreiben, lesen, bearbeiten und verlaengern; die
   Notizen eines Gespraechs lesen, pruefen und bearbeiten; die Vorschlaege
   aus der Auswertung mit dem Bestand abgleichen und uebernehmen. Bis D3b
   standen diese Funktionen in index.html. Geprueft vor dem Umzug:
   felie-d3-gedaechtnis (D3a).

   Geaendert sind nur drei Zugriffe:
   - der Speichervorgang laeuft ueber den Vorgangs-Port
     (felieVorgangPort, seit D1c) statt ueber den globalen Namen
     felieDatenAendern;
   - das letzte Gespraech (window._letzteChatId) und die Meldung an die
     Startseite (felieHomeEreignis) kommen ueber die verbundene Umgebung
     (felieGedaechtnisVerbinden, Entscheidung D-13).

   In der Webapp bleiben die Oberflaeche (felieSnip*, felieNotizenHtml),
   die Auswertung mit dem Modell (felieNotizErzeugen, D4) und die
   Archiv-Lesewege (D5).

   Der urspruengliche Wortlaut folgt unveraendert. */

import { felieNotizSchluessel, felieNotizText } from './text.js';
import { felieRepoId, felieRepoJetzt, felieRepoKopf } from './repository.js';
import { FELIE_AUFBEWAHRUNG, felieStore } from './store.js';
import { getSavedChats } from './gespraeche.js';
import { felieBrueckeBefehl, felieBrueckeEintragZuAltId, felieBrueckeSchreiben, felieBrueckeVorschlag, felieBrueckeZeit, felieRepoAktiv, felieVorgangPort } from './bruecke.js';

/* Umgebung des Gedaechtnisses (seit D3b, D-13 "verbundener Rueckruf").
   Zwei Dinge weiss nur die Webapp: welches Gespraech gerade das letzte
   ist (window._letzteChatId, gesetzt im Gespraechsablauf) und wie die
   Startseite auf eine Aenderung reagiert (felieHomeEreignis).
   letzterChat() ist der Rueckfall, wenn ein Schreibweg kein Gespraech
   mitbekommt; ereignis(art, detail) meldet, was geschah. Unverbunden gibt
   es kein letztes Gespraech und keine Meldung. Der Zustand selbst bleibt
   vorerst in der Webapp (AL-94). */
let umgebung = null;

export function felieGedaechtnisVerbinden(u) {
  umgebung = u || null;
}

export function felieGedaechtnisLetzterChat() {
  return umgebung && typeof umgebung.letzterChat === 'function' ? umgebung.letzterChat() : undefined;
}

export function felieGedaechtnisEreignis(art, detail) {
  if (umgebung && typeof umgebung.ereignis === 'function') umgebung.ereignis(art, detail);
}

/* Tage, um die ein offenes Thema verlaengert wird, wenn die Nutzerin
   "Noch aktuell?" bejaht. */
export const FELIE_FADEN_VERLAENGERUNG = 14;
/* FELIE_FADEN_TAGE (Standardfrist offener Themen): seit Welle D / D1c in
   src/kern/bruecke.js */
/* Speicherschluessel und die Listen FELIE_LS_KEYS / FELIE_LS_KEYS_ALTLAST:
   seit Welle D / D1b in src/kern/speicher.js. Wer einen Schluessel
   hinzufuegt, traegt ihn dort ein. */

/* Selbstauskunft: die drei Signale, die die Nutzerin selbst angibt.
   Nur diese duerfen die Deutung tragen. */


/* Signale (FELIE_FELD_MAP bis felieMuster) und Zyklusattribute
   (felieZyklus*): seit Welle D / D2b in src/kern/signale.js und
   src/kern/zyklus.js */

/* felieStore und felieRevision: seit Welle D / D1b in src/kern/store.js */





/* Divergenz zwischen Gefuehl und Messung — als Gespraechsangebot,
   nicht als Bewertung. Nur bei frischen Werten auf beiden Seiten und
   erst bei zwei Baendern Abstand; ein Band Unterschied ist Rauschen.
   Ein Messwert darf ein berichtetes Symptom nie abschwaechen,
   deshalb liefert die Funktion nur die Beobachtung, nie eine Deutung. */


/* ── Fakten ───────────────────────────────────────────────────────── */

/* klasse: 'stabil'  — Kinder, chronisches, Arbeitssituation.
                       Verfaellt nie durch Nichterwaehnung.
           'volatil' — Wohnsituation, Beziehungsstatus, aktuelle Last.
                       Verfaellt 365 Tage nach der letzten Bestaetigung. */
/* Umgestellt auf das Repository (M2b). Der frueher hier stehende
   Kategorie-Ersatz ist damit endgueltig weg: er traf den ERSTEN Eintrag
   einer Kategorie und konnte aus „Sie hat zwei Kinder." eine Wohnangabe
   machen. Ziel ist jetzt entweder die mitgegebene Alt-ID oder
   wortgleicher Inhalt — beides ohne Raten.

   gespraechId sagt, auf welches Gespraech sich die Belege beziehen. Im
   Vertrag ist der Beleg Teil des Anlegens und kein Nachtrag; ohne ihn
   entsteht ein ausdruecklich unklarer Eintrag statt eines scheinbar
   belegten. */
export function felieFaktSetzen(f) {
  if (!f || !f.text) return null;
  return felieBrueckeSchreiben('personal', f,
    f.gespraechId != null ? f.gespraechId : felieGedaechtnisLetzterChat());
}

/* Bestaetigung heisst aufgegriffen, nicht bloss mitgeschickt. Sonst
   verfaellt nie etwas und die Frist waere ein Feigenblatt. Diese
   Funktion wird deshalb nur aus der Merknotiz-Bestaetigung heraus
   aufgerufen, nicht beim Zusammenstellen des Kontexts. */


export function felieFakten(opts) {
  opts = opts || {};
  var jetzt = Date.now();
  return felieStore().fakten.filter(function(f) {
    if (opts.kategorie && f.kategorie !== opts.kategorie) return false;
    return f.klasse === 'stabil' || jetzt - (f.bestaetigtAm || f.erfasstAm) <= FELIE_AUFBEWAHRUNG;
  }).map(function(f) {
    return {
      id: f.id, text: f.text, kategorie: f.kategorie, klasse: f.klasse,
      erfasstAm: f.erfasstAm, bestaetigtAm: f.bestaetigtAm, quelle: f.quelle, bearbeitetAm: f.bearbeitetAm || null,
      /* Lange nicht bestaetigt: felie formuliert vorsichtiger */
      alterTage: Math.floor((jetzt - (f.bestaetigtAm || f.erfasstAm)) / 86400000)
    };
  });
}



/* ── Episoden ─────────────────────────────────────────────────────── */

/* Umgestellt auf das Repository (M2b). Eine erneute Erwaehnung ist eine
   Bestaetigung, kein zweiter Eintrag — und sie verlaengert die Frist
   nicht von selbst. Der Zaehler „3x erwaehnt" ergibt sich aus der Zahl
   unabhaengiger Stuetzungen. Die Befoerderung zum Fakt entfaellt (E19). */
export function felieEpisode(ep) {
  if (!ep || !ep.text) return null;
  return felieBrueckeSchreiben('topic', ep,
    ep.gespraechId != null ? ep.gespraechId : felieGedaechtnisLetzterChat());
}

/* Text einer Episode nachtraeglich korrigieren. Eigene Funktion, weil
   felieEpisode() die id aus dem Text ableitet — ein Aufruf mit korrigiertem
   Text wuerde also einen ZWEITEN Faden anlegen statt den alten zu aendern.
   Die id bleibt bewusst stehen: sie ist opak, und ein Wechsel wuerde
   Verweise brechen. */


/* Ein Faden verschwindet jetzt durch Loeschen, nicht durch einen
   Statuswechsel. Grund ist die Zusage aus dem Onboarding: jede Erinnerung
   ist "aenderbar und loeschbar". Ein × mit der Rueckfrage "Erinnerung
   loeschen?" darf nicht bloss ein Kennzeichen umsetzen und den Eintrag im
   Speicher und in der Sicherung stehen lassen.
     Der Status 'abgeschlossen' bleibt bestehen — felieBereinigen() setzt
   ihn weiter, wenn eine Frist ohne Zutun ablaeuft. Die frueher hier
   stehende Funktion felieEpisodeAbschliessen() hatte danach keinen
   Aufrufer mehr und ist entfallen. */


/* Verlaengert einen Faden, wenn die Nutzerin "Noch aktuell?" mit Ja
   beantwortet. 14 Tage: lang genug, dass die Frage nicht staendig
   wiederkommt, kurz genug, dass ein erledigtes Thema nicht monatelang
   mitlaeuft. zuletztAm wandert mit, sonst wuerde die Aufbewahrungsfrist
   weiter auf dem alten Datum rechnen. */
export function felieEpisodeVerlaengern(id, tage) {
  var frist = Date.now() + (tage || FELIE_FADEN_VERLAENGERUNG) * 86400000;
  var gefunden = false;
  var ok = felieVorgangPort()(function () {
    var d = felieRepoAktiv();
    var eintrag = felieBrueckeEintragZuAltId(d, 'topic', id);
    var kopf = eintrag ? felieRepoKopf(d, eintrag.id) : null;
    if (!kopf) return;
    gefunden = true;
    /* „Noch aktuell?" — „Ja" ist eine ausdrueckliche Bestaetigung der
       Nutzerin: eine eigene Quelle, die die Frist weiterreicht. Der
       Inhalt aendert sich nicht, also entsteht keine neue Fassung. */
    felieBrueckeBefehl({ kind: 'confirm', entryId: eintrag.id,
      expectedHeadRevisionId: kopf.id, expiresAt: felieBrueckeZeit(frist),
      evidence: [{ id: felieRepoId('ev'), recordedAt: felieRepoJetzt(), assertion: 'explicit',
        locator: { kind: 'direct', sourceEventId: felieRepoId('src'), fieldKey: 'noch_aktuell',
          authoredValue: true, confirmedRevisionId: kopf.id } }],
      supportSets: [] });
  });
  return ok && gefunden;
}

export function felieEpisoden(opts) {
  opts = opts || {};
  var jetzt = Date.now();
  return felieStore().episoden.filter(function(e) {
    if (opts.status && e.status !== opts.status) return false;
    /* Anders als die ANZEIGE (M28) bleibt der Kontext streng: ohne
       gueltiges Datum geht ein Thema nicht als aktuelles an das Modell.
       Das ist eine Regel des v6-Vertrags und war gewollt — felie soll
       nichts als laufend behaupten, dessen Frist sie nicht kennt. Die
       Anzeige darf denselben Eintrag trotzdem zeigen: dort ist er ein
       Datenfehler, den die Nutzerin sehen und bearbeiten koennen soll,
       aber keine abgelaufene Frist. */
    if (opts.nurAktuell && (e.status !== 'offen' || !Number.isFinite(e.faelligBis) || e.faelligBis <= jetzt)) return false;
    return true;
  });
}

export function felieBelegeGleich(a, b) {
  return (a || []).some(function(x) { return x && x.beleg && (b || []).some(function(y) {
    return y && x.beleg === y.beleg && x.nachricht === y.nachricht;
  }); });
}
export function felieErinnerungAusChat(e, chat, alleChats) {
  if (e.herkunftUnklar) return false;
  var cid = chat.id || chat.timestamp;
  if (Array.isArray(e.gespraechIds)) return e.gespraechIds.indexOf(cid) >= 0;
  if (chat.onboardingId && String(e.id).indexOf('aufnahme:' + chat.onboardingId + ':') === 0) return true;
  if (!e.belege || !e.belege.length) return false;
  function belegt(c) { return e.belege.every(function(b) {
    var m = c.messages && c.messages[b.nachricht];
    return m && m.role === 'user' && typeof m.content === 'string' && b.beleg && m.content.indexOf(b.beleg) >= 0;
  }); }
  var treffer = (alleChats || getSavedChats()).filter(belegt);
  // Historical entries without an ID are attributed only unambiguously.
  return treffer.length === 1 && (treffer[0].id || treffer[0].timestamp) === cid;
}
export function felieErinnerungVerknuepfen(e, chatId) {
  if (!e || chatId == null) return;
  if (!Array.isArray(e.gespraechIds)) e.gespraechIds = [];
  if (e.gespraechIds.indexOf(chatId) < 0) e.gespraechIds.push(chatId);
}

export function felieArchivVerlaufSperren(chat, belege) {
  chat.kontextNachrichtenAuslassen = chat.kontextNachrichtenAuslassen || [];
  (belege || []).forEach(function(b) {
    var i = b.nachricht, m = chat.messages && chat.messages[i];
    if (!Number.isInteger(i) || !m || m.role !== 'user' || !b.beleg || m.content.indexOf(b.beleg) < 0) return;
    if (chat.kontextNachrichtenAuslassen.indexOf(i) < 0) chat.kontextNachrichtenAuslassen.push(i);
    // Replies to a retired source may paraphrase the same obsolete claim.
    for (var j = i + 1; j < chat.messages.length && chat.messages[j].role !== 'user'; j++)
      if (chat.kontextNachrichtenAuslassen.indexOf(j) < 0) chat.kontextNachrichtenAuslassen.push(j);
  });
}

export function felieArchivQuelleSperren(chats, vorher) {
  if (!vorher || !vorher.text) return;
  chats.forEach(function(c) {
    /* Zuerst die Ursprungsstelle der berichtigten Aussage selbst. Bisher
       geschah das nur INNERHALB der Notizschleife - gab es zu dem
       Gespraech keine passende Notiz, wurde gar nichts gesperrt.
       Solange nur Notizen ins Modell gingen, fiel das nicht auf. Seit
       M10 geht die Gespraechszusammenfassung mit, und die steht auf
       genau dieser Stelle: ohne diese Zeile kaeme die berichtigte
       Aussage ueber den Gespraechsrueckblick zurueck - der Fehler, den
       M4 durch Weglassen geloest hatte. */
    if (felieErinnerungAusChat(vorher, c, chats)) felieArchivVerlaufSperren(c, vorher.belege);
    felieNotizenLesen(c).forEach(function(n) {
      var gleich = felieNotizSchluessel(n.text) === felieNotizSchluessel(vorher.text);
      var verwandt = felieErinnerungAusChat(vorher, c, chats) &&
        felieBelegeGleich(vorher.belege, n.nachweis && n.nachweis.belege);
      if (!gleich && !verwandt) return;
      felieArchivVerlaufSperren(c, (n.nachweis && n.nachweis.belege) || []);
      if (felieErinnerungAusChat(vorher, c, chats)) felieArchivVerlaufSperren(c, vorher.belege);
      c.kontextAuslassen = c.kontextAuslassen || [];
      if (c.kontextAuslassen.indexOf(n.id) < 0) c.kontextAuslassen.push(n.id);
    });
  });
}

/* Der Bezug einer Aenderung stimmt nicht mehr: der Eintrag, das
   Gespraech oder die Notiz, auf die sie sich beruft, ist nicht mehr da.
   Kein Speicherproblem — deshalb als eigener Grund gekennzeichnet. */
export function felieStandFehler(meldung) {
  var e = new Error(meldung);
  e.repoFehler = 'bezug_fehlt';
  return e;
}

/* Umgestellt auf das Repository (M2b).

   Loeschen ist forgetEntry: Inhalt und texttragende Ableitungen gehen,
   der sichtbare Verlauf bleibt, die Ursprungsstellen werden gesperrt.

   Ein Textwechsel ist manualUpdate. Die Nutzerin bestaetigt damit
   ausdruecklich den sichtbaren Inhalt — das ist eine eigenstaendige
   Quelle. Frueher setzte dieselbe Bedienung still bestaetigtAm neu und
   verlaengerte die Aufbewahrungsfrist, ohne dass jemand das so gewaehlt
   haette. Neu ist nur, dass die vorige Fassung nicht mehr als damaliger
   Stand erzaehlt wird, solange die zeitliche Einordnung fehlt. */
/* Drei Wege, nicht einer (Pruefall F38, entschieden am 17.09.).

     unveraenderter Text  → Bestaetigung. Die Angabe stimmt weiterhin;
                            das ist eine eigene Quelle, aber kein neuer
                            Inhalt und keine abgeloeste Fassung.
     'formulierung'       → nur anders gesagt. Herkunft, Gueltigkeit und
                            Bestaetigungszeit bleiben, wie sie waren; der
                            fruehere Stand bleibt fuer den Rueckblick
                            verwendbar.
     sonst                → inhaltliche Aenderung. Die vorige Fassung
                            wird abgeloest und ohne zeitliche Einordnung
                            nicht mehr als damaliger Stand erzaehlt.

   Bis M6 war jede Bearbeitung der dritte Fall. Ein berichtigter
   Tippfehler setzte damit die Bestaetigungszeit neu und sperrte die
   Vergangenheit der Angabe — fuer eine Aenderung, die inhaltlich keine
   war. Die Unterscheidung kommt von der Nutzerin, nie aus
   Textaehnlichkeit: raten waere hier schlimmer als fragen. */
export function felieErinnerungBearbeiten(art, id, text, wie) {
  /* Was tatsaechlich passiert ist - erst hier drin steht es fest. Der
     Aufrufer weiss nicht, ob sein Text am Ende eine Aenderung war: bei
     unveraendertem Wortlaut passiert naemlich nichts (entschieden am
     17.09.), und dann darf die Startseite auch nichts melden. */
  var vorgang = null;
  var ok = felieVorgangPort()(function(s, chats) {
    var liste = art === 'fakt' ? s.fakten : s.episoden;
    var e = liste.find(function(x) { return x.id === id; });
    if (!e) throw felieStandFehler('Erinnerung fehlt');
    var was = art === 'fakt' ? 'angabe' : 'thema';
    var alterText = e.text;
    felieArchivQuelleSperren(chats, e);
    var d = felieRepoAktiv();
    var eintrag = felieBrueckeEintragZuAltId(d, art === 'fakt' ? 'personal' : 'topic', id);
    if (!eintrag) throw new Error('Erinnerung im Datensatz nicht gefunden');
    var kopf = felieRepoKopf(d, eintrag.id);
    if (text === null) {
      felieBrueckeBefehl({ kind: 'forgetEntry', entryId: eintrag.id,
        expectedHeadRevisionId: kopf ? kopf.id : null });
      vorgang = { was: was, wie: 'geloescht', text: alterText };
      return;
    }
    var quelle = { id: felieRepoId('ev'), recordedAt: felieRepoJetzt(), assertion: 'explicit',
      locator: { kind: 'direct', sourceEventId: felieRepoId('edit'), fieldKey: null,
        authoredValue: text, confirmedRevisionId: kopf ? kopf.id : null } };
    var unveraendert = !!(kopf && kopf.text
      && felieNotizSchluessel(kopf.text) === felieNotizSchluessel(text));

    /* Unveraendert gespeichert ist KEINE Bestaetigung (entschieden am
       17.09.). Den Editor zu oeffnen und wieder zu schliessen ist kein
       Vorgang, und eine Angabe soll nicht dadurch frisch wirken, dass
       jemand sie versehentlich angetippt hat. Nur eine tatsaechliche
       Eingabe zaehlt. Ausdrueckliches Bestaetigen bleibt ueber den
       Parameter moeglich, falls die Oberflaeche spaeter einen eigenen
       Weg dafuer bekommt. */
    if (unveraendert && wie !== 'bestaetigung') return;
    if (wie === 'bestaetigung') {
      felieBrueckeBefehl({ kind: 'confirm', entryId: eintrag.id,
        expectedHeadRevisionId: kopf ? kopf.id : null,
        evidence: [quelle], supportSets: [[quelle.id]] });
      vorgang = { was: was, wie: 'bestaetigung', text: text };
      return;
    }
    vorgang = { was: was, wie: wie === 'formulierung' ? 'formulierung' : 'inhalt', text: text };
    felieBrueckeBefehl({ kind: wie === 'formulierung' ? 'reword' : 'manualUpdate',
      entryId: eintrag.id, expectedHeadRevisionId: kopf ? kopf.id : null,
      candidate: { text: text, supportSets: [[quelle.id]],
        retention: kopf ? kopf.retention : 'volatileDefault',
        expiresAt: kopf ? kopf.expiresAt : null },
      evidence: [quelle] });
  });
  /* Kein Vorgang, keine Meldung. Bisher meldete auch das unveraenderte
     Speichern "gespeichert" - eine Bestaetigung fuer etwas, das gar nicht
     stattgefunden hat. */
  if (ok && vorgang) felieGedaechtnisEreignis(
    vorgang.wie === 'geloescht' ? 'gedaechtnis_geloescht' : 'gedaechtnis_geaendert', vorgang);
  return ok;
}
export function felieArchivAbleitungenAendern(s, chats, chat, n, text) {
  ['fakten', 'episoden'].forEach(function(k) {
    s[k] = s[k].filter(function(e) {
      if (!felieErinnerungAusChat(e, chat, chats)) return true;
      var gleich = felieNotizSchluessel(e.text) === felieNotizSchluessel(n.text);
      var belegt = !e.bearbeitetAm && felieBelegeGleich(e.belege, n.nachweis && n.nachweis.belege);
      if (!gleich && !belegt) return true;
      if (!text) return false;
      if (gleich && text.length <= 90) {
        e.text = text; e.bearbeitetAm = Date.now(); e.bearbeitetVon = 'selbst';
        if (k === 'fakten') e.bestaetigtAm = Date.now();
        return true;
      }
      // A differently worded derived short claim cannot safely be rewritten
      // without interpretation. Retire it; the corrected archive note remains
      // the single usable source instead of retaining contradictory summaries.
      return false;
    });
  });
}

/* Zustimmungswoerter ohne eigenen Inhalt. Bewusst eine kurze, feste
   Liste statt einer Laengenheuristik: „Ja, wir wohnen zusammen" traegt
   sehr wohl Inhalt und darf nicht hier landen. */
export function felieZustimmungOhneInhalt(text) {
  return /^(ja+|nein|genau|stimmt|richtig|okay|ok|jap|jep|klar|eben|doch|jo|joa|mhm|hm+)[\s.!?,;:]*$/i
    .test(felieNotizText(text));
}

export function felieNotizPruefen(item, source, max) {
  if (!item || typeof item !== 'object') return null;
  var text = felieNotizText(item.text);
  if (!text || text.length > max || /[<>]/.test(text)) return null;
  if (!Array.isArray(item.belege) || !item.belege.length || item.belege.length > 6) return null;
  var belege = [];
  for (var i = 0; i < item.belege.length; i++) {
    var b = item.belege[i];
    if (!b || !Number.isInteger(b.nachricht)) return null;
    var m = source.find(function(s) { return s.id === b.nachricht && s.rolle === 'user'; });
    var zitat = felieNotizText(b.beleg);
    if (!m || !zitat || !felieNotizText(m.text).includes(zitat)) return null;
    /* Eine blosse Zustimmung traegt den Inhalt nicht allein: „Ja" belegt
       gar nichts, solange nicht feststeht, worauf es sich bezieht. Der
       Beleg braucht dann die Frage, auf die er antwortet — und die muss
       tatsaechlich von felie stammen und vor der Antwort liegen (F43). */
    if (felieZustimmungOhneInhalt(zitat)) {
      if (!Number.isInteger(b.frage)) return null;
      var f = source.find(function(x) { return x.id === b.frage; });
      if (!f || f.rolle !== 'assistant' || f.id >= m.id) return null;
    }
    // Das Beleglimit ist unabhängig vom knappen Anzeigetext. Der komplette
    // Nutzerbeitrag bleibt als Kontext erhalten, inklusive Verneinungen.
    if (m.text.length > 12000) return null;
    if (!belege.some(function(e) { return e.nachricht === m.id; })) {
      var eintrag = { nachricht: m.id, beleg: m.text };
      if (Number.isInteger(b.frage)) eintrag.frage = b.frage;
      belege.push(eintrag);
    }
  }
  return { text: text, belege: belege };
}

export function felieNotizenLesen(chat, auchGeloeschte) {
  if (!chat) return [];
  var liste = Array.isArray(chat.notizen) ? chat.notizen : ['erkenntnis', 'felie_lernt'].map(function(k) {
    return { id: k, feld: k, thema: k === 'erkenntnis' ? 'Aus unserem Gespräch' : 'felie merkt sich',
      text: chat[k] || '', merken: k === 'felie_lernt', nachweis: chat.feldQuelle && chat.feldQuelle[k] };
  });
  return liste.filter(function(n) { return n && typeof n.text === 'string' && (auchGeloeschte || n.text.trim()); });
}

/* felieNotizSchluessel: seit D1a in src/kern/text.js */

export function felieNotizVorschau(summary) {
  var liste = felieNotizenLesen(summary);
  summary.erkenntnis = liste.length ? liste[0].text : '';
  var merken = liste.filter(function(n) { return n.merken !== false; });
  summary.felie_lernt = merken.length ? merken[0].text : '';
  summary.feldQuelle = { erkenntnis: liste.length ? liste[0].nachweis : null,
    felie_lernt: merken.length ? merken[0].nachweis : null };
}

export function felieChatNotizSetzen(id, notizId, text) {
  if (typeof text !== 'string' || typeof notizId !== 'string') return false;
  var neu = felieNotizText(text).slice(0, 240);
  var ok = felieVorgangPort()(function(s, chats) {
    var chat = chats.find(function(c) { return (c.id || c.timestamp) === id; });
    var n = felieNotizenLesen(chat, true).find(function(x) { return x.id === notizId; });
    if (!chat || !n) throw felieStandFehler('Notiz fehlt');
    felieArchivVerlaufSperren(chat, n.nachweis && n.nachweis.belege);
    felieArchivAbleitungenAendern(s, chats, chat, n, neu);
    if (!n.ursprungstext) n.ursprungstext = n.text;
    n.text = neu; n.nachweis = { quelle: 'selbst', bearbeitetAm: Date.now() };
    if (n.feld) { chat[n.feld] = neu; chat.feldQuelle = chat.feldQuelle || {}; chat.feldQuelle[n.feld] = n.nachweis; }
    chat.kontextAuslassen = (chat.kontextAuslassen || []).filter(function(k) { return k !== notizId; });
    chat.begruessungAuslassen = (chat.begruessungAuslassen || []).filter(function(k) { return k !== notizId; });
    felieNotizVorschau(chat);
  });
  if (ok) felieGedaechtnisEreignis(neu ? 'gedaechtnis_geaendert' : 'gedaechtnis_geloescht',
    { was: 'notiz', wie: neu ? 'inhalt' : 'geloescht', text: neu });
  return ok;
}

/* ── Abgleich mit dem, was schon gemerkt ist ──────────────────────────
   Der Fall aus der Praxis: das Kennenlernen legt "Koerperlicher /
   hormoneller Kontext (Selbstauskunft): Schwangerschaft." ab, ein
   spaeteres Gespraech streift das Thema, und die Extraktion schlaegt
   "Schwanger" vor. Beide Texte sind verschieden, also greift weder der
   Schluesselvergleich in felieFaktSetzen noch irgendeine andere Huerde —
   es entstehen zwei Eintraege fuer dieselbe Angabe.
     Das ist kein Sonderfall der Schwangerschaft, sondern gilt fuer jeden
   Fakt, dessen Formulierung sich zwischen zwei Quellen unterscheidet.

   Regel: ein Vorschlag gilt als inhaltsgleich, wenn JEDES seiner
   Inhaltswoerter in einem vorhandenen Eintrag steckt. Er bringt dann
   nichts Neues. Sobald ein Wort fehlt ("Vollzeit seit Januar" gegen
   "Arbeit und Alltag: Vollzeit."), bleibt er ein eigener Vorschlag.
   Verneinungen trennen: "keine Kinder" und "Kinder" sind nie dasselbe. */
export const FELIE_MERK_STOPP = ['aber','auch','beim','dabei','damit','dann','dass','dein','deine','denn','dies','diese','durch','eine','einem','einen','einer','eines','etwa','fuer','ganz','gegen','ihre','ihrem','ihren','ihrer','immer','jetzt','mehr','nach','noch','oder','schon','sehr','sein','seine','sich','sind','ueber','viel','vom','wenn','werden','wieder','wird','wurde','zwischen'];
export const FELIE_MERK_VERNEINUNG = /(^|[^a-zäöü])(kein|keine|keinen|keiner|keines|nicht|nichts|nie|niemand|ohne|weder)([^a-zäöü]|$)/i;

export function felieMerkWorte(text) {
  return String(text || '').toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
    .filter(function(w) { return w.length >= 4 && FELIE_MERK_STOPP.indexOf(w) < 0; });
}

/* Wortvergleich mit Praefix: "schwanger" steckt in "schwangerschaft",
   "kind" in "kinder". Absichtlich keine Stammformenerkennung — die waere
   raterei und wuerde still falsch zusammenlegen. */
export function felieMerkWortDrin(wort, liste) {
  return liste.some(function(w) { return w === wort || w.indexOf(wort) === 0 || wort.indexOf(w) === 0; });
}

/* Liefert den vorhandenen Text, wenn der Vorschlag nichts Neues bringt,
   sonst null. */
export function felieMerkBekannt(text, bestand) {
  var neu = felieMerkWorte(text);
  if (!neu.length) return null;
  var verneintNeu = FELIE_MERK_VERNEINUNG.test(String(text));
  for (var i = 0; i < bestand.length; i++) {
    var alt = bestand[i];
    if (!alt) continue;
    if (FELIE_MERK_VERNEINUNG.test(String(alt)) !== verneintNeu) continue;
    var altWorte = felieMerkWorte(alt);
    if (!altWorte.length) continue;
    if (neu.every(function(w) { return felieMerkWortDrin(w, altWorte); })) return alt;
  }
  return null;
}

export function felieMerkBestand() {
  var b = { fakten: [], faeden: [] };
  try {
    b.fakten = felieFakten().map(function(f) { return f.text; });
    b.faeden = felieEpisoden({ nurAktuell: true }).map(function(e) { return e.text; });
  } catch (e) {}
  return b;
}

/* Vorschlaege aus der Modellantwort saeubern. Alles, was nicht der Form
   entspricht, fliegt raus statt halbfertig durchzurutschen. */
export function felieMerkVorschlaege(summary) {
  var out = { fakten: [], faeden: [] };
  if (!summary) return out;
  var kat = ['familie', 'arbeit', 'gesundheit', 'beziehung', 'wohnen', 'allgemein'];
  var bestand = felieMerkBestand();

  /* Zwei Stufen mit Absicht. Wortgleich heisst: felieFaktSetzen wuerde
     den Eintrag ohnehin nur ueberschreiben — der Vorschlag verschwindet
     still. Nur inhaltsgleich heisst: die Zuordnung ist eine Einschaetzung,
     und die gehoert ihr vorgelegt statt heimlich getroffen. Die Zeile
     erscheint dann abgewaehlt, ein Tipp holt sie zurueck. */
  function pruefen(text, liste) {
    var schluessel = felieNotizSchluessel(text);
    if (liste.some(function(t) { return felieNotizSchluessel(t) === schluessel; })) return 'gleich';
    return felieMerkBekannt(text, liste) ? 'bekannt' : null;
  }

  (Array.isArray(summary.fakten) ? summary.fakten : []).forEach(function (f) {
    if (!f || f.belegt !== true || typeof f.text !== 'string') return;
    var text = f.text.trim();
    if (!text || text.length > 90) return;
    /* Traegt der Vorschlag einen belegten Bezug auf einen vorhandenen
       Eintrag, entscheidet dieser Bezug — nicht mehr der Textvergleich.
       Eine Bestaetigung wiederholt die Angabe absichtlich woertlich und
       darf nicht als Dublette wegfallen. */
    if (f.bezug && f.bezug !== 'neu') {
      out.fakten.push({ text: text, belege: f.belege || [],
        kategorie: kat.indexOf(f.kategorie) >= 0 ? f.kategorie : 'allgemein',
        klasse: f.klasse === 'stabil' ? 'stabil' : 'volatil',
        bezug: f.bezug, zielId: f.zielId, ausgangsRevision: f.ausgangsRevision,
        zeitbezug: f.zeitbezug || null,
        bekannt: false, klaerung: f.bezug === 'widerspruch' });
      return;
    }
    var stand = pruefen(text, bestand.fakten);
    if (stand === 'gleich') return;
    out.fakten.push({
      text: text,
      belege: f.belege || [],
      kategorie: kat.indexOf(f.kategorie) >= 0 ? f.kategorie : 'allgemein',
      klasse: f.klasse === 'stabil' ? 'stabil' : 'volatil',
      bezug: 'neu',
      bekannt: stand === 'bekannt'
    });
  });

  (Array.isArray(summary.faeden) ? summary.faeden : []).forEach(function (e) {
    if (!e || e.belegt !== true || typeof e.text !== 'string') return;
    var text = e.text.trim();
    if (!text || text.length > 90) return;
    var tage = parseInt(e.tage, 10);
    if (!(tage > 0) || tage > 120) tage = 21;
    if (e.bezug && e.bezug !== 'neu') {
      out.faeden.push({ text: text, tage: tage, belege: e.belege || [],
        bezug: e.bezug, zielId: e.zielId, ausgangsRevision: e.ausgangsRevision,
        zeitbezug: e.zeitbezug || null,
        bekannt: false, klaerung: e.bezug === 'widerspruch' });
      return;
    }
    var stand = pruefen(text, bestand.faeden);
    if (stand === 'gleich') return;
    out.faeden.push({ text: text, tage: tage, belege: e.belege || [],
      bezug: 'neu', bekannt: stand === 'bekannt' });
  });

  return out;
}

/* Obergrenzen. 90 fuer Merkzeilen ist kein Zufall, sondern derselbe Wert,
   den felieMerkVorschlaege() beim Einlesen der Modellantwort durchlaesst —
   ein per Hand laengerer Eintrag wuerde sonst spaeter verworfen. */
export const FELIE_SNIP_MAX = {
  thema: 60, erkenntnis: 240, felie_lernt: 240, merk: 90,
  /* Im Gedaechtnis bearbeitete Eintraege: dieselben Grenzen wie beim
     Erfassen, damit eine Korrektur nicht laenger sein darf als das
     Original je haette werden koennen. */
  fakt: 90, faden: 90, chatlernt: 240
};

/* Einzelne Felder eines archivierten Gespraechs nachtraeglich aendern.
   Bewusst ein Patch und kein Ueberschreiben des ganzen Datensatzes: der
   Verlauf, der Koerper-Schnappschuss und der Zeitstempel bleiben so
   unberuehrt, auch wenn spaeter Felder hinzukommen. */
export function felieChatFeldSetzen(id, patch) {
  if (id == null || !patch) return false;
  var keys = ['thema','erkenntnis','felie_lernt'].filter(function(k) { return typeof patch[k] === 'string'; });
  if (!keys.length) return false;
  if (keys.length === 1 && keys[0] !== 'thema') return felieChatNotizSetzen(id, keys[0], patch[keys[0]]);
  return felieVorgangPort()(function(s, chats) {
    var c = chats.find(function(x) { return (x.id || x.timestamp) === id; });
    if (!c) throw felieStandFehler('Gespräch fehlt');
    keys.forEach(function(k) {
      var neu = felieNotizText(patch[k]).slice(0, FELIE_SNIP_MAX[k] || 240);
      if (k !== 'thema') {
        var n = felieNotizenLesen(c, true).find(function(n) { return n.id === k || n.feld === k; });
        if (n) felieArchivAbleitungenAendern(s, chats, c, n, neu);
      }
      c[k] = neu; c.feldQuelle = c.feldQuelle || {};
      c.feldQuelle[k] = { quelle:'selbst', bearbeitetAm:Date.now() };
    });
  });
}


/* Schreibt die Vorschlaege ins Gedaechtnis und liefert die Kennungen der
   geschriebenen Eintraege zurueck.
     Frueher las diese Funktion die Haken aus der Notizkarte — die gibt es
   nicht mehr. Uebernommen wird jetzt alles, was der Dublettenabgleich
   NICHT als schon bekannt erkannt hat; genau dafuer war die Pruefung
   gebaut. Ein bekannter Eintrag wuerde ohnehin nur den vorhandenen
   ueberschreiben und dabei als "neu" markiert im Gedaechtnis aufleuchten,
   obwohl sich nichts geaendert hat. */
export function felieMerkUebernehmen(v) {
  return felieMerkUebernehmenFuer(felieGedaechtnisLetzterChat(), v).ids;
}

/* Wie felieMerkUebernehmen, aber fuer ein benanntes Gespraech und mit
   ehrlichem Ergebnis: ok=false heisst, die Uebernahme ist gescheitert und
   muss wiederholt werden. Der Abschlussauftrag (A2) haengt daran; die
   alte Form gab in beiden Faellen [] zurueck und verschluckte den Fehler. */
export function felieMerkUebernehmenFuer(cid, v) {
  if (!v) return { ok: true, ids: [] };
  var ids = [];
  var ok = felieVorgangPort()(function(store, chats) {
    if (!chats.some(function(c) { return (c.id || c.timestamp) === cid; })) throw new Error('Gespräch nicht gespeichert');
    (v.fakten || []).forEach(function(f) {
      if (!f || f.bekannt) return;
      var id = felieBrueckeVorschlag('personal', { text:f.text, kategorie:f.kategorie,
        klasse:f.klasse, quelle:'gespraech', belege:f.belege || [],
        bezug:f.bezug, zielId:f.zielId }, cid);
      if (id) ids.push(id);
    });
    (v.faeden || []).forEach(function(e) {
      if (!e || e.bekannt) return;
      var id = felieBrueckeVorschlag('topic', { text:e.text, quelle:'gespraech',
        faelligBis:Date.now() + (e.tage || 7) * 86400000, belege:e.belege || [],
        bezug:e.bezug, zielId:e.zielId }, cid);
      if (id) ids.push(id);
    });
  });
  return { ok: !!ok, ids: ok ? ids : [] };
}
