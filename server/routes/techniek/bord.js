/* Techniek (deelmodule): HET STATUSBORD.

   Een groot antwoord dat uit tien bronnen wordt samengesteld: de checks, de
   zekeringen, de functiecatalogus, het veiligheidsbord, de eigen
   fout-aggregatie, en voor de eigenaar bovendien de toegangslijst, de
   juridische grenzen, het eigenaarschap, de archiefkast, de moderniserings-
   verzoeken, het inzagejournaal en het bewaarbeleid.

   Dat leest beter als een geheel dan tussen de knoppen die het bord bedienen.
   Afgesplitst uit routes/techniek.js toen die de 10 KB passeerde.

   `bewaren` komt binnen als FUNCTIE en niet als waarde: de bewaar-deelmodule
   wordt in techniek.js pas na deze gemount, dus hier is hij bij het opstarten
   nog niet klaar. Een getter haalt hem op het moment dat hij nodig is. */
module.exports = (bctx) => {
  const { techniek, functies, eigenaar, inzagelog, log, accounts, archief, beveilig,
    db, app, ctx, staat, isEigenaar, techAuth, bewaren, foutmelder, spelTelemetrie, controle } = bctx;

  // Het statusbord: alle checks + zekeringen. Eigenaar ziet ook de toegangslijst.
  app.get('/api/techniek/status', techAuth, async (req, res) => {
    const checks = await techniek.draaiChecks(ctx());
    const t = staat();
    const zeker = Object.keys(t.zekeringen).map(id => ({ id, ...t.zekeringen[id] }));
    const cat = functies.catalogus(t.functies);
    const verzoeken = t.functieVerzoeken || [];
    const uit = {
      eigenaar: isEigenaar(req.techUser), naam: accounts.realNameOf(req.techUser),
      checks, zekeringen: zeker,
      functies: cat,
      doelgroepen: functies.DOELGROEPEN,
      functiesUit: cat.reduce((n, g) => n + g.functies.filter(f => !f.aan).length, 0),
      // extra beperkingen die alleen voor bepaalde doelgroepen gelden (functie
      // staat globaal aan, maar voor >=1 doelgroep uit)
      doelgroepUit: cat.reduce((n, g) => n + g.functies.reduce((m, f) => m + (f.aan ? f.doelgroepen.filter(d => !d.aan).length : 0), 0), 0),
      // open aanvragen bovenaan, daarna de laatst behandelde (audit-spoor)
      verzoeken: verzoeken.filter(v => v.status === 'wacht')
        .concat(verzoeken.filter(v => v.status !== 'wacht').slice(-8).reverse()),
      beveiliging: beveilig ? beveilig.samenvatting() : { open: 0, kritiek: 0, waarschuwing: 0, recent: [] },
      // eigen fout-aggregatie: totalen + de recentste storingsgroepen
      fouten: log.foutenSamenvatting(),
      /* DE ALARMWEG NAAR BUITEN. De aggregatie hierboven zie je alleen als je
         zelf kijkt; dit is het kanaal dat je bereikt als de doos plat ligt.
         Staat er `actief: false`, dan is er GEEN externe alarmering -- en dat
         hoort op het bord te staan in plaats van te ontbreken. Bezorgfouten
         worden geteld, want een webhook met een typefout deed tot nu toe
         precies hetzelfde als een werkende: niets zichtbaars. */
      alarm: foutmelder ? foutmelder.stand() : { actief: false, reden: 'niet bedraad' },
      samenvatting: {
        ok: checks.filter(c => c.status === 'ok').length,
        waarschuwing: checks.filter(c => c.status === 'waarschuwing').length,
        fout: checks.filter(c => c.status === 'fout').length
      }
    };
    if (isEigenaar(req.techUser)) {
      uit.toegang = t.toegang.map(id => { const u = accounts.getUserById(id); return { id, naam: u ? accounts.realNameOf(u) : '?', email: u ? accounts.emailOf(u) : null }; });
      // de juridische grenzen: waar zelfs de eigenaar bewust GEEN inzage heeft
      uit.grenzen = eigenaar.GRENZEN;
      /* Wie is op dit moment eigenaar, en waar komt dat vandaan? Dat laatste
         is de nuttige helft: een adres uit de code is iets anders dan een
         adres dat op de server is gezet of bewust is overgedragen. */
      uit.eigenaarschap = {
        email: eigenaar.eigenaarEmail(),
        herkomst: t.eigenaarEmail ? 'overgedragen in de boardroom'
          : (process.env.RTG_OWNER_EMAIL ? 'ingesteld op de server (RTG_OWNER_EMAIL)' : 'ingebouwde standaard'),
        overdrachten: (t.eigenaarLog || []).slice(0, 5)
      };
      // de archiefkast: instelbare live-vensterbreedte en de huidige verdeling
      uit.archief = archief ? { dagen: archief.dagen(), levend: (db.data.orders || []).length, gearchiveerd: archief.stat().aantal } : null;
      // de moderniseringsverzoeken die de eigenaar zelf via de AI heeft gevraagd
      uit.moderniseringen = (t.moderniseringen || []).slice(-8).reverse();
      // het inzagejournaal: hoe vaak is er in de identiteitskluis gekeken, en
      // hoe vaak zonder opgegeven reden (dat tweede getal is het interessantste)
      uit.inzage = inzagelog.samenvatting();
      const bw = bewaren && bewaren();
      uit.bewaren = bw ? bw.statusDeel() : null;  // zie ./bewaren.js
      // Eén centrale incident- en integriteitsstand; alleen de eigenaar ziet
      // codepaden, hashes en de noodbediening.
      uit.controle = controle ? controle.status() : null;
    }
    res.json(uit);
  });


  /* DE SPELCIJFERS. Hoeveel potjes er per dag per spel zijn gespeeld, en
     hoeveel stoelen daaraan zaten. Meer niet: er staat geen persoon in de bron
     (kern/spellen/telling.js), dus er valt hier ook niets uit te halen over wie
     wat speelt.

     Waarom op het techniekbord en niet op een productdashboard: dit is de enige
     plek in het huis waar systeembrede aantallen al thuishoren -- de
     fout-aggregatie staat er ook -- en hij is afgeschermd. Zodra er een echt
     productbord komt, hoort dit daarheen te VERHUIZEN en niet gekopieerd te
     worden.

     `techAuth` en niet `eigenaarAlleen`: dit zijn geen bedrijfsgeheimen en geen
     knop die iets doet -- het is een leesvraag over aantallen. */
  app.post('/api/techniek/spelcijfers', techAuth, (req, res) => {
    if (!spelTelemetrie) return res.status(503).json({ error: 'De spellenlaag draait hier niet.' });
    res.json(spelTelemetrie(req.body && req.body.dagen));
  });
};
