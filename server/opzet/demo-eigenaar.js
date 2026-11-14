/* De demo-eigenaar, als een idempotente opstartbewerking.

   Dit stond in server.js en was daardoor alleen te beproeven door meerdere
   VOLLEDIGE RTG-servers te starten. De eigenlijke verantwoordelijkheid is veel
   kleiner: zorg dat exact een eigenaarsaccount bestaat, herstel zijn bekende
   demo-eigenschappen en koppel zijn twee werkrollen.

   Meerdere processen mogen dit tegelijk doen. Verliest een proces de race op
   een unieke users-sleutel, dan leest het een keer opnieuw. Iedere andere fout
   blijft fataal. De aanroeper bepaalt of de demostand actief is; deze module
   opent zelf nooit een productiedeur. */
'use strict';

module.exports = function maakDemoEigenaar({
  accounts, eigenaar, rollenVoor, zaakVoor, save, demoLidInhoud, env
}) {
  const omgeving = env || process.env;

  function zetEens() {
    const wachtwoord = omgeving.DEMO_PASS || 'Imran';
    let u = accounts.findByLogin(eigenaar.OWNER_EMAIL);
    if (!u) {
      /* De seed-persona kan de inlognaam Rahul al dragen. Verhuis die dan naar
         het eigenaarsadres; een tweede Rahul aanmaken zou terecht botsen. */
      const bestaand = accounts.findByLogin('Rahul');
      if (bestaand) {
        u = accounts.renameUser(bestaand.id, {
          username: 'Rahul', realName: 'Rahul Imran Ismail', email: eigenaar.OWNER_EMAIL
        });
      } else {
        u = accounts.createUserZaai({ username: 'Rahul', email: eigenaar.OWNER_EMAIL,
          password: wachtwoord, tier: 'business', realName: 'Rahul Imran Ismail', phone: '+31612345678' });
        accounts.saveMemberState(u.id, demoLidInhoud());
      }
    } else if (accounts.realNameOf(u) !== 'Rahul Imran Ismail') {
      u = accounts.renameUser(u.id, { username: 'Rahul', realName: 'Rahul Imran Ismail' });
    }

    /* Ook een bestaand account krijgt de bekende demo-toestand terug. Dit
       draait uitsluitend achter de DEMO-grens in server.js. */
    accounts.setPasswordZaai(u.id, wachtwoord);
    accounts.setVerification(u.id, 'verified');

    const sleutelbos = rollenVoor(u.id);
    if (!sleutelbos.some(r => r.rol === 'kantoor'))
      sleutelbos.push({ rol: 'kantoor', at: new Date().toISOString() });
    if (!sleutelbos.some(r => r.rol === 'zaak')) {
      const code = String(omgeving.DEMO_SUPPLIER || 'KIKUNOI').toUpperCase();
      const zaak = zaakVoor(code);
      sleutelbos.push({ rol: 'zaak', code, zaakNaam: zaak ? zaak.name : code, naam: 'Beheer', at: new Date().toISOString() });
    }
    save();
    return u;
  }

  return function zetEigenaarsAccount() {
    try { return zetEens(); }
    catch (e) {
      const bericht = String((e && e.message) || e);
      if (!/UNIQUE constraint failed: users\./.test(bericht)) throw e;
      return zetEens();
    }
  };
};
