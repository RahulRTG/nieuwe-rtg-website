/* RTF School: het schoolkanaal van de RTFoundation ("slimmer dan Magister").

   Een leraar maakt een klas en krijgt een klascode (voor de ouders) en een
   leraar-token (zijn sleutel). Een ouder koppelt zijn kind met de klascode.
   Daarna: rooster, huiswerk (met afvinken en een brug naar de AI-bijles),
   cijfers, mededelingen, ziekmelden in één tik, en berichten met de leraar.

   Twee principes die dit veiliger maken dan de bekende school-apps:
   1. GEEN privékanaal leraar-kind: schoolberichten lopen per gezin, dus een
      ouder kijkt standaard mee. Dat sluit aan op de kinderbescherming elders
      in de app (t/m 15 geen open sociale laag).
   2. Cijfers zijn per kind afgeschermd: een gezin ziet alleen de cijfers van
      de eigen kinderen; de leraar ziet alleen zijn eigen klas.

   Krijgt de gedeelde foundation-helpers mee (ctx) en registreert zijn routes op
   dezelfde router; alles onder /api/foundation/school/... */
const { eigenVeld } = require('./kern/util'); // veilige objecttoegang (geen prototype-pollution)

module.exports = (ctx) => {
  const { router, F, G, save, rid, nu, schoon, gezinVan, profielVan, crypto } = ctx;

  function K() {
    const f = F();
    if (!f.klassen) f.klassen = {};
    return f.klassen;
  }
  /* scholen: de wortel van alles. EERST meldt een school zich aan (directie
     krijgt een beheer-token), DAN melden leraren en overig personeel zich bij
     die school (en wachten op goedkeuring van de directie), en pas daarna
     kunnen goedgekeurde leraren klassen maken waar gezinnen hun kinderen aan
     koppelen. */
  function S() {
    const f = F();
    if (!f.scholen) f.scholen = {};
    return f.scholen;
  }
  const klasCode = () => { let c; do { c = crypto.randomBytes(3).toString('hex').toUpperCase(); } while (K()[c]); return c; };
  const schoolCode = () => { let c; do { c = 'S' + crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5); } while (S()[c]); return c; };

  // directie-authenticatie: schoolcode + beheer-token
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
        if (p && p.status === 'actief' && p.id === k.leraarId) mag = true; // de eigen leraar
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

  // een school is pas bruikbaar als RTG hem heeft goedgekeurd. Oude scholen
  // (van voor deze stap) hebben geen status en blijven gewoon actief.
  const isActief = (sch) => (sch.status || 'actief') === 'actief';

  /* ---------- stap 1: de SCHOOL meldt zich aan ----------
     De aanmelder (directie/administratie) krijgt de schoolcode (om aan het
     personeel te geven) en het beheer-token (de sleutel van de school). De
     school staat eerst op 'wacht': RTG keurt hem in de Backoffice goed voordat
     er personeel toegelaten of klassen gemaakt kunnen worden. */

  /* De drie lagen (beheer, klas, gezin) draaien als submodules op een
     gedeelde context, een keer opgebouwd bij het opstarten; de klaslaag
     levert gemiddelde() aan de gezinslaag via die context. */
  const sctx = { router, F, G, save, rid, nu, schoon, gezinVan, profielVan, crypto,
    eigenVeld, K, S, schoolVan, personeelVan, klasVan, gezinSessie, leerlingVan, klasCode, schoolCode, leerlingSleutel, isActief };
  Object.assign(sctx, require('./school/beheer')(sctx));
  Object.assign(sctx, require('./school/klas')(sctx));
  require('./school/gezin')(sctx);
};
