/* Horeca (kern): het gemeten deel van de pols. Zie ./pols.js voor het geheel
   en voor waarom de drie bronnen gescheiden blijven.

   Hier staat alleen wat wij ZELF uitrekenen uit gegevens die er toch al zijn.
   Geen enkel getal hier is een mening, en elk getal draagt zijn rekensom mee.
   De knip met pols.js loopt precies daar: meten is iets anders dan verzamelen
   wat mensen zeggen.

   DE BELANGRIJKSTE REGEL VAN DIT BESTAND: niets gemeten is niet "rustig". Een
   zaak die haar rekeningen niet via RTG draait, ziet er in de cijfers leeg
   uit. Dat als rust tonen is een verzinsel dat de gast pas voor de deur
   ontdekt. Wat we niet weten komt met de reden in `nietGemeten`. */
'use strict';

const { openWerk, BINNEN } = require('./keukenlaag');

module.exports = ({ horeca, ONDERWERPEN }) => {
  const { H, nu } = horeca;

  return function gemeten(zaakcode) {
    const h = H(zaakcode);
    const rekeningen = Object.values(h.rekeningen || {});
    const vandaag = nu().slice(0, 10);
    const uit = [];
    const geen = [];

    const werk = openWerk(h);
    if (werk.regels) {
      uit.push({ onderwerp: 'wachttijd', naam: ONDERWERPEN.wachttijd.naam, waarde: werk.wachttijd,
        eenheid: 'min', tekst: werk.wachttijd + ' minuten', rekensom: werk.rekensom });
    } else {
      geen.push({ onderwerp: 'wachttijd', waarom: 'Er staat op dit moment niets open in de keuken van deze zaak.' });
    }

    /* Bezetting. De noemer zijn de plekken die de zaak zelf heeft geregistreerd
       (de QR-stickers); heeft ze die niet, dan is er geen noemer en dus geen
       percentage. Een geraden zaalgrootte levert een percentage op dat
       overtuigend oogt en nergens op slaat. */
    const plekken = Object.values((h.instel || {}).qr || {})
      .filter(v => (v.soort || 'tafel') === 'tafel').length;
    const bezet = rekeningen.filter(r => r.status === 'open' && BINNEN.includes(String(r.kanaal || 'tafel'))).length;
    if (plekken) {
      const pct = Math.min(100, Math.round(bezet / plekken * 100));
      uit.push({ onderwerp: 'bezetting', naam: ONDERWERPEN.bezetting.naam, waarde: pct, eenheid: '%',
        tekst: pct + '% bezet', rekensom: bezet + ' van de ' + plekken + ' tafels heeft een open rekening.' });
    } else {
      geen.push({ onderwerp: 'bezetting',
        waarom: rekeningen.some(r => String(r.at || '').slice(0, 10) === vandaag)
          ? 'Deze zaak heeft geen tafels in RTG staan, dus we kunnen niet uitrekenen hoe vol het is.'
          : 'Deze zaak draait vandaag geen rekeningen via RTG, dus hier valt niets te meten.' });
    }

    // de clubdeur telt hoeveel mensen er binnen zijn, nooit wie
    const deur = ((h.club || {}).deur || {})[vandaag];
    if (deur && (deur.in || deur.binnen)) {
      const cap = Math.max(1, (h.club || {}).capaciteit || 300);
      uit.push({ onderwerp: 'deur', naam: 'Mensen binnen', waarde: deur.binnen, eenheid: 'personen',
        tekst: deur.binnen + ' van de ' + cap + ' binnen',
        rekensom: deur.in + ' naar binnen geteld, ' + deur.uit + ' naar buiten.' });
    }

    return { gemeten: uit.map(x => Object.assign(x, { bron: 'gemeten', label: 'gemeten door RTG' })), nietGemeten: geen };
  };
};
