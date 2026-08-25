/* ============================================================================
   DE NAAD -- wat AAN de store hangt in plaats van erin zit.

   Twee dingen hangen ernaast: het GELD (kopen, afdracht, teruggave) en de
   TIJDLIJN van het lid (wat gaf ik, en wanneer nam ik het terug). Allebei zijn
   het geen laag van de store maar een aanhangsel: de store werkt zonder, en
   allebei schrijven ze mee zonder ooit iets tegen te houden.

   Ze staan hier bij elkaar omdat ze dezelfde vorm hebben -- opgebouwd als de
   omgeving ze toelaat, en anders eerlijk afwezig. Wie wil weten wat een aanschaf
   of een intrekking met de rest van de App Store doet, hoeft maar hier te
   kijken.

   Drie dingen gebeuren hier, en alle drie zouden ze op de verkeerde plek staan
   als ze ergens anders stonden:

   1. DE BETAALDE KANT WORDT ALLEEN OPGEBOUWD ALS ER EEN BETAALLAAG IS. Draait
      een proces zonder RTG Pay (een kale toets, een domeinproces), dan is dit
      een gratis store en zegt hij dat ook. Geen stille terugval naar een prijs
      die niemand int (LAT-regel 5).

   2. INTREKKEN ZET TERUGGAVERECHTEN KLAAR. Dat hangt hier en niet in
      ./besluit.js: die laag hoort niet van geld te weten. Zie ./teruggave.js
      voor waarom het een recht is en geen automatische terugboeking.

   3. EN INTREKKEN SCHRIJFT IN DE TIJDLIJN VAN IEDEREEN DIE HEM HAD. Een lid
      wiens app verdwijnt door een besluit van ONS, hoort dat later te kunnen
      terugvinden. Ook dat hoort niet in ./besluit.js: die weet niet wie de app
      op zijn startscherm had staan.
   ========================================================================== */
'use strict';

module.exports = function maakNaad({ S, save, nu, boek, eigen, norm, uitgever, app, versie, opslag, pay, findSupplier, intrekkenKaal }) {
  const T = require('./tijdlijn')({ S, save, nu });
  const geld = pay && typeof pay.verkoop === 'function'
    ? require('./geld')({ S, save, nu, boek, eigen, norm, uitgever, app, versie, pay, findSupplier, noteer: T.noteer })
    : null;

  /* HEET intrekkenMetGevolgen EN NIET intrekken, als tegenhanger van
     intrekkenKaal in ./besluit.js. Die twee namen samen zeggen precies wat het
     verschil is: kaal haalt de code eruit, met-gevolgen doet dat EN zet de
     teruggaverechten klaar EN schrijft in de tijdlijn van iedereen die de app
     had. Naar buiten heet hij gewoon `intrekken` -- dat is wat de rest van het
     huis aanroept, en dat hoort de volledige te zijn.

     De keuring wees hierop: `intrekken` stond in drie kernmodules, en zijn
     advies is "geef ze een eigen naam zodat de gelijkenis niet misleidt". Hier
     was die gelijkenis ook echt misleidend -- twee functies met dezelfde naam
     waarvan er een de helft doet. */
  function intrekkenMetGevolgen(a) {
    const r = intrekkenKaal(a);
    if (r.ok) {
      /* Iedereen die deze app had staan, krijgt er een regel over. Wie hem nooit
         had, krijgt niets: een tijdlijn van een lid gaat over wat HIJ deed en
         wat er met ZIJN apps gebeurde. */
      const verleend = (S().verleend && typeof S().verleend === 'object') ? S().verleend : {};
      for (const key of Object.keys(verleend)) {
        if (!eigen(verleend[key], a.sleutel)) continue;
        T.noteer(key, 'weggehaald', a.sleutel, { door: r.app.ingetrokken.door, reden: r.app.ingetrokken.reden });
      }
    }
    if (r.ok && geld) {
      const n = geld.rechtenBijIntrekken(a.sleutel, (a && a.reden) || null, r.app.ingetrokken.door);
      if (n) {
        r.teruggaverechten = n;
        r.let += ' ' + n + ' lid(eren) had(den) deze app gekocht; er staat nu een teruggaverecht open dat een mens van RTG afhandelt.';
      }
      save();
    }
    return r;
  }

  /* ------------------------------------------------------- continue keuring

     EEN KEURING IS GEEN MOMENT MAAR EEN TOESTAND. Een app is in maart
     afgetekend; dat zegt niets over vandaag. Twee dingen kunnen sindsdien zijn
     veranderd zonder dat iemand iets deed: de bytes op schijf kloppen niet meer
     met de hash die is goedgekeurd, of de uitgever staat er niet meer.

     Wat er bij een afwijking gebeurt, verschilt met opzet:

       de bytes kloppen niet  -> de app gaat er METEEN uit. Er is geen afweging
                                 te maken: wat draait is niet meer wat is
                                 goedgekeurd, en dan hoort het niet te draaien.
       de uitgever is weg     -> alleen MELDEN. Dat is een besluit dat al door
                                 een mens is genomen (schorsen haalt zijn apps
                                 zelf al weg); hier zou een tweede automatiek
                                 alleen kunnen afwijken van de eerste.

     De celroute controleert de integriteit al bij ELKE lezing. Deze ronde is er
     voor de app die niemand opent: zonder hem blijft een aangetaste bundel stil
     staan tot het eerste lid hem toevallig aanraakt. */
  function hercontrole({ door } = {}) {
    const wie = String(door || 'de controleronde').trim().slice(0, 80);
    const uit = { gekeurd: 0, inOrde: 0, uitgezet: [], gemeld: [] };
    for (const a of Object.values(S().apps || {})) {
      if (!a.live) continue;
      const v = versie(a.live);
      if (!v || v.status !== 'gepubliceerd') continue;
      uit.gekeurd++;
      const index = opslag.indexVan(a.sleutel, v.hash);
      const kapot = !index ? ['de bundelindex zelf is weg']
        : Object.keys(index).filter(pad => !opslag.lees(a.sleutel, v.hash, pad, false));
      if (kapot.length) {
        intrekkenMetGevolgen({ sleutel: a.sleutel, door: wie,
          reden: 'de bundel komt niet meer overeen met wat is goedgekeurd (' + kapot.slice(0, 3).join(', ') + ')' });
        uit.uitgezet.push({ sleutel: a.sleutel, bestanden: kapot.slice(0, 5) });
        continue;
      }
      const u = uitgever(a.org);
      if (!u || u.status !== 'toegelaten') { uit.gemeld.push({ sleutel: a.sleutel, org: a.org, uitgever: u ? u.status : 'verdwenen' }); continue; }
      uit.inOrde++;
    }
    boek('hercontrole', null, wie, { gekeurd: uit.gekeurd, uitgezet: uit.uitgezet.length, gemeld: uit.gemeld.length });
    save();
    return Object.assign({ status: 200, ok: true }, uit, {
      let: uit.uitgezet.length
        ? 'Er stond code live die niet meer overeenkwam met wat is goedgekeurd. Die apps zijn eruit gehaald; dat is geen afweging maar de enige juiste uitkomst.'
        : 'Alles wat live staat, komt byte voor byte overeen met wat een mens heeft afgetekend.' });
  }

  return { geld, intrekken: intrekkenMetGevolgen, hercontrole, tijdlijn: T.tijdlijn, noteer: T.noteer, TIJDLIJN_SOORTEN: T.TIJDLIJN_SOORTEN };
};
