/* RTG Synergie: zaken maken samen deals en hele pakketten. Een hotel, een
   restaurant en een vervoerder zetten samen EEN aanbod neer (een weekend,
   een avond, een route) met EEN prijs; elke deelnemer tekent digitaal voor
   zijn aandeel in de opbrengst, en pas als iedereen akkoord is staat het
   pakket live voor leden. Bij aankoop splitst RTG Pay de betaling in EEN
   beweging naar alle deelnemers, exact volgens de afgesproken aandelen: de
   som van de aandelen MOET de pakketprijs zijn (fail-fast, geen stille
   afrondingen). maakSynergie(state) volgt het vaste kern-patroon. */
function maakSynergie({ db, save, crypto, schoon, findSupplier, notifySupplier, pay }) {
  const id = () => 'syn' + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const vandaag = () => nu().slice(0, 10);
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));

  function store() {
    if (!Array.isArray(db.data.synergie)) db.data.synergie = [];
    if (!Array.isArray(db.data.synergieKopen)) db.data.synergieKopen = [];
    return db.data;
  }
  const vind = (dealId) => store().synergie.find(d => d.id === dealId);
  const doetMee = (d, code) => d.aandelen.some(a => a.code === code);
  const zeg = (d, vanCode, tekst) => {
    for (const a of d.aandelen) if (a.code !== vanCode && notifySupplier)
      notifySupplier(a.code, { icon: '🤝', title: 'Synergie', body: tekst });
  };

  function dealMaak(makerCode, body) {
    const naam = scho(body.naam, 60);
    if (naam.length < 3) return { status: 400, error: 'Geef de deal een naam (minstens 3 tekens).' };
    const ruw = Array.isArray(body.aandelen) ? body.aandelen.slice(0, 5) : [];
    if (ruw.length < 2) return { status: 400, error: 'Een deal heeft minstens twee deelnemers.' };
    const prijs = Math.round(Number(body.prijsCenten));
    if (!(prijs >= 500 && prijs <= 1000000)) return { status: 400, error: 'De pakketprijs ligt tussen EUR 5 en EUR 10.000.' };
    const aandelen = [];
    for (const r of ruw) {
      const s = findSupplier(String(r.code || '').toUpperCase());
      if (!s) return { status: 404, error: 'Deelnemer ' + scho(r.code, 12) + ' kennen we niet.' };
      if (aandelen.some(a => a.code === s.code)) return { status: 400, error: 'Elke zaak staat maar een keer in de deal.' };
      const c = Math.round(Number(r.centen));
      if (!(c >= 0)) return { status: 400, error: 'Elk aandeel is 0 of meer centen.' };
      aandelen.push({ code: s.code, naam: s.name, centen: c, akkoord: s.code === makerCode });
    }
    if (!aandelen.some(a => a.code === makerCode)) return { status: 400, error: 'De maker hoort zelf in de deal te staan.' };
    const som = aandelen.reduce((s, a) => s + a.centen, 0);
    if (som !== prijs) return { status: 400, error: 'De aandelen tellen op tot ' + som + ' centen, maar de prijs is ' + prijs + '. Dat moet exact kloppen.' };
    const geldigTot = /^\d{4}-\d{2}-\d{2}$/.test(String(body.geldigTot || '')) ? body.geldigTot : null;
    const d = { id: id(), naam, omschrijving: scho(body.omschrijving, 300), maker: makerCode,
      prijsCenten: prijs, geldigTot, status: 'voorstel', at: nu(), aandelen };
    store().synergie.unshift(d);
    if (store().synergie.length > 2000) store().synergie.pop();
    zeg(d, makerCode, aandelen.find(a => a.code === makerCode).naam + ' stelt de deal "' + naam + '" voor.');
    save();
    return { ok: true, deal: d };
  }

  function dealReageer(code, dealId, akkoord) {
    const d = vind(dealId);
    if (!d || !doetMee(d, code)) return { status: 404, error: 'Deze deal kennen we niet.' };
    if (d.status !== 'voorstel') return { status: 409, error: 'Deze deal is al ' + d.status + '.' };
    const mijn = d.aandelen.find(a => a.code === code);
    if (mijn.akkoord && akkoord) return { ok: true, deal: d };
    if (!akkoord) {
      d.status = 'gestopt';
      zeg(d, code, mijn.naam + ' wijst de deal "' + d.naam + '" af.');
    } else {
      mijn.akkoord = true;
      if (d.aandelen.every(a => a.akkoord)) {
        d.status = 'actief';
        zeg(d, code, 'De deal "' + d.naam + '" is rond: het pakket staat live voor leden.');
      } else zeg(d, code, mijn.naam + ' is akkoord met "' + d.naam + '".');
    }
    save();
    return { ok: true, deal: d };
  }

  function dealStop(code, dealId) {
    const d = vind(dealId);
    if (!d || !doetMee(d, code)) return { status: 404, error: 'Deze deal kennen we niet.' };
    if (d.status === 'gestopt') return { ok: true, deal: d };
    d.status = 'gestopt';
    zeg(d, code, 'De deal "' + d.naam + '" is gestopt.');
    save();
    return { ok: true, deal: d };
  }

  const dealsVoorZaak = (code) => ({ ok: true,
    deals: store().synergie.filter(d => doetMee(d, code)).slice(0, 50) });

  const pakketten = () => ({ ok: true, pakketten: store().synergie
    .filter(d => d.status === 'actief' && (!d.geldigTot || d.geldigTot >= vandaag()))
    .slice(0, 30).map(d => ({ id: d.id, naam: d.naam, omschrijving: d.omschrijving,
      prijsCenten: d.prijsCenten, zaken: d.aandelen.map(a => a.naam) })) });

  /* Betaling in EEN beweging: eerst het saldo tegen de hele prijs, daarna
     per aandeel een grootboekregel. De saldo-check vooraf maakt een halve
     betaling praktisch onmogelijk; elke regel draagt de deal als ref. */
  function pakketKoop(codenaam, dealId, idem) {
    const d = vind(dealId);
    if (!d || d.status !== 'actief' || (d.geldigTot && d.geldigTot < vandaag()))
      return { status: 404, error: 'Dit pakket is niet (meer) beschikbaar.' };
    const sleutel = scho(idem, 60);
    if (sleutel && store().synergieKopen.some(k => k.idem === sleutel && k.codenaam === codenaam))
      return { ok: true, deal: { id: d.id, naam: d.naam }, alBetaald: true };
    const rek = 'lid:' + codenaam;
    if (pay.saldoVan(rek) < d.prijsCenten) return { status: 402, error: 'Onvoldoende saldo voor dit pakket.' };
    for (const a of d.aandelen.filter(a => a.centen > 0)) {
      const b = pay.boek({ van: rek, naar: 'partner:' + a.code, centen: a.centen,
        soort: 'pakket', oms: 'Pakket ' + d.naam, ref: d.id });
      if (b.error) return b;
    }
    store().synergieKopen.unshift({ idem: sleutel || id(), codenaam, dealId: d.id, at: nu() });
    if (store().synergieKopen.length > 5000) store().synergieKopen.pop();
    zeg(d, null, 'Pakket "' + d.naam + '" is geboekt door ' + codenaam + '.');
    save();
    return { ok: true, deal: { id: d.id, naam: d.naam }, betaald: d.prijsCenten };
  }

  return { synergie: { dealMaak, dealReageer, dealStop, dealsVoorZaak, pakketten, pakketKoop } };
}

module.exports = { maakSynergie };
