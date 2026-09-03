/* DE ONTSLUITCEREMONIE VAN EEN LID -- de weg naar beneden, en alleen die.

   WAAROM DIT LOS STAAT VAN ./isolatie.js. Dat bestand gaat over de STAND: wat
   staat er, en strenger zetten. Dit gaat over het PROTOCOL waarmee die stand
   omlaag kan. Dat zijn twee dingen die om verschillende redenen schuiven -- de
   ene met een nieuwe drager, de andere met een nieuwe eis -- en samen in een
   bestand ging het over de leesgrens van 10 KB. De naad zit dus niet bij de
   omvang maar bij het onderwerp: verstrengen is een handeling, verlagen is een
   ceremonie.

   WAT HIER NIEUW IS EN WAAROM HET ERTOE DOET. De stap `passkey` werd afgetekend
   met een vrije tekst uit het verzoekslijf. Wie een sessie had overgenomen,
   tekende de zwaarste eis van deze laag dus af met het woord "proef". Nu vraagt
   het lid eerst een WebAuthn-ceremonie aan die aan DIT verzoek en aan DEZE stap
   gebonden is (kern/isolatie/stapbewijs.js), en pas een geverifieerde assertie
   levert een aftekening op. `b.bewijs` uit het lijf wordt nergens meer gelezen.

   DE WEBAUTHN-GRENS KOMT UIT APP_URL EN NOOIT UIT EEN KOP. Letterlijk dezelfde
   afspraak als routes/rtgid.js en routes/auth/webauthn.js: zou de origin uit de
   Origin- of Host-kop komen, dan kiest de aanvrager zijn eigen grens en is de
   binding een formaliteit. */
'use strict';

const maakStapbewijs = require('../kern/isolatie/stapbewijs');

module.exports = ({ app, kern, auth, isolatie, eigenLagen, laagOf, mijnSleutels, actor, faal }) => {

  const bewijsdeel = maakStapbewijs({
    stapOpOpties: (...a) => kern.webauthnStapOpOpties(...a),
    stapOpMaak: (...a) => kern.webauthnStapOpMaak(...a)
  });

  const oorsprong = req => { try { return new URL(kern.appUrl(req)).origin; } catch (e) { return ''; } };
  const gastheer = req => { try { return new URL(oorsprong(req)).hostname; } catch (e) { return req.hostname; } };

  /* KAN DIT ACCOUNT UBERHAUPT EEN PASSKEY LEVEREN? Geteld, nooit uit het
     verzoek. Een eis die de aanvrager niet kan halen, sluit hem permanent buiten
     zijn eigen bescherming -- en dat is erger dan wat de eis moest voorkomen.
     Bestaat er geen passkey, dan valt de eis weg en wordt de ontsluiting een
     NOODONTSLUITING: gemerkt, gemeld, en in het spoor. */
  function passkeyMogelijk(req) {
    const u = req.session && req.session.account;
    return !!(u && kern.webauthnAantal(u) > 0);
  }

  /* DE STAP EN DE COMMIT MOETEN OVER EEN VERZOEK VAN DIT LID GAAN. Zonder deze
     controle kan een lid met een geraden nummer de ceremonie van iemand anders
     aftekenen -- en dat is precies de aanval waar deze hele laag tegen is. */
  function mijnVerzoek(req, id) {
    const v = isolatie.ontsluiting.vind(id);
    const sleutels = Object.values(mijnSleutels(req)).filter(Boolean);
    if (!v || !eigenLagen.includes(v.drager) || !sleutels.includes(v.sleutel)) {
      const e = new Error('Onbekende ontsluiting.');   // met opzet hetzelfde antwoord als "bestaat niet"
      e.status = 404; throw e;
    }
    return v;
  }

  app.post('/api/isolatie/mijn/ontsluiting', auth, (req, res) => {
    const b = req.body || {};
    try {
      const drager = String(b.drager || 'identiteit');
      res.json({ ok: true, verzoek: isolatie.vraagOntsluiting({ drager, sleutel: laagOf(req, drager),
        naar: b.naar, door: actor(req), reden: b.reden, passkeyMogelijk: passkeyMogelijk(req) }) });
    } catch (e) { faal(res, e); }
  });

  /* DE BEVESTIGING AANVRAGEN. Eerst het eigendom, dan pas een ceremonie: een
     geraden nummer levert geen challenge op. */
  app.post('/api/isolatie/mijn/ontsluiting/stap/opties', auth, async (req, res) => {
    const b = req.body || {};
    try {
      const v = mijnVerzoek(req, b.id);
      const r = await bewijsdeel.opties({ user: req.session.account, verzoek: v,
        soort: b.soort, hostnaam: gastheer(req) });
      if (r.geenPasskey) return res.status(409).json({ error: r.error, geenPasskey: true });
      if (r.status !== 200) return res.status(r.status).json({ error: r.error });
      res.json({ ok: true, opties: r.opties, ceremonie: r.ceremonie });
    } catch (e) { faal(res, e); }
  });

  app.post('/api/isolatie/mijn/ontsluiting/stap', auth, async (req, res) => {
    const b = req.body || {};
    try {
      const v = mijnVerzoek(req, b.id);
      /* HET BEWIJS KOMT NOOIT MEER UIT HET LIJF. Vraagt de stap een passkey, dan
         wordt die hier echt geverifieerd; vraagt hij er geen, dan schrijft de
         route de vaste reden uit het stappenregister in plaats van vrije tekst
         die de aanvrager zelf koos. */
      const soort = String(b.soort || '');
      const bewijs = bewijsdeel.vraagtBewijs(soort)
        ? await bewijsdeel.controleer({ user: req.session.account, verzoek: v, soort,
            ceremonie: b.ceremonie, antwoord: b.antwoord, origin: oorsprong(req), hostnaam: gastheer(req) })
        : 'niet bewezen: ' + bewijsdeel.waaromGeenBewijs(soort);
      res.json({ ok: true, verzoek: isolatie.ontsluiting.stap(b.id, { soort, door: actor(req), bewijs }) });
    } catch (e) { faal(res, e); }
  });

  app.post('/api/isolatie/mijn/ontsluiting/commit', auth, (req, res) => {
    const b = req.body || {};
    try {
      mijnVerzoek(req, b.id);
      res.json({ ok: true, uit: isolatie.voltooiOntsluiting(b.id, { door: actor(req) }) });
    } catch (e) { faal(res, e); }
  });

  app.post('/api/isolatie/mijn/ontsluiting/afbreken', auth, (req, res) => {
    const b = req.body || {};
    try {
      mijnVerzoek(req, b.id);
      res.json({ ok: true, verzoek: isolatie.ontsluiting.afbreken(b.id,
        { door: actor(req), reden: b.reden }) });
    } catch (e) { faal(res, e); }
  });

  return { mijnVerzoek, passkeyMogelijk };
};
