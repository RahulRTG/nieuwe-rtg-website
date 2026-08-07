/* Mobility OS (deelmodule): de TOETS van het zakelijke reisbeleid.

   Afgesplitst van ./reisbeleid.js, dat de grens van 10 KB passeerde. De knip
   loopt langs een echte scheiding en niet zomaar halverwege: hierboven wordt
   het beleid GEZET en GELEZEN, hier wordt een concrete rit ERAAN GEHOUDEN.
   Dat zijn twee vragen met twee lezers -- het scherm van de werkgever tegen
   de boekingsmotor -- en ze veranderen om verschillende redenen. */
'use strict';

// zelfde lijst als in ./reisbeleid.js: de dagnamen komen in het antwoord terug
const DAGNAMEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

module.exports = (ctx) => {
  const { db, schoon, nu, beleidVan, werktBij, beleidBeeld } = ctx;
  // eigen kopie: een tijd als 'uu:mm' in minuten. Vier regels overzetten is
  // hier eerlijker dan er een ctx-naam voor optuigen die niemand anders leest.
  const minuten = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

  // wat deze medewerker deze maand al op rekening van het bedrijf zette
  function besteedDezeMaand(org, key) {
    const maand = nu().slice(0, 7);
    return (db.data.mobOpdrachten || [])
      .filter(o => o.organisatie === org && o.reiziger === key &&
        String(o.gemaakt).slice(0, 7) === maand &&
        o.status !== 'geannuleerd' &&
        !(o.goedkeuring && o.goedkeuring.status === 'geweigerd'))
      .reduce((n, o) => n + (o.prijs || 0), 0);
  }

  /* De toets. `voorstel` is wat er geboekt gaat worden: prijs, ritsoort, stad,
     kostenplaats. Geeft terug of het mag, of er een mens naar moet kijken, en
     bij een nee ALTIJD de regel en het getal. */
  function beleidToets(org, key, voorstel = {}) {
    const code = schoon(org, 20).toUpperCase();
    if (!werktBij(key, code))
      return { mag: false, goedkeuringNodig: false,
        redenen: ['U staat niet als medewerker bij dit bedrijf ingeschreven.'] };

    const b = beleidVan(code);
    const eur = c => '€ ' + (c / 100).toFixed(2).replace('.', ',');
    if (!b) return { mag: true, goedkeuringNodig: false, redenen: [], beleid: null,
      uitleg: 'Er is geen reisbeleid ingesteld.' };

    const redenen = [];
    const prijs = Math.max(0, Math.round(Number(voorstel.prijs) || 0));

    if (b.maxPrijs && prijs > b.maxPrijs)
      redenen.push('Deze rit kost ' + eur(prijs) + '; het maximum per rit is ' + eur(b.maxPrijs) + '.');

    const besteed = besteedDezeMaand(code, key);
    if (b.budgetPerMaand && besteed + prijs > b.budgetPerMaand)
      redenen.push('Deze rit brengt u deze maand op ' + eur(besteed + prijs) +
        '; uw budget is ' + eur(b.budgetPerMaand) + ' (nu besteed: ' + eur(besteed) + ').');

    const wanneer = voorstel.wanneer ? new Date(voorstel.wanneer) : new Date();
    if (!isNaN(wanneer)) {
      if (b.dagen && b.dagen.length && !b.dagen.includes(wanneer.getDay()))
        redenen.push('Zakelijk reizen mag op ' + b.dagen.map(d => DAGNAMEN[d]).join(', ') +
          '; dit is een ' + DAGNAMEN[wanneer.getDay()] + '.');
      if (b.van && b.tot) {
        const m = wanneer.getHours() * 60 + wanneer.getMinutes();
        if (m < minuten(b.van) || m > minuten(b.tot))
          redenen.push('Zakelijk reizen mag tussen ' + b.van + ' en ' + b.tot + '; het is nu ' +
            String(wanneer.getHours()).padStart(2, '0') + ':' + String(wanneer.getMinutes()).padStart(2, '0') + '.');
      }
    }

    const stad = schoon(voorstel.stad, 40);
    if ((b.steden || []).length && stad && !b.steden.includes(stad))
      redenen.push('Zakelijk reizen is toegestaan in ' + b.steden.join(', ') + '; deze rit is in ' + stad + '.');

    const kp = schoon(voorstel.kostenplaats, 40);
    if (b.kostenplaatsVerplicht && !kp)
      redenen.push('Er is een kostenplaats verplicht bij een zakelijke rit.');
    if (kp && (b.kostenplaatsen || []).length && !b.kostenplaatsen.includes(kp))
      redenen.push('Kostenplaats "' + kp + '" bestaat niet; kies uit ' + b.kostenplaatsen.join(', ') + '.');

    if ((b.ritsoorten || []).length && voorstel.ritsoort && !b.ritsoorten.includes(voorstel.ritsoort))
      redenen.push('Zakelijk mag alleen ' + b.ritsoorten.join(', ') + '; dit is een rit van soort ' + voorstel.ritsoort + '.');

    /* De goedkeuringsdrempel is GEEN afwijzing. Boven het bedrag mag de rit
       best, maar er kijkt eerst een mens naar. Die twee door elkaar halen is
       precies waarom mensen om een beleid heen gaan werken. */
    const goedkeuringNodig = !redenen.length && !!b.goedkeuringVanaf && prijs >= b.goedkeuringVanaf;

    return { mag: !redenen.length, goedkeuringNodig, redenen,
      besteed, budget: b.budgetPerMaand || 0, beleid: beleidBeeld(b),
      uitleg: redenen.length
        ? 'Deze rit past niet in het reisbeleid. U kunt hem wel op eigen rekening boeken.'
        : (goedkeuringNodig
          ? 'Deze rit kost ' + eur(prijs) + ' en gaat eerst langs een leidinggevende (drempel ' + eur(b.goedkeuringVanaf) + ').'
          : 'Past binnen het reisbeleid.') };
  }

  return { besteedDezeMaand, beleidToets };
};
