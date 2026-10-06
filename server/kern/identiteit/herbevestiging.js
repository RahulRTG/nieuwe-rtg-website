/* ============================================================================
   HERBEVESTIGING -- "bent u het nog, of heeft iemand alleen uw token?"

   WAAROM DIT BESTAAT. Twee handelingen maken van een sessietoken iets
   blijvends, en geen van beide vroeg meer dan het token zelf:

     1. Een toestelsleutel aan de sessie binden (routes/member/toestellen.js).
        Daarna eist elk zwaar pad een bezitsbewijs van DIE sleutel
        (./bezitsbewijs.js). Wie een token stal, bond zijn eigen sleutel en
        tekende voortaan zelf de bewijzen voor betalen, bank, wachtwoord,
        passkeys en export -- de bescherming tegen een gestolen token werd zo
        een instrument van de dief.
     2. Een nieuwe passkey registreren (routes/auth/webauthn.js). Daarmee
        voldoet de dief daarna blijvend aan de zware poort (../zwaarbewijs.js),
        ook nadat het token verlopen is.

   Een dragersbewijs bewijst bezit van het TOKEN en niets over de mens. Deze
   twee handelingen vragen daarom iets wat alleen de mens heeft: zijn
   wachtwoord, of een verse vinger op een passkey die er al stond.

   WAT HIER NIET STAAT. Of iemand iets MAG -- dat doen `auth` en de route. Dit
   bestand zegt alleen of de handeling nu opnieuw door de mens is bevestigd. En
   er komt geen tweede passkeyceremonie: de passkeyweg gaat door de bestaande
   zware poort, met een eigen actienaam (../webauthn-acties.js), zodat een
   ceremonie voor de ene handeling niet inwisselbaar is voor de andere.
   ========================================================================== */
'use strict';

const klok = require('../../lib/klok');

/* HET VERSE VENSTER na het inloggen. Binnen deze tijd geldt de inlog zelf als
   bevestiging: het lid heeft zojuist zijn wachtwoord of passkey getoond, en
   hem dat een minuut later opnieuw laten doen leert hem alleen wegklikken
   (GRAMMATICA.md). Daarna niet meer, want een token dat een uur oud is kan
   overal vandaan komen.

   Tien minuten is genoeg voor de gewone volgorde -- inloggen, naar "Waar ben ik
   aanwezig", dit toestel bevestigen -- en kort genoeg dat een token uit een
   logregel of een gedeelde computer er in de regel al buiten valt. Het is
   dezelfde orde als de levensduur van een WebAuthn-ceremonie (vijf minuten,
   ../webauthn-ceremonie.js): een venster voor een handeling, geen
   werkdag. */
const VERSE_INLOG_MS = 10 * 60 * 1000;

/* Een klok die een paar seconden achterloopt op het inlogmoment mag geen
   sessie uit de toekomst opleveren die nooit veroudert. */
const KLOKSPELING_MS = 60 * 1000;

/* Is deze sessie binnen het verse venster geopend? `geopendOp` komt uit het
   sessieregister (./sessieregister.js), dat hem alleen op het moment van
   authenticatie schrijft. Onbekend is NIET vers: een sessie zonder herkomst
   bewijst niets over wanneer de mens er was. */
function versGeopend(geopendOp, nu = klok.nu()) {
  const t = new Date(geopendOp || 0).getTime();
  if (!Number.isFinite(t) || t <= 0) return false;
  if (t > nu + KLOKSPELING_MS) return false;
  return nu - t <= VERSE_INLOG_MS;
}

/* zwaarVan is een getter: de zware poort wordt later in de montage gebouwd dan
   sommige routes die dit bestand bedraden (zie de kop van ../zwaarbewijs.js
   over `beveiligVan`). */
function maakHerbevestiging({ accounts, zwaarVan, tooManyTries, noteFailedTry, loginFails }) {
  const zwaar = () => (typeof zwaarVan === 'function' ? zwaarVan() : zwaarVan) || null;
  const emmer = (u) => 'herbevestig:' + u.id;

  function heeftPasskey(u) {
    const z = zwaar();
    return !!(z && typeof z.heeftPasskey === 'function' && z.heeftPasskey(u));
  }

  /* De herbevestiging zelf. `wegen` zegt welke bewijzen deze handeling
     aanneemt: ['wachtwoord'], ['passkey'] of allebei. Geeft { ok, via } of een
     weigering { status, error, herbevestigingNodig, wegen, actie }; bij een
     rem is het antwoord al verstuurd en komt { verstuurd: true } terug.

     Een meegestuurde passkeyceremonie gaat VOOR het wachtwoord: wie zijn vinger
     toont, hoeft niets te typen. */
  async function eis(req, res, { actie, wegen, omschrijving }) {
    const u = req.session && req.session.account;
    if (!u) return { status: 403, error: 'Dit hoort bij een eigen RTG-account.' };
    const mag = new Set(wegen || []);
    const body = req.body || {};

    if (mag.has('passkey') && body.ceremonie && body.antwoord) {
      const z = zwaar();
      if (!z) return { status: 503, error: 'De passkeybevestiging is hier niet beschikbaar.' };
      /* zonderTerugval: de terugval van de zware poort laat een account zonder
         passkey DOOR (met een melding). Hier zou dat betekenen dat een
         ceremonie zonder passkey als bevestiging telt, en dat is precies wat
         een dief zonder wachtwoord nodig heeft. */
      const r = await z.eis(u, actie, z.sessieSleutel(req), req, omschrijving, { zonderTerugval: true });
      if (r && r.ok && r.bewezen) return { ok: true, via: 'passkey' };
      return Object.assign({ status: 401 }, r && r.error ? { error: r.error } : { error: 'De passkey kon niet worden bevestigd.' });
    }

    if (mag.has('wachtwoord') && typeof body.huidig === 'string' && body.huidig) {
      if (tooManyTries && tooManyTries(res, emmer(u))) return { verstuurd: true };
      /* A-P1-04: een controle die niet kon draaien is geen geslaagde controle --
         en ook geen fout wachtwoord (dat zou de rem laten tellen voor iets wat de
         mens niet deed). Een eigen weigering, en niets uitgevoerd. */
      let goed;
      try {
        if (require('../../lib/verraad').sla('wachtwoordcontrole-faalt')) throw new Error('verraad: wachtwoordcontrole-faalt');
        goed = !!(u.password_hash && await accounts.verifyPassword(body.huidig, u.password_hash));
      } catch (e) {
        return { status: 503, error: 'Het wachtwoord kon niet worden nagekeken; er is niets uitgevoerd. Probeer het zo opnieuw.' };
      }
      if (!goed) {
        /* Geteld per ACCOUNT en niet per adres: een dief met het token raadt
           het wachtwoord van dit ene account, vanaf waar dan ook. */
        if (noteFailedTry) noteFailedTry(emmer(u), req.ip);
        return { status: 403, error: 'Het wachtwoord klopt niet.', herbevestigingNodig: true, wegen: [...mag], actie };
      }
      if (loginFails && typeof loginFails.delete === 'function') loginFails.delete(emmer(u));
      return { ok: true, via: 'wachtwoord' };
    }

    const zin = mag.has('wachtwoord') && mag.has('passkey')
      ? 'Bevestig eerst dat u het bent: met uw huidige wachtwoord of met uw passkey.'
      : mag.has('passkey') ? 'Bevestig eerst met een passkey die al op dit account staat.'
        : 'Bevestig eerst met uw huidige wachtwoord.';
    /* Alleen een passkey: dan spreekt dit antwoord het protocol van de zware
       poort (401 + `bevestigingNodig`), zodat de bestaande schermhulp
       (public/shared/zwaarbevestig.js) de ceremonie vanzelf start. */
    const alleenPasskey = mag.has('passkey') && !mag.has('wachtwoord');
    return { status: alleenPasskey ? 401 : 403, herbevestigingNodig: true, wegen: [...mag], actie,
      ...(alleenPasskey ? { bevestigingNodig: true } : {}),
      error: (omschrijving ? omschrijving + ' vraagt een bevestiging. ' : '') + zin };
  }

  function stuur(res, r) {
    const { status, ok, via, verstuurd, ...rest } = r;
    return res.status(status || 403).json(rest);
  }

  return { eis, stuur, heeftPasskey, versGeopend };
}

module.exports = { maakHerbevestiging, versGeopend, VERSE_INLOG_MS };
