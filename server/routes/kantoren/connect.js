/* Kantoren, deel "connect": partnerafrekeningen over Stripe Connect
   (server/betaal/connect/), vanuit de boardroom.

     lezen       de afrekeningen en de bevindingen van de reconciliatie
     aanvragen   een afrekening aanvragen en indienen bij Stripe: een mens op
                 naam (uit de sessie), een verse passkey ZONDER terugval, en de
                 vrijgavepoort op `geld.partnerafrekening` EN
                 `geld.provider.stripe_connect`
     veeg        de stand van wat onderweg is ophalen en de reconciliatie
                 draaien. Geen passkey: dit maakt niets nieuws, het kijkt -- en
                 wat bleef hangen wordt alleen opnieuw ingediend als de
                 vrijgavepoort het nu toestaat, met dezelfde sleutel.

   WAT HIER NOG NIET STAAT, en het hoort er wel: de tweede handtekening
   (kern/kantoor/tweedehandtekening.js). Vandaag is deze route dicht door de
   vrijgavepoort (geen bewijs, geen besluit, standaard uit) en door de ontbrekende
   grootboekkoppeling; vóór iemand hem opent, hoort er een tweede mens onder.
   Dat staat als integratiepunt in het eindverslag. */
'use strict';
const { wie: envelopWie } = require('../../opzet/envelop');

module.exports = (ctx) => {
  const { app, boardroomAuth, veilig, afdelingen, db, save, zwaar, boardroomUser } = ctx;
  const connect = () => require('../../betaal/connect').standaard({ db, save,
    audit: (wie, wat) => afdelingen.audit(wie, wat) });
  /* Een fout uit de connectlaag of de vrijgavepoort als antwoord, zonder de
     interne reden: die staat in het log en op het vrijgavebord. */
  const alsAntwoord = e => ({ status: e.status || 500, error: e.status ? e.message : 'Er ging iets mis.',
    code: e.vrijgaveCode || e.code || null });

  app.post('/api/office/connect/afrekeningen', boardroomAuth, (req, res) => veilig(res, () =>
    ({ status: 200, ok: true, ...connect().lijst() })));

  app.post('/api/office/connect/afrekening', boardroomAuth, async (req, res) => {
    const b = req.body || {};
    const zw = await zwaar.eis(boardroomUser(req), 'connect.afrekening', zwaar.sessieSleutel(req), req,
      'Een partnerafrekening naar een verbonden account', { zonderTerugval: true });
    if (!zw.ok) return zwaar.stuur(res, zw);
    /* Niet via `veilig`: die geeft bij een fout alleen de tekst door, en de
       veilige code (tijdelijk-uit, compliance-ontbreekt, ...) is precies wat
       het scherm nodig heeft om het juiste te zeggen. */
    try {
      const a = connect().aanvragen({ id: String(b.id || ''), partner: b.partner, account: String(b.account || ''),
        centen: Number(b.centen), valuta: b.valuta ? String(b.valuta) : undefined, wie: envelopWie(req), reden: b.reden });
      const rec = await connect().indienen(a.afrekening.id);
      return res.json({ ok: true, herhaald: a.herhaald, afrekening: rec });
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
