/* De uitdrukkelijke medische intake-deling: bijwerken en intrekken.
   Krijgt alleen de intakecollectie en noodzakelijke functies; geen boekingen,
   betaalbediening of volledige Care-context. De veldkluis blijft eigenaar
   van versleuteling en de bestaande ledenlaag behoudt haar publieke contract. */
module.exports = ({ intakes, save, crypto, schoon, notify, nu, INTAKE_DAGEN,
  lijsten, aanbiederVan, intakeActief, kluisje }) => {
  function careIntakeDeel(key, aanbiederIdIn, medischIn) {
    lijsten();
    const a = aanbiederVan(aanbiederIdIn);
    if (!a) return { status: 404, error: 'Zorgaanbieder niet gevonden.' };
    const medisch = schoon(medischIn, 600);
    if (!medisch) return { status: 400, error: 'Vul in wat de behandelaar moet weten.' };
    // een lopende intake bijwerken in plaats van stapelen
    let i = intakeActief(key, a.id);
    const id = i ? i.id : crypto.randomBytes(4).toString('hex');
    /* DICHT FALEN: kan het niet versleuteld, dan wordt er niets bewaard. */
    let dicht;
    try { dicht = kluisje.sluit(medisch, 'intake|' + id + '|' + key); }
    catch (e) { return { status: 503, error: 'Uw medische context kan nu niet veilig worden bewaard. Er is niets gedeeld; probeer het straks opnieuw.' }; }
    if (!i) {
      i = { id, key, aanbiederId: a.id, aanbiederNaam: a.naam, status: 'actief', at: nu() };
      intakes().push(i);
    }
    i.medisch = dicht;
    i.vervaltOp = new Date(Date.now() + INTAKE_DAGEN * 86400000).toISOString().slice(0, 10);
    save();
    notify(key, { icon: 'zorg', title: 'Intake gedeeld met ' + a.naam, body: 'Uw medische context is beschikbaar voor ' + a.naam + ' tot ' + i.vervaltOp + '. U kunt dit altijd stoppen.', scope: 'care' });
    return { ok: true, intake: { id: i.id, aanbiederNaam: a.naam, vervaltOp: i.vervaltOp } };
  }
  function careIntakeStop(key, idIn) {
    lijsten();
    const i = intakes().find(x => x.id === String(idIn || '') && x.key === key && x.status === 'actief');
    if (!i) return { status: 404, error: 'Deze deling is er niet (meer).' };
    i.status = 'gestopt';
    i.gestoptOp = nu();
    save();
    return { ok: true, gestopt: i.aanbiederNaam };
  }

  return { careIntakeDeel, careIntakeStop };
};
