/* Uitvoeren en herstellen van een voorbereide belofte-afronding.
   Alleen beloften, automatiseringen en hun bestaande audit/schrijfpoorten;
   geen rollen, goedkeuringen of projecten. De router en governance blijven
   verantwoordelijk voor bevoegdheden; deze module bewaakt de toestanden. */
module.exports = (ctx) => {
  const { S, geldigHuis, vind, id, tekst, nu, log, save } = ctx;
  function automatiseringVoorbereid(body, actor) {
    const s = S(), huis = geldigHuis(body.huis), doel = vind(s.beloften, body.belofteId);
    if (!doel || !(doel.huis === huis || doel.huis === 'gedeeld')) return { status: 404, error: 'Belofte niet gevonden.' };
    if (doel.status !== 'open') return { status: 400, error: 'Alleen een open belofte kan veilig worden afgerond.' };
    const x = { id: id('aut-'), huis, soort: 'belofte-afronden', objectId: doel.id, status: 'voorbereid',
      voor: { status: doel.status }, na: { status: 'afgerond' }, herstelTot: nu() + 72 * 3600000, door: tekst(actor, 80), at: nu() };
    s.automatiseringen.unshift(x); log(actor, 'automatisering-voorbereid', x.id, huis); save(); return { ok: true, automatisering: x };
  }
  function automatiseringVoer(idRuw, actor) {
    const s = S(), a = vind(s.automatiseringen, idRuw); if (!a) return { status: 404, error: 'Automatisering niet gevonden.' };
    if (a.status !== 'voorbereid') return { status: 400, error: 'Deze automatisering kan niet worden uitgevoerd.' };
    const doel = vind(s.beloften, a.objectId); if (!doel) return { status: 404, error: 'Doel bestaat niet meer.' };
    doel.status = a.na.status; doel.afgerondAt = nu(); a.status = 'uitgevoerd'; a.uitgevoerdAt = nu();
    log(actor, 'automatisering-uitgevoerd', a.id, a.huis); save(); return { ok: true, automatisering: a, belofte: doel };
  }
  function automatiseringHerstel(idRuw, actor) {
    const s = S(), a = vind(s.automatiseringen, idRuw); if (!a) return { status: 404, error: 'Automatisering niet gevonden.' };
    if (a.status !== 'uitgevoerd' || nu() > a.herstelTot) return { status: 400, error: 'Deze wijziging kan niet meer worden teruggedraaid.' };
    const doel = vind(s.beloften, a.objectId); if (!doel) return { status: 404, error: 'Doel bestaat niet meer.' };
    doel.status = a.voor.status; delete doel.afgerondAt; a.status = 'teruggedraaid'; a.terugAt = nu();
    log(actor, 'automatisering-teruggedraaid', a.id, a.huis); save(); return { ok: true, automatisering: a, belofte: doel };
  }
  return { automatiseringVoorbereid, automatiseringVoer, automatiseringHerstel };
};
