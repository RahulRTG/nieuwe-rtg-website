/* Kantoren, deel "connect": partnerafrekeningen over Stripe Connect
   (server/betaal/connect/), vanuit de boardroom.

     lezen       de afrekeningen en de bevindingen van de reconciliatie
     aanvragen   een mens op naam (uit de sessie), een verse passkey ZONDER
                 terugval, en de vrijgavepoort op `geld.partnerafrekening` EN
                 `geld.provider.stripe_connect`. Dat levert nog GEEN afrekening
                 op maar een AANVRAAG voor een tweede handtekening.
     bevestigen  een TWEEDE mens, met een eigen kantooraccount en een passkey, op
                 het gedeelde loket /api/office/bank/handtekening/bevestig
                 (kern/kantoor/tweedehandtekening.js). Pas dan wordt de afrekening
                 aangemaakt, het partnersaldo gereserveerd en bij Stripe
                 ingediend -- en de vrijgavepoort wordt dan OPNIEUW gevraagd: een
                 noodstop tussen aanvraag en bevestiging houdt hem tegen.
     veeg        de stand van wat onderweg is ophalen en de reconciliatie
                 draaien. Geen passkey: dit maakt niets nieuws, het kijkt -- en
                 wat bleef hangen wordt alleen opnieuw ingediend als de
                 vrijgavepoort het nu toestaat, met dezelfde sleutel.

   WAAROM DE POORT AL BIJ DE AANVRAAG. Een aanvraag die toch niet uitgevoerd kan
   worden, laat een collega voor niets tekenen; en een geweigerde aanvraag mag
   niets achterlaten (geen record, geen open handtekening). */
'use strict';
const { wie: envelopWie } = require('../../opzet/envelop');

module.exports = (ctx) => {
  const { app, boardroomAuth, veilig, afdelingen, db, save, zwaar, boardroomUser, tweedeHand } = ctx;
  const connect = () => require('../../betaal/connect').standaard({ db, save,
    audit: (wie, wat) => afdelingen.audit(wie, wat) });
  /* Een fout uit de connectlaag of de vrijgavepoort als antwoord, zonder de
     interne reden: die staat in het log en op het vrijgavebord. */
  const alsAntwoord = e => ({ status: e.status || 500, error: e.status ? e.message : 'Er ging iets mis.',
    code: e.vrijgaveCode || e.code || null });

  app.post('/api/office/connect/afrekeningen', boardroomAuth, (req, res) => veilig(res, () =>
    ({ status: 200, ok: true, ...connect().lijst() })));

  /* WAT DE TWEEDE MENS UITVOERT. Het lijf is bevroren bij de aanvraag
     (kern/kantoor/tweedehandtekening.js); de bevestiger stuurt er geen. De
     afrekening staat op naam van de AANVRAGER en draagt de bevestiger erbij. */
  if (tweedeHand) tweedeHand.registreer('connect.afrekening', {
    wat: 'een partnerafrekening naar een verbonden Stripe-account', geld: true,
    voerUit: async (lijf, wie) => {
      try {
        const a = await connect().aanvragen(Object.assign({}, lijf, { wie: wie && wie.aangevraagdDoor,
          bevestigdDoor: wie && wie.bevestigdDoor }));
        const rec = await connect().indienen(a.afrekening.id);
        return { ok: true, herhaald: a.herhaald, afrekening: rec };
      } catch (e) {
        if (!e.status && !e.code) { console.error('[kantoren/connect]', e); return { status: 500, error: 'Er ging iets mis.' }; }
        const r = alsAntwoord(e);
        return { status: r.status, error: r.error, code: r.code };
      }
    }
  });

  app.post('/api/office/connect/afrekening', boardroomAuth, async (req, res) => {
    const b = req.body || {};
    const zw = await zwaar.eis(boardroomUser(req), 'connect.afrekening', zwaar.sessieSleutel(req), req,
      'Een partnerafrekening naar een verbonden account', { zonderTerugval: true });
    if (!zw.ok) return zwaar.stuur(res, zw);
    /* Niet via `veilig`: die geeft bij een fout alleen de tekst door, en de
       veilige code (tijdelijk-uit, compliance-ontbreekt, ...) is precies wat
       het scherm nodig heeft om het juiste te zeggen. */
    try {
      const lijf = { id: String(b.id || ''), partner: b.partner == null ? '' : String(b.partner),
        account: String(b.account || ''), centen: Number(b.centen),
        valuta: b.valuta ? String(b.valuta) : undefined, reden: b.reden == null ? '' : String(b.reden).slice(0, 300) };
      const c = connect();
      /* Een afrekening die al bestaat: hetzelfde antwoord als de eerste keer (of
         een botsing als de gegevens verschillen), zonder nieuwe handtekening. */
      const bestaand = c.opslag.haal(lijf.id);
      if (bestaand) {
        const a = await c.aanvragen(Object.assign({}, lijf, { wie: req.officeKey }));
        return res.json({ ok: true, herhaald: true, afrekening: a.afrekening });
      }
      c.keurAanvraag(Object.assign({}, lijf, { wie: req.officeKey }));
      c.poort({ recht: true, actor: { soort: 'kantoor', wie: req.officeKey } });
      if (!tweedeHand) return res.status(503).json({ error: 'De tweede handtekening is niet ingericht; er is niets aangevraagd.' });
      const v = tweedeHand.vraag({ actie: 'connect.afrekening', lijf,
        onderwerp: 'afrekening ' + lijf.id + ' (' + lijf.centen + ' ' + (lijf.valuta || 'eur') + ' naar ' + lijf.account + ')',
        door: req.officeKey });
      if (!v.ok) return res.status(v.status || 409).json(v);
      afdelingen.audit(req.officeKey, 'Partnerafrekening ' + lijf.id + ' aangevraagd; wacht op een tweede handtekening');
      return res.status(202).json(v);
    } catch (e) {
      if (!e.status && !e.code) { console.error('[kantoren/connect]', e); return res.status(500).json({ error: 'Er ging iets mis.' }); }
      const r = alsAntwoord(e);
      return res.status(r.status).json({ error: r.error, code: r.code });
    }
  });

  app.post('/api/office/connect/veeg', boardroomAuth, (req, res) => veilig(res, async () => {
    const v = await connect().veeg();
    const r = await connect().reconciliatie();
    return { status: 200, ok: true, veeg: v, reconciliatie: r };
  }));
};
