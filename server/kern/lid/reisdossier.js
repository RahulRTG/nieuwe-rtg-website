/* HET REISDOSSIER VAN EEN LID: DE ENIGE PLEK DIE `md.trip` SCHRIJFT.

   Tot voor kort had dit bestand niet hoeven bestaan, en dat was precies het
   probleem: NIETS in de code schreef ooit een reis naar een lid. Het enige
   dossier dat een lid ooit had, kwam uit de seed -- memberTemplate kopieerde
   db.data.trip naar elk nieuw account, dus iedereen "had" de demo-reis naar
   Ibiza. Toen die erfenis eruit ging (zie ../lid.js) bleef er een reisscherm
   over dat nooit meer kon vullen, en een lege stand die iets beloofde wat het
   huis niet waar kon maken.

   Nu ontstaat een reisdossier waar een reis ECHT ontstaat: bij het reisbureau.
   Vraagt een lid een reis aan, dan staat die meteen in zijn dossier -- als
   AANVRAAG, want dat is wat het is. Bevestigt een reisadviseur hem, dan gaat
   diezelfde regel op bevestigd. Trekt het lid hem in, dan verdwijnt hij weer.

   DE REGEL DIE HET HUIS ERAAN OPHANGT (zie ../huis.js): wat niet bevestigd is,
   staat er ook zo bij. Daarom schrijven we een aanvraag met status 'req' en
   niet met 'paid': het dossier mag nooit zekerder lijken dan de werkelijkheid.
   Er wordt hier ook geen datum verzonnen -- gaf het lid geen vertrekdatum, dan
   staat de tekstregel van de catalogusreis er ("7 dagen - zomer 2026") en leidt
   het Huis daar gewoon geen datum uit af.

   Alleen ECHTE accounts hebben een dossier. Een demo-sessie leest db.data en
   heeft niets van zichzelf om in te schrijven; die laten we met rust. */
'use strict';

const MAAND = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

// 'user-12' -> 12; alles anders (demo-sessie, gast) -> null
function idVan(key) {
  const m = /^user-(\d+)$/.exec(String(key || ''));
  return m ? Number(m[1]) : null;
}

// '2026-07-18' -> '18 juli 2026'; onleesbaar -> null (en dan verzinnen we niets)
function datumZin(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  const maand = MAAND[Number(m[2]) - 1];
  if (!maand) return null;
  return String(Number(m[3])) + ' ' + maand + ' ' + m[1];
}

function maakReisdossier({ accounts }) {
  // het dossier lezen en schrijven, met de sleutel als ingang
  function metDossier(key, doe) {
    const id = idVan(key);
    if (id == null || !accounts || !accounts.getMemberState) return null;
    let md;
    try { md = accounts.getMemberState(id) || {}; } catch (e) { return null; }
    const uit = doe(md);
    if (uit === false) return null;              // niets veranderd
    try { accounts.saveMemberState(id, md); } catch (e) { return null; }
    return md.trip || null;
  }

  /* Een aangevraagde reis in het dossier zetten. De reis zelf (bestemming en
     datums) komt van de aanvraag; het onderdeel draagt de referentie, zodat
     bevestigen en intrekken later precies deze regel terugvinden. */
  function zetAanvraag(key, aanvraag) {
    if (!aanvraag || !aanvraag.ref) return null;
    const wanneer = datumZin(aanvraag.vertrek) || aanvraag.dates || '';
    return metDossier(key, (md) => {
      const trip = md.trip && md.trip.dest === aanvraag.bestemming
        ? md.trip
        : { dest: aanvraag.bestemming, dates: wanneer, days: null, items: [] };
      // dezelfde reis nog eens aanvragen levert geen tweede regel op
      if (!Array.isArray(trip.items)) trip.items = [];
      if (trip.items.some(i => i.reisRef === aanvraag.ref)) return false;
      trip.items.push({
        when: wanneer, reisRef: aanvraag.ref,
        title: aanvraag.titel || ('Reis naar ' + aanvraag.bestemming),
        sub: aanvraag.personen > 1 ? (aanvraag.personen + ' personen') : '1 persoon',
        status: 'req', label: 'In aanvraag'
      });
      if (!trip.dates) trip.dates = wanneer;
      md.trip = trip;
    });
  }

  /* De reisadviseur bevestigt: dezelfde regel, andere stand. Geen nieuwe regel
     en geen tweede waarheid -- het dossier vertelt de geschiedenis van EEN reis. */
  function bevestig(key, ref) {
    return metDossier(key, (md) => {
      const it = md.trip && (md.trip.items || []).find(i => i.reisRef === ref);
      if (!it) return false;
      it.status = 'paid';
      it.label = 'Bevestigd';
    });
  }

  /* Ingetrokken of afgewezen: de regel gaat eruit. Blijft er niets over, dan
     gaat de hele reis weg -- een dossier met een lege tijdlijn is geen dossier,
     en het lege scherm zegt beter wat er aan de hand is. */
  function weghalen(key, ref) {
    return metDossier(key, (md) => {
      if (!md.trip || !Array.isArray(md.trip.items)) return false;
      const over = md.trip.items.filter(i => i.reisRef !== ref);
      if (over.length === md.trip.items.length) return false;
      md.trip = over.length ? { ...md.trip, items: over } : null;
    });
  }

  return { reisdossier: { zetAanvraag, bevestig, weghalen } };
}

module.exports = { maakReisdossier, datumZin };
