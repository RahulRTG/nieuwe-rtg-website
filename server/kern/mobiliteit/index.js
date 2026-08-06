/* Kern-module "mobiliteit": het Mobility OS. Een vervoerskern waarmee
   personen, bedrijven en vervoerders elk type vervoer plannen, boeken,
   uitvoeren en betalen.

   DE ONTWERPKEUZE. Elk vervoerstype is een aan- of uitzetbare module, maar
   alle modules gebruiken dezelfde ritten-, gebruikers-, locatie-, veiligheids-
   en betaalkern. Daardoor kan RTG met taxi's beginnen zonder later alles
   opnieuw te bouwen als er OV, pendelbussen, boten of helikopters bij komen.

   WAT DEZE KERN WEL EN NIET IS. Hij is GEEN tweede huishouding naast wat er
   al staat. Leden, codenamen, leveranciers, personeel, betalingen, meldingen
   en de functieschakelkast bestaan al; deze kern gebruikt ze. Wat hier bij
   komt is de vervoerslaag eroverheen:

     modulecatalogus + register  welke vervoersvormen waar bestaan
     voertuigcatalogus + assets  een voertuigmodel voor alles wat rijdt,
                                 vaart of vliegt, met fail-closed papieren
     keten + opdracht/voortgang  een rittenmotor die alle vervoersvormen deelt
     plekken                     vertrek en bestemming uit RTG zelf (horeca,
                                 hotels, haltes) in plaats van een eigen adresboek
     matching                    toewijzing met instelbare wegingen en uitleg
     dispatch                    het scherm van de planner
     pendel + pendel-rooster     bedrijfsvervoer met een dienstregeling

   DE BOUWVOLGORDE ZIT IN HET REGISTER, NIET IN DE CODE. Taxi (ride_hailing)
   en de OV-planner staan standaard aan; charters, boten en OV-kaartverkoop
   staan uit tot de contracten, de vergunningen en de menselijke bevestiging er
   zijn. De code voor die producten staat er dus wel, maar hij is niet aan te
   zetten zonder dat de voorwaarden geregeld zijn -- dat is precies wat een
   afhankelijkheid in de catalogus doet.

   WAT HIER BEWUST NIET GEBEURT. Geld verplaatsen. Een rit rekent af via
   kern/pay, zoals elke andere RTG-betaling, en de gebeurtenis 'payment.settled'
   is een aantekening op de opdracht en geen tweede grootboek. En RTG voert zelf
   geen commerciele luchtvaart of zeevaart uit: die producten zijn een
   marktplaats voor gecertificeerde exploitanten, wat je terugziet in de
   boekingsvorm 'aanvraag' -- daar zit altijd een mens tussen. */

function maakMobiliteit(state) {
  const { db, save, crypto, schoon, codenaamVan, haversine, etaMinutes, notify,
    findSupplier, logActivity, sseToOffice, sseToCustomer } = state;

  const nu = () => new Date().toISOString();
  const id = p => (p || 'mb') + crypto.randomBytes(4).toString('hex');

  /* De gedeelde context. Hij wordt EEN keer bij het opstarten gevuld en aan
     alle deelmodules meegegeven; kruisverwijzingen lopen erover, zodat er geen
     module een andere rechtstreeks hoeft te requiren. De volgorde hieronder is
     gedrag: assets leunt op het register, de opdracht op plekken en het
     register, matching op assets, dispatch op alledrie. */
  const ctx = { db, save, crypto, schoon, nu, id, codenaamVan, haversine, etaMinutes,
    notify, findSupplier, logActivity, sseToOffice, sseToCustomer };

  Object.assign(ctx, require('./register')(ctx));
  Object.assign(ctx, require('./plekken')(ctx));
  Object.assign(ctx, require('./assets')(ctx));
  Object.assign(ctx, require('./opdracht')(ctx));
  Object.assign(ctx, require('./voortgang')(ctx));
  Object.assign(ctx, require('./matching')(ctx));
  Object.assign(ctx, require('./dispatch')(ctx));
  Object.assign(ctx, require('./pendel')(ctx));
  Object.assign(ctx, require('./pendel-rooster')(ctx));

  ctx.ensureRegister();
  ctx.ensureAssets();
  ctx.ensureOpdrachten();
  ctx.ensurePendel();
  ctx.ensureMatching();

  /* Wat een reiziger te kiezen heeft, hier, nu. Dit is het antwoord waarmee de
     app zichzelf opbouwt: welke vervoersvormen staan aan, met welke voertuigen
     en welke boekingsvorm. Een app die zijn eigen knoppenlijst hardcodeert,
     loopt binnen een maand uit de pas met het register. */
  function mobAanbod(waar = {}) {
    const uit = [];
    for (const [cat, c] of Object.entries(ctx.CATEGORIEEN)) {
      const m = ctx.modAan(c.module, waar);
      if (!m.aan) continue;
      uit.push({ categorie: cat, naam: c.naam, laag: c.laag, boeking: c.boeking, module: c.module,
        plaatsen: c.plaatsen, bagage: c.bagage, rolstoel: !!c.rolstoel });
    }
    /* Welke ritsoorten er te kiezen zijn. 'charter' is het buitenbeentje: welke
       module daarvoor moet draaien hangt aan het VOERTUIG (helikopter, vliegtuig
       of boot) en niet aan de ritsoort. Hier stond eerst de eerste de beste
       categorie ingevuld, en dan verscheen "charter" in de lijst zodra de gewone
       taxi aan stond -- een keuze die daarna bij het aanvragen alsnog stukliep.
       Charter bestaat als er iets op aanvraag te boeken valt, en anders niet. */
    const soorten = ctx.RITSOORTEN.filter(r => {
      if (r === 'charter') return uit.some(c => c.boeking === 'aanvraag');
      const modId = ctx.moduleVoor(r, null);
      return modId ? ctx.modAan(modId, waar).aan : false;
    });
    return { ok: true, waar, categorieen: uit, ritsoorten: soorten,
      // de drie vormen apart, want ze gedragen zich echt anders in de app
      direct: uit.filter(c => c.boeking === 'direct'),
      opAanvraag: uit.filter(c => c.boeking === 'aanvraag'),
      ervaringen: uit.filter(c => c.boeking === 'ervaring') };
  }

  /* Het beeld van een reiziger: zijn lopende rit, zijn geschiedenis en zijn
     favoriete plekken. Bewust een antwoord, want de app toont ze op een
     scherm en drie losse aanroepen lopen uit de pas. */
  function mobMijn(session) {
    const eigen = ctx.opdrachtenVan(session.key);
    const lopend = eigen.find(o => !['afgerekend', 'geannuleerd', 'voltooid'].includes(o.status)) || null;
    return { ok: true,
      lopend: lopend ? Object.assign(ctx.opdrachtBeeld(lopend, true), { positie: lopend.positie || null, mag: ctx.opdrachtVolgende(lopend) }) : null,
      ritten: eigen.slice(0, 25).map(o => ctx.opdrachtBeeld(o)),
      favorieten: ctx.favLijst(session).favorieten };
  }

  /* Een rit aanvragen als lid. De sessie gaat mee zodat 'hier' en een
     favoriete plek op te lossen zijn, en de pas gaat mee als doelgroep zodat
     het register per pas kan verschillen. */
  function mobVraag(session, body = {}) {
    if (session.tier === 'guest') return { status: 403, error: 'RTG Vervoer is voor leden.' };
    return ctx.opdrachtMaak({ soort: 'lid', key: session.key, session, groep: session.tier,
      org: body.namensOrganisatie ? schoon(body.namensOrganisatie, 20) : null,
      stad: schoon(body.stad, 40) || null }, body);
  }

  /* Annuleren mag alleen de reiziger zelf (of de dispatcher, via zijn eigen
     ingang). Zonder deze eigendomscontrole kan iedereen met een ref-nummer de
     rit van een ander afzeggen. */
  function mobAnnuleer(session, body = {}) {
    const o = ctx.opdrachtMet(schoon(body.ref, 30));
    if (!o) return { status: 404, error: 'Opdracht niet gevonden.' };
    if (o.reiziger !== session.key) return { status: 403, error: 'Dit is uw rit niet.' };
    return ctx.opdrachtAnnuleer(o.ref, 'lid', body.reden);
  }

  return Object.assign({}, ctx, { mobAanbod, mobMijn, mobVraag, mobAnnuleer });
}

module.exports = { maakMobiliteit };
