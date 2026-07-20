/* RTG Bank, deel "rekeningen": het openen, tonen, bevriezen en sluiten van
   rekeningen, en de IBAN-uitgifte. Een IBAN is een echt geldig NL-nummer (mod-97),
   met RTG's eigen bankcode -- zo voelt de eigen bank meteen echt en kunnen externe
   systemen (SEPA) er straks mee overweg. Rekening-identiteit hangt aan de codenaam;
   een lid kan meerdere rekeningen hebben (betaal, spaar, zakelijk). Krijgt de
   gedeelde ctx van kern/bank/index.js. */
module.exports = (ctx) => {
  const { db, save, crypto, nu, SOORTEN, rekeningen, rekMeta, saldoVan, boek, bankregie, keyVanCodenaam, seintje } = ctx;

  // IBAN mod-97: letters -> getallen (A=10..Z=35), controlegetal = 98 - (rest mod 97).
  function mod97(str) {
    let rest = 0;
    for (const ch of str) { const v = /[A-Z]/.test(ch) ? (ch.charCodeAt(0) - 55) : ch; rest = (rest * (String(v).length === 2 ? 100 : 10) + Number(v)) % 97; }
    return rest;
  }
  function ibanControle(landcode, bban) {
    const verplaatst = bban + landcode + '00';
    const rest = mod97(verplaatst);
    const controle = 98 - rest;
    return String(controle).padStart(2, '0');
  }
  function genIban() {
    const { landcode, bankcode } = bankregie.bankIbanParams();
    for (let poging = 0; poging < 30; poging++) {
      let rek = '';
      for (let i = 0; i < 10; i++) rek += crypto.randomInt(0, 10);
      const bban = bankcode + rek;
      const iban = landcode + ibanControle(landcode, bban) + bban;
      if (!rekMeta(iban)) return iban;
    }
    return null;
  }

  /* Een rekening openen voor een codenaam. In productie hangt hier een KYC-stap
     voor; in demo opent hij direct. We bewaren de CANONIEKE codenaam (zoals de
     identiteitsgids hem kent), zodat de eigenaarschapscheck later altijd klopt,
     ongeacht hoofdletters. Een betaalrekening krijgt meteen de standaard
     rood-staan-ruimte uit de boardroom (bankregie). */
  async function open({ codenaam, soort = 'betaal', naam, wie }) {
    const ruw = String(codenaam || '').trim();
    if (!ruw) return { status: 400, error: 'Voor wie is de rekening?' };
    if (!SOORTEN[soort]) return { status: 400, error: 'Onbekende rekeningsoort.' };
    let rec; try { rec = await keyVanCodenaam(ruw); } catch (e) { rec = null; }
    if (!rec) return { status: 404, error: 'Die codenaam kennen we niet.' };
    const c = rec.codename || ruw;
    const eigen = Object.values(rekeningen()).filter(m => m.codenaam === c);
    if (eigen.length >= 12) return { status: 429, error: 'Het maximaal aantal rekeningen is bereikt.' };
    const iban = genIban();
    if (!iban) return { status: 500, error: 'Kon geen IBAN uitgeven; probeer het opnieuw.' };
    const meta = { iban, codenaam: c, soort, naam: String(naam || SOORTEN[soort]).replace(/[<>]/g, '').slice(0, 40),
      geopend: nu(), roodLimiet: soort === 'betaal' ? bankregie.bankRoodStandaard() : 0, bevroren: false, doelCenten: 0, door: wie || 'lid' };
    rekeningen()[iban] = meta;
    save();
    seintje(c);
    return { ok: true, rekening: publiek(meta) };
  }

  const publiek = m => ({ iban: m.iban, soort: m.soort, soortLabel: SOORTEN[m.soort], naam: m.naam,
    saldoCenten: saldoVan(m.iban), roodLimiet: m.roodLimiet || 0, bevroren: !!m.bevroren, doelCenten: m.doelCenten || 0, geopend: m.geopend });

  function vanLid(codenaam) {
    const c = String(codenaam || '').trim();
    const eigen = Object.values(rekeningen()).filter(m => m.codenaam === c).sort((a, b) => a.geopend - b.geopend);
    return { ok: true, rekeningen: eigen.map(publiek),
      totaalCenten: eigen.reduce((s, m) => s + Math.max(0, saldoVan(m.iban)), 0) };
  }
  function detail(iban, codenaam) {
    const m = rekMeta(iban);
    if (!m || (codenaam && m.codenaam !== String(codenaam).trim())) return { status: 404, error: 'De rekening bestaat niet.' };
    return { ok: true, rekening: publiek(m) };
  }

  // een rekening bevriezen/ontdooien (lid zelf bij verlies, of het kantoor)
  function bevries(iban, aan, codenaam) {
    const m = rekMeta(iban);
    if (!m || (codenaam && m.codenaam !== String(codenaam).trim())) return { status: 404, error: 'De rekening bestaat niet.' };
    m.bevroren = aan === true;
    save();
    seintje(m.codenaam);
    return { ok: true, iban, bevroren: m.bevroren };
  }
  // de rood-staan-ruimte van een betaalrekening zetten (boardroom of kantoor)
  function roodZet(iban, euro) {
    const m = rekMeta(iban);
    if (!m) return { status: 404, error: 'De rekening bestaat niet.' };
    if (m.soort !== 'betaal') return { status: 400, error: 'Rood staan kan alleen op een betaalrekening.' };
    const centen = Math.round(Number(euro) * 100);
    if (!Number.isFinite(centen) || centen < 0 || centen > 5000000) return { status: 400, error: 'Kies tussen 0 en 50.000 euro.' };
    m.roodLimiet = centen;
    save();
    return { ok: true, iban, roodLimiet: centen };
  }
  // een lege rekening sluiten; met saldo kan het niet (eerst leegmaken)
  function sluit(iban, codenaam) {
    const m = rekMeta(iban);
    if (!m || (codenaam && m.codenaam !== String(codenaam).trim())) return { status: 404, error: 'De rekening bestaat niet.' };
    if (saldoVan(iban) !== 0) return { status: 409, error: 'Maak de rekening eerst leeg voordat je hem sluit.' };
    delete rekeningen()[iban];
    save();
    seintje(m.codenaam);
    return { ok: true, gesloten: iban };
  }

  /* ---------- de leden-bank: alleen live als de boardroom hem aan heeft, en
     iedereen krijgt zijn eigen rekening pas NA akkoord (opt-in). Zo geldt hetzelfde
     voor nieuwe leden als voor bestaande leden bij live gaan: bij het eerste bezoek
     een akkoordscherm, en op akkoord meteen een betaalrekening. ---------- */
  function akkoordStore() { if (!db.data.bankAkkoord || typeof db.data.bankAkkoord !== 'object') db.data.bankAkkoord = {}; return db.data.bankAkkoord; }
  function ledenOverzicht(codenaam) {
    const c = String(codenaam || '').trim();
    const mijn = vanLid(c);
    return { ok: true, online: bankregie.bankLedenAan(), akkoord: !!akkoordStore()[c],
      modus: bankregie.bankModus(), spaarrentePct: bankregie.bankSpaarrenteBp() / 100,
      rekeningen: mijn.rekeningen, totaalCenten: mijn.totaalCenten };
  }
  async function ledenAkkoord(codenaam) {
    if (!bankregie.bankLedenAan()) return { status: 403, error: 'De RTG Bank is nog niet live voor leden.' };
    const c = String(codenaam || '').trim();
    if (!c) return { status: 400, error: 'Onbekend lid.' };
    const store = akkoordStore();
    const alHad = Object.values(rekeningen()).some(m => m.codenaam === c);
    store[c] = store[c] || nu();
    save();
    let rekening = null;
    if (!alHad) { const r = await open({ codenaam: c, soort: 'betaal', naam: 'RTG Betaalrekening', wie: 'lid' }); if (r.error) return r; rekening = r.rekening; }
    return { ok: true, akkoord: true, rekening };
  }

  return {
    genIban, ibanControle,
    rekeningOpen: open, rekeningenVanLid: vanLid, rekeningDetail: detail,
    rekeningBevries: bevries, rekeningRoodZet: roodZet, rekeningSluit: sluit,
    bankLedenOverzicht: ledenOverzicht, bankLedenAkkoord: ledenAkkoord
  };
};
