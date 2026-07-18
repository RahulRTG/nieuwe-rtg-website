/* De fiscale en financiële laag van een zaak: btw-tarieven per genre en land,
   werkgeverslasten, minimumuurloon, de maandboekhouding (financeVoor), de
   AI-boekhouder van de zaak (cannedBoekhouder) en de zzp-regimes per land.

   De tabellen (LANDEN, ZZP, FIN_CAT) zijn pure data en worden rechtstreeks
   geexporteerd; werk het peiljaar en de tabellen elk jaar bij. De rekenende
   functies dragen state (db + helpers) en komen uit maakFiscaal(state), zodat
   ze los te testen zijn en server.js dun blijft. */

const { FISCAAL_PEILJAAR, LANDEN, FIN_CAT, ZZP } = require('./fiscaal/landen');

function maakFiscaal({ db, centen, btwSplit }) {
  function financeVoor(s) {
    const landCode = (s.settings && LANDEN[s.settings.land]) ? s.settings.land : 'NL';
    const L = LANDEN[landCode];
    const maand = new Date().toISOString().slice(0, 7);
    const inMaand = iso => String(iso || '').slice(0, 7) === maand;
    const caps = (db.data.supplierTypes[s.type] || {}).caps || [];
    const basisCat = caps.includes('rides') ? (s.type === 'jet' ? 'jet' : 'vervoer') : caps.includes('rooms') ? 'logies' : 'eten';
    // omzet per belastingcategorie: bar-items zijn drank, keuken-items eten
    const potten = {};
    const tel = (cat, bedrag) => { if (bedrag > 0) potten[cat] = (potten[cat] || 0) + bedrag; };
    const catVan = naam => { const m = (s.menu || []).find(x => x.name === naam); return m && m.station === 'bar' ? 'drank' : basisCat === 'eten' ? 'eten' : basisCat; };
    for (const o of db.data.orders) {
      if (o.supplierCode !== s.code || !o.paid || !inMaand(o.paidAt || o.at)) continue;
      for (const it of o.items || []) tel(catVan(it.name), (it.price || 0) * (it.qty || 1));
    }
    for (const v of db.data.posSales[s.code] || []) {
      if (v.method === 'rtg' || v.method === 'kamer' || !inMaand(v.at)) continue;
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
    // cadeaukaarten (meervoudig inwisselbaar): btw-moment is de inwisseling
    const kaarten = (db.data.giftcards || []).filter(g => g.supplierCode === s.code);
    const gcVerkocht = kaarten.filter(g => inMaand(g.at)).reduce((x, g) => x + g.bedrag, 0);
    let gcIngewisseld = 0;
    for (const g of kaarten) for (const w of g.verzilveringen || []) if (inMaand(w.at)) gcIngewisseld += w.bedrag;
    if (gcIngewisseld) tel(basisCat, gcIngewisseld);
    const gcOpen = centen(kaarten.reduce((x, g) => x + g.saldo, 0));
    const btw = Object.entries(potten).map(([cat, omzet]) => {
      const t = L.tarieven[cat] != null ? L.tarieven[cat] : L.tarieven.standaard;
      return { cat, label: FIN_CAT[cat] || cat, ...btwSplit(omzet, t) };
    }).sort((a, b) => b.omzet - a.omzet);
    // personeelskosten uit de klokuren van deze maand
    const uurloon = (s.settings && Number(s.settings.uurloon)) || 16;
    const duurUur = e => ((e.out ? new Date(e.out) : new Date()) - new Date(e.in)) / 3600000;
    const uren = (db.data.klok[s.code] || []).filter(e => String(e.in).slice(0, 7) === maand).reduce((x, e) => x + duurUur(e), 0);
    const bruto = centen(uren * uurloon);
    return {
      land: landCode, landNaam: L.naam,
      landen: Object.entries(LANDEN).map(([k, v]) => ({ code: k, naam: v.naam })),
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

  /* Het Z-rapport (dagafsluiting): omzet, bonnen, fooien, betaalwijzen en de
     btw-splitsing van EEN dag, met dezelfde categorielogica als het
     maandoverzicht. Voedt de dagafsluiting op de kassa en de
     boekhoudexport (journaalregels als CSV). */
  /* dagrapport en shift-samenvatting draaien als submodule op de gedeelde
     context (een keer bij het opstarten opgebouwd). */
  const { dagrapport, shiftSamenvatting } = require('./fiscaal/rapporten')({ db, centen, btwSplit, financeVoor });

  return { financeVoor, cannedBoekhouder, dagrapport, shiftSamenvatting };
}

/* De belastingtool: een indicatieve jaarberekening voor ondernemers, per
   land. Wordt door de Business Pass (zzp-tool) EN door elke leverancier
   (Kantoor) gebruikt; een berekening, overal hetzelfde antwoord. */
const { centen } = require('./util');
function zzpBerekening(land, winstIn, opties) {
  const landCode = ZZP[land] ? land : 'NL';
  const Z = ZZP[landCode];
  const winst = Math.max(0, Math.min(5000000, Math.round(Number(winstIn) || 0)));
  if (!winst) return { error: 'Vul de verwachte jaarwinst in.', status: 400 };
  const o = opties || {};
  const out = { land: landCode, landNaam: LANDEN[landCode].naam, regime: Z.regime, winst, posten: [], regels: Z.regels.slice(), indicatie: true, peiljaar: FISCAAL_PEILJAAR };
  let belasting = 0, belastbaar = winst;
  if (landCode === 'NL') {
    const uren = o.urencriterium !== false;
    const za = uren ? Math.min(Z.zelfstandigenaftrek, winst) : 0;
    const sa = uren && o.starter ? Z.startersaftrek : 0;
    const rest = Math.max(0, winst - za - sa);
    const mkb = centen(rest * Z.mkbVrijstelling);
    belastbaar = centen(rest - mkb);
    out.posten.push(za ? { label: 'Zelfstandigenaftrek', bedrag: -za }
                       : { label: 'Zelfstandigenaftrek (urencriterium niet gehaald)', bedrag: 0 });
    if (sa) out.posten.push({ label: 'Startersaftrek', bedrag: -sa });
    out.posten.push({ label: 'MKB-winstvrijstelling (12,7%)', bedrag: -mkb });
    let vorige = 0, ib = 0;
    for (const [grens, tarief] of Z.schijven) {
      const deel = Math.max(0, Math.min(belastbaar, grens) - vorige);
      ib += deel * tarief;
      vorige = grens;
      if (belastbaar <= grens) break;
    }
    const ahk = Math.max(0, Z.ahk.max - Math.max(0, belastbaar - Z.ahk.afbouwVanaf) * Z.ahk.afbouw);
    const ak = Math.max(0, Z.arbeidskorting.max - Math.max(0, belastbaar - Z.arbeidskorting.afbouwVanaf) * Z.arbeidskorting.afbouw);
    const korting = Math.min(ib, ahk + ak);
    belasting = Math.max(0, centen(ib - korting));
    out.posten.push({ label: 'Inkomstenbelasting (schijven)', bedrag: centen(ib) });
    out.posten.push({ label: 'Heffingskortingen (indicatie)', bedrag: -centen(korting) });
    if (winst < Z.korGrens) out.regels.unshift('Met deze omzet komt u waarschijnlijk in aanmerking voor de KOR (btw-vrijstelling): minder administratie, geen btw-aangifte.');
  } else {
    belasting = centen(winst * Z.simpel);
    out.posten.push({ label: 'Indicatieve heffing (~' + Math.round(Z.simpel * 100) + '% effectief, incl. sociale lasten)', bedrag: belasting });
  }
  out.belastbaar = centen(belastbaar);
  out.belasting = belasting;
  out.netto = centen(winst - belasting);
  out.reserveerPct = Math.max(20, Math.min(50, Math.round(belasting / winst * 100) + 5));
  out.perMaand = centen(belasting / 12);
  out.regels.push('Indicatieve berekening op basis van de tarieven van ' + FISCAAL_PEILJAAR + '; controleer jaarlijks en raadpleeg voor uw aangifte een fiscalist.');
  return out;
}

module.exports = { FISCAAL_PEILJAAR, LANDEN, FIN_CAT, ZZP, maakFiscaal, zzpBerekening };
