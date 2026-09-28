/* Kennenlernen: Ablauf und Aufnahme (F5a, 28.09.2026).

   Bis F5 stand das Kennenlernen - welcher Schritt als naechster kommt,
   was eine Auswahl erlaubt, was aus den Antworten gespeichert wird - in
   index.html, neben seiner Anzeige. Hier steht jetzt alles davon, was
   ohne Bildschirm auskommt; Webapp und App zeigen es nur noch an
   (F5-1 A, "Kern zuerst, dann nativ").

   Woertlich uebernommen: die Funktionen tragen ihre Namen aus index.html
   (klV2Schritte, klV2Antwort, klV2FadenText, KL_PLAENE ...), ihre Texte
   und Kommentare. Neu sind nur die Teile, die frueher mit der Anzeige
   verflochten waren (felieKl...): sie aendern den Zustand und melden,
   was die Anzeige danach tun muss, statt selbst zu zeichnen. Den
   Datensatz ganzer Durchlaeufe haelt tests/felie-f5-kl-gate.test.cjs,
   die Wortlaute tests/felie-f5-kl-ablauf.test.cjs - beide vor dem Umzug
   gegen die Webapp geschrieben.

   Zustand: der Stand des Kennenlernens (frueher window._klState) liegt
   hier; die Webapp sieht ihn weiter unter window._klState (Bruecke). Der
   aktuelle Schritt kommt ausdruecklich als Argument (key), damit die
   Anzeige ihren eigenen Schrittzeiger behalten kann.

   Ports (felieKlVerbinden):
     profilSetzen(patch)  Name und Alter ins Profil ({ userName } bzw.
                          { alter: { exakt, am } | null })
     profilSichern()      das Profil dauerhaft schreiben -> true/false
     entwurfSichern()     den Stand dauerhaft schreiben -> true/false
                          (fehlt er: felie_onboarding_v1 ueber den Speicher-Port)
     verlauf(liste)       der Verlauf, der ins Archiv geht (die Webapp
                          spiegelt ihn in klHistory)
   Ohne profilSetzen/profilSichern bricht das Kennenlernen laut ab - ein
   still verlorener Name waere schlimmer. */

import { felieSpeicherSchreiben } from './speicher.js';
import { felieStore, felieStoreSpeichern, felieStoreSetzen } from './store.js';
import { felieFaktSetzen, felieEpisode } from './gedaechtnis.js';
import { felieSchreibeSignal } from './signale.js';
import { FELIE_FRAGEN } from './selbstauskunft.js';
import { klV2ZyklusVoreinstellen } from './koerper.js';
import { getSavedChats } from './gespraeche.js';
import { felieNeueSnippetsSetzen } from './neu-hinweise.js';
import { felieSichererVerlauf } from './archiv.js';
import { klV2Definition, KL_SCHRITTE_ENDE } from './kennenlernen.js';

var klStand = null;
var klPort = null;

export function felieKlVerbinden(port) { klPort = port || null; }

/* Der Stand, wie er ist (null vor dem ersten Schritt) - fuer die Sicht
   window._klState. klZustand() legt ihn an, wenn er fehlt. */
export function felieKlStand() { return klStand; }
export function felieKlStandSetzen(s) { klStand = s || null; }
export function felieKlZuruecksetzen() { klStand = null; klPort = null; }

function profilPort() {
  if (!klPort || typeof klPort.profilSetzen !== 'function' || typeof klPort.profilSichern !== 'function')
    throw new Error('Kennenlernen: Profil-Port nicht verbunden (felieKlVerbinden)');
  return klPort;
}

function entwurfSichern() {
  if (klPort && typeof klPort.entwurfSichern === 'function') return klPort.entwurfSichern();
  try { felieSpeicherSchreiben('felie_onboarding_v1', JSON.stringify(klZustand())); return true; }
  catch (e) { return false; }
}

export function klZustand() {
  if (!klStand) klStand = { version: 1, id: 'kl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9),
    stage: 'aufnahme', extraction: 'offen', archiveId: null, input: '', step: 0 };
  return klStand;
}

/* Sie tippt gelegentlich einen ganzen Satz ("Ich bin Lena"). Ein
   Modellaufruf nur zum Namensziehen waere Aufwand fuer nichts — ein
   paar Hoeflichkeitsfloskeln vorne abzuschneiden reicht. Bleibt etwas
   Ungewoehnliches uebrig, wird es uebernommen: es ist ihr Name, nicht
   unserer. */
export function klNameSetzen(text) {
  var t = text.replace(/\s+/g, ' ').trim();
  t = t.replace(/^(hallo|hi|hey|guten tag|moin)[,!.\s]+/i, '');
  var prefix = /^(ich (?:bin|heisse|heiße)|mein name ist|nenn mich|man nennt mich)\s+/i;
  var mitPrefix = prefix.test(t);
  t = t.replace(prefix, '');
  if (mitPrefix) t = t.split(/[,;.!?]|\s+(?:und|aber|weil|ich)\s+/i)[0].trim();
  t = t.replace(/[.!]+$/, '').trim();
  if (!t || t.length > 30 || t.split(' ').length > 3 || !/^[\p{L}\p{M}][\p{L}\p{M}'’ .-]*$/u.test(t) ||
      /\b(ich|möchte|moechte|will|nicht|kein|keine|namen|heißen|heissen|brauche|hilfe|müde|muede|erschöpft|traurig|überfordert|jahre|alt|anonym|unsicher|gestresst)\b/i.test(t)) return '';
  return t;
}

export function klNameAblehnung(text) {
  return /^(?:nein|überspringen|ueberspringen|anonym|ohne namen|keine angabe)[.!\s]*$/i.test(text.trim()) ||
    /(?:namen?|nennen|anonym)/i.test(text) && /(?:nicht|lieber nicht|kein|ohne|anonym)/i.test(text);
}

export function klV2Form(key) {
  var s = klZustand(); s.form = s.form || {}; s.committed = s.committed || {};
  if (!s.form[key]) s.form[key] = { selected: [], text: '' };
  return s.form[key];
}

export function klV2Hat(key, value) {
  var f = (klZustand().committed || {})[key];
  return !!(f && !f.skipped && (f.selected || []).indexOf(value) >= 0);
}

export function klV2KinderGenannt() {
  /* Eine ausdrueckliche Verneinung schlaegt jeden Texthinweis. Ohne diese
     Zeile koennte ein Freitext unter "anderes" den Kinderschritt trotz
     angetippter Gegenangabe ausloesen. */
  if (klV2Hat('leben', 'keine Kinder')) return false;
  if (klV2Hat('leben', 'Kinder')) return true;
  var f = (klZustand().committed || {}).leben, t = f && !f.skipped ? f.text || '' : '';
  return !/keine? Kinder/i.test(t) && /(?:mein(?:e|en)?|unser(?:e|en)?) (?:Kinder|Sohn|Tochter)|(?:ich habe|wir haben) (?:ein|zwei|drei|vier|fünf|\d+) (?:Kinder|Kind|Sohn|Tochter)/i.test(t);
}

export function klV2Schritte() {
  var keys = ['name', 'alter', 'leben'];
  if (klV2KinderGenannt()) keys.push('kinder');
  keys.push('themen', 'gefuehl', 'ziel', 'koerper');
  if (klV2Hat('koerper', 'natürlicher Zyklus')) keys.push('zyklus');
  var k = (klZustand().committed || {}).koerper;
  if (k && !k.skipped && (k.text || '').trim()) keys.push('beschwerden');
  /* Die vier festen Schluss-Schritte: seit AL-73 KL_SCHRITTE_ENDE im Kern. */
  return keys.concat(KL_SCHRITTE_ENDE);
}

export function klV2Validieren(key, f) {
  if (key === 'name' && (!klNameSetzen(f.text || '') || klNameAblehnung(f.text || ''))) return 'Bitte trage deinen Vornamen ein, oder wähle „Überspringen“.';
  if (key === 'alter' && !/^(?:1[89]|[2-9]\d|1[01]\d|120)$/.test(String(f.age || ''))) return 'Bitte gib dein Alter als ganze Zahl zwischen 18 und 120 ein.';
  if (key === 'kinder' && f.amount && !/^(?:[1-9]|[12]\d|30)$/.test(f.amount)) return 'Bitte gib die Anzahl als ganze Zahl zwischen 1 und 30 ein.';
  if (key === 'schlafroutine' && !f.irregular && [f.bed, f.wake].some(function(t) { return t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t); })) return 'Bitte prüfe die Uhrzeit.';
  var d = klV2Definition(key);
  if (d.options && !(f.selected || []).length && !(key === 'themen' && (f.text || '').trim())) return 'Wähle eine Antwort oder überspringe diesen Schritt.';
  if (key === 'themen' && f.selected.length === 1 && f.selected[0] === 'Etwas anderes' && !(f.text || '').trim()) return 'Erzähl kurz, was dich beschäftigt, oder überspringe diesen Schritt.';
  return '';
}

/* ── Bedienung: aendert den Stand, zeichnet nicht ─────────────────── */

export function felieKlStarten() {
  var s = klZustand(); s.flow = 2; s.form = s.form || {}; s.committed = s.committed || {};
  s.stage = 'aufnahme'; s.phase = 'name';
  return s;
}

/* Eingabefeld eines Schritts. false: nicht angenommen (anderer Ablauf,
   unbekanntes Feld). */
export function felieKlEingabe(key, field, value) {
  if (klZustand().flow !== 2) return false;
  if (['text', 'age', 'amount', 'ages', 'bed', 'wake'].indexOf(field) < 0) return false;
  klV2Form(key)[field] = String(value).slice(0, field === 'text' ? 2000 : 200);
  klZustand().formError = '';
  return true;
}

/* Antippen einer Option. Ergebnis: null (keine Option), 'fehler' (die
   Hoechstzahl ist erreicht, formError gesetzt) oder 'gewaehlt'. */
export function felieKlWaehlen(key, index) {
  var def = klV2Definition(key), f = klV2Form(key), value = def.options && def.options[index];
  if (!value) return null;
  var selected = f.selected.slice(), pos = selected.indexOf(value);
  var exklusiv = ['schwer zu sagen', 'weiß ich noch nicht', 'nichts davon', 'später'];
  if (pos >= 0) selected.splice(pos, 1);
  else if (!def.multi || exklusiv.indexOf(value) >= 0) selected = [value];
  else {
    selected = selected.filter(function(v) { return exklusiv.indexOf(v) < 0; });
    // Vor der Hoechstzahl, damit die abgewaehlte Gegenoption ihren Platz freigibt.
    (def.entweder || []).forEach(function(paar) {
      var i = paar.indexOf(value);
      if (i < 0) return;
      selected = selected.filter(function(v) { return v !== paar[1 - i]; });
    });
    if (def.max && selected.length >= def.max) { klZustand().formError = 'Wähle höchstens ' + def.max + ' Antworten aus.'; return 'fehler'; }
    selected.push(value);
  }
  f.selected = selected;
  if ((key === 'leben' && selected.indexOf('anderes') < 0) || (key === 'koerper' && selected.indexOf('bekannte körperliche Themen') < 0)) f.text = '';
  klZustand().formError = '';
  return 'gewaehlt';
}

export function felieKlUnregelmaessig() {
  var f = klV2Form('schlafroutine'); f.irregular = !f.irregular;
  if (f.irregular) { f.bed = ''; f.wake = ''; }
}

/* Weiter (oder Ueberspringen) im Schritt key. Ergebnis: { fehler } mit
   gesetztem formError, oder { naechster }. Name und Alter gehen ueber den
   Profil-Port. Den Abschluss (key 'zusammenfassung') fuehrt
   felieKlLanden/felieKlSichern, nicht diese Funktion. */
export function felieKlWeiter(key, skip) {
  var s = klZustand(), f = klV2Form(key), error = skip ? '' : klV2Validieren(key, f);
  if (error) { s.formError = error; return { fehler: error }; }
  var a = skip ? { skipped: true, selected: [], text: '', ts: Date.now() } : JSON.parse(JSON.stringify(f));
  a.ts = Date.now(); s.committed[key] = a; s.formError = '';
  /* Jede geaenderte Angabe kann die Angebote am Ende verschieben. Eine
     Wahl stehen zu lassen, die sich auf ein Angebot bezieht, das es nicht
     mehr gibt, waere schlimmer als sie noch einmal treffen zu lassen. */
  delete s.einstieg;
  if (key === 'name') { var name = skip ? '' : klNameSetzen(f.text); profilPort().profilSetzen({ userName: name }); if (!skip) { a.text = name; f.text = name; } }
  if (key === 'alter') profilPort().profilSetzen({ alter: skip ? null : { exakt: Number(f.age), am: a.ts } });
  if (key === 'leben') {
    if (!klV2KinderGenannt()) { delete s.committed.kinder; delete s.form.kinder; }
    var body = klV2Form('koerper');
    if (klV2Hat('leben', 'schwanger') && body.selected.indexOf('Schwangerschaft') < 0) { body.selected = body.selected.filter(function(v) { return ['nichts davon', 'später'].indexOf(v) < 0; }); body.selected.push('Schwangerschaft'); delete s.committed.koerper; s.pregnancyPrefill = true; }
    else if (!klV2Hat('leben', 'schwanger') && s.pregnancyPrefill) { body.selected = body.selected.filter(function(v) { return v !== 'Schwangerschaft'; }); delete s.committed.koerper; s.pregnancyPrefill = false; }
  }
  if (key === 'koerper') {
    // An explicit correction to a prefilled choice also updates its earlier source.
    if (!skip && klV2Hat('leben', 'schwanger') && !klV2Hat('koerper', 'Schwangerschaft')) {
      s.committed.leben.selected = s.committed.leben.selected.filter(function(v) { return v !== 'schwanger'; });
      klV2Form('leben').selected = klV2Form('leben').selected.filter(function(v) { return v !== 'schwanger'; });
      s.pregnancyPrefill = false;
    }
    if (!klV2Hat('koerper', 'natürlicher Zyklus')) { delete s.committed.zyklus; delete s.form.zyklus; }
    if (!a.text) { delete s.committed.beschwerden; delete s.form.beschwerden; }
  }
  var keys = klV2Schritte(), next = keys[keys.indexOf(key) + 1];
  if (s.editing) { next = keys.find(function(k) { return k !== 'zusammenfassung' && !s.committed[k]; }) || 'zusammenfassung'; s.editing = next !== 'zusammenfassung'; }
  s.phase = next || 'zusammenfassung';
  return { naechster: s.phase };
}

/* Der Schritt vor key, oder null: dann geht es zurueck vor das Kennenlernen. */
export function felieKlZurueck(key) {
  var keys = klV2Schritte(), i = keys.indexOf(key);
  if (i <= 0) return null;
  klZustand().formError = ''; klZustand().phase = keys[i - 1];
  return keys[i - 1];
}

export function felieKlBearbeiten(key) {
  if (klV2Schritte().indexOf(key) < 0) return false;
  klZustand().editing = true; klZustand().phase = key;
  return true;
}

export function klV2Antwort(key, a) {
  if (!a || a.skipped) return 'Das möchte ich auslassen.';
  if (key === 'name') return a.text;
  if (key === 'alter') return 'Ich bin ' + a.age + ' Jahre alt.';
  if (key === 'kinder') return [a.amount ? 'Anzahl: ' + a.amount : '', a.ages ? 'Alter: ' + a.ages : ''].filter(Boolean).join('. ') || 'Keine weiteren Angaben zu meinen Kindern.';
  if (key === 'schlafroutine') return a.irregular ? 'Ich habe keinen festen Schlafrhythmus.' : [a.bed ? 'Meist gehe ich gegen ' + a.bed + ' Uhr ins Bett.' : '', a.wake ? 'Meist stehe ich gegen ' + a.wake + ' Uhr auf.' : ''].filter(Boolean).join(' ') || 'Keine Angaben zu meiner Schlafroutine.';
  var prefix = { leben: 'Meine Lebenssituation: ', themen: 'Mich beschäftigt: ', gefuehl: 'Damit fühle ich mich: ', ziel: 'Ich möchte besser verstehen: ', koerper: 'Körperliche oder hormonelle Themen: ', zyklus: 'Meine ungefähre Zykluseinschätzung: ', schlafqualitaet: 'Meine letzte Nacht: ', beschwerden: 'Zeitraum meines körperlichen Themas: ' };
  return (prefix[key] || '') + (a.selected || []).join(', ') + (a.text ? ((a.selected || []).length ? '. ' : '') + a.text : '');
}

/* EIN Verlauf, kein zweiter: aus ihm entstehen Anzeige, Archiveintrag und
   Belege (index.html, Kopf des Kennenlernens). fertig: der Abschluss ist
   erreicht - dann gehoeren Zusammenfassung, Angebote und ihre Wahl dazu. */
export function felieKlVerlauf(fertig) {
  var s = klZustand(), verlauf = [];
  klV2Schritte().forEach(function(k) {
    var a = s.committed[k]; if (!a) return;
    verlauf.push({ role: 'assistant', content: klV2Definition(k).title, onboardingFeld: k });
    var m = { role: 'user', content: klV2Antwort(k, a), onboardingFeld: k };
    if (k === 'name' || k === 'alter') m.profilFeld = k;
    verlauf.push(m);
  });
  /* Der Verlauf soll zeigen, was sie gesehen und gewaehlt hat — sonst
     steht im Archiv ein Vorschlag, den sie moeglicherweise abgelehnt hat,
     und felie greift ihn spaeter als vereinbart auf. */
  if (fertig) {
    var angebote = klV2Einstiege();
    verlauf.push({ role: 'assistant', content: klV2Zusammenfassung() + '\n\n' + angebote.map(function(e) { return e.text; }).join('\n') });
    var wahl = angebote.find(function(e) { return e.key === s.einstieg; });
    if (wahl) verlauf.push({ role: 'user', content: wahl.key === 'anderes'
      ? 'Ich möchte mit einem anderen Thema starten.'
      : 'Ja, lass uns so anfangen.' });
  }
  return verlauf;
}

export function klV2Zusammenfassung() {
  var a = klZustand().committed || {}, parts = [];
  if (a.themen && !a.themen.skipped) {
    var topics = a.themen.selected.filter(function(t) { return t !== 'Etwas anderes'; });
    /* K-1 bis K-3 (Marcel, 28.09.): Aufzaehlung statt "und ... und", ein
       Punkt nach dem Zitat, wenn es nicht selbst mit einem Satzzeichen endet. */
    if (topics.length) parts.push('Gerade geht es dir vor allem um ' + klV2SatzListe(topics) + '.');
    if (a.themen.text) {
      var zitat = a.themen.text.length > 240 ? a.themen.text.slice(0, 240) + '…' : a.themen.text;
      parts.push('Du hast mir mitgegeben: „' + zitat + '“' + (/[.!?…]$/.test(zitat) ? '' : '.'));
    }
  }
  if (a.gefuehl && !a.gefuehl.skipped && a.gefuehl.selected.indexOf('schwer zu sagen') < 0) parts.push('Damit fühlst du dich ' + klV2SatzListe(a.gefuehl.selected) + '.');
  var goal = a.ziel && !a.ziel.skipped && a.ziel.selected.filter(function(t) { return t !== 'weiß ich noch nicht'; });
  var goals = {
    'warum ich mich so fühle': 'verstehen, warum du dich so fühlst',
    'was mich beeinflusst': 'verstehen, was dich beeinflusst',
    'was mir guttut': 'herausfinden, was dir guttut',
    'meinen Körper besser verstehen': 'deinen Körper besser verstehen',
    'meine Stimmung besser einordnen': 'deine Stimmung besser einordnen',
    'Zusammenhänge erkennen': 'Zusammenhänge erkennen',
    'Veränderungen bei mir verstehen': 'Veränderungen bei dir verstehen',
    'wissen, worauf ich achten kann': 'wissen, worauf du im Alltag achten kannst'
  };
  if (goal && goal.length) parts.push('Du möchtest ' + klV2SatzListe(goal.map(function(g) { return goals[g] || g; })) + '.');
  /* Ohne Dank: der Abschlusstext bedankt sich bereits eine Zeile vorher,
     seit die Zusammenfassung in felies Blase eingebettet ist. Standalone
     im Archiv traegt der Satz trotzdem. */
  return parts.length ? parts.join(' ') : 'Was dir gerade wichtig ist, finden wir gemeinsam heraus.';
}

/* Kurzform des Themas fuer die Alternativzeile. Die Plaene unten sind
   ganze Nebensaetze ("wir schauen zuerst auf deinen Abend und…") und
   passen grammatisch nicht hinter "beginnen mit". */
export const KL_THEMA_DATIV = Object.freeze({
  Schlaf: 'deinem Schlaf', Stress: 'dem, was dich gerade stresst', Energie: 'deiner Energie',
  Stimmung: 'deiner Stimmung', 'Körper': 'deinem Körper', Zyklus: 'deinem Zyklus',
  'Ernährung': 'deiner Ernährung', Bewegung: 'Bewegung', 'Mental Load': 'deinem Mental Load',
  Familie: 'dem Thema Familie', Arbeit: 'dem Thema Arbeit'
});

export const KL_PLAENE = Object.freeze({
  Schlaf: 'wir schauen zuerst auf deinen Abend und überlegen, was dir das Zur-Ruhe-Kommen erleichtern könnte',
  Stress: 'wir sortieren zuerst, was dich im Alltag beansprucht, und suchen eine konkrete Möglichkeit zur Entlastung',
  Energie: 'wir schauen zuerst auf deinen Tagesablauf und suchen eine Stelle, an der du dir etwas Druck nehmen kannst',
  Stimmung: 'wir nehmen eine konkrete Situation aus deinem Alltag und schauen gemeinsam, wie sie sich für dich anfühlt',
  'Körper': 'wir beginnen mit dem, was du an deinem Körper wahrnimmst und was du dazu besser verstehen möchtest',
  Zyklus: 'wir schauen zuerst auf deine eigenen Beobachtungen im Alltag und was du dabei besser verstehen möchtest',
  'Ernährung': 'wir schauen zuerst, welche einfachen Mahlzeiten zu deinem Alltag und deinen Vorlieben passen',
  Bewegung: 'wir suchen zuerst eine Form von Bewegung, die du magst und die in deinen Alltag passt',
  'Mental Load': 'wir sortieren zuerst, was du alles im Kopf behältst, und suchen eine Aufgabe, bei der Entlastung möglich ist',
  Familie: 'wir beginnen mit einer konkreten Familiensituation, bei der du dir Unterstützung wünschst',
  Arbeit: 'wir schauen zuerst auf eine konkrete Situation bei der Arbeit, die dich gerade beschäftigt'
});

/* Was sie mir konkret schreiben kann. Der Plan sagt, WORAN wir
   arbeiten; diese Zeile sagt, WOMIT sie anfaengt. Ohne sie endete die
   erste Startseite mit „hier direkt weitersprechen" — eine Einladung
   ohne Ziel, und das beim allerersten Besuch (Befund 17.09.).
   Jede Zeile ist die Fortsetzung von „Du kannst mir auch direkt
   schreiben, ..." und steht deshalb im Nebensatz. */
export const KL_EINSTIEGSFRAGEN = Object.freeze({
  Schlaf: 'wie deine Abende gerade aussehen',
  Stress: 'was dich im Moment am meisten beansprucht',
  Energie: 'an welcher Stelle deines Tages dir am meisten Energie fehlt',
  Stimmung: 'welche Situation dir zuletzt besonders nachgegangen ist',
  'Körper': 'was du an deinem Körper konkret wahrnimmst',
  Zyklus: 'was dir in den letzten Wochen an dir aufgefallen ist',
  'Ernährung': 'wie deine Mahlzeiten im Alltag gerade aussehen',
  Bewegung: 'wie viel Bewegung gerade in deinen Alltag passt',
  'Mental Load': 'welche Aufgabe dir gerade am meisten im Kopf herumgeht',
  Familie: 'welche Situation in deiner Familie dich gerade beschäftigt',
  Arbeit: 'welche Situation bei der Arbeit dich gerade beschäftigt'
});

export const KL_EINSTIEGSFRAGE_OFFEN = 'was dir gerade am meisten durch den Kopf geht';

export const KL_PLAN_OFFEN = 'wir sortieren zunächst gemeinsam, was gerade Raum in deinem Alltag einnimmt, und wählen einen kleinen nächsten Schritt';

/* EINSTIEGSWAHL AM ENDE DES KENNENLERNENS: bis zu drei gleichwertige
   Angebote - ihre ersten beiden Themen und ein offenes. Der Startknopf
   bleibt gesperrt, bis sie eines angetippt hat (ausfuehrlich im Kommentar
   in index.html bis F5a). */
export function klV2Einstiege() {
  var a = klZustand().committed || {};
  var themen = a.themen && !a.themen.skipped
    ? a.themen.selected.filter(function(v) { return v !== 'Etwas anderes' && KL_PLAENE[v]; }) : [];
  var liste = [];
  themen.slice(0, 2).forEach(function(t, i) {
    if (i === 0) liste.push({ key: 'vorschlag', thema: t, plan: KL_PLAENE[t],
      text: 'Ich schlage vor, ' + KL_PLAENE[t] + '. Passt dieser Einstieg für dich?' });
    else liste.push({ key: 'alternativ', thema: t, plan: KL_PLAENE[t],
      text: 'Alternativ können wir mit ' + (KL_THEMA_DATIV[t] || ('dem Thema ' + t)) + ' beginnen. Ist dir das lieber?' });
  });
  if (!liste.length) liste.push({ key: 'vorschlag', thema: null, plan: KL_PLAN_OFFEN,
    text: 'Ich schlage vor, ' + KL_PLAN_OFFEN + '. Passt dieser Einstieg für dich?' });
  liste.push({ key: 'anderes', thema: null, plan: null,
    text: 'Wir können auch gerne mit einem ganz anderen Thema starten.' });
  return liste;
}

/* Tippen auf ein Angebot; erneutes Tippen hebt auf. false: kein solches Angebot. */
export function felieKlEinstiegWaehlen(key) {
  if (!klV2Einstiege().some(function(e) { return e.key === key; })) return false;
  var s = klZustand();
  s.einstieg = s.einstieg === key ? null : key;
  return true;
}

/* Der Start aus dem Abschluss: ohne Wahl kein Start (formError), mit Wahl
   die Landung - womit die erste Startseite anfaengt. */
export function felieKlLanden() {
  var s = klZustand();
  var wahl = klV2Einstiege().find(function(e) { return e.key === s.einstieg; });
  if (!wahl) { s.formError = 'Wähle bitte aus, womit wir anfangen.'; return false; }
  s.landing = { choice: wahl.key, thema: wahl.thema, plan: wahl.plan, active: true, ts: Date.now() };
  return true;
}

export function klV2StartseitenText() {
  var s = klZustand(), landing = s.landing;
  /* Greift jetzt fuer jeden angenommenen Themenvorschlag, nicht nur fuer
     den erstgenannten. Beim offenen Thema gibt es keinen Plan — dann
     bleibt der neutrale Text unten. */
  if (landing && landing.plan && !s.contextChanged) {
    /* „Diesen Gedanken nehmen wir mit" stand vor dem Plan und sagte
       nichts — der Plan ist der Gedanke. Er steht jetzt als eigener
       Satz. */
    var plan = landing.plan.charAt(0).toUpperCase() + landing.plan.slice(1);
    var frage = (landing.thema && KL_EINSTIEGSFRAGEN[landing.thema]) || KL_EINSTIEGSFRAGE_OFFEN;
    return plan + '.\n\nSchau dich gern erst einmal ein bisschen in der App um. '
      + 'Du kannst mir aber auch direkt schreiben, ' + frage + '.';
  }
  return 'Schau dich gern erst einmal um. Wenn du direkt weitersprechen möchtest: Worüber würdest du gerne mit mir sprechen?';
}

/* ── Aus Auswahlkaesten werden Saetze ────────────────────────────────
   Die Form folgt derselben Regel wie die Extraktion aus Gespraechen
   (felieMerkPromptTeil im Worker): kurze neutrale Saetze ohne Ich- oder
   Du-Anrede. Aus "Partnerschaft, Kinder" wird "Sie lebt in einer
   Partnerschaft und hat Kinder." */
export const KL_SATZ_FAMILIE = Object.freeze({ 'alleinlebend': 'lebt allein', 'Partnerschaft': 'lebt in einer Partnerschaft', 'Kinder': 'hat Kinder', 'keine Kinder': 'hat keine Kinder', 'Kinderwunsch': 'hat einen Kinderwunsch' });
export const KL_SATZ_ARBEIT = Object.freeze({ 'Vollzeit': 'arbeitet Vollzeit', 'Teilzeit': 'arbeitet Teilzeit',
                        'selbstständig': 'ist selbstständig', 'Elternzeit': 'ist in Elternzeit' });

export function klV2Satz(auswahl, karte) {
  var teile = (auswahl || []).map(function(v) { return karte[v] || v; }).filter(Boolean);
  return teile.length ? 'Sie ' + klV2SatzListe(teile) + '.' : '';
}

/* Zahlwoerter bis zwoelf. "2 Kinder" liest sich wie ein Formularfeld,
   "Zwei Kinder" wie ein Satz — und genau das ist der Unterschied zwischen
   einer Datenzeile und etwas, das felie sich gemerkt hat. */
export const KL_ZAHLWORT = Object.freeze(['null','Ein','Zwei','Drei','Vier','Fünf','Sechs','Sieben','Acht','Neun','Zehn','Elf','Zwölf']);

export function klV2Zahlwort(n) {
  return (n >= 0 && n < KL_ZAHLWORT.length) ? KL_ZAHLWORT[n] : String(n);
}

/* Anzahl und Alter der Kinder werden zu ZWEI Eintraegen: einzeln
   aenderbar, zwei Blasen, zwei Stifte. Alter und Freitext seit B-5b
   (Marcel, 28.09.) als knappe Angabe: "Kinder: 4 und 7 Jahre alt.",
   "Zum Alter der Kinder: „…“". */
export function klV2KinderSaetze(k) {
  var raus = [], roh = String(k.amount == null ? '' : k.amount).trim();
  var zahl = /^\d+$/.test(roh) ? parseInt(roh, 10) : null;
  if (zahl != null && zahl > 0) raus.push({ suffix: ':anzahl', text: 'Sie hat ' + klV2Zahlwort(zahl).toLowerCase() + (zahl === 1 ? ' Kind.' : ' Kinder.') });
  else if (zahl === 0) raus.push({ suffix: ':anzahl', text: 'Sie hat keine Kinder.' });
  else if (roh) raus.push({ suffix: ':anzahl', text: klV2ZitatSatz('Zur Anzahl der Kinder', roh) });
  var alter = String(k.ages == null ? '' : k.ages).trim();
  if (alter) {
    var nurZahlen = /^\d+(?:\s*(?:,|und|&)\s*\d+)*$/.test(alter);
    raus.push({ suffix: ':alter', text: nurZahlen
      ? (zahl === 1 ? 'Kind: ' : 'Kinder: ') + alter.replace(/\s*&\s*/g, ' und ') + ' Jahre alt.'
      : klV2ZitatSatz(zahl === 1 ? 'Zum Alter des Kindes' : 'Zum Alter der Kinder', alter) });
  }
  return raus;
}

export function klV2SchlafSatz(sr) {
  if (sr.irregular) return 'Sie hat keinen festen Schlafrhythmus.';
  var teile = [];
  if (sr.bed) teile.push('geht meist gegen ' + sr.bed + ' Uhr ins Bett');
  if (sr.wake) teile.push('steht meist gegen ' + sr.wake + ' Uhr auf');
  return teile.length ? 'Sie ' + klV2SatzListe(teile) + '.' : '';
}

export function klV2SatzListe(teile) {
  teile = (teile || []).filter(Boolean);
  if (teile.length < 2) return teile[0] || '';
  return teile.slice(0, -1).join(', ') + ' und ' + teile[teile.length - 1];
}

export function klV2ZitatSatz(einleitung, text) {
  text = String(text || '').trim();
  return text ? einleitung + ': „' + text + '“' + (/[.!?…]$/.test(text) ? '' : '.') : '';
}

export function klV2FadenText(key, f) {
  f = f || {};
  var auswahl = (f.selected || []).filter(function(v) {
    return ['schwer zu sagen', 'weiß ich noch nicht', 'weiß ich nicht'].indexOf(v) < 0;
  });
  var satz = '';
  if (key === 'themen') {
    /* K-1: "Etwas anderes" ist keine Angabe - ihr Freitext sagt, was es ist. */
    var themen = auswahl.filter(function(v) { return v !== 'Etwas anderes'; });
    if (themen.length) satz = klV2SatzListe(themen) + (themen.length === 1 ? ' beschäftigt' : ' beschäftigen') + ' sie gerade';
  } else if (key === 'gefuehl') {
    if (auswahl.length) satz = 'Bei ihren aktuellen Anliegen fühlt sie sich ' + klV2SatzListe(auswahl);
  } else if (key === 'ziel') {
    var fragen = {
      'warum ich mich so fühle': 'warum sie sich so fühlt',
      'was mich beeinflusst': 'was sie beeinflusst',
      'was mir guttut': 'was ihr guttut',
      'meinen Körper besser verstehen': 'wie sie ihren Körper besser verstehen kann',
      'meine Stimmung besser einordnen': 'wie sie ihre Stimmung besser einordnen kann',
      'Zusammenhänge erkennen': 'welche Zusammenhänge sie bei sich beobachtet',
      'Veränderungen bei mir verstehen': 'wie sie Veränderungen bei sich einordnen kann',
      'wissen, worauf ich achten kann': 'worauf sie achten kann'
    };
    var ziele = auswahl.map(function(v) { return fragen[v]; }).filter(Boolean);
    if (ziele.length) satz = 'Sie möchte besser verstehen, ' + klV2SatzListe(ziele);
  } else if (key === 'zyklus') {
    var phasen = {
      'Periode': 'Sie schätzt, dass sie gerade ihre Periode hat',
      'kurz danach': 'Nach eigener Einschätzung ist sie kurz nach ihrer Periode',
      'Zyklusmitte': 'Sie verortet sich ungefähr in der Zyklusmitte',
      'kurz vor der Periode': 'Nach eigener Einschätzung steht sie kurz vor ihrer Periode'
    };
    satz = phasen[auswahl[0]] || '';
  } else if (key === 'beschwerden') {
    var zeitraum = String(f.text || '').trim();
    if (!zeitraum) return '';
    if (/^(seit|schon seit)\s+/i.test(zeitraum)) return 'Das körperliche Thema beschäftigt sie ' + zeitraum.replace(/[.!?]+$/, '') + '.';
    if (/^(\d+|ein(?:e[nmr]?)?|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|mehrere[nr]?|wenige[nr]?)\s+(tag|woche|monat|jahr)/i.test(zeitraum)) return 'Das körperliche Thema beschäftigt sie seit ' + zeitraum.replace(/[.!?]+$/, '') + '.';
    return klV2ZitatSatz('Zum Zeitraum des körperlichen Themas sagt sie', zeitraum);
  }
  var text = String(f.text || '').trim();
  if (satz && text) return klV2ZitatSatz(satz + ' und sie ergänzt dazu', text);
  if (satz) return satz.charAt(0).toUpperCase() + satz.slice(1) + '.';
  var rahmen = { themen: 'Zu ihrem aktuellen Anliegen sagt sie', gefuehl: 'Zu ihrem Erleben sagt sie', ziel: 'Zu dem, was sie verstehen möchte, sagt sie', zyklus: 'Zu ihrer eigenen Zykluseinschätzung sagt sie' };
  return klV2ZitatSatz(rahmen[key] || 'Sie sagt', text || auswahl.join(', '));
}

/* ── Archiv und Aufnahme ─────────────────────────────────────────── */

/* Legt den Archiveintrag des Kennenlernens an oder schreibt seinen
   Verlauf fort. Ergebnis: der Eintrag; false, wenn sie ihn geloescht hat
   (ein geloeschtes Gespraech bleibt geloescht); null, wenn das Schreiben
   scheiterte. */
export function felieKlArchivSichern(verlauf) {
  var s = klZustand(), chats = getSavedChats();
  var c = chats.find(function(x) { return x.onboardingId === s.id; });
  if (s.archiveId && !c) return false; // A deleted conversation must stay deleted.
  if (!c) {
    var ts = Math.max(Date.now(), chats.reduce(function(max, x) { return Math.max(max, Number(x.id) || 0); }, 0) + 1);
    c = { id: ts, timestamp: ts, version: 5, thema: 'Unser erstes Gespräch', onboardingId: s.id,
      notizen: [], notizenStatus: 'unvollstaendig', onboardingErfasst: [], messages: felieSichererVerlauf(verlauf) };
    chats.push(c);
  }
  if (s.flow === 2 && s.stage === 'aufnahme') { c.messages = felieSichererVerlauf(verlauf); c.thema = 'Unser Kennenlernen'; }
  try { felieSpeicherSchreiben('felie_saved_chats', JSON.stringify(chats)); s.archiveId = c.id; return c; }
  catch (e) { return null; }
}

/* Die Aufnahme: aus den Antworten werden Profil, Gedaechtnis (Angaben,
   Faeden, Signal), Zyklus-Voreinstellung, Archiveintrag und Neu-Hinweise.
   Ergebnis { ok, speicherFehler, schonFertig }. Laeuft genau einmal je
   Kennenlernen ('stage' wechselt auf 'bereit'); ein gescheiterter Versuch
   bleibt in 'aufnahme' und darf wiederholt werden. */
export function felieKlSichern() {
  var s = klZustand(); if (s.stage !== 'aufnahme') return { ok: true, schonFertig: true };
  var verlauf = felieKlVerlauf(s.phase === 'zusammenfassung');
  if (klPort && typeof klPort.verlauf === 'function') klPort.verlauf(verlauf);
  var chat = felieKlArchivSichern(verlauf);
  if (!chat) return { ok: false, speicherFehler: chat === null };
  var before = JSON.stringify(felieStore());
  var imported = felieStore().zusatz.onboardingImporte || (felieStore().zusatz.onboardingImporte = {});
  var fingerprint = JSON.stringify(s.committed);
  if (imported[s.id] !== fingerprint) {
    // Only reconcile this still-unfinished intake after an explicit correction.
    var prefix = 'aufnahme:' + s.id + ':';
    felieStore().fakten = felieStore().fakten.filter(function(f) { return String(f.id).indexOf(prefix) !== 0; });
    felieStore().episoden = felieStore().episoden.filter(function(f) { return String(f.id).indexOf(prefix) !== 0; });
    felieStore().signale = felieStore().signale.filter(function(f) { return !(f.meta && f.meta.onboardingId === s.id); });
    /* Die Klasse entscheidet, wann eine Angabe als ueberholungsbeduerftig
       gilt: 'stabil' verfaellt nie durch Nichterwaehnung, 'volatil' 365 Tage
       nach der letzten Bestaetigung. Stabil sind Kinder, Chronisches und die
       Arbeitssituation; volatil sind Wohnsituation, Beziehungsstatus und
       aktuelle Last. */
    var fact = function(key, text, cat, suffix, klasse) {
      if (!text) return;
      var i = chat.messages.findIndex(function(m) { return m.role === 'user' && m.onboardingFeld === key; });
      felieFaktSetzen({ id: 'aufnahme:' + s.id + ':' + key + (suffix || ''), text: text, kategorie: cat,
        klasse: klasse === 'stabil' ? 'stabil' : 'volatil', quelle: 'selbst',
        belege: i >= 0 ? [{ nachricht: i, beleg: chat.messages[i].content }] : [] });
    };
    var a = s.committed, life = a.leben;
    if (life && !life.skipped) {
      var work = life.selected.filter(function(v) { return ['Elternzeit','Vollzeit','Teilzeit','selbstständig'].indexOf(v) >= 0; });
      var family = life.selected.filter(function(v) { return ['alleinlebend','Partnerschaft','Kinder'].indexOf(v) >= 0; });
      /* "hat Kinder" faellt weg, sobald eine Anzahl vorliegt — die eigene
         Blase "Zwei Kinder." sagt dasselbe und mehr. */
      if (a.kinder && !a.kinder.skipped && a.kinder.amount)
        family = family.filter(function(v) { return v !== 'Kinder'; });
      if (life.selected.indexOf('keine Kinder') >= 0) fact('leben', 'Sie hat keine Kinder.', 'familie', ':kinderstatus', 'stabil');
      if (life.selected.indexOf('Kinderwunsch') >= 0) fact('leben', 'Sie hat einen Kinderwunsch.', 'familie', ':kinderwunsch');
      if (family.length) fact('leben', klV2Satz(family, KL_SATZ_FAMILIE), 'familie', ':familie');
      /* Elternzeit ist eine Phase, keine Arbeitssituation - eine Auswahl,
         die sie enthaelt, bleibt volatil und will wieder bestaetigt werden. */
      if (work.length) fact('leben', klV2Satz(work, KL_SATZ_ARBEIT), 'arbeit', ':arbeit',
        work.indexOf('Elternzeit') < 0 ? 'stabil' : 'volatil');
      if (life.text) fact('leben', klV2ZitatSatz('Zum Alltag', life.text), 'allgemein', ':text');
    }
    if (a.kinder && !a.kinder.skipped)
      /* Die ANZAHL der Kinder aendert sich nicht durch Zeitablauf, ihr ALTER
         schon - deshalb nicht dieselbe Klasse fuer beide Saetze. */
      klV2KinderSaetze(a.kinder).forEach(function(k) {
        fact('kinder', k.text, 'familie', k.suffix, k.suffix === ':anzahl' ? 'stabil' : 'volatil'); });
    var body = a.koerper, hormones = body && !body.skipped ? body.selected.filter(function(v) { return ['nichts davon','später','bekannte körperliche Themen'].indexOf(v) < 0; }) : [];
    if (klV2Hat('leben','schwanger') && hormones.indexOf('Schwangerschaft') < 0) hormones.push('Schwangerschaft');
    /* Der Doppelpunkt loest die Rektion auf (die Auswahlwerte stehen im
       Nominativ). Seit B-5b (Marcel, 28.09.) als knappe Angabe ohne
       Subjekt, wie die Zitatsaetze. Die Abgrenzung "nach eigener Angabe"
       traegt felieKontextDaten() als Feld quelle. */
    if (hormones.length) fact(body && !body.skipped ? 'koerper' : 'leben', 'Körperlicher Kontext: ' + klV2SatzListe(hormones) + '.', 'gesundheit', ':kontext');
    if (body && !body.skipped && body.text) fact('koerper', klV2ZitatSatz('Zum Körper', body.text), 'gesundheit', ':text');
    if (a.schlafroutine && !a.schlafroutine.skipped && (a.schlafroutine.bed || a.schlafroutine.wake || a.schlafroutine.irregular)) fact('schlafroutine', klV2SchlafSatz(a.schlafroutine), 'allgemein');
    ['themen','gefuehl','ziel','zyklus','beschwerden'].forEach(function(key) {
      var f = a[key]; if (!f || f.skipped) return;
      if (['gefuehl','ziel','zyklus'].indexOf(key) >= 0 && f.selected.some(function(v) { return ['schwer zu sagen','weiß ich noch nicht','weiß ich nicht'].indexOf(v) >= 0; })) return;
      var days = ['gefuehl','zyklus'].indexOf(key) >= 0 ? 1 : 7;
      var i = chat.messages.findIndex(function(m) { return m.role === 'user' && m.onboardingFeld === key; });
      felieEpisode({ id: 'aufnahme:' + s.id + ':' + key, text: klV2FadenText(key, f), faelligBis: f.ts + days * 86400000,
        belege: i >= 0 ? [{ nachricht: i, beleg: chat.messages[i].content }] : [] });
    });
    var sleep = a.schlafqualitaet;
    if (sleep && !sleep.skipped && sleep.selected.length) {
      var chip = FELIE_FRAGEN.schlafqualitaet.chips.find(function(c) { return c.label === sleep.selected[0]; });
      if (chip) felieSchreibeSignal('schlafqualitaet', chip.wert, 'selbst', { quelleDetail: 'Onboarding: letzte Nacht', onboardingId: s.id }, sleep.ts);
    }
    imported[s.id] = fingerprint;
    felieStore().zusatz.onboardingVerbindungenV6 = felieStore().zusatz.onboardingVerbindungenV6 || {};
    felieStore().zusatz.onboardingVerbindungenV6[s.id] = true;
  }
  if (!felieStoreSpeichern()) { felieStoreSetzen(JSON.parse(before)); return { ok: false, speicherFehler: true }; }
  /* Erst NACH dem Store schreiben: die Zyklusangabe liegt unter einem
     eigenen Speicherschluessel, ein Ruecksetzen des Stores wuerde sie
     nicht mit zuruecknehmen. Die Voreinstellung ist idempotent. */
  try { klV2ZyklusVoreinstellen(s.committed); } catch (e) {}
  var chats = getSavedChats(), current = chats.find(function(c) { return c.onboardingId === s.id; });
  if (!current) return { ok: false };
  current.notizenStatus = 'vollstaendig'; current.onboardingFlow = 2;
  /* AL-76: die Archivkarte des Kennenlernens bekommt ihre Zusammenfassung,
     deterministisch aus ihren eigenen Auswahlen; nachweis.quelle 'selbst'. */
  try { current.zusammenfassung = { text: klV2Zusammenfassung(), nachweis: { quelle: 'selbst' } }; } catch (e) {}
  /* AL-75: was im Kennenlernen ins Gedaechtnis geschrieben wurde, wird als
     "neu" gemeldet - hier und nicht im Importblock, der bei jeder
     Korrektur erneut laeuft; diese Stelle wird genau einmal erreicht. */
  var neuPraefix = 'aufnahme:' + s.id + ':';
  var neuIds = [];
  try {
    felieStore().fakten.forEach(function (f) {
      if (String(f.id).indexOf(neuPraefix) === 0) neuIds.push(f.id); });
    felieStore().episoden.forEach(function (e) {
      if (String(e.id).indexOf(neuPraefix) === 0) neuIds.push(e.id); });
  } catch (e) {}
  if (neuIds.length) { try { felieNeueSnippetsSetzen(neuIds); } catch (e) {} }
  try { felieSpeicherSchreiben('felie_saved_chats', JSON.stringify(chats)); } catch (e) { return { ok: false, speicherFehler: true }; }
  if (!profilPort().profilSichern()) return { ok: false, speicherFehler: true };
  s.extraction = 'fertig'; s.stage = 'bereit'; s.input = ''; s.completedAt = Date.now();
  if (!entwurfSichern()) { s.stage = 'aufnahme'; return { ok: false }; }
  return { ok: true };
}
