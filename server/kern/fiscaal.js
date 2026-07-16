/* De fiscale en financiële laag van een zaak: btw-tarieven per genre en land,
   werkgeverslasten, minimumuurloon, de maandboekhouding (financeVoor), de
   AI-boekhouder van de zaak (cannedBoekhouder) en de zzp-regimes per land.

   De tabellen (LANDEN, ZZP, FIN_CAT) zijn pure data en worden rechtstreeks
   geexporteerd; werk het peiljaar en de tabellen elk jaar bij. De rekenende
   functies dragen state (db + helpers) en komen uit maakFiscaal(state), zodat
   ze los te testen zijn en server.js dun blijft. */

const FISCAAL_PEILJAAR = 2025;
const LANDEN = {
  NL: { naam: 'Nederland', alcoholLeeftijd: 18, tarieven: { eten: 9, drank: 21, logies: 9, vervoer: 9, jet: 0, standaard: 21 },
    lasten: 0.28, vakantiegeld: 0.08, uurloonMin: 14.06,
    aangifte: 'Btw-aangifte per kwartaal (of maandelijks), loonaangifte maandelijks bij de Belastingdienst.',
    extra: 'Toeristenbelasting verschilt per gemeente (Amsterdam 12,5% op logies). Eten en niet-alcoholische dranken 9%, alcohol 21%.',
    zakelijk: { horeca: 'Btw op eten en drinken in een horecagelegenheid is NIET aftrekbaar; de kosten zelf zijn wel opvoerbaar.',
      logies: 'Btw op een zakelijke overnachting (9%) is aftrekbaar.',
      vervoer: 'Btw op taxi en openbaar vervoer (9%) is aftrekbaar bij zakelijk gebruik.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief; er is dus geen btw om terug te vorderen.' } },
  BE: { naam: 'Belgie', alcoholLeeftijd: 18, tarieven: { eten: 12, drank: 21, logies: 6, vervoer: 6, jet: 0, standaard: 21 },
    lasten: 0.27, vakantiegeld: 0.092, uurloonMin: 12.11,
    aangifte: 'Btw-aangifte per maand of kwartaal; DIMONA-melding voor elk personeelslid voor de eerste werkdag.',
    extra: 'Restaurantdiensten 12%, dranken 21%; de witte kassa (GKS) is verplicht in de horeca boven de omzetdrempel.',
    zakelijk: { horeca: 'Btw op restaurantkosten is niet aftrekbaar; de kosten zijn voor 69% aftrekbaar in de vennootschapsbelasting.',
      logies: 'Btw op een zakelijke hotelovernachting (6%) is aftrekbaar.',
      vervoer: 'Btw op personenvervoer (6%) is beperkt aftrekbaar.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief.' } },
  DE: { naam: 'Duitsland', alcoholLeeftijd: 18, tarieven: { eten: 19, drank: 19, logies: 7, vervoer: 7, jet: 0, standaard: 19 },
    lasten: 0.21, vakantiegeld: 0, uurloonMin: 12.82,
    aangifte: 'Umsatzsteuer-Voranmeldung per maand of kwartaal via ELSTER; loonaangifte maandelijks.',
    extra: 'Eten in het restaurant 19%, afhaal en bezorging 7%. Hotelovernachting 7%, maar het ontbijt 19%: gesplitst factureren.',
    zakelijk: { horeca: 'Bewirtungskosten: 70% aftrekbaar als kosten; de btw is volledig aftrekbaar met een correct Bewirtungsbeleg.',
      logies: 'Btw op de overnachting (7%) is aftrekbaar; het ontbijt staat apart op 19%.',
      vervoer: 'Btw op taxiritten tot 50 km (7%) is aftrekbaar.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief.' } },
  FR: { naam: 'Frankrijk', alcoholLeeftijd: 18, tarieven: { eten: 10, drank: 20, logies: 10, vervoer: 10, jet: 0, standaard: 20 },
    lasten: 0.42, vakantiegeld: 0, uurloonMin: 11.88,
    aangifte: 'TVA per maand (regime reel) of per kwartaal; taxe de sejour per overnachting per gemeente.',
    extra: 'Eten en niet-alcoholische dranken 10%, alcohol 20%. Werkgeverslasten horen bij de hoogste van Europa.',
    zakelijk: { horeca: 'TVA op zakelijke maaltijden is aftrekbaar met een factuur op bedrijfsnaam.',
      logies: 'TVA op hotelkosten voor eigen werknemers is NIET aftrekbaar; voor genodigden wel.',
      vervoer: 'TVA op personenvervoer is niet aftrekbaar.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief.' } },
  ES: { naam: 'Spanje', alcoholLeeftijd: 18, tarieven: { eten: 10, drank: 21, logies: 10, vervoer: 10, jet: 0, standaard: 21 },
    lasten: 0.30, vakantiegeld: 0, uurloonMin: 8.87,
    aangifte: 'IVA per kwartaal (modelo 303) met een jaaroverzicht (modelo 390); loonaangifte maandelijks.',
    extra: 'Horeca en hotels 10%; alcohol in de winkel 21%, als onderdeel van de horecadienst 10%.',
    zakelijk: { horeca: 'IVA op zakelijke maaltijden is aftrekbaar met een volledige factuur (factura completa).',
      logies: 'IVA op zakelijke overnachtingen is aftrekbaar.',
      vervoer: 'IVA op vervoer is aftrekbaar bij zakelijk gebruik.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief.' } },
  JP: { naam: 'Japan', alcoholLeeftijd: 20, tarieven: { eten: 10, drank: 10, logies: 10, vervoer: 10, jet: 0, standaard: 10 },
    lasten: 0.16, vakantiegeld: 0, uurloonMin: 6.7,
    aangifte: 'Consumption tax (10%) jaarlijks of per kwartaal; sinds 2023 is een qualified invoice vereist voor aftrek.',
    extra: 'Ter plaatse eten 10%, afhaal 8%. Accommodation tax per stad (sommige steden heffen per persoon per nacht).',
    zakelijk: { horeca: 'Consumption tax op zakelijke maaltijden is aftrekbaar met een qualified invoice.',
      logies: 'Consumption tax op het hotel is aftrekbaar; de accommodation tax is een kostenpost.',
      vervoer: 'Consumption tax op taxiritten is aftrekbaar met een qualified invoice.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief.' } }
};

/* ---- de boekhouding van de zaak: btw per genre, personeelskosten, cadeaukaarten ---- */
const FIN_CAT = { eten: 'Eten (keuken)', drank: 'Dranken (bar)', logies: 'Logies', vervoer: 'Personenvervoer', jet: 'Internationaal vervoer', dienst: 'Diensten & producten' };

/* ---- zzp-belastingtool (Business Pass) ----
   Indicatieve berekening voor zelfstandigen per land. Nederland volledig
   (ondernemersaftrek, MKB-vrijstelling, schijven, heffingskortingen, KOR);
   overige landen met het regime en een indicatieve effectieve heffing. */
const ZZP = {
  NL: { regime: 'Eenmanszaak / zzp',
    zelfstandigenaftrek: 2470, startersaftrek: 2123, mkbVrijstelling: 0.127,
    schijven: [[38441, 0.3582], [76817, 0.3748], [Infinity, 0.495]],
    ahk: { max: 3068, afbouwVanaf: 24813, afbouw: 0.06337 },
    arbeidskorting: { max: 5599, afbouwVanaf: 43071, afbouw: 0.0651 },
    korGrens: 20000,
    regels: ['Urencriterium: minimaal 1.225 uur per jaar ondernemen geeft recht op de zelfstandigenaftrek.',
      'MKB-winstvrijstelling: 12,7% van de winst na ondernemersaftrek is vrijgesteld.',
      'KOR: onder € 20.000 omzet per jaar kunt u vrijstelling van btw aanvragen.',
      'Reserveer daarnaast voor de inkomensafhankelijke bijdrage Zvw (~5,26% tot het maximum).'] },
  BE: { regime: 'Zelfstandige in hoofdberoep', simpel: 0.42,
    regels: ['Sociale bijdragen: ~20,5% van het netto belastbaar inkomen, per kwartaal vooruit.',
      'Progressieve personenbelasting van 25% tot 50%, belastingvrije som ~€ 10.910.'] },
  DE: { regime: 'Freiberufler / Einzelunternehmen', simpel: 0.35,
    regels: ['Grundfreibetrag € 12.096; daarboven progressief 14% tot 42% (45% Spitzensteuersatz).',
      'Freiberufler betalen geen Gewerbesteuer; een Gewerbe boven € 24.500 winst wel.'] },
  FR: { regime: 'Micro-entrepreneur (BNC)', simpel: 0.30,
    regels: ['Micro-regime tot € 77.700 omzet voor diensten: sociale lasten ~21,2% van de omzet.',
      'Optioneel versement liberatoire: inkomstenbelasting als vast percentage direct bij de bron.'] },
  ES: { regime: 'Autonomo', simpel: 0.32,
    regels: ['Maandelijkse cuota op basis van de werkelijke inkomsten (tabel per tranche).',
      'IRPF progressief 19% tot 47%; kwartaalvoorschot van 20% via modelo 130.'] },
  JP: { regime: 'Kojin jigyo (eenmanszaak)', simpel: 0.25,
    regels: ['De blauwe aangifte (aoiro shinkoku) geeft tot ¥ 650.000 extra aftrek.',
      'Nationale inkomstenbelasting 5% tot 45%, plus ~10% lokale inkomstenbelasting.'] }
};

/* De rekenende laag: draagt db en de reken-helpers (centen, btwSplit). */
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
  function dagrapport(s, datum) {
    const dag = /^\d{4}-\d{2}-\d{2}$/.test(String(datum || '')) ? String(datum) : new Date().toISOString().slice(0, 10);
    const opDag = iso => String(iso || '').slice(0, 10) === dag;
    const landCode = (s.settings && LANDEN[s.settings.land]) ? s.settings.land : 'NL';
    const L = LANDEN[landCode];
    const caps = (db.data.supplierTypes[s.type] || {}).caps || [];
    const basisCat = caps.includes('rides') ? (s.type === 'jet' ? 'jet' : 'vervoer') : caps.includes('rooms') ? 'logies' : 'eten';
    const catVan = naam => { const m = (s.menu || []).find(x => x.name === naam); return m && m.station === 'bar' ? 'drank' : basisCat === 'eten' ? 'eten' : basisCat; };
    const potten = {};
    const betaalwijzen = {};
    let bonnen = 0, fooien = 0, omzet = 0;
    const tel = (cat, bedrag) => { if (bedrag > 0) potten[cat] = (potten[cat] || 0) + bedrag; };
    for (const o of db.data.orders) {
      if (o.supplierCode !== s.code || !o.paid || !opDag(o.paidAt || o.at)) continue;
      bonnen++;
      fooien += o.fooi || 0;
      let t = 0;
      for (const it of o.items || []) { const b = (it.price || 0) * (it.qty || 1); t += b; tel(catVan(it.name), b); }
      omzet += t;
      betaalwijzen.app = centen((betaalwijzen.app || 0) + t);
    }
    for (const v of db.data.posSales[s.code] || []) {
      if (!opDag(v.at)) continue;
      bonnen++;
      omzet += v.total || 0;
      const m = v.method || 'pin';
      betaalwijzen[m] = centen((betaalwijzen[m] || 0) + (v.total || 0));
      if (m === 'rtg' || m === 'kamer') continue; // interne verrekening: de btw loopt via de hoofdboeking
      if (v.items && v.items.length) for (const it of v.items) tel(catVan(it.name), (it.price || 0) * (it.qty || 1));
      else tel(basisCat, v.total || 0);
    }
    const btw = Object.entries(potten).map(([cat, o2]) => {
      const t = L.tarieven[cat] != null ? L.tarieven[cat] : L.tarieven.standaard;
      return { cat, label: FIN_CAT[cat] || cat, ...btwSplit(o2, t) };
    }).sort((a, b) => b.omzet - a.omzet);
    return { ok: true, datum: dag, land: landCode, bonnen, omzet: centen(omzet), fooien: centen(fooien), betaalwijzen, btw };
  }

  return { financeVoor, cannedBoekhouder, dagrapport };
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
