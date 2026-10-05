/* RTFoundation (deelmodule): EEN BESTAAND GEZIN MEENEMEN (DPIA-GEZIN.md R-G8).

   Een gezin van voor 5 oktober 2026 hangt aan niets, en onder de
   accountplicht opent het niets meer. De beheerder neemt het mee naar zijn
   account met precies wat de gezinsdeur (./gezinstoegang.js, B18) vraagt: de
   gezinscode (128 bits, als hash opgezocht en bij gebruik geclaimd) plus zijn
   EIGEN pincode. Alleen de beheerder: een kind of gezinslid bepaalt niet aan
   wiens account het hele gezin komt te hangen. De rem is per account en per
   gezin, zodat de code plus honderd pincodes niet vanaf een account te raden
   is.

   Wat er NIET gebeurt: geen tweede eigenaar (een gezin met een eigenaar is al
   meegenomen), geen tweede gezin aan dit account, en de kinderen gaan pas
   open als de nieuwe eigenaar volwassen() is -- dat rekent profielVan. */
'use strict';

module.exports = (gctx, { accountGezin, overzicht }) => {
  const { G, save, nu, pubProfiel, gezinstoken, gezinscode, checkPin, geldigePin, eigenVeld,
    teVaak, misluktePoging, goedePoging } = gctx;

  async function koppel({ userId, codenaam, leeftijd, raw, pin }, res) {
    if (userId == null) return { status: 403, error: 'Log in met je eigen RTG-account.' };
    if (leeftijd == null || leeftijd < 18) return { status: 403, error: 'Een gezin meenemen kan vanaf 18 jaar.' };
    if (accountGezin(userId)) return { status: 409, error: 'Je hebt al een gezin aan dit account.' };
    const remAcc = 'koppel:' + userId;
    if (teVaak(res, remAcc)) return null;
    const FOUT = { status: 403, error: 'De gezinscode of pincode klopt niet.' };
    const code = raw && gezinscode.vind(raw), g = code && eigenVeld(G(), code);
    if (!g || !geldigePin(pin)) { misluktePoging(remAcc, 6, 15); return FOUT; }
    const remGezin = 'gezin:' + g.code;
    if (teVaak(res, remGezin)) return null;
    let p = null;
    for (const x of Object.values(g.profielen || {}))
      if (x.rol === 'beheerder' && x.pin && await checkPin(x.pin, pin)) { p = x; break; }
    if (!p) { misluktePoging(remAcc, 6, 15); misluktePoging(remGezin, 10, 15); return FOUT; }
    if (g.eigenaar) return { status: 409, error: 'Dit gezin hangt al aan een RTG-account.' };
    if (!await gezinscode.claim(raw, g.code)) return FOUT;
    goedePoging(remAcc);
    const nuG = eigenVeld(G(), g.code), pp = nuG && eigenVeld(nuG.profielen, p.id);
    if (!pp || nuG.eigenaar) return { status: 409, error: 'Dit gezin hangt al aan een RTG-account.' };
    nuG.eigenaar = { userId, codenaam: codenaam || null, at: nu(), via: 'meegenomen' };
    pp.account = { userId, at: nu() };
    const token = gezinstoken.geef(nuG, pp); save();
    return Object.assign(overzicht(nuG, userId), { code: nuG.code, token, profiel: pubProfiel(pp, true) });
  }

  return koppel;
};
