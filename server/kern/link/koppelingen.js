/* RTG Link: MIJN KOPPELINGEN -- wat er van mij openstaat, wat er gebeurd is, en
   wat ik er nu nog aan kan doen (LINK.md par. 4, stap 6).

   DRIE VRAGEN, EN ZE ZIJN NIET DEZELFDE:

   1. WAT STAAT ER NU OPEN? Codes van mij die nog leven. Die kan ik intrekken --
      er is nog niets mee gebeurd, dus er valt ook niets te bewaren.
   2. WAT IS ER GEBEURD? De bonnen. Die blijven staan, altijd. Intrekken sluit
      een deur; het wist niet dat hij open is geweest (par. 3.6).
   3. WAT KAN IK ER NOG AAN DOEN? En dat is per regel iets anders, en soms
      niets. Juist dat "soms niets" hoort er eerlijk bij te staan.

   WAAROM `terug` HIER WORDT UITGEREKEND EN NIET IN HET SCHERM. Of een verstuurd
   verzoek nog is in te trekken, hangt af van de stand van die band -- en dat is
   een besluit, geen opmaak. Een scherm dat zelf gaat gokken welke knop mag,
   toont vroeg of laat een knop die weigert, of verzwijgt er een die had gekund.

   EN WAAROM ER BIJ GELD GEEN KNOP STAAT. Een betaling is geen toegang die je
   dichtdoet: het geld is verplaatst. De eerlijkste uitkomst is dan de reden
   erbij en verder niets -- geen knop die suggereert dat het terug te draaien is.
   Wie een boeking wil betwisten, doet dat waar betalingen wonen. */
'use strict';

module.exports = ({ bonnenVan, capOpenVan, bandStand, naamVan }) => {

/* Wat er per bon nog kan. Geeft `terug` (de weg die het scherm mag aanbieden) of
   `reden` (waarom er niets is). Nooit allebei leeg: dan zegt dit bestand niets. */
/* De weg terug ligt in de WERELD VAN DE SCANNER, en dat is geen opmaakdetail:
   een gezinslid komt niet door de ledendeur. Dezelfde handeling (socialIntrek),
   twee poorten -- en wie hier een vaste weg zou neerzetten, geeft de helft van
   de mensen een knop die weigert. */
const INTREKWEG = { gezin: '/api/rtf/social/connect/intrek', lid: '/api/member/connect/intrek' };

function watNog(mij, bon, soort) {
  if (bon.intentie === 'contact.verbinden') {
    if (!bon.naar) return { reden: 'Dit ging via een levende code; wie het was, staat bij je contacten.' };
    const stand = typeof bandStand === 'function' ? bandStand(mij, bon.naar) : null;
    if (stand === 'aangevraagd' || stand === 'wacht-op-ouder')
      return { terug: { weg: INTREKWEG[soort] || INTREKWEG.lid, veld: 'key', waarde: bon.naar, tekst: 'Verzoek intrekken' } };
    if (stand === 'verbonden') return { reden: 'Jullie zijn verbonden; dat beheer je bij je contacten.' };
    return { reden: 'Dit verzoek staat niet meer open.' };
  }
  if (bon.type === 'capability') return { reden: 'Dit is gebeurd. Een betaling draai je hier niet terug.' };
  return { reden: 'Hier valt niets meer aan te doen.' };
}

/* Per partij: hoe vaak, wanneer voor het laatst, en langs welke weg. Dat is het
   antwoord op "waarom had die toegang" -- niet een lijst rechten, maar wat er
   werkelijk tussen jullie is gebeurd.

   Bonnen zonder tegenpartij (een levende code draagt er geen) tellen hier niet
   mee; ze staan wel gewoon in de lijst. Een partij "onbekend" verzinnen zou een
   regel maken die over niemand gaat. */
function partijenVan(bonnen) {
  const per = new Map();
  for (const b of bonnen) {
    if (!b.naar) continue;
    const p = per.get(b.naar) || { id: b.naar, naam: naamVan(b.naar), aantal: 0, laatst: null, via: [] };
    p.aantal++;
    if (!p.laatst || b.at > p.laatst) p.laatst = b.at;
    if (b.vorm && !p.via.includes(b.vorm)) p.via.push(b.vorm);
    per.set(b.naar, p);
  }
  return [...per.values()].sort((a, b) => (a.laatst < b.laatst ? 1 : -1));
}

/* Het hele scherm in een antwoord. Een tweede rondgang voor "wat staat er open"
   zou het scherm in twee standen kunnen zetten die niet bij elkaar horen. */
function koppelingen(mij, alsScanner) {
  const b = bonnenVan(mij);
  const soort = (alsScanner && alsScanner.soort) || 'lid';
  const bonnen = b.bonnen.map(x => ({ ...x, naarNaam: x.naar ? naamVan(x.naar) : null, ...watNog(mij, x, soort) }));
  return { open: capOpenVan(alsScanner || { key: mij }), bonnen,
    partijen: partijenVan(b.bonnen), nietBewaard: b.nietBewaard, max: b.max };
}

return { koppelingen, watNog, partijenVan, INTREKWEG };
};
