/* DE PRE-FLIGHT: wat gebeurt er als ik dit doe.

   Dit huis controleert veel, en het controleert het op het juiste moment: de
   aangifte weigert bij het indienen, de naheffing weigert bij het vaststellen,
   de loonrun weigert bij het definitief maken. Dat is de goede volgorde -- een
   weigering die pas komt als het al is gebeurd, is geen weigering.

   Maar het betekent ook dat de gebruiker het pas hoort NA de klik. Hij vult een
   kenmerk in, drukt op indienen, en krijgt een rode melding dat de cijfers
   inmiddels zijn veranderd. Dat is niet fout, het is alleen laat.

   Deze laag stelt dezelfde vragen VOOR de klik, en geeft er een van drie
   antwoorden op:

     GO      alles wat wij kunnen nagaan, staat goed
     REVIEW  het kan, maar er is iets dat een mens moet zien
     BLOCK   dit gaat niet, en waarom

   DE HARDE REGEL VAN DIT BESTAND: het controleert NIETS zelf. Elke uitslag komt
   uit een routine die de handeling straks ook aanroept -- de zekerheidsklassen
   (./zekerheid.js), het ogenregister (../ogen.js), de btw-telling
   (./btwtelling.js). Een pre-flight met eigen controles is een tweede waarheid
   naast de echte, en die twee gaan uit elkaar lopen op precies het moment dat
   het ertoe doet: dan zegt het scherm GO en weigert de server.

   Wat dus ONMOGELIJK is en met opzet zo blijft: een GO afgeven waar de
   handeling zelf zou weigeren, zonder dat iemand die weigering hier heeft
   nagebouwd. Er staat hier geen enkele `if` over een fiscale regel. */
'use strict';

const { zekerheid } = require('./zekerheid');
const { eist } = require('../ogen');
const { maakBtwTelling } = require('./btwtelling');

const ZWAARSTE = { BLOCK: 0, REVIEW: 1, GO: 2 };
const slechtste = (a, b) => (ZWAARSTE[a] <= ZWAARSTE[b] ? a : b);

function maakPreflight({ db, btwAangifte }) {
  const { telFacturen } = maakBtwTelling({ db });

  /* ---- de twee poorten die voor ELKE handeling gelden ---- */

  /* 1. De zekerheidsklasse. `voorbehouden` betekent NIET VANZELF en niet NOOIT
        -- de klasse heet PROHIBITED_AUTOMATION, en dat gaat over de software en
        niet over de mens. Een inspecteur die een naheffing vaststelt doet
        precies wat de bedoeling is; wat niet mag is dat er een knop bestaat die
        het zonder hem doet.

        Dus: zonder mens erop is het BLOCK ("dit gebeurt niet vanzelf"), met een
        mens erop is het REVIEW. Dat onderscheid stond er eerst niet in, en toen
        blokkeerde deze poort de handeling die juist wel mag. */
  function klassepoort(sleutel, ctx) {
    const z = zekerheid(sleutel);
    const mens = Array.isArray(ctx.getekendDoor) && ctx.getekendDoor.filter(Boolean).length > 0;
    if (z.klasse === 'voorbehouden')
      return mens
        ? { uitslag: 'REVIEW', bron: 'zekerheid', klasse: z.klasse,
            reden: 'Dit gaat nooit vanzelf: ' + z.waarom }
        : { uitslag: 'BLOCK', bron: 'zekerheid', reden: z.waarom, klasse: z.klasse };
    if (z.klasse === 'advies')
      return { uitslag: 'REVIEW', bron: 'zekerheid', klasse: z.klasse,
        reden: 'Deze uitkomst is advies: wij rekenen voor, een mens met vakkennis beoordeelt.' };
    return { uitslag: 'GO', bron: 'zekerheid', klasse: z.klasse, reden: z.waarom };
  }

  /* 2. De ogen. Hoeveel handtekeningen vraagt deze handeling bij DIT bedrag, en
        hoeveel staan er. Te weinig is geen fout maar werk dat nog moet
        gebeuren -- vandaar REVIEW en geen BLOCK. */
  function ogenpoort(sleutel, ctx) {
    const e = eist(sleutel, { bedragCenten: ctx.bedragCenten });
    if (!e.bekend || e.ogen === null)
      return { uitslag: 'GO', bron: 'ogen', reden: e.let, ogen: null };
    const gezet = Array.isArray(ctx.getekendDoor) ? ctx.getekendDoor.filter(Boolean).length : 0;
    const nodig = e.ogen / 2;
    if (gezet >= nodig)
      return { uitslag: 'GO', bron: 'ogen', ogen: e.ogen, nodig, gezet,
        reden: 'De handtekeningen zijn er (' + gezet + ' van ' + nodig + ').' };
    return { uitslag: 'REVIEW', bron: 'ogen', ogen: e.ogen, nodig, gezet, grond: e.grond,
      reden: 'Deze handeling vraagt ' + nodig + ' handtekeningen (' + e.grond + '); er ' +
        (gezet === 1 ? 'is er 1' : 'zijn er ' + gezet) + '.' };
  }

  /* ---- de handelingen, elk met een droogloop op de ECHTE routine ---- */
  const DROOGLOOP = {
    /* Indienen vastleggen. De twee dingen die `btwAangifte.dienIn` straks
       weigert: een periode die nog loopt, en cijfers die sinds het opmaken zijn
       veranderd. Het hertellen gebeurt met telFacturen -- dezelfde routine die
       dienIn zelf gebruikt, dus dit KAN niet iets anders zeggen. */
    'btw.indienen': (ctx) => {
      const a = ctx.aangifte;
      if (!a) return { uitslag: 'BLOCK', bron: 'aangifte', reden: 'Er is geen aangifte om in te dienen.' };
      if (a.stand === 'ingediend')
        return { uitslag: 'BLOCK', bron: 'aangifte', reden: 'Deze aangifte is al ingediend op ' + a.ingediendOp + '.' };
      const vandaag = String(ctx.vandaag || new Date().toISOString().slice(0, 10));
      if (a.tot >= vandaag)
        return { uitslag: 'BLOCK', bron: 'aangifte',
          reden: 'De periode loopt nog tot en met ' + a.tot + '; indienen kan pas als hij voorbij is.' };
      const t = telFacturen(a.code, { van: a.van, tot: a.tot });
      if (t.verkoopSom !== a.verschuldigdCenten || t.voorbelasting !== a.voorbelastingCenten)
        return { uitslag: 'BLOCK', bron: 'register',
          reden: 'De cijfers zijn veranderd sinds het opmaken (nu ' + (t.verkoopSom - t.voorbelasting) +
            ' cent, in de aangifte ' + a.saldoCenten + ' cent). Maak de aangifte opnieuw op.' };
      if (!String(ctx.kenmerk || '').trim())
        return { uitslag: 'REVIEW', bron: 'aangifte',
          reden: 'Zonder het kenmerk van de Belastingdienst is "ingediend" een bewering zonder bewijs.' };
      return { uitslag: 'GO', bron: 'register', reden: 'De periode is voorbij en de cijfers staan nog gelijk.' };
    },

    /* Vaststellen van een naheffing. De ogenpoort doet hier het meeste werk (en
       kent sinds kort de bedrag-drempel); wat hier bij komt is de stand. */
    'naheffing.vaststellen': (ctx) => {
      const n = ctx.naheffing;
      if (!n) return { uitslag: 'BLOCK', bron: 'naheffing', reden: 'Er is geen naheffing om vast te stellen.' };
      if (n.status !== 'concept')
        return { uitslag: 'BLOCK', bron: 'naheffing', reden: 'Deze naheffing is al ' + n.status + '.' };
      return { uitslag: 'GO', bron: 'naheffing', reden: 'De naheffing staat op concept.' };
    }
  };

  /* ---- de keuring ---- */
  /* Geeft ALLE redenen terug en niet alleen de zwaarste. Wie een BLOCK krijgt
     wil weten wat er verder nog staat te wachten; anders lost hij het eerste op
     en loopt hij tegen het tweede aan. */
  function keur(sleutel, context) {
    const ctx = context || {};
    const stappen = [klassepoort(sleutel, ctx), ogenpoort(sleutel, ctx)];
    const droog = DROOGLOOP[sleutel];
    if (droog) stappen.push(droog(ctx));
    else stappen.push({ uitslag: 'REVIEW', bron: 'droogloop',
      reden: 'Voor deze handeling is geen droogloop ingericht; er is dus niet nagegaan wat er straks gebeurt.' });

    const uitslag = stappen.reduce((u, s) => slechtste(u, s.uitslag), 'GO');
    return { sleutel, uitslag, stappen,
      redenen: stappen.filter(s => s.uitslag !== 'GO').map(s => s.reden),
      let: uitslag === 'GO'
        ? 'Alles wat vooraf na te gaan is, staat goed. Dat is geen garantie: de handeling controleert zelf opnieuw.'
        : 'Dit is wat er vooraf na te gaan was. De handeling zelf controleert het straks opnieuw.' };
  }

  return { preflight: { keur, handelingen: () => Object.keys(DROOGLOOP) } };
}

module.exports = { maakPreflight };
