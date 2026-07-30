/* Kern-module "werkbijlogin": je logt in op je RTG-account en je werk-app staat er
   meteen. Geen tweede inlog, geen pincode, geen rol kiezen.

   De koppeling bestond al: meldt een medewerker zich aan met de uitnodiging van de
   werkgever (kassacode + eigen RTG-inlog), dan krijgt zijn personeelsrecord het
   member_id van dat account. accounts.staffPositions(lid) geeft die werkplekken
   terug. Wat ontbrak was de laatste stap: bij het inloggen munten we nu meteen
   dezelfde werk-sessie die de losse personeelslogin zou geven, zodat de werk-app
   direct bruikbaar is.

   DE WERKGEVER BEPAALT WANNEER. Het werkvenster (kern/werkvenster.js) blijft
   onverkort gelden en dat is precies de knop waarmee de werkgever kiest:

     - venster aan (standaard)  -> de werk-app is er wel, maar dicht buiten de
       dienst, met de reden erbij. Wie om 3 uur 's nachts inlogt ziet dus zijn
       werkplek staan en leest wanneer hij er weer in kan.
     - venster uit, of per persoon 'altijd' -> altijd open zodra je bent ingelogd.
     - per persoon 'nooit' of een gesloten dag -> dicht, met de reden.

   Zo hoeft niemand een tweede keer in te loggen, en houdt de werkgever de
   zeggenschap die hij had. Een dichte werkplek levert GEEN token op: wat dicht
   is, is echt dicht.

   Toeschrijving blijft persoonlijk: de sessie draagt de naam van het
   personeelslid en lidKey, dus elke handeling staat nog steeds op een mens. */

function maakWerkBijLogin({ accounts, crypto, findSupplier, magWerken, rememberSession, logInlog, logActivity, supplierState }) {
  /* Alle werkplekken van dit lid, met per plek of hij nu open is. Open plekken
     krijgen meteen een sessie-token; dichte plekken de reden.

     `key` is de lidsleutel ('user-<id>') zoals de rest van het huis hem kent;
     `lidId` het database-id waarmee de personeelsrecords zijn gekoppeld. */
  function werkplekkenBijLogin(lidId, key, req) {
    let posities = [];
    try { posities = accounts.staffPositions(lidId) || []; } catch (e) { return []; }
    const uit = [];
    for (const st of posities) {
      const s = findSupplier(st.supplier_code);
      if (!s) continue;                       // zaak bestaat niet meer
      const actor = { name: st.name, role: st.role, staffId: st.id, manager: st.role === 'manager' };
      const plek = { rol: 'personeel', code: s.code, zaakNaam: s.name, naam: st.name, func: st.func || null,
        manager: actor.manager, open: true, token: null, reden: null, venster: null };

      // het werkvenster van de werkgever: dit is de knop waarmee hij kiest
      if (magWerken) {
        const w = magWerken(s, { staffId: actor.staffId, manager: actor.manager }, null, null);
        if (!w.ok) {
          plek.open = false;
          plek.reden = w.error || 'De werkomgeving is nu dicht.';
          plek.venster = w.venster || null;
          uit.push(plek);
          continue;                            // dicht = geen token
        }
      }

      // exact dezelfde sessie als de losse personeelslogin zou geven
      const token = crypto.randomBytes(24).toString('hex');
      rememberSession(token, { role: 'supplier', code: s.code, actor: actor.name, staffId: actor.staffId,
        staffRole: actor.role, manager: actor.manager, lidKey: key });
      plek.token = token;
      try { logInlog('zaak', true, s.code + ' · ' + actor.name + ' (met het RTG-account)', req); } catch (e) {}
      try { logActivity(s.code, actor, actor.name + ' kwam binnen met het RTG-account'); } catch (e) {}
      uit.push(plek);
    }
    return uit;
  }

  /* De staat van een open werkplek, voor een client die er meteen in wil. */
  function werkplekState(code, staffId) {
    const s = findSupplier(code);
    if (!s) return null;
    const st = (accounts.listStaff(s.code) || []).find(x => x.id === Number(staffId));
    if (!st) return null;
    return supplierState(s, { name: st.name, role: st.role, staffId: st.id, manager: st.role === 'manager' });
  }

  return { werkplekkenBijLogin, werkplekState };
}

module.exports = { maakWerkBijLogin };
