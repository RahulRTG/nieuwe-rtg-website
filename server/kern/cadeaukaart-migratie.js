/* DE OUDE CADEAUKAARTEN (kern/cadeaukaart-migratie.js): van een kale code van
   24 bits naar een hash, zonder dat de houder een cent verliest.

   Tot 27 september 2026 stond op elke kaart `code: 'RTG-GC-A1B2C3'`, en diezelfde
   code stond ook op de kassabon die ermee betaald werd (`posSales`: kaartCode en
   gcCode) en in het bewaarde idem-antwoord van de kassa (`kassaIdem`). Die code
   is waarde: de houder heeft hem op papier of in zijn telefoon. Daarom:

     - de code wordt op zijn plek GEHASHT (dezelfde normalisatie als bij het
       zoeken), dus de houder verzilvert met exact wat hij al had;
     - de kaart krijgt een id, een toegang met issuer/doel/scope en een
       vervaldatum van minstens een jaar na de migratie, en `legacy24: true`
       tot een rotatie hem vervangt door 128 bits. Dat is een bewuste keuze van
       waardebehoud boven vervroegd ongeldig maken, en hij staat als open besluit
       in CODECREDENTIALS.json bij de deur: 24 bits blijven raadbaar voor wie
       aan de kassa van DIE zaak mag proberen, en een hash van 24 bits is voor
       wie de database heeft geen geheim;
     - bonnen en idem-antwoorden krijgen `kaartId` in plaats van de code.

   Drie stappen, elk herhaalbaar en elk in een eigen collectietransactie:
   eerst krijgen oude kaarten een id (de code blijft nog staan), dan worden
   bonnen en idem-antwoorden op dat id gezet, en pas DAN verdwijnt de kale code
   van de kaart. Valt het proces ertussen, dan ziet de volgende aanroep nog een
   kaart met `code` en begint opnieuw; er is geen stand waarin een bon naar een
   kaart wijst die niet meer te vinden is. */
'use strict';

module.exports = ({ db, bewerkCollectie, transactie, bearer, codeHash, crypto, nu, DOEL, SCOPE,
  GELDIG_MS, MAX_GEBRUIK }) => {
  const oud = g => g && typeof g === 'object' && (typeof g.code === 'string' || !g.id || !g.toegang);
  const heeftOud = () => Array.isArray(db.data.giftcards) && db.data.giftcards.some(oud);
  const iso = v => { const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString() : nu(); };

  /* hash -> id, over oude (code) en nieuwe (toegang) kaarten */
  function idVoor(kaarten, code) {
    const h = codeHash(code);
    let id = null;
    for (const g of kaarten) {
      const eigen = g && (g.toegang ? g.toegang.code_hash : (typeof g.code === 'string' ? codeHash(g.code) : null));
      if (bearer.zelfdeHash(eigen, h)) id = g.id || id;
    }
    return id;
  }

  function toegangVoor(g) {
    const gebruik = (g.verzilveringen || []).length;
    const verval = Math.max(Date.parse(iso(g.at)) + GELDIG_MS, Date.parse(nu()) + GELDIG_MS);
    return {
      code_hash: codeHash(g.code), issuer: g.customerKey ? 'rtg.lid.cadeaukaart' : 'zaak:' + g.supplierCode,
      doel: DOEL, scope: [...SCOPE], onderwerp: { soort: 'cadeaukaart', id: g.id, supplierCode: g.supplierCode },
      issued_at: iso(g.at), expires_at: new Date(verval).toISOString(),
      max_gebruik: gebruik + MAX_GEBRUIK, gebruik,
      laatst_gebruikt_at: gebruik ? iso(g.verzilveringen[gebruik - 1].at) : null,
      ingetrokken_at: null, ingetrokken_door: null, intrekreden: null, rotatie: 1
    };
  }

  /* De kale code uit een bon of een bewaard antwoord halen, met het id ervoor
     in de plaats. `veld` wordt geleegd, ook als de kaart niet (meer) bestaat. */
  function zonderCode(obj, velden, kaarten) {
    if (!obj || typeof obj !== 'object') return;
    for (const veld of velden) {
      if (typeof obj[veld] !== 'string' || !obj[veld]) continue;
      if (!obj.kaartId) obj.kaartId = idVoor(kaarten, obj[veld]);
      delete obj[veld];
    }
  }

  async function migreer() {
    // 1. een id voor elke kaart die er geen heeft
    await transactie(bron => {
      for (const g of bron) if (g && typeof g === 'object' && !g.id) g.id = 'GC' + crypto.randomBytes(8).toString('hex');
    });
    const kaarten = JSON.parse(JSON.stringify(db.data.giftcards || []));
    // 2. bonnen en bewaarde kassa-antwoorden op het id zetten
    await bewerkCollectie('posSales', bron => {
      for (const lijst of Object.values(bron || {})) for (const b of Array.isArray(lijst) ? lijst : [])
        zonderCode(b, ['kaartCode', 'gcCode'], kaarten);
    });
    await bewerkCollectie('kassaIdem', bron => {
      for (const [k, r] of Object.entries(bron || {})) {
        if (k === '_keys' || !r || typeof r !== 'object') continue;
        zonderCode(r.sale, ['kaartCode', 'gcCode'], kaarten);
        zonderCode(r.kaart, ['code'], kaarten);
      }
    });
    // 3. pas nu de kale code van de kaart af
    return transactie(bron => {
      let n = 0;
      for (const g of bron) {
        if (!g || typeof g !== 'object' || !g.id) continue;
        if (typeof g.code === 'string') {
          if (!g.toegang) { g.toegang = toegangVoor(g); g.legacy24 = true; g.historie = g.historie || []; g.herkomst = g.toegang.issuer; }
          delete g.code; n++;
        } else if (!g.toegang) {
          /* geen code en geen toegang: er is niets om mee te openen, en dat blijft zo */
          g.toegang = Object.assign(toegangVoor(Object.assign({}, g, { code: crypto.randomBytes(16).toString('hex') })),
            { ingetrokken_at: nu(), ingetrokken_door: 'migratie', intrekreden: 'geen code gevonden' });
        }
      }
      return { gemigreerd: n };
    });
  }

  /* Goedkoop genoeg voor elke aanroep: zolang er geen oude kaart is, gebeurt
     er niets. Een oude instance die tijdens een uitrol nog een kale code
     schrijft, wordt bij de eerstvolgende aanroep alsnog overgezet. */
  const zorg = () => (heeftOud() ? migreer() : Promise.resolve({ gemigreerd: 0 }));

  return { migreer, zorg };
};
