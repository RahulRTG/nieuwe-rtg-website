/* Foundation OS (kern/rtfos): het bestuurssysteem van de RTFoundation.

   WAT DIT IS. RTF is een landelijke stichting die per stad met bestaande lokale
   partijen samenwerkt: eigen bestuur, eigen projecten, eigen budgetten, eigen
   mensen -- onder een centrale governance. Dat is een federatief model, en de
   software moet het dragen in plaats van het te beschrijven. Alles wat het
   landelijke toezicht draagt (steden activeren, modules per stad, goedkeurings-
   limieten, oormerken op geld, meldingen die niet gewist kunnen worden) is hier
   code en geen afspraak.

   DE OPBOUW. Een gedeelde context (./basis) gaat EEN keer bij het opstarten
   rond; elk deel krijgt hem mee en geeft zijn eigen functies terug. Geen kosten
   per verzoek, en er is precies EEN plek waar "wie mag wat, waar" wordt
   beantwoord. De delen:

     basis            de bodem: opslag, audit, zetels, rechten, vlaggen
     steden + zetels  de organisatieboom en wie er in een stad iets mag
     partners         de lokale stichtingen, hun dossier en hun portaal
     projecten        het centrale object van de uitvoering
     vrijwilligers    het register, de VOG-grendel, uren en planning
     geld             bronnen met een oormerk, uitgaven met vier ogen
     casus            de individuele hulpvraag (codenaam, toestemming)
     integriteit      incidenten, klachten, klokkenluider
     rapport          impact per stad en landelijk
     gemeente         de verantwoording aan de gemeente (geteld, nooit gelezen)
     ondernemers      het lokale maatschappelijke ondernemersnetwerk
     subsidies        aanvragen, voorwaarden, rapportagemomenten, terugvordering
     voorraad         goederen als batch: houdbaarheid, restant, bestemming
     activiteiten     inschrijven, wachtlijst, toestemming, incheck aan de deur
     berichten        communicatie per stad, publiek pas na landelijk akkoord
     netwerk          blauwdrukken delen tussen steden, en eerlijk vergelijken
     inkoop           samen kopen zonder de goedkeuring van een stad te omzeilen
     uitwisseling     vrijwilligers tussen steden, met toestemming en einddatum
     campagnes        landelijk werven, centnauwkeurig verdelen over steden
     koppeling        wat er naar RTG loopt, en wat er eerlijk NIET loopt
     vrijwilligerportaal  de vrijwilliger zelf: planning, uren, VOG-datum
     deelnemerportaal     de hulpvrager zelf: de stand, en toestemming intrekken
     publiek          de app voor de buurt: geen inlog, dus de strengste grens

   WAT DIT NIET IS. Geen tweede ledenadministratie en geen tweede boekhouding.
   De 30%-afdracht van RTG naar de stichting blijft in kern/fonds.js; dit OS
   gaat over wat de stichting met dat geld DOET. */

const kluis = require('../../kluis');

module.exports = (state) => {
  const { db, save, crypto, boardroomWie, magBoardroom } = state;
  const ctx = require('./basis')({ db, save, crypto, boardroomWie, magBoardroom });
  // De schrijflaag en de kluis gaan mee op dezelfde context: elk deel schrijft
  // via dezelfde save() en versleutelt via dezelfde sleutel.
  Object.assign(ctx, { db, save, crypto, kluis });

  const steden = require('./steden')(ctx);
  const partners = require('./partners')(ctx);
  const projecten = require('./projecten')(ctx);
  const vrijwilligers = require('./vrijwilligers')(ctx);
  const geld = require('./geld')(ctx);
  const casus = require('./casus')(ctx);
  const integriteit = require('./integriteit')(ctx);
  const rapport = require('./rapport')(ctx);
  const gemeente = require('./gemeente')(ctx, { cijfersVan: rapport.cijfersVan });
  const ondernemers = require('./ondernemers')(ctx);
  /* De uitwisseling wordt hier opgebouwd omdat het vrijwilligersregister hem
     nodig heeft: die laatste vraagt bij het
     koppelen of een vrijwilliger uit een andere stad hier is uitgeleend, en die
     vraag hoort thuis bij de uitwisseling zelf (een tweede oordeel zou uiteen
     gaan lopen -- LAT.md regel 4). De verwijzing gaat via de context, want
     twee modules die elkaar over en weer laden is een kring die alleen werkt
     zolang niemand de volgorde aanraakt. */
  const uitwisseling = require('./uitwisseling')(ctx);
  ctx.magInStad = uitwisseling.magInStad;

  /* Fase twee: de uitvoering op straat. Subsidies leunen op geld.js (een
     toegekende subsidie MAAKT zijn geoormerkte bron, en maakt hem niet na);
     activiteiten leunen op de VOG-toets. Beide krijgen die functie mee in
     plaats van hem opnieuw te bedenken (LAT.md regel 4). */
  const subsidies = require('./subsidies')(ctx, { bronUitSubsidie: geld.bronUitSubsidie });
  const voorraad = require('./voorraad')(ctx);
  const activiteiten = require('./activiteiten')(ctx, { vogGeldig: vrijwilligers.vogGeldig });
  const berichten = require('./berichten')(ctx);
  /* Fase vier: het netwerkeffect. Delen, samen kopen, mensen uitwisselen en
     landelijk werven -- allemaal met de stadsgrenzen intact. */
  const netwerk = require('./netwerk')(ctx);
  const inkoop = require('./inkoop')(ctx, { boekAanvraag: geld.boekAanvraag });
  const campagnes = require('./campagnes')(ctx, { bronUitCampagne: geld.bronUitCampagne });
  const koppeling = require('./koppeling')(ctx, { agenda: state.agenda });
  /* De drie doelgroepen die tot nu toe wel in het systeem stonden maar er niet
     in konden: de vrijwilliger, de hulpvrager en de buurt. Alle drie op een
     eigen ingang met een eigen, engere blik -- zie de kop van elke module. */
  const vrijwilligerportaal = require('./vrijwilligerportaal')(ctx);
  const deelnemerportaal = require('./deelnemerportaal')(ctx, { toestemmingWegDirect: casus.toestemmingWegDirect });
  const publiek = require('./publiek')(ctx);

  /* Het auditspoor uitlezen. Alleen landelijk, en alleen lezen -- er is nergens
     een functie die erin schrijft behalve ctx.audit zelf, en nergens een die
     eruit haalt. De afkapteller gaat mee: "er staat niets meer" en "er is nooit
     iets geweest" mogen niet hetzelfde lezen (LAT.md regel 3). */
  function auditlog(req, filter) {
    const w = ctx.wie(req);
    if (!w.landelijk) return { status: 403, error: 'Het auditspoor is van het landelijke RTF-bestuur.' };
    const f = filter || {};
    let rijen = ctx.S().audit;
    if (f.wat) rijen = rijen.filter(r => r.wat.startsWith(String(f.wat)));
    if (f.wie) rijen = rijen.filter(r => r.wie === String(f.wie));
    return { ok: true, totaal: rijen.length, afgekapt: Number(ctx.S().auditAfgekapt) || 0,
      regels: rijen.slice(0, 300) };
  }

  // Wie ben ik in dit OS: het scherm bouwt hier zijn menu op.
  function ik(req) {
    const w = ctx.wie(req);
    return { ok: true, ingelogd: !!w.key, key: w.key, landelijk: w.landelijk,
      zetels: w.zetels.map(z => ({ stad: z.stad, rol: z.rol,
        stadNaam: (ctx.stadVan(z.stad) || {}).naam || z.stad })),
      vlaggen: ctx.VLAGGEN, rollen: ctx.ROLLEN };
  }

  return { rtfos: {
    ik, auditlog,
    boom: steden.boom, stad: steden.stad, stadMaak: steden.stadMaak, stadStatus: steden.stadStatus,
    vlagZet: steden.vlagZet, limietZet: steden.limietZet, zetelZet: steden.zetelZet,
    zetelWeg: steden.zetelWeg, kernteamZet: steden.kernteamZet,
    partners, projecten, vrijwilligers, geld, casus, integriteit, rapport, gemeente, ondernemers,
    subsidies, voorraad, activiteiten, berichten,
    netwerk, inkoop, uitwisseling, campagnes, koppeling,
    vrijwilligerportaal, deelnemerportaal, publiek,
    VLAGGEN: ctx.VLAGGEN, ROLLEN: ctx.ROLLEN
  } };
};
