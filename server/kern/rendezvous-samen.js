/* Rendez-vous, deelbestand "samen": TOGETHER.

   Krijgen twee leden een relatie, dan bevestigen ze dat allebei. De introducties
   stoppen; de kring blijft -- The Table, de evenementen, de concierge
   (ONTMOETEN.md par. 2.10).

   WAAROM DIT ER UBERHAUPT IS. Een datingdienst die blijft verdienen zolang het
   niet lukt, heeft het verkeerde belang. Dit is de knop die dat belang omdraait,
   en hij hoort daarom bij het product en niet bij de goede bedoelingen.

   ---------------------------------------------------------------------------
   "VAN TWEE MENSEN EN NIET VAN EEN" IS HIER EEN EIGENSCHAP, GEEN REGEL

   Er is GEEN collectie "relatie". Er staan twee EENZIJDIGE verklaringen -- ieder
   lid zegt over zichzelf met wie hij samen is -- en "samen" bestaat alleen als
   PROJECTIE: allebei wijzen naar elkaar. Precies de constructie van
   kern/objectlaag/samen.js, en om dezelfde reden:

     > Als de toestand een projectie is over twee eigen verklaringen, dan is
     > "het is van twee mensen" een eigenschap van de bouw in plaats van een
     > controle die iemand kan vergeten.

   Daaruit volgt vanzelf wat je zou willen: niemand kan een ander in een relatie
   zetten, en niemand kan een ander erin HOUDEN. Wie zijn eigen verklaring
   intrekt, trekt alleen zijn eigen helft in -- dat is genoeg, want een projectie
   over twee dingen valt weg zodra er een verdwijnt. Er hoeft dus geen
   "verbreken" te bestaan dat aan de kant van de ander iets aanpast.

   WAT ER NIET GEBEURT. Geen bericht aan de ander als iemand zijn helft intrekt,
   geen datum die wordt bijgehouden, geen "u bent drie maanden samen", geen
   terugblik. LIFE.md par. 4.1 en 4.4: de tijdlijn legt vast wat er was, hij
   stelt nooit voor wat er hoort te komen, en er komt geen cijfer of reeks op het
   leven tussen mensen. */
module.exports = (ctx) => {
  const { R, mag, codenaam, nu, save } = ctx;

  function S() { const r = R(); if (!r.samen || typeof r.samen !== 'object') r.samen = {}; return r.samen; }

  // de projectie: samen zijn we alleen als we allebei naar elkaar wijzen
  const partnerVan = key => {
    const mijn = S()[key];
    if (!mijn || !mijn.met) return null;
    const terug = S()[mijn.met];
    return terug && terug.met === key ? mijn.met : null;
  };

  function status(key) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const mijn = S()[key];
    const p = partnerVan(key);
    return { status: 200, samen: !!p, met: p ? codenaam(p) : null,
      // uw eigen helft, zodat u ziet wat u zelf heeft gezegd
      ikVerklaarde: mijn && mijn.met ? codenaam(mijn.met) : null };
  }

  /* Uw eigen helft zetten of intrekken. `met` is een sessiesleutel; wie dat is
     weet het scherm uit de matchlijst. Er wordt niets aan de kant van de ander
     geschreven -- dat is de hele opzet. */
  function zet(key, met, ja) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    if (ja === false) { delete S()[key]; save(); return { status: 200, ok: true, samen: false }; }
    const doel = String(met || '');
    if (!doel || doel === key) return { status: 400, error: 'Onbekend lid.' };
    if (!R().profielen[doel]) return { status: 404, error: 'Dit lid bestaat niet in Rendez-vous.' };
    S()[key] = { met: doel, at: nu() };
    save();
    const p = partnerVan(key);
    return { status: 200, ok: true, samen: !!p, met: p ? codenaam(p) : null };
  }

  return { rvSamen: status, rvSamenZet: zet, rvPartnerVan: partnerVan };
};
