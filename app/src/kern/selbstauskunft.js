/* Selbstauskunft - seit Welle D, Paket D5b, ein Kern-Modul.

   Die Skalen der Selbstreflexion (FELIE_SKALEN, felieSkalaWert,
   felieStufenWort), die Stimmungen (FELIE_STIMMUNGEN, FELIE_STIMMUNG_MAX,
   felieStimmungListe, felieStimmungLabel) und die Fragen dazu
   (FELIE_FRAGEN, felieSkalaChips). Ein Datensatz: die Fragen werden beim
   Laden aus den Skalen gebaut, deshalb ziehen sie gemeinsam um (D-23).
   Die Oberflaeche liest sie wie bisher. Texte unveraendert.

   Der urspruengliche Wortlaut folgt unveraendert. */



/* Wortskalen statt Zahlen. "sehr niedrig" klingt nach Messwert, "leer"
   nach Erleben. Die Reihenfolge bleibt aufsteigend, damit die
   Bandlogik unveraendert greift. */
/* Wortskalen statt Zahlen, und mit beliebig vielen Stufen. Die frueher
   feste Annahme "Wert = Stufe x 20" traegt nicht mehr, seit Schlaf sechs
   Stufen hat. Der gespeicherte Wert ist die Position auf 0–100, damit
   die Bandlogik unveraendert greift.
     Schlaf wird selbst NICHT in Stunden erfasst, sondern als Qualitaet.
   Die Dauer ist ein Geraetewert; wie die Nacht war, weiss nur sie. */
export const FELIE_SKALEN = {
  schlafqualitaet: ['kaum geschlafen', 'oft wach', 'unruhig', 'okay', 'ruhig', 'erholsam'],
  energie:         ['fast keine', 'wenig', 'mittel', 'recht viel', 'voll da'],
  anspannung:      ['ganz ruhig', 'ruhig', 'angespannt', 'unter Druck', 'am Limit']
};

export function felieSkalaWert(key, i) {
  var a = FELIE_SKALEN[key];
  if (!a) return null;
  return Math.round(((i + 1) / a.length) * 100);
}

export function felieStufenWort(key, score) {
  var a = FELIE_SKALEN[key];
  if (!a || score == null) return null;
  var i = Math.round((score / 100) * a.length) - 1;
  return a[Math.min(a.length - 1, Math.max(0, i))];
}

/* Kategoriale Stimmung. Kein Band, keine Rangfolge — Trauer ist nicht
   "weniger" als Motivation. Deshalb auch keine Divergenzpruefung:
   ein Geraet hat zu ihrer Stimmung nichts zu sagen. */
/* Jede Stimmung traegt ein Piktogramm. In der Selbstreflexion steht es
   neben dem Wort — dort lernt die Nutzerin die Zuordnung. Im Header
   steht dann nur noch das Zeichen, weil elf Woerter dort keinen Platz
   haben. Die Glyphen sind abstrakt und ohne Gesichter, damit kein
   Zustand als der schoenere erscheint. */
export const FELIE_STIMMUNGEN = [
  { key: 'gut',          label: 'gut',          mood: 'gut drauf',    ico: 'i-m-gut' },
  { key: 'motiviert',    label: 'motiviert',    mood: 'motiviert',    ico: 'i-m-motiviert' },
  { key: 'ruhig',        label: 'ruhig',        mood: 'ruhig',        ico: 'i-m-ruhig' },
  { key: 'neutral',      label: 'neutral',      mood: 'neutral',      ico: 'i-m-neutral' },
  { key: 'nachdenklich', label: 'nachdenklich', mood: 'nachdenklich', ico: 'i-m-nachdenklich' },
  { key: 'gereizt',      label: 'gereizt',      mood: 'gereizt',      ico: 'i-m-gereizt' },
  { key: 'unsicher',     label: 'unsicher',     mood: 'unsicher',     ico: 'i-m-unsicher' },
  { key: 'muede',        label: 'müde',         mood: 'müde',         ico: 'i-m-muede' },
  { key: 'traurig',      label: 'traurig',      mood: 'traurig',      ico: 'i-m-traurig' },
  { key: 'gestresst',    label: 'gestresst',    mood: 'gestresst',    ico: 'i-m-gestresst' },
  { key: 'ueberfordert', label: 'überfordert',  mood: 'überfordert',  ico: 'i-m-ueberfordert' }
];

/* Bis zu zwei Nennungen. Gefuehle kommen selten allein — "müde und
   gereizt" ist eine andere Lage als nur "müde". Der Store haelt deshalb
   immer eine Liste, auch bei einer einzelnen Angabe. */
export const FELIE_STIMMUNG_MAX = 2;

export function felieStimmungListe(wert) {
  if (wert == null) return [];
  return Array.isArray(wert) ? wert.slice() : [wert];
}

/* Stimmungen, bei denen felie NICHT hormonell einordnet. Eine Frau, die
   Trauer oder Überforderung meldet, braucht keine Phasenerklaerung —
   das relativiert. Sie bekommt Anerkennung und ein Gespraechsangebot. */


export function felieStimmungLabel(wert) {
  var liste = felieStimmungListe(wert).map(function (k) {
    for (var i = 0; i < FELIE_STIMMUNGEN.length; i++) {
      if (FELIE_STIMMUNGEN[i].key === k) return FELIE_STIMMUNGEN[i].label;
    }
    return null;
  }).filter(Boolean);
  return liste.length ? liste.join(' · ') : null;
}

/* Frueher wurden hier Stundenbaender erfasst und daraus ein exakter Wert
   gespeichert — aus "5–6 h" wurde in der Uebersicht "5:30 h". Die Dauer
   ist jetzt Geraetesache; selbst berichtet wird, wie die Nacht WAR. */
export function felieSkalaChips(key) {
  return FELIE_SKALEN[key].map(function (l, i) { return { label: l, wert: felieSkalaWert(key, i) }; });
}

export const FELIE_FRAGEN = {
  schlafqualitaet: {
    frage: 'Wie hat sich deine Nacht angefühlt?',
    chips: felieSkalaChips('schlafqualitaet')
  },
  energie: {
    frage: 'Wie viel Energie hast du gerade?',
    chips: felieSkalaChips('energie')
  },
  anspannung: {
    frage: 'Wie angespannt fühlst du dich gerade?',
    chips: felieSkalaChips('anspannung')
  },
  /* Kategorial: acht Stimmungen statt einer Stressachse. Die App war
     stark auf Anspannung verengt — Trauer, Motivation und Neutralitaet
     hatten gar keinen Platz. */
  stimmung: {
    frage: 'Was beschreibt gerade am besten, wie du dich fühlst?',
    sub: 'Wähle gern bis zu zwei Antworten.',
    kategorial: true,
    mehrfach: FELIE_STIMMUNG_MAX,
    chips: FELIE_STIMMUNGEN.map(function (st) { return { label: st.label, wert: st.key, ico: st.ico }; })
  }
};
