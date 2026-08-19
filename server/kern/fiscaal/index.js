/* De fiscale en financiële laag van een zaak: btw-tarieven per genre en land,
   werkgeverslasten, minimumuurloon, de maandboekhouding (financeVoor), de
   AI-boekhouder van de zaak (cannedBoekhouder) en de zzp-regimes per land.

   De tabellen (LANDEN, ZZP, FIN_CAT) zijn pure data en worden rechtstreeks
   geexporteerd; werk het peiljaar en de tabellen elk jaar bij. De rekenende
   functies dragen state (db + helpers) en komen uit maakFiscaal(state), zodat
   ze los te testen zijn en server.js dun blijft. Dit is de orkestrator: de
   tabellen wonen in ./landen, de dag-/shiftrapporten in ./rapporten en de
   belastingtool (zzpBerekening) in ./zzp. */

const { FISCAAL_PEILJAAR, LANDEN, FIN_CAT, ZZP } = require('./landen');
const { zzpBerekening } = require('./zzp');
// welke categorie en welk percentage bij deze zaak horen -- op EEN plek, want
// de factuur van de klant vraagt het aan dezelfde routine; zie ./tarief.js
const tarief = require('./tarief');

function maakFiscaal({ db, centen, btwSplit, jaargangen }) {
  /* De regels-op-datum, met terugval op de lopende tabel als de jaargangen er
     (nog) niet zijn -- zie ./regelbron.js. Lui, want server.js bouwt deze laag
     op voordat de Regelwacht bestaat. */
  const regelbron = require('./regelbron')(jaargangen);

  function financeVoor(s) {
    const landCode = tarief.landVan(s);
    const L = LANDEN[landCode];
    const maand = new Date().toISOString().slice(0, 7);
    const inMaand = iso => String(iso || '').slice(0, 7) === maand;
    /* De categorie en het tarief komen uit ./tarief.js -- DEZELFDE routine als
       waarmee kern/facturatie/motor.js de bon van de klant opmaakt. Ze stonden
       hier los van elkaar en liepen uiteen zodra de zaak buiten Nederland zat;
       zie de kop daar. */
    const basisCat = tarief.basisCat(s, db.capsVan(s));
    /* Omzet per belastingcategorie EN PER TARIEF. Bar-items zijn drank,
       keuken-items eten -- en het percentage komt van de dag van de transactie
       zelf, niet van vandaag.

       DAAROM IS DE POT-SLEUTEL CATEGORIE + TARIEF. Verandert een tarief
       halverwege de maand, dan hoort de omzet van voor en na die dag niet op
       een hoop: dat zou een van beide helften tegen het verkeerde percentage
       afdragen. Twee regels in het overzicht is dan het juiste antwoord, en het
       is ook hoe de btw-aangifte zijn potten maakt (kern/fiscaal/btwtelling.js
       telt per tarief, niet per categorie). Verandert er niets, dan is er per
       categorie precies een pot en ziet niemand verschil. */
    const potten = {};
    const catVan = naam => tarief.catVanItem(s, naam, basisCat);
    const tel = (cat, bedrag, datum) => {
      if (!(bedrag > 0)) return;
      const t = regelbron.tariefOp(landCode, cat, String(datum || '').slice(0, 10));
      const sleutel = cat + '@' + t;
      const p = potten[sleutel] || (potten[sleutel] = { cat, tarief: t, omzet: 0 });
      p.omzet += bedrag;
    };
    for (const o of db.data.orders) {
      if (o.supplierCode !== s.code || !o.paid || !inMaand(o.paidAt || o.at)) continue;
      for (const it of o.items || []) tel(catVan(it.name), (it.price || 0) * (it.qty || 1), o.paidAt || o.at);
    }
    for (const v of db.data.posSales[s.code] || []) {
      if (v.method === 'rtg' || v.method === 'kamer' || !inMaand(v.at)) continue;
      if (v.items && v.items.length) for (const it of v.items) tel(catVan(it.name), (it.price || 0) * (it.qty || 1), v.at);
      else tel(basisCat, v.total || 0, v.at);
    }
    for (const r of db.data.rides) {
      if (r.supplierCode !== s.code || !r.paid || !inMaand(r.paidAt || r.at)) continue;
      tel(s.type === 'jet' ? 'jet' : 'vervoer', r.quote || 0, r.paidAt || r.at);
    }
    for (const b of db.data.boekingen) {
      if (b.supplierCode !== s.code || !b.paid || b.status === 'geweigerd' || !inMaand(b.paidAt || b.at)) continue;
      tel('dienst', b.price || 0, b.paidAt || b.at);
    }
    // cadeaukaarten (meervoudig inwisselbaar): btw-moment is de inwisseling
    const kaarten = (db.data.giftcards || []).filter(g => g.supplierCode === s.code);
    const gcVerkocht = kaarten.filter(g => inMaand(g.at)).reduce((x, g) => x + g.bedrag, 0);
    let gcIngewisseld = 0;
    // de inwisseling is het btw-moment, dus die dag bepaalt ook het tarief
    for (const g of kaarten) for (const w of g.verzilveringen || []) if (inMaand(w.at)) { gcIngewisseld += w.bedrag; tel(basisCat, w.bedrag, w.at); }
    const gcOpen = centen(kaarten.reduce((x, g) => x + g.saldo, 0));
    const btw = Object.values(potten)
      .map(p => ({ cat: p.cat, label: FIN_CAT[p.cat] || p.cat, ...btwSplit(p.omzet, p.tarief) }))
      .sort((a, b) => b.omzet - a.omzet);
    // personeelskosten uit de klokuren van deze maand
    const uurloon = (s.settings && Number(s.settings.uurloon)) || 16;
    const duurUur = e => ((e.out ? new Date(e.out) : new Date()) - new Date(e.in)) / 3600000;
    const uren = (db.data.klok[s.code] || []).filter(e => String(e.in).slice(0, 7) === maand).reduce((x, e) => x + duurUur(e), 0);
    const bruto = centen(uren * uurloon);

    /* DE PEILDAG voor de regels die niet aan een transactie hangen
       (werkgeverslasten, vakantiegeld, minimumloon, de aangiftetekst): de
       laatste dag van de gerapporteerde maand, maar nooit later dan vandaag.
       Die tweede helft doet het werk -- op de tiende van de maand zou anders
       een tariefwijziging die pas op de dertigste ingaat, nu al meetellen. */
    const laatsteDag = new Date(Date.UTC(Number(maand.slice(0, 4)), Number(maand.slice(5, 7)), 0)).toISOString().slice(0, 10);
    const nuDag = new Date().toISOString().slice(0, 10);
    const peildag = nuDag < laatsteDag ? nuDag : laatsteDag;
    const R = regelbron.regelsOp(landCode, peildag).regels || L;

    return {
      land: landCode, landNaam: L.naam,
      landen: Object.entries(LANDEN).map(([k, v]) => ({ code: k, naam: v.naam })).sort((a, b) => a.naam.localeCompare(b.naam)),
      peiljaar: FISCAAL_PEILJAAR,
      maand,
      btw, btwTotaal: centen(btw.reduce((x, r2) => x + r2.btw, 0)),
      personeel: {
        uren: Math.round(uren * 10) / 10, uurloon, bruto,
        lasten: centen(bruto * R.lasten), lastenPct: Math.round(R.lasten * 100),
        vakantiegeld: centen(bruto * R.vakantiegeld), vakantiegeldPct: Math.round(R.vakantiegeld * 1000) / 10,
        totaal: centen(bruto * (1 + R.lasten + R.vakantiegeld)),
        uurloonMin: R.uurloonMin
      },
      giftcards: { verkocht: centen(gcVerkocht), ingewisseld: centen(gcIngewisseld), open: gcOpen, aantal: kaarten.length },
      /* WELKE REGELS HIER ONDER LIGGEN: op welke dag is teruggerekend, uit
         welke bron, en welke wijzigingen golden er toen. Zonder die stempel is
         een herbouw van dit bedrag later een gok. */
      regelstand: regelbron.stempel(landCode, peildag),
      regels: [
        R.aangifte,
        R.extra,
        'Cadeaukaarten zijn bij verkoop nog geen omzet: het saldo (€ ' + gcOpen + ') staat als verplichting op de balans en de btw hoort bij de inwisseling.',
        'Indicatie minimumuurloon in ' + L.naam + ': € ' + R.uurloonMin + ' per uur. Reken bovenop het brutoloon ~' + Math.round(R.lasten * 100) + '% werkgeverslasten' + (R.vakantiegeld ? ' en ' + Math.round(R.vakantiegeld * 1000) / 10 + '% vakantiegeld' : '') + '.',
        'Dit overzicht is voorlichting (peiljaar ' + FISCAAL_PEILJAAR + '), geen fiscaal advies; de aangifte en afdracht blijven de verantwoordelijkheid van de onderneming.'
      ]
    };
  }

  // AI-boekhouder van de zaak: kent het land, de regels en de eigen cijfers
  function cannedBoekhouder(vraag, fin, L) {
    const v = vraag.toLowerCase();
    if (/btw|vat|tarief|belasting|afdra/.test(v))
      return 'In ' + L.naam + ' gelden voor u deze tarieven: ' + fin.btw.map(r => r.label + ' ' + r.tarief + '%').join(', ') + '. Deze maand is de af te dragen btw € ' + fin.btwTotaal + ' over € ' + centen(fin.btw.reduce((x, r) => x + r.grondslag, 0)) + ' grondslag. ' + L.aangifte;
    if (/personeel|loon|salaris|lasten|vakantiegeld|kost/.test(v))
      return 'Deze maand: ' + fin.personeel.uren + ' geklokte uren tegen € ' + fin.personeel.uurloon + ' = € ' + fin.personeel.bruto + ' bruto. Daar komt ~' + fin.personeel.lastenPct + '% werkgeverslasten (€ ' + fin.personeel.lasten + ')' + (fin.personeel.vakantiegeld ? ' en ' + fin.personeel.vakantiegeldPct + '% vakantiegeldreserve (€ ' + fin.personeel.vakantiegeld + ')' : '') + ' bij: totaal € ' + fin.personeel.totaal + '. Indicatie minimumuurloon in ' + L.naam + ': € ' + fin.personeel.uurloonMin + '.';
    if (/cadeau|bon|kaart|voucher|gift/.test(v))
      return 'Uw cadeaukaarten zijn meervoudig inwisselbaar: de verkoop (deze maand € ' + fin.giftcards.verkocht + ') is nog geen omzet en kent geen btw. Pas bij inwisseling (deze maand € ' + fin.giftcards.ingewisseld + ') boekt u omzet met btw. Het openstaande saldo van € ' + fin.giftcards.open + ' staat als verplichting op de balans.';
    if (/aangifte|deadline|wanneer|termijn/.test(v))
      return L.aangifte + ' ' + L.extra;
    return 'Uw maand in ' + L.naam + ': af te dragen btw € ' + fin.btwTotaal + ', personeelskosten € ' + fin.personeel.totaal + ' (' + fin.personeel.uren + ' uur), cadeaukaarten € ' + fin.giftcards.open + ' open. Vraag me naar btw, personeelskosten, cadeaukaarten of aangiftetermijnen. Dit is voorlichting, geen bindend fiscaal advies.';
  }

  /* Het Z-rapport (dagafsluiting) en de shift-samenvatting draaien als
     submodule op de gedeelde context (een keer bij het opstarten opgebouwd). */
  const { dagrapport, shiftSamenvatting } = require('./rapporten')({ db, centen, btwSplit, financeVoor, regelbron });

  return { financeVoor, cannedBoekhouder, dagrapport, shiftSamenvatting };
}

module.exports = { FISCAAL_PEILJAAR, LANDEN, FIN_CAT, ZZP, maakFiscaal, zzpBerekening };
