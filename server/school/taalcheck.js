/* School (deelmodule): de Language Independence Test, voor de mentor.

   Zes vragen: drie in het Nederlands en dezelfde drie opnieuw gesteld in de
   thuistaal van het kind. Niet vertaald maar OPNIEUW GESTELD uit dezelfde
   bouwstenen, zodat het antwoord niet verandert -- alleen de zin.

   DE UITKOMST IS EEN AANWIJZING VOOR EEN GESPREK. Er komt geen taalniveau uit,
   geen score en geen etiket, en er wordt NIETS opgeslagen: deze module schrijft
   niet. Wat je niet kunt bewaren, kan later niet aan een kind blijven plakken.

   De sessie leeft in het geheugen van dit proces en verdwijnt bij een
   herstart. Dat is met opzet: een halve taalvergelijking is niets waard, en een
   afgeronde hoort ook niet te blijven liggen.

   ALLEEN WAAR HET VAK HET TOELAAT (kern/taalbeleid.js). Bij een taalvak is de
   zin zelf wat je meet; daar zou deze test de meting weghalen. */
const { DOELEN } = require('../kern/leerstof');
const { opgave } = require('../kern/leerstof-gen');
const { mag, duiding, paren, VRAGEN } = require('../kern/taalcheck');

const norm = s => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
const LOPEND = new Map();
const MAX_LOPEND = 500;

module.exports = (sctx) => {
  const { router, S, eigenVeld, K, klasVan } = sctx;

  router.post('/school/taalcheck/start', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const sch = k.schoolCode ? eigenVeld(S(), k.schoolCode) : null;
    const l = (k.leerlingen || []).find(x => x.sleutel === String(req.body.leerling || ''));
    if (!l) return res.status(404).json({ error: 'Deze leerling zit niet in deze klas.' });
    const doel = eigenVeld(DOELEN, String(req.body.doel || ''));
    const poort = mag(doel, l.taal, (sch && sch.taalbeleid) || {});
    if (!poort.mag) return res.status(400).json({ error: poort.waarom });

    const rij = paren(doel, l.taal, opgave);
    if (!rij) return res.status(400).json({
      error: 'Bij dit leerdoel valt er niets te vergelijken: de vraag is in ' + l.taal + ' dezelfde als in het Nederlands, of er is voor die taal nog geen vorm van. Er wordt hier niet half vertaald en niet gedaan alsof -- een kale som heeft geen taal om over te struikelen.' });

    if (LOPEND.size > MAX_LOPEND) LOPEND.clear();
    LOPEND.set(k.code + ':' + l.sleutel, { doel: doel.id, taal: l.taal, rij, ix: 0, ronde: 'nl', nl: 0, thuis: 0 });
    res.json({ ok: true, doel: doel.id, naam: doel.naam, taal: l.taal, totaal: VRAGEN * 2,
      nr: 1, ronde: 'nl', vraag: rij[0].nl, opties: rij[0].opties,
      uitleg: 'Eerst ' + VRAGEN + ' vragen in het Nederlands, daarna dezelfde ' + VRAGEN + ' opnieuw gesteld in de eigen taal. Wat eruit komt is een aanwijzing voor een gesprek en geen oordeel.' });
  });

  router.post('/school/taalcheck/antwoord', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const sleutel = k.code + ':' + String(req.body.leerling || '');
    const s = LOPEND.get(sleutel);
    if (!s) return res.status(400).json({ error: 'Begin eerst een vergelijking.' });
    const vraag = s.rij[s.ix];
    if (norm(req.body.antwoord) === norm(vraag.a)) s[s.ronde] += 1;
    s.ix += 1;
    if (s.ix >= s.rij.length && s.ronde === 'nl') { s.ronde = 'thuis'; s.ix = 0; }
    else if (s.ix >= s.rij.length) {
      LOPEND.delete(sleutel);
      const d = duiding(s.nl, s.thuis, VRAGEN);
      return res.json({ ok: true, klaar: true, goedNl: s.nl, goedThuis: s.thuis, totaalPerRonde: VRAGEN,
        uitkomst: d,
        uitleg: 'Er is hier niets vastgelegd: deze uitkomst staat nergens opgeslagen en hangt niet aan dit kind. Wat u ermee doet, doet u in een gesprek.' });
    }
    const v = s.rij[s.ix];
    res.json({ ok: true, klaar: false, ronde: s.ronde,
      nr: (s.ronde === 'thuis' ? VRAGEN : 0) + s.ix + 1, totaal: VRAGEN * 2,
      vraag: s.ronde === 'nl' ? v.nl : v.thuis, opties: v.opties });
  });
};
