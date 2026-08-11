/* RTG Werk OS (deellaag): het INDIENSTproces -- de spiegel van ./uitdienst.js.

   Er stond een uitstroomproces met zes stappen en geen instroomproces. Dat is
   de verkeerde helft om te hebben: bij vertrek is er een aanleiding (iemand
   zegt op) en bij aankomst is die er niet -- de nieuwe medewerker zit er
   gewoon, en wat er niet gebeurt merkt niemand tot het misgaat.

   WAT DEZE MODULE ANDERS DOET DAN ZIJN SPIEGEL, en het is de hele reden dat hij
   bestaat: EEN STAP DIE HET SYSTEEM ZELF KAN ZIEN, WORDT GEMETEN EN NIET
   AFGEVINKT. Bij het uitdienstproces weigert een vinkje zolang de meting hem
   tegenspreekt; hier bestaat het vinkje niet eens. Dat is een stap verder, en
   met opzet: een vinkje naast een meting is dezelfde waarheid op twee plekken
   (LAT-regel 4), en op de dag dat ze uiteenlopen gelooft niemand meer welke van
   de twee klopt. Een gemeten stap gaat vanzelf op groen zodra de handeling
   ergens anders in dit huis echt is gedaan -- de rollen die iemand toekent, de
   laptop die IT uitgeeft. Dat is wat "niemand hoeft dit te starten" hier
   betekent: niet dat een automaat het werk doet, maar dat het werk zichzelf
   meldt zodra het gebeurt.

   EN WAT HIER NIET GEBEURT. Er wordt geen laptop besteld, geen badge gemaakt,
   geen salaris aangemeld en geen training ingepland. Dit huis kan die dingen
   niet, en een stap die doet alsof is erger dan een stap die zegt dat hij
   mensenwerk is. De mensenstappen dragen daarom de naam van wie ze deed en het
   tijdstip, precies zoals bij de uitstroom.

   HET DOSSIER ONTSTAAT VANZELF, bij het lezen: elk toegelaten lid heeft er een,
   ook als niemand eraan dacht. Eraan denken is precies wat er misgaat in de
   week dat iemand begint. */
'use strict';

/* De zes stappen, en per stap of hij MEETBAAR is of MENSENWERK. Wie hier een
   stap bijzet, beantwoordt die vraag dus expliciet -- en een meetbare stap
   levert zijn meting mee, zodat "nog niet" altijd een reden heeft. */
const STAPPEN = [
  { stap: 'functie en afdeling ingevuld', meet: (ctx) => !!(ctx.lid.functie && ctx.lid.afdeling),
    waarom: (ctx) => ctx.lid.functie
      ? (ctx.lid.afdeling ? 'staat ingevuld' : 'er staat een functie maar geen afdeling')
      : 'er staat nog geen functie' },
  { stap: 'rollen toegekend', meet: (ctx) => (ctx.lid.rollen || []).length > 0,
    waarom: (ctx) => (ctx.lid.rollen || []).length
      ? (ctx.lid.rollen || []).length + ' rol(len)'
      : 'zonder rol mag dit lid niets; dat is geen half account maar een lege sleutel' },
  { stap: 'werkplek uitgegeven', meet: (ctx) => ctx.apparaten.length > 0,
    waarom: (ctx) => ctx.apparaten.length
      ? ctx.apparaten.map(a => a.soort + ' ' + a.nummer).join(', ')
      : 'er staat nog geen apparaat op naam' },
  { stap: 'welkomstgesprek gevoerd', mens: true },
  { stap: 'veiligheids- en privacy-instructie', mens: true },
  { stap: 'eerste weken ingepland', mens: true }
];

module.exports = (sctx) => {
  const { app, save, schoon, nu, werkPoort, log, eigenVeld, APPARATEN: A } = sctx;

  const D = (w) => { if (!w.indienst) w.indienst = {}; return w.indienst; };

  function dossier(w, lidId) {
    const d = eigenVeld(D(w), lidId);
    if (d) return d;
    const nieuw = { lidId, stappen: {}, at: nu() };
    D(w)[lidId] = nieuw;
    return nieuw;
  }

  /* De stand van één mens. `gemeten` en `mensenwerk` staan apart in de uitslag,
     want ze zijn niet even hard: het eerste is een feit uit de administratie,
     het tweede is de verklaring van een mens. Door elkaar getoond krijgt het
     geheel de betrouwbaarheid van het zwakste deel, en kan niemand zien welk
     deel dat is -- dezelfde regel die kern/command/herkomst.js hanteert. */
  function stand(w, lid) {
    const d = dossier(w, lid.id);
    const ctx = { lid, apparaten: Object.values(A(w)).filter(a => a.bijLid === lid.id) };
    const stappen = STAPPEN.map(s => {
      if (s.mens) {
        const g = d.stappen[s.stap];
        return { stap: s.stap, aard: 'mensenwerk', gedaan: !!g,
          door: g ? g.door : null, at: g ? g.at : null, notitie: g ? g.notitie : null };
      }
      const ok = s.meet(ctx);
      return { stap: s.stap, aard: 'gemeten', gedaan: ok, waarom: s.waarom(ctx) };
    });
    return { lidId: lid.id, naam: lid.naam, sinds: lid.toegelatenAt || lid.at, stappen,
      open: stappen.filter(s => !s.gedaan).map(s => s.stap),
      klaar: stappen.every(s => s.gedaan) };
  }

  app.post('/api/bedrijf/indienst', (req, res) => {
    const g = werkPoort(req, res, 'mens'); if (!g) return;
    const alleen = String(req.body.lidId || '');
    const leden = Object.values(g.w.leden)
      .filter(l => l.status === 'actief' && (!alleen || l.id === alleen));
    const rijen = leden.map(l => stand(g.w, l));
    save();
    res.json({ ok: true, aantal: rijen.length, indienst: rijen,
      stappen: STAPPEN.map(s => ({ stap: s.stap, aard: s.mens ? 'mensenwerk' : 'gemeten' })),
      nietKlaar: rijen.filter(r => !r.klaar).length,
      let: 'Een GEMETEN stap heeft geen vinkje: hij gaat vanzelf op groen zodra de handeling ergens anders in dit huis echt is gedaan. Een vinkje naast een meting is dezelfde waarheid op twee plekken, en dan gelooft niemand er meer een van zodra ze uiteenlopen.' });
  });

  app.post('/api/bedrijf/indienst/stap', (req, res) => {
    const g = werkPoort(req, res, 'mens'); if (!g) return;
    const l = eigenVeld(g.w.leden, String(req.body.lidId || ''));
    if (!l) return res.status(404).json({ error: 'Dat lid kennen we niet.' });
    if (l.status !== 'actief') return res.status(409).json({
      error: 'Dit lidmaatschap staat op ' + l.status + '; een instroomproces hoort bij iemand die begint.' });
    const naam = schoon(req.body.stap, 60);
    const s = STAPPEN.find(x => x.stap === naam);
    if (!s) return res.status(400).json({ error: 'Onbekende stap. Kies: ' + STAPPEN.map(x => x.stap).join(', ') + '.' });

    /* De grendel die deze module draagt. Een gemeten stap valt niet af te
       vinken -- ook niet "even, want het is toch al gebeurd". Wie hem groen
       wil, doet de handeling; dat is precies waar de meting naar kijkt. */
    if (!s.mens) {
      const nu2 = stand(g.w, l).stappen.find(x => x.stap === naam);
      return res.status(409).json({
        error: 'Deze stap wordt gemeten en niet afgevinkt.',
        stap: naam, gedaan: nu2.gedaan, waarom: nu2.waarom,
        let: 'Zet de handeling waar hij hoort (rollen bij het lid, een apparaat bij IT); deze stap volgt vanzelf. Een vinkje ernaast zou een tweede waarheid zijn.' });
    }

    const d = dossier(g.w, l.id);
    if (d.stappen[naam]) return res.status(409).json({
      error: 'Die stap staat al op naam van ' + d.stappen[naam].door + '.' });
    d.stappen[naam] = { door: g.l.naam, at: nu(), notitie: schoon(req.body.notitie, 200) || null };
    log(g.w, g.l, 'indienst-stap', l.id, naam);
    save();
    const na = stand(g.w, l);
    res.json({ ok: true, lid: l.naam, stap: naam, klaar: na.klaar, open: na.open });
  });

  sctx.startBron('mensen', 'mens', (g) => {
    const actief = Object.values(g.w.leden).filter(l => l.status === 'actief');
    const lopend = actief.map(l => stand(g.w, l)).filter(r => !r.klaar);
    return { inDienstNietAf: lopend.length,
      wachtOpRollen: actief.filter(l => !(l.rollen || []).length).length,
      aanmeldingenOpen: Object.values(g.w.leden).filter(l => l.status === 'wacht').length };
  });

  return { INDIENSTSTAPPEN: STAPPEN };
};
