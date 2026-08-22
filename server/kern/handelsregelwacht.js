/* De Handelsregelwacht volgt officiele bronnen voor bedrijfstoelating en
   wereldhandel. Een gewijzigde sanctielijst of wetspagina versoepelt nooit
   zelfstandig een regel: hij zet het betrokken bewijs op hercontrole en
   blokkeert open toelatingen. Zo is ophalen automatisch en blijft juridische
   duiding aantoonbaar mensenwerk. */
'use strict';

const crypto = require('node:crypto');
const BRONNEN = require('./handelsregelbronnen');
const { datum } = require('../lib/klok');

const MAX_BODY = 2 * 1024 * 1024;
const kort = (v, n) => String(v || '').trim().slice(0, n);
const digest = v => crypto.createHash('sha256').update(v).digest('hex');

module.exports = ({ db, save, fetchImpl, nu }) => {
  const haal = fetchImpl || ((...a) => fetch(...a));
  const klok = nu || (() => datum().toISOString());
  const staat = () => (db.data.handelsRegelwacht = db.data.handelsRegelwacht ||
    { bronnen:{}, gebeurtenissen:[] });

  function landPast(def, dossier) {
    if (!def.landen) return true;
    return def.landen.includes(String(dossier && dossier.registratie && dossier.registratie.landCode || 'NL'));
  }

  function raakDossier(dossier, def, gebeurtenis, leverancier) {
    if (!dossier || !dossier.toelating || !Array.isArray(dossier.toelating.eisen) || !landPast(def, dossier)) return 0;
    let geraakt = 0;
    for (const eis of dossier.toelating.eisen) {
      if (!def.eisen.includes(eis.id)) continue;
      if (eis.status === 'geverifieerd' || eis.status === 'niet_van_toepassing') {
        eis.vorigeControle = eis.gecontroleerd || null;
        eis.status = 'hercontrole_nodig'; eis.gecontroleerd = null; geraakt++;
      }
      eis.bronWijziging = { id: gebeurtenis.id, bron: def.id, at: gebeurtenis.at };
    }
    if (geraakt) {
      dossier.toelating.status = 'hercontrole_nodig';
      if (leverancier) {
        dossier.activiteiten = dossier.activiteiten || {};
        dossier.activiteiten.regelHercontrole = { bron: def.id, at: gebeurtenis.at };
      }
    }
    return geraakt;
  }

  function raakFoundation(dossier, def, gebeurtenis) {
    const ids = def.foundationEisen || [];
    if (!ids.length || !dossier || !dossier.toelating || !Array.isArray(dossier.toelating.eisen)) return 0;
    let geraakt = 0;
    for (const eis of dossier.toelating.eisen) {
      if (!ids.includes(eis.id)) continue;
      if (eis.status === 'geverifieerd' || eis.status === 'niet_van_toepassing') {
        eis.vorigeControle = eis.gecontroleerd || null; eis.status = 'hercontrole_nodig'; eis.gecontroleerd = null; geraakt++;
      }
      eis.bronWijziging = { id:gebeurtenis.id, bron:def.id, at:gebeurtenis.at };
    }
    if (geraakt) dossier.toelating.status = 'hercontrole_nodig';
    return geraakt;
  }

  function wijziging(def, oud, nieuw, at) {
    const st = staat();
    const gebeurtenis = { id:crypto.randomBytes(8).toString('hex'), bronId:def.id,
      naam:def.naam, url:def.url, eisen:def.eisen.slice(), at, oud, nieuw,
      status:'open', aanvragen:0, leveranciers:0, foundationAanvragen:0 };
    for (const a of db.data.partnerApplications || [])
      if (a.status === 'nieuw') gebeurtenis.aanvragen += raakDossier(a, def, gebeurtenis, false);
    for (const s of db.data.suppliers || [])
      gebeurtenis.leveranciers += raakDossier(s, def, gebeurtenis, true);
    for (const a of db.data.foundationRegistraties || [])
      if (a.status === 'nieuw') gebeurtenis.foundationAanvragen += raakFoundation(a, def, gebeurtenis);
    st.gebeurtenissen.unshift(gebeurtenis);
    st.gebeurtenissen = st.gebeurtenissen.slice(0, 100);
    return gebeurtenis;
  }

  async function leesTekst(r) {
    const opgegeven = Number(r.headers && r.headers.get && r.headers.get('content-length'));
    if (opgegeven > MAX_BODY) throw new Error('bronbestand is te groot');
    const tekst = await r.text();
    if (Buffer.byteLength(tekst) > MAX_BODY) throw new Error('bronbestand is te groot');
    return tekst;
  }

  async function checkEen(def) {
    const st = staat(), vorig = st.bronnen[def.id] || {};
    const at = klok();
    const headers = { Accept:'text/html, application/xml, application/rss+xml, text/xml;q=0.9, */*;q=0.1' };
    if (vorig.etag) headers['If-None-Match'] = vorig.etag;
    if (vorig.lastModified) headers['If-Modified-Since'] = vorig.lastModified;
    try {
      const r = await haal(def.url, { headers,
        signal:AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined });
      if (r.status === 304) {
        Object.assign(vorig, { laatsteCheck:at, uitslag:'ongewijzigd' }); st.bronnen[def.id] = vorig; save();
        return { id:def.id, status:'ongewijzigd' };
      }
      if (!r.ok) throw new Error('bron gaf ' + r.status);
      const tekst = await leesTekst(r);
      if (tekst.length < 100 || !tekst.toLowerCase().includes(def.marker.toLowerCase()))
        throw new Error('broninhoud niet herkenbaar');
      const hash = digest(tekst.replace(/\s+/g, ' ').trim());
      const etag = kort(r.headers && r.headers.get && r.headers.get('etag'), 160) || null;
      const lastModified = kort(r.headers && r.headers.get && r.headers.get('last-modified'), 80) || null;
      let gebeurtenis = null;
      if (vorig.hash && vorig.hash !== hash) gebeurtenis = wijziging(def, vorig.hash, hash, at);
      st.bronnen[def.id] = { hash, etag, lastModified, laatsteCheck:at,
        laatsteWijziging:gebeurtenis ? at : (vorig.laatsteWijziging || null),
        uitslag:gebeurtenis ? 'gewijzigd, hercontrole geopend' : (vorig.hash ? 'ongewijzigd' : 'basis vastgelegd') };
      save();
      return { id:def.id, status:st.bronnen[def.id].uitslag, gebeurtenis };
    } catch (e) {
      st.bronnen[def.id] = Object.assign(vorig, { laatsteCheck:at,
        uitslag:'fout: ' + kort(e.message, 100) }); save();
      return { id:def.id, status:'fout', fout:kort(e.message, 100) };
    }
  }

  async function check(bronId) {
    const lijst = bronId ? BRONNEN.filter(b => b.id === bronId) : BRONNEN;
    if (!lijst.length) return { ok:false, status:404, error:'Onbekende officiële bron.' };
    const resultaten = await Promise.all(lijst.map(checkEen));
    return { ok:resultaten.every(r => r.status !== 'fout'), resultaten };
  }

  function bevestig(id, door, toelichting) {
    const g = staat().gebeurtenissen.find(x => x.id === id);
    if (!g) return { status:404, error:'Bronwijziging niet gevonden.' };
    if (g.status === 'beoordeeld') return { ok:true, gebeurtenis:g };
    const tekst = kort(toelichting, 300);
    if (tekst.length < 3) return { status:400, error:'Leg vast wat de regelwijziging betekent.' };
    g.status = 'beoordeeld'; g.beoordeeld = { door, at:klok(), toelichting:tekst }; save();
    return { ok:true, gebeurtenis:g };
  }

  function status() {
    const st = staat();
    const getroffen = [];
    for (const s of db.data.suppliers || []) {
      const open = ((s.toelating || {}).eisen || []).filter(e => e.status === 'hercontrole_nodig');
      if (open.length) getroffen.push({ code:s.code, naam:s.name, land:(s.registratie || {}).landCode || 'NL',
        eisen:open.map(e => ({ id:e.id, label:e.label, bronWijziging:e.bronWijziging })) });
    }
    const foundation = (db.data.foundationRegistraties || []).filter(a => a.status === 'nieuw' &&
      ((a.toelating || {}).eisen || []).some(e => e.status === 'hercontrole_nodig'))
      .map(a => ({ id:a.id, naam:a.naam, type:a.type,
        eisen:a.toelating.eisen.filter(e => e.status === 'hercontrole_nodig').map(e => ({ id:e.id, label:e.label })) }));
    return { automatisch:process.env.HANDELSREGELS_UIT !== '1', intervalMs:Number(process.env.HANDELSREGELS_CHECK_MS || 21600000),
      bronnen:BRONNEN.map(b => ({ id:b.id, naam:b.naam, url:b.url, eisen:b.eisen, foundationEisen:b.foundationEisen || [],
        ...st.bronnen[b.id] })), gebeurtenissen:st.gebeurtenissen.slice(0, 30),
      openWijzigingen:st.gebeurtenissen.filter(g => g.status === 'open').length,
      getroffenLeveranciers:getroffen.slice(0, 100), getroffenFoundation:foundation.slice(0, 100) };
  }

  return { check, checkEen, bevestig, status, bronnen:BRONNEN };
};
