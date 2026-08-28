/* DE TAFELLIJST met wensen en allergenen, voor de horeca en voor events.

   Het zorgprofiel van een gast bestaat al (kern/gastzorg.js) en reist mee
   met zijn eigen bestelling. Dat werkt voor iemand die zelf bestelt, maar
   niet voor een tafel van twaalf op een event, waar de gastvrouw de
   wensen doorgeeft en de keuken moet weten wat er waar op tafel komt.

   Deze laag is dat ontbrekende stuk: een lijst PER TAFEL, met per stoel
   wie er zit en wat die niet kan of niet wil eten. Daaruit rolt vanzelf:
   - de bediening ziet het per stoel ("stoel 3: geen noten"), zodat het
     bord bij de juiste gast landt;
   - de keuken ziet het per tafel opgeteld ("tafel 4: 2x noten, 1x vegan"),
     want zo werkt een keuken: per uitgifte, niet per persoon;
   - de zaak ziet in een oogopslag welke tafels vandaag aandacht vragen.

   Namen: een lid staat op zijn codenaam (privacy by design), een gast van
   buiten met de voornaam die de gastvrouw doorgeeft, of gewoon met het
   stoelnummer. Meer heeft de keuken niet nodig. */
module.exports = ({ db, save, crypto, schoon }) => {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/tafelwensen', bezit: { tafelWensen: 'kaart' } });
  const nu = () => new Date().toISOString();
  const bak = () => eigen.bak('tafelWensen');
  const vanZaak = code => { const b = bak(); if (!Array.isArray(b[code])) b[code] = []; return b[code]; };

  /* De veertien wettelijke allergenen, plus de dieetwensen die een keuken
     in de praktijk net zo hard nodig heeft. */
  const ALLERGENEN = ['gluten', 'schaaldieren', 'eieren', 'vis', 'pinda', 'noten', 'soja', 'melk',
    'selderij', 'mosterd', 'sesam', 'sulfiet', 'lupine', 'weekdieren'];
  const WENSEN = ['vegetarisch', 'veganistisch', 'halal', 'koosjer', 'glutenvrij', 'lactosevrij',
    'zoutarm', 'suikervrij', 'geen alcohol', 'geen varkensvlees', 'geen rauw'];

  const filterOp = (ruw, mag) => (Array.isArray(ruw) ? ruw : []).filter(x => mag.includes(x)).slice(0, mag.length);

  /* Een tafel zetten of bijwerken. De tafel is van de zaak; het event is
     optioneel en groepeert tafels van dezelfde avond. */
  function tafelZet(zaak, data, id) {
    data = data || {};
    const rijen = vanZaak(zaak);
    const bestaand = id ? rijen.find(t => t.id === String(id)) : null;
    if (id && !bestaand) return { status: 404, error: 'Deze tafel staat niet op de lijst.' };
    const tafel = schoon(data.tafel, 20);
    if (!tafel) return { status: 400, error: 'Welke tafel is het?' };
    const gastenRuw = Array.isArray(data.gasten) ? data.gasten.slice(0, 30) : [];
    const gasten = gastenRuw.map((g, i) => ({
      stoel: Math.max(1, Math.round(Number((g || {}).stoel) || i + 1)),
      naam: schoon((g || {}).naam, 40) || null,
      allergenen: filterOp((g || {}).allergenen, ALLERGENEN),
      wensen: filterOp((g || {}).wensen, WENSEN),
      notitie: schoon((g || {}).notitie, 120)
    })).sort((a, b) => a.stoel - b.stoel);
    const t = bestaand || { id: 'TW' + crypto.randomBytes(3).toString('hex').toUpperCase(), zaak, at: nu() };
    Object.assign(t, {
      tafel, gasten,
      event: schoon(data.event, 60) || null,
      wanneer: schoon(data.wanneer, 20) || null,
      gastvrouw: schoon(data.gastvrouw, 40) || null,
      notitie: schoon(data.notitie, 200),
      bijgewerkt: nu()
    });
    if (!bestaand) {
      rijen.unshift(t);
      if (rijen.length > 2000) rijen.length = 2000;
    }
    save();
    return { ok: true, tafel: metTelling(t) };
  }

  /* De optelling die de keuken wil zien: per allergeen en per wens hoeveel
     borden het raakt, plus welke stoelen dat zijn. */
  function telling(t) {
    const per = {};
    for (const g of t.gasten || []) {
      for (const a of g.allergenen) { per[a] = per[a] || { soort: 'allergeen', wat: a, aantal: 0, stoelen: [] }; per[a].aantal++; per[a].stoelen.push(g.stoel); }
      for (const w of g.wensen) { per[w] = per[w] || { soort: 'wens', wat: w, aantal: 0, stoelen: [] }; per[w].aantal++; per[w].stoelen.push(g.stoel); }
    }
    const rijen = Object.values(per).sort((a, b) => (a.soort === b.soort ? b.aantal - a.aantal : a.soort === 'allergeen' ? -1 : 1));
    return { rijen, allergenen: rijen.filter(r => r.soort === 'allergeen').reduce((n, r) => n + r.aantal, 0),
      wensen: rijen.filter(r => r.soort === 'wens').reduce((n, r) => n + r.aantal, 0) };
  }

  function metTelling(t) {
    const tel = telling(t);
    return Object.assign({}, t, { telling: tel.rijen, aantalGasten: (t.gasten || []).length,
      allergenenTotaal: tel.allergenen, wensenTotaal: tel.wensen,
      let_op: tel.allergenen > 0 });
  }

  function tafelLijst(zaak, f) {
    f = f || {};
    let rijen = vanZaak(zaak);
    if (f.event) rijen = rijen.filter(t => (t.event || '') === f.event);
    if (f.wanneer) rijen = rijen.filter(t => (t.wanneer || '') === f.wanneer);
    return { ok: true, allergenen: ALLERGENEN, wensen: WENSEN,
      tafels: rijen.slice(0, 200).map(metTelling),
      events: [...new Set(vanZaak(zaak).map(t => t.event).filter(Boolean))] };
  }

  function tafelWeg(zaak, id) {
    const rijen = vanZaak(zaak);
    const i = rijen.findIndex(t => t.id === String(id || ''));
    if (i < 0) return { status: 404, error: 'Deze tafel staat niet op de lijst.' };
    rijen.splice(i, 1);
    save();
    return { ok: true, weg: String(id) };
  }

  /* Het keukenbord: alles van vandaag (of van een event) op één scherm,
     op de manier waarop een keuken werkt. Tafels met een allergeen staan
     bovenaan, want daar mag niets misgaan. */
  function keukenbord(zaak, f) {
    f = f || {};
    let rijen = vanZaak(zaak);
    if (f.event) rijen = rijen.filter(t => (t.event || '') === f.event);
    if (f.wanneer) rijen = rijen.filter(t => (t.wanneer || '') === f.wanneer);
    const tafels = rijen.map(metTelling).sort((a, b) => b.allergenenTotaal - a.allergenenTotaal || String(a.tafel).localeCompare(String(b.tafel)));
    const totaal = {};
    for (const t of tafels) for (const r of t.telling) {
      totaal[r.wat] = totaal[r.wat] || { soort: r.soort, wat: r.wat, aantal: 0, tafels: [] };
      totaal[r.wat].aantal += r.aantal;
      totaal[r.wat].tafels.push(t.tafel);
    }
    return { ok: true,
      tafels: tafels.slice(0, 100),
      samen: Object.values(totaal).sort((a, b) => (a.soort === b.soort ? b.aantal - a.aantal : a.soort === 'allergeen' ? -1 : 1)),
      gasten: tafels.reduce((n, t) => n + t.aantalGasten, 0),
      tafelsMetAllergeen: tafels.filter(t => t.let_op).length,
      regel: 'Een allergeen is geen voorkeur. Twijfelt de keuken, dan gaat het gerecht niet de deur uit maar gaat er iemand naar de tafel.' };
  }

  /* De bedieningskaart van een tafel: per stoel één regel, kort genoeg om
     mee te lopen. */
  function bedieningskaart(zaak, id) {
    const t = vanZaak(zaak).find(x => x.id === String(id || ''));
    if (!t) return { status: 404, error: 'Deze tafel staat niet op de lijst.' };
    return { ok: true, tafel: t.tafel, event: t.event, wanneer: t.wanneer, gastvrouw: t.gastvrouw,
      stoelen: (t.gasten || []).map(g => ({
        stoel: g.stoel, naam: g.naam || ('stoel ' + g.stoel),
        regel: [g.allergenen.length ? 'ALLERGIE: ' + g.allergenen.join(', ') : '', g.wensen.join(', '), g.notitie]
          .filter(Boolean).join(' · ') || 'geen bijzonderheden',
        let_op: g.allergenen.length > 0
      })),
      notitie: t.notitie || null };
  }

  return { tafelwensen: { ALLERGENEN, WENSEN, tafelZet, tafelLijst, tafelWeg, keukenbord, bedieningskaart } };
};
