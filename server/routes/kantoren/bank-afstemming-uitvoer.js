/* Kantoren, deel "bank-afstemming-uitvoer": WAT ER GEBEURT ZODRA DE TWEEDE MENS
   EEN AFSTEMMING TEKENT.

   Afgesplitst van ./bank-afstemming.js op dezelfde naad als ./bank-incasso.js
   tegenover ./bank-tweedehand.js: aanvragen zet klaar, deze uitvoerder voert uit,
   en hij loopt door de geldketen (kern/kantoor/geldketen.js) -- tekenAf en dan
   uitvoer, nooit eromheen. Gemount vanuit ./bank-afstemming.js, met dezelfde ctx. */
'use strict';

module.exports = (ctx) => {
  const { afdelingen, sseToOffice, kern, tweedeHand } = ctx;
  const bank = kern.bank;
  const sync = () => sseToOffice('sync', { scope: 'bank' });

  tweedeHand.registreer('bank.afstemming', {
    wat: 'een uitbetaling met onbekende uitkomst afstemmen op een afschriftregel', geld: true,
    voerUit: async (lijf, wie) => {
      const ketenlaag = kern.geldketen;
      if (!ketenlaag) return { status: 503,
        error: 'De geldketen is niet gemount; een afstemming gaat niet buiten de keten om.' };
      // een aanvraag van voor de geldketen gaat niet stil de oude weg (zie ./bank-tweedehand.js)
      const vid = lijf && lijf.voornemen ? String(lijf.voornemen) : '';
      if (!vid) return { status: 409,
        error: 'Deze aanvraag draagt geen voornemen en is van voor de geldketen. Vraag de ' +
          'afstemming opnieuw aan; dan loopt zij langs het besluit en het bewijs.' };
      const bevestiger = (wie && wie.bevestigdDoor) || null;
      const tekenen = ketenlaag.tekenAf({ id: vid, door: bevestiger });
      // 409 = het voornemen stond niet op WACHT (binnen het beleid); dan gaat de uitvoering door
      if (tekenen && tekenen.error && tekenen.status !== 409) return tekenen;
      let r = null;
      const k = await ketenlaag.uitvoer({ id: vid, door: bevestiger, verzoek: wie && wie.verzoek,
        /* Uitgevoerd wordt wat in het voornemen BEVROREN is (stap.gegevens), niet het
           lijf van de aanvraag: dat is wat gewogen en getekend werd. */
        doe: async (stap) => {
          const g = (stap && stap.gegevens) || {};
          r = await bank.bankOpdrachtStemAf({ id: g.id, uitspraak: g.uitspraak, providerRef: g.providerRef,
            centen: g.centen, valuta: g.valuta, bron: g.bron,
            echtheid: 'OVERGENOMEN', wie: { aangevraagdDoor: (wie && wie.aangevraagdDoor) || null,
              bevestigdDoor: bevestiger } });
          if (r && r.error) throw Object.assign(new Error(r.error), { status: r.status });
          /* Een teruggang die niet lukte is GEEN uitgevoerde afstemming, ook al gaf
             stemAf geen fout: de opdracht staat dan op MISLUKT met terugboekFout en de
             streefstand is niet gehaald. Het voornemen staakt, het dossier zegt waarom. */
          if (r && r.uitkomst === 'NIET_UITGEVOERD' && r.teruggeboekt === false)
            throw new Error('de opdracht staat op MISLUKT, maar de terugboeking lukte niet; een mens zoekt dit uit');
          return { uitkomst: r && r.uitkomst, id: r && r.id };
        } });
      if (r && r.uitkomst) {
        afdelingen.audit('tweede handtekening', 'Betaalopdracht ' + r.id + ' afgestemd: ' + r.uitkomst +
          ' (bron: ' + String(lijf.bron || '').slice(0, 80) + ', voornemen ' + vid + ')');
        sync();
      }
      // de uitslag blijft naar buiten gaan, met het voornemen erbij (zoals de incasso)
      if (k && k.ok && r) return Object.assign({}, r, { voornemen: k.voornemen });
      return (r && r.error) ? r : k;
    }
  });
};
