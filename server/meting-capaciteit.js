/* ============================================================================
   DE METING PER CAPABILITY -- en waarom een platformcijfer voor een klant
   bijna altijd het verkeerde cijfer is.

   HET PROBLEEM DAT DIT OPLOST. De tenantstand (kern/tenant/bewijs.js) draagt
   met opzet GEEN beschikbaarheidsgetal, met de reden: de meting is
   platformbreed, dus een storing in een onderdeel dat een klant niet gebruikt
   zou als ZIJN storing verschijnen. Dat is een echte reden en geen
   voorzichtigheid -- de rekentoets is simpel: valt de kassakoppeling van de
   horeca om, dan zakt het platformcijfer, en een advocatenkantoor dat alleen
   contracten en uren gebruikt ziet zijn beschikbaarheid dalen door iets wat
   hij nooit heeft aangeraakt.

   WAT HIER GEBEURT. De meting telt al per ROUTEPATROON (server/meting.js), en
   de boardroom weet al welke functie bij welk pad hoort
   (functies.functieVoorPad -- dezelfde kaart waarmee een eigenaar een functie
   kan uitzetten). Die twee waren er allebei en waren nooit aan elkaar geknoopt.
   Meer dan dat is het niet: er komt geen tweede telling en geen tweede
   catalogus bij.

   DRIE REGELS

   1. EEN PERCENTAGE OVER DRIE VERZOEKEN IS GEEN METING. Onder de vloer komt er
      `foutpercentage: null` met de reden, en niet een geruststellende 0,0%.
      Nul fouten op drie verzoeken zegt niets, en het ziet er groener uit dan
      elk echt cijfer.
   2. WAT GEEN FUNCTIE HEEFT, VERDWIJNT NIET. Routes die de catalogus niet kent
      (de bestuurslaag, health, metrics, en alles wat als `(onbekend)` binnenkomt)
      landen in een eigen regel MET die naam. Ze stilletjes weglaten zou het
      totaal laten kloppen terwijl er iets ontbreekt.
   3. HET VENSTER STAAT ERBIJ. De meting zit in het geheugen van dit proces en
      begint bij een herstart opnieuw. Dat hoort zo (zie meting.js), maar het
      betekent dat dit GEEN maandcijfer is -- en dus mag het ook niet als
      zodanig op een scherm komen.
   ========================================================================== */
'use strict';
const { nu: klokNu } = require('./lib/klok');

/* Onder dit aantal verzoeken in het venster geven we geen percentage. Vijftig:
   laag genoeg dat een rustige capability toch een cijfer krijgt, hoog genoeg
   dat één toevallige 500 hem niet op 33% zet. */
const VLOER = 50;

const ZONDER = { id: '(geen functie)', naam: 'Buiten de functiecatalogus',
  reden: 'Deze routes horen tot de bestuurslaag of tot de infrastructuur (health, metrics) en staan met reden niet onder een functie.' };

/* `reeksenVan` en `functieVoorPad` komen binnen als functie, niet als waarde:
   dan is deze module los te toetsen zonder server en zonder catalogus. */
function meet(reeksen, functieVoorPad) {
  const per = new Map();
  const pak = (id, naam) => {
    if (!per.has(id)) per.set(id, { id, naam, verzoeken: 0, fouten5xx: 0, clientfouten4xx: 0, routes: new Set() });
    return per.get(id);
  };

  for (const r of (reeksen && reeksen.verzoeken) || []) {
    let f = null;
    /* Een route die niet met /api begint of die als `(onbekend)` binnenkwam,
       hoeft de catalogus niet eens te bevragen. */
    if (r.route && r.route.charAt(0) === '/') {
      try { f = functieVoorPad(r.route); } catch (e) { f = null; }
    }
    const rij = f ? pak(f.id, f.naam) : pak(ZONDER.id, ZONDER.naam);
    rij.verzoeken += r.aantal;
    if (r.status === '5xx') rij.fouten5xx += r.aantal;
    if (r.status === '4xx') rij.clientfouten4xx += r.aantal;
    rij.routes.add(r.route);
  }

  const uit = [...per.values()].map(x => {
    const genoeg = x.verzoeken >= VLOER;
    return {
      id: x.id, naam: x.naam, verzoeken: x.verzoeken, routes: x.routes.size,
      fouten5xx: x.fouten5xx, clientfouten4xx: x.clientfouten4xx,
      /* REGEL 1. Geen percentage zonder grond, en de reden staat erbij zodat
         een leeg veld niet als "nul fouten" leest. */
      foutpercentage: genoeg ? Number((x.fouten5xx / x.verzoeken * 100).toFixed(3)) : null,
      nietGemeten: genoeg ? null : 'te weinig verzoeken in dit venster (' + x.verzoeken + ' van de ' + VLOER +
        ' die nodig zijn); een percentage hierover zou groener lezen dan het is'
    };
  });
  /* De drukste eerst: dat is de volgorde waarin iemand kijkt. */
  uit.sort((a, b) => b.verzoeken - a.verzoeken);
  return uit;
}

/* De hele stand, met het venster erbij. Zonder dat venster is elk getal hier
   een bewering zonder tijdsaanduiding, en dat is precies de vorm waarin een
   cijfer meer belooft dan het waarmaakt. */
function stand(meting, functies) {
  const reeksen = meting.reeksen();
  const capabilities = meet(reeksen, functies.functieVoorPad);
  const totaal = capabilities.reduce((n, c) => n + c.verzoeken, 0);
  return {
    venster: {
      sinds: new Date(reeksen.gestart).toISOString(),
      seconden: Math.round((klokNu() - reeksen.gestart) / 1000),
      let: 'De meting zit in het geheugen van dit proces en begint bij een herstart opnieuw. Dit is dus geen maandcijfer en mag ook niet zo gelezen worden.'
    },
    vloer: VLOER,
    verzoeken: totaal,
    capabilities,
    nietGemeten: [
      { wat: 'per organisatie', reden: 'De telling gaat per routepatroon en draagt geen tenant. Wie dat wil, moet elke aanroep aan een organisatie knopen -- en dat is precies het soort veld dat in een metrics-endpoint niet thuishoort.' },
      { wat: 'over een langere periode', reden: 'Er is geen opslag van deze cijfers over processtarts heen; Prometheus rekent de verschillen, wij bewaren ze niet.' }
    ]
  };
}

module.exports = { meet, stand, VLOER, ZONDER };
