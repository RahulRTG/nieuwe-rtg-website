/* DE SCHAKELAAR VAN DE BEURS -- en waarom hij een eigen bestand heeft.

   Afgesplitst van ./index.js langs het onderwerp: daar staan PROGRAMMA'S (wie
   krijgt wat, tot wanneer, waarvoor), hier staat de vraag of dit huis zulke
   uitkeringen uberhaupt doet. Dat zijn twee besluiten van een andere orde. Een
   programma stopzetten raakt een mens; deze knop omzetten raakt wat RTG IS.

   DE SCHAKELAAR IS DE JURIDISCHE POSITIE, niet een instelling die er toevallig
   naast staat -- dezelfde vorm als de terugstortstand in CLAUDE.md. Zolang hij
   DICHT staat keert dit huis geen geld uit aan een mens buiten een levering om,
   en dat is wat RTG dan is. Gaat hij open, dan neemt de eigenaar die positie in,
   met alles wat daarbij hoort (kern/bevoegdheid/lijst-afhankelijk.js,
   RUGDEKKING_BEURS). Daarom staat hij standaard dicht en niet standaard open:
   bij twijfel gaat er geen geld naar een mens.

   EN HET OORDEEL WORDT GEVRAAGD, NIET ZELF GEREKEND. Deze knop is de BRON, maar
   of een uitkering mag zegt kern/bevoegdheid -- die weegt er ook de rail bij, en
   een beurs die niemand kan uitbetalen is geen beurs. Zou deze laag dat zelf
   narekenen, dan zegt zij op een dag iets anders dan het bevoegdhedenbord, en
   dan is niet meer te zien welke van de twee de waarheid was. */
'use strict';

const STANDEN = Object.freeze(['gesloten', 'open']);

module.exports = ({ boek, boekKijk, vastleggen, nu, scho }) => {

  /* Zonder vastgelegde stand: GESLOTEN. Een ontbrekende stand mag nooit als
     "open" lezen; dat is hoe een positie ongemerkt wordt ingenomen. */
  const beursStand = () => (STANDEN.includes(boekKijk().stand) ? boekKijk().stand : 'gesloten');

  async function beursStandZet(stand, wie) {
    const s = String(stand || '');
    if (!STANDEN.includes(s)) return { status: 400, error: 'De stand is ' + STANDEN.join(' of ') + '.' };
    const door = scho(wie, 80);
    if (!door) {
      return { status: 403, error: 'Deze schakelaar IS de juridische positie van RTG, dus hij gaat ' +
        'op naam om. De gedeelde kantoorcode is geen naam.' };
    }
    const mis = await vastleggen(() => { boek().stand = s; boek().standDoor = door; boek().standAt = nu(); });
    if (mis) return mis;
    return { status: 200, ok: true, stand: s, door,
      let: s === 'open'
        ? 'De beurs staat open. RTG keert daarmee geld uit aan mensen buiten een levering om; dat is ' +
          'een positie en geen instelling.'
        : 'De beurs staat dicht. Commerciele rugdekking blijft gewoon mogelijk.' };
  }

  /* Late binding: kern/bevoegdheid wordt pas in opzet/kernlaag4b.js gebouwd, ver
     na dit bestand, en hij leest op zijn beurt `beursStand` hierboven. Zonder
     koppeling valt de vraag terug op de schakelaar alleen -- dat is de strengere
     kant, want die staat standaard dicht. Een terugval die "ja" zou zeggen
     omdat er nog niets gekoppeld is, is precies de leegstand die dit huis
     nergens toestaat. */
  let bevoegdVraag = null;
  const koppelBevoegd = (fn) => { bevoegdVraag = typeof fn === 'function' ? fn : null; };
  const vermogenVraag = (id) => {
    if (bevoegdVraag) return bevoegdVraag(id);
    if (id !== 'RUGDEKKING_BEURS' || beursStand() === 'open') return { mag: true };
    return { mag: false, uitleg: 'RTG keert geen geld uit aan een mens buiten een levering om.' };
  };

  return { beursStand, beursStandZet, koppelBevoegd, vermogenVraag, STANDEN };
};
