/* School (deelmodule): de taallaag -- het beleid, en de poort naar het gezin.

   TWEE DINGEN.

   1. HET VAKBELEID. Niet overal een vertaalknop: bij Nederlands meet je de taal
      zelf, bij wiskunde meet je het concept. Een school stelt in wat er per vak
      mag, maar bij een taalvak kan het nooit op "volledig" -- dat is geen
      instelling maar de meting (zie kern/taalbeleid.js).

   2. DE POORT NAAR HET GEZIN. Een vertaald bericht gaat pas de deur uit als een
      mens de TERUGVERTALING heeft gezien, met de betekenisverschillen erbij.
      Verschuift er iets in een ontkenning, een verplichting, een getal of een
      datum, dan is bevestigen niet genoeg: dan moet de leraar met zoveel
      woorden zeggen dat hij het gezien heeft.

   Drie grenzen hier:

   - GEEN BONNETJE, GEEN BERICHT (grens 5). Elk vertaald bericht dat een gezin
     bereikt, draagt een bon: welk model, welke gegevens wel en niet gebruikt,
     wanneer, en wie het heeft goedgekeurd met zijn naam.
   - DE VERTAAL-AI ZIET ALLEEN DE TEKST (grens 4). Er gaat geen kindnaam, geen
     dossier en geen klas mee de vertaling in; dat staat ook op de bon.
   - ZONDER VERTALER GEBEURT ER NIETS STILS. Is er geen vertaling te maken, dan
     zegt de poort dat, en gaat het bericht niet in het Nederlands "maar toch
     even" de deur uit. */
const vertaal = require('../translate');
const { bestaat } = require('../talen');
const { vergelijk, moetGezienWorden } = require('../kern/betekenis');
const { steunVoor, maximum, reden, schoonBeleid, STANDEN } = require('../kern/taalbeleid');

module.exports = (sctx) => {
  const { router, save, nu, schoon, S, eigenVeld, klasVan, schoolVan } = sctx;

  /* ---------- het vakbeleid van de school ---------- */
  router.post('/school/taalbeleid', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const sch = k.schoolCode ? eigenVeld(S(), k.schoolCode) : null;
    const beleid = (sch && sch.taalbeleid) || {};
    const vakken = [...new Set(['rekenen', 'taal', 'nederlands', 'engels', 'wiskunde', 'natuurkunde',
      'aardrijkskunde', 'geschiedenis', 'biologie', 'economie'].concat(Object.keys(beleid)))];
    res.json({ ok: true, standen: STANDEN,
      vakken: vakken.map(vak => ({ vak, steun: steunVoor(vak, beleid), maximum: maximum(vak), reden: reden(vak) })),
      uitleg: 'Steun staat altijd ERNAAST; het Nederlands verdwijnt nooit. Bij taalvakken kan het niet op volledig, want daar is de taal zelf wat er wordt gemeten.' });
  });

  router.post('/school/taalbeleid/zet', (req, res) => {
    const g = schoolVan(req, res); if (!g) return;
    const sch = g.sch || g;
    const gevraagd = req.body.beleid && typeof req.body.beleid === 'object' ? req.body.beleid : {};
    sch.taalbeleid = Object.assign({}, sch.taalbeleid || {}, schoonBeleid(gevraagd));
    save();
    /* Zeg het als een keuze is teruggezet. Stil bijstellen is erger dan
       weigeren: dan denkt een school dat het aanstaat. */
    const teruggezet = Object.keys(gevraagd).filter(v =>
      STANDEN.includes(gevraagd[v]) && sch.taalbeleid[String(v).toLowerCase().trim()] !== gevraagd[v]);
    res.json({ ok: true, beleid: sch.taalbeleid, teruggezet,
      uitleg: teruggezet.length
        ? 'Voor ' + teruggezet.join(', ') + ' is de keuze teruggezet naar wat het vak toelaat: bij een taalvak meet je de taal zelf.'
        : 'Vastgelegd.' });
  });

  /* ---------- de poort: eerst zien, dan versturen ---------- */
  router.post('/school/bericht/controleer', async (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const tekst = schoon(req.body.tekst, 1200);
    const taal = String(req.body.taal || '').toLowerCase().trim();
    if (!tekst) return res.status(400).json({ error: 'Geef de tekst van het bericht.' });
    if (!taal || taal === 'nl' || !bestaat(taal)) return res.status(400).json({ error: 'Kies de taal van het gezin.' });

    let heen, terugtekst;
    try {
      heen = await vertaal.translate(tekst, taal, 'nl');
      terugtekst = (await vertaal.translate(heen.text, 'nl', taal)).text;
    } catch (e) {
      return res.status(503).json({ error: 'Er is nu geen vertaling te maken. Stuur het bericht in het Nederlands of laat een mens het vertalen; het gaat niet ongemerkt de deur uit.' });
    }
    const verschillen = vergelijk(tekst, terugtekst);
    res.json({ ok: true, taal, vertaling: heen.text, terug: terugtekst, verschillen,
      moetGezien: moetGezienWorden(verschillen),
      bon: { model: heen.via || 'woordenboek', gebruikt: ['de tekst van dit bericht'],
        nietGebruikt: ['de naam van het kind', 'het leerlingdossier', 'de klas', 'de gezinssituatie'], op: nu() },
      uitleg: verschillen.length
        ? 'Kijk deze verschillen na voordat u verstuurt. Dit is een telling van ontkenningen, verplichtingen, getallen en data -- geen oordeel over de vertaling zelf.'
        : 'Op ontkenning, verplichting, getallen en data is er niets verschoven. Dat betekent niet dat de vertaling goed is; dat beoordeelt u.' });
  });

  router.post('/school/bericht/verstuur', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const door = schoon(req.body.door, 60);
    if (!door) return res.status(400).json({ error: 'Zet uw naam erbij; een bericht aan een gezin gaat op naam de deur uit.' });
    if (req.body.bevestigd !== true) return res.status(400).json({ error: 'Een vertaald bericht gaat pas weg als u de terugvertaling hebt gezien en bevestigt.' });
    const verschillen = Array.isArray(req.body.verschillen) ? req.body.verschillen : [];
    if (moetGezienWorden(verschillen) && req.body.verschillenGezien !== true)
      return res.status(409).json({ error: 'Er is iets verschoven in een ontkenning, verplichting, getal of datum. Bevestig apart dat u dat hebt gezien.' });
    const tekst = schoon(req.body.tekst, 1200), vertaling = schoon(req.body.vertaling, 1600);
    if (!tekst || !vertaling) return res.status(400).json({ error: 'Er is geen gecontroleerd bericht om te versturen.' });

    if (!Array.isArray(k.mededelingen)) k.mededelingen = [];
    const bon = { model: schoon(req.body.model, 40) || 'onbekend', door, op: nu(),
      gebruikt: ['de tekst van dit bericht'],
      nietGebruikt: ['de naam van het kind', 'het leerlingdossier', 'de klas', 'de gezinssituatie'],
      verschillen: verschillen.map(v => v.soort), gezien: !!req.body.verschillenGezien };
    const m = { id: 'B' + Math.random().toString(36).slice(2, 7).toUpperCase(), tekst, at: nu(), door,
      vertaling: { taal: schoon(req.body.taal, 8), tekst: vertaling }, bon };
    k.mededelingen.unshift(m); k.mededelingen = k.mededelingen.slice(0, 200);
    save();
    res.json({ ok: true, mededeling: { id: m.id, at: m.at }, bon,
      uitleg: 'Verstuurd met een bon eronder: welk model, wat er wel en niet in ging, wanneer, en op wiens naam.' });
  });
};
