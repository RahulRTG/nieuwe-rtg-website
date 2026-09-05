/* RTG Vracht: internationale vracht voor expediteurs, over lucht, water en
   land. Een zending is een keten van etappes (lucht, zee, binnenvaart, weg,
   spoor), elk met het juiste vervoersdocument. De keten loopt vanzelf netjes:
   boeken -> onderweg per etappe -> douane (alleen bij een grensoverschrijding)
   -> aangekomen -> afgeleverd. Elke zending krijgt een volgcode waarmee de
   klant publiek kan meekijken, zonder klantgegevens.
   Opslag per zaak in de vracht-collectie onder [code]; begrensd, nette demo-start. */

const MODALITEITEN = {
  lucht:       { label: 'Luchtvracht',  icon: 'vluchten',      document: 'AWB (luchtvrachtbrief)' },
  zee:         { label: 'Zeevracht',    icon: '\u{1F6A2}',         document: 'B/L (cognossement)' },
  binnenvaart: { label: 'Binnenvaart',  icon: 'boot',      document: 'CMNI-vrachtbrief' },
  weg:         { label: 'Wegtransport', icon: '\u{1F69A}',         document: 'CMR-vrachtbrief' },
  spoor:       { label: 'Spoor',        icon: '\u{1F683}',         document: 'CIM-vrachtbrief' }
};
const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
const MAX_ZENDINGEN = 200, MAX_ETAPPES = 8, MAX_GEBEURTENISSEN = 50;

// de demo-start van de expediteur: een lopende multimodale zending en een afgeleverde
const DEMO = [
  { klant: 'Finca Vella (project Es Cubells)', inhoud: 'Terracotta vloertegels, 14 pallets', gewichtKg: 9800, colli: 14, incoterm: 'DAP',
    van: { plaats: 'Casablanca', land: 'Marokko' }, naar: { plaats: 'Ibiza', land: 'Spanje' },
    etappes: [{ modaliteit: 'weg', van: 'Casablanca', naar: 'Tanger Med' }, { modaliteit: 'zee', van: 'Tanger Med', naar: 'Valencia' }, { modaliteit: 'zee', van: 'Valencia', naar: 'Ibiza-haven' }, { modaliteit: 'weg', van: 'Ibiza-haven', naar: 'Es Cubells' }] },
  { klant: 'Vora Beach Club', inhoud: 'Espressomachines en barkoeling, 6 colli', gewichtKg: 640, colli: 6, incoterm: 'CIP', klaar: true,
    van: { plaats: 'Milaan', land: 'Italie' }, naar: { plaats: 'Ibiza', land: 'Spanje' },
    etappes: [{ modaliteit: 'lucht', van: 'Milaan MXP', naar: 'Ibiza IBZ' }, { modaliteit: 'weg', van: 'Ibiza IBZ', naar: 'Cala Nova' }] }
];

module.exports = ({ db, save, bewerkCollectie, crypto, schoon }) => {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/vracht', bezit: { vracht: 'kaart' } });
  const V = () => eigen.bak('vracht');
  const nu = () => new Date().toISOString();
  const volgToegang = require('./vracht-toegang')({ bak: V, save, bewerkCollectie, crypto, nu });
  const meld = (z, tekst) => { z.gebeurtenissen.unshift({ at: nu(), tekst }); if (z.gebeurtenissen.length > MAX_GEBEURTENISSEN) z.gebeurtenissen.length = MAX_GEBEURTENISSEN; };
  const internationaal = z => z.van.land.toLowerCase() !== z.naar.land.toLowerCase();

  function bouwZending(code, b, kaart, deelcode = true) {
    const plek = (p, wat) => {
      const plaats = schoon(p && p.plaats, 60), land = schoon(p && p.land, 40);
      if (!plaats || !land) return { fout: 'Geef bij ' + wat + ' een plaats en een land op.' };
      return { plaats, land };
    };
    const van = plek(b.van, 'herkomst'); if (van.fout) return { status: 400, error: van.fout };
    const naar = plek(b.naar, 'bestemming'); if (naar.fout) return { status: 400, error: naar.fout };
    const klant = schoon(b.klant, 60), inhoud = schoon(b.inhoud, 120);
    if (!klant) return { status: 400, error: 'Voor wie is deze zending? Vul de klant in.' };
    if (!inhoud) return { status: 400, error: 'Omschrijf kort wat er vervoerd wordt.' };
    const gewichtKg = Math.round(Number(b.gewichtKg));
    if (!(gewichtKg > 0) || gewichtKg > 100000000) return { status: 400, error: 'Geef een geldig gewicht in kilo’s.' };
    const colli = Math.round(Number(b.colli) || 1);
    if (!(colli >= 1) || colli > 100000) return { status: 400, error: 'Geef een geldig aantal colli.' };
    const ruwe = Array.isArray(b.etappes) ? b.etappes : [];
    if (!ruwe.length || ruwe.length > MAX_ETAPPES) return { status: 400, error: 'Bouw de route uit 1 tot ' + MAX_ETAPPES + ' etappes.' };
    const etappes = [];
    for (const e of ruwe) {
      const m = MODALITEITEN[e && e.modaliteit];
      if (!m) return { status: 400, error: 'Kies per etappe lucht, zee, binnenvaart, weg of spoor.' };
      const eVan = schoon(e.van, 60), eNaar = schoon(e.naar, 60);
      if (!eVan || !eNaar) return { status: 400, error: 'Geef elke etappe een van en een naar.' };
      etappes.push({ modaliteit: e.modaliteit, van: eVan, naar: eNaar, document: m.document, status: 'gepland' });
    }
    const z = {
      id: 'z' + crypto.randomBytes(4).toString('hex'),
      ref: 'VR-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      klant, inhoud, gewichtKg, colli,
      incoterm: INCOTERMS.includes(b.incoterm) ? b.incoterm : 'DAP',
      van, naar, etappes, status: 'onderweg', gebeurtenissen: [], gemaakt: nu(),
      eta: new Date(Date.now() + (etappes.length * 2 + (van.land.toLowerCase() !== naar.land.toLowerCase() ? 1 : 0)) * 864e5).toISOString().slice(0, 10)
    };
    const toegang = deelcode ? volgToegang.nieuw(kaart, z, code) : null;
    if (deelcode && !toegang) return { status: 500, error: 'Kon geen unieke volgcode maken.' };
    z.etappes[0].status = 'bezig';
    meld(z, 'Zending geboekt (' + z.incoterm + '); eerste etappe gestart: ' + etappeTekst(z.etappes[0]) + '.');
    return { z, volgcode: toegang && toegang.code };
  }
  const etappeTekst = e => MODALITEITEN[e.modaliteit].label.toLowerCase() + ' van ' + e.van + ' naar ' + e.naar;

  function zaakIn(v, code) {
    if (!v[code]) {
      v[code] = [];
      if (code === 'TERRAMAR') for (const d of DEMO) {
        /* Voorbeeldzendingen krijgen geen actief geheim dat niemand ooit zag.
           De expediteur kan vanuit de kaart bewust een eerste code uitgeven. */
        const r = bouwZending(code, d, v, false);
        if (r.z) {
          if (d.klaar) { for (const e of r.z.etappes) e.status = 'klaar'; r.z.status = 'afgeleverd'; meld(r.z, 'Afgeleverd en getekend voor ontvangst.'); }
          v[code].unshift(r.z);
        }
      }
    }
    return v[code];
  }
  const zoek = (kaart, code, id) => zaakIn(kaart, code).find(z => z.id === String(id || ''));

  function overzicht(code) {
    return volgToegang.metKaart(kaart => {
      const lijst = zaakIn(kaart, code);
      const per = {}; for (const k of Object.keys(MODALITEITEN)) per[k] = 0;
      let onderweg = 0, douane = 0, afgeleverd = 0, kilos = 0;
      for (const z of lijst) {
        if (z.status === 'onderweg') { onderweg++; kilos += z.gewichtKg; }
        if (z.status === 'douane') douane++;
        if (z.status === 'afgeleverd') afgeleverd++;
        if (z.status !== 'afgeleverd') for (const e of z.etappes) per[e.modaliteit]++;
      }
      return { zendingen: lijst.map(z => volgToegang.toon(z, null, code)),
        kpi: { onderweg, douane, afgeleverd, kilosOnderweg: kilos, perModaliteit: per },
        modaliteiten: MODALITEITEN, incoterms: INCOTERMS };
    });
  }

  function maak(code, body) {
    const invoer = body || {};
    return volgToegang.maakZending({ zaak: code, invoer,
      lijstVan: kaart => zaakIn(kaart, code),
      bouw: kaart => bouwZending(code, invoer, kaart), max: MAX_ZENDINGEN });
  }

  const handelingen = require('./vracht-handelingen')({ crypto, nu,
    metKaart:volgToegang.metKaart, zaakIn, zoek, toon:volgToegang.toon,
    meld, schoon, internationaal, etappeTekst });
  const { etappeKlaar, douaneVrij, afleveren, melding } = handelingen;

  const volg = volgToegang.volg;
  const volgcodeRoteer = (code, id, actor, idem) => volgToegang.roteer(code, id, actor, idem);
  const volgcodeIntrekken = (code, id, actor, reden) => volgToegang.intrekken(code, id, actor, reden);

  return { vracht: { overzicht, maak, etappeKlaar, douaneVrij, afleveren, melding,
    volg, volgcodeRoteer, volgcodeIntrekken, MODALITEITEN } };
};
