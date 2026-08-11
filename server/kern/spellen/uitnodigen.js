/* Spellen (deelmodule): WIE NODIG JE UIT.

   Afgesplitst van ./lobby.js, op de naad die daar al lag. De lobby doet drie
   dingen: een potje OPZETTEN (grootte, teams, tempo, roomvelden), de
   MATCHMAKING (de wachtrij) en het verzamelen van de UITGENODIGDEN. Dat derde
   is een onderwerp op zichzelf -- het gaat niet over spelregels maar over WIE
   je mag bereiken, en het heeft drie ingangen die elk hun eigen poort hebben:

     vrienden     een bevestigde verbinding; de goedkoopste controle
     codenamen    de zoeker, en die kent beschermde kinderen niet
     klasgenoten  door de SERVER bevestigd, want een tiener is onvindbaar in de
                  zoeker en zijn klas is vaak de enige kring die hij heeft

   Waarom apart: die drie groeien mee met elke nieuwe kring (een gezin, een
   club, straks een chatgroep) terwijl het opzetten van een potje dat niet doet.
   De aanleiding was dat lobby.js door de 10 kB-grens ging die
   `scripts/keuring.js` bewaakt -- die grens is geen smaak maar precies deze rem.

   WAT HIER NIET IN ZIT, en dat is met opzet: de leeftijdspoort en de
   wereldpoort. Die stelt `beleid.js` over de hele lijst in een keer, ná dit.
   Ze hier per ingang herhalen zou drie plekken maken waar je er een kunt
   vergeten, en dat is precies de fout die de beleidslaag opheft. Deze module
   levert dus alleen de LIJST; of ze mogen meespelen is een andere vraag.

   ELKE WEIGERING NOEMT DE REDEN en niet "kan niet": een codenaam die niet
   bestaat is iets anders dan een geblokkeerd contact, en iets anders dan iemand
   die niet in jouw klas zit. */
module.exports = (ctx) => {
  const { zijnVrienden, socialZoek, isGeblokkeerd, klasgenotenVan } = ctx;

  /* Verzamelt de sleutels van iedereen die je meeneemt. Geeft
     `{ uitgenodigd }` of `{ status, error }` -- de aanroeper geeft die fout
     ongewijzigd door, zodat de reden bij de speler aankomt.

     `max - 1` is overal de grens: jij zit zelf al aan tafel. */
  async function verzamel(mij, { vrienden, codenamen, klasgenoten }, max) {
    const uitgenodigd = (Array.isArray(vrienden) ? vrienden : []).slice(0, max - 1).filter(v => zijnVrienden(mij, v));

    /* Uitnodigen op codenaam: samen spelen maakt je NIET automatisch vrienden.
       De ander accepteert de uitnodiging zelf, blokkades gelden gewoon en
       beschermde kinderen zijn onvindbaar (die spelen alleen met vrienden). */
    for (const cn of (Array.isArray(codenamen) ? codenamen : []).slice(0, max - 1)) {
      const zoek = await socialZoek(mij, String(cn));
      const hit = (zoek || []).find(r => String(r.codename).toLowerCase() === String(cn).trim().toLowerCase());
      if (!hit) return { status: 404, error: 'De codenaam "' + String(cn).slice(0, 40) + '" is niet gevonden.' };
      if (isGeblokkeerd(mij, hit.key)) return { status: 403, error: 'Dit contact is niet beschikbaar.' };
      if (!uitgenodigd.includes(hit.key) && hit.key !== mij) uitgenodigd.push(hit.key);
    }

    /* Klasgenoten: beschermde tieners zijn onvindbaar via de zoeker, maar de
       eigen klas is een echte, bevestigde kring. De server controleert het
       klasgenootschap zelf (zelfde klas in de schooldata); blokkades gelden. */
    if (Array.isArray(klasgenoten) && klasgenoten.length) {
      const kring = new Set(klasgenotenVan(mij).map(kg => kg.key));
      for (const key of klasgenoten.slice(0, max - 1)) {
        if (!kring.has(key)) return { status: 403, error: 'Alleen echte klasgenoten kun je zo uitnodigen.' };
        if (isGeblokkeerd(mij, key)) return { status: 403, error: 'Dit contact is niet beschikbaar.' };
        if (!uitgenodigd.includes(key)) uitgenodigd.push(key);
      }
    }

    if (!uitgenodigd.length) return { status: 400, error: 'Nodig minstens een speler uit (vriend of codenaam), of speel random.' };
    if (uitgenodigd.length > max - 1) return { status: 400, error: 'Te veel spelers voor dit spel.' };
    return { uitgenodigd };
  }

  return { verzamel };
};
