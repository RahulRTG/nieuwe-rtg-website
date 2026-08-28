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
   gedaan alsof er een is -- en dat geldt ook voor de veldnamen zelf: van drie
   van de vier standaarden hebben wij de specificatie niet kunnen lezen, dus
   die kaarten reizen met het etiket onbevestigd mee. Zie
   kern/koppelvlak-kaarten.js. */
/* De tijd komt uit de tijdmachine en niet van het besturingssysteem: anders
   is dit bestand niet te beproeven op schrikkeldag, zomertijd of een verlopen
   termijn. Zie server/lib/klok.js. */
const { nu: klokNu } = require('../lib/klok');
const { pakket, KAART } = require('../kern/overdracht');
const { naarBuiten, naarBinnen, STANDAARDEN } = require('../kern/koppelvlak');

/* Een klaargezet pakket verloopt. Een overdracht is een handeling van een paar
   dagen; blijft hij liggen, dan is het een tweede dossier op een plek waar
   niemand meer naar kijkt. */
const GELDIG_DAGEN = 14;

module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, S, eigenVeld, poort, leerlingLijst, log } = sctx;
  const kluis = (sch) => { if (!sch.overdrachten) sch.overdrachten = {}; return sch.overdrachten; };

  /* ---------- de kaart zelf: waarom gaat iets wel of niet mee ---------- */
  router.post('/school/overdracht/kaart', (req, res) => {
    const g = poort(req, res, 'leerling'); if (!g) return;
    res.json({ ok: true,
      velden: Object.entries(KAART).map(([veld, r]) => ({ veld, klasse: r.klasse, waarom: r.waarom })),
      /* De bron reist mee. Een lijst standaarden zonder herkomst laat een
         school denken dat er vier koppelingen klaarliggen; er ligt een
         vertaling klaar, en van drie ervan is de veldkaart nooit tegen een
         specificatie gehouden. */
      standaarden: Object.entries(STANDAARDEN).map(([id, s]) => ({ id, naam: s.naam, kanNiet: s.kanNiet,
        gelezen: !!s.gelezen, bron: s.bron })),
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

  /* ---------- klaarzetten: school A ----------

     DE WERKENDE OVERSTAP TUSSEN TWEE RTG-SCHOLEN. Hiermee gaat er echt iets
     over, en dat vraagt drie dingen die een losse code niet geeft:

     1. HET PAKKET IS GEADRESSEERD. School A noemt de ontvangende school; een
        code alleen is een sleutel die iedereen kan gebruiken die hem vindt.
     2. HET VERLOOPT. Veertien dagen. Een overdracht die blijft liggen wordt een
        tweede dossier op een plek waar niemand meer kijkt.
     3. HET IS WEG NA OPHALEN. Een overdracht is een overdracht en geen archief
        bij de verzender; wat hier stond, staat daarna daar.

     En het pakket dat over gaat is hetzelfde pakket als hierboven: dezelfde
     klassen, dezelfde restlijst, dezelfde grens dat zorg nooit meegaat. Er
     bestaat geen tweede route met soepeler regels. */
  router.post('/school/overdracht/klaarzetten', (req, res) => {
    const g = poort(req, res, 'leerling.schrijf'); if (!g) return;
    const l = leerlingLijst ? eigenVeld(leerlingLijst(g.sch), req.body.leerlingId) : null;
    if (!l) return res.status(404).json({ error: 'Deze leerling staat niet in de administratie.' });
    const naar = eigenVeld(S(), String(req.body.naarSchool || '').trim().toUpperCase());
    if (!naar) return res.status(404).json({ error: 'Die ontvangende school kennen we niet. Een pakket zonder geadresseerde is een sleutel die iedereen kan gebruiken.' });
    if (naar.code === g.sch.code) return res.status(400).json({ error: 'Dat is deze school zelf.' });
    const door = schoon(req.body.door, 60);
    if (!door) return res.status(400).json({ error: 'Zet uw naam erbij; een overdracht gaat op naam de deur uit.' });

    const velden = (Array.isArray(req.body.toestemmingVelden) ? req.body.toestemmingVelden : [])
      .map(v => String(v || '').trim()).filter(Boolean).slice(0, 20);
    const wie = schoon(req.body.toestemmingDoor, 60);
    const p = pakket(l, req.body.doel === 'continuiteit' ? 'continuiteit' : 'inschrijving',
      wie && velden.length ? { door: wie, at: nu(), velden } : null);

    const code = 'OD-' + rid(6).toUpperCase();
    kluis(g.sch)[code] = { code, naarSchool: naar.code, van: g.sch.naam, door, at: nu(),
      tot: new Date(klokNu() + GELDIG_DAGEN * 86400000).toISOString(),
      doel: p.doel, velden: p.velden, weggelaten: p.weggelaten, toestemmingDoor: p.toestemmingDoor };
    if (log) log(g.sch, g.p, 'overdracht-klaargezet', l.id, 'naar ' + naar.code + ' (' + p.doel + ')');
    save();
    res.json({ ok: true, code, naarSchool: naar.code, naarNaam: naar.naam, tot: kluis(g.sch)[code].tot,
      velden: Object.keys(p.velden), weggelaten: p.weggelaten,
      uitleg: 'Geef deze code aan ' + naar.naam + '. Alleen die school kan hem ophalen, hij verloopt na ' + GELDIG_DAGEN + ' dagen, en na het ophalen is hij hier weg.' });
  });

  /* ---------- ophalen: school B ---------- */
  router.post('/school/overdracht/ophalen', (req, res) => {
    const g = poort(req, res, 'leerling.schrijf'); if (!g) return;
    const code = String(req.body.code || '').trim().toUpperCase();
    const vanCode = String(req.body.vanSchool || '').trim().toUpperCase();
    const bron = eigenVeld(S(), vanCode);
    if (!bron) return res.status(404).json({ error: 'Die verzendende school kennen we niet.' });
    const pak = eigenVeld(kluis(bron), code);
    if (!pak) return res.status(404).json({ error: 'Deze code staat niet klaar. Is hij al opgehaald, of verlopen?' });
    if (pak.naarSchool !== g.sch.code) return res.status(403).json({ error: 'Dit pakket is aan een andere school geadresseerd.' });
    if (pak.tot <= nu()) { delete kluis(bron)[code]; save();
      return res.status(410).json({ error: 'Dit pakket is verlopen. Laat de verzendende school een nieuw pakket klaarzetten.' }); }

    /* Weg bij de verzender: een overdracht is een overdracht en geen archief.
       Wat hier binnenkomt is een VOORSTEL -- plaatsen doet een mens, met de
       bestaande aanmeldroute en zijn eigen journaalregel. */
    delete kluis(bron)[code];
    if (log) log(g.sch, g.p, 'overdracht-opgehaald', code, 'van ' + bron.code);
    save();
    res.json({ ok: true, van: pak.van, vanSchool: bron.code, door: pak.door, doel: pak.doel,
      velden: pak.velden, weggelaten: pak.weggelaten, toestemmingDoor: pak.toestemmingDoor || null,
      uitleg: 'Dit is wat er is meegestuurd, met daaronder wat er bewust NIET in zat. Plaatsen doet u zelf via de aanmelding; er wordt hier niemand automatisch ingeschreven.' });
  });

  /* ---------- wat staat er nog klaar (en verloopt) ---------- */
  router.post('/school/overdracht/klaarstaand', (req, res) => {
    const g = poort(req, res, 'leerling'); if (!g) return;
    const tijd = nu();
    const rijen = Object.values(kluis(g.sch)).filter(p => p.tot > tijd)
      .map(p => ({ code: p.code, naarSchool: p.naarSchool, doel: p.doel, door: p.door, at: p.at, tot: p.tot }));
    res.json({ ok: true, pakketten: rijen, geldigDagen: GELDIG_DAGEN,
      uitleg: 'Wat hier staat is geadresseerd aan een school en verloopt vanzelf. Verlopen pakketten verdwijnen bij de eerste poging ze op te halen.' });
  });
};
