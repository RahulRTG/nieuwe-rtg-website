/* Rendez-vous, deelbestand "kring": THE TABLE, MOMENT EN ENCOUNTER.

   Niet elke ontmoeting hoeft een date te zijn (ONTMOETEN.md par. 2.6). Dit
   bestand doet de vormen waarbij de FYSIEKE WERELD het werk doet en de software
   alleen de deur openzet.

   ---------------------------------------------------------------------------
   EEN MECHANISME, TWEE MOMENTEN

   Moment en Encounter lijken twee functies maar zijn er een. Allebei is het:
   iemand krijgt de vraag of hij aan een ander voorgesteld wil worden, allebei
   antwoorden ze afzonderlijk, en ALLEEN bij twee keer ja gaat er iets open. Het
   verschil is uitsluitend WANNEER de vraag komt.

     Moment      voor de ontmoeting. U bent allebei op hetzelfde evenement;
                 zal de gastheer u aan elkaar voorstellen?
     Encounter   na de ontmoeting. U heeft elkaar gesproken en geen nummers
                 uitgewisseld; wilt u aan die ander worden voorgesteld?

   Daarom staat er hier een `introBied` / `introAntwoord` en geen twee bijna
   gelijke ketens. Een derde moment (na een reis, na een tafel) is een derde
   `soort` en verder niets -- LAT.md regel 4.

   TWEE KEER JA, EN NIEMAND ZIET DE EERSTE. Wie als eerste ja zegt, mag niet
   zichtbaar worden voor de ander: dan is het geen vraag meer maar een verzoek
   dat je moeilijk kunt afslaan. Een nee wordt daarom ook nooit gemeld -- de
   ander leest niets, en dat is precies de bedoeling.

   ---------------------------------------------------------------------------
   ENCOUNTER DRAAIT OP DE CONTACTPIN, EN LEENT NIETS ANDERS

   De pin (kern/sociaal/pin.js) is een ADRES en geen geheim: hij bewijst niets,
   hij wijst alleen aan, en hij werkt pas als u hem zelf afgeeft. Dat is precies
   wat hier nodig is: twee mensen die elkaar net hebben gesproken, wisselen een
   pin en verder niets.

   WAT ER DAN ONTSTAAT IS EEN TIJDELIJKE VERBINDING DIE ALLEEN RENDEZ-VOUS KENT.
   Er wordt GEEN contact toegevoegd, geen vriendschap gelegd, geen sociale
   relatie aangemaakt. Romantische interesse geeft geen toegang tot iemands
   bredere sociale identiteit; dat is een aparte, latere stap die de mens zelf
   zet (ONTMOETEN.md par. 2.6).

   OVER "DE VOLGENDE OCHTEND". Het document schetst dat de vraag de ochtend erna
   komt. Dat is presentatie en geen mechanisme: hier wordt niets ingepland, en er
   is geen wekker die dit afvuurt. De vraag staat klaar en ieder beantwoordt hem
   wanneer hij de app opent. Zo staat er niets in de code dat doet alsof er een
   planner is die er niet is.

   ---------------------------------------------------------------------------
   THE TABLE: NIEMAND HOORT OOIT WIE ER NOG MEER IS

   Een tafel is zes of acht leden, en een genodigde ziet de tafel -- stad, dag,
   thema, aantal plaatsen -- maar NOOIT de gastenlijst. Achter de schermen mag
   RTG twee mogelijke introducties dezelfde uitnodiging sturen; dat is de hele
   kunst, en het werkt alleen zolang niemand het merkt. Zou de lijst zichtbaar
   zijn, dan was het een koppelavond met een ander woord ervoor.

   Een tafel wordt door RTG samengesteld en niet door een lid. Er is nog geen
   backofficescherm waar dat gebeurt; de kern kan het wel, en dat gat staat zo in
   ONTMOETEN.md. */
module.exports = (ctx) => {
  const { R, mag, codenaam, schoon, nu, save, crypto, notify, handleVanPin } = ctx;

  const id = () => 'rv' + crypto.randomBytes(4).toString('hex');
  const isDatum = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
  const paar = (a, b) => [a, b].sort().join('|');
  const SOORTEN = ['moment', 'encounter'];

  function T() { const r = R(); if (!r.tafels || typeof r.tafels !== 'object') r.tafels = {}; return r.tafels; }
  // de kantoorkant (samenstellen en overzicht) woont in ./rendezvous-tafels.js
  const kantoor = require('./rendezvous-tafels')({ T, id, isDatum: d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')), schoon, nu, save, notify, codenaam });
  function I() { const r = R(); if (!r.introducties || typeof r.introducties !== 'object') r.introducties = {}; return r.introducties; }

  /* ---- The Table ---- */

  /* Wat een genodigde ziet. Nadrukkelijk zonder gastenlijst: `plaatsen` zegt hoe
     groot het gezelschap is en verder niets. Wie er nog meer komt, hoort u aan
     tafel en niet in een app. */
  function tafels(key) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const uit = Object.values(T())
      .filter(t => t.genodigden[key])
      .map(t => ({ id: t.id, naam: t.naam, stad: t.stad, datum: t.datum, tijd: t.tijd,
        thema: t.thema, plaatsen: t.plaatsen, mijnStatus: t.genodigden[key].status }))
      .sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
    return { status: 200, tafels: uit };
  }

  function tafelAntwoord(key, tid, ja) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const t = T()[String(tid || '')];
    if (!t || !t.genodigden[key]) return { status: 404, error: 'Deze uitnodiging staat niet op uw naam.' };
    t.genodigden[key] = { status: ja === false ? 'nee' : 'ja', at: nu() };
    save();
    return { status: 200, ok: true, mijnStatus: t.genodigden[key].status };
  }

  /* ---- de tweezijdige ja: Moment en Encounter ---- */

  function introBied(soort, a, b, aanleiding) {
    if (!SOORTEN.includes(soort) || !a || !b || a === b) return null;
    const sl = paar(a, b);
    const bestaand = I()[sl];
    if (bestaand && !bestaand.gesloten) return bestaand;
    const v = { id: sl, soort, aanleiding: schoon(aanleiding, 120), ja: {}, geopend: null, at: nu() };
    I()[sl] = v; save();
    for (const [wie, met] of [[a, b], [b, a]]) {
      try { notify(wie, { title: 'Rendez-vous', body: 'Wilt u aan ' + codenaam(met) + ' worden voorgesteld?', scope: 'lifestyle' }); } catch (e) {}
    }
    return v;
  }

  /* Wat het lid ziet. `anderJa` staat er BEWUST niet in: wie als eerste ja zegt
     blijft onzichtbaar tot beiden geantwoord hebben, en een nee wordt nooit
     gemeld. Alleen `geopend` verschijnt, en dan is het wederzijds. */
  function introducties(key) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const uit = [];
    for (const v of Object.values(I())) {
      const [x, y] = v.id.split('|');
      if (x !== key && y !== key) continue;
      const met = x === key ? y : x;
      uit.push({ id: v.id, soort: v.soort, aanleiding: v.aanleiding, codenaam: codenaam(met),
        ikAntwoordde: v.ja[key] === undefined ? null : !!v.ja[key], geopend: !!v.geopend, at: v.at });
    }
    return { status: 200, introducties: uit.sort((a, b) => String(b.at).localeCompare(String(a.at))) };
  }

  function introAntwoord(key, sl, ja) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const v = I()[String(sl || '')];
    if (!v) return { status: 404, error: 'Deze vraag staat niet voor u open.' };
    const [x, y] = v.id.split('|');
    if (x !== key && y !== key) return { status: 404, error: 'Deze vraag staat niet voor u open.' };
    const met = x === key ? y : x;
    v.ja[key] = ja !== false;

    /* Een nee sluit de vraag, en de ander hoort niets. Zou er een melding komen,
       dan was "nee" een bericht in plaats van een stilte -- en precies dat maakt
       afwijzen zwaar. */
    if (!v.ja[key]) { v.gesloten = nu(); save(); return { status: 200, ok: true, geopend: false }; }
    if (v.ja[met]) {
      v.geopend = nu(); save();
      for (const wie of [key, met]) {
        try { notify(wie, { title: 'Rendez-vous', body: 'De introductie is open.', scope: 'lifestyle' }); } catch (e) {}
      }
      return { status: 200, ok: true, geopend: true, codenaam: codenaam(met) };
    }
    save();
    return { status: 200, ok: true, geopend: false };
  }

  /* Encounter: u voert de pin in van iemand die u net heeft gesproken. Pas als
     BEIDEN dat hebben gedaan is er een ontmoeting, en dan komt de vraag. Een pin
     alleen is niet genoeg: dan kon iemand een voorgelezen pin later thuis
     invoeren en had de ander een vraag over iemand die hij niet koos. */
  function encounter(key, pin) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const doel = handleVanPin ? handleVanPin(String(pin || '').trim()) : null;
    if (!doel || doel === key) return { status: 404, error: 'Die pin wijst niemand aan.' };
    const r = R();
    if (!r.ontmoetingen || typeof r.ontmoetingen !== 'object') r.ontmoetingen = {};
    const sl = paar(key, doel);
    const o = r.ontmoetingen[sl] || (r.ontmoetingen[sl] = { wie: {}, at: nu() });
    o.wie[key] = nu();
    save();
    if (!o.wie[doel]) return { status: 200, ok: true, wacht: true };
    introBied('encounter', key, doel, 'u heeft elkaar ontmoet');
    return { status: 200, ok: true, wacht: false, codenaam: codenaam(doel) };
  }

  return { ...kantoor, rvTafels: tafels, rvTafelAntwoord: tafelAntwoord,
    rvIntroducties: introducties, rvIntroAntwoord: introAntwoord, rvEncounter: encounter,
    rvIntroBied: introBied };
};
