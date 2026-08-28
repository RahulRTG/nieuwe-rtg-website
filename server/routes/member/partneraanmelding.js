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
  /* save, crypto, schoon, mail en sseToOffice zijn hier NIET meer nodig: die
     horen bij de aanvraag, en die woont sinds vandaag in
     ./partneraanmelding-aanvraag.js. Dat bestand pakt ze zelf uit kern. Ze hier
     laten staan is geen kleinigheid -- keuringsregel 39 leest een ongebruikte
     naam als een routebestand dat verder reikt dan zijn werk. */
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

  /* ACHTER DEZELFDE POORT ALS DE REST VAN DEZE MODULE. Dit stond open: de
     ladder (trede "de dwaler") klopte op deze deur zonder sleutel en kreeg een
     geslaagd antwoord. Wat eruit komt is geen geheim -- bedrijfstypes met hun
     eisen -- maar het is wel de volledige kaart van wat RTG van een partner
     vraagt, en die hoort bij iemand die partner MAG worden.
     Het scherm dat hem aanroept (public/apps/partner-worden.js) stuurt de
     ledentoken al mee, dus dit breekt niets. */
  app.post('/api/partner/types', (req, res) => {
    if (!partnerSessie(req)) return res.status(403).json({ error: 'Log in met een pas die partner mag zijn (' +
      caps.tredenMet('can_be_partner').map(t => (ladder.trede(t) || {}).naam || t).join(' of ') + ').' });
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

  /* DE AANVRAAG WOONT HIER, MET DE RIJKE CONTROLES EN DE JUISTE POORT.

     Bij het samenvoegen stonden er twee versies van /api/partner/apply naast
     elkaar. Die van de verzameling droeg het juiste besluit over WIE partner mag
     worden; deze droeg de officiele controles -- internationale registratie,
     handelseisen per land, dubbelcontrole op dezelfde registratie, honeypot,
     eigen rem, en het toelatingsdossier waar het kantoor daarna langs moet.

     Ik koos eerst de andere en noteerde het gemis als schuld. test/partnerpas.test.js
     bewees binnen een dag waarom dat niet kon: zonder toelatingsdossier kon zelfs
     de eigenaar de officiele controles overslaan. Dus staat de rijke versie hier,
     met de capability-poort ervoor in plaats van de harde tredecontrole -- en de
     aanvraag draagt nu OOK `pas`, want daar kijkt de kantoorpoort naar. */
  /* De aanvraag zelf woont in ./partneraanmelding-aanvraag.js -- zie de kop
     daar. Apart omdat dit bestand anders over de 10 KB gaat, maar de naad is
     echt: types en 'mijn aanvragen' zijn LEZERS, de aanvraag is de handeling
     met alle officiele controles eraan. */
  require('./partneraanmelding-aanvraag')({ kern, partnerSessie, register, controle,
    internationaal, kvk, geldigeUrl, teVeel, klokNu, klokDatum, caps, ladder });


};
