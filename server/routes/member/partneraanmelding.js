/* Bedrijveningang van WORK: een korte aanvraag met een harde toelatingspoort.
   Aanvragen mag snel; een bedrijfscode ontstaat pas nadat alle register-,
   vergunning- en integriteitscontroles aantoonbaar zijn afgerond. */
'use strict';

const register = require('../../seed/genres');
const controle = require('../../kern/bedrijfscontrole');
const kvk = require('../../kern/kvkvoorcontrole');
const internationaal = require('../../kern/internationalehandel');
const { nu: klokNu, datum: klokDatum } = require('../../lib/klok');

const VENSTER_MS = 60 * 60 * 1000;
const MAX_PER_VENSTER = 4;
const vensters = new Map();

function teVeel(sleutel) {
  const tijd = klokNu();
  const oud = vensters.get(sleutel);
  const v = !oud || oud.tot <= tijd ? { n: 0, tot: tijd + VENSTER_MS } : oud;
  v.n += 1; vensters.set(sleutel, v);
  return v.n > MAX_PER_VENSTER;
}

function geldigeUrl(waarde) {
  if (!waarde) return null;
  try { const u = new URL(String(waarde).trim()); return /^https?:$/.test(u.protocol) ? u.toString().slice(0, 240) : null; }
  catch (_) { return null; }
}

module.exports = (kern) => {
  const { app, db, save, crypto, schoon, resolveSession, mail, sseToOffice } = kern;

  function businessSessie(req) {
    const token = String((req.body || {}).passToken || (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || '');
    const sess = token ? resolveSession(token) : null;
    return sess && sess.tier === 'business' ? sess : null;
  }

  app.post('/api/partner/types', (req, res) => {
    const types = register.aanvraagbareGenres().map(code => {
      const def = db.data.supplierTypes[code] || register.GENRES[code];
      return { code, label: def.label, industry: def.industry,
        gereguleerd: internationaal.sectorEisNodig(code, {}),
        eisen: controle.eisenVoor(code, {}).filter(e => e.aanvrager).map(e => ({ id: e.id, label: e.label, bron: e.bron, url: e.url })) };
    });
    const activiteitEisen = {};
    for (const vlag of ['voedsel', 'alcohol', 'pakketreis'])
      activiteitEisen[vlag] = controle.eisenVoor('zzp', { [vlag]: true }).find(e => e.id === (vlag === 'voedsel' ? 'nvwa' : vlag));
    const landen = internationaal.landen().map(l => ({ ...l, register: internationaal.registerSuggestie(l.code) }));
    res.json({ types, bronnen: { ...controle.BRONNEN, ...internationaal.BRONNEN },
      activiteitEisen, landen, handelEisen: internationaal.catalogus() });
  });

  app.post('/api/partner/applications/mijn', (req, res) => {
    const sess = businessSessie(req);
    if (!sess) return res.status(403).json({ error: 'Log in met uw Business Pass om uw aanvragen te zien.' });
    const aanvragen = (db.data.partnerApplications || []).filter(a => a.businessPass && a.businessPass.key === sess.key)
      .slice(0, 20).map(a => {
        const stand = controle.herbereken(a.toelating, klokNu());
        return { id: a.id, company: a.company, city: a.city, status: a.status, code: a.code || null,
          toelating: { status: stand.status, open: stand.open.length,
            eisen: a.toelating && a.toelating.eisen ? a.toelating.eisen.map(e => ({ id: e.id, label: e.label, status: e.status })) : [] } };
      });
    res.json({ aanvragen });
  });

  app.post('/api/partner/apply', async (req, res) => {
    const b = req.body || {};
    const sess = businessSessie(req);
    if (!sess) return res.status(403).json({ error: 'Zonder Business Pass geen bedrijfscode. Log in met uw actieve Business Pass en probeer het opnieuw.' });
    // Bots krijgen geen bruikbare terugkoppeling en schrijven niets.
    if (String(b.websiteExtra || '').trim()) return res.json({ ok: true });

    const company = schoon(b.company, 80);
    const type = String(b.type || '').trim();
    const city = schoon(b.city, 60);
    const contactName = schoon(b.contactName, 60);
    const email = String(b.email || '').trim().toLowerCase().slice(0, 120);
    const phone = String(b.phone || '').trim().slice(0, 30);
    const note = schoon(b.note, 500);
    const website = geldigeUrl(b.website);
    const poort = register.genreToegang(type);
    if (!poort || !poort.ok) return res.status(400).json({ error: poort && poort.uitleg || 'Kies een geldig type bedrijf.' });
    if (!company || !city || !contactName) return res.status(400).json({ error: 'Vul de bedrijfsnaam, plaats en contactpersoon in.' });
    const regResultaat = internationaal.registratieUit(b);
    if (regResultaat.error) return res.status(400).json({ error: regResultaat.error });
    const registratie = regResultaat.registratie;
    b.landCode = registratie.landCode; b.registerBron = registratie.registerBron;
    if (b.website && !website) return res.status(400).json({ error: 'Vul een volledig webadres in dat met https:// begint.' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Vul een geldig e-mailadres in.' });
    if (b.akkoord !== true || b.bevoegd !== true || b.waarheidsgetrouw !== true)
      return res.status(400).json({ error: 'Bevestig de voorwaarden, uw bevoegdheid en dat de registratie- en vergunninggegevens juist en geldig zijn.' });

    const handelsEisen = internationaal.eisenVoor(type, b, registratie);
    const defs = controle.eisenVoor(type, b).concat(handelsEisen);
    const bewijzen = b.bewijzen && typeof b.bewijzen === 'object' ? b.bewijzen : {};
    const ontbreekt = defs.filter(e => e.aanvrager && String(bewijzen[e.id] || '').trim().length < 3);
    if (ontbreekt.length) return res.status(400).json({ error: 'Vul de officiële referentie in voor: ' + ontbreekt.map(e => e.label).join('; ') + '.' });

    const zelfdeRegistratie = x => x && (x.sleutel === registratie.sleutel ||
      (!x.sleutel && registratie.landCode === 'NL' && x.kvkNummer === registratie.kvkNummer));
    const dubbel = (db.data.partnerApplications || []).find(a => ['nieuw', 'goedgekeurd'].includes(a.status) && zelfdeRegistratie(a.registratie));
    const bestaande = (db.data.suppliers || []).find(s => zelfdeRegistratie(s.registratie));
    if (dubbel || bestaande) return res.status(409).json({ error: 'Voor deze officiële bedrijfsregistratie bestaat al een open of goedgekeurde partneraanvraag.' });
    if (teVeel(String(req.ip || '') + ':' + String(sess.key || 'business')))
      return res.status(429).json({ error: 'Er zijn kort achter elkaar te veel aanvragen gedaan. Probeer het later opnieuw.' });

    const voorcontrole = registratie.landCode === 'NL'
      ? await kvk.voorcontrole({ apiKey: process.env.KVK_API_KEY,
        kvkNummer: registratie.kvkNummer, vestigingsnummer: registratie.vestigingsnummer, company, fetchFn: global.fetch })
      : { status: 'handmatig', reden: 'Controle in het officiële register van het vestigingsland is verplicht.' };
    if (voorcontrole.status === 'niet_gevonden') return res.status(422).json({ error: 'Dit KVK-nummer is niet als actieve inschrijving gevonden.' });
    if (voorcontrole.status === 'gevonden' && (!voorcontrole.actief || !voorcontrole.naamMatch || !voorcontrole.vestigingMatch))
      return res.status(422).json({ error: 'De bedrijfsnaam of vestiging komt niet overeen met het actieve KVK-profiel. Controleer de gegevens of neem contact op met RTG.' });

    const at = klokDatum().toISOString();
    const entry = {
      id: crypto.randomBytes(8).toString('hex'), company, type, city, contactName, email, phone, website, note,
      registratie: { ...registratie, voorcontrole },
      activiteiten: { ...controle.vlaggenUit(b), ...internationaal.vlaggenUit(b) },
      verklaringen: { bevoegd: true, waarheidsgetrouw: true, vergunningenGeldig: true, at },
      akkoord: { partnervoorwaarden: true, verwerkersafspraken: true, at },
      businessPass: { key: sess.key, at }, status: 'nieuw', at
    };
    const registratieReferentie = registratie.landCode + ' · ' + registratie.nummer +
      (registratie.regioOfStaat ? ' · ' + registratie.regioOfStaat : '') +
      (registratie.vestigingsnummer ? ' · ' + registratie.vestigingsnummer : '');
    entry.toelating = controle.startControle({ genre: type, data: b,
      registratieReferentie, extraEisen: handelsEisen, bewijzen, at });
    db.data.partnerApplications.unshift(entry);
    db.data.partnerApplications = db.data.partnerApplications.slice(0, 200);
    save();
    mail.send(email, 'Uw gecontroleerde partneraanvraag bij Rahul Travel Group',
      'Beste ' + contactName + ',\n\nWe hebben de aanvraag voor ' + company + ' ontvangen. ' +
      'Een bedrijfscode wordt pas uitgegeven nadat het officiële handelsregister, bevoegdheid, toepasselijke vergunningen en fraudesignalen zijn gecontroleerd. ' +
      'U hoeft geen kopie van een identiteitsbewijs te mailen. De voortgang staat in de WORK-aanvraag.\n\nRahul Travel Group');
    sseToOffice('sync', { scope: 'team' });
    res.json({ ok: true, id: entry.id, toelating: { status: entry.toelating.status,
      controles: entry.toelating.eisen.length } });
  });
};
