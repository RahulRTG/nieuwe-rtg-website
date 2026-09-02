/* DE ISOLATIEMODUS VAN EEN LID -- zichzelf beschermen zonder RTG te bellen.

   WAAROM DIT EEN EIGEN BESTAND IS EN GEEN PARAMETER AAN DE EIGENAAR-CONSOLE.
   routes/techniek/isolatie.js is containment: RTG zet bij een verdenking een
   identiteit, sessie of apparaat dicht. Dit is het omgekeerde -- een mens die
   zelf denkt dat er iets mis is. Dat is een andere handeling met een andere
   toon, een ander scherm en vooral een andere BEVOEGDHEID, en die drie in een
   route persen met een vlag erbij is hoe een lid op een dag de knop van het
   kantoor te pakken krijgt.

   DE SLEUTEL KOMT UIT DE SESSIE EN NOOIT UIT HET VERZOEK. Dat is de enige regel
   die hier echt telt. Zou het lid zijn eigen sleutel mogen meesturen, dan kan
   hij de sessie van iemand anders in isolatie zetten -- een aardig klinkende
   functie die in werkelijkheid een uitlogknop voor willekeurige leden is. Het
   lijf van het verzoek draagt hier dus GEEN sleutel, en er is geen pad waarlangs
   er een binnenkomt.

   EEN LID ZET ALLEEN ZIJN EIGEN LAGEN. `identiteit` (ik, overal), `sessie`
   (deze inlog) en `apparaat` zijn van hem. `organisatie` en `huis` zijn dat
   niet: wie zijn eigen werkgever kan isoleren, kan andermans werkgever
   isoleren.

   VERLAGEN LOOPT LANGS DEZELFDE CEREMONIE als bij het kantoor. Dat is met opzet
   niet lichter gemaakt voor een lid: juist bij een lid is het scenario dat de
   ceremonie moet vangen -- iemand die de sessie heeft overgenomen en de
   bescherming weer uit wil zetten -- het meest waarschijnlijk. */
'use strict';

const functies = require('../functies');
const klok = require('../lib/klok');
const maakIsolatie = require('../kern/isolatie');
const { maakBruikbaarheid } = require('../kern/isolatie/bruikbaarheid');

const EIGEN_LAGEN = ['identiteit', 'sessie', 'apparaat'];

module.exports = (kern) => {
  const { app, db, save, auth, beveilig } = kern;

  /* EEN LAAG EN NIET TWEE. De eigenaar-console maakt dezelfde laag; hij hangt
     hier op zodat de ceremonies, de standen en het spoor van beide kanten
     hetzelfde zijn. Twee exemplaren zouden allebei uit db.data lezen en toch
     uiteenlopen zodra er een cache of een teller bij komt -- en dan kent de een
     een ceremonie die de ander niet kent. */
  kern.isolatie = kern.isolatie || maakIsolatie({
    db, save, functies, klok, beveilig,
    huisStand: () => {
      const t = db.data && db.data.techniek;
      const s = t && t.incidentcontrole;
      return (s && s.modus) || 'normaal';
    }
  });
  const isolatie = kern.isolatie;
  /* WAT ER NOG WERKT, voor het lid zelf. Dezelfde meter als op de cockpit en met
     opzet niet een tweede lijst: een lid dat overweegt zichzelf dicht te zetten,
     hoort precies te zien wat het kantoor ook ziet. Wie de knop niet durft in te
     drukken, wordt er niet door beschermd. */
  const bruikbaar = maakBruikbaarheid({ isolatie, functies });

  /* De drie sleutels van dit lid, alle drie uit de sessie. `apparaat` bestaat
     alleen als de sessie er een draagt; hem verzinnen zou een stand opleveren
     die aan niets hangt. */
  function mijnSleutels(req) {
    const s = req.session || {};
    return {
      identiteit: s.key || null,
      sessie: s.id || s.sid || s.key || null,
      apparaat: s.apparaat || s.device || null
    };
  }
  function laagOf(req, drager) {
    if (!EIGEN_LAGEN.includes(String(drager))) {
      const e = new Error('U kunt alleen uw eigen lagen zetten: ' + EIGEN_LAGEN.join(', ') + '.');
      e.status = 403; throw e;
    }
    const sleutel = mijnSleutels(req)[drager];
    if (!sleutel) {
      const e = new Error('Deze sessie draagt geen ' + drager + '; er is niets om een stand aan te hangen.');
      e.status = 409; throw e;
    }
    return sleutel;
  }
  function actor(req) { return 'lid-' + String((req.session && req.session.key) || 'onbekend').slice(0, 40); }
  function faal(res, e) {
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'De handeling mislukte.' });
  }

  /* WAT ER TERUGKOMT IS MIJN STAND EN NIET DIE VAN HET HUIS. Het huis telt wel
     mee in de effectieve stand -- de join is de join -- maar wat er STAAT per
     drager blijft bij de dragers die van dit lid zijn. Een lid hoeft niet te
     weten hoeveel andere leden RTG heeft dichtgezet. */
  app.post('/api/isolatie/mijn', auth, (req, res) => {
    try {
      const sleutels = mijnSleutels(req);
      const ctx = isolatie.context(sleutels);
      const mijn = {};
      for (const d of EIGEN_LAGEN) mijn[d] = sleutels[d] ? (isolatie.standVan(d, sleutels[d]) || 'normaal') : null;
      res.set('Cache-Control', 'no-store');
      res.json({
        ok: true,
        mijn,
        effectief: isolatie.effectieveStand(ctx.standen),
        /* Het huis staat er als STAND en niet als getal: dat er een incident
           loopt, merkt een lid toch, en het verzwijgen maakt zijn eigen scherm
           onbegrijpelijk ("waarom kan ik dit niet, ik sta op normaal"). */
        platform: ctx.standen.huis,
        open: isolatie.ontsluiting.open().filter(v => EIGEN_LAGEN.includes(v.drager) &&
          Object.values(sleutels).includes(v.sleutel)),
        /* Per stand: wat blijft er van je dagelijkse dingen over. Alleen de
           verhalen van een LID -- wat een zaak of het kantoor nog kan, is niet
           iets waar dit scherm over gaat. */
        werktNog: bruikbaar.overStanden(['beschermd', 'isolatie'])
      });
    } catch (e) { faal(res, e); }
  });

  app.post('/api/isolatie/mijn/zet', auth, (req, res) => {
    const b = req.body || {};
    try {
      const drager = String(b.drager || 'identiteit');
      const uit = isolatie.zet({ drager, sleutel: laagOf(req, drager), naar: b.naar,
        door: actor(req), reden: b.reden, zetter: drager });
      res.json({ ok: true, uit });
    } catch (e) { faal(res, e); }
  });

  app.post('/api/isolatie/mijn/ontsluiting', auth, (req, res) => {
    const b = req.body || {};
    try {
      const drager = String(b.drager || 'identiteit');
      res.json({ ok: true, verzoek: isolatie.vraagOntsluiting({ drager, sleutel: laagOf(req, drager),
        naar: b.naar, door: actor(req), reden: b.reden }) });
    } catch (e) { faal(res, e); }
  });

  /* DE STAP EN DE COMMIT MOETEN OVER EEN VERZOEK VAN DIT LID GAAN. Zonder deze
     controle kan een lid met een geraden nummer de ceremonie van iemand anders
     aftekenen -- en dat is precies de aanval waar deze hele laag tegen is. */
  function mijnVerzoek(req, id) {
    const v = isolatie.ontsluiting.vind(id);
    const sleutels = Object.values(mijnSleutels(req)).filter(Boolean);
    if (!v || !EIGEN_LAGEN.includes(v.drager) || !sleutels.includes(v.sleutel)) {
      const e = new Error('Onbekende ontsluiting.');   // met opzet hetzelfde antwoord als "bestaat niet"
      e.status = 404; throw e;
    }
    return v;
  }

  app.post('/api/isolatie/mijn/ontsluiting/stap', auth, (req, res) => {
    const b = req.body || {};
    try {
      mijnVerzoek(req, b.id);
      res.json({ ok: true, verzoek: isolatie.ontsluiting.stap(b.id,
        { soort: b.soort, door: actor(req), bewijs: b.bewijs }) });
    } catch (e) { faal(res, e); }
  });

  app.post('/api/isolatie/mijn/ontsluiting/commit', auth, (req, res) => {
    const b = req.body || {};
    try {
      mijnVerzoek(req, b.id);
      res.json({ ok: true, uit: isolatie.voltooiOntsluiting(b.id, { door: actor(req) }) });
    } catch (e) { faal(res, e); }
  });

  app.post('/api/isolatie/mijn/ontsluiting/afbreken', auth, (req, res) => {
    const b = req.body || {};
    try {
      mijnVerzoek(req, b.id);
      res.json({ ok: true, verzoek: isolatie.ontsluiting.afbreken(b.id,
        { door: actor(req), reden: b.reden }) });
    } catch (e) { faal(res, e); }
  });
};
