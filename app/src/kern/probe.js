/* D0 (Welle D): Platzhalter, der nachweist, dass der Kern geladen wurde.

   Keine Fachlogik. Er zeigt nur, dass der Weg traegt: Datei im Kern,
   echter Export, ueber die Webapp-Bruecke im window angekommen. Sobald
   D1 das erste echte Modul bringt, darf er entfallen. Der Waechter in
   index.html haengt nicht an diesem Namen, sondern an FELIE_KERN. */

export function felieKernProbe() {
  return 'kern-geladen';
}
