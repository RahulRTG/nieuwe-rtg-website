/* ============================================================================
   DE HERSTELPROEF -- van "de uitvoer zou moeten werken" naar een datum.

   WAT DIT WEL EN NIET BEWIJST, EN DAT ONDERSCHEID IS DE HELE REDEN DAT DIT
   BESTAND EEN EIGEN KOP HEEFT.

   WEL: dat de uitvoer van DEZE organisatie op DEZE datum is teruggelezen en
   per soort overeenkwam met wat eruit ging. Dat is het exit-recht, en het is
   het enige deel ervan dat je kunt bewijzen zonder een klant te laten
   vertrekken.

   NIET: dat de dagback-up van het PLATFORM terug te zetten is. Dat is een
   andere claim, met een ander faalpad (schijven, sleutels, een migratie die
   halverwege stopt), en hij hoort onder een SLA. Deze proef mag daar dus niet
   voor doorgaan, en de SLA-voorwaarde blijft om die reden op nee staan.

   HOE DE PROEF WERKT, en het is met opzet dezelfde weg als een echte klant:

     1. exporteren
     2. terugLEZEN in een NIEUWE, tijdelijke werkruimte -- dezelfde functie die
        een vertrekkende klant gebruikt, geen aparte lus voor de proef
     3. de teruggelezen werkruimte opnieuw exporteren en de catalogus per soort
        naast de eerste leggen
     4. de tijdelijke werkruimte weg, ALTIJD -- ook als stap 2 of 3 stukloopt

   DRIE DINGEN DIE HIER NIET MOGEN GEBEUREN

   1. DE PROEF RAAKT HET ORIGINEEL NIET AAN. Er wordt alleen gelezen; wat er
      geschreven wordt, is de tijdelijke werkruimte en de uitslag.
   2. DE TIJDELIJKE WERKRUIMTE IS GEEN DEUR. Zijn beheer-token wordt meteen op
      null gezet, en zijn code staat in een REGISTER buiten de werkruimte zelf.
      Dat register is er na een fout: een merk `proef: true` OP de werkruimte
      leek eenvoudiger, maar dat veld is gewone inhoud en komt dus in de
      uitvoer -- de vergelijking meldde daarna trouw dat er een soort `proef`
      was bijgekomen. Een marker die in het gemeten object zit, meet zichzelf.
      Valt het proces om tussen stap 2 en 4, dan ruimt de volgende proef hem op;
      in het gaatje daarvoor staat er hooguit een werkruimte met een token dat
      niemand heeft, want hij is nergens heen gestuurd.
   3. DE UITSLAG IS EEN FEIT MET EEN DATUM, GEEN VINKJE. Bij een verschil staat
      er WELKE soort afweek. Een proef die alleen "mislukt" zegt, is een proef
      die je niet kunt naspelen.
   ========================================================================== */
'use strict';
const { nu: klokNu, datum: klokDatum } = require('../../lib/klok');

/* Hoe lang een geslaagde proef meetelt. Een halfjaar: lang genoeg dat niemand
   hem als een dagelijkse taak ervaart, kort genoeg dat "we hebben het ooit
   geprobeerd" niet als bewijs blijft staan. */
const GELDIG_DAGEN = 183;

module.exports = ({ db, save, register, uitgang, log }) => {
  const W = () => (db.data.werkruimtes = db.data.werkruimtes || {});

  /* Het register van tijdelijke werkruimtes. BUITEN de werkruimte, zie regel 2. */
  const bak = () => (db.data.herstelproefRuimtes = db.data.herstelproefRuimtes || []);

  /* Achtergebleven proefwerkruimtes van een afgebroken run. Ze worden bij ELKE
     proef opgeruimd en niet alleen bij de eigen: een oude die blijft staan is
     precies het soort ding waar niemand meer naar kijkt. */
  function ruimOp() {
    const w = W();
    const lijst = bak();
    let weg = 0;
    for (const code of lijst) if (w[code]) { delete w[code]; weg++; }
    if (lijst.length) { db.data.herstelproefRuimtes = []; save(); }
    return weg;
  }

  function vergelijk(voor, na) {
    const a = new Map((voor || []).map(r => [r.soort, r]));
    const b = new Map((na || []).map(r => [r.soort, r]));
    const verschillen = [];
    for (const [soort, r] of a) {
      const n = b.get(soort);
      if (!n) verschillen.push({ soort, wat: 'ontbreekt na het teruglezen' });
      else if (n.checksum !== r.checksum)
        verschillen.push({ soort, wat: 'andere inhoud', voor: r.aantal, na: n.aantal });
    }
    for (const soort of b.keys()) if (!a.has(soort)) verschillen.push({ soort, wat: 'kwam erbij na het teruglezen' });
    return verschillen;
  }

  /* De proef zelf. `code` is de werkruimte; de uitslag wordt op de TENANT
     vastgelegd, want dat is de partij die hem als bewijs gebruikt. */
  function doe(code, wie) {
    const opgeruimd = ruimOp();
    const uit = uitgang.exporteer(code);
    if (uit.error) return uit;

    let proefCode = null;
    try {
      const in1 = uitgang.lees(uit.uitvoer, { naam: 'Herstelproef' });
      if (in1.error) return { ok: false, gelukt: false, reden: in1.error, opgeruimd };
      proefCode = in1.werkruimte;
      /* REGEL 2: geen deur, en herkenbaar voor de opruiming -- maar dat tweede
         staat in het register en NIET op de werkruimte. */
      W()[proefCode].beheerToken = null;
      bak().push(proefCode);
      save();

      const uit2 = uitgang.exporteer(proefCode);
      if (uit2.error) return { ok: false, gelukt: false, reden: uit2.error, opgeruimd };

      const verschillen = vergelijk(uit.uitvoer.catalogus, uit2.uitvoer.catalogus);
      return leg(code, {
        gelukt: verschillen.length === 0,
        soorten: uit.uitvoer.catalogus.length,
        objecten: uit.uitvoer.catalogus.reduce((n, r) => n + r.aantal, 0),
        verschillen, opgeruimd, door: wie || null
      });
    } finally {
      /* REGEL 4: weg, wat er ook is gebeurd. Een return in de try springt hier
         eerst langs; dat is precies waarvoor finally bestaat. */
      if (proefCode) {
        delete W()[proefCode];
        db.data.herstelproefRuimtes = bak().filter(c => c !== proefCode);
        save();
      }
    }
  }

  function leg(code, uitslag) {
    const t = register.vanWerkruimte(code);
    const rij = Object.assign({ at: klokDatum().toISOString(), werkruimte: code }, uitslag);
    if (t) {
      const opslag = db.data.tenants[t.org];
      opslag.herstelproeven = [rij].concat(opslag.herstelproeven || []).slice(0, 20);
      save();
      if (log) log('tenant.herstelproef', { org: t.org, gelukt: rij.gelukt, verschillen: rij.verschillen.length });
    }
    return { ok: true, proef: rij, tenant: t ? t.org : null,
      let: rij.gelukt
        ? 'De uitvoer van deze werkruimte is teruggelezen en kwam per soort overeen. Dit bewijst het EXIT-pad; het terugzetten van de dagback-up van het platform is een andere claim en is hiermee niet bewezen.'
        : 'De teruggelezen uitvoer week af. Welke soorten, staat in `verschillen` -- een proef die alleen "mislukt" zegt, kun je niet naspelen.' };
  }

  /* De laatste GESLAAGDE proef die nog meetelt, of null met de reden.
     Niet `laatste`: die naam staat al in twee comm-modules met een heel andere
     betekenis, en een gelijkenis die geen gelijkenis is, misleidt. */
  function laatsteGeslaagde(org) {
    const t = register.haal(org);
    const rijen = (t && db.data.tenants[t.org] && db.data.tenants[t.org].herstelproeven) || [];
    const goed = rijen.filter(r => r.gelukt);
    if (!goed.length) return { ok: false, reden: rijen.length
      ? 'de laatste herstelproef (' + rijen[0].at.slice(0, 10) + ') is niet geslaagd'
      : 'er is voor deze organisatie nog geen herstelproef gedaan' };
    const dagen = Math.floor((klokNu() - Date.parse(goed[0].at)) / 86400000);
    if (dagen > GELDIG_DAGEN)
      return { ok: false, reden: 'de laatste geslaagde herstelproef is van ' + goed[0].at.slice(0, 10) +
        ' en daarmee ouder dan ' + GELDIG_DAGEN + ' dagen', proef: goed[0] };
    return { ok: true, proef: goed[0], dagen };
  }

  return { doe, laatsteGeslaagde, ruimOp, vergelijk, GELDIG_DAGEN };
};
