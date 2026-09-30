/* DE OUDE HORECABONNEN (kern/horeca/bon-migratie.js): van een kale code van
   32 bits als objectsleutel naar een hash in `horecaBonnen`, zonder dat de
   houder een cent verliest.

   Tot 27 september 2026 stond elke bon als horeca[zaak].bonnen[CODE] in de doos,
   de band verwees ernaar met `bonCode`, en elke betaling met een bon droeg
   `bon: CODE`. Die code is waarde: de houder heeft hem op papier of als QR op
   zijn polsband. Daarom:

     - de bon verhuist naar `horecaBonnen` met zijn saldo, en de code wordt daar
       GEHASHT (dezelfde normalisatie als bij het zoeken): de houder betaalt met
       exact wat hij had. `legacy32: true` tot een rotatie hem 128 bits geeft --
       een bewuste keuze van waardebehoud boven vervroegd ongeldig maken, die
       als open besluit bij de deur in CODECREDENTIALS.json staat;
     - de vervaldatum blijft de oude `geldigTot` als die er was, anders een jaar
       na de migratie (een band dertig dagen);
     - band en betalingen krijgen het bon-ID in plaats van de code, en pas DAN
       verdwijnt `bonnen` uit de horecadoos.

   Twee stappen, elk herhaalbaar en elk in een eigen collectietransactie. Valt
   het proces ertussen, dan vindt de volgende aanroep de bon al terug op zijn
   hash en maakt hem niet opnieuw; er is geen stand waarin een band naar een bon
   wijst die niet meer te vinden is. */
'use strict';

module.exports = ({ lees, bewerkCollectie, transactie, t, crypto }) => {
  const { bearer, codeHash, nieuweBonToegang, nu } = t;
  const heeftOud = () => Object.values(lees('horeca') || {}).some(h => h && (
    (h.bonnen && Object.keys(h.bonnen).length) ||
    Object.values((h.club && h.club.banden) || {}).some(b => b && typeof b.bonCode === 'string')));

  function toegangVoor(b, zaak, code) {
    const t0 = nieuweBonToegang('zaak:' + zaak, b);
    const oud = /^\d{4}-\d{2}-\d{2}$/.test(String(b._geldigTot || '')) ? Date.parse(b._geldigTot + 'T23:59:59.999Z') : NaN;
    const gebruik = (b.mutaties || []).filter(m => m && m.centen < 0).length;
    return Object.assign(t0.toegang, { code_hash: codeHash(code),
      expires_at: Number.isFinite(oud) ? new Date(oud).toISOString() : t0.toegang.expires_at,
      gebruik, max_gebruik: gebruik + t0.toegang.max_gebruik });
  }

  async function migreer() {
    const oud = JSON.parse(JSON.stringify(lees('horeca') || {}));
    // 1. elke oude bon als hash in horecaBonnen, een keer
    await transactie(bron => {
      for (const [zaak, h] of Object.entries(oud)) {
        const band = {};
        for (const [n, x] of Object.entries((h && h.club && h.club.banden) || {}))
          if (x && typeof x.bonCode === 'string') band[x.bonCode.toUpperCase()] = n;
        for (const [code, b] of Object.entries((h && h.bonnen) || {})) {
          const hash = codeHash(code);
          if (bron.some(x => x && x.zaak === zaak && bearer.zelfdeHash(x.toegang && x.toegang.code_hash, hash))) continue;
          const nieuw = { id: 'HB' + crypto.randomBytes(8).toString('hex'), zaak, herkomst: 'zaak:' + zaak,
            soort: b.soort === 'tegoed' ? 'tegoed' : 'cadeaubon', band: band[String(code).toUpperCase()] || null,
            naam: b.naam || null, uitgegeven: Math.round(Number(b.uitgegeven) || 0), saldo: Math.max(0, Math.round(Number(b.saldo) || 0)),
            at: b.at || nu(), door: 'migratie', mutaties: (b.mutaties || []).slice(0, 200).reverse().map(m => ({ at: m.at, centen: m.centen, soort: m.soort || null })),
            historie: [], binding: null, legacy32: true, _geldigTot: b.geldigTot };
          nieuw.toegang = toegangVoor(nieuw, zaak, code);
          delete nieuw._geldigTot;
          bron.zet(nieuw);
        }
      }
    });
    const bonnen = Object.values(JSON.parse(JSON.stringify(lees('horecaBonnen') || {})));
    const idVan = (zaak, code) => {
      const h = codeHash(code);
      let id = null;
      for (const x of bonnen) if (x && x.zaak === zaak && bearer.zelfdeHash(x.toegang && x.toegang.code_hash, h)) id = x.id;
      return id;
    };
    // 2. band en betalingen op het id, en pas dan de kale codes weg
    return bewerkCollectie('horeca', bron => {
      let n = 0;
      for (const [zaak, h] of Object.entries(bron || {})) {
        if (!h || typeof h !== 'object') continue;
        for (const x of Object.values((h.club && h.club.banden) || {})) {
          if (!x || typeof x.bonCode !== 'string') continue;
          x.bonId = idVan(zaak, x.bonCode); delete x.bonCode;
        }
        for (const r of Object.values(h.rekeningen || {})) for (const p of (r && r.betalingen) || []) {
          if (!p || typeof p.bon !== 'string') continue;
          p.bonId = idVan(zaak, p.bon); delete p.bon;
        }
        if (h.bonnen) { n += Object.keys(h.bonnen).length; delete h.bonnen; }
      }
      return { gemigreerd: n };
    });
  }

  /* Goedkoop genoeg voor elke aanroep: zolang er geen oude bon is, gebeurt er
     niets. Een oude instance die tijdens een uitrol nog een kale bon schrijft,
     wordt bij de eerstvolgende aanroep alsnog overgezet. */
  const zorg = () => (heeftOud() ? migreer() : Promise.resolve({ gemigreerd: 0 }));
  return { migreer, zorg };
};
