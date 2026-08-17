/* Backoffice (deelmodule): DE ROUTEDEKKING IN HET RTG KANTOOR.

   WAAROM DIT ER IS. De dekkingsmeting was iets wat in een terminal gebeurde en
   in een terminal bleef. Wie geen `npm run dekking` kan draaien -- dus vrijwel
   iedereen die hier werkt -- had geen enkele manier om te zien welke routes dit
   huis heeft en of ze beproefd zijn. "Het staat op 100%" was daarmee een
   mededeling en geen navraagbaar feit.

   DIT SCHERM REKENT MET DEZELFDE FUNCTIE ALS DE POORT.

   Niet met dezelfde formule, maar met dezelfde FUNCTIE: kern/routedekking.js
   meet(). scripts/dekking.js voert die de journaalregels van een testronde, deze
   module voert hem de bewezen-aangeraakt lijst uit DEKKING.json -- beide keren
   in de vorm "METHODE patroon", dus dezelfde rekenkant. Er is hier geen tweede
   optelling die uit de eerste kan lopen (LAT.md regel 4), en dat is precies wat
   je wil bij een cijfer dat 100% moet zijn.

   HET IS GEEN AFDRUK VAN EEN CIJFER MAAR EEN VERGELIJKING.

   Het bewijsstuk zegt welke routes tijdens de laatste volledige suite echt zijn
   aangeraakt. De SERVER zegt welke routes hij op DIT MOMENT registreert. Een
   route die er na de meting bij is gekomen valt hier dus meteen op als ongedekt,
   zonder dat er eerst een suite hoeft te draaien. Een opgeslagen percentage zou
   blijven zeggen dat alles in orde is.

   EN ZONDER BEWIJSSTUK ZEGT HET SCHERM DAT. Geen 0%, geen 100%, maar "niet
   gemeten": een meter zonder invoer hoort niet stil een cijfer te tonen dat op
   niets rust (LAT.md regel 3). */
'use strict';
const fs = require('fs');
const path = require('path');
const routedekking = require('../../kern/routedekking');

const BEWIJSPAD = path.join(__dirname, '../../..', 'DEKKING.json');

module.exports = (octx) => {
  const { app, officeAuth } = octx.kern;

  /* De routekaart van deze server verandert na het opstarten niet meer, dus
     eenmalig. Het bewijsstuk WEL: wie `npm run dekking:vast` draait hoort dit
     scherm te zien bijkomen zonder herstart, dus dat leest opnieuw zodra de
     tijdstempel verandert. */
  let kaartCache = null;
  const kaart = () => (kaartCache || (kaartCache = typeof app._routes === 'function' ? app._routes() : []));

  let bewijsCache = null;
  function bewijs() {
    let mtime = 0;
    try { mtime = fs.statSync(BEWIJSPAD).mtimeMs; } catch (e) { return null; }
    if (bewijsCache && bewijsCache.mtime === mtime) return bewijsCache;
    try {
      const d = JSON.parse(fs.readFileSync(BEWIJSPAD, 'utf8'));
      if (!Array.isArray(d.aangeraakt)) return null;
      bewijsCache = { mtime, gemeten: d.gemeten || null, aangeraakt: d.aangeraakt };
    } catch (e) { return null; }   // een onleesbaar bewijsstuk is geen bewijs
    return bewijsCache;
  }

  /* De stand. `meet()` doet het rekenwerk; hier staat alleen wat er in het
     KANTOOR van te zeggen valt.

     m.vreemd betekent hier iets anders dan in de poort en dat is geen truc maar
     dezelfde vraag vanaf de andere kant: het zijn de routes die het bewijsstuk
     noemt en die de server niet meer registreert. Dus: opgeruimde routes, en
     daarmee het bewijs dat het bewijsstuk ouder is dan de code. Zonder die kant
     ziet een verouderd bewijsstuk er in orde uit zolang er alleen routes zijn
     weggehaald. */
  function stand(vraag) {
    const b = bewijs();
    const m = routedekking.meet(kaart(), b ? b.aangeraakt : []);
    return {
      stand: !b ? 'niet gemeten' : (m.gaten || m.vreemd.length ? 'achterhaald' : 'in orde'),
      eis: 100,
      gemeten: b ? b.gemeten : null,
      /* HET TOTAAL DRAAGT OOK DE NIET-MEETBARE ROUTES, en dat is geen detail:
         `m.totaal` laat een app.all()-route buiten de noemer (die is niet te
         meten, zie kern/routedekking.js), terwijl `ongedekt` hem wel meetelt.
         Zonder deze optelling zou er op het scherm gedekt + ongedekt > totaal
         staan zodra er zo'n route bij komt -- en een teller die niet klopt is
         precies waarom niemand een dekkingscijfer nog gelooft. */
      totaal: m.totaal + m.onmeetbaar.length,
      gedekt: m.geraakt,
      ongedekt: m.nooitAangeraakt + m.onmeetbaar.length,
      pct: m.pct,
      verdwenenSindsMeting: m.vreemd.slice(0, 50),
      onmeetbaar: m.onmeetbaar.map(r => r.methode + ' ' + r.pad),
      perDomein: m.perDomein.map(d => ({ domein: d.domein, totaal: d.totaal, gedekt: d.geraakt,
        ongedekt: d.ongeraakt.slice(0, 10) })),
      lijst: pagina(m, vraag || {})
    };
  }

  /* Doorbladeren en zoeken, zodat "uitzien" ook echt kan: alle routes van het
     huis, met per route of hij beproefd is. */
  function pagina(m, vraag) {
    const ongedekt = new Set(m.ongeraakt.map(r => r.methode + ' ' + r.pad));
    const zoek = String(vraag.zoek || '').trim().toLowerCase().slice(0, 120);
    const domein = String(vraag.domein || '').trim().slice(0, 40);
    const alleenGaten = !!vraag.alleenGaten;
    const rijen = routedekking.inventaris(kaart()).routes
      .map(r => ({ methode: r.methode, pad: r.pad, domein: r.domein,
        gedekt: !ongedekt.has(r.methode + ' ' + r.pad) }))
      .filter(r => (!domein || r.domein === domein) && (!alleenGaten || !r.gedekt) &&
        (!zoek || (r.methode + ' ' + r.pad).toLowerCase().includes(zoek)));
    const limiet = Math.max(1, Math.min(250, Number(vraag.limiet) || 50));
    const nr = Math.max(1, Number(vraag.pagina) || 1);
    return { zoek, domein, alleenGaten, pagina: nr, limiet, totaal: rijen.length,
      paginas: Math.max(1, Math.ceil(rijen.length / limiet)),
      resultaten: rijen.slice((nr - 1) * limiet, (nr - 1) * limiet + limiet) };
  }

  app.post('/api/office/routedekking', officeAuth, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(stand(req.body || {}));
  });

  return { stand };
};
