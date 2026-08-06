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

   WAT DIT NIET IS. Geen tweede ledenadministratie en geen tweede boekhouding.
   De 30%-afdracht van RTG naar de stichting blijft in kern/fonds.js; dit OS
   gaat over wat de stichting met dat geld DOET. */

const kluis = require('../../kluis');

module.exports = ({ db, save, crypto, boardroomWie, magBoardroom }) => {
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
    VLAGGEN: ctx.VLAGGEN, ROLLEN: ctx.ROLLEN
  } };
};
