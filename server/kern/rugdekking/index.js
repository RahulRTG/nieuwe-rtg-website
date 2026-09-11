/* ============================================================================
   RTG RUGDEKKING -- het programma waarmee RTG achter een mens gaat staan.

   De regels van de vork staan in ./soorten.js en worden hier niet herhaald. Dit
   bestand bewaart programma's en weigert wat vandaag niet kan -- met de reden.

   De schakelaar van de beurs staat in ./beurs.js -- zie de kop daar voor waarom
   die knop van een andere orde is dan een programma.

   WAT DIT BESTAND MET OPZET NIET DOET: geld verplaatsen. Er komt geen tweede
   betaalweg naast kern/pay/poort.js (COMMERCE.md), en een commercieel programma
   loopt daarom over de bestaande leveranciersweg -- factuur, btw,
   PARTNER_UITBETALING. Wat hier staat is de AFSPRAAK en de grens eromheen, niet
   de boeking. Wie hier een uitbetaling inbouwt, heeft de tweede geldstroom
   gemaakt die dit huis nergens wil.
   ========================================================================== */
'use strict';

const S = require('./soorten');

const MAX_PER_MENS = 12;

function maakRugdekking(state) {
  const { db, save, bijeen, inBundel, crypto, schoon, keyVanCodenaam, codenaamVan, jeugdstandVan } = state;

  const vastleggen = require('../../lib/duurzaam')({ bijeen, save, inBundel, bron: 'rugdekking' });
  const eigen = require('../eigencollectie')({ db, domein: 'kern/rugdekking',
    bezit: { rugdekkingen: 'kaart' } });

  const nu = () => new Date().toISOString();
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const naam = (k) => (codenaamVan && codenaamVan(k)) || 'een mens';
  const id = () => 'rd' + crypto.randomBytes(5).toString('hex');

  const bak = () => eigen.bak('rugdekkingen');
  const kijk = () => eigen.kijk('rugdekkingen');
  const leeg = () => ({ programmas: [], stand: 'gesloten' });

  /* Opzoeken doet kijk(), schrijven doet bak() -- kern/eigencollectie.js: een
     verzoek dat op 403 of 409 eindigt hoort geen lege rij achter te laten. */
  const boekKijk = () => (kijk() || {}).boek || leeg();
  const boek = () => {
    const k = bak();
    if (!k.boek) k.boek = leeg();
    if (!Array.isArray(k.boek.programmas)) k.boek.programmas = [];
    return k.boek;
  };

  const { beursStand, beursStandZet, koppelBevoegd, vermogenVraag, STANDEN } =
    require('./beurs')({ boek, boekKijk, vastleggen, nu, scho });

  /* ---------- programma's ---------- */

  function publiek(p) {
    return { id: p.id, mens: naam(p.mens), soort: p.soort, wereld: p.wereld,
      tegenprestaties: p.tegenprestaties, bedragCenten: p.bedragCenten,
      factuurNodig: p.factuurNodig, tot: p.tot, gestopt: p.gestopt,
      door: p.door, at: p.at };
  }

  async function stel(door, data) {
    const d = data || {};
    const wie = scho(door, 80);
    if (!wie) {
      return { status: 403, error: 'Rugdekking wordt op naam toegekend. De gedeelde kantoorcode is ' +
        'geen naam, en dan is later niet te zien wie dit heeft besloten.' };
    }
    const gevonden = keyVanCodenaam ? await keyVanCodenaam(scho(d.mens, 80)) : null;
    const mensKey = gevonden && gevonden.key;
    if (!mensKey) return { status: 404, error: 'Deze mens bestaat niet. Vraag om de codenaam zoals die in RTG staat.' };

    /* De leeftijd komt uit het jeugdbestuur en niet uit een eigen lezing: er is
       maar EEN plek die weet of iemand BEWEZEN minderjarig is, en een tweede
       zou binnen een maand iets anders zeggen. */
    const jst = typeof jeugdstandVan === 'function' ? jeugdstandVan(mensKey) : null;
    const v = S.vorm(d, { minderjarig: !!(jst && jst.minderjarig) });
    if (v.error) return { status: 400, error: v.error };

    /* DE BEVOEGDHEID, en pas NA de vorm: zo hoort iemand die een onmogelijke
       beurs opstelt eerst waarom zijn programma niet klopt, en niet alleen dat
       de deur dicht zit.

       ER WORDT GEVRAAGD EN NIET ZELF GEREKEND. De schakelaar hierboven is de
       BRON, maar het oordeel komt van kern/bevoegdheid -- die weegt er ook de
       rail bij, en een beurs die niemand kan uitbetalen is geen beurs. Deze
       laag hoort dat niet na te bouwen; dan zegt zij op een dag iets anders. */
    const bev = vermogenVraag(v.programma.uitbetaalVermogen);
    if (bev && !bev.mag) {
      return { status: 409, error: (bev.uitleg || 'Dit vermogen staat niet open.') +
        ' Een afspraak vastleggen die RTG niet kan nakomen, is een belofte en geen rugdekking. ' +
        'Commerciele rugdekking kan wel.' };
    }

    const boekje = boekKijk();
    const lopend = boekje.programmas.filter(p => p.mens === mensKey && !p.gestopt);
    if (lopend.length >= MAX_PER_MENS) {
      return { status: 409, error: 'Deze mens heeft het maximum aantal lopende programma\'s.' };
    }
    /* TWEE SOORTEN TEGELIJK BIJ DEZELFDE MENS IS DE CONSTRUCTIE ZELF. Dan
       betaalt RTG hem commercieel en de stichting hem als beurs, en van buiten
       is niet meer te zien welk geld waarvoor was. Dat is precies wat par. 2.4
       "een programma dat beide wil zijn" noemt, alleen dan over twee regels
       verdeeld. */
    /* DE DUBBELTIK, en die is hier duur. De meetronde van 11 september 2026 liet
       zien dat twee identieke aanroepen TWEE lopende programma's achterlieten
       (0 -> 1 -> 2): een dubbelklik in het kantoor verdubbelde stil wat RTG een
       mens had beloofd. Dat is geen ordeningsprobleem maar geld.

       Dit is een TOESTANDSCONTROLE en geen duplicaatlaag (MUTATIECONTRACT.md
       par. 5o): wat vaststaat is dat er geen tweede identiek programma KAN
       ontstaan, niet dat een dubbeltik als zodanig wordt herkend. Een tweede
       programma dat ergens in verschilt -- ander bedrag, andere einddatum,
       andere tegenprestatie -- is een ander besluit en gaat gewoon door. */
    const zelfde = (p) => p.soort === v.programma.soort && p.bedragCenten === v.programma.bedragCenten &&
      p.tot === v.programma.tot && p.tegenprestaties.join() === v.programma.tegenprestaties.join();
    if (lopend.some(zelfde)) {
      return { status: 409, error: 'Dit lid heeft al een lopend programma dat op alle punten hetzelfde ' +
        'is. Twee keer hetzelfde vastleggen verdubbelt stil wat RTG heeft beloofd. Wijkt het nieuwe ' +
        'programma ergens van af, verander dat dan; is het echt een tweede afspraak, stop dan eerst ' +
        'de lopende.' };
    }
    if (lopend.some(p => p.soort !== v.programma.soort)) {
      return { status: 409, error: 'Deze mens heeft al een lopend programma van de andere soort. ' +
        'Commercieel en beurs naast elkaar bij dezelfde mens maakt van buiten onzichtbaar welk geld ' +
        'waarvoor was; stop het lopende programma eerst.' };
    }

    const p = Object.assign({ id: id(), mens: mensKey, door: wie, at: nu() }, v.programma);
    const mis = await vastleggen(() => { boek().programmas.unshift(p); });
    if (mis) return mis;
    return { status: 200, ok: true, programma: publiek(p),
      let: v.programma.factuurNodig
        ? 'Vastgelegd. Dit is een KOOP: de mens factureert als ondernemer, en het geld loopt over de ' +
          'bestaande leveranciersweg. Hier wordt niets geboekt.'
        : 'Vastgelegd als beurs. Er staat niets tegenover, en dat blijft zo.' };
  }

  async function stop(door, pid, reden) {
    const wie = scho(door, 80);
    if (!wie) return { status: 403, error: 'Stoppen gaat op naam.' };
    const p = boekKijk().programmas.find(x => x.id === String(pid || ''));
    if (!p) return { status: 404, error: 'Dit programma bestaat niet.' };
    if (p.gestopt) return { status: 409, error: 'Dit programma is al gestopt.' };
    const mis = await vastleggen(() => {
      const echt = boek().programmas.find(x => x.id === p.id);
      echt.gestopt = { door: wie, at: nu(), reden: scho(reden, 200) || null };
    });
    if (mis) return mis;
    return { status: 200, ok: true,
      let: 'Gestopt. Wat deze mens overhoudt is wat hij zelf heeft opgebouwd -- dat is de toetsvraag ' +
        'van dit hele programma.' };
  }

  /* Wat een MENS over zichzelf ziet. Hij hoort te weten wie er achter hem staat
     en waarvoor, zonder het te moeten vragen. */
  function mijn(key) {
    const p = boekKijk().programmas.filter(x => x.mens === key).map(publiek);
    return { status: 200, programmas: p, nooit: S.NOOIT };
  }

  function lijst() {
    return { status: 200, soorten: S.SOORTEN, tegenprestaties: S.TEGENPRESTATIES, nooit: S.NOOIT,
      beurs: beursStand() };
  }

  function alle() {
    return { status: 200, beurs: beursStand(), programmas: boekKijk().programmas.map(publiek) };
  }

  return { rugdekking: { lijst, mijn, alle, stel, stop, beursStand, beursStandZet, koppelBevoegd, STANDEN } };
}

module.exports = { maakRugdekking };
