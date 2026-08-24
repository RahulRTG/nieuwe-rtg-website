/* ============================================================================
   HET TWEEDE MOMENT VAN DE WERKRUIMTE -- VERTROUWEN.md laag 3.

   EEN STEP-UP DIE JE NIET KUNT GEVEN, IS GEEN STEP-UP. De poort van laag 3
   vraagt bij een zware handeling om een tweede bevestiging; zonder een deur om
   die te geven is dat een 428 waar niemand iets mee kan, en dan zoekt een
   beheerder de weg eromheen. Deze deur is die weg naar binnen.

   EN HIJ IS HIER STERKER DAN EEN WACHTWOORD OPNIEUW TYPEN. Een werkruimtelid
   heeft geen wachtwoord -- het heeft een lid-token. Wat het WEL heeft als het
   gekoppeld is, is een RTG-account met een eigen inlog, en die inlog is al
   gemeten (kern/vertrouwen/verificatie.js, gezet in routes/auth/inlog.js).

   DE BEVESTIGING IS DUS: TOON DAT JE BEIDE SLEUTELS HEBT.

     lid-token   je bent dit lid van deze werkruimte
     RTG-sessie  en je bent het RTG-account waar dit lid aan hangt

   Wie alleen het lid-token buitmaakt, komt hier niet langs; daarvoor moet hij
   ook door de RTG-inlog van diezelfde mens heen. Dat is precies wat een tweede
   factor hoort te doen.

   DRIE DINGEN DIE HIER MET OPZET NIET MOGEN, en ze zijn alle drie een manier om
   deze deur van binnenuit uit te hollen:

   1. EEN SLEUTEL BEVESTIGT NIETS. Het beheer-token mag hier niet langs. Zou dat
      wel mogen, dan is de step-up voor de sleuteldeur een formaliteit met een
      extra veld -- en juist die deur is de deur zonder mens.
   2. EEN ONGEKOPPELD LID BEVESTIGT NIETS. Er valt dan niets opnieuw te bewijzen.
      Dat is geen fout maar een stand, en hij krijgt de reden. Een systeem dat
      hier stilletjes doorlaat omdat de koppeling ontbreekt, heeft de step-up
      alleen voor de netten aangezet.
   3. EEN OUDE RTG-INLOG BEVESTIGT NIETS. De tweede sleutel erft zijn sterkte
      van de inlog eronder en verzint er geen. Is die inlog zacht (een pincode)
      of verlopen, dan is dit geen tweede factor maar een oude sessie in een
      nieuw jasje, en dan sturen we de mens naar de RTG-inlog.
   ========================================================================== */
'use strict';

const { TE_ZACHT, minuten } = require('../kern/vertrouwen/stapop');

module.exports = (sctx) => {
  const { app, kern, beheerderVan } = sctx;
  const { auth } = kern;

  /* De twee sleutels naast elkaar. Levert de gemeten RTG-inlog terug als het
     klopt, want de aanroeper heeft die nodig om de nieuwe verificatie mee te
     onderbouwen -- en niet om hem over te schrijven met iets harders. */
  function tweeSleutels(req, b) {
    const key = req.session && req.session.key;
    if (!key) return { ok: false, status: 403,
      reden: 'Een tweede bevestiging vraagt uw RTG-sessie naast uw lid-token. Log in bij RTG en probeer het opnieuw.' };
    if (b.viaSleutel) return { ok: false, status: 400,
      reden: 'Een beheer-token bevestigt niets. Achter een sleutel staat geen persoon om iets aan te vragen; meld u aan als lid van deze werkruimte.' };
    if (!b.l.rtgKey) return { ok: false, status: 409,
      reden: 'Dit lid is niet aan een RTG-account gekoppeld, dus er valt niets opnieuw te bewijzen. Koppel het account (/api/bedrijf/lid/koppel), of laat iemand anders deze handeling doen.' };
    if (b.l.rtgKey !== key) return { ok: false, status: 403,
      reden: 'Deze RTG-sessie hoort bij een ander account dan dit lid.' };

    /* DE STERKTE VAN DE TWEEDE SLEUTEL IS DIE VAN DE INLOG ERONDER. Hij wordt
       opgezocht en niet aangenomen; dat is het verschil tussen een gemeten
       eigenschap en een bewering zonder bron (VERTROUWEN.md par. 3.1). */
    const rtg = kern.vertrouwen.verificatieVan(req.sessieToken);
    if (!rtg) return { ok: false, status: 403,
      reden: 'Van deze RTG-sessie is niet vastgelegd hoe hij is geverifieerd, dus hij kan hier niets dragen. Log opnieuw in bij RTG.' };
    if (TE_ZACHT.has(rtg.sterkte)) return { ok: false, status: 403,
      reden: 'Uw RTG-sessie is geverifieerd met ' + rtg.naam + ', en daarmee is deze bevestiging niet harder dan het lid-token dat u al had. Log opnieuw in bij RTG.' };
    if (!rtg.vers) return { ok: false, status: 403,
      reden: 'Uw RTG-inlog is ' + minuten(rtg.ouderdomMs) + ' oud. Een bevestiging hoort een VERS moment te zijn; log opnieuw in bij RTG.' };
    return { ok: true, rtg };
  }

  /* De deur zelf. `auth` staat ervoor, dus de RTG-sessie is al geverifieerd
     voordat hier iets gebeurt; het lid-token gaat in het lijf mee. */
  app.post('/api/bedrijf/bevestig', auth, (req, res) => {
    const b = beheerderVan(req, res); if (!b) return;
    const twee = tweeSleutels(req, b);
    if (!twee.ok) return res.status(twee.status).json({ error: twee.reden });

    /* De sessie van deze laag IS het lid-token: dat is de sleutel waarmee de
       volgende poging binnenkomt, en de bon hangt aan diezelfde sessie. */
    const sessie = String(req.body.lidToken || '');
    const uit = kern.vertrouwen.losBon(String(req.body.id || ''), sessie);
    if (!uit.ok) return res.status(400).json({ error: uit.reden });

    /* En de sessie is nu VERS -- zie kern/vertrouwen/tweedemoment.js. Daarmee
       gaat een ZWARE handeling het volgende kwartier vanzelf door; een
       UITZONDERLIJKE blijft elke keer een eigen bon vragen. */
    kern.vertrouwen.verifieer(sessie, { hoe: 'tweesleutels', account: b.l.rtgKey,
      apparaat: String(req.get('user-agent') || '') + '|' + String(req.get('accept-language') || '') });
    res.json({ ok: true,
      let: 'Deze bevestiging hoort bij deze ene handeling en is eenmalig. Een bevestiging die op alles past, bevestigt niets.' });
  });
};
