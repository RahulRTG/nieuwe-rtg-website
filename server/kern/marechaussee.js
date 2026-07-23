/* De Koninklijke Marechaussee op RTG Airport (kern/marechaussee.js). Het leger
   staat er al (de defensie-toren); dit is de eigen brigade op het veld, met een
   kantoor en een PDA in een app:
     grensbalie   de grenscontrole per vlucht: de passagierslijst op CODENAAM
                  (privacy by design), en per reiziger een menselijk besluit:
                  akkoord, nader onderzoek, of daarna vrijgeven
     patrouille   rondes door de vaste zones van het veld, met bevindingen
     incidenten   melden en netjes sluiten (documenten, verdacht gedrag,
                  achtergelaten bagage, assistentie, grensweigering)
   De brigade werkt op de echte luchthavendata (db.data.luchthaven): de
   passagierslijst komt uit de ingecheckte boekingen, en de cockpit waarschuwt
   als een kist gaat boarden terwijl de grenscontrole nog niet rond is.
   De AI-wachtcommandant adviseert; beslissen doet de marechaussee zelf.
   Vast patroon: maakMarechaussee(state) -> { kmar: api }. */

const ZONES = ['Terminal', 'Security-filters', 'Luchtzijde', 'Platform', 'Koninklijke Vleugel', 'Landzijde'];
const BESLUITEN = ['akkoord', 'nader-onderzoek', 'vrijgegeven'];
const INCIDENT_SOORTEN = ['documenten', 'verdacht-gedrag', 'achtergelaten-bagage', 'assistentie', 'grensweigering'];

function maakMarechaussee({ db, save, crypto, anthropic }) {
  const nu = () => new Date().toISOString();
  const id = p => (p || 'km') + crypto.randomBytes(4).toString('hex');
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const vandaag = () => new Date().toISOString().slice(0, 10);

  function K() {
    if (!db.data.kmar || typeof db.data.kmar !== 'object') db.data.kmar = { controles: [], patrouilles: [], incidenten: [] };
    const k = db.data.kmar;
    for (const x of ['controles', 'patrouilles', 'incidenten']) if (!Array.isArray(k[x])) k[x] = [];
    return k;
  }
  function seed() {
    if (!Array.isArray(db.data.suppliers)) return;
    if (!db.data.supplierTypes.marechaussee)
      db.data.supplierTypes.marechaussee = { label: 'Marechaussee', icon: 'schild', caps: ['marechaussee'] };
    if (!db.data.suppliers.find(s => s.code === 'KMAR')) {
      db.data.suppliers.push({
        code: 'KMAR', name: 'Brigade RTG Airport', type: 'marechaussee', city: 'Ibiza',
        loc: { lat: 38.872, lng: 1.371, label: 'Brigade RTG Airport' }, rate: 0, menu: [], photos: [], marechaussee: {}
      });
    }
    K();
  }
  const isKmar = s => !!(s && s.type === 'marechaussee');
  const lucht = () => (db.data.luchthaven && typeof db.data.luchthaven === 'object') ? db.data.luchthaven : { vluchten: [], boekingen: [] };
  const controleVan = bid => K().controles.find(c => c.boekingId === bid);

  /* ---- de grensbalie: de passagierslijst per vlucht, besluit per reiziger ---- */
  function controleLijst(vluchtNr) {
    seed();
    const v = (lucht().vluchten || []).find(x => x.nummer === String(vluchtNr || '').toUpperCase() || x.id === vluchtNr);
    if (!v) return { status: 404, error: 'Vlucht niet gevonden.' };
    const passagiers = (lucht().boekingen || []).filter(b => b.vluchtId === v.id && b.status === 'ingecheckt')
      .map(b => {
        const c = controleVan(b.id);
        return { boekingId: b.id, codenaam: b.codenaam, stoel: b.stoel,
          besluit: c ? c.besluit : 'wacht', door: c ? c.door : null, at: c ? c.at : null };
      });
    return { ok: true, vlucht: { nummer: v.nummer, bestemming: v.bestemming, tijd: v.tijd, status: v.status, gate: v.gate },
      besluiten: BESLUITEN, passagiers };
  }
  function controleZet(actor, boekingId, besluit) {
    seed();
    const b = (lucht().boekingen || []).find(x => x.id === String(boekingId || ''));
    if (!b || b.status !== 'ingecheckt') return { status: 404, error: 'Geen ingecheckte reiziger met dit nummer.' };
    if (!BESLUITEN.includes(besluit)) return { status: 400, error: 'Kies een besluit (' + BESLUITEN.join(', ') + ').' };
    const c = controleVan(b.id);
    if (!c) {
      if (besluit === 'vrijgegeven') return { status: 409, error: 'Vrijgeven kan alleen na nader onderzoek.' };
      K().controles.unshift({ id: id('ct'), boekingId: b.id, codenaam: b.codenaam, besluit, door: actor || 'grensbalie', at: nu() });
      K().controles = K().controles.slice(0, 50000);
      save();
      return { ok: true, besluit };
    }
    // een besluit is een besluit; alleen nader onderzoek kan naar vrijgegeven
    if (c.besluit === 'nader-onderzoek' && besluit === 'vrijgegeven') {
      c.besluit = 'vrijgegeven'; c.door = actor || c.door; c.at = nu();
      save();
      return { ok: true, besluit: c.besluit };
    }
    return { status: 409, error: 'Deze reiziger is al beoordeeld (' + c.besluit + ').' };
  }

  /* ---- de patrouille: rondes door de zones ---- */
  function patrouille(actor, zone, bevinding) {
    seed();
    if (!ZONES.includes(zone)) return { status: 400, error: 'Kies een zone (' + ZONES.join(', ') + ').' };
    const p = { id: id('pt'), zone, door: actor || 'patrouille', bevinding: schoon(bevinding, 200) || null, at: nu() };
    K().patrouilles.unshift(p);
    K().patrouilles = K().patrouilles.slice(0, 5000);
    save();
    return { ok: true, patrouille: p };
  }

  /* ---- incidenten: melden en netjes sluiten ---- */
  function incident(actor, data) {
    seed(); data = data || {};
    const tekst = schoon(data.tekst, 300);
    if (tekst.length < 3) return { status: 400, error: 'Omschrijf wat er speelt.' };
    const i = { id: id('in'), zone: ZONES.includes(data.zone) ? data.zone : ZONES[0],
      soort: INCIDENT_SOORTEN.includes(data.soort) ? data.soort : 'verdacht-gedrag',
      tekst, door: actor || 'brigade', at: nu(), gesloten: null };
    K().incidenten.unshift(i);
    K().incidenten = K().incidenten.slice(0, 10000);
    save();
    return { ok: true, incident: i };
  }
  function incidentSluit(actor, iid, afloop) {
    const i = K().incidenten.find(x => x.id === String(iid || ''));
    if (!i) return { status: 404, error: 'Incident niet gevonden.' };
    if (i.gesloten) return { status: 409, error: 'Dit incident is al gesloten.' };
    i.gesloten = { door: actor || 'brigade', afloop: schoon(afloop, 300) || 'afgehandeld', at: nu() };
    save();
    return { ok: true, incident: i };
  }
  function incidenten() {
    seed();
    return { ok: true, zones: ZONES, soorten: INCIDENT_SOORTEN, incidenten: K().incidenten.slice(0, 60) };
  }

  /* ---- de cockpit van de brigade ---- */
  function cockpit() {
    seed();
    const d = vandaag();
    const vluchtenVandaag = (lucht().vluchten || []).filter(v => v.datum === d && v.soort === 'vertrek' && v.status !== 'geannuleerd');
    const signalen = [];
    for (const v of vluchtenVandaag) {
      if (!['inchecken', 'boarding'].includes(v.status)) continue;
      const wacht = (lucht().boekingen || []).filter(b => b.vluchtId === v.id && b.status === 'ingecheckt' && !controleVan(b.id)).length;
      const onderzoek = (lucht().boekingen || []).filter(b => b.vluchtId === v.id && b.status === 'ingecheckt' &&
        controleVan(b.id) && controleVan(b.id).besluit === 'nader-onderzoek').length;
      if (v.status === 'boarding' && wacht > 0)
        signalen.push({ soort: 'grens', vlucht: v.nummer, tekst: v.nummer + ' boardt terwijl ' + wacht + ' reiziger(s) nog niet door de grenscontrole zijn.' });
      if (onderzoek > 0)
        signalen.push({ soort: 'onderzoek', vlucht: v.nummer, tekst: v.nummer + ': ' + onderzoek + ' reiziger(s) in nader onderzoek.' });
    }
    const laatste = {};
    for (const z of ZONES) { const p = K().patrouilles.find(x => x.zone === z); laatste[z] = p ? p.at : null; }
    return { ok: true,
      vluchtenVandaag: vluchtenVandaag.length,
      controlesVandaag: K().controles.filter(c => c.at.slice(0, 10) === d).length,
      inOnderzoek: K().controles.filter(c => c.besluit === 'nader-onderzoek').length,
      incidentenOpen: K().incidenten.filter(i => !i.gesloten).length,
      patrouillesVandaag: K().patrouilles.filter(p => p.at.slice(0, 10) === d).length,
      zones: ZONES, laatstePatrouille: laatste, signalen: signalen.slice(0, 40),
      vluchten: vluchtenVandaag.map(v => ({ id: v.id, nummer: v.nummer, tijd: v.tijd, status: v.status })) };
  }

  /* ---- de AI-wachtcommandant: adviseert, beslist nooit ---- */
  async function kmarAI(vraag) {
    const c = cockpit();
    const beeld = c.vluchtenVandaag + ' vertrekkers vandaag, ' + c.controlesVandaag + ' grenscontroles gedaan (' + c.inOnderzoek + ' in nader onderzoek), ' +
      c.incidentenOpen + ' incidenten open, ' + c.patrouillesVandaag + ' patrouilles gelopen. Signalen: ' +
      (c.signalen.length ? c.signalen.slice(0, 5).map(s => s.tekst).join(' | ') : 'geen') + '.';
    const q = schoon(vraag, 400);
    if (anthropic && q) {
      try {
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 350,
          system: require('./rahul').RAHUL_LEAD + 'je bent de AI-wachtcommandant van de Brigade RTG Airport (Koninklijke Marechaussee). ' +
            'Je adviseert over de grenscontrole, patrouilles en incidenten, kort en zakelijk. Je adviseert ALLEEN: elk besluit over een ' +
            'reiziger of een incident neemt de marechaussee zelf. Bij direct gevaar: eerst 112 en de meldkamer. Huidige beeld: ' + beeld,
          messages: [{ role: 'user', content: q }]
        });
        const tekst = r.content && r.content[0] && r.content[0].text;
        if (tekst) return { ok: true, antwoord: tekst };
      } catch (e) { /* val terug */ }
    }
    return { ok: true, demo: true, antwoord: 'Het beeld: ' + beeld + ' Mijn advies: werk eerst de grenscontrole van de eerstvolgende vertrekker af, loop daarna de stille zones na. Beslissen doet u zelf; bij direct gevaar eerst 112.' };
  }

  return { kmar: { seed, isKmar, cockpit, controleLijst, controleZet, patrouille, incident, incidentSluit, incidenten, kmarAI,
    KMAR_ZONES: ZONES, KMAR_BESLUITEN: BESLUITEN } };
}

module.exports = { maakMarechaussee };
