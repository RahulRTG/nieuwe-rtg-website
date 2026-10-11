/* De betaalopdracht, deel "afstemming": een ONBEKENDE opdracht sluiten op de
   uitspraak van de rail (MONEY-012).

   ONBEKEND is een tussenstand en geen eindstand. Hij zet het geld vast zodat het
   niet dubbel uitgaat; zonder deze weg zou hij het ook voor altijd vastzetten.
   Deze module is de enige weg eruit behalve een herinzending met dezelfde
   sleutel (./inzending), en hij kent drie uitkomsten:

     BEVESTIGD        de rail zegt: uitgevoerd, voor dit bedrag in deze valuta.
                      De opdracht wordt AFGEWIKKELD.
     NIET_UITGEVOERD  de rail zegt: niet uitgevoerd. De opdracht wordt MISLUKT
                      en het geld komt terug, precies een keer.
     VERSCHIL         de rail zegt: uitgevoerd, maar voor een ander bedrag of een
                      andere valuta. Er gebeurt NIETS met het geld: de opdracht
                      blijft ONBEKEND en draagt een verschilzaak met verwacht naast
                      gezien. Een verschil wordt nooit afgerond of stil
                      gecorrigeerd -- dezelfde regel als in
                      kern/economie/runtime/reconciliatie.js.

   WAAROM NIET DIE RECONCILIATIE ZELF. Die vergelijkt een settlement die al
   BEVESTIGD is met een afschriftregel ("klopt wat de provider zei"). Hier is de
   vraag een stap eerder: WAT heeft de provider gedaan. En aansluiten zou de
   bank-SEPA en de partneruitbetaling naar het intent/claim-model verhuizen --
   geldarchitectuur die MONEY-012 niet vraagt. Wat er wel is overgenomen, is de
   vorm: alleen geauthenticeerd bewijs, en een afwijking wordt een zaak.

   DRIE SOORTEN ECHTHEID, en de derde is geen zwakke variant van de eerste twee:
     CRYPTOGRAPHIC  een ondertekend bericht van de rail
     DIRECT_API     een antwoord op onze eigen vraag aan de rail
     OVERGENOMEN    een kantoormens nam een afschriftregel over, en een TWEEDE
                    mens tekende af (routes/kantoren/bank-afstemming.js). Die
                    graad staat in het spoor, zodat niemand later denkt dat de
                    rail het zelf zei.
   De echtheid komt nooit uit de invoer van een lid of een formulier: de route
   zet hem. Krijgt ctx.draaiTerug. */
'use strict';

const ECHT = new Set(['CRYPTOGRAPHIC', 'DIRECT_API', 'OVERGENOMEN']);
const SOORT = new Set(['uitgevoerd', 'niet-uitgevoerd']);

module.exports = (ctx) => {
  const { save, nu, klacht, publiek, zet, STATUS, verwerkAfwikkeling } = ctx;

  function spoor(o, regel) {
    if (!Array.isArray(o.uitspraken)) o.uitspraken = [];
    o.uitspraken.push(regel);
  }

  /* Een uitspraak van de rail over een ONBEKENDE opdracht. `centen` en `valuta`
     zijn wat de rail zegt dat er ging, en ze worden vergeleken, niet overgenomen. */
  async function stemAf({ id, uitspraak, providerRef, centen, valuta, bron, echtheid, wie } = {}) {
    const o = ctx.vind(id);
    if (!o) return { status: 404, error: 'Die betaalopdracht bestaat niet.' };
    if (!SOORT.has(uitspraak)) return { status: 400, error: 'De uitspraak is "uitgevoerd" of "niet-uitgevoerd".' };
    if (!ECHT.has(echtheid)) return { status: 403,
      error: 'Afstemmen vraagt bewijs uit een ondertekend bericht, een directe vraag aan de rail, of een overgenomen afschriftregel met een tweede handtekening.' };
    if (!String(bron || '').trim()) return { status: 400, error: 'Noem de bron: welk afschrift of bericht zegt dit.' };
    if (o.status !== STATUS.ONBEKEND) return { status: 409, huidig: o.status,
      error: 'Alleen een opdracht met onbekende uitkomst wordt hier afgestemd; deze staat op ' + o.status + '.' };

    const regel = { uitspraak, providerRef: providerRef ? String(providerRef) : null,
      centen: centen == null ? null : Math.round(Number(centen)), valuta: valuta ? String(valuta).toLowerCase() : null,
      bron: String(bron).slice(0, 200), echtheid, wie: wie || null, at: nu() };

    if (uitspraak === 'niet-uitgevoerd') {
      spoor(o, Object.assign(regel, { uitkomst: 'NIET_UITGEVOERD' }));
      zet(o, STATUS.MISLUKT, { laatsteFout: 'De rail zegt: niet uitgevoerd (' + regel.bron + ').', volgendeAt: null });
      save();
      const terug = await ctx.draaiTerug(o);
      return Object.assign(publiek(o), { uitkomst: 'NIET_UITGEVOERD', teruggeboekt: terug });
    }

    if (!regel.providerRef) return { status: 400, error: 'Een uitgevoerde betaling heeft een referentie van de rail.' };
    const klopt = regel.centen === o.centen && (regel.valuta || '') === String(o.valuta || '').toLowerCase();
    if (!klopt) {
      o.verschil = { verwacht: { centen: o.centen, valuta: o.valuta }, gezien: { centen: regel.centen, valuta: regel.valuta },
        providerRef: regel.providerRef, bron: regel.bron, echtheid, at: regel.at, opgelostAt: null };
      spoor(o, Object.assign(regel, { uitkomst: 'VERSCHIL' }));
      save();
      klacht('VERSCHIL bij afstemming: de rail noemt een ander bedrag of een andere valuta; er is niets met het geld gedaan',
        { id: o.id, verwacht: o.verschil.verwacht, gezien: o.verschil.gezien });
      return Object.assign(publiek(o), { uitkomst: 'VERSCHIL', verschil: o.verschil });
    }

    if (o.verschil && !o.verschil.opgelostAt) o.verschil.opgelostAt = regel.at;
    spoor(o, Object.assign(regel, { uitkomst: 'BEVESTIGD' }));
    zet(o, STATUS.AFGEWIKKELD, { settlementRef: regel.providerRef, laatsteFout: null });
    save();
    await verwerkAfwikkeling(o);
    return Object.assign(publiek(o), { uitkomst: 'BEVESTIGD' });
  }

  /* WAT AFSTEMMEN ZOU DOEN, ZONDER HET TE DOEN -- het tegenfeit voor de geldketen
     (kern/kantoor/geldketen.js). Dezelfde drie takken als stemAf() hierboven, in
     dezelfde volgorde, maar zonder zet(), save() of teruggang: een voorbeeld dat
     schrijft is geen voorbeeld (zie de opzegvoorbeeld-fout in AFSPRAAK.md par.
     14.1). Alleen NIET_UITGEVOERD beweegt geld: het bedrag van de opdracht komt
     terug, plus het tarief als de teruggang van die soort het terugboekt -- dat
     laatste weet alleen de teruggang (kern/bank/uitgang.js), dus het bedrag is een
     BOVENGRENS en draagt de graad `vermoed`. BEVESTIGD sluit de opdracht af zonder
     geldbeweging binnen het huis, VERSCHIL doet niets met het geld. */
  function vooruitblik({ id, uitspraak, centen, valuta } = {}) {
    const o = ctx.vind(id);
    if (!o) return { status: 404, error: 'Die betaalopdracht bestaat niet.' };
    if (!SOORT.has(uitspraak)) return { status: 400, error: 'De uitspraak is "uitgevoerd" of "niet-uitgevoerd".' };
    if (o.status !== STATUS.ONBEKEND) return { status: 409, huidig: o.status,
      error: 'Alleen een opdracht met onbekende uitkomst wordt hier afgestemd; deze staat op ' + o.status + '.' };
    if (uitspraak === 'niet-uitgevoerd') {
      const terug = o.centen + (o.tariefCenten || 0);
      return { ok: true, uitkomst: 'NIET_UITGEVOERD', bedragCenten: terug, naar: o.bron || null,
        effecten: terug > 0 ? ['GELD_BEWEGEN', 'SCHRIJVEN_ANDERMANS'] : [],
        grens: 'bovengrens: het bedrag van de opdracht plus het tarief; of het tarief terugkomt, beslist de teruggang van deze soort' };
    }
    const c = centen == null ? null : Math.round(Number(centen));
    const klopt = c === o.centen && String(valuta || '').toLowerCase() === String(o.valuta || '').toLowerCase();
    return { ok: true, uitkomst: klopt ? 'BEVESTIGD' : 'VERSCHIL', bedragCenten: 0, naar: null, effecten: [],
      grens: klopt ? 'de opdracht wordt afgewikkeld; er beweegt binnen het huis geen geld'
        : 'een ander bedrag of een andere valuta: er gebeurt niets met het geld, er komt een verschilzaak' };
  }

  return { stemAf, vooruitblik, ECHT };
};
