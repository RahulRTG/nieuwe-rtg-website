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
  function mijnStatus(key) {
    const u = accountVanKey(key);
    if (!u) return { account: false };
    const md = memberState(u);
    return {
      account: true,
      geverifieerd: u.verified,                 // unverified | pending | verified | rejected
      selfieAanwezig: !!md.selfie,
      gezichtGecontroleerd: !!md.faceMatch,
      nationaliteit: md.nationaliteit || null,
      leeftijd: leeftijdVanAccount(u)
    };
  }

  /* ---- de partner vraagt een identiteit op ---- */
  function vraag(supplier, key, niveau, actor, opts) {
    lijsten();
    const nv = NIVEAUS.includes(niveau) ? niveau : 'bevestiging';
    const u = accountVanKey(key);
    if (!u) return { status: 404, error: 'Dit lid heeft geen RTG-geverifieerd paspoort.' };
    const minLeeftijd = opts && opts.minLeeftijd != null ? Math.max(0, Math.min(99, parseInt(opts.minLeeftijd, 10) || 0)) : null;
    const codenaam = codenaamUitGids(key) || (typeof opts === 'object' && opts.codenaam) || null;
    // bescherming minderjarigen: identiteit van een kind (t/m 15) delen we nooit
    const lft = leeftijdVanAccount(u);
    if (nv !== 'bevestiging' && lft != null && lft <= KIND_GRENS) {
      return { status: 403, error: 'Bescherming minderjarigen: de identiteit van dit lid wordt niet gedeeld.' };
    }
    const bevestiging = bevestigingVan(u, minLeeftijd);
    // niveau 'bevestiging': meteen terug, wel een melding aan het lid (transparant)
    if (nv === 'bevestiging') {
      log({ soort: 'bevestiging', supplierCode: supplier.code, key, codenaam, door: (actor && actor.name) || 'Team' });
      notify(key, { icon: '🪪', title: supplier.name, body: 'controleerde uw verificatiestatus (ja/nee, geen gegevens gedeeld).', scope: 'privacy' });
      sseToCustomer(key, 'sync', { scope: 'paspoort' });
      return { ok: true, niveau: 'bevestiging', bevestiging };
    }
    // idkaart/paspoort kan alleen als het lid geverifieerd is
    if (u.verified !== 'verified') {
      return { status: 409, error: 'Dit lid is (nog) niet RTG-geverifieerd; alleen de ja/nee-bevestiging is beschikbaar.' };
    }
    const verzoek = {
      id: id(), supplierCode: supplier.code, supplierName: supplier.name,
      key, codenaam, niveau: nv, status: 'aangevraagd',
      reden: schoon(opts && opts.reden, 200), door: (actor && actor.name) || 'Team',
      incident: false, at: nu(), beslistAt: null, vervalt: null
    };
    db.data.paspoortVerzoeken.unshift(verzoek);
    db.data.paspoortVerzoeken = db.data.paspoortVerzoeken.slice(0, 50000);
    log({ soort: 'aanvraag', verzoekId: verzoek.id, niveau: nv, supplierCode: supplier.code, key, codenaam, door: verzoek.door });
    save();
    notify(key, {
      icon: '🪪', title: supplier.name + ' vraagt uw ' + (nv === 'paspoort' ? 'paspoort' : 'ID-kaart'),
      body: (verzoek.reden ? verzoek.reden + ' · ' : '') + 'U kunt dit goedkeuren of weigeren in de app.', scope: 'privacy'
    });
    sseToCustomer(key, 'sync', { scope: 'paspoort' });
    sseToSupplier(supplier.code, 'sync', { scope: 'paspoort' });
    return { ok: true, niveau: nv, bevestiging, verzoek: publiekVerzoek(verzoek) };
  }

  /* ---- het lid keurt goed of weigert ---- */
  function beslis(key, verzoekId, akkoord) {
    lijsten();
    const v = db.data.paspoortVerzoeken.find(x => x.id === verzoekId && x.key === key);
    if (!v) return { status: 404, error: 'Verzoek niet gevonden.' };
    if (v.status !== 'aangevraagd') return { status: 409, error: 'Dit verzoek is al afgehandeld.' };
    v.beslistAt = nu();
    if (akkoord) {
      v.status = 'goedgekeurd';
      v.vervalt = new Date(Date.now() + VIEW_TTL_MS).toISOString();
      notifySupplier(v.supplierCode, { icon: '✅', title: 'Identiteit gedeeld', body: (v.codenaam || 'Een lid') + ' keurde uw ' + (v.niveau === 'paspoort' ? 'paspoort' : 'ID-kaart') + '-verzoek goed.' });
    } else {
      v.status = 'geweigerd';
      notifySupplier(v.supplierCode, { icon: '⛔', title: 'Verzoek geweigerd', body: (v.codenaam || 'Een lid') + ' weigerde uw identiteitsverzoek.' });
    }
    log({ soort: akkoord ? 'goedgekeurd' : 'geweigerd', verzoekId: v.id, niveau: v.niveau, supplierCode: v.supplierCode, key });
    save();
    sseToSupplier(v.supplierCode, 'sync', { scope: 'paspoort' });
    sseToCustomer(key, 'sync', { scope: 'paspoort' });
    return { ok: true, status: v.status };
  }

  // het lid trekt een eerder gegeven goedkeuring weer in
  function trekIn(key, verzoekId) {
    lijsten();
    const v = db.data.paspoortVerzoeken.find(x => x.id === verzoekId && x.key === key);
    if (!v) return { status: 404, error: 'Verzoek niet gevonden.' };
    if (v.status !== 'goedgekeurd') return { status: 409, error: 'Alleen een lopende goedkeuring kan worden ingetrokken.' };
    v.status = 'ingetrokken'; v.vervalt = null;
    log({ soort: 'ingetrokken', verzoekId: v.id, supplierCode: v.supplierCode, key });
    save();
    sseToSupplier(v.supplierCode, 'sync', { scope: 'paspoort' });
    return { ok: true };
  }

  /* ---- de partner bekijkt een goedgekeurde (of vrijgegeven) inzage ---- */
  function bekijk(supplier, verzoekId, actor) {
    lijsten();
    const v = db.data.paspoortVerzoeken.find(x => x.id === verzoekId && x.supplierCode === supplier.code);
    if (!v) return { status: 404, error: 'Verzoek niet gevonden.' };
    if (v.status !== 'goedgekeurd') return { status: 403, error: 'Dit verzoek is niet (meer) goedgekeurd.' };
    if (v.vervalt && new Date(v.vervalt).getTime() < Date.now()) {
      v.status = 'verlopen'; save();
      return { status: 410, error: 'De inzage is verlopen. Vraag het lid opnieuw.' };
    }
    const u = accountVanKey(v.key);
    if (!u) return { status: 404, error: 'Account niet gevonden.' };
    log({ soort: 'inzage', verzoekId: v.id, niveau: v.niveau, supplierCode: supplier.code, key: v.key, door: (actor && actor.name) || 'Team' });
    save();
    return { ok: true, verzoek: publiekVerzoek(v), inhoud: inhoudVoor(u, v.niveau) };
  }

  /* ---- incident: de partner eist het op; RTG-kantoor beoordeelt ---- */
  function dienIncidentIn(supplier, key, reden, niveau, actor) {
    lijsten();
    const u = accountVanKey(key);
    if (!u) return { status: 404, error: 'Dit lid heeft geen RTG-geverifieerd paspoort.' };
    const r = schoon(reden, 500);
    if (r.length < 10) return { status: 400, error: 'Beschrijf het incident (minstens 10 tekens).' };
    const nv = ['idkaart', 'paspoort'].includes(niveau) ? niveau : 'idkaart';
    const codenaam = codenaamUitGids(key) || null;
    const inc = {
      id: id(), supplierCode: supplier.code, supplierName: supplier.name,
      key, codenaam, reden: r, gevraagdNiveau: nv, status: 'ingediend',
      door: (actor && actor.name) || 'Team', at: nu(),
      beoordeeldDoor: null, beoordeeldAt: null, besluit: null, verzoekId: null
    };
    db.data.paspoortIncidenten.unshift(inc);
    db.data.paspoortIncidenten = db.data.paspoortIncidenten.slice(0, 50000);
    log({ soort: 'incident-ingediend', incidentId: inc.id, supplierCode: supplier.code, key, codenaam, door: inc.door });
    save();
    // het lid weet dat er een incident loopt; de identiteit is nog NIET vrijgegeven
    notify(key, { icon: '⚠️', title: 'Incident gemeld', body: supplier.name + ' meldde een incident. RTG beoordeelt het; uw identiteit is niet zomaar gedeeld.', scope: 'privacy' });
    sseToOffice('sync', { scope: 'incident' });
    sseToSupplier(supplier.code, 'sync', { scope: 'paspoort' });
    return { ok: true, incident: publiekIncident(inc) };
  }

  // RTG-kantoor beoordeelt: vrijgeven (maakt een goedgekeurde inzage aan) of afwijzen
  function beoordeelIncident(incidentId, besluit, beoordelaar) {
    lijsten();
    const inc = db.data.paspoortIncidenten.find(x => x.id === incidentId);
    if (!inc) return { status: 404, error: 'Incident niet gevonden.' };
    if (inc.status !== 'ingediend') return { status: 409, error: 'Dit incident is al beoordeeld.' };
    inc.beoordeeldAt = nu();
    inc.beoordeeldDoor = schoon(beoordelaar, 60) || 'RTG-kantoor';
    if (besluit === 'vrijgeven') {
      inc.status = 'vrijgegeven'; inc.besluit = 'vrijgeven';
      // een tijdgebonden inzage die de partner kan openen (na RTG-vrijgave, dus
      // zonder toestemming van het lid, maar volledig gelogd)
      const v = {
        id: id(), supplierCode: inc.supplierCode, supplierName: inc.supplierName,
        key: inc.key, codenaam: inc.codenaam, niveau: inc.gevraagdNiveau, status: 'goedgekeurd',
        reden: 'Incident: ' + inc.reden.slice(0, 120), door: 'RTG-kantoor', incident: true,
        at: nu(), beslistAt: nu(), vervalt: new Date(Date.now() + VIEW_TTL_MS).toISOString()
      };
      db.data.paspoortVerzoeken.unshift(v);
      inc.verzoekId = v.id;
      log({ soort: 'incident-vrijgegeven', incidentId: inc.id, verzoekId: v.id, supplierCode: inc.supplierCode, key: inc.key, door: inc.beoordeeldDoor });
      notifySupplier(inc.supplierCode, { icon: '🔓', title: 'Incident vrijgegeven', body: 'RTG gaf de identiteit voor uw incident vrij. U kunt de inzage 10 minuten openen.' });
      notify(inc.key, { icon: '🔓', title: 'Identiteit vrijgegeven', body: 'RTG gaf na beoordeling uw identiteit vrij aan ' + inc.supplierName + ' wegens het gemelde incident.', scope: 'privacy' });
      sseToCustomer(inc.key, 'sync', { scope: 'paspoort' });
    } else {
      inc.status = 'afgewezen'; inc.besluit = 'afwijzen';
      log({ soort: 'incident-afgewezen', incidentId: inc.id, supplierCode: inc.supplierCode, key: inc.key, door: inc.beoordeeldDoor });
      notifySupplier(inc.supplierCode, { icon: '⛔', title: 'Incident afgewezen', body: 'RTG wees uw incidentverzoek af; de identiteit wordt niet gedeeld.' });
    }
    sseToOffice('sync', { scope: 'incident' });
    sseToSupplier(inc.supplierCode, 'sync', { scope: 'paspoort' });
    save();
    return { ok: true, incident: publiekIncident(inc) };
  }

  /* ---- overzichten ---- */
  function publiekVerzoek(v) {
    return {
      id: v.id, supplierCode: v.supplierCode, supplierName: v.supplierName,
      codenaam: v.codenaam, niveau: v.niveau, status: v.status, reden: v.reden || '',
      incident: !!v.incident, at: v.at, beslistAt: v.beslistAt, vervalt: v.vervalt || null
    };
  }
  function publiekIncident(i) {
    return {
      id: i.id, supplierCode: i.supplierCode, supplierName: i.supplierName,
      codenaam: i.codenaam, reden: i.reden, gevraagdNiveau: i.gevraagdNiveau,
      status: i.status, door: i.door, at: i.at, beoordeeldDoor: i.beoordeeldDoor,
      beoordeeldAt: i.beoordeeldAt, besluit: i.besluit
    };
  }
  function vervalOpschonen() {
    lijsten();
    const nuMs = Date.now();
    let veranderd = false;
    for (const v of db.data.paspoortVerzoeken) {
      if (v.status === 'goedgekeurd' && v.vervalt && new Date(v.vervalt).getTime() < nuMs) { v.status = 'verlopen'; veranderd = true; }
    }
    if (veranderd) save();
  }
  function mijnVerzoeken(key) {
    lijsten();
    return db.data.paspoortVerzoeken.filter(v => v.key === key).slice(0, 60).map(publiekVerzoek);
  }
  function partnerVerzoeken(supplierCode) {
    lijsten(); vervalOpschonen();
    return {
      verzoeken: db.data.paspoortVerzoeken.filter(v => v.supplierCode === supplierCode).slice(0, 60).map(publiekVerzoek),
      incidenten: db.data.paspoortIncidenten.filter(i => i.supplierCode === supplierCode).slice(0, 40).map(publiekIncident)
    };
  }
  function incidentenVoorOffice(alleen) {
    lijsten();
    let lijst = db.data.paspoortIncidenten;
    if (alleen === 'open') lijst = lijst.filter(i => i.status === 'ingediend');
    return lijst.slice(0, 200).map(publiekIncident);
  }

  return {
    NIVEAUS, mijnStatus, vraag, beslis, trekIn, bekijk,
    dienIncidentIn, beoordeelIncident, mijnVerzoeken, partnerVerzoeken,
    incidentenVoorOffice, vervalOpschonen
  };
}

module.exports = { PASPOORT_NIVEAUS: NIVEAUS, maakPaspoort };
