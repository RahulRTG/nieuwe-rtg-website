/* School (deelmodule): de overstap naar buiten -- wat gaat er mee, en in welke
   vorm.

   TWEE STAPPEN, EN ZE STAAN LOS VAN ELKAAR.

   1. WAT (kern/overdracht.js). Per gegeven een klasse: nodig voor inschrijving,
      nodig voor continuiteit, alleen met toestemming, of nooit. Zorg,
      incidenten en het journaal staan op nooit en daar is geen vinkje voor.
   2. IN WELKE VORM (kern/koppelvlak.js). Pas daarna wordt het vertaald naar
      Edu-V, Entree, Edu-API of OSO -- adapters eromheen, ons model binnen.

   Die volgorde is de hele grens. Zou de standaard eerst komen, dan bepaalt een
   koppelvlak wat er over een kind gedeeld wordt, en dat is precies wat grens 12
   verbiedt.

   ER GAAT HIER NIETS DE DEUR UIT. Deze routes LATEN ZIEN wat een pakket zou
   bevatten; versturen doet een mens langs de bestaande koppelingen. Zolang er
   geen echte verbinding met Edu-V of OSO staat, hoort er ook niet te worden
   gedaan alsof er een is. */
const { pakket, KAART } = require('../kern/overdracht');
const { naarBuiten, naarBinnen, STANDAARDEN } = require('../kern/koppelvlak');

module.exports = (sctx) => {
  const { router, nu, schoon, eigenVeld, poort, leerlingLijst, log } = sctx;

  /* ---------- de kaart zelf: waarom gaat iets wel of niet mee ---------- */
  router.post('/school/overdracht/kaart', (req, res) => {
    const g = poort(req, res, 'leerling'); if (!g) return;
    res.json({ ok: true,
      velden: Object.entries(KAART).map(([veld, r]) => ({ veld, klasse: r.klasse, waarom: r.waarom })),
      standaarden: Object.entries(STANDAARDEN).map(([id, s]) => ({ id, naam: s.naam, kanNiet: s.kanNiet })),
      uitleg: 'Bij een overstap gaat er geen dossier mee maar een pakket per doel. Wat op "nooit" staat, gaat ook met toestemming niet mee.' });
  });

  /* ---------- het pakket voor deze leerling ---------- */
  router.post('/school/overdracht/pakket', (req, res) => {
    const g = poort(req, res, 'leerling.schrijf'); if (!g) return;
    const l = leerlingLijst ? eigenVeld(leerlingLijst(g.sch), req.body.leerlingId) : null;
    if (!l) return res.status(404).json({ error: 'Deze leerling staat niet in de administratie.' });
    const doel = req.body.doel === 'continuiteit' ? 'continuiteit' : 'inschrijving';

    /* Toestemming is een HANDELING: wie, wanneer, en voor welke velden. Zonder
       naam is er geen toestemming, want dan is er niemand die het gaf. */
    const door = schoon(req.body.toestemmingDoor, 60);
    const velden = (Array.isArray(req.body.toestemmingVelden) ? req.body.toestemmingVelden : [])
      .map(v => String(v || '').trim()).filter(Boolean).slice(0, 20);
    const toestemming = door && velden.length ? { door, at: nu(), velden } : null;

    const p = pakket(l, doel, toestemming);
    const standaard = String(req.body.standaard || '').trim();
    const vorm = standaard ? naarBuiten(p.velden, standaard) : null;
    if (vorm && vorm.error) return res.status(vorm.status || 400).json({ error: vorm.error });

    /* Een pakket samenstellen is inzage in een leerlingdossier, dus het staat
       in het journaal -- met het doel erbij en niet met de inhoud. */
    if (log) log(g.sch, g.p, 'overdracht-pakket', l.id, 'doel ' + doel + (standaard ? ' via ' + standaard : ''));
    res.json(Object.assign({ ok: true, leerlingId: l.id }, p, vorm ? { vorm } : {},
      { uitleg: p.uitleg + ' Er is hier niets verstuurd: dit laat zien wat een pakket zou bevatten.' }));
  });

  /* ---------- van buiten naar binnen ---------- */
  router.post('/school/overdracht/inlezen', (req, res) => {
    const g = poort(req, res, 'leerling.schrijf'); if (!g) return;
    const uit = naarBinnen(req.body.velden || {}, req.body.standaard);
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    res.json(Object.assign({ ok: true }, uit,
      { uitleg: uit.uitleg + ' Dit is een voorstel: plaatsen doet de administratie, met een mens die kijkt.' }));
  });
};
