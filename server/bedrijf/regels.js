/* RTG Werk OS (deellaag): bedrijfsregels -- beleid dat iets tegenhoudt.

   "Contract boven 50.000 euro? Dan moet juridisch er altijd naar kijken en de
   CFO tekenen." Dat soort afspraken stond in dit huis nergens: het waren
   gewoontes, en een gewoonte is precies zo sterk als de drukste dag.

   DE HELE ONTWERPREGEL: EEN REGEL DIE NIETS TEGENHOUDT IS THEATER. Daarom kun
   je hier alleen een regel maken voor een soort waar in de code ook echt een
   plek is die hem afdwingt. Een regel voor "project" wordt GEWEIGERD zolang er
   geen moment is waarop hij iets kan blokkeren -- met de reden erbij. Een
   beleidsscherm vol regels die nergens langskomen, is erger dan geen
   beleidsscherm: het leest als bewaking.

   VANDAAG IS DAT EEN PLEK: het activeren van een contract. Dat staat hieronder
   als AFGEDWONGEN en niet als proza, en het antwoord van /regels noemt hem.

   WAT EEN REGEL WEL EN NIET TOEVOEGT. Twee handtekeningen (wij en wederpartij)
   waren er al en zijn structureel; daar gaat een regel niet over. Wat een regel
   toevoegt is WIE ER VAN BINNEN MOET GOEDKEUREN, uitgedrukt in rechten en niet
   in namen: 'recht' is juridisch, 'geld.goedkeuren' is wie over geld gaat. Zo
   blijft de regel staan als er iemand anders die rol krijgt.

   DRIE DINGEN DIE DEZE LAAG NIET LAAT GEBEUREN, en ze komen alle drie uit de
   vraag "hoe zou ik hier onderuit komen?":

   1. EEN MENS KEURT EEN KEER GOED. Wie 'recht' en 'geld.goedkeuren' allebei
      draagt, kan niet in zijn eentje een vier-ogen-regel afvinken. Daarmee is
      "twee rechten" ook echt twee mensen.
   2. HET BEHEER-TOKEN KEURT NIET. Dezelfde regel als bij stemmen over een
      besluit: goedkeuren doet een lid met een eigen sleutel, anders staat er
      een handtekening zonder gezicht.
   3. EEN GOEDKEURING GELDT VOOR HET BEDRAG WAAROP HIJ IS GEGEVEN. Gaat de
      waarde daarna OMHOOG, dan vervalt hij en gaat het contract terug naar
      "wacht op goedkeuring". Zonder die regel is de hele laag te omzeilen met
      een contract van een euro dat je achteraf ophoogt -- en dat is geen
      theoretisch gat maar de makkelijkste weg eromheen. */
'use strict';

/* Waar een regel echt iets tegenhoudt. Een soort die hier niet staat, kan geen
   regel krijgen. Komt er een tweede plek bij, dan komt hij hier te staan EN in
   de code die hem aanroept -- die twee horen samen te bewegen. */
const AFGEDWONGEN = {
  contract: 'bij het activeren van een contract: zolang een vereiste goedkeuring ontbreekt, staat het op "wacht op goedkeuring" in plaats van actief'
};

const WACHT = 'wacht op goedkeuring';

module.exports = (sctx) => {
  const { app, save, schoon, nu, rid, werkPoort, log, eigenVeld } = sctx;
  const R = (w) => { if (!w.regels) w.regels = {}; return w.regels; };
  const centenVan = (v) => Math.round(Math.max(0, Number(v) || 0) * 100);

  /* Welke regels raken DIT contract? Alleen de drempel telt mee; een regel
     zonder drempel geldt altijd voor die soort. */
  const regelsVoor = (w, c) => Object.values(R(w))
    .filter(r => r.soort === 'contract' && Number(c.waardeCenten || 0) > Number(r.bovenCenten || 0))
    .sort((a, b) => a.bovenCenten - b.bovenCenten);

  /* ---------- de regels zelf ---------- */
  app.post('/api/bedrijf/regel/zet', (req, res) => {
    const g = werkPoort(req, res, 'werkruimte'); if (!g) return;
    const soort = String(req.body.soort || '');
    if (!AFGEDWONGEN[soort]) return res.status(400).json({
      error: 'Voor "' + soort + '" is er geen plek in de code waar zo\'n regel iets kan tegenhouden.',
      let: 'Een regel die niets tegenhoudt is theater, en een beleidsscherm vol zulke regels leest als bewaking die er niet is. Wat wel kan: ' + Object.keys(AFGEDWONGEN).join(', ') + '.' });
    const eist = Array.isArray(req.body.eist) ? [...new Set(req.body.eist.map(String))] : [];
    if (!eist.length) return res.status(400).json({ error: 'Welke goedkeuring eist deze regel? Zonder eis verandert hij niets.' });
    const onbekend = eist.filter(x => !sctx.RECHTEN.includes(x));
    if (onbekend.length) return res.status(400).json({ error: 'Onbekend recht: ' + onbekend.join(', ') + '.' });
    const bovenCenten = centenVan(req.body.boven);

    const id = schoon(req.body.regelId, 20) || rid(4);
    const bestaand = eigenVeld(R(g.w), id);
    const r = bestaand || { id, soort, historie: [], at: nu(), door: g.l.naam };
    if (bestaand) {
      r.historie.push({ was: { bovenCenten: r.bovenCenten, eist: r.eist }, door: g.l.naam, at: nu() });
    }
    r.bovenCenten = bovenCenten; r.eist = eist;
    R(g.w)[id] = r;
    log(g.w, g.l, 'regel-gezet', id, soort + ' boven ' + (bovenCenten / 100) + ': ' + eist.join(' + '));
    save();
    res.json({ ok: true, regel: r, afgedwongen: AFGEDWONGEN[soort],
      let: 'Deze regel geldt vanaf nu. Contracten die al actief zijn, worden er NIET met terugwerkende kracht door teruggezet -- dat zou een lopende afspraak stilzwijgend openbreken. Hij bijt zodra er aan zo\'n contract iets verandert.' });
  });

  app.post('/api/bedrijf/regels', (req, res) => {
    const g = werkPoort(req, res, 'werkruimte'); if (!g) return;
    res.json({ ok: true,
      regels: Object.values(R(g.w)).map(r => Object.assign({}, r,
        { bovenEuro: r.bovenCenten / 100, afgedwongen: AFGEDWONGEN[r.soort] || null })),
      soorten: Object.keys(AFGEDWONGEN), rechten: sctx.RECHTEN,
      let: 'Elke regel noemt WAAR hij wordt afgedwongen. Staat daar niets, dan doet hij niets -- en zo\'n regel kan hier niet ontstaan.' });
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
      let: 'Contracten die op deze regel stonden te wachten, gaan pas mee bij hun eerstvolgende wijziging; er wordt hier niets stil geactiveerd.' });
  });

  /* De handhaving staat in ./regelpoort.js -- samen gingen ze over de 10 kB van
     keuringsregel 13, en de naad is echt: hier staat WAT er is afgesproken,
     daar staat waar het wordt tegengehouden. `regelsVoor` reist mee zodat de
     drempelvraag op EEN plek wordt beantwoord (LAT-regel 4). */
  return { REGELS: R, regelsVoor, REGELSOORTEN: AFGEDWONGEN };
};
