/* Laufkennung (F3, Datenbindung je Konto, Marcel 28.09. A, Zusatz 1).

   Ein Kontowechsel ist im Kern ein neuer Lauf: felieKernZuruecksetzen
   zaehlt weiter, danach haengen Speicher, Netz und Konto am neuen Konto.
   Arbeit, die vorher begann und asynchron weiterlaeuft (die Antwort im
   Gespraech, die Auswertung mit mehreren Runden, der Notlauf), merkt sich
   ihren Lauf und bricht vor der naechsten Anfrage und vor dem Schreiben ab
   - sonst liefe sie mit dem Token des neuen Kontos weiter und schriebe in
   dessen Bestand. Der Abschlussauftrag liegt da schon im Bestand des alten
   Kontos und wird dort nachgeholt.

   Der Zaehler wird nie zurueckgesetzt: jeder Lauf hat eine eigene Nummer. */

let lauf = 0;

export function felieLauf() {
  return lauf;
}

export function felieLaufNeu() {
  lauf = lauf + 1;
  return lauf;
}

export function felieUeberholt() {
  var e = new Error('Konto oder Laufzeit gewechselt - die Arbeit gehoert einem frueheren Lauf');
  e.felieUeberholt = true;
  return e;
}

export function felieLaufPruefen(l) {
  if (l !== lauf) throw felieUeberholt();
}
