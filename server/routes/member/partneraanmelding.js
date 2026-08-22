/* Bedrijveningang van WORK: een korte aanvraag met een harde toelatingspoort.
   Aanvragen mag snel; een bedrijfscode ontstaat pas nadat alle register-,
   vergunning- en integriteitscontroles aantoonbaar zijn afgerond. */
'use strict';

const caps = require('../../kern/commercie/capaciteiten');
const ladder = require('../../kern/pasladder');
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
  const { app, db, resolveSession } = kern;

  /* DEZELFDE POORT ALS DE AANVRAAG, en om dezelfde reden. Hier stond
     `sess.tier === 'business'`: een harde tredecontrole in de code. Dat is de
     gelijkstelling die dit huis heeft teruggedraaid -- de Business Pass is een
     lidmaatschapsniveau en geen vergunning om een bedrijf te hebben. Een lid met
     een gewone RTG Pass dat partner is, moet zijn eigen aanvragen kunnen zien.
     De vraag "mag deze trede partner zijn" hoort op één plek te worden gesteld,
     en dat is de capability (CONTROLPLANE.md). */
  function partnerSessie(req) {
    const token = String((req.body || {}).passToken || (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || '');
    const sess = token ? resolveSession(token) : null;
    return sess && caps.mag(sess.tier, 'can_be_partner') ? sess : null;
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
    const sess = partnerSessie(req);
    if (!sess) return res.status(403).json({ error: 'Log in met een pas die partner mag zijn (' +
      caps.tredenMet('can_be_partner').map(t => (ladder.trede(t) || {}).naam || t).join(' of ') +
      ') om uw aanvragen te zien.' });
    const aanvragen = (db.data.partnerApplications || []).filter(a => a.businessPass && a.businessPass.key === sess.key)
      .slice(0, 20).map(a => {
        const stand = controle.herbereken(a.toelating, klokNu());
        return { id: a.id, company: a.company, city: a.city, status: a.status, code: a.code || null,
          toelating: { status: stand.status, open: stand.open.length,
            eisen: a.toelating && a.toelating.eisen ? a.toelating.eisen.map(e => ({ id: e.id, label: e.label, status: e.status })) : [] } };
      });
    res.json({ aanvragen });
  });

  /* /api/partner/apply STAAT HIER NIET, en dat is een besluit.

     Deze module bracht een eigen `apply` mee met een poort die zegt
     `sess.tier === 'business'`. Dat is precies de gelijkstelling die dit huis
     op 21 augustus 2026 heeft teruggedraaid, met CONCERN.md erbij: de Business
     Pass is een LIDMAATSCHAPSNIVEAU en geen vergunning om een bedrijf te
     hebben. Wie met een gewone RTG Pass een zaak runt, is niet minder
     ondernemer. De poort staat sindsdien in ./partneraanvraag.js en loopt via
     `caps.mag(tier, 'can_be_partner')` -- de capability-laag, op één plek, zoals
     CONTROLPLANE.md eist. Een tweede, hardgecodeerde tredecontrole ernaast zou
     die beslissing stilletjes terugdraaien.

     WAT HIER WEL VERLOREN GING, en dat hoort te staan in plaats van te
     verdwijnen: de apply van deze module had rijkere controles dan die van
     partneraanvraag.js -- internationale registratie (registratieUit), de
     handelseisen per land, een dubbelcontrole op dezelfde registratie, een
     honeypot en een eigen rem. Die horen naar partneraanvraag.js te verhuizen,
     bij de juiste poort. Zolang dat niet is gebeurd, mist de partneraanvraag ze.
     De twee routes hieronder blijven wel: die zijn nieuw en botsen met niets. */

};
