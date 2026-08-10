/* RTG Werk OS (deellaag): zoeken, het objectdossier en de samenhang.

   HIER WORDT NIETS NIEUWS BEREKEND. Dit bestand is bedrading: het bouwt per
   verzoek het werkregister (kern/werkcommand/register.js) uit de rechten van
   het lid dat aanklopt, en geeft dat aan de motoren die er al stonden --
   kern/command/zoek.js, object.js, kwaliteit.js en graaf.js. Dezelfde vier die
   RTG Command en de zaak-kant gebruiken; één implementatie, per eigenaar een
   eigen register.

   PER VERZOEK OPGEBOUWD EN NIET BEWAARD. De objecten van een werkruimte
   veranderen onder je handen, en de rechten van een lid ook. Een gecachet
   register zou een oud antwoord geven op een nieuwe vraag -- en bij de tweede
   as (het recht) is dat geen vertraging maar een lek. De kosten zijn een
   handvol closures.

   DRIE DINGEN DIE DEZE ROUTES OVER ZICHZELF ZEGGEN, want geen ervan is uit het
   antwoord af te leiden en alle drie zouden ze anders als feit gelezen worden:

   1. WAT U NIET MAG ZIEN, STAAT ER NIET ALS LEGE DOOS. Een soort waarvoor u
      het recht mist, zit niet in uw register. `bereik` toont dus waar er ECHT
      is gezocht, en "niets gevonden" betekent "niet gevonden waar ik keek".
   2. DE RANDEN WORDEN GEMETEN, DUS EEN JONGE WERKRUIMTE HEEFT ER NOG GEEN.
      kwaliteit.js noemt een veld pas een verwijzing als het over genoeg rijen
      vrijwel altijd raak is. Onder die grens is de samenhang NIET GEMETEN, en
      dat is iets anders dan "geen samenhang".
   3. HET WERKJOURNAAL IS NIET COMPLEET. Niet elke module noteert, en een regel
      draagt wel het object-id maar niet de soort. Stilte in een tijdlijn is
      hier dus geen bewijs dat er niets gebeurde. */
'use strict';

const { maakWerkRegister } = require('../kern/werkcommand/register');
const zoeklaag = require('../kern/command/zoek');
const objectlaag = require('../kern/command/object');
const { maakKwaliteit } = require('../kern/command/kwaliteit');
const { maakGraaf } = require('../kern/command/graaf');

/* De ondergrens waaronder kwaliteit.js geen verwijzing durft te noemen. Hij
   staat daar als REF_MIN en wordt niet geexporteerd; hier staat hij alleen om
   de LEZER uit te leggen waarom zijn samenhang leeg is. Loopt hij daar uiteen,
   dan klopt deze zin niet meer -- daarom noemt de tekst hem als "ongeveer" en
   rekent er niets mee. */
const MEETGRENS = 5;

module.exports = (sctx) => {
  const { app, db, schoon, werkPoort } = sctx;

  /* Het werkjournaal in de vorm die object.js van een journaal verwacht. Geen
     tweede journaal: dit leest w.journaal, dat de modules zelf al vullen.

     De regel wordt op `waarover` gevonden en dus op ID en niet op soort -- het
     journaal legt de soort niet vast. Ids zijn per werkruimte willekeurig, dus
     in de praktijk wijst dat goed; het staat hier omdat de aanroeper het hoort
     te weten en niet omdat het onschuldig is. */
  function journaalVan(w) {
    return {
      overObject(type, id) {
        const sleutel = String(id);
        return (w.journaal || [])
          .filter(j => j && String(j.waarover || '') === sleutel)
          .map(j => ({ at: j.at, actie: j.wat, actor: j.wie, reden: j.reden || null,
            niveau: null, uitslag: null, id: j.id }));
      }
    };
  }

  /* De hele laag van één verzoek. `g` komt uit werkPoort, dus de werkruimte en
     de rechten zijn al bewezen voordat hier iets wordt gebouwd. */
  function laagVoor(g) {
    const register = maakWerkRegister(g.w.code, g.rechten);
    const kwaliteit = maakKwaliteit({ db, register });
    const graaf = maakGraaf({ db, register, kwaliteit });
    return { register, kwaliteit, graaf };
  }

  /* ---------- zoeken over alle modules tegelijk ---------- */
  app.post('/api/bedrijf/zoek', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    const { register } = laagVoor(g);
    if (!register.SOORTEN.length) {
      return res.json({ ok: true, term: '', groepen: [], totaal: 0, bereik: [],
        let: 'U heeft geen enkel recht dat een module opent, dus er is hier niets om in te zoeken. Dat is geen storing: uw rollen bepalen wat er in uw register staat.' });
    }
    const term = schoon(req.body.q, 80);
    const type = schoon(req.body.type, 30) || '';
    const uit = zoeklaag.zoek(register, db, term, type ? { type } : null);
    res.json(Object.assign({ ok: true }, uit, {
      bereik: zoeklaag.bereik(register),
      let: uit.kort
        ? 'Typ minstens twee tekens. Een lege balk hoort niets te vinden en niet alles te tonen.'
        : 'Er is gezocht in de soorten waar u recht op heeft; wat daarbuiten valt staat niet in uw register en is dus ook niet als leeg vakje geteld.'
    }));
  });

  /* ---------- het dossier van een object ---------- */
  app.post('/api/bedrijf/dossier', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    const { register } = laagVoor(g);
    const type = schoon(req.body.type, 30);
    const id = schoon(req.body.id, 64);
    if (!type || !id) return res.status(400).json({ error: 'Welk object: geef een soort en een id.' });
    if (!register.OP_TYPE.get(type)) {
      return res.status(404).json({ error: 'Die soort staat niet in uw register.',
        let: 'Dat betekent of dat de soort niet bestaat, of dat u het recht ervoor niet heeft. Welke van de twee zegt dit antwoord bewust niet: het verschil zou verraden wat er achter een deur staat.',
        bereik: zoeklaag.bereik(register) });
    }
    const d = objectlaag.dossier(register, db, type, id,
      { journaal: journaalVan(g.w), actiesVoor: null, bron: 'werkruimte' });
    if (d.error) return res.status(d.status || 404).json({ error: d.error });
    res.json(Object.assign({ ok: true }, d, {
      let: 'De samenhang hieronder is gemeten uit de gegevens zelf en niet uit een schema. De tijdlijn komt uit het werkjournaal, en dat legt niet elke handeling vast; leeg is hier dus niet hetzelfde als "er gebeurde niets".'
    }));
  });

  /* ---------- de samenhang: de vorm van het geheel ---------- */
  app.post('/api/bedrijf/samenhang', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    const { register, graaf, kwaliteit } = laagVoor(g);
    const vorm = graaf.vorm();
    const klein = vorm.knopen.filter(k => k.aantal > 0 && k.aantal < MEETGRENS).map(k => k.type);
    res.json({ ok: true, vorm,
      kwaliteit: kwaliteit.meet(),
      nietGemeten: klein,
      let: klein.length
        ? 'Van ' + klein.join(', ') + ' zijn er te weinig rijen om een verwijzing te MOGEN meten. Die soorten staan daarom zonder randen in de kaart: niet gemeten, en dat is iets anders dan geen samenhang.'
        : 'De randen zijn gemeten uit de gegevens. Een soort zonder randen staat in "losse" en dat is een uitslag, geen fout.',
      soorten: zoeklaag.bereik(register) });
  });

  /* ---------- wandelen: wat ligt er twee stappen verderop ---------- */
  app.post('/api/bedrijf/wandel', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    const { graaf } = laagVoor(g);
    const type = schoon(req.body.type, 30);
    const id = schoon(req.body.id, 64);
    if (!type || !id) return res.status(400).json({ error: 'Waarvandaan: geef een soort en een id.' });
    const uit = graaf.wandel(type, id, req.body.diepte);
    if (uit.error) return res.status(uit.status || 404).json({ error: uit.error });
    res.json(Object.assign({ ok: true }, uit, {
      let: 'De wandeling loopt alleen door soorten waar u recht op heeft. Een pad dat via een gesloten module loopt, is hier niet onzichtbaar afgesneden -- het bestaat in dit register niet.'
    }));
  });

  /* Deze laag geeft niets terug aan de gedeelde context. Dat is bewust: hij
     LEEST de soorten van de modules boven hem en heeft niets wat een andere
     deellaag nodig heeft. Namen in sctx zetten die niemand ophaalt, maakt de
     kern breder zonder dat er iets mee gebeurt. */
};
