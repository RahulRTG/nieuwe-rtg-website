/* RTG Werk OS (deellaag): de weg van een ledenaccount naar een werkruimte.

   HET GAT DAT DIT DICHT. De laag was volledig -- en onbereikbaar. Een
   werkruimte heeft zijn eigen sleutel (code + lid-token), en die krijg je
   alleen als iemand hem je geeft. Voor de EIGENAAR van het platform is dat
   onzin: er was geen mens om het aan te vragen, dus stond de werkplek er wel
   maar kwam er niemand in. "Ik zie geen werkplek in mijn account" was dus geen
   vergissing van de kijker maar een ontbrekende deur.

   WAT HIER GEBEURT

   1. IEDER LID ZIET ZIJN EIGEN WERKRUIMTES. Wie zijn RTG-account eerder aan
      een werkruimte koppelde (bedrijf/aansluiting.js), krijgt die hier terug
      met zijn eigen lid-token -- zodat het scherm hem meteen kan openen in
      plaats van om een token te vragen dat hij nergens kan vinden.
   2. DE EIGENAAR KRIJGT ZIJN EIGEN WERKRUIMTE, EEN KEER. Bestaat die nog niet,
      dan wordt hij hier aangemaakt met de eigenaar als directie. Idempotent:
      een tweede aanroep maakt geen tweede werkruimte, en een bestaand
      lidmaatschap wordt niet overschreven.

   WAT HIER MET OPZET NIET GEBEURT

   - NIEMAND ANDERS KRIJGT IETS AUTOMATISCH. Alleen het account dat volgens
     eigenaar.js de eigenaar IS (op e-mailadres, uit de kluis, en dus
     meebewegend met een overdracht) krijgt een werkruimte cadeau. Voor ieder
     ander blijft de regel staan die deze laag draagt: aanmelden is niet
     binnen zijn, en een mens laat je toe.
   - HET BEHEER-TOKEN REIST NIET MEE. Ook de eigenaar krijgt zijn lid-token en
     niet de hoofdsleutel van de werkruimte; die wordt bij het aanmaken EEN
     keer getoond. Een sleutel die bij elke aanroep opnieuw over de lijn gaat,
     is geen sleutel meer. */
'use strict';

module.exports = (sctx) => {
  const { app, save, nu, rid, W, kern } = sctx;
  const { auth, accounts, eigenaar, crypto } = kern;

  // de werkruimte van de eigenaar: gevonden op een vlag, niet op een naam
  const eigenaarsRuimte = () => Object.values(W()).find(w => w.eigenaarsRuimte) || null;

  function lidVoor(w, key) {
    return Object.values(w.leden || {}).find(l => l.rtgKey === key && l.status === 'actief') || null;
  }

  function codenaamVan(sessie) {
    if (sessie && sessie.account && sessie.account.codename) return sessie.account.codename;
    const p = kern.PERSONAS && sessie ? kern.PERSONAS[sessie.tier] : null;
    return p ? p.codename : null;
  }

  app.post('/api/bedrijf/mijn', auth, (req, res) => {
    const key = req.session.key;
    if (!key) return res.status(403).json({ error: 'Geen RTG-sessie gevonden.' });

    let baas = false;
    try { baas = eigenaar.isEigenaar(accounts, req.session.account); } catch (e) { baas = false; }

    /* De eigenaar zonder werkruimte krijgt er een. Een keer, met hemzelf als
       directie erin, en daarna nooit meer -- de vlag `eigenaarsRuimte` is de
       enige plek waar dat aan hangt. */
    let gemaakt = null;
    if (baas) {
      let w = eigenaarsRuimte();
      if (!w) {
        const code = (() => { let c; do { c = 'W' + crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5); } while (W()[c]); return c; })();
        w = { code, naam: 'Rahul Travel Group', land: 'NL', valuta: 'EUR', taal: 'nl',
          moeder: null, kvk: null, btwNummer: null, eigenaarsRuimte: true,
          beheerToken: crypto.randomBytes(24).toString('hex'),
          leden: {}, journaal: [], at: nu() };
        W()[code] = w;
        gemaakt = code;
      }
      if (!lidVoor(w, key)) {
        const l = { id: rid(4), naam: accounts.realNameOf(req.session.account) || 'Eigenaar',
          functie: 'eigenaar', afdeling: 'directie', extern: false,
          rollen: [{ id: 'directie', van: null, tot: null, at: nu() }],
          status: 'actief', token: crypto.randomBytes(24).toString('hex'),
          rtgKey: key, rtgCodenaam: codenaamVan(req.session), gekoppeldAt: nu(), at: nu() };
        w.leden[l.id] = l;
        gemaakt = gemaakt || w.code;
      }
      save();
    }

    const mijne = Object.values(W()).map(w => {
      const l = lidVoor(w, key);
      if (!l) return null;
      return { werkruimte: w.code, naam: w.naam, lidToken: l.token,
        lidNaam: l.naam, rollen: (l.rollen || []).map(r => r.id), functie: l.functie || null,
        eigenaarsRuimte: !!w.eigenaarsRuimte };
    }).filter(Boolean);

    res.json({ ok: true, aantal: mijne.length, werkruimtes: mijne, eigenaar: baas,
      aangemaakt: gemaakt,
      let: mijne.length
        ? 'Dit zijn uw eigen lid-tokens; het beheer-token van een werkruimte reist hier nooit mee.'
        : (baas ? null : 'U bent nog aan geen enkele werkruimte gekoppeld. Aanmelden kan met de werkruimtecode; een mens laat u daarna toe.') });
  });
};
