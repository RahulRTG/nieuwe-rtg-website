/* Overheid-domein "naheffing": DE NAHEFFINGSAANSLAG OMZETBELASTING.

   Het toezicht (./btwtoezicht.js) wijst aan; hier wordt er iets van gevonden.
   Dat is een besluit met rechtsgevolg, en dus staat er meer omheen dan om een
   lijstje.

   HET IS EEN NAHEFFING EN GEEN NAVORDERING. Btw is een aangiftebelasting: je
   berekent en betaalt hem zelf, en wat er niet is betaald wordt NAGEHEVEN
   (art. 20 AWR). Navordering hoort bij een aanslagbelasting zoals de
   inkomstenbelasting, waar de inspecteur eerst zelf een aanslag oplegt. De twee
   door elkaar halen is geen woordenspel: het zijn andere bevoegdheden met
   andere termijnen.

   HET BEDRAG WORDT NIET GETYPT. Het komt uit de aansluiting: wat er is
   gefactureerd min wat er is aangegeven. Een naheffing met een invulveld is een
   tweede berekening naast het register, en dan gaat de discussie over het getal
   in plaats van over de feiten. Vindt de inspecteur het getal onjuist, dan
   kloppen de facturen niet -- en dat is een ander gesprek dan dit.

   VIER OGEN, en dezelfde ogen tellen nooit dubbel (net als kern/uitgifte.js):
   wie hem opmaakt stelt hem niet vast. De derde ogen op het bezwaar staan in
   ./naheffing-daarna.js.

   DE BOETE IS NOOIT AUTOMATISCH. Geen enkele stand levert er zelf een op; een
   mens zet een percentage en schrijft erbij waarom. Zonder grond geen boete.

   BETALEN IS EEN ECHTE BOEKING, en staat in ./naheffing-betalen.js: van de
   zakelijke rekening van de zaak naar `extern:belastingdienst`, in het grootboek
   van RTG Bank. 'Vastgesteld' betekent hier dus niet 'betaald' -- dat is een
   eigen veld dat pas wordt gezet als het geld ECHT is geboekt. Wat er nog steeds
   niet is: aanmanen en invorderen.

   Krijgt de gedeelde ctx van kern/overheid/index.js. */
'use strict';

const { zelfdeOgen } = require('../ogen');

/* De verzuimboete (art. 67c AWR) heeft een wettelijk maximum. Dit is een
   demo-benadering met een peiljaar, net als de IB-schijven in ./index.js: werk
   hem bij als het bedrag verandert, en vertrouw hem niet als fiscaal advies. */
const BOETE_MAX_CENTEN = 546000;
const BOETE_MAX_PCT = 100;
const BETAALTERMIJN_DAGEN = 14;

module.exports = (ctx) => {
  const { db, save, crypto, nu, ref, schoon, notifySupplier, bdBtwAansluiting } = ctx;
  const euro = (centen) => (centen / 100).toFixed(2).replace('.', ',');

  const eigen = require('../eigencollectie')({ db, domein: 'kern/overheid/naheffing', bezit: { rijkNaheffingen: 'lijst' } });
  const bak = () => eigen.bak('rijkNaheffingen');
  const vind = (id) => bak().find(n => n.id === String(id || '')) || null;
  /* Dezelfde ogen tellen niet dubbel -- de vergelijking staat in kern/ogen.js
     en niet meer hier. Hij stond op vier plekken in huis en liep uiteen: de
     ene trimde de naam, de andere niet, en dan tekent "A. Bakker " zijn eigen
     besluit af. Reist via de ctx door naar ./naheffing-daarna.js en
     ./naheffing-invordering.js, die hem daar al vandaan haalden. */
  const gelijk = zelfdeOgen;
  const { publiek } = require('./naheffing-vorm')();

  /* Wat er over een periode bij een zaak valt na te heffen, uit de aansluiting
     en nergens anders vandaan. Geeft de reden mee waarom er wel of niets is. */
  function teHeffen(periode, code) {
    const r = bdBtwAansluiting(periode);
    if (r.error) return r;
    if (r.periodeLoopt) return { status: 409,
      error: 'Over ' + r.periode + ' loopt de periode nog; er is nog niets te laat.' };
    const z = (r.zaken || []).find(x => x.code === String(code || '').toUpperCase());
    if (!z) return { status: 404, error: 'Deze zaak heeft over ' + r.periode + ' niets gefactureerd en niets aangegeven.' };
    const aangegeven = z.aangegevenBtwCenten || 0;
    const verschil = z.geteldBtwCenten - aangegeven;
    if (verschil <= 0) return { status: 409, error: z.aangegevenBtwCenten == null
      ? 'Er is over ' + r.periode + ' niets gefactureerd; er valt niets na te heffen.'
      : 'Er is over ' + r.periode + ' niet te weinig aangegeven; een te hoge aangifte zet de ondernemer zelf recht met een correctie.' };
    return { ok: true, zaak: z, periode: r.periode, verschil, aangegeven };
  }

  /* ---- opmaken ---- */
  function naheffingMaak(periode, code, door, opties) {
    opties = opties || {};
    if (!door) return { status: 400, error: 'Een naheffing staat altijd op naam van de inspecteur die hem opmaakt.' };
    const t = teHeffen(periode, code);
    if (t.error) return t;
    const zaakCode = t.zaak.code;

    const lopend = bak().find(n => n.code === zaakCode && n.periode === t.periode &&
      ['concept', 'vastgesteld', 'bezwaar', 'gehandhaafd'].includes(n.status));
    if (lopend) return { status: 409, error: 'Er loopt al een naheffing over ' + t.periode +
      ' voor deze zaak (' + lopend.kenmerk + ', ' + lopend.status + ').' };

    /* De boete: alleen als een mens hem zet, en dan met een grond erbij. */
    const pct = Math.max(0, Math.min(BOETE_MAX_PCT, Number(opties.boetePct) || 0));
    const grond = schoon(opties.boeteGrond, 300);
    if (pct > 0 && grond.length < 6) return { status: 400,
      error: 'Een boete zonder grond bestaat niet. Schrijf op waarom u hem oplegt.' };
    const boete = Math.min(BOETE_MAX_CENTEN, Math.round(t.verschil * pct / 100));

    const n = { id: 'nh' + crypto.randomBytes(4).toString('hex'), kenmerk: ref('NH'),
      code: zaakCode, zaak: t.zaak.naam, periode: t.periode,
      grondslagCenten: t.zaak.grondslagCenten, geteldCenten: t.zaak.geteldBtwCenten,
      aangegevenCenten: t.zaak.aangegevenBtwCenten, naheffingCenten: t.verschil,
      boetePct: pct, boeteCenten: boete, boeteGrond: pct > 0 ? grond : null,
      aanleiding: t.zaak.stand, status: 'concept',
      opgemaaktDoor: schoon(door, 60), opgemaaktOp: nu() };
    bak().unshift(n);
    if (bak().length > 20000) bak().length = 20000;
    save();
    return { ok: true, naheffing: publiek(n) };
  }

  /* ---- vaststellen: de tweede ogen ---- */
  function naheffingStelVast(id, door) {
    const n = vind(id);
    if (!n) return { status: 404, error: 'Deze naheffing kennen we niet.' };
    if (n.status !== 'concept') return { status: 409, error: 'Deze naheffing is al ' + n.status + '.' };
    const wie = schoon(door, 60);
    if (wie.length < 2) return { status: 400, error: 'Vaststellen gebeurt altijd op naam.' };
    if (gelijk(wie, n.opgemaaktDoor)) return { status: 409,
      error: 'Dezelfde ogen tellen niet dubbel: een ANDERE inspecteur stelt deze naheffing vast.' };

    /* Hertellen, net als bij het indienen van een aangifte. Tussen opmaken en
       vaststellen kan de zaak alsnog hebben aangegeven of gecorrigeerd -- en dan
       een besluit tekenen op oude cijfers is een verkeerd besluit met een
       handtekening eronder. */
    const t = teHeffen(n.periode, n.code);
    if (t.error) return { status: 409, error: 'De cijfers zijn veranderd sinds het opmaken: ' + t.error +
      ' Maak de naheffing opnieuw op.' };
    if (t.verschil !== n.naheffingCenten) return { status: 409,
      error: 'De cijfers zijn veranderd sinds het opmaken (nu € ' + euro(t.verschil) + ', in de naheffing € ' +
        euro(n.naheffingCenten) + '). Maak de naheffing opnieuw op.' };

    n.status = 'vastgesteld'; n.vastgesteldDoor = wie; n.vastgesteldOp = nu();
    n.vervaltOp = new Date(Date.parse(n.vastgesteldOp) + BETAALTERMIJN_DAGEN * 86400000).toISOString().slice(0, 10);
    save();
    /* Pas NU hoort de zaak ervan. Een concept is een gedachte van het kantoor;
       bekendmaken doe je een besluit. */
    if (notifySupplier) notifySupplier(n.code, { icon: 'overheid', title: 'Naheffingsaanslag omzetbelasting',
      body: n.kenmerk + ' over ' + n.periode + ': € ' + euro(n.naheffingCenten + n.boeteCenten) +
        '. Bezwaar kan tot ' + n.vervaltOp + '.', scope: 'overheid' });
    return { ok: true, naheffing: publiek(n),
      let: 'Vastgesteld en bekendgemaakt aan de zaak. Er is niets geind: de invordering is een eigen stap.' };
  }

  /* Alles wat er NA het opmaken met een naheffing gebeurt -- intrekken,
     bezwaar, het besluit daarop en het teruglezen -- woont in
     ./naheffing-daarna.js. De opslag gaat mee zodat er maar EEN is. */
  /* Betalen en terugbetalen staan apart, want daar beweegt echt geld en dat is
     een ander soort code dan een besluit vastleggen. ./naheffing-daarna.js
     gebruikt de terugbetaling bij een toegewezen bezwaar. */
  const deelBetalen = require('./naheffing-betalen')(ctx, { vind, publiek });
  /* De invordering leunt op de betaalweg (dezelfde rekening, dezelfde
     tegenrekening) en gaat er dus achteraan. */
  const deelInvordering = require('./naheffing-invordering')(Object.assign({}, ctx,
    { rekeningVan: deelBetalen.rekeningVan, TEGENREKENING: deelBetalen.NAHEFFING_TEGENREKENING }),
    { vind, publiek, gelijk, teBetalen: (n) => n.naheffingCenten + n.boeteCenten + (n.kostenCenten || 0) });
  const deelDaarna = require('./naheffing-daarna')(ctx, { bak, vind, publiek, gelijk,
    naheffingTerugbetaal: deelBetalen.naheffingTerugbetaal });

  return Object.assign({ naheffingMaak, naheffingStelVast, BOETE_MAX_CENTEN },
    deelBetalen, deelInvordering, deelDaarna);
};
