'use strict';

/* De grenzen van dezelfde werkruimte-export, geen tweede uitvoercontract.
   Een checksum bewijst samenhang, geen betrouwbare afzender. Daarom gelden
   de geheim- en scopegrenzen zowel uitgaand als bij opnieuw inlezen. */

/* `rtgKey` is geen gewone sleutel maar een verband met de identiteitskluis.
   Ook geneste velden moeten eruit; een import mag dat verband niet herstellen. */
const GEHEIM = ['beheerToken', 'token', 'lidToken', 'rtgKey', 'beheerSessies', 'sessies', 'beheerEpoch', 'sessieEpoch'];
const KOPVELDEN = ['code', 'naam', 'land', 'valuta', 'taal', 'moeder', 'kvk', 'btwNummer', 'at'];

/* Werkruimtebeheer is GEEN tenantbreed reisbeheer. De bestaande exportpoort
   bewijst alleen bevoegdheid voor W..., terwijl reiscontracten uitsluitend een
   org/zaak dragen. Dezelfde org bewijst niet dat deze beheerder alle reizen,
   klanten of leveranciersopdrachten van die organisatie mag lezen. Tot die
   pilotgranulariteit is besloten en afgedwongen exporteren we geen reisrijen.
   Dit meldpunt zit IN de bestaande catalogus: geen tweede bewijsregister en
   geen ongecontroleerde appendix. Het noemt ook geen aantallen of dossierrefs.
   Een import van dit bericht is uitsluitend geschiedenis, nooit autoriteit. */
const REISUITGANG = Object.freeze({
  schemaVersion: 1, status: 'gedeeltelijk', scope: 'werkruimte', volledigeTenantexport: false,
  reiscontracten: Object.freeze({ status: 'geblokkeerd', code: 'REISKETEN_EXPORT_SCOPE_UNPROVEN',
    reden: 'Werkruimtebeheer bewijst geen tenantbrede bevoegdheid voor reiscontracten. Een gedeelde org is geen inzagerecht.',
    besluitNodig: 'Leg de pilotgranulariteit en bestaande bevoegde exitactor vast voordat reiscontracten of leverancieropdrachten meegaan.',
    invoer: 'Geen reiscontract, leveranciersacceptatie, betaalbewijs of toegangsrecht wordt uit deze uitvoer geactiveerd.',
    bewaring: 'Kernexport blijft leesbaar in bewaring; de persoonlijke productie-exitbevoegdheid in bewaring is nog niet gekwalificeerd.' })
});

function zonderGeheim(v) {
  if (Array.isArray(v)) return v.map(zonderGeheim);
  if (v && typeof v === 'object') {
    const uit = {};
    for (const k of Object.keys(v)) { if (!GEHEIM.includes(k)) uit[k] = zonderGeheim(v[k]); }
    return uit;
  }
  return v;
}

// Elke uitvoer/import krijgt de berekende verklaring, nooit een gedeeld object.
const reisverklaring = () => JSON.parse(JSON.stringify(REISUITGANG));

function scopeFout(u, som) {
  if ((u.status != null && u.status !== 'gedeeltelijk') ||
      (u.inhoud.reisketenUitgang != null && som(u.inhoud.reisketenUitgang) !== som(REISUITGANG)))
    return 'Deze uitvoer claimt een niet-bewezen reis- of tenantscope. Werkruimtebeheer geeft geen tenantbreed reisrecht.';
  if (u.inhoud.reisarchief != null && (!require('./uitgang-reis').geldig(u.inhoud.reisarchief) ||
      Object.keys(u.inhoud).some(k => !['reisarchief', 'reisketenUitgang', 'leden'].includes(k)) ||
      Object.keys(u.inhoud.leden || {}).length))
    return 'Het reisarchief is geen begrensde documentaire geschiedenis; operationeel herstel is niet toegestaan.';
  return null;
}

function herstelInhoud(w, bron) {
  const inhoud = zonderGeheim(bron);
  for (const k of Object.keys(inhoud)) {
    // De nieuwe code en moedergrens mogen nooit door inhoud vervangen worden.
    if (!KOPVELDEN.includes(k)) w[k] = JSON.parse(JSON.stringify(inhoud[k]));
  }
  w.reisketenUitgang = reisverklaring();
}

module.exports = { GEHEIM, KOPVELDEN, zonderGeheim, reisverklaring, scopeFout, herstelInhoud };
