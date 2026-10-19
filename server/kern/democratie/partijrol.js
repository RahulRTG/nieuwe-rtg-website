/* ============================================================================
   DE PARTIJROL -- wie namens een partij handelt (eigenaarsbesluit 19 oktober
   2026; vervangt het besluit van 29 september 2026, en daarmee vervalt proef P3).

   Wie namens een partij handelt, heeft een RTG-account met die rol (een gratis
   account is genoeg). De partijsleutel is geen geloofsbrief meer: het kantoor
   geeft een EENMALIGE koppelcode uit (registreren of vervangen in ./partijen.js),
   een mens van de partij koppelt er zijn eigen account mee, en daarna is de
   code ingetrokken. Een tweede mens krijgt een nieuwe code van het kantoor.
   Het account komt uit de sessie, nooit uit het lijf.

   Op de partij staat per gekoppeld account een INBRENGERSNUMMER uit
   ./koppeling.js, de codenaam (DO-09) en sinds wanneer -- nooit de RTG-sleutel
   zelf, want die staat in deze laag op precies een plek (./afhankelijkheden.js),
   en nooit een echte naam. Wie vergeten wil worden, verliest daar zijn sleutel
   en daarmee ook zijn partijrol. Het kantoor ziet de codenamen en maakt een
   account los; een lid of een andere partij ziet ze niet (PARTY_DATA_PARITY
   gaat over het partijbeeld, en daar staan ze niet in).

   DE MIGRATIE. Een partij van voor dit besluit heeft geen `model` en een
   sleutel die tot nu toe de deur opende. Die blijft werken tot er een account
   aan de partij hangt (vanOudeSleutel); koppelen trekt hem in. Een nieuwe
   partij, of een partij waarvan het kantoor de sleutel verving, staat op
   model 'account' en komt met een code alleen nooit binnen.

   WERKOPDRACHT VOOR HET KANTOOR: DE MIGRATIE AFRONDEN. Geef elke partij van voor
   het besluit (in het partijenregister: geen gekoppeld account) een nieuwe
   koppelcode met "Nieuwe koppelcode" op het kwestiekantoor, en laat een mens
   van de partij er zijn account mee koppelen. Zodra de laatste oude partij
   gekoppeld is, gaan de zes partijpaden uit scripts/lib/publiek.js en komen ze
   achter `auth`; vanOudeSleutel kan dan weg. De kantoorlijst telt hoeveel er
   nog over zijn (`oudePartijen`). EINDDATUM 19 JANUARI 2027: daarna zakt
   test/partijmigratie.test.js zolang de paden nog in publiek.js staan, zodat het
   opruimen niet vergeten wordt (keuze van de integrator, 19 oktober 2026: een
   teller op het kantoor plus een datum als vangnet). */
'use strict';

const { schoon } = require('../util');
/* De koppelingen staan per partij in een hashketen (`rolketen`, nieuwste eerst,
   dezelfde server/lib/keten.js als het kwestiejournaal en de voorstellen): wie
   er namens een partij handelt, en sinds wanneer niet meer, is achteraf niet
   stil te herschrijven. `historie` blijft het leesbare logboek ernaast. */
const keten = require('../../lib/keten');
const ketenRegel = (p, regel) => keten.noteerIn(p.rolketen = Array.isArray(p.rolketen) ? p.rolketen : [], regel, 0);

function maakPartijrol({ kijk, vind, vastleggen, nu, vanCode, trekIn, koppeling, wie }) {
  const actief = (p) => p && p.stand === 'actief';
  const isVan = (a, key) => !!key && koppeling.sleutelVan(a.ref) === key;

  async function koppel(code, key) {
    key = String(key || '');
    if (!/^user-\d+$/.test(key)) return { status: 401, error: 'Koppelen kan alleen met een eigen RTG-account.' };
    const p = vanCode(code);
    if (!actief(p)) return { status: 401, error: 'Deze koppelcode werkt niet (meer). Vraag het kantoor om een nieuwe.' };
    const codenaam = wie(key);
    if (!codenaam) return { status: 403, error: 'Namens een partij handelt u onder een codenaam, en voor deze sessie is er geen.' };
    const mis = await vastleggen(() => {
      p.rolhouders = (p.rolhouders || []).filter(a => !isVan(a, key));
      p.rolhouders.push({ ref: koppeling.koppel(key), codenaam, sinds: nu() });
      p.model = 'account';
      trekIn(p, 'partij', 'gekoppeld aan een account');
      p.historie.push({ wat: 'account-gekoppeld', codenaam, at: nu() });
      ketenRegel(p, { at: nu(), wat: 'account-gekoppeld', codenaam });
    });
    return mis || { ok: true, partij: { id: p.id, aanduiding: p.aanduiding },
      let_op: 'Uw account handelt nu namens deze partij. De koppelcode werkt niet meer.' };
  }

  async function ontkoppel(door, id, b) {
    const p = vind(id);
    if (!p) return { status: 404, error: 'Onbekende partij.' };
    const codenaam = schoon(b.codenaam, 80);
    const was = (p.rolhouders || []).find(a => a.codenaam && a.codenaam === codenaam);
    if (!was) return { status: 404, error: 'Dit account hangt niet aan deze partij.' };
    const mis = await vastleggen(() => {
      p.rolhouders = p.rolhouders.filter(a => a !== was);
      p.historie.push({ wat: 'account-los', codenaam, door, reden: schoon(b.reden, 300) || null, at: nu() });
      ketenRegel(p, { at: nu(), wat: 'account-los', codenaam, door });
    });
    return mis || { ok: true, gekoppeld: p.rolhouders.length };
  }

  /* De partij van dit account. Hangt het aan meer dan een partij, dan kiest
     het verzoek er een (`partij` in het lijf); anders is er geen antwoord. */
  function vanAccount(key, keuze) {
    if (!key) return null;
    const mijn = Object.values(kijk()).filter(p => actief(p) && (p.rolhouders || []).some(a => isVan(a, key)));
    if (keuze) return mijn.find(p => p.id === String(keuze).toUpperCase()) || null;
    return mijn.length === 1 ? mijn[0] : null;
  }

  return { koppel, ontkoppel, vanAccount };
}

module.exports = { maakPartijrol };
