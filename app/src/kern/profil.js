/* Name, Alter und Alle Daten loeschen (F6d-1, Marcel 30.09.).

   D-4 A / U-6 A: der Name folgt der Regel des Kennenlernens (klNameSetzen,
   klNameAblehnung); leer ist erlaubt und loescht ihn. Das Alter ist eine
   ganze Zahl von 18 bis 120 (wie klV2Validieren) und ersetzt das Band aus
   dem Kennenlernen; leer loescht. Beides zeigt ab F6d-2 das Register
   "Über dich" im Gedaechtnis. Die Webapp pruefte im Profil bis F6d nur die
   Laenge (100 Zeichen, Befund 8).

   D-7 / D-8 A: "Alle Daten loeschen" nimmt jeden Schluessel von felie weg
   (FELIE_LS_KEYS und die Altlasten), leert den Arbeitsspeicher und macht
   laufende Abschluesse ungueltig (Datenepoche). Die Paywall-Merkung
   (felie_erste_paywall) bleibt (Register 333). Bis F6d stand der Ablauf
   nur in der Webapp (doResetUserData). */
import { FELIE_LS_KEYS, FELIE_LS_KEYS_ALTLAST, felieSpeicherLoeschen } from './speicher.js';
import { felieArbeitsspeicherLeeren } from './store.js';
import { felieDatenEpocheErhoehen } from './abschluss.js';
import { klNameAblehnung, klNameSetzen, klUebergabeInvalidieren } from './aufnahme.js';
import { FELIE_EINSTELLUNGEN_TEXTE, felieProfil, felieProfilSichern } from './einwilligung.js';

/* Nach einer Aenderung gilt die Uebergabe aus dem Kennenlernen nicht mehr
   (wie profilBasisSpeichern der Webapp, klUebergabeInvalidieren). */
function gespeichert(ok) {
  if (!ok) return { ok: false, fehler: null };
  try { klUebergabeInvalidieren(); } catch (e) {}
  return { ok: true };
}

export function felieProfilNameSetzen(text) {
  var roh = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  var name = roh ? klNameSetzen(roh) : '';
  if (roh && (!name || klNameAblehnung(roh))) return { ok: false, fehler: FELIE_EINSTELLUNGEN_TEXTE.nameFehler };
  var p = felieProfil();
  p.userName = name;
  return gespeichert(felieProfilSichern(p));
}

export function felieProfilAlterSetzen(text) {
  var roh = String(text == null ? '' : text).trim();
  if (roh && !/^(?:1[89]|[2-9]\d|1[01]\d|120)$/.test(roh)) return { ok: false, fehler: FELIE_EINSTELLUNGEN_TEXTE.alterFehler };
  var p = felieProfil();
  delete p.klAnswers.alter; delete p.klAnswers.alterExact; delete p.klAnswers.alterErfasstAm;
  if (roh) { p.klAnswers.alterExact = Number(roh); p.klAnswers.alterErfasstAm = Date.now(); }
  return gespeichert(felieProfilSichern(p));
}

export function felieAlleDatenLoeschen() {
  FELIE_LS_KEYS.concat(FELIE_LS_KEYS_ALTLAST).forEach(function (k) {
    try { felieSpeicherLoeschen(k); } catch (e) {}
  });
  try { felieArbeitsspeicherLeeren(); } catch (e) {}
  try { felieDatenEpocheErhoehen(); } catch (e) {}
}
