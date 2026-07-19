/* De RTG Mall: de luxe shoppingmall in de leden-app. Een gecureerde lijst met
   etages (verdiepingen) van de mode- en retailpartners van RTG. Elke boutique
   opent haar eigen catalogus (ledenprijs, verlanglijst, naar de paskamer) via
   het bestaande retail-endpoint. De mall stelt zich samen uit de
   retail-partners; een paar demo-boutieks zorgen dat de etages gevuld zijn.

   Geen echte modemerken; RTG-huisnamen. Beeld met CSS, geen stockfoto's.
   Volgt het vaste kern-patroon maakMall(state). */

const ETAGES = [
  { id: 'mode',     label: 'Mode',                 icon: '👗' },
  { id: 'sieraden', label: 'Sieraden & horloges',  icon: '💎' },
  { id: 'leer',     label: 'Leer & accessoires',   icon: '👜' },
  { id: 'wonen',    label: 'Wonen & interieur',    icon: '🛋️' },
  { id: 'beauty',   label: 'Parfum & beauty',      icon: '🧴' }
];
const ETAGE_IDS = ETAGES.map(e => e.id);

function maakMall({ db, save, crypto, isRetail }) {
  const nu = () => new Date().toISOString();
  const va = (sku, kleuren, maten, v) => {
    const out = [];
    for (const k of kleuren) for (const m of maten) out.push({ vsku: sku + '-' + k.slice(0, 3).toUpperCase() + '-' + m, kleur: k, maat: m, voorraad: v });
    return out;
  };

  function seed() {
    if (!db.data.suppliers || !Array.isArray(db.data.suppliers)) return;
    if (!db.data.supplierTypes.retail)
      db.data.supplierTypes.retail = { label: 'Mode & retail', icon: '🛍️', caps: ['retail', 'location', 'pricing'] };
    // de bestaande modepartner op de mode-etage zetten
    const maison = db.data.suppliers.find(s => s.code === 'MAISON');
    if (maison && !maison.mall) maison.mall = { etage: 'mode', tagline: 'Stille luxe uit eigen atelier, gesneden op de Riviera.' };

    if (db.data._mallSeed) return;
    db.data._mallSeed = true;
    const boutieks = [
      {
        code: 'ORFEVRE', name: 'Maison Orfèvre', type: 'retail', city: 'Ibiza',
        loc: { lat: 38.906, lng: 1.436, label: 'Dalt Vila, Ibiza' }, rate: 0.10, menu: [], photos: [],
        settings: { retailDrempel: 2 }, mall: { etage: 'sieraden', tagline: 'Hoge juwelierskunst en horloges, met de hand gezet.' },
        collecties: [{ id: crypto.randomBytes(4).toString('hex'), naam: 'Astrale', seizoen: 'AW', jaar: 2026, actief: true, at: nu() }],
        artikelen: [
          { id: crypto.randomBytes(4).toString('hex'), sku: 'ORF-RING', naam: 'Solitaire ring', categorie: 'Ringen',
            materiaal: '18k witgoud, laboratoriumdiamant', omschrijving: 'Klassieke solitaire, onzichtbare zetting.', foto: null,
            publiekePrijs: 4200, price: 4200, drop: null, at: nu(), varianten: va('ORF-RING', ['Witgoud', 'Roségoud'], ['50', '54', '58'], 2) },
          { id: crypto.randomBytes(4).toString('hex'), sku: 'ORF-WATCH', naam: 'Automaat horloge', categorie: 'Horloges',
            materiaal: 'Titanium, saffierglas', omschrijving: 'In-house uurwerk, 72 uur gangreserve.', foto: null,
            publiekePrijs: 8900, price: 8900, drop: null, at: nu(), varianten: va('ORF-WATCH', ['Antraciet', 'Zilver'], ['39mm', '41mm'], 1) }
        ],
        klanten: {}
      },
      {
        code: 'CUIRHUIS', name: 'Le Cuir', type: 'retail', city: 'Ibiza',
        loc: { lat: 38.908, lng: 1.434, label: 'Marina Botafoch, Ibiza' }, rate: 0.10, menu: [], photos: [],
        settings: { retailDrempel: 3 }, mall: { etage: 'leer', tagline: 'Leerwaren, gelooid en gestikt op bestelling.' },
        collecties: [{ id: crypto.randomBytes(4).toString('hex'), naam: 'Voyage', seizoen: 'SS', jaar: 2026, actief: true, at: nu() }],
        artikelen: [
          { id: crypto.randomBytes(4).toString('hex'), sku: 'CUI-TAS', naam: 'Weekendtas', categorie: 'Tassen',
            materiaal: 'Plantaardig gelooid rundleer', omschrijving: 'Handgestikt, messing beslag, katoenen voering.', foto: null,
            publiekePrijs: 1650, price: 1650, drop: null, at: nu(), varianten: va('CUI-TAS', ['Cognac', 'Zwart'], ['one'], 4) },
          { id: crypto.randomBytes(4).toString('hex'), sku: 'CUI-RIEM', naam: 'Ceintuur', categorie: 'Riemen',
            materiaal: 'Volnerf kalfsleer', omschrijving: 'Omkeerbaar, geborsteld gesp.', foto: null,
            publiekePrijs: 240, price: 240, drop: null, at: nu(), varianten: va('CUI-RIEM', ['Cognac', 'Zwart'], ['85', '90', '95'], 6) }
        ],
        klanten: {}
      }
    ];
    for (const b of boutieks) if (!db.data.suppliers.find(s => s.code === b.code)) db.data.suppliers.push(b);
    save();
  }

  function vanafPrijs(s) {
    const prijzen = (s.artikelen || []).map(a => Math.max(0, Number(a.publiekePrijs || a.price) || 0)).filter(Boolean);
    return prijzen.length ? Math.min(...prijzen) : null;
  }
  function boutiek(s) {
    const cats = [...new Set((s.artikelen || []).map(a => a.categorie).filter(Boolean))];
    return {
      code: s.code, naam: s.name, stad: s.city || null,
      etage: (s.mall && ETAGE_IDS.includes(s.mall.etage)) ? s.mall.etage : 'mode',
      tagline: (s.mall && s.mall.tagline) || 'Een huis binnen de RTG Mall.',
      categorieen: cats.slice(0, 4), aantal: (s.artikelen || []).length, vanaf: vanafPrijs(s)
    };
  }

  function overzicht() {
    seed();
    const winkels = (db.data.suppliers || []).filter(s => isRetail(s)).map(boutiek);
    const etages = ETAGES.map(e => ({ ...e, boutieks: winkels.filter(b => b.etage === e.id) }))
      .filter(e => e.boutieks.length);
    return {
      ok: true,
      etages,
      totaalBoutieks: winkels.length,
      valuta: 'EUR',
      opmerking: 'Ledenprijzen gelden in de boutique; prijzen in euro, exclusief eventuele lokale btw.'
    };
  }

  return { mall: { ETAGES, overzicht, seed } };
}

module.exports = { maakMall, MALL_ETAGES: ETAGES };
