/* Opslag en uitgifte voor FOUNDATION-registraties. De aanvraag mag openbaar
   en snel; bevoegdheden ontstaan uitsluitend via beslis() nadat de volledige
   controlemotor groen is. Codes en tokens komen uit de CSPRNG. */
'use strict';

const cryptoNode = require('node:crypto');
const controle = require('./foundationregistratie');
const { datum: klokDatum, nu: klokNu } = require('../lib/klok');

module.exports = ({ db, save, crypto, schoon }) => {
  const nu = () => klokDatum().toISOString();
  const hash = v => cryptoNode.createHash('sha256').update(String(v || '')).digest('hex');
  const lijst = () => (db.data.foundationRegistraties = Array.isArray(db.data.foundationRegistraties)
    ? db.data.foundationRegistraties : []);
  const rtfos = () => {
    if (!db.data.rtfos || typeof db.data.rtfos !== 'object') db.data.rtfos = {};
    for (const k of ['steden','vrijwilligers','partners']) if (!Array.isArray(db.data.rtfos[k])) db.data.rtfos[k] = [];
    return db.data.rtfos;
  };
  const rid = n => crypto.randomBytes(n || 8).toString('hex');
  const emailOk = v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
  const alleen = v => String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  const vind = id => lijst().find(x => x.id === String(id || '')) || null;
  const provision = require('./foundationregistratie-uitgifte')({ db, crypto, nu, rid });

  function catalogus() {
    return { types:controle.TYPES, bronnen:controle.BRONNEN,
      eisenPerType:Object.fromEntries(Object.keys(controle.TYPES).map(type => [type,
        controle.eisenVoor(type, { anbi:true, verwerktPersoonsgegevens:true, werktMetKwetsbaren:true, minderjarig:true })
          .map(e => ({ id:e.id, label:e.label, bron:e.bron, url:e.url }))])),
      steden:rtfos().steden.filter(s => s.status === 'actief').map(s => ({ id:s.id, naam:s.naam })) };
  }

  function aanvragen(b, ip) {
    b = b || {};
    const type = String(b.type || '');
    if (!controle.TYPES[type]) return { status:400, error:'Kies gezin, school, vrijwilliger of partnerstichting.' };
    if (String(b.websiteExtra || '').trim()) return { ok:true, stil:true };
    const naam = schoon(b.naam, 120), plaats = schoon(b.plaats, 80);
    const contactNaam = schoon(b.contactNaam, 80), email = String(b.email || '').trim().toLowerCase().slice(0, 160);
    const telefoon = schoon(b.telefoon, 30), landCode = alleen(b.landCode || 'NL').slice(0, 2) || 'NL';
    if (naam.length < 2 || plaats.length < 2 || contactNaam.length < 2)
      return { status:400, error:'Vul de naam, plaats en contactpersoon volledig in.' };
    if (!emailOk(email)) return { status:400, error:'Vul een geldig e-mailadres in.' };
    if (b.bevoegd !== true || b.waarheidsgetrouw !== true || b.privacyAkkoord !== true)
      return { status:400, error:'Bevestig uw bevoegdheid, de juistheid van de gegevens en de privacy-informatie.' };
    const at = nu();
    const a = { id:rid(8), type, naam, plaats, contactNaam, email, telefoon, landCode,
      stadId:schoon(b.stadId, 40) || null, status:'nieuw', at,
      verklaringen:{ bevoegd:true, waarheidsgetrouw:true, privacyAkkoord:true, at },
      bron:{ ipHash:hash('foundation|' + String(ip || '')).slice(0, 20) } };
    if (type === 'school') {
      a.brin = alleen(b.brin).slice(0, 6);
      if (!/^[0-9A-Z]{4,6}$/.test(a.brin)) return { status:400, error:'Vul het BRIN van de onderwijsinstelling in (4 tot 6 tekens).' };
      if (lijst().some(x => x.type === type && x.brin === a.brin && ['nieuw','goedgekeurd'].includes(x.status)))
        return { status:409, error:'Voor dit BRIN bestaat al een open of goedgekeurde registratie.' };
    }
    if (type === 'vrijwilliger') {
      a.minderjarig = b.minderjarig === true; a.ouderToestemming = b.ouderToestemming === true;
      if (a.minderjarig && !a.ouderToestemming) return { status:400, error:'Voor een vrijwilliger onder 18 moet een ouder of wettelijk vertegenwoordiger instemmen.' };
      a.werktMetKwetsbaren = b.werktMetKwetsbaren === true;
      a.talen = Array.isArray(b.talen) ? b.talen.map(x => schoon(x, 30)).filter(Boolean).slice(0, 10) : [];
      a.vaardigheden = Array.isArray(b.vaardigheden) ? b.vaardigheden.map(x => schoon(x, 40)).filter(Boolean).slice(0, 15) : [];
    }
    if (type === 'partnerstichting') {
      a.registratieNummer = alleen(b.registratieNummer).slice(0, 30);
      if (landCode === 'NL' ? !/^\d{8}$/.test(a.registratieNummer) : a.registratieNummer.length < 3)
        return { status:400, error:landCode === 'NL' ? 'Vul het KVK-nummer van 8 cijfers in.' : 'Vul het nummer uit het officiële register van het vestigingsland in.' };
      a.rsin = alleen(b.rsin).slice(0, 12); a.anbi = b.anbi === true;
      if (a.rsin && !/^\d{9}$/.test(a.rsin)) return { status:400, error:'Een RSIN bestaat uit 9 cijfers.' };
      a.doel = schoon(b.doel, 500); a.website = schoon(b.website, 240);
      a.verwerktPersoonsgegevens = b.verwerktPersoonsgegevens === true;
      a.werktMetKwetsbaren = b.werktMetKwetsbaren === true;
      if (a.doel.length < 20) return { status:400, error:'Omschrijf het maatschappelijke doel in minimaal 20 tekens.' };
      if (lijst().some(x => x.type === type && x.landCode === landCode && x.registratieNummer === a.registratieNummer && ['nieuw','goedgekeurd'].includes(x.status)))
        return { status:409, error:'Voor deze officiële registratie bestaat al een open of goedgekeurde aanvraag.' };
    }
    if (lijst().filter(x => x.email === email && x.status === 'nieuw').length >= 3)
      return { status:429, error:'Er staan al meerdere open aanvragen op dit e-mailadres.' };
    const token = rid(24); a.statusTokenHash = hash(token);
    a.toelating = controle.startControle(type, a, at);
    lijst().unshift(a); db.data.foundationRegistraties = lijst().slice(0, 1000); save();
    return { ok:true, id:a.id, statusToken:token, aanvraag:publiek(a) };
  }

  function publiek(a, toegang) {
    const stand = controle.herbereken(a.toelating, klokNu());
    const uit = { id:a.id, type:a.type, typeLabel:(controle.TYPES[a.type] || {}).label, naam:a.naam,
      status:a.status, at:a.at, controles:a.toelating.eisen.map(e => ({ id:e.id, label:e.label, bron:e.bron,
        url:e.url, status:e.status })), open:stand.open.length };
    if (toegang && a.status === 'goedgekeurd') uit.toegang=a.toegang || null;
    if (a.besluit && a.status === 'afgewezen') uit.reden=a.besluit.reden;
    return uit;
  }
  function status(id, token) {
    const a = vind(id);
    if (!a || !token || !cryptoNode.timingSafeEqual(Buffer.from(hash(token)), Buffer.from(a.statusTokenHash || hash('x'))))
      return { status:403, error:'De registratielink is ongeldig.' };
    return { ok:true, aanvraag:publiek(a, true) };
  }
  function kantoorLijst() {
    return lijst().slice(0, 200).map(a => Object.assign({}, publiek(a), {
      plaats:a.plaats, stadId:a.stadId, contactNaam:a.contactNaam, email:a.email, telefoon:a.telefoon,
      landCode:a.landCode, brin:a.brin, registratieNummer:a.registratieNummer, rsin:a.rsin,
      anbi:!!a.anbi, doel:a.doel, werktMetKwetsbaren:!!a.werktMetKwetsbaren,
      verwerktPersoonsgegevens:!!a.verwerktPersoonsgegevens, toelating:a.toelating, toegang:a.toegang || null
    }));
  }
  function controleer(id, b, door) {
    const a = vind(id); if (!a) return { status:404, error:'Registratie niet gevonden.' };
    if (a.status !== 'nieuw') return { status:409, error:'Alleen een open registratie kan worden gecontroleerd.' };
    const r = controle.controleer(a.toelating, b || {}, door, nu()); if (!r.ok) return r;
    save(); return { ok:true, open:r.open };
  }

  function beslis(id, actie, reden, door) {
    const a = vind(id); if (!a) return { status:404, error:'Registratie niet gevonden.' };
    if (a.status !== 'nieuw') return { status:409, error:'Deze registratie is al behandeld.' };
    if (actie === 'afwijzen') {
      const waarom = schoon(reden, 400); if (waarom.length < 3) return { status:400, error:'Leg de reden van afwijzing vast.' };
      a.status='afgewezen'; a.besluit={ actie, reden:waarom, door, at:nu() }; save(); return { ok:true, aanvraag:a };
    }
    if (actie !== 'goedkeuren') return { status:400, error:'Kies goedkeuren of afwijzen.' };
    const mag = controle.magGoedkeuren(a, klokNu()); if (!mag.ok) return Object.assign({ status:409 }, mag);
    const uitgifte = provision(a); if (!uitgifte || uitgifte.error) return uitgifte;
    const toegang = uitgifte.toegang || uitgifte;
    a.status='goedgekeurd'; a.toegang=toegang; a.besluit={ actie, door, at:nu() }; save();
    return { ok:true, aanvraag:a, toegang, geheim:uitgifte.geheim || null };
  }

  return { catalogus, aanvragen, status, kantoorLijst, controleer, beslis, publiek, bronnen:controle.BRONNEN };
};
