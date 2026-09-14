/* ============================================================================
   EEN BERICHT VAN RTG AAN EEN GEZINSLID -- de foundation-kant van de bezorging.

   WAAROM DIT BESTAAT. De Adam-keten (scripts/adamproef.js, schakel 10) vond dat
   een aangenomen sollicitant uit een RTF-gezin geen melding kreeg.
   `notifyApplicant` in kern/werk.js stopt met `if (!a.key) return`, en `a.key`
   is de sleutel van een LIDsessie; de rij die routes/member/werk/rtf.js aanmaakt
   draagt `rtf: { code, profielId }` en geen key. De stand werd wel bijgewerkt,
   dus hij kon het zien als hij keek -- hij werd alleen niet gehaald.

   DE WEG DIE HET NIET IS, en dat is hier de hele afweging. Er bestaat een
   universele adresvorm voor een gezinslid: `rtf:CODE:profielId` (rtfHandle in
   ./gezinshulp.js), en `db.data.notifications[handle]` is naar zijn vorm
   sleutel-agnostisch. Daar schrijven is dus verleidelijk en het is FOUT:

       GEEN ENKELE FOUNDATION-ROUTE LEEST db.data.notifications.

   Gemeten, niet aangenomen. Het lid leest die bak via /api/notifications, en
   die hangt achter `auth` -- een lidsessie. Een gezinsprofiel komt daar niet
   langs. Een melding op dat adres schrijven verplaatst het dode spoor een deur
   verder in plaats van het te sluiten, en dat is precies de fout die deze
   reparatie moet ophouden te herhalen.

   WAT EEN GEZINSLID WEL LEEST is het gezinsbord: `g.berichten`, opgehaald met
   /gezin/:code/berichten en geteld in /gezin/:code/mij als `ongelezen`. Daar
   landt dit dus, en nergens anders.

   DRIE DINGEN DIE HIER VASTLIGGEN:

   1. HET BERICHT IS PERSOONLIJK EN NIET VAN HET GEZIN. `naar` is de profiel-id
      en nooit 'allen'. Of een zeventienjarige is aangenomen bij een cafe is
      zijn nieuws; `berichtVoorMij` (./gezinshulp.js) zorgt dat alleen hij het
      ziet. Wie hier 'allen' zet, vertelt het hele gezin iets over een van hen.
   2. DE AFZENDER IS GEEN PROFIEL. `van` is de vaste sleutel 'rtg', die geen
      profiel-id kan zijn. Daarmee blijft `vanMij` vals, telt het bericht als
      ongelezen, en is aan het bord te zien dat dit van het huis komt en niet
      van een gezinslid.
   3. EEN GAST KRIJGT DIT NIET. Een gastprofiel (oppas, opa/oma) is aan het
      gezin gekoppeld maar is er geen lid van; een bericht over de sollicitatie
      van een kind hoort daar niet. `isGast` weigert dat, met een reden.

   EN HIJ GEEFT ALTIJD EEN UITSLAG. Deze module keert nooit stil terug: lukt de
   bezorging niet, dan zegt hij waarom. Dat is de hele les van de bevinding die
   hem opleverde -- `return` zonder woorden is hoe een melding verdwijnt.
   ========================================================================== */
'use strict';

module.exports = (ctx) => {
  const { G, isGast, eigenVeld, rid, nu, schoon, encS, save } = ctx;

  /* De afzender van het huis. Een profiel-id komt uit rid(4) en is hex; 'rtg'
     kan er dus nooit een zijn, en `berichtVoorMij` kan hem nooit als de
     ontvanger zelf aanzien. */
  const VAN_RTG = 'rtg';

  /* Bezorg een bericht van RTG bij EEN gezinslid.
     Geeft { ok: true, berichtId } of { ok: false, reden } -- nooit niets. */
  function aanGezinslid({ code, profielId, tekst, naam }) {
    const g = G()[String(code || '').toUpperCase()];
    if (!g) return { ok: false, reden: 'gezin-onbekend' };
    const p = eigenVeld(g.profielen, String(profielId || ''));
    if (!p) return { ok: false, reden: 'profiel-onbekend' };
    if (isGast(p)) return { ok: false, reden: 'gast-krijgt-dit-niet' };
    const schoonTekst = schoon(tekst, 800);
    if (!schoonTekst) return { ok: false, reden: 'geen-tekst' };

    const b = {
      id: rid(3), van: VAN_RTG, vanNaam: schoon(naam, 40) || 'RTG', vanAvatar: 'pas',
      naar: p.id, soort: 'bericht', tekst: encS(schoonTekst), at: nu(), gelezenDoor: []
    };
    if (!Array.isArray(g.berichten)) g.berichten = [];
    g.berichten.unshift(b);
    g.berichten = g.berichten.slice(0, 200);
    save();
    /* MET OPZET GEEN bezorgAanGasten: dat stuurt het bericht door naar elke
       gekoppelde oppas of opa/oma in hun eigen RTG-app. Een gezinsbericht aan
       'allen' hoort daar; dit is persoonlijk. Zie regel 1 hierboven. */
    return { ok: true, berichtId: b.id };
  }

  return { aanGezinslid, VAN_RTG };
};
