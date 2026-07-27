/* Métier (deelmodule): de loonspiegel.

   DEZE RONDE: wat elders achter een betaalmuur zit, zit hier in de pas. Op
   LinkedIn heet dit "Salary insights" en kost het geld. Wij geven het weg, en
   wel aan de kant die het het hardst nodig heeft: wie werkt of gaat solliciteren.

   Wat het is: wat betaalt dit vak echt, gemeten aan de uurlonen die RTG-zaken
   zelf in hun loonrun gebruiken (kern/bank/zakelijk.js, `settings.uurloon`) --
   geen enquete, geen zelfrapportage, geen schatting.

   Drie regels, en die zijn niet onderhandelbaar:

   1. EEN DREMPEL, ANDERS NIETS. Onder de vijf zaken tonen we geen cijfer. Bij
      drie zaken is een "gemiddelde" gewoon een omweg naar het loon van een
      herkenbare werkgever, en dat is bedrijfsgegeven noch van ons om te delen.
      Bij te weinig zaken zeggen we dat eerlijk: geen getal, geen bandbreedte.
   2. GEEN ZAAKNAMEN, GEEN PERSONEN. Je ziet de mediaan en de middenband
      (p25-p75). Niet de hoogste, niet de laagste -- die twee wijzen altijd naar
      een aanwijsbare werkgever.
   3. NAAST HET CIJFER STAAT DE WET. Het wettelijk minimumuurloon van het land
      (kern/fiscaal/landen.js) staat ernaast, zodat een bod niet alleen met de
      markt maar ook met de ondergrens te vergelijken is. Dat is precies het
      stuk dat een loonsite je nooit gratis geeft.

   Wat hier NIET komt: "jij verdient minder dan 68% van je vakgenoten". Een
   spiegel mag informeren, niet porren. */
const { LANDEN } = require('../fiscaal/landen');

const DREMPEL = 5;            // minder zaken in een vak = geen cijfer
const UUR_STANDAARD = 16;     // hetzelfde vangnet als de loonrun gebruikt
const UREN_MAAND = 165;       // ~38 uur per week, om een maandbedrag te duiden

// De vakken zoals ze in de zaakgegevens staan, met een nette naam ervoor.
const VAKKEN = {
  hotel: 'Hotel', restaurant: 'Restaurant', bar: 'Bar en club', apartment: 'Verhuur en appartementen',
  taxi: 'Vervoer', jet: 'Luchtvaart', zorg: 'Zorg en wellness', retail: 'Winkel', boerderij: 'Land en teelt',
  activiteit: 'Activiteiten', vastgoed: 'Vastgoed', zzp: 'Zelfstandigen', vakwerk: 'Vakwerk en techniek',
  bouw: 'Bouw en installatie'
};

module.exports = ({ db }) => {

  const zaken = () => Array.isArray(db.data.suppliers) ? db.data.suppliers : [];
  const uurloonVan = (s) => {
    const n = Number((s.settings || {}).uurloon);
    return Number.isFinite(n) && n > 0 ? n : UUR_STANDAARD;
  };

  /* De middenband. Bewust p25/p75 en niet min/max: bij een kleine groep zijn de
     uiteinden herleidbaar tot een zaak, de middenband niet. */
  function band(getallen) {
    const g = [...getallen].sort((a, b) => a - b);
    const bij = (q) => g[Math.min(g.length - 1, Math.max(0, Math.round(q * (g.length - 1))))];
    return { midden: bij(0.5), laag: bij(0.25), hoog: bij(0.75) };
  }

  const rond = (n) => Math.round(n * 100) / 100;

  /* Een vak, eventueel binnen een land. Geeft ofwel cijfers, ofwel een eerlijk
     "te weinig zaken" -- nooit een getal dat op een handvol werkgevers rust. */
  function vak(soort, land) {
    const s = String(soort || '').toLowerCase();
    const L = land ? String(land).toUpperCase() : null;
    const groep = zaken().filter(z => z && String(z.type || '').toLowerCase() === s && (!L || String(z.country || 'NL').toUpperCase() === L));
    const naam = VAKKEN[s] || (s ? s[0].toUpperCase() + s.slice(1) : 'Onbekend vak');
    const wet = L && LANDEN[L] ? { land: LANDEN[L].naam, minimum: LANDEN[L].uurloonMin } : null;

    if (groep.length < DREMPEL) {
      return { ok: true, vak: s, vakNaam: naam, zaken: groep.length, genoeg: false, wet,
        uitleg: 'Er zijn nog te weinig zaken in dit vak om een cijfer te tonen zonder dat het naar een herkenbare werkgever wijst. Vanaf ' + DREMPEL + ' zaken staat het hier.' };
    }
    const b = band(groep.map(uurloonVan));
    return { ok: true, vak: s, vakNaam: naam, zaken: groep.length, genoeg: true, wet,
      uur: { midden: rond(b.midden), laag: rond(b.laag), hoog: rond(b.hoog) },
      maand: { midden: Math.round(b.midden * UREN_MAAND), laag: Math.round(b.laag * UREN_MAAND), hoog: Math.round(b.hoog * UREN_MAAND) },
      urenPerMaand: UREN_MAAND,
      uitleg: 'Bruto per uur, gemeten aan de loonrun van ' + groep.length + ' zaken in dit vak. Het maandbedrag is dat uurloon maal ' + UREN_MAAND + ' uur; wat je netto overhoudt hangt af van je land en je situatie.' };
  }

  /* Het overzicht: alle vakken die de drempel halen, aflopend op mediaan. Wie
     een bewezen rol heeft, ziet zijn eigen vak vooraan -- dat is de enige
     persoonlijke draai, en er zit geen vergelijking met collega's in. */
  function spiegel(land, eigenVak) {
    const L = land ? String(land).toUpperCase() : null;
    const rijen = Object.keys(VAKKEN).map(s => vak(s, L)).filter(r => r.genoeg);
    rijen.sort((a, b) => b.uur.midden - a.uur.midden);
    const eigen = eigenVak ? vak(eigenVak, L) : null;
    /* Alle vakken bij naam, ook die de drempel niet halen. Niet om cijfers te
       tonen -- die staan er niet bij -- maar zodat de toets hieronder altijd
       een vak te kiezen heeft. De wettelijke ondergrens werkt namelijk wel,
       ook als er nog te weinig zaken zijn om een markt te tonen. */
    const alle = Object.keys(VAKKEN).map(s => ({ vak: s, vakNaam: VAKKEN[s] }));
    return { ok: true, land: L, wet: (L && LANDEN[L]) ? { land: LANDEN[L].naam, minimum: LANDEN[L].uurloonMin } : null,
      drempel: DREMPEL, eigen, vakken: rijen, alleVakken: alle,
      uitleg: rijen.length ? 'Dit zijn echte uurlonen uit de loonrun van RTG-zaken, niet wat iemand zegt te verdienen. Vakken met minder dan ' + DREMPEL + ' zaken staan er bewust niet bij.'
        : 'Er zijn nog te weinig zaken per vak om cijfers te tonen zonder een werkgever aan te wijzen.' };
  }

  /* Een concreet bod tegen de spiegel houden. Geen oordeel over de werkgever en
     geen onderhandelingstruc; alleen: dit is waar je bod staat, en dit is de
     wettelijke ondergrens. */
  function toets(soort, land, uurloon) {
    const n = Number(uurloon);
    if (!Number.isFinite(n) || n <= 0) return { error: 'Vul een uurloon in.' };
    const r = vak(soort, land);
    /* Het maandbedrag staat er ALTIJD, ook zonder markt: het is een rekensom op
       jouw eigen bod en hangt van geen enkele andere zaak af. */
    const uit = { ok: true, uurloon: rond(n), vakNaam: r.vakNaam, zaken: r.zaken, wet: r.wet,
      perMaand: Math.round(n * UREN_MAAND), urenPerMaand: UREN_MAAND, punten: [] };
    if (r.wet && n < r.wet.minimum) {
      uit.punten.push('Dit ligt onder het wettelijk minimumuurloon van ' + r.wet.land + ' (€ ' + r.wet.minimum + '). Dat mag niet, ongeacht wat er verder is afgesproken.');
    } else if (r.wet) {
      uit.punten.push('Boven het wettelijk minimum van ' + r.wet.land + ' (€ ' + r.wet.minimum + ').');
    }
    if (!r.genoeg) {
      uit.punten.push('Voor dit vak zijn er nog te weinig zaken om het bod tegen de markt te leggen.');
    } else {
      uit.midden = r.uur.midden;
      if (n < r.uur.laag) uit.punten.push('Onder de middenband van dit vak (€ ' + r.uur.laag + ' tot € ' + r.uur.hoog + ', midden € ' + r.uur.midden + ').');
      else if (n > r.uur.hoog) uit.punten.push('Boven de middenband van dit vak (€ ' + r.uur.laag + ' tot € ' + r.uur.hoog + ').');
      else uit.punten.push('Binnen de middenband van dit vak (€ ' + r.uur.laag + ' tot € ' + r.uur.hoog + ', midden € ' + r.uur.midden + ').');
    }
    return uit;
  }

  return { vak, spiegel, toets, VAKKEN, DREMPEL };
};
