/* CONCERN (deelmodule): HET CONCERN EN DE EIGENDOMSGRAAF. Stap 6.

   Hier staan de vragen die zonder graaf niet te stellen zijn: wie mag dit
   contract tekenen, welke locaties raakt deze verlopende vergunning, welke
   dochters hangen aan deze bestuurder.

   DE UBO WORDT GEREKEND EN NIET AANGEVINKT, NU OOK OVER ENTITEITEN HEEN.
   kern/onderneming/bestuur.js doet dit al binnen EEN onderneming, met de goede
   redenering: een aangevinkte UBO blijft staan als de aandelen verschuiven, en
   dan klopt het register precies op het moment dat het ertoe doet niet meer.
   Wat die module niet kon, kon zij niet omdat het bouwmateriaal ontbrak: een
   mens die 60% van een holding houdt die 100% van een werk-BV houdt, is voor
   60% belanghebbende in die werk-BV. Deze module vermenigvuldigt langs de keten.

   DE RING IS HET RANDGEVAL DAT ECHT VOORKOMT. Twee BV's die aandelen in elkaar
   houden is geen verzinsel; zonder bewaking loopt de berekening oneindig door.
   Een pad dat een entiteit voor de tweede keer ziet, stopt daar EN zegt dat --
   stil afbreken geeft een te laag percentage, en dat is nou net het getal
   waarop iemand wel of geen UBO is.

   EN HET BLIJFT VOORBEREIDING, geen UBO-opgave bij het handelsregister. Zie de
   grenzen in CONCERN.md. */
'use strict';

const UBO_GRENS = 25;      // procent; boven deze grens ben je uiteindelijk belanghebbende
const MAX_DIEPTE = 12;     // een eigendomsketen dieper dan dit is een ring of een fout

module.exports = (ctx) => {
  const { db, save, crypto, schoon, entiteitVind, entiteitAlle, entiteitBeeld,
    vestigingAlleVanEntiteit, tijdOpDatumVan, tijdVandaag, tijdVerlooptBinnen, opslag } = ctx;

  const bak = () => opslag.tak('concerns');

  const concernVind = (id) => bak()[String(id || '')] || null;

  function concernNieuw(eigenaar, body) {
    const naam = schoon((body || {}).naam, 160);
    if (!naam) return { status: 400, error: 'Hoe heet deze groep?' };
    const c = { id: 'con_' + crypto.randomBytes(6).toString('hex'), eigenaar, naam,
      gestart: new Date().toISOString() };
    bak()[c.id] = c;
    save();
    return { ok: true, concern: { id: c.id, naam: c.naam } };
  }

  /* Een entiteit in een groep hangen. Een entiteit hoort bij hoogstens één
     concern: de groep is een economische indeling, en twee groepen die dezelfde
     entiteit claimen maken de consolidatie onbeslisbaar. */
  function concernZet(e, concernId) {
    if (concernId === null || concernId === '') { e.concern = null; save(); return { ok: true }; }
    const c = concernVind(concernId);
    if (!c) return { status: 404, error: 'Deze groep bestaat niet.' };
    e.concern = c.id;
    save();
    return { ok: true, concern: { id: c.id, naam: c.naam } };
  }

  /* ---- de eigendomsgraaf ----

     De aandeelhouders van een entiteit op een dag. `sleutel` is WIE (een
     codenaam van een mens, of een entiteit-id) en `waarde` het percentage. Of
     het om een mens of een entiteit gaat, staat niet in een apart veld maar
     wordt gelezen aan het bestaan van die entiteit -- een tweede veld zou uit
     de pas kunnen lopen met de werkelijkheid. */
  function houdersVan(entiteitId, op) {
    return (tijdOpDatumVan(entiteitId, 'aandeelhouder', op) || []).map(f => ({
      wie: f.sleutel,
      percentage: Number(f.waarde) || 0,
      isEntiteit: !!entiteitVind(f.sleutel),
      klasse: (f.extra || {}).klasse || null,
      stemrecht: (f.extra || {}).stemrecht ?? null,
      bron: f.bron
    }));
  }

  /* HET UITEINDELIJKE BELANG. Loopt de keten omhoog en vermenigvuldigt de
     percentages. Geeft per mens het opgetelde belang terug, plus de paden --
     want "u bent voor 42% UBO" zonder te laten zien via welke twee lijnen dat
     loopt, is een getal waar niemand iets mee kan. */
  function belangen(entiteitId, op) {
    const uit = new Map();       // codenaam -> { percentage, paden: [] }
    const ringen = [];
    (function loop(id, deel, pad) {
      if (pad.length > MAX_DIEPTE) return;
      for (const h of houdersVan(id, op)) {
        const stuk = deel * (h.percentage / 100);
        if (h.isEntiteit) {
          if (pad.includes(h.wie)) {
            ringen.push({ via: pad.concat(h.wie), uitleg: 'Deze entiteiten houden aandelen in elkaar; het belang is niet volledig te rekenen.' });
            continue;
          }
          loop(h.wie, stuk, pad.concat(h.wie));
        } else {
          const r = uit.get(h.wie) || { percentage: 0, paden: [] };
          r.percentage += stuk * 100;
          r.paden.push({ via: pad.slice(1), deel: Math.round(stuk * 10000) / 100 });
          uit.set(h.wie, r);
        }
      }
    })(entiteitId, 1, [entiteitId]);

    return { belangen: [...uit.entries()]
      .map(([wie, r]) => ({ wie, percentage: Math.round(r.percentage * 100) / 100, paden: r.paden }))
      .sort((a, b) => b.percentage - a.percentage), ringen };
  }

  /* DE UBO. Boven de grens: uiteindelijk belanghebbende. Is er niemand boven de
     grens, dan gelden de statutair bestuurders -- dat is de terugvalregel en
     die hoort met zoveel woorden in het antwoord te staan, want het verschil
     tussen "eigenaar" en "bij gebrek aan eigenaar" is juridisch niet klein. */
  function ubo(entiteitId, op) {
    const { belangen: b, ringen } = belangen(entiteitId, op);
    const boven = b.filter(x => x.percentage > UBO_GRENS);
    if (boven.length) {
      return { grens: UBO_GRENS, soort: 'belang', ubos: boven, ringen,
        regel: 'Wie meer dan ' + UBO_GRENS + '% van het uiteindelijke belang houdt, is UBO.',
        bron: { soort: 'afgeleid', detail: 'uiteindelijk belang > ' + UBO_GRENS + '%' } };
    }
    const bestuur = (tijdOpDatumVan(entiteitId, 'bestuurder', op) || [])
      .map(f => ({ wie: f.sleutel, percentage: null, rol: f.waarde }));
    return { grens: UBO_GRENS, soort: 'bestuur', ubos: bestuur, ringen,
      regel: 'Niemand houdt meer dan ' + UBO_GRENS + '%; dan gelden de statutair bestuurders als UBO.',
      bron: { soort: 'afgeleid', detail: 'geen belang boven ' + UBO_GRENS + '%, terugval op het bestuur' } };
  }

  /* ---- de boom ---- */
  function concernBoom(concernId, op) {
    const leden = entiteitAlle().filter(e => e.concern === concernId);
    const d = op || tijdVandaag();
    const knopen = leden.map(e => {
      const beeld = entiteitBeeld(e, d);
      const ouders = houdersVan(e.id, d).filter(h => h.isEntiteit);
      return { id: e.id, naam: beeld.naam, rechtsvorm: beeld.rechtsvormLabel,
        land: e.land,
        vestigingen: vestigingAlleVanEntiteit(e.id).filter(v => !v.gesloten)
          .map(v => ({ id: v.id, naam: v.naam, units: (v.units || []).length })),
        ouders: ouders.map(h => ({ entiteit: h.wie, percentage: h.percentage })) };
    });
    const kinderen = new Set(knopen.flatMap(k => k.ouders.map(() => k.id)));
    return { op: d, concern: concernVind(concernId), knopen,
      wortels: knopen.filter(k => !k.ouders.length).map(k => k.id),
      aantal: { entiteiten: knopen.length,
        vestigingen: knopen.reduce((n, k) => n + k.vestigingen.length, 0),
        units: knopen.reduce((n, k) => n + k.vestigingen.reduce((m, v) => m + v.units, 0), 0),
        dochters: kinderen.size } };
  }

  return Object.assign({ concernVind, concernNieuw, concernZet, concernBoom,
    concernHouders: houdersVan, concernBelangen: belangen, concernUbo: ubo,
    CONCERN_UBO_GRENS: UBO_GRENS },
    require('./graaf-bevoegdheid')(ctx));
};
