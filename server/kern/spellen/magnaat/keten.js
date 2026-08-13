/* Magnaat: SUPPLY NETWORK v1 -- niets wordt verbruikt zonder bron.

   ================== WAT ER VERANDERT ==================

   Tot nu toe kocht een zaak geen goederen; hij had een INKOOPPOST. Een
   percentage van zijn eigen omzet dat nergens vandaan kwam en nergens heen
   ging. `scripts/magnaat-oorsprong.js` mat dat: 59% van de inkoop KON uit de
   stad komen en 0% liep er werkelijk doorheen. De keten bestond als
   mogelijkheid en niet als structuur -- en zolang dat zo is, raakt een
   leverancier die omvalt niemand.

   Vanaf hier geldt de wet uit ECONOMIE.md:

     **Een zaak mag alleen verbruiken wat ergens geproduceerd, ingevoerd,
     opgeslagen of geleverd is.**

   ================== EN HET IS GEEN NIEUWE POST ==================

   DIT IS DE BELANGRIJKSTE ONTWERPKEUZE VAN DIT BESTAND. De inkoopsom blijft
   precies wat hij was (./stap.js); wat verandert is WAAR HIJ HEEN GAAT. Dat is
   dezelfde vorm als `derving`: een uitsnede en geen extra rekening. Een
   economie die anders gaat rekenen zodra er een laag bijkomt, is twee
   economieen -- en dan is elke ijking uit fase A onbruikbaar.

   Het loopt daarom door de machinerie die er AL is en die al getoetst is:
   ./handel.js kent `toezegging` (capaciteit die een leverancier kwijt is) en
   `ontvangst` (wat een afnemer binnenkrijgt), en ./stap.js trekt de gedekte
   inkoop er via `dekking` netjes af. Een spotlevering is in die termen niets
   anders dan **een contract dat niemand hoefde te onderhandelen.**

   ================== DE BUITENWERELD IS EEN ACTOR ==================

   IJmuiden is een stad en geen wereld. Wat er niet lokaal geleverd wordt komt
   van BUITEN, en dat heet dan ook zo. Het aardige is dat die import geen enkel
   nieuw geldmechaniek nodig heeft: import is precies wat de inkooppost altijd
   al WAS -- geld dat de wereld verlaat zonder tegenpartij. De marktprijs
   (./handelsgoed.js) is dus de WERELDPRIJS, en die is meteen het plafond van de
   lokale markt: niemand betaalt lokaal meer dan invoeren kost.

   Daarmee komt de prijs uit de STRUCTUUR en niet uit een constante. Geen
   `scarcityBonus = +15%`; er is een bovengrens die betekenis heeft.

   ================== VERDELEN BIJ SCHAARSTE ==================

   Vraag boven aanbod? Dan krijgt niet iedereen alles. De verdeling is PRO RATA
   en niet "wie het eerst komt", om exact dezelfde reden waarom ./maand.js dat
   bij contracten al zo doet: anders bepaalt de volgorde in een object wie er
   omvalt.

   EN DAAR KRIJGT EEN CONTRACT ZIJN ECHTE WAARDE. Contracten worden VOOR deze
   verdeling afgewikkeld en leggen beslag op capaciteit; wat hier verdeeld wordt
   is wat er daarna nog over is. Een contract is dus geen korting maar
   VOORRANG -- tijdens schaarste krijg jij geleverd en je concurrent niet. Dat
   is de belofte uit ECONOMIE.md: contracten beinvloeden toegang, niet magisch
   rendement.

   ================== WAT ER NOG NIET IS ==================

   Met zoveel woorden, want een half gebouwde laag die eruitziet als een hele is
   erger dan een ontbrekende: LEVERTIJD (een bestelling is er meteen), VOORRAAD
   (er ligt niets ergens), SUBSTITUTIE (geen alternatief product), en
   MEERDERE STEDEN. Die staan in ECONOMIE.md als volgende stappen. */
'use strict';

const HG = require('./handelsgoed');
const { SECTOREN } = require('./sectoren');
const { capaciteit } = require('./maat');

/* WAT LOKAAL KOPEN SCHEELT ten opzichte van invoeren, bij een ruime markt. Geen
   voordeel zou betekenen dat de hele keten er economisch niet toe doet; een
   groot voordeel zou betekenen dat wie toevallig een leverancier in de stad
   heeft gratis geld krijgt. Klein en gemeten (scripts/magnaat-oorsprong.js).

   Hij LOOPT WEG NAARMATE HET KRAPPER WORDT: bij volledige schaarste betaal je
   lokaal precies wat invoeren kost, want dat is je alternatief. De prijs komt
   dus uit de verhouding tussen vraag en aanbod en niet uit een tabel. */
const LOKAAL_VOORDEEL = 0.03;

/* Wat een zaak deze maand nodig heeft, per soort. Op de omzet van VORIGE maand,
   want je bestelt voordat je verkoopt -- en dat is precies het getal waarmee
   ./rush.js zijn eigen raming maakt. Een verse zaak heeft die geschiedenis niet
   en vraagt dus nog niets: hij koopt zijn eerste maand van buiten. */
function behoefteVan(v) {
  const omzet = v.maanden > 0 ? v.omzetTotaal / v.maanden : 0;
  const uit = {};
  for (const soort of HG.HANDELSSOORTEN) {
    const n = HG.behoefte(v, omzet, soort);
    if (n > 0) uit[soort] = n;
  }
  return uit;
}

/* Wat een leverancier deze maand nog KWIJT KAN, in handelseenheden. Zijn
   capaciteit minus wat de contracten er al van hebben opgeeist -- want die
   gingen voor, en dat is de hele waarde van een contract. */
function vrijAanbod(v, arbeid, alToegezegd) {
  const soort = SECTOREN[v.sector].levert;
  if (!soort) return null;
  const vrij = Math.max(0, capaciteit(v, arbeid) - (alToegezegd || 0));
  return vrij > 0 ? { soort, vrij } : null;
}

/* DE MAANDELIJKSE VERDELING. Verandert `toezegging` en `ontvangst` -- dezelfde
   twee objecten waarmee ./maand.js de contracten al doorgeeft -- en geeft een
   SPOOR terug waarmee een scherm of een meter de keten kan teruglezen.

   DE LEVERANCIER WORDT VANZELF BETAALD, want `toezegging[].bedrag` landt in
   ./stap.js als `leverOmzet`. De AFNEMER niet: die kant loopt bij contracten
   door ./maand-contracten.js, en een spotlevering staat daar niet in. `betaal`
   hieronder doet dat, en hij staat in DIT bestand omdat hier de bedragen
   bekend zijn -- een tweede plek die dezelfde som naschrijft, is een tweede
   economie. */
function verdeel(st, { arbeid, toezegging, ontvangst, alleZaken }) {
  const vraag = {}, aanbod = {};
  for (const soort of HG.HANDELSSOORTEN) { vraag[soort] = []; aanbod[soort] = []; }

  for (const { h, v } of alleZaken) {
    /* WAT ER NA DE CONTRACTEN NOG NODIG IS. Wie zich vol getekend heeft vraagt
       hier niets meer, en dat is juist: hij heeft zijn bron al. */
    const heeft = (ontvangst[v.id] || {});
    for (const [soort, n] of Object.entries(behoefteVan(v))) {
      const rest = n - (heeft[soort] || 0);
      if (rest > 0.001) vraag[soort].push({ h, v, eenheden: rest });
    }
    const a = vrijAanbod(v, arbeid, (toezegging[v.id] || {}).eenheden);
    if (a) aanbod[a.soort].push({ h, v, vrij: a.vrij });
  }

  const spoor = { perAfnemer: {}, perLeverancier: {}, prijs: {}, krapte: {} };
  for (const soort of HG.HANDELSSOORTEN) {
    const totVraag = vraag[soort].reduce((n, x) => n + x.eenheden, 0);
    const totAanbod = aanbod[soort].reduce((n, x) => n + x.vrij, 0);
    if (totVraag <= 0) continue;
    /* KRAPTE, en daaruit de prijs. Volledig ruim: het lokale voordeel geldt.
       Volledig krap: je betaalt de wereldprijs, want invoeren is je alternatief
       en niemand betaalt daar lokaal meer dan. */
    const krapte = Math.max(0, Math.min(1, 1 - totAanbod / totVraag));
    const prijs = HG.MARKTPRIJS[soort] * (1 - LOKAAL_VOORDEEL * (1 - krapte));
    spoor.prijs[soort] = prijs;
    spoor.krapte[soort] = krapte;
    if (totAanbod <= 0) {
      /* NIEMAND LEVERT DIT HIER, en dan is "100% van buiten" juist het antwoord
         dat opgeschreven hoort te worden. Een toets vond dat deze tak zweeg:
         het spoor bleef leeg, en een leeg spoor leest als "er is niets
         gekocht" terwijl er alles is ingevoerd. Precies het weggemoffelde dat
         deze laag moest opheffen. */
      for (const a of vraag[soort])
        (spoor.perAfnemer[a.v.id] = spoor.perAfnemer[a.v.id] || {})[soort] =
          { nodig: a.eenheden, lokaal: 0, bedrag: 0, ingevoerd: a.eenheden, prijs };
      continue;
    }

    /* PRO RATA, aan beide kanten. Elke afnemer krijgt hetzelfde DEEL van zijn
       vraag, en elke leverancier levert hetzelfde deel van zijn vrije ruimte.
       Zo bepaalt de volgorde in een object niemands lot. */
    const deel = Math.min(1, totAanbod / totVraag);
    const uitDeel = Math.min(1, totVraag / totAanbod);
    for (const l of aanbod[soort]) {
      const levert = l.vrij * uitDeel;
      if (levert <= 0) continue;
      const t = toezegging[l.v.id] = toezegging[l.v.id] || { eenheden: 0, bedrag: 0 };
      t.eenheden += levert;
      t.bedrag += levert * prijs;
      const ps = spoor.perLeverancier[l.v.id] = spoor.perLeverancier[l.v.id]
        || { naam: l.v.naam, soort, eenheden: 0, bedrag: 0, afnemers: 0 };
      ps.eenheden += levert; ps.bedrag += levert * prijs;
    }
    for (const a of vraag[soort]) {
      const krijgt = a.eenheden * deel;
      const o = ontvangst[a.v.id] = ontvangst[a.v.id] || {};
      o[soort] = (o[soort] || 0) + krijgt;
      const pa = spoor.perAfnemer[a.v.id] = spoor.perAfnemer[a.v.id] || {};
      pa[soort] = { nodig: a.eenheden, lokaal: krijgt, bedrag: krijgt * prijs,
        /* WAT ER VAN BUITEN KOMT staat er MET ZOVEEL WOORDEN. Dat is de hele
           winst van deze laag: niet dat alles lokaal is, maar dat de grens van
           de simulatie zichtbaar is in plaats van weggemoffeld. */
        ingevoerd: a.eenheden - krijgt, prijs };
      for (const l of aanbod[soort])
        if (l.vrij * uitDeel > 0) spoor.perLeverancier[l.v.id].afnemers++;
    }
  }
  return spoor;
}

/* WAT DE AFNEMERS BETALEN, en aan wie. De tegenkant van `leverOmzet`: zonder
   deze stap krijgt een leverancier omzet die niemand heeft uitgegeven, en dan
   maakt deze laag geld -- precies wat scripts/magnaat-pomp.js uitsluit.

   Wat de afnemer hiervoor NIET meer via zijn inkooppost betaalt, regelt
   ./stap.js met `dekking`: die trekt de marktwaarde van het gedekte deel van de
   inkoop af. Wie lokaal koopt betaalt dus de spotprijs in plaats van de
   wereldprijs, en dat verschil IS het lokale voordeel. */
function betaal(st, spoor, eigenaarVan) {
  let totaal = 0;
  for (const [vid, perSoort] of Object.entries(spoor.perAfnemer)) {
    const h = eigenaarVan(vid);
    if (!h) continue;
    for (const x of Object.values(perSoort)) {
      if (!(x.bedrag > 0)) continue;
      st.geld[h] -= x.bedrag;
      totaal += x.bedrag;
    }
  }
  return totaal;
}

module.exports = { LOKAAL_VOORDEEL, behoefteVan, vrijAanbod, verdeel, betaal };
