/* School: de poorten -- wie mag wat openen.

   Vier manieren om binnen te komen, en ze staan hier bij elkaar omdat het een
   begrip is: wie is dit, en mag die dit zien. Verspreid over de deelmodules
   zou elke laag zijn eigen versie krijgen, en dan lopen ze uit elkaar.

     schoolVan     -- de directie, met het beheer-token van de school;
     personeelVan  -- een medewerker, met zijn eigen personeel-token;
     klasVan       -- de klas: eigen klas-token, de leraar die hem geeft, een
                      teamlid, de lopende waarnemer, of de directie;
     gezinSessie   -- een gezin, via de gezins- en profielsessie.

   De waarnemer telt alleen zolang zijn waarneming loopt (./waarneming.js): een
   overname zonder einde is een tweede vaste leraar via de achterdeur. */
/* De tijd komt uit de tijdmachine en niet van het besturingssysteem: anders
   is dit bestand niet te beproeven op schrikkeldag, zomertijd of een verlopen
   termijn. Zie server/lib/klok.js. */
const { datum } = require('../lib/klok');
const { eigenVeld } = require('../kern/util');
const { loopt: waarnemingLoopt } = require('./waarneming');

function maakPoorten({ K, S, gezinVan, profielVan }) {
  function schoolVan(req, res) {
    const sch = eigenVeld(S(), String(req.body.schoolCode || '').trim().toUpperCase());
    if (!sch || sch.token !== String(req.body.beheerToken || '')) {
      res.status(403).json({ error: 'Onbekende school of verkeerd beheer-token.' });
      return null;
    }
    return sch;
  }
  // personeels-authenticatie: schoolcode + personeel-token (status telt apart)
  function personeelVan(req, res) {
    const sch = eigenVeld(S(), String(req.body.schoolCode || '').trim().toUpperCase());
    const tok = String(req.body.personeelToken || '');
    const p = sch && tok ? Object.values(sch.personeel || {}).find(x => x.token === tok) : null;
    if (!p) { res.status(403).json({ error: 'Onbekende school of verkeerd personeel-token.' }); return null; }
    return { sch, p };
  }

  /* klas-authenticatie: klascode + token. Toegestaan zijn:
     - het eigen klas-token (oudere, losse klassen blijven zo leesbaar);
     - het personeel-token van de leraar die de klas geeft (mits actief);
     - het beheer-token van de school (de directie kan bij alle klassen). */
  function klasVan(req, res) {
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    const tok = String(req.body.leraarToken || req.body.personeelToken || req.body.beheerToken || '');
    let mag = false;
    if (k && tok) {
      if (k.token === tok) mag = true;
      const sch = k.schoolCode ? S()[k.schoolCode] : null;
      if (sch) {
        if (sch.token === tok) mag = true; // directie
        const p = Object.values(sch.personeel || {}).find(x => x.token === tok);
        // de eigen leraar, een teamlid (max 3 vast) of de actieve waarnemer
        // de waarnemer telt alleen zolang zijn waarneming loopt (./school/waarneming.js)
        const waarnemer = waarnemingLoopt(k.waarnemer, datum().toISOString()) ? k.waarnemer : null;
        if (p && p.status === 'actief' && (p.id === k.leraarId
          || (k.leraren || []).some(x => x.id === p.id)
          || (waarnemer && waarnemer.id === p.id))) mag = true;
      }
    }
    if (!mag) {
      res.status(403).json({ error: 'Onbekende klas of verkeerd token.' });
      return null;
    }
    return k;
  }
  // gezins-authenticatie (ouder of kind), zoals overal in de foundation
  function gezinSessie(req, res) {
    const g = gezinVan(req, res); if (!g) return null;
    const p = profielVan(g, req.body.token);
    if (!p) { res.status(403).json({ error: 'Log opnieuw in bij je gezin.' }); return null; }
    return { g, p, beheerder: p.rol === 'beheerder' || p.rol === 'ouder' };
  }
  const leerlingSleutel = (gezinCode, profielId) => gezinCode + ':' + profielId;
  function leerlingVan(k, g, profielId) {
    return (k.leerlingen || []).find(l => l.sleutel === leerlingSleutel(g.code, profielId));
  }

  return { schoolVan, personeelVan, klasVan, gezinSessie, leerlingVan, leerlingSleutel };
}

module.exports = { maakPoorten };
