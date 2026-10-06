/* Eén duurzame PostgreSQL-commit voor alle gewone collecties die door één
   HTTP-verzoek zijn gewijzigd. De request werkt op een geisoleerde kopie;
   hierdoor komt niets in db.data vóór COMMIT en kan rollback niets uit een
   andere request terugdraaien.

   Locks staan altijd op collectienaam gesorteerd. Dat is ook de volgorde van
   de bestaande flush/economische banen en voorkomt een kruisdeadlock. */
'use strict';

const { voegVeilig } = require('./verzoekmerge');
const { voegBijzonderSamen } = require('./verzoekbijzonder');
const deelnemerProtocol = require('../db/deelnemers');

module.exports = (ctx) => {
  const { pool, uitStore, toegepast, laatsteJson } = ctx;
  const fout = (code, tekst) => Object.assign(new Error(tekst), { code });

  function voegSamen(w, rij) {
    const dbBestaat = !!rij && !rij.weg;
    /* `basisBestaat` zegt dat de collectie in de lokale projectie stond; het
       zegt niet dat PostgreSQL haar ooit bevestigd heeft. Op een verse
       multi-instance-start kunnen veilige defaults na de eerste laadronde
       lokaal ontstaan (bijvoorbeeld de techniekzekeringen), terwijl de kv-rij
       nog niet bestaat. Alleen een sleutel in `toegepast` bewijst dat een later
       ontbrekende rij werkelijk verwijderd/drift is. Zonder dit onderscheid
       kreeg de eerste legitieme vastlegging een 409 en kon een tweede instance
       niet eens inloggen. */
    const basisBevestigd = toegepast.has(w.sleutel);
    const basis = w.basisBestaat ? JSON.parse(w.basisJson) : undefined;
    const ons = w.waardeBestaat ? JSON.parse(w.waardeJson) : undefined;
    const hunJson = dbBestaat ? uitStore(rij.val) : null;
    const hun = dbBestaat ? JSON.parse(hunJson) : undefined;

    /* Een verwijdering of grafsteen die deze request nog niet zag mag niet door
       een verouderde werkkopie herrijzen. Omgekeerd mag een verwijdering niet
       stil een gelijktijdige wijziging van een ander proces uitwissen. */
    if (w.basisBestaat && !dbBestaat) {
      if (!w.waardeBestaat) return { bestaat: false, waarde: undefined, dbJson: null };
      if (!basisBevestigd && !rij)
        return { bestaat: true, waarde: ons, dbJson: JSON.stringify(ons) };
      throw fout('PG_REQUEST_CONFLICT', 'De collectie ' + w.sleutel +
        ' is tijdens dit verzoek verwijderd; opnieuw laden is vereist.');
    }
    if (!w.waardeBestaat) {
      if (!w.basisBestaat) return { bestaat: dbBestaat, waarde: hun, dbJson: hunJson };
      if (JSON.stringify(basis) !== hunJson)
        throw fout('PG_REQUEST_CONFLICT', 'De collectie ' + w.sleutel +
          ' veranderde tijdens de verwijdering; opnieuw laden is vereist.');
      return { bestaat: false, waarde: undefined, dbJson: null };
    }
    if (!dbBestaat && w.basisBestaat)
      throw fout('PG_REQUEST_DRIFT', 'De lokale collectie ontbreekt in PostgreSQL; herstel is vereist.');
    const bijzonder = !dbBestaat ? null
      : voegBijzonderSamen(w.sleutel, basis, ons, hun);
    const waarde = bijzonder === null
      ? (dbBestaat ? voegVeilig(basis, ons, hun, w.sleutel) : ons)
      : bijzonder;
    return { bestaat: true, waarde, dbJson: JSON.stringify(waarde) };
  }

  /* Lock, samenvoeging, schrijven en publicatie: ./verzoekschrijf.js, gedeeld
     met de twee vroege commitpaden die het auditspoor meenemen. */
  const schrijver = require('./verzoekschrijf')(ctx, voegSamen);

  /* `deelnemers` (./db/deelnemers.js) landen in DEZELFDE transactie: na de
     collecties, zodat hun advisory locks altijd na de collectielocks komen en
     twee verzoeken nooit in omgekeerde volgorde op elkaar wachten. */
  async function commitVerzoek(dataNu, wijzigingen, deelnemers = []) {
    const mee = Array.isArray(deelnemers) ? deelnemers : [];
    wijzigingen = Array.isArray(wijzigingen) ? wijzigingen : [];
    if (!wijzigingen.length && !mee.length) return { geschreven: 0, sleutels: [] };
    const lijst = schrijver.sorteer(wijzigingen);
    const client = await pool.connect();
    let publicaties = [];
    let gecommit = false, commitVerstuurd = false;
    try {
      await client.query('BEGIN');
      publicaties = await schrijver.schrijfIn(client, lijst);
      await deelnemerProtocol.pasToe(mee, client);
      commitVerstuurd = true;
      await client.query('COMMIT');
      gecommit = true;
    } catch (e) {
      if (!gecommit) try { await client.query('ROLLBACK'); } catch (x) {}
      deelnemerProtocol.annuleer(mee, commitVerstuurd);
      throw e;
    } finally { client.release(); }

    /* Publiceer pas na COMMIT. Alle lokale commitbanen delen één opslag-slot;
       daardoor is deze assignment de recentste autoritatieve DB-versie en
       kan geen oudere lokale publicatie er later overheen schrijven. */
    schrijver.publiceer(dataNu, publicaties);
    deelnemerProtocol.publiceer(mee);
    return { geschreven: publicaties.length, sleutels: publicaties.map(p => p.sleutel),
      deelnemers: mee.map(d => d.naam) };
  }

  /* Alleen voor mutaties buiten een HTTP-context. Zij krijgen nooit een 2xx,
     maar moeten wel veilig kunnen landen terwijl de verkeerspoort dicht is.
     Vergelijk tegen de laatst bevestigde DB-json en laat dezelfde atomaire
     multi-collectiecommit het werk doen. */
  function openstaandeWijzigingen(dataNu) {
    const uit = [], sleutels = new Set([...Object.keys(dataNu || {}), ...laatsteJson.keys()]);
    for (const sleutel of sleutels) {
      const basisBestaat = laatsteJson.has(sleutel);
      const basisJson = basisBestaat ? laatsteJson.get(sleutel) : null;
      const waardeBestaat = !!dataNu && Object.prototype.hasOwnProperty.call(dataNu, sleutel);
      const waardeJson = waardeBestaat ? JSON.stringify(dataNu[sleutel]) : null;
      if (basisBestaat === waardeBestaat && basisJson === waardeJson) continue;
      uit.push({ sleutel, basisBestaat, basisJson, waardeBestaat, waardeJson });
    }
    return uit.sort((a, b) => a.sleutel.localeCompare(b.sleutel));
  }

  return { commitVerzoek, openstaandeWijzigingen, schrijver };
};
