/* RTG Mall, deelbestand "demozaken": de boutieks en de boerderij waarmee de
   etages gevuld zijn zolang er nog geen echte partners op staan.

   Staat apart omdat het DATA is en geen logica: de orkestrator hoort te laten
   zien hoe de Mall in elkaar zit, niet welke ring er in de demo-etalage ligt.
   In productie draait dit ook, maar dan tegen een lege leverancierslijst: de
   seed voegt alleen toe wat er nog niet is. Geen echte modemerken; RTG-
   huisnamen, en beeld met CSS in plaats van stockfoto's. */
module.exports = (ctx) => {
  const { db, save, crypto, nu, va } = ctx;

  function seed() {
    if (!db.data.suppliers || !Array.isArray(db.data.suppliers)) return;
    require('../../seed/genres').zetGenre(db, 'retail');
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
    // een demo-boerderij voor de etage "Van het land"
    require('../../seed/genres').zetGenre(db, 'boerderij');
    if (!db.data.suppliers.find(s => s.code === 'HOEVE')) {
      db.data.suppliers.push({
        code: 'HOEVE', name: 'Hoeve del Sol', type: 'boerderij', city: 'Ibiza',
        loc: { lat: 38.98, lng: 1.43, label: 'Santa Gertrudis, Ibiza' }, rate: 0.10, menu: [], photos: [],
        mall: { etage: 'land', tagline: 'Vers van het eiland: groente, olijfolie en honing van eigen erf.' },
        boerderij: {
          type: 'gemengd', opgezet: true, percelen: [], dieren: [], taken: [], instel: {},
          producten: [
            { id: crypto.randomBytes(4).toString('hex'), naam: 'Olijfolie extra vergine', eenheid: 'fles 500 ml', prijs: 18, voorraad: 120, bron: 'oogst' },
            { id: crypto.randomBytes(4).toString('hex'), naam: 'Bloesemhoning', eenheid: 'pot 350 g', prijs: 9, voorraad: 80, bron: 'oogst' },
            { id: crypto.randomBytes(4).toString('hex'), naam: 'Groentepakket van het seizoen', eenheid: 'per pakket', prijs: 22, voorraad: 40, bron: 'oogst' }
          ]
        },
        klanten: {}
      });
    }
    save();
  }

  ctx.seed = seed;
  return { seed };
};
