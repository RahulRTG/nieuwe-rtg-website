/* Horeca (kern): DE VERDELING -- wie betaalt welk deel van één rekening.

   ONDERSCHEID DAT ALLES DRAAGT, en het staat hier omdat het anders twee keer
   wordt uitgelegd. SPLITSEN (horeca/schuif.js) knipt één rekening in twee
   rekeningen: de tafel gaat uit elkaar. VERDELEN doet dat juist niet -- de
   rekening blijft één rekening, en er wordt afgesproken wie welk DEEL betaalt.
   Twee handelingen met bijna dezelfde naam; door elkaar halen levert een
   rekening op die twee keer bestaat.

   WAAROM DIT UIT kern/gast/ IS GEHAALD. Deze rekensom stond in
   kern/gast/verdeling.js, en daar kon alleen de GASTENDEUR bij. De bediening
   die dezelfde rekening afrekende had maar één knop: `perPersoon: n`, dat wil
   zeggen door drieën en klaar -- terwijl de gast op zijn telefoon al kon kiezen
   voor per product, per persoon of op percentage. Dezelfde tafel, twee
   verschillende antwoorden op "wie betaalt wat". Dat is LAT-regel 4, en het is
   dezelfde verhuizing die `bereidingsMinuten` eerder maakte: een som die twee
   domeinen nodig hebben, staat in de kern.

   WAT HIER NIET IN ZIT: opslaan, een auditregel, en de gastreis. Dit rekent
   alleen. Wie het vastlegt (en onder wiens naam) is de vraag van de aanroeper --
   de gast schrijft er "gast" bij, de bediening haar eigen naam. Zo blijft de
   rekensom één plek en de verantwoording een andere.

   DE SOM IS HEILIG. De delen tellen exact op tot wat er te betalen is; een rest
   van een paar cent gaat naar de EERSTE delen. 10,00 door drie is 3,34 + 3,33 +
   3,33. Wie per deel afrondt komt op 9,99 of 10,02 uit, en dat verschil komt
   bij duizend tafels per week nooit meer boven water. */
'use strict';

const WIJZEN = ['gelijk', 'product', 'persoon', 'percentage', 'een'];

module.exports = ({ horeca }) => {
  const { heleCenten, totaal } = horeca;

  /* Verdeel een bedrag over n delen zonder een cent te verliezen: de rest gaat
     naar de eerste delen. Dezelfde som als in schuif.js. */
  function knip(bedrag, n) {
    const basis = Math.floor(bedrag / n);
    const rest = bedrag - basis * n;
    return Array.from({ length: n }, (_, i) => basis + (i < rest ? 1 : 0));
  }

  /* De rekensom, zonder bijwerkingen. Geeft { verdeling } of { status, error }. */
  function bereken(rek, { wijze, delen, nr }) {
    const w = String(wijze || 'gelijk');
    if (!WIJZEN.includes(w)) return { status: 400, error: 'Onbekende verdeling. Kies uit: ' + WIJZEN.join(', ') + '.' };
    if (rek.status !== 'open') return { status: 409, error: 'Deze rekening is al ' + rek.status + '.' };
    const mensen = (rek.deelnemers || []).map((d) => d.nr);
    if (!mensen.length) return { status: 409, error: 'Er zit nog niemand op deze rekening.' };
    const teBetalen = totaal(rek).teBetalen;
    let uit = [];

    if (w === 'gelijk') {
      const stukken = knip(teBetalen, mensen.length);
      uit = mensen.map((n, i) => ({ nr: n, centen: stukken[i] }));

    } else if (w === 'een') {
      const doel = parseInt(nr, 10);
      if (!mensen.includes(doel)) return { status: 400, error: 'Die persoon zit niet aan deze rekening.' };
      uit = mensen.map((n) => ({ nr: n, centen: n === doel ? teBetalen : 0 }));

    } else if (w === 'product') {
      /* Ieder betaalt wat op zijn naam staat. Wat op niemands naam staat (de
         fles wijn voor de tafel) wordt gelijk verdeeld -- en dat wordt gemeld,
         want anders lijkt het of iemand te veel betaalt. */
      const eigen = Object.fromEntries(mensen.map((n) => [n, 0]));
      let gedeeld = 0;
      for (const r of (rek.regels || [])) {
        const som = heleCenten(r.centen * r.aantal);
        if (r.gastNr && eigen[r.gastNr] != null) eigen[r.gastNr] += som; else gedeeld += som;
      }
      /* De korting en de fooi hangen aan de hele rekening, dus die gaan
         evenredig mee in plaats van bij een van de gasten te blijven hangen. */
      const bruto = Object.values(eigen).reduce((t, x) => t + x, 0) + gedeeld;
      const stukken = knip(gedeeld, mensen.length);
      const ruw = mensen.map((n, i) => eigen[n] + stukken[i]);
      const schaal = bruto ? mensen.map((n, i) => Math.floor(ruw[i] * teBetalen / bruto)) : mensen.map(() => 0);
      let rest = teBetalen - schaal.reduce((t, x) => t + x, 0);
      for (let i = 0; rest > 0; i = (i + 1) % mensen.length, rest--) schaal[i] += 1;
      uit = mensen.map((n, i) => ({ nr: n, centen: schaal[i] }));

    } else if (w === 'persoon' || w === 'percentage') {
      const opgave = Array.isArray(delen) ? delen : [];
      if (!opgave.length) return { status: 400, error: 'Geef per persoon op wat die betaalt.' };
      for (const d of opgave) if (!mensen.includes(parseInt(d.nr, 10)))
        return { status: 400, error: 'Persoon ' + d.nr + ' zit niet aan deze rekening.' };
      if (w === 'percentage') {
        const som = opgave.reduce((t, d) => t + (Number(d.procent) || 0), 0);
        if (Math.round(som) !== 100) return { status: 400, error: 'De percentages tellen op tot ' + som + '% en moeten op 100% uitkomen.' };
        const ruw = opgave.map((d) => Math.floor(teBetalen * (Number(d.procent) || 0) / 100));
        let rest = teBetalen - ruw.reduce((t, x) => t + x, 0);
        for (let i = 0; rest > 0; i = (i + 1) % ruw.length, rest--) ruw[i] += 1;
        uit = opgave.map((d, i) => ({ nr: parseInt(d.nr, 10), centen: ruw[i] }));
      } else {
        uit = opgave.map((d) => ({ nr: parseInt(d.nr, 10), centen: heleCenten(d.centen) }));
      }
    }

    /* DE CONTROLE. Dit is geen extra veiligheid maar de kern: een verdeling die
       niet optelt tot het geheel is geen verdeling. Hij wordt geweigerd in
       plaats van stilzwijgend rechtgetrokken, want dan zou er iemand betalen wat
       hij niet heeft afgesproken. */
    const som = uit.reduce((t, d) => t + d.centen, 0);
    if (som !== teBetalen) return { status: 409,
      error: 'De delen tellen op tot € ' + (som / 100).toFixed(2) + ' en de rekening is € ' + (teBetalen / 100).toFixed(2) + '. Er is niets gewijzigd.' };

    return { verdeling: { wijze: w, teBetalen, delen: uit } };
  }

  return { WIJZEN, knip, bereken };
};
