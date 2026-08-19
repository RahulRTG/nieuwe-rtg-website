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

function maakFiscaal({ db, centen, btwSplit }) {
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
    // omzet per belastingcategorie: bar-items zijn drank, keuken-items eten
    const potten = {};
    const tel = (cat, bedrag) => { if (bedrag > 0) potten[cat] = (potten[cat] || 0) + bedrag; };
    const catVan = naam => tarief.catVanItem(s, naam, basisCat);
    for (const o of db.data.orders) {
      if (o.supplierCode !== s.code || !o.paid || !inMaand(o.paidAt || o.at)) continue;
      for (const it of o.items || []) tel(catVan(it.name), (it.price || 0) * (it.qty || 1));
    }
    for (const v of db.data.posSales[s.code] || []) {
      /* `omzetElders` is het merk van een kassabon die alleen HET STUK is en
         niet de omzet: het tafelticket bundelt bonnen die hierboven al per
         bestelling zijn geteld. Zonder deze regel stond de maand van een zaak
         die tafels contant laat afrekenen twee keer zo hoog (TAKEN.md 4.28). */
      if (v.omzetElders || v.method === 'rtg' || v.method === 'kamer' || !inMaand(v.at)) continue;
      if (v.items && v.items.length) for (const it of v.items) tel(catVan(it.name), (it.price || 0) * (it.qty || 1));
      else tel(basisCat, v.total || 0);
    }
    for (const r of db.data.rides) {
      if (r.supplierCode !== s.code || !r.paid || !inMaand(r.paidAt || r.at)) continue;
      tel(s.type === 'jet' ? 'jet' : 'vervoer', r.quote || 0);
    }
    for (const b of db.data.boekingen) {
      if (b.supplierCode !== s.code || !b.paid || b.status === 'geweigerd' || !inMaand(b.paidAt || b.at)) continue;
      tel('dienst', b.price || 0);
    }
    /* Cadeaukaarten (meervoudig inwisselbaar): het btw-moment is de INWISSELING,
       niet de verkoop -- de verkoop is een schuld aan de klant.

       WAAROM ER TWEE GETALLEN ZIJN. Een verzilvering met `viaBon` hoort bij een
       kassabon die met de kaart is betaald, en die bon staat hierboven al in de
       potten -- met zijn eigen regels, dus met het juiste tarief per artikel.
       Hem hier nog eens optellen was precies de dubbeltelling van TAKEN.md 4.27.
       Een verzilvering ZONDER bon (de losse inwisseling aan de balie) heeft geen
       ander omzetmoment, en die telt hier dus wel -- anders zou die omzet
       nergens meer staan. `ingewisseld` in het rapport blijft het VOLLE bedrag:
       dat is wat de ondernemer van zijn kaarten wil weten, en dat is een andere
       vraag dan waar de omzet is geboekt. */
    const kaarten = (db.data.giftcards || []).filter(g => g.supplierCode === s.code);
    const gcVerkocht = kaarten.filter(g => inMaand(g.at)).reduce((x, g) => x + g.bedrag, 0);
    let gcIngewisseld = 0, gcZonderBon = 0;
    for (const g of kaarten) for (const w of g.verzilveringen || []) {
      if (!inMaand(w.at)) continue;
      gcIngewisseld += w.bedrag;
      if (!w.viaBon) gcZonderBon += w.bedrag;
    }
    if (gcZonderBon) tel(basisCat, gcZonderBon);
    const gcOpen = centen(kaarten.reduce((x, g) => x + g.saldo, 0));
    const btw = Object.entries(potten).map(([cat, omzet]) =>
      ({ cat, label: FIN_CAT[cat] || cat, ...btwSplit(omzet, tarief.tariefVan(s, cat)) }))
      .sort((a, b) => b.omzet - a.omzet);
    // personeelskosten uit de klokuren van deze maand
    const uurloon = (s.settings && Number(s.settings.uurloon)) || 16;
    const duurUur = e => ((e.out ? new Date(e.out) : new Date()) - new Date(e.in)) / 3600000;
    const uren = (db.data.klok[s.code] || []).filter(e => String(e.in).slice(0, 7) === maand).reduce((x, e) => x + duurUur(e), 0);
    const bruto = centen(uren * uurloon);
    return {
      land: landCode, landNaam: L.naam,
      landen: Object.entries(LANDEN).map(([k, v]) => ({ code: k, naam: v.naam })).sort((a, b) => a.naam.localeCompare(b.naam)),
      peiljaar: FISCAAL_PEILJAAR,
      maand,
      btw, btwTotaal: centen(btw.reduce((x, r2) => x + r2.btw, 0)),
      personeel: {
        uren: Math.round(uren * 10) / 10, uurloon, bruto,
        lasten: centen(bruto * L.lasten), lastenPct: Math.round(L.lasten * 100),
        vakantiegeld: centen(bruto * L.vakantiegeld), vakantiegeldPct: Math.round(L.vakantiegeld * 1000) / 10,
        totaal: centen(bruto * (1 + L.lasten + L.vakantiegeld)),
        uurloonMin: L.uurloonMin
      },
      giftcards: { verkocht: centen(gcVerkocht), ingewisseld: centen(gcIngewisseld), open: gcOpen, aantal: kaarten.length },
      regels: [
        L.aangifte,
        L.extra,
        'Cadeaukaarten zijn bij verkoop nog geen omzet: het saldo (€ ' + gcOpen + ') staat als verplichting op de balans en de btw hoort bij de inwisseling.',
        'Indicatie minimumuurloon in ' + L.naam + ': € ' + L.uurloonMin + ' per uur. Reken bovenop het brutoloon ~' + Math.round(L.lasten * 100) + '% werkgeverslasten' + (L.vakantiegeld ? ' en ' + Math.round(L.vakantiegeld * 1000) / 10 + '% vakantiegeld' : '') + '.',
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
  const { dagrapport, shiftSamenvatting } = require('./rapporten')({ db, centen, btwSplit, financeVoor });

  return { financeVoor, cannedBoekhouder, dagrapport, shiftSamenvatting };
}

module.exports = { FISCAAL_PEILJAAR, LANDEN, FIN_CAT, ZZP, maakFiscaal, zzpBerekening };
