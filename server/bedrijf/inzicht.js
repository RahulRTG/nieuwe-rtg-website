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
const { naamgrens } = require('../kern/werkcommand/naamgrens');
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

  /* HOE HARD IS DE SAMENHANG VAN EEN MENS? De afhankelijkhedenscan meldt per rij
     het VELD waarop hij matchte, en dat veld verklapt precies wat we willen
     weten: `wieId` en `eigenaarId` zijn sleutels (exact), `wie` en `eigenaar`
     zijn namen (kan een naamgenoot zijn). Sinds bedrijf/wieis.js dragen nieuwe
     rijen dat id, dus dit getal hoort te krimpen -- en zolang het niet nul is,
     staat er hoeveel van dit dossier nog op een gok rust. */
  function hardheid(d) {
    const rijen = (d.afhankelijkheden || []).flatMap(gr => gr.rijen || []);
    const opId = rijen.filter(r => /Id$/.test(String(r.via || ''))).length;
    const opNaam = rijen.length - opId;
    return { gevonden: { opId, opNaam,
      let: opNaam
        ? opNaam + ' van de ' + rijen.length + ' getoonde rijen zijn op NAAM gevonden en kunnen van een naamgenoot zijn; ' + opId + ' via een lid-id, en die zijn exact. Kijk per rij naar "via".'
        : 'Alle getoonde rijen zijn via een lid-id gevonden; er zit geen naamgok in.' } };
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

    /* De besluiten die dit object raken. Die komen NIET uit de gemeten
       samenhang hierboven: een besluit draagt zijn objecten als lijst, en de
       scan van object.js slaat lijsten over. Vandaar een eigen vraag aan
       geheugen.js -- en `null` (geen recht) is bewust iets anders dan `[]`
       (wel gekeken, niets gevonden). */
    const magBesluit = g.rechten.includes('besluit');
    res.json(Object.assign({ ok: true }, d, {
      besluiten: magBesluit ? sctx.besluitenOver(g.w, type, id) : null,
      naamgrens: type === 'lid' ? Object.assign(naamgrens(g.w.leden, d.object.titel), hardheid(d)) : null,
      let: 'De samenhang hieronder is gemeten uit de gegevens zelf en niet uit een schema. De tijdlijn komt uit het werkjournaal, en dat legt niet elke handeling vast; leeg is hier dus niet hetzelfde als "er gebeurde niets".'
        + (magBesluit ? '' : ' Of er besluiten over dit object gaan, staat er niet: daarvoor mist u het recht "besluit". Dat is niet hetzelfde als "er zijn er geen".')
    }));
  });

  /* De samenhang (de kaart) en het wandelen (wat ligt er twee stappen
     verderop) staan in ./inzicht-graaf.js. Dit bestand gaat over zoeken en
     over het dossier van EEN object; dat kijkt naar de verhoudingen tussen de
     soorten -- en houdt vast dat niet-gemeten iets anders is dan geen
     samenhang. */
  require('./inzicht-graaf')(sctx, { laagVoor, zoeklaag, MEETGRENS });

  /* Deze laag geeft niets terug aan de gedeelde context. Dat is bewust: hij
     LEEST de soorten van de modules boven hem en heeft niets wat een andere
     deellaag nodig heeft. Namen in sctx zetten die niemand ophaalt, maakt de
     kern breder zonder dat er iets mee gebeurt. */
};
