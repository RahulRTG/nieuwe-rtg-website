'use strict';
/* DE PARTNERAANVRAAG: /api/partner/apply.

   APART VAN ./partneraanmelding.js omdat dat bestand over de 10 KB ging toen
   deze aanvraag erin kwam. De naad is niet willekeurig: types en "mijn
   aanvragen" zijn LEZERS -- ze tonen wat er is -- en dit is de HANDELING, met
   alle officiele controles eraan vast: internationale registratie, handelseisen
   per land, dubbelcontrole op dezelfde registratie, een honeypot, een eigen rem
   en het toelatingsdossier waar het kantoor daarna langs moet.

   DE POORT IS DE CAPABILITY EN NIET DE TREDE, en die staat in de moedermodule
   (partnerSessie) zodat de drie routes er dezelfde lezing van hebben. Zie de kop
   daar voor waarom `sess.tier === 'business'` hier niet meer staat.
   ========================================================================== */
module.exports = ({ kern, partnerSessie, register, controle, internationaal, kvk,
  geldigeUrl, teVeel, klokNu, klokDatum, caps, ladder }) => {
  const { app, db, save, crypto, schoon, mail, sseToOffice } = kern;


    app.post('/api/partner/apply', async (req, res) => {
      const b = req.body || {};
      /* DE POORT IS DE CAPABILITY EN NIET DE TREDE. Hier stond
         `sess.tier === 'business'`, en dat is de gelijkstelling die dit huis op
         21 augustus 2026 heeft teruggedraaid: de Business Pass is een
         lidmaatschapsniveau en geen vergunning om een bedrijf te hebben
         (CONCERN.md). Welke treden partner mogen zijn staat op EEN plek. */
      const sess = partnerSessie(req);
      if (!sess) return res.status(403).json({ error: 'Een partnerplek vraagt u aan met een zakelijke pas (' +
        caps.tredenMet('can_be_partner').map(t => (ladder.trede(t) || {}).naam || t).join(' of ') +
        '). Log in en probeer het opnieuw.' });
      // Bots krijgen geen bruikbare terugkoppeling en schrijven niets.
      if (String(b.websiteExtra || '').trim()) return res.json({ ok: true });

      const company = schoon(b.company, 80);
      const type = String(b.type || '').trim();
      const city = schoon(b.city, 60);
      const contactName = schoon(b.contactName, 60);
      const email = String(b.email || '').trim().toLowerCase().slice(0, 120);
      const phone = String(b.phone || '').trim().slice(0, 30);
      const note = schoon(b.note, 500);
      const website = geldigeUrl(b.website);
      const poort = register.genreToegang(type);
      if (!poort || !poort.ok) return res.status(400).json({ error: poort && poort.uitleg || 'Kies een geldig type bedrijf.' });
      if (!company || !city || !contactName) return res.status(400).json({ error: 'Vul de bedrijfsnaam, plaats en contactpersoon in.' });
      const regResultaat = internationaal.registratieUit(b);
      if (regResultaat.error) return res.status(400).json({ error: regResultaat.error });
      const registratie = regResultaat.registratie;
      b.landCode = registratie.landCode; b.registerBron = registratie.registerBron;
      if (b.website && !website) return res.status(400).json({ error: 'Vul een volledig webadres in dat met https:// begint.' });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Vul een geldig e-mailadres in.' });
      if (b.akkoord !== true || b.bevoegd !== true || b.waarheidsgetrouw !== true)
        return res.status(400).json({ error: 'Bevestig de voorwaarden, uw bevoegdheid en dat de registratie- en vergunninggegevens juist en geldig zijn.' });

      const handelsEisen = internationaal.eisenVoor(type, b, registratie);
      const defs = controle.eisenVoor(type, b).concat(handelsEisen);
      const bewijzen = b.bewijzen && typeof b.bewijzen === 'object' ? b.bewijzen : {};
      const ontbreekt = defs.filter(e => e.aanvrager && String(bewijzen[e.id] || '').trim().length < 3);
      if (ontbreekt.length) return res.status(400).json({ error: 'Vul de officiële referentie in voor: ' + ontbreekt.map(e => e.label).join('; ') + '.' });

      const zelfdeRegistratie = x => x && (x.sleutel === registratie.sleutel ||
        (!x.sleutel && registratie.landCode === 'NL' && x.kvkNummer === registratie.kvkNummer));
      const dubbel = (db.data.partnerApplications || []).find(a => ['nieuw', 'goedgekeurd'].includes(a.status) && zelfdeRegistratie(a.registratie));
      const bestaande = (db.data.suppliers || []).find(s => zelfdeRegistratie(s.registratie));
      if (dubbel || bestaande) return res.status(409).json({ error: 'Voor deze officiële bedrijfsregistratie bestaat al een open of goedgekeurde partneraanvraag.' });
      if (teVeel(String(req.ip || '') + ':' + String(sess.key || 'business')))
        return res.status(429).json({ error: 'Er zijn kort achter elkaar te veel aanvragen gedaan. Probeer het later opnieuw.' });

      const voorcontrole = registratie.landCode === 'NL'
        ? await kvk.voorcontrole({ apiKey: process.env.KVK_API_KEY,
          kvkNummer: registratie.kvkNummer, vestigingsnummer: registratie.vestigingsnummer, company, fetchFn: global.fetch })
        : { status: 'handmatig', reden: 'Controle in het officiële register van het vestigingsland is verplicht.' };
      if (voorcontrole.status === 'niet_gevonden') return res.status(422).json({ error: 'Dit KVK-nummer is niet als actieve inschrijving gevonden.' });
      if (voorcontrole.status === 'gevonden' && (!voorcontrole.actief || !voorcontrole.naamMatch || !voorcontrole.vestigingMatch))
        return res.status(422).json({ error: 'De bedrijfsnaam of vestiging komt niet overeen met het actieve KVK-profiel. Controleer de gegevens of neem contact op met RTG.' });

      const at = klokDatum().toISOString();
      const entry = {
        id: crypto.randomBytes(8).toString('hex'), company, type, city, contactName, email, phone, website, note,
        registratie: { ...registratie, voorcontrole },
        activiteiten: { ...controle.vlaggenUit(b), ...internationaal.vlaggenUit(b) },
        verklaringen: { bevoegd: true, waarheidsgetrouw: true, vergunningenGeldig: true, at },
        akkoord: { partnervoorwaarden: true, verwerkersafspraken: true, at },
        pas: { key: sess.key, tier: sess.tier, at }, businessPass: { key: sess.key, at }, status: 'nieuw', at
      };
      const registratieReferentie = registratie.landCode + ' · ' + registratie.nummer +
        (registratie.regioOfStaat ? ' · ' + registratie.regioOfStaat : '') +
        (registratie.vestigingsnummer ? ' · ' + registratie.vestigingsnummer : '');
      entry.toelating = controle.startControle({ genre: type, data: b,
        registratieReferentie, extraEisen: handelsEisen, bewijzen, at });
      db.data.partnerApplications.unshift(entry);
      db.data.partnerApplications = db.data.partnerApplications.slice(0, 200);
      save();
      mail.send(email, 'Uw gecontroleerde partneraanvraag bij Rahul Travel Group',
        'Beste ' + contactName + ',\n\nWe hebben de aanvraag voor ' + company + ' ontvangen. ' +
        'Een bedrijfscode wordt pas uitgegeven nadat het officiële handelsregister, bevoegdheid, toepasselijke vergunningen en fraudesignalen zijn gecontroleerd. ' +
        'U hoeft geen kopie van een identiteitsbewijs te mailen. De voortgang staat in de WORK-aanvraag.\n\nRahul Travel Group');
      sseToOffice('sync', { scope: 'team' });
      res.json({ ok: true, id: entry.id, toelating: { status: entry.toelating.status,
        controles: entry.toelating.eisen.length } });
    });
};
