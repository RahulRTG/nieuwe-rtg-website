/* RTG Werk OS (deellaag): bedrijfsregels -- het REGISTER.

   "Contract boven 50.000 euro? Dan moet juridisch er altijd naar kijken en de
   CFO tekenen." Dat soort afspraken stond in dit huis nergens: het waren
   gewoontes, en een gewoonte is precies zo sterk als de drukste dag.

   DE HELE ONTWERPREGEL: EEN REGEL DIE NIETS TEGENHOUDT IS THEATER. Je kunt hier
   alleen een regel maken voor een soort waar in de code ook echt een plek is die
   hem afdwingt. Een regel voor "project" wordt GEWEIGERD zolang er geen moment
   is waarop hij iets kan blokkeren -- met de reden erbij. Een beleidsscherm vol
   regels die nergens langskomen is erger dan geen beleidsscherm: het leest als
   bewaking die er niet is.

   TWEE PLEKKEN, EN ZE HOUDEN VERSCHILLEND TEGEN. Dat verschil staat in de tabel
   hieronder en niet in een handleiding, want het is het enige wat een lezer moet
   weten om te snappen wat zijn regel doet:

     contract -> HOUDT VAST. Zolang een goedkeuring ontbreekt, staat een getekend
                 contract op "wacht op goedkeuring" in plaats van actief.
     besluit  -> WEIGERT. De stemronde sluiten lukt niet zolang een vereiste
                 goedkeuring ontbreekt; het besluit blijft in stemming staan.

   ELKE SOORT DRAAGT ZIJN EIGEN VOORWAARDE. Een contract drempelt op een BEDRAG
   en mag daarnaast op LAND en AFDELING worden ingeperkt; een besluit op zijn
   SOORT. Die extra twee lezen een veld van het contract ZELF en worden nergens
   afgeleid -- uit de klant halen zou betekenen dat een contract zonder klant
   stilzwijgend buiten elke landregel valt. En een leeg veld betekent NIET "past
   overal op": dan geldt de regel gewoon niet, want de andere kant op zou een
   landregel stil over alles heen leggen.

   HET BLIJFT EEN VASTE LIJST VOORWAARDEN EN GEEN REGELTAAL. Elke voorwaarde die
   erbij komt, staat in de code die hem LEEST -- een taal in een
   configuratiebestand is een tweede implementatie die je niet kunt toetsen,
   dezelfde afweging die kern/command/beleid.js maakt als hij getallen wel en
   regels niet in gegevens zet. Komt er een derde plek of een vierde voorwaarde
   bij, dan komt die hier te staan EN in de code die hem aanroept; die twee horen
   samen te bewegen. */
'use strict';

const AFGEDWONGEN = {
  contract: { voorwaarde: 'boven', extra: ['land', 'afdeling'],
    waar: 'bij het activeren van een contract: zolang een vereiste goedkeuring ontbreekt, staat het op "wacht op goedkeuring" in plaats van actief' },
  besluit: { voorwaarde: 'besluitSoort',
    waar: 'bij het sluiten van de stemronde: zolang een vereiste goedkeuring ontbreekt, kan het besluit niet worden gesloten' }
};

module.exports = (sctx) => {
  const { app, save, schoon, nu, rid, werkPoort, log, eigenVeld } = sctx;
  const R = (w) => { if (!w.regels) w.regels = {}; return w.regels; };
  const centenVan = (v) => Math.round(Math.max(0, Number(v) || 0) * 100);

  /* Welke regels raken DIT object? Per soort één voorwaarde, en de vraag wordt
     hier één keer beantwoord -- de handhaving (./regelpoort.js) stelt hem, maar
     verzint hem niet (LAT-regel 4). */
  function regelsVoor(w, soort, obj) {
    return Object.values(R(w)).filter(r => {
      if (r.soort !== soort) return false;
      if (soort === 'contract') {
        if (Number(obj.waardeCenten || 0) <= Number(r.bovenCenten || 0)) return false;
        /* De extra voorwaarden zijn EN en ze lezen een veld van het contract
           zelf. Een regel die een land of afdeling noemt terwijl het contract
           dat veld leeg heeft, geldt NIET -- en dat is de veilige kant op: een
           lege waarde als "past overal op" lezen, zou elke landregel stil over
           alles heen leggen. /keuring zegt het met zoveel woorden. */
        if (r.land && String(obj.land || '').toUpperCase() !== r.land) return false;
        if (r.afdeling && String(obj.afdeling || '').toLowerCase() !== r.afdeling.toLowerCase()) return false;
        return true;
      }
      if (soort === 'besluit') return !r.besluitSoort || r.besluitSoort === obj.soort;
      return false;
    }).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  app.post('/api/bedrijf/regel/zet', (req, res) => {
    const g = werkPoort(req, res, 'werkruimte'); if (!g) return;
    const soort = String(req.body.soort || '');
    const plek = AFGEDWONGEN[soort];
    if (!plek) return res.status(400).json({
      error: 'Voor "' + soort + '" is er geen plek in de code waar zo\'n regel iets kan tegenhouden.',
      let: 'Een regel die niets tegenhoudt is theater, en een beleidsscherm vol zulke regels leest als bewaking die er niet is. Wat wel kan: ' + Object.keys(AFGEDWONGEN).join(', ') + '.' });

    const eist = Array.isArray(req.body.eist) ? [...new Set(req.body.eist.map(String))] : [];
    if (!eist.length) return res.status(400).json({ error: 'Welke goedkeuring eist deze regel? Zonder eis verandert hij niets.' });
    const onbekend = eist.filter(x => !sctx.RECHTEN.includes(x));
    if (onbekend.length) return res.status(400).json({ error: 'Onbekend recht: ' + onbekend.join(', ') + '.' });

    /* De voorwaarde hoort bij de soort. Een besluitregel met een bedrag erin zou
       een getal dragen dat nergens wordt gelezen -- en een instelling die niets
       doet is dezelfde leugen als een regel die niets tegenhoudt. */
    const land = (schoon(req.body.land, 2) || '').toUpperCase() || null;
    const afdeling = schoon(req.body.afdeling, 40) || null;
    if ((land || afdeling) && plek.voorwaarde !== 'boven')
      return res.status(400).json({ error: 'Land en afdeling zijn voorwaarden op een contract; een ' + soort + '-regel leest ze nergens.' });
    const besluitSoort = schoon(req.body.besluitSoort, 30) || null;
    if (besluitSoort && !sctx.BESLUITSOORTEN.includes(besluitSoort))
      return res.status(400).json({ error: 'Onbekende besluitsoort: ' + besluitSoort + '.' });
    if (plek.voorwaarde === 'boven' && besluitSoort)
      return res.status(400).json({ error: 'Een contractregel drempelt op een bedrag, niet op een besluitsoort.' });
    if (plek.voorwaarde === 'besluitSoort' && req.body.boven != null)
      return res.status(400).json({ error: 'Een besluitregel geldt voor een SOORT besluit; een bedrag wordt daar nergens gelezen.' });

    const id = schoon(req.body.regelId, 20) || rid(4);
    const bestaand = eigenVeld(R(g.w), id);
    if (bestaand && bestaand.soort !== soort)
      return res.status(409).json({ error: 'Die regel gaat over ' + bestaand.soort + '; maak er een nieuwe voor ' + soort + '.' });
    const r = bestaand || { id, soort, historie: [], at: nu(), door: g.l.naam };
    if (bestaand) r.historie.push({ was: { bovenCenten: r.bovenCenten, besluitSoort: r.besluitSoort, eist: r.eist }, door: g.l.naam, at: nu() });
    r.bovenCenten = plek.voorwaarde === 'boven' ? centenVan(req.body.boven) : null;
    r.besluitSoort = plek.voorwaarde === 'besluitSoort' ? besluitSoort : null;
    r.land = plek.voorwaarde === 'boven' ? land : null;
    r.afdeling = plek.voorwaarde === 'boven' ? afdeling : null;
    r.eist = eist;
    R(g.w)[id] = r;
    log(g.w, g.l, 'regel-gezet', id, soort + ': ' + eist.join(' + '));
    save();
    res.json({ ok: true, regel: r, afgedwongen: plek.waar,
      let: 'Deze regel geldt vanaf nu. Wat al actief of gesloten is, wordt er NIET met terugwerkende kracht door teruggezet -- dat zou een lopende afspraak stilzwijgend openbreken. Hij bijt bij de eerstvolgende handeling.'
        + ((land || afdeling) ? ' LET OP: deze regel noemt ' + [land ? 'land ' + land : null, afdeling ? 'afdeling ' + afdeling : null].filter(Boolean).join(' en ') + '. Een contract waarvan dat veld LEEG is, valt er niet onder -- een lege waarde wordt niet als "past overal op" gelezen.' : '') });
  });

  app.post('/api/bedrijf/regels', (req, res) => {
    const g = werkPoort(req, res, 'werkruimte'); if (!g) return;
    res.json({ ok: true,
      regels: Object.values(R(g.w)).map(r => Object.assign({}, r, {
        bovenEuro: r.bovenCenten == null ? null : r.bovenCenten / 100,
        afgedwongen: (AFGEDWONGEN[r.soort] || {}).waar || null })),
      soorten: Object.entries(AFGEDWONGEN).map(([k, v]) => ({ soort: k, voorwaarde: v.voorwaarde, waar: v.waar })),
      rechten: sctx.RECHTEN,
      let: 'Elke regel noemt WAAR hij wordt afgedwongen, en hoe: een contract wordt vastgehouden, een besluit wordt geweigerd. Staat daar niets, dan doet hij niets -- en zo\'n regel kan hier niet ontstaan.' });
  });

  app.post('/api/bedrijf/regel/weg', (req, res) => {
    const g = werkPoort(req, res, 'werkruimte'); if (!g) return;
    const r = eigenVeld(R(g.w), String(req.body.regelId || ''));
    if (!r) return res.status(404).json({ error: 'Die regel kennen we niet.' });
    const reden = schoon(req.body.reden, 300);
    if (!reden) return res.status(400).json({ error: 'Waarom vervalt deze regel? Een controle die zonder reden verdwijnt, verdwijnt op de drukste dag.' });
    delete R(g.w)[r.id];
    log(g.w, g.l, 'regel-weg', r.id, reden);
    save();
    res.json({ ok: true, weg: r.id,
      let: 'Wat op deze regel stond te wachten, gaat pas mee bij de eerstvolgende handeling; er wordt hier niets stil geactiveerd of gesloten.' });
  });

  /* De handhaving staat in ./regelpoort.js -- samen gingen ze over de 10 kB van
     keuringsregel 13, en de naad is echt: hier staat WAT er is afgesproken,
     daar staat waar het wordt tegengehouden. `regelsVoor` reist mee zodat de
     voorwaardevraag op EEN plek wordt beantwoord (LAT-regel 4). */
  return { REGELS: R, regelsVoor, REGELSOORTEN: AFGEDWONGEN };
};
