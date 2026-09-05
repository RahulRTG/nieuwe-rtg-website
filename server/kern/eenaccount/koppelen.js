/* Eenaccount (deelbestand): het KOPPELEN van een rol aan het ene account.

   Dit is de bewijs-helft: personeel bewijst de zaak-code + eigen PIN, de zaak
   bewijst de bedrijfsinlog, het kantoor bewijst de backoffice-code (en de
   tweede factor als die aanstaat). Pas als het bewijs er is, komt de rol aan
   de sleutelbos. De andere helft -- met die sleutelbos een werk-sessie munten
   -- staat in ../eenaccount.js.

   TWEE SLOTEN, EN ALLEEN SAMEN DEUGEN ZE.

   Een teller PER ACCOUNT houdt tegen dat een lid van alles staat af te lopen
   (vandaag deze zaak, morgen die). Die stond hier al.

   Wat er niet was: een teller per DOEL -- en dat is nou net de teller die de
   personeelspin beschermt. De oude opzet gaf elk RTG-account vijf pogingen per
   minuut op EEN pin, en een gratis account kost niet meer dan een e-mailadres:
   met twintig accounts twintig keer zoveel. De teller van /api/supplier/login
   -- de andere deur naar precies dezelfde verifyStaffPin -- zag daar niets
   van. Vier cijfers zijn zo af te lopen.

   Het doel-slot komt binnen als pinSlot en is GEDEELD met die andere deur; zie
   server/pinslot.js. Beide tellers gelden, en de strengste wint.

   Afgesplitst uit eenaccount.js toen die de 10 KB passeerde. */

const { idVanKey } = require('../../lib/lidsleutel');

const MAX_POGING = 5; // koppel-pogingen per account per minuut

module.exports = (kctx) => {
  const { accounts, findSupplier, checkCred, hasCred, DEMO, DEMO_SUPPLIER, OFFICE_CODE,
    veiligGelijk, totpOk, logInlog, pinSlot, nu } = kctx;

  /* De koppel-teller draait op HETZELFDE slot als de personeelspin hieronder.
     Hij had een eigen Map met dezelfde grenzen en zonder opruimronde -- en dat
     is extra scheef in juist dit bestand, want de kop hierboven legt uit dat
     losse tellers de reden waren dat de pin te raden viel. */
  const doel = key => 'koppel:' + key;
  const teVaak = key => pinSlot.dicht(doel(key));
  const fout = key => pinSlot.fout(doel(key), 'het koppelen van sleutelbos ' + key);

  /* Levert de rol op die aan de sleutelbos mag, of een foutobject. Het
     wegschrijven zelf doet de aanroeper: die kent de sleutelbos. */
  async function bewijs(key, body, req) {
    if (teVaak(key)) return { status: 429, error: 'Te veel koppel-pogingen. Wacht een minuut.' };
    const soort = String((body || {}).soort || '');

    if (soort === 'personeel') {
      if (!accounts.legacyStaffPinToegestaan || !accounts.legacyStaffPinToegestaan()) {
        return { status: 403, error: 'Personeel wordt via een uitnodiging rechtstreeks aan het persoonlijke RTG-account gebonden; een personeelspin kan niet meer worden gekoppeld.' };
      }
      const s = findSupplier(body.code);
      if (!s) return { status: 404, error: 'Deze zaak-code kennen we niet.' };
      // hetzelfde doel-slot als /api/supplier/login: een pin, een teller
      const doel = pinSlot.personeel(s.code, body.staffId);
      if (pinSlot.dicht(doel)) return { status: 429, error: 'Te veel foute pogingen op deze pincode. Wacht een minuut.' };
      const staff = await accounts.verifyStaffPin(Number(body.staffId), body.pin);
      if (!staff || String(staff.supplier_code).toUpperCase() !== s.code) {
        fout(key);
        pinSlot.fout(doel, 'de personeelspin van ' + s.code + '#' + Number(body.staffId));
        logInlog('koppel', false, s.code + '#' + body.staffId, req);
        return { status: 401, error: 'Onjuiste PIN.' };
      }
      const lidId = idVanKey(key);
      const lid = lidId != null ? accounts.getUserById(lidId) : null;
      if (!lid) return { status: 403, error: 'Deze personeelsplek kan alleen aan een geldig RTG-account worden gekoppeld.' };
      if (staff.member_id != null && Number(staff.member_id) !== lidId) {
        logInlog('koppel', false, s.code + '#' + body.staffId + ' al gekoppeld', req);
        return { status: 403, error: 'Deze personeelsplek is al veilig aan een ander RTG-account gekoppeld.' };
      }
      const geclaimd = accounts.claimStaffMember(staff.id, lidId, lid.tier);
      if (!geclaimd) {
        logInlog('koppel', false, s.code + '#' + body.staffId + ' gelijktijdig geclaimd', req);
        return { status: 403, error: 'Deze personeelsplek is zojuist aan een ander RTG-account gekoppeld.' };
      }
      pinSlot.goed(doel);
      return { rol: { rol: 'personeel', code: s.code, zaakNaam: s.name, staffId: geclaimd.id, naam: geclaimd.name, staffRole: geclaimd.role, at: nu() } };
    }

    if (soort === 'zaak') {
      if (!DEMO) return { status: 403, error: 'De bedrijfsinlog is uitgeschakeld; koppel uw persoonlijke personeelslogin.' };
      const doel = 'zaak:' + DEMO_SUPPLIER;
      if (pinSlot.dicht(doel)) return { status: 429, error: 'Te veel foute pogingen. Wacht een minuut.' };
      if (!hasCred(body) || !checkCred(body.username, body.password)) {
        fout(key);
        pinSlot.fout(doel, 'de bedrijfsinlog van ' + DEMO_SUPPLIER + ' via /api/account/koppel');
        logInlog('koppel', false, 'zaak', req);
        return { status: 401, error: 'Onjuiste gebruikersnaam of wachtwoord.' };
      }
      pinSlot.goed(doel);
      const s = findSupplier(DEMO_SUPPLIER);
      if (!s) return { status: 404, error: 'De zaak is niet gevonden.' };
      return { rol: { rol: 'zaak', code: s.code, zaakNaam: s.name, naam: 'Beheer', at: nu() } };
    }

    if (soort === 'kantoor') {
      /* De backoffice-code EN de tweede factor delen hier een doel-teller.
         De tweede factor telde helemaal niet mee: wie de (gedeelde, niet
         geheime) kantoorcode had, mocht de authenticator-code onbeperkt raden.
         Zes cijfers zijn dan in minuten af, en dan staat de tweede factor er
         voor niets. */
      const doel = 'kantoor:koppel';
      if (pinSlot.dicht(doel)) return { status: 429, error: 'Te veel foute pogingen. Wacht een minuut.' };
      if (!veiligGelijk(String(body.code || '').trim().toUpperCase(), OFFICE_CODE)) {
        fout(key);
        pinSlot.fout(doel, 'de backoffice-code via /api/account/koppel');
        logInlog('koppel', false, 'kantoor', req);
        return { status: 401, error: 'Onjuiste backoffice-code.' };
      }
      if (process.env.OFFICE_TOTP_SECRET && !totpOk(process.env.OFFICE_TOTP_SECRET, body.totp)) {
        fout(key);
        pinSlot.fout(doel, 'de tweede factor van de backoffice via /api/account/koppel');
        logInlog('koppel', false, 'kantoor (tweede factor)', req);
        return { status: 401, error: 'Tweede factor vereist: voer de authenticator-code in.' };
      }
      pinSlot.goed(doel);
      return { rol: { rol: 'kantoor', at: nu() } };
    }

    return { status: 400, error: 'Kies wat u koppelt: personeel, zaak of kantoor.' };
  }

  return { bewijs };
};
