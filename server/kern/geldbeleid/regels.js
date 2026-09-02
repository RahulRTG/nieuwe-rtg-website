/* Geldbeleid, deel "regels": regels zoals een bedrijf ze stelt (GELD.md
   par. 4). Vier soorten in fase 1:

     minimumbuffer          waarschuw als de vrije ruimte onder de drempel zakt
     maanddrempel           waarschuw boven een maandelijkse bestedingsdrempel
     reserveer-maandelijks  zet maandelijks een bedrag opzij in een pot (potId)
     gift-bevestiging       een gift boven de drempel vraagt extra bevestiging

   Elke regel heeft een niveau (kijken / voorstellen / klaarzetten /
   automatisch) en staat aan of uit. Geen regel, geen handeling. */

const SOORTEN = ['minimumbuffer', 'maanddrempel', 'reserveer-maandelijks', 'gift-bevestiging'];
/* DE SCHAAL WOONT HIER, EN WORDT NERGENS OVERGESCHREVEN. Hij stond als kale
   lijst tekenreeksen; roepers elders schreven dezelfde woorden nog eens over
   (TAKEN.md 4.55). Als bevroren object is hij op te halen -- `NIVEAUS.kijken`
   -- zodat een hernoeming hier een fout elders geeft in plaats van een tak die
   nooit meer vuurt. De lijst wordt AFGELEID en niet ernaast gezet: twee vormen
   van dezelfde waarheid is precies wat dit oplost. */
const NIVEAUS = Object.freeze({
  kijken: 'kijken', voorstellen: 'voorstellen', klaarzetten: 'klaarzetten', automatisch: 'automatisch'
});
const NIVEAU_NAMEN = Object.freeze(Object.values(NIVEAUS));

module.exports = (ctx) => {
  const { pak, kijk, maakId, bedragVan, zichtRegel, logSchrijf, MAX_CENTEN } = ctx;
  const MAX_REGELS = 40; // meer is geen beleid meer maar ruis, en het houdt de opslag per lid begrensd

  function regels(codenaam) { const rec = kijk(codenaam); return rec ? rec.regels.map(zichtRegel) : []; }

  function regelZet(codenaam, r) {
    const rec = pak(codenaam);
    if (!rec) return { status: 400, error: 'Geen codenaam.' };
    r = r && typeof r === 'object' ? r : {};
    const bestaand = r.id != null ? rec.regels.find(x => x.id === String(r.id)) : null;
    if (r.id != null && !bestaand) return { status: 404, error: 'Deze regel bestaat niet.' };
    const soort = String(r.soort || (bestaand ? bestaand.soort : ''));
    if (!SOORTEN.includes(soort)) return { status: 400, error: 'Kies een regelsoort: ' + SOORTEN.join(', ') + '.' };
    // een regel wisselt niet van soort: 'laatst' en potId horen bij de betekenis en zouden stil meeverhuizen
    if (bestaand && soort !== bestaand.soort) return { status: 400, error: 'Een regel wisselt niet van soort; zet deze uit en maak een nieuwe.' };
    const niveau = String(r.niveau || (bestaand ? bestaand.niveau : 'kijken'));
    if (!NIVEAU_NAMEN.includes(niveau)) return { status: 400, error: 'Kies een niveau: ' + NIVEAU_NAMEN.join(', ') + '.' };
    /* DE HARDE GRENS (GELD.md par. 3): 'automatisch' bestaat uitsluitend voor
       het oormerken binnen het eigen tegoed. Elke andere soort raakt
       (mogelijk) een betaling of een derde, en geld verlaat het huis nooit
       autonoom -- die blijven maximaal 'klaarzetten', wat het lid ook vraagt. */
    if (niveau === NIVEAUS.automatisch && soort !== 'reserveer-maandelijks')
      return { status: 400, error: 'Automatisch kan alleen bij maandelijkse reserveringen binnen het eigen tegoed; al het andere blijft maximaal klaarzetten.' };
    const drempel = bedragVan(r.drempelCenten != null ? r.drempelCenten : (bestaand ? bestaand.drempelCenten : null));
    if (drempel == null) return { status: 400, error: 'Geef een drempel in hele centen (0 tot ' + MAX_CENTEN + ').' };
    if (soort === 'reserveer-maandelijks' && drempel < 1) return { status: 400, error: 'Een maandelijkse reservering vraagt een bedrag boven nul.' };
    const aan = r.aan == null ? (bestaand ? !!bestaand.aan : true) : !!r.aan;
    let potId = null;
    if (soort === 'reserveer-maandelijks') {
      potId = String(r.potId || (bestaand && bestaand.potId) || '');
      if (!potId) return { status: 400, error: 'Een maandelijkse reservering hoort bij een pot; geef potId.' };
      // de pot hoeft alleen te bestaan als de regel AAN staat: zo is een regel met een weggehaalde pot nog uit te zetten
      if (aan && !rec.potten.some(p => p.id === potId)) return { status: 404, error: 'De pot van deze regel bestaat niet (meer); maak eerst een pot.' };
    }
    if (!bestaand && rec.regels.length >= MAX_REGELS) return { status: 400, error: 'Meer dan ' + MAX_REGELS + ' regels is geen beleid meer; ruim eerst op.' };
    // 'laatst' blijft staan bij aanpassen: een wijziging halverwege de maand mag de reservering niet herhalen
    const regel = bestaand || { id: maakId('rgl'), soort, laatst: null };
    regel.drempelCenten = drempel; regel.niveau = niveau; regel.aan = aan;
    if (potId) regel.potId = potId;
    if (!bestaand) rec.regels.push(regel);
    // ook beleidswijzigingen in het log: wie zijn regels stiekem kan verzetten, heeft geen beleid
    logSchrijf(codenaam, { wie: 'lid', wat: (bestaand ? 'Beleidsregel aangepast: ' : 'Beleidsregel ingesteld: ') + soort,
      waarom: 'het lid stelt het beleid; Rahul handelt alleen binnen deze regels',
      gegevens: ['regel: ' + regel.id, 'drempel: ' + drempel + ' centen', 'niveau: ' + niveau, 'aan: ' + aan] });
    return { status: 200, ok: true, regel: zichtRegel(regel) };
  }

  /* OPRUIMEN MOET KUNNEN, want de foutmelding hierboven belooft het. Zonder
     deze functie was een regel onverwijderbaar: na veertig regels -- ook
     uitgezette, ook mislukte pogingen om van soort te wisselen -- kon een lid
     nooit meer een nieuwe maken, terwijl de tekst zei dat hij eerst moest
     opruimen. Een melding die een handeling belooft die niet bestaat, is een
     leugen tegen de gebruiker (LAT.md regel 6).

     De regel gaat weg, het LOG blijft: wat er is gebeurd toen hij nog stond,
     is gebeurd. Vandaar dat het weghalen zelf ook een logregel krijgt. */
  function regelWeg(codenaam, id) {
    const rec = pak(codenaam);
    if (!rec) return { status: 400, error: 'Geen codenaam.' };
    const i = rec.regels.findIndex(r => r.id === String(id));
    if (i === -1) return { status: 404, error: 'Deze regel bestaat niet.' };
    const weg = rec.regels[i];
    rec.regels.splice(i, 1);
    logSchrijf(codenaam, { wie: 'lid', wat: 'Beleidsregel verwijderd: ' + weg.soort,
      waarom: 'het lid bepaalt zijn eigen beleid; wat er gebeurde toen de regel nog stond blijft in dit log staan',
      gegevens: ['regel: ' + weg.id, 'niveau: ' + weg.niveau] });
    return { status: 200, ok: true };
  }

  return { regels, regelZet, regelWeg };
};

/* De schaal hangt aan de fabriek zelf, zodat een roeper hem kan ophalen zonder
   de context te hoeven bouwen die deze module verder nodig heeft. */
module.exports.NIVEAUS = NIVEAUS;
module.exports.NIVEAU_NAMEN = NIVEAU_NAMEN;
