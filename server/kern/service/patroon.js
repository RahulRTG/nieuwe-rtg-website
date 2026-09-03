/* ============================================================================
   HET PATROON -- twintig meldingen die hetzelfde zeggen.

   HET PROBLEEM DAT DIT OPLOST IS GEEN TECHNISCH PROBLEEM. Als er een storing is,
   melden twintig mensen hem, en dan werken twintig medewerkers aan twintig
   zaken die alle twintig dezelfde oorzaak hebben. Dat kost twintig keer zoveel
   werk, en -- erger -- als de storing verholpen is, hoort niemand van die twintig
   dat vanzelf.

   WAT DIT NIET IS: EEN TWEEDE INCIDENT. `kern/command/incident.js` is en blijft
   het incident van dit huis. Dat hangt aan een VERMOGEN uit de gezondheidskaart:
   de machine ziet zelf dat iets stuk is. Deze module kijkt van de andere kant --
   vanaf de MELDERS -- en die kant heeft geen vermogen om aan te wijzen. Dus
   maakt zij geen incident; zij levert een VERMOEDEN, en een mens beslist.
   PLATFORM.md par. 0b: een zelfstandige capability of een tweede ingang naar
   dezelfde. Dit is de eerste, en daarom is er ook geen tweede incidentnummerreeks.

   CORRELATIE IS GEEN OORZAAK, EN DAT STAAT IN DE UITSLAG. Een vermoeden zegt
   WAT die zaken delen en niet WAAROM. Vijf mensen die op maandagochtend over
   hun factuur bellen, delen een tijdvenster en een onderwerp; dat is geen
   storing. De medewerker die het bevestigt, ziet dus altijd waarop de groep is
   gevormd -- anders is de drempel een orakel.

   EN DE MACHINE SLUIT NIETS. Als een incident hersteld is, worden de gekoppelde
   melders INGELICHT en gaan hun zaken naar `inBehandeling`; ze gaan NIET op
   `opgelost`. Dat een platformstoring verholpen is, bewijst namelijk niet dat
   de bestelling van dit ene lid alsnog is aangekomen. Het scherm wordt er
   rustiger van om dat wel te doen, en dat is precies de reden om het niet te
   doen (kern/command/incident.js voert dezelfde redenering over sluiten).
   ========================================================================== */
'use strict';

const klok = require('../../lib/klok');
const { STANDEN } = require('./klassen');

/* Drie is de ondergrens. Twee kan toeval zijn en is het meestal ook; bij drie
   is het de moeite van het KIJKEN waard -- niet van het concluderen. */
const DREMPEL = 3;
/* Zes uur. Lang genoeg om een ochtendstoring bij elkaar te houden, kort genoeg
   dat "iedereen die deze week over betalen belde" geen groep wordt. */
const VENSTER_UREN = 6;

module.exports = function maakPatronen({ zaken, loop, save, db }) {
  const nu = () => klok.datum().toISOString();

  /* WAT SERVICE OVER EEN INCIDENT HEEFT GEZEGD -- en dat is iets anders dan wat
     het incident IS. De stand van een storing woont in RTG Command; hier staat
     alleen of wij de melders al hebben verteld dat hij verholpen is. Twee
     verschillende waarheden, en ze uit elkaar houden voorkomt dat een scherm
     "hersteld" toont omdat iemand hier een knop indrukte. */
  const eigen = require('../eigencollectie')({ db, domein: 'kern/service-patroon', bezit: { serviceIncidentMelding: 'kaart' } });
  const M = () => eigen.bak('serviceIncidentMelding');

  /* WAAROP EEN GROEP WORDT GEVORMD. Onderwerp plus de SOORT van het betrokken
     object -- niet de code, want dan is elke betaling zijn eigen groep en vindt
     hij nooit iets. Het scherm waar het misging telt wel mee: twintig mensen
     die vastlopen op dezelfde pagina is een sterker signaal dan twintig mensen
     met "iets met betalen". */
  function sleutelVan(z) {
    const b = z.betrokken || {};
    return [z.onderwerp || 'anders', b.soort || 'geen', b.soort === 'scherm' ? b.code : ''].join('|');
  }

  function beschrijf(sleutel) {
    const [onderwerp, soort, scherm] = sleutel.split('|');
    const delen = ['onderwerp "' + onderwerp + '"'];
    if (soort !== 'geen') delen.push('een ' + soort);
    if (scherm) delen.push('het scherm ' + scherm);
    return delen.join(', ');
  }

  /* De vermoedens. Alleen over LOPENDE zaken: een groep waarvan de helft al
     gesloten is, gaat over gisteren. */
  function vermoedens({ vensterUren, drempel } = {}) {
    const uren = Number(vensterUren) > 0 ? Number(vensterUren) : VENSTER_UREN;
    const min = Number(drempel) > 0 ? Number(drempel) : DREMPEL;
    const grens = klok.nu() - uren * 3600000;

    const groepen = new Map();
    for (const z of zaken.bak()) {
      if ((STANDEN[z.stand] || {}).eind) continue;
      if (Date.parse(z.at) < grens) continue;
      /* Al aan een incident gekoppeld? Dan is deze zaak al geduid en hoort hij
         niet opnieuw als los signaal te tellen -- anders blijft dezelfde storing
         zichzelf voorstellen zolang hij loopt. */
      if (z.koppelingen.some(k => k.soort === 'incident')) continue;
      const s = sleutelVan(z);
      if (!groepen.has(s)) groepen.set(s, []);
      groepen.get(s).push(z);
    }

    const uit = [];
    for (const [sleutel, rij] of groepen) {
      if (rij.length < min) continue;
      const tijden = rij.map(z => Date.parse(z.at)).sort((a, b) => a - b);
      uit.push({
        sleutel,
        aantal: rij.length,
        zaken: rij.map(z => ({ id: z.id, titel: z.titel, at: z.at, melder: z.melder })),
        vanaf: new Date(tijden[0]).toISOString(),
        tot: new Date(tijden[tijden.length - 1]).toISOString(),
        /* WAAROP DE GROEP IS GEVORMD. Zonder deze zin is de drempel een orakel
           en kan een medewerker niet zien of hij naar een storing kijkt of naar
           een maandagochtend. */
        gedeeld: beschrijf(sleutel),
        let: 'Dit is een VERMOEDEN. Deze ' + rij.length + ' zaken delen ' + beschrijf(sleutel) +
          ' binnen ' + uren + ' uur. Wat ze delen is geen oorzaak; bevestig het pas als u weet waarom.'
      });
    }
    return uit.sort((a, b) => b.aantal - a.aantal);
  }

  /* Bundelen en herstellen -- het DOEN -- staat in ./patroon-bundel.js. De naad
     ligt op een echte grens: hierboven wordt gekeken en niets veranderd,
     daaronder wordt er geschreven en worden er mensen ingelicht. Dat scheelt dit
     bestand bovendien de omvangsgrens van keuringsregel 13. */
  const doen = require('./patroon-bundel')({ zaken, loop, save, M, nu });

  /* Wat er per incident aan hangt, voor een medewerker die wil weten hoe groot
     dit is. */
  function perIncident() {
    const kaart = new Map();
    for (const z of zaken.bak()) {
      for (const k of z.koppelingen) {
        if (k.soort !== 'incident') continue;
        if (!kaart.has(k.code)) kaart.set(k.code, { incident: k.code, zaken: 0, open: 0 });
        const r = kaart.get(k.code);
        r.zaken++;
        if (!(STANDEN[z.stand] || {}).eind) r.open++;
      }
    }
    return [...kaart.values()].sort((a, b) => b.open - a.open);
  }

  /* Is er aan de melders gemeld dat deze storing verholpen is? `null` betekent
     "wij hebben er niets over gezegd" -- en dat is uitdrukkelijk niet hetzelfde
     als "hij loopt nog". Wat de storing DOET, weet RTG Command. */
  const gemeldHersteld = (code) => M()[String(code || '')] || null;

  return { vermoedens, bundel: doen.bundel, hersteld: doen.hersteld, perIncident, gemeldHersteld, sleutelVan, DREMPEL, VENSTER_UREN, nu };
};
