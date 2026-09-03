/* Techniek (deelmodule): DE ONTSLUITCEREMONIE VAN DE COCKPIT.

   WAAROM LOS VAN ./isolatie.js. Zelfde naad als aan de ledenkant
   (routes/isolatie-ceremonie.js): dat bestand gaat over de STAND -- wat staat er,
   en strenger zetten -- en dit over het PROTOCOL waarmee die stand omlaag kan.
   Twee onderwerpen die om verschillende redenen schuiven, en samen boven de
   leesgrens van 10 KB.

   VIER GEBEURTENISSEN EN NIET EEN. Het verzoek, de stappen, de commit en het
   afbreken zijn vier dingen. Ze samenvouwen tot een enkele "ontsluit"-aanroep
   met een lijst bewijzen erin zou precies het ding maken dat deze laag wil
   voorkomen: een verlaging die in een keer gebeurt.

   TWEE GEGEVENS WORDEN GETELD EN NOOIT GEVRAAGD. Of er een tweede mens is en of
   dit account een passkey heeft, bepalen samen hoe zwaar de ceremonie is. Zou de
   aanvrager ze mogen meesturen, dan kiest hij zelf hoeveel bewijs hij levert --
   en dan is de zwaarste eis van de hele laag een instelling. */
'use strict';

const maakStapbewijs = require('../../kern/isolatie/stapbewijs');

module.exports = ({ app, kern, isolatie, appUrl, techAuth, eigenaarAlleen, actor, tweedeMensBestaat, faal }) => {

  /* HEEFT DEZE EIGENAAR EEN PASSKEY? Geteld naast `tweedeMensBestaat` en om
     dezelfde reden: een eis die de aanvrager niet kan halen maakt het platform
     na een incident ONHERSTELBAAR, en dat is erger dan wat de eis moest
     voorkomen. Het gegeven komt nooit uit het verzoek. */
  function passkeyMogelijk(req) {
    const u = req.techUser;
    return !!(u && typeof kern.webauthnAantal === 'function' && kern.webauthnAantal(u) > 0);
  }

  /* HET ECHTE BEWIJS onder de stap `passkey`. Dezelfde module als aan de
     ledenkant, met dezelfde doel-binding: de techniek-inlog geeft een gewoon
     accounttoken uit, dus dezelfde passkeys werken hier. */
  const bewijsdeel = maakStapbewijs({
    stapOpOpties: (...a) => kern.webauthnStapOpOpties(...a),
    stapOpMaak: (...a) => kern.webauthnStapOpMaak(...a)
  });
  const oorsprong = req => { try { return new URL(appUrl(req)).origin; } catch (e) { return ''; } };
  const gastheer = req => { try { return new URL(oorsprong(req)).hostname; } catch (e) { return req.hostname; } };

  function verzoekOf(id) {
    const v = isolatie.ontsluiting.vind(id);
    if (!v) { const e = new Error('Onbekend ontsluitverzoek.'); e.status = 404; throw e; }
    return v;
  }

  app.post('/api/techniek/isolatie/ontsluiting', techAuth, eigenaarAlleen, (req, res) => {
    const b = req.body || {};
    try {
      const gedeeld = { naar: b.naar, door: actor(req), reden: b.reden,
        tweedeMens: tweedeMensBestaat(req), passkeyMogelijk: passkeyMogelijk(req) };
      /* Het HUIS heeft een eigen ingang omdat zijn stand niet in deze laag
         woont maar in de incidentcontrole. De ceremonie is wel dezelfde, en dat
         is het punt: een tweede ceremonie naast de eerste zou binnen een jaar
         iets anders eisen. */
      res.json({ ok: true, verzoek: b.drager === 'huis'
        ? isolatie.vraagHuisOntsluiting(Object.assign({ van: b.van }, gedeeld))
        : isolatie.vraagOntsluiting(Object.assign({ drager: b.drager, sleutel: b.sleutel }, gedeeld)) });
    } catch (e) { faal(res, e); }
  });

  /* DE BEVESTIGING AANVRAGEN, voor de stap die er echt een vraagt. */
  app.post('/api/techniek/isolatie/ontsluiting/stap/opties', techAuth, eigenaarAlleen, async (req, res) => {
    const b = req.body || {};
    try {
      const v = verzoekOf(b.id);
      const r = await bewijsdeel.opties({ user: req.techUser, verzoek: v, soort: b.soort, hostnaam: gastheer(req) });
      if (r.geenPasskey) return res.status(409).json({ error: r.error, geenPasskey: true });
      if (r.status !== 200) return res.status(r.status).json({ error: r.error });
      res.json({ ok: true, opties: r.opties, ceremonie: r.ceremonie });
    } catch (e) { faal(res, e); }
  });

  app.post('/api/techniek/isolatie/ontsluiting/stap', techAuth, eigenaarAlleen, async (req, res) => {
    const b = req.body || {};
    try {
      const v = verzoekOf(b.id);
      /* HET BEWIJS KOMT NIET MEER UIT HET LIJF. Vraagt de stap een passkey, dan
         wordt die echt geverifieerd en aan DIT verzoek en DEZE stap gebonden;
         vraagt hij er geen, dan schrijft de route de vaste reden uit het
         stappenregister in plaats van vrije tekst die de aanvrager koos. */
      const soort = String(b.soort || '');
      const bewijs = bewijsdeel.vraagtBewijs(soort)
        ? await bewijsdeel.controleer({ user: req.techUser, verzoek: v, soort,
            ceremonie: b.ceremonie, antwoord: b.antwoord, origin: oorsprong(req), hostnaam: gastheer(req) })
        : 'niet bewezen: ' + bewijsdeel.waaromGeenBewijs(soort);
      res.json({ ok: true, verzoek: isolatie.ontsluiting.stap(b.id,
        { soort, door: actor(req), bewijs }) });
    } catch (e) { faal(res, e); }
  });

  app.post('/api/techniek/isolatie/ontsluiting/commit', techAuth, eigenaarAlleen, (req, res) => {
    try {
      res.json({ ok: true, uit: isolatie.voltooiOntsluiting((req.body || {}).id, { door: actor(req) }) });
    } catch (e) { faal(res, e); }
  });

  app.post('/api/techniek/isolatie/ontsluiting/afbreken', techAuth, eigenaarAlleen, (req, res) => {
    const b = req.body || {};
    try {
      res.json({ ok: true, verzoek: isolatie.ontsluiting.afbreken(b.id,
        { door: actor(req), reden: b.reden }) });
    } catch (e) { faal(res, e); }
  });

};
