/* De wervingslink: /werken/<kassacode>.

   HET GAT DAT DIT DICHT. Personeel heeft altijd een eigen RTG-account -- dat
   was al zo, /api/supplier/staff/join vraagt erom. Maar de weg ernaartoe was
   alleen begaanbaar voor wie dat account AL had: open de leverancier-app, typ
   de bedrijfsnaam over, typ de kassacode. Wie nog geen account had, kreeg een
   code die nergens paste. Juist die persoon -- de nieuwe medewerker die morgen
   begint -- moest de meeste stappen zetten.

   Nu stuurt de werkgever een link. Die zegt wie je uitnodigt, en daarna zijn er
   twee wegen:

     - JE HEBT AL EEN ACCOUNT: je bent ingelogd, /verbind koppelt je aan de
       zaak. Geen wachtwoord opnieuw, geen bedrijfsnaam overtypen.
     - JE HEBT ER NOG GEEN: je maakt er gratis een (dezelfde registratie als
       ieder ander, /api/auth/register met de wervingscode erbij), en die
       registratie verbindt je meteen.

   DRIE DINGEN DIE HIER BEWUST ZO ZIJN.

   1. KIJKEN VERTELT WEINIG. /kijk geeft de bedrijfsnaam en de functie terug,
      en verder niets -- geen ledental, geen adres, geen wie-nodigde-uit. Genoeg
      om te weten of je op de goede plek bent, te weinig om een zaak mee uit te
      horen. En het staat achter dezelfde snelheidsrem als de rest: zoeken op
      code alleen is een bredere deur dan zoeken op naam plus code.

   2. DE UITNODIGING BLIJFT EENMALIG. De link is een tweede weg naar dezelfde
      uitnodiging, geen tweede uitnodiging. Wie hem inwisselt, verbruikt hem --
      ook via de link.

   3. HET IDENTITEITSBEWIJS KOMT HIERNA, NIET HIER. Voor de loonadministratie
      is een geverifieerde identiteit nodig, maar dat is de bestaande
      KYC-stroom (/api/verify/upload en de beoordeling in het kantoor). Deze
      route bouwt daar geen tweede intake naast; hij vertelt alleen dat het
      nodig is. Zie server/kern/gegevenspoort.js, dat dezelfde regel al voor
      andere velden trekt. */
'use strict';

module.exports = (kern) => {
  const { app, accounts, auth, tooManyTries, noteFailedTry, loginFails } = kern;

  /* De uitnodiging-helpers wonen bij de supplier-werving; die module wordt daar
     gemount en levert ze hier aan via de kern. Zo is er een plek die weet wat
     een uitnodiging is (zie routes/supplier/werving/uitnodiging.js). */
  const uitnodiging = require('./supplier/werving/uitnodiging')({ kern });
  const { zoekInvite, verbindLid } = uitnodiging;

  /* Wat staat er achter deze link? Genoeg om te weten waar je bent. */
  app.post('/api/werving/kijk', (req, res) => {
    const bucket = 'werving:' + req.ip;
    if (tooManyTries(res, bucket)) return;
    const g = zoekInvite(req.body && req.body.kassacode);
    if (!g) {
      noteFailedTry(bucket);
      return res.status(404).json({ error: 'Deze uitnodiging bestaat niet, is al gebruikt of is verlopen. Vraag uw werkgever om een nieuwe.' });
    }
    loginFails.delete(bucket);
    res.json({ ok: true, bedrijf: g.s.name, functie: g.inv.func || null, naam: g.inv.naam || null,
      rol: g.inv.role, verloopt: g.inv.expires });
  });

  /* Ingelogd lid: verbinden zonder opnieuw in te loggen. De sessie IS het
     bewijs dat dit account van deze persoon is; de kassacode is het bewijs dat
     de werkgever hem verwacht. Twee sleutels, net als overal in dit huis. */
  app.post('/api/werving/verbind', auth, async (req, res) => {
    const bucket = 'werving:' + req.ip;
    if (tooManyTries(res, bucket)) return;
    const lid = req.session && req.session.account
      ? accounts.getUserById(req.session.account.id) : null;
    if (!lid) return res.status(403).json({ error: 'Meld u eerst aan met uw eigen RTG-account.' });

    const g = zoekInvite(req.body && req.body.kassacode);
    if (!g) {
      noteFailedTry(bucket);
      return res.status(404).json({ error: 'Deze uitnodiging bestaat niet, is al gebruikt of is verlopen. Vraag uw werkgever om een nieuwe.' });
    }
    if (accounts.staffByMember(g.s.code, lid.id)) {
      // de uitnodiging verbruiken zou hem hier weggooien voor niets
      return res.status(409).json({ error: 'U werkt hier al; log in met uw naam en pincode.' , code: g.s.code });
    }
    loginFails.delete(bucket);
    const pinGewenst = String((req.body || {}).pin || '').trim();
    if (pinGewenst && !/^\d{4}$/.test(pinGewenst))
      return res.status(400).json({ error: 'Een pincode is vier cijfers; laat hem leeg als u er geen wilt.' });

    const { staff, naam, pin } = await verbindLid(g.s, g.inv, lid, { pin: pinGewenst || null });
    res.json({ ok: true, code: g.s.code, bedrijf: g.s.name, staffId: staff.id, name: naam, role: g.inv.role, pin,
      identiteit: identiteitStap(lid) });
  });

  /* Wat er nog moet gebeuren voor de loonadministratie. Geen nieuwe intake --
     dit wijst naar de bestaande verificatie. */
  function identiteitStap(lid) {
    const status = lid && lid.verified ? String(lid.verified) : 'none';
    if (status === 'verified') return { nodig: false, status };
    return { nodig: true, status,
      waarom: 'Uw werkgever betaalt uw loon via RTG. Daarvoor moet uw identiteit een keer zijn vastgesteld: een foto van uw identiteitsbewijs en een selfie. Uw werkgever ziet daarvan alleen of het gelukt is, niet het document zelf.' };
  }

  /* Het pad dat in de link staat. De pagina zelf is de gewone RTG-app: die
     kent de aanmelding, de onboarding en de verificatie al, en een tweede
     aanmeldpagina zou een tweede waarheid over registreren worden. */
  app.get('/werken/:code', (req, res, next) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) return next();
    req.url = '/apps/app.html?werving=' + code;
    const eigen = Object.getOwnPropertyDescriptor(req, 'path');
    if (eigen && eigen.writable) req.path = req.url;
    next();
  });

  /* zoekInvite en verbindLid gaan mee de kern in: de registratie
     (routes/auth/account.js) wisselt de wervingscode in op het moment dat een
     nieuw account wordt aangemaakt, en moet daarvoor bij dezelfde uitnodiging
     kunnen als deze route. Een tweede kopie van die logica naast de eerste is
     precies hoe twee regels over "wie mag bij een bedrijf" ontstaan. */
  return { identiteitStap, zoekInvite, verbindLid, wisselCodeIn: uitnodiging.wisselCodeIn };
};
