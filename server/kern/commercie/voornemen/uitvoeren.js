/* HET VOORNEMEN UITVOEREN -- stap voor stap, met het bewijs erbij.

   ../voornemen.js BESLUIT: opstellen, keuren, aftekenen, staken. Dit bestand
   DOET, en dat is een ander onderwerp: hier komt geen beleid aan te pas, alleen
   de vraag of wat er is goedgekeurd nog steeds is wat er wordt uitgevoerd.

   DRIE GRENDELS, EN ALLE DRIE OM DEZELFDE REDEN: tussen goedkeuren en doen zit
   tijd, en in die tijd kan alles veranderen.

   1. DE VINGERAFDRUK, ELKE KEER OPNIEUW. Zonder deze regel is "goedgekeurd" een
      stempel op iets dat daarna nog kan groeien: keur 900 euro goed, voer 9000
      uit. Wijkt de afdruk af, dan is de goedkeuring VERVALLEN en niet "bijna
      geldig" -- het voornemen wordt gestaakt en niet stil aangepast.
   2. HET BEWIJS WORDT INGELEVERD. Het besluit gaf een bewijstoken mee
      (../bewijstoken.js) en hier wordt hij verbruikt. Zo draait een stap niet op
      "de keuring stond hierboven toch": de keten is aantoonbaar en niet
      aannemelijk. Het token dekt de KEURING en niet elke stap apart, dus na de
      eerste stap is een eenmalig token op -- verder gaat het op de stand van het
      voornemen, die hier al is nagekeken.
   3. ELKE STAP DRAAGT EEN EIGEN ECONOMISCHE SLEUTEL: die van het voornemen, met
      het stapnummer erachter. Dat is wat een herhaling onschadelijk maakt tot in
      de betaalrij (kern/betaalopdracht/rij.js) -- zeventien herhalingen, een
      economische handeling, nu over een hele keten in plaats van over een
      betaling.

   EN ER WORDT NIETS GEBOEKT. `doe` komt van de aanroeper. Deze laag bewaakt de
   uitvoering; wat een stap betekent weet het domein eronder. */
'use strict';

const P = require('./plan');

function maakUitvoering({ vind, zet, publiek, save, tijd, verbruikToken, veiligheidskern }) {

  /* UITVOEREN. Stap voor stap, en elke stap levert het bewijs in. `doe` komt van
     de aanroeper -- deze laag boekt niets, zij bewaakt. */
  async function voerUit(id, { doe, context }) {
    const v = vind(id);
    if (!v) return { status: 404, error: 'Dit voornemen bestaat niet.' };
    if (!P.MAG_UITVOEREN.has(v.stand))
      return { status: 409, error: 'Een voornemen in stand ' + v.stand + ' wordt niet uitgevoerd.' };

    /* DE VINGERAFDRUK, ELKE KEER OPNIEUW. Zonder deze regel is "goedgekeurd" een
       stempel op iets dat daarna nog kan groeien. */
    if (P.afdruk(v) !== v.afdruk) {
      zet(v, P.STAND.GESTAAKT, { reden: 'Het plan is veranderd na de keuring; de goedkeuring is daarmee vervallen.' });
      return { status: 409, error: v.reden, voornemen: publiek(v) };
    }
    if (typeof doe !== 'function') return { status: 400, error: 'Er is geen uitvoerder meegegeven.' };

    for (const s of v.stappen) {
      if (s.gedaan) continue;
      /* HET BEWIJS INLEVEREN. Een stap die draait op "de keuring stond hierboven
         toch" is een stap zonder keten. Is er een verbruiker en een token, dan
         moet het kloppen -- en anders gaat er niets. */
      if (verbruikToken && v.bewijstoken) {
        const t = verbruikToken(v.bewijstoken, { capability: v.handeling, doel: v.doel,
          waardeCenten: v.totaalCenten, context: context || {} });
        if (!t.ok) {
          zet(v, P.STAND.GESTAAKT, { reden: 'Het bewijs bij dit voornemen geldt niet meer: ' + t.error });
          return { status: 409, error: v.reden, voornemen: publiek(v) };
        }
        /* Een eenmalig token is na de eerste stap op. Dat is juist: het bewijs
           dekt de KEURING, niet elke stap apart. Verder gaan we op de stand van
           het voornemen, die hier al is nagekeken. */
        v.bewijstoken = null;
      }
      if (v.stand === P.STAND.GEKEURD) zet(v, P.STAND.BEZIG);

      /* DE VEILIGHEIDSKERN. Een stap die geld verplaatst gaat er doorheen; hij
         draagt het besluit van het voornemen mee en laat een spoor. Een stap van
         nul cent verplaatst geen waarde en hoeft er dus niet langs -- de kern
         klein houden betekent ook: hem niet aanroepen waar hij niets toevoegt.

         Zonder kern doet deze laag wat ze altijd deed. Dat is geen stilzwijgend
         minder: de keuring, de vingerafdruk en het bewijstoken hierboven staan
         er onverminderd. */
      const viaKern = veiligheidskern && s.centen > 0;
      const stapDoen = () => doe({ voornemen: v.id, stap: s.nr, wat: s.wat, doel: s.doel, centen: s.centen,
          gegevens: s.gegevens,
          /* DE ECONOMISCHE SLEUTEL VAN DEZE STAP. Dit is wat een herhaling
             onschadelijk maakt tot in de betaalrij: dezelfde sleutel, dezelfde
             handeling. */
          idemSleutel: (v.sleutel || v.id) + ':' + s.nr });

      let uit = null;
      try {
        uit = viaKern
          ? (await veiligheidskern.doe({ soort: 'WAARDE', wat: s.wat, wie: v.actor || 'onbekend',
              waarom: 'voornemen ' + v.id + ', stap ' + s.nr, waardeCenten: s.centen,
              besluit: v.besluit, bewijs: true }, stapDoen)).uitkomst
          : await stapDoen();
      } catch (e) {
        s.uitkomst = { fout: String((e && e.message) || e).slice(0, 200) };
        save();
        zet(v, P.STAND.GESTAAKT, { reden: 'Stap ' + s.nr + ' (' + s.wat + ') liep vast: ' + s.uitkomst.fout });
        return { status: 500, error: v.reden, voornemen: publiek(v) };
      }
      s.gedaan = true;
      s.uitkomst = uit == null ? null : uit;
      s.at = tijd();
      save();
    }
    zet(v, P.STAND.UITGEVOERD);
    return { status: 200, ok: true, voornemen: publiek(v) };
  }

  /* Wat er halverwege is blijven steken. Een voornemen dat op BEZIG staat is
     een handeling die niemand heeft afgemaakt, en dat is precies het geval
     waarvoor deze laag bestaat -- dus telbaar en niet weggestopt. */
  function halverwege(alles) {
    return alles().filter(v => v.stand === P.STAND.BEZIG)
      .map(v => ({ id: v.id, handeling: v.handeling, gedaan: v.stappen.filter(s => s.gedaan).length,
        van: v.stappen.length, totaalCenten: v.totaalCenten, sinds: v.bijgewerkt }));
  }

  return { voerUit, halverwege };
}

module.exports = { maakUitvoering };
