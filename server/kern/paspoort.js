/* Paspoort- en identiteitslaag: een gecontroleerd, veilig kanaal waarlangs een
   partner (leverancier) de identiteit achter een codenaam kan opvragen. Het
   uitgangspunt blijft privacy-first: een partner ziet standaard alleen de
   codenaam en het feit dat de leeftijd is geverifieerd. Deze laag opent daar
   bovenop een expliciet, toestemmingsgestuurd kanaal.

   Drie niveaus van een aanvraag:
   - 'bevestiging'  ja/nee: is de identiteit RTG-geverifieerd en voldoet het lid
                    aan een eventuele leeftijdseis. Komt direct terug (geen
                    toestemming nodig), maar het lid krijgt wel een melding.
   - 'idkaart'      een minimale, RTG-geverifieerde identiteitskaart: pasfoto,
                    naam, nationaliteit, geboortedatum, leeftijd en het RTG-zegel.
                    NIET de ruwe paspoortscan. Vereist toestemming van het lid.
   - 'paspoort'     de volledige (versleuteld bewaarde) paspoortscan. Vereist
                    toestemming van het lid.

   De vijf eisen:
   1. Veilig: de scan/selfie staan versleuteld op schijf; een goedgekeurde inzage
      is tijdgebonden (VIEW_TTL) en volledig gelogd.
   2. Het lid krijgt bij elke aanvraag een melding.
   3. Het lid kan idkaart-/paspoort-aanvragen weigeren.
   4. Bij een incident kan een partner het opeisen; RTG-kantoor beoordeelt dat
      en geeft de identiteit dan pas vrij (nooit automatisch).
   5. Klopt het paspoort bij de codenaam? De codenaam, het paspoort en de selfie
      zijn alle drie aan hetzelfde account gebonden en door RTG geverifieerd
      (gezicht x paspoort). De partner ziet de geverifieerde pasfoto en
      vergelijkt die met de persoon voor zich.

   maakPaspoort(state) volgt het vaste kern-patroon. */

const NIVEAUS = ['bevestiging', 'idkaart', 'paspoort'];
const VIEW_TTL_MS = 10 * 60 * 1000;     // een goedgekeurde inzage is 10 minuten geldig
const KIND_GRENS = 15;                   // bescherming minderjarigen: nooit delen t/m deze leeftijd

function maakPaspoort({ db, save, crypto, accounts, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, leesUploadDataUrl, leeftijdVan, gidsHaal }) {
  // De codenaam uit de ledengids halen via gidsHaal: dat werkt in beide
  // opslagmodi. db.data.memberDir is met Postgres leeg (de leden staan
  // geindexeerd buiten het geheugen), dus een directe lezing zou de codenaam
  // missen.
  const codenaamUitGids = key => ((typeof gidsHaal === 'function' ? gidsHaal(key) : (db.data.memberDir || {})[key]) || {}).codename;
  const id = () => crypto.randomBytes(5).toString('hex');
  const nu = () => new Date().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 200);

  function lijsten() {
    if (!Array.isArray(db.data.paspoortVerzoeken)) db.data.paspoortVerzoeken = [];
    if (!Array.isArray(db.data.paspoortIncidenten)) db.data.paspoortIncidenten = [];
    if (!Array.isArray(db.data.paspoortLog)) db.data.paspoortLog = [];
  }
  // Een sleutel ('user-<id>') terug naar het account. Alleen echte accounts
  // hebben een paspoort; persona's/gasten niet.
  function accountVanKey(key) {
    const m = /^user-(\d+)$/.exec(String(key || ''));
    if (!m) return null;
    try { return accounts.getUserById(Number(m[1])); } catch (e) { return null; }
  }
  function memberState(u) { try { return accounts.getMemberState(u.id) || {}; } catch (e) { return {}; } }
  function leeftijdVanAccount(u) {
    const geboren = (memberState(u) || {}).geboren || null;
    return geboren ? leeftijdVan(geboren) : null;
  }
  function log(entry) {
    lijsten();
    db.data.paspoortLog.unshift({ id: id(), at: nu(), ...entry });
    db.data.paspoortLog = db.data.paspoortLog.slice(0, 50000);
  }

  // De ja/nee-bevestiging: altijd beschikbaar, nooit met naam of foto.
  function bevestigingVan(u, minLeeftijd) {
    const lft = leeftijdVanAccount(u);
    const md = memberState(u);
    return {
      niveau: 'bevestiging',
      geverifieerd: u.verified === 'verified',
      gezichtGecontroleerd: !!md.faceMatch,      // selfie x paspoort door RTG gematcht
      codenaamGebonden: true,                     // codenaam en paspoort horen bij hetzelfde account
      voldoetLeeftijd: minLeeftijd != null ? (lft != null && lft >= minLeeftijd) : null,
      minLeeftijd: minLeeftijd != null ? minLeeftijd : null
    };
  }

  // De inhoud die een partner na goedkeuring (of na een vrijgegeven incident) ziet.
  function inhoudVoor(u, niveau) {
    const md = memberState(u);
    const geboren = md.geboren || null;
    const lft = geboren ? leeftijdVan(geboren) : null;
    if (niveau === 'idkaart') {
      // pasfoto: bij voorkeur de geverifieerde selfie, anders de paspoortscan
      const fotoBron = md.selfie || u.id_doc || null;
      return {
        niveau: 'idkaart',
        naam: accounts.realNameOf(u),
        nationaliteit: md.nationaliteit || null,
        geboortedatum: geboren,
        leeftijd: lft,
        foto: fotoBron ? leesUploadDataUrl(fotoBron) : null,
        geverifieerd: u.verified === 'verified',
        gezichtGecontroleerd: !!md.faceMatch
      };
    }
    if (niveau === 'paspoort') {
      return {
        niveau: 'paspoort',
        naam: accounts.realNameOf(u),
        nationaliteit: md.nationaliteit || null,
        geboortedatum: geboren,
        leeftijd: lft,
        foto: md.selfie ? leesUploadDataUrl(md.selfie) : null,
        scan: u.id_doc ? leesUploadDataUrl(u.id_doc) : null,
        geverifieerd: u.verified === 'verified',
        gezichtGecontroleerd: !!md.faceMatch
      };
    }
    return bevestigingVan(u);
  }

  // wat een lid (in de app) van zijn eigen verificatie ziet

  /* De toezicht- en verzoekenlaag draaien als submodules op een gedeelde
     context, een keer opgebouwd bij het opstarten; de toezichtlaag gaat
     eerst de context in omdat de verzoekenketen publiekVerzoek gebruikt. */
  const ctx = { db, save, crypto, accounts, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice,
    leesUploadDataUrl, leeftijdVan, gidsHaal, NIVEAUS, VIEW_TTL_MS, KIND_GRENS,
    lijsten, accountVanKey, memberState, leeftijdVanAccount, log, bevestigingVan, inhoudVoor, codenaamUitGids, id, schoon, nu };
  const deelToezicht = require('./paspoort/toezicht')(ctx);
  Object.assign(ctx, deelToezicht);
  const deelVerzoeken = require('./paspoort/verzoeken')(ctx);
  const { dienIncidentIn, beoordeelIncident, publiekVerzoek, publiekIncident, vervalOpschonen, mijnVerzoeken, partnerVerzoeken, incidentenVoorOffice } = deelToezicht;
  const { mijnStatus, vraag, beslis, trekIn, bekijk } = deelVerzoeken;

  return {
    NIVEAUS, mijnStatus, vraag, beslis, trekIn, bekijk,
    dienIncidentIn, beoordeelIncident, mijnVerzoeken, partnerVerzoeken,
    incidentenVoorOffice, vervalOpschonen
  };
}

module.exports = { PASPOORT_NIVEAUS: NIVEAUS, maakPaspoort };
