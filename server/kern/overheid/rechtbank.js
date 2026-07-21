/* Overheid-domein "rechtbank": De Rechtspraak -- het meest complete en slimme
   rechtbanksysteem van het platform. De griffie brengt zaken aan (op codenaam,
   privacy by design), de zittingsrol plant per zaal en rechter, en de uitspraak
   is ALTIJD het besluit van een menselijke rechter -- daarna gaat het dossier
   dicht en wijzigt er niets meer. De AI-griffier (Rahul) helpt met het beeld,
   de voorbereiding en de rol, maar oordeelt nooit en geeft partijen geen
   juridisch advies.

   De samenwerking zit ingebouwd: een ongegrond verklaard bezwaar (bestuur.js)
   kan als beroep de rechtbank in (door de griffie of door de inwoner zelf via
   MijnOverheid), elke stap landt in de Berichtenbox van de partijen, en de
   zittingsrol voedt de bode-taken van de Overheids-PDA (pda.js).
   Krijgt de gedeelde ctx van kern/overheid/index.js. */

const ZAAKTYPEN = {
  bestuur: 'Bestuursrecht (beroep)', civiel: 'Civiel recht',
  kanton: 'Kantonzaken', familie: 'Familie en jeugd'
};
const ZAAK_STATUS = ['aangebracht', 'gepland', 'uitspraak'];
const ZALEN = ['Zittingszaal A', 'Zittingszaal B', 'Zittingszaal C', 'Raadkamer'];
const BESLISSINGEN = ['gegrond', 'ongegrond', 'toegewezen', 'afgewezen', 'geschikt'];

module.exports = (ctx) => {
  const { db, save, anthropic, nu, id, ref, schoon, seed, bericht } = ctx;

  const zaken = () => { seed(); if (!Array.isArray(db.data.rijkZaken)) db.data.rijkZaken = []; return db.data.rijkZaken; };
  const vind = r => zaken().find(z => z.ref === String(r || ''));
  const dagen = iso => Math.floor((Date.now() - new Date(iso || 0)) / 86400000);
  const vandaag = () => new Date().toISOString().slice(0, 10);

  function publiek(z) {
    return { ref: z.ref, type: z.type, typeLabel: ZAAKTYPEN[z.type], titel: z.titel, omschrijving: z.omschrijving,
      eiser: z.eiser.codenaam, verweerder: z.verweerder, status: z.status,
      zitting: z.zitting ? { datum: z.zitting.datum, tijd: z.zitting.tijd, zaal: z.zitting.zaal, rechter: z.zitting.rechter, klaargezet: !!z.zitting.klaargezet } : null,
      uitspraak: z.uitspraak ? { beslissing: z.uitspraak.beslissing, motivatie: z.uitspraak.motivatie, rechter: z.uitspraak.rechter, at: z.uitspraak.at } : null,
      bron: z.bron || null, dagen: dagen(z.at), at: z.at };
  }

  /* ---- de griffie: zaken aanbrengen ---- */
  function rbZaakMaak(actor, data) {
    data = data || {};
    const type = ZAAKTYPEN[data.type] ? data.type : 'civiel';
    const titel = schoon(data.titel, 120);
    if (titel.length < 3) return { status: 400, error: 'Geef de zaak een duidelijke titel.' };
    const z = { id: id(), ref: ref('ZK'), type, titel, omschrijving: schoon(data.omschrijving, 800),
      eiser: { key: data.eiserKey || null, codenaam: schoon(data.eiser, 60) || 'Onbekende partij' },
      verweerder: schoon(data.verweerder, 60) || 'Onbekende partij',
      status: 'aangebracht', zitting: null, uitspraak: null, bron: data.bron || null, door: actor || 'griffie', at: nu() };
    zaken().unshift(z);
    db.data.rijkZaken = zaken().slice(0, 40000);
    if (z.eiser.key) bericht(z.eiser.key, 'De Rechtspraak', 'Zaak aangebracht', 'Je zaak "' + titel + '" is aangebracht bij de rechtbank (' + z.ref + '). Je ontvangt hier de zittingsdatum.', 'rechtbank');
    save();
    return { ok: true, zaak: publiek(z) };
  }

  /* ---- de samenwerking: een ongegrond bezwaar gaat als beroep de rechtbank in ---- */
  function beroep(actorOfSess, bezwaarRef, viaLid) {
    const b = (db.data.rijkBezwaren || []).find(x => x.ref === String(bezwaarRef || ''));
    if (!b) return { status: 404, error: 'Bezwaar niet gevonden.' };
    if (viaLid && b.key !== viaLid.key) return { status: 404, error: 'Bezwaar niet gevonden.' };
    if (b.status !== 'ongegrond') return { status: 409, error: 'Beroep kan alleen tegen een ongegrond verklaard bezwaar.' };
    if (b.beroepRef) return { status: 409, error: 'Voor dit bezwaar loopt al een beroep (' + b.beroepRef + ').' };
    const r = rbZaakMaak(viaLid ? 'MijnOverheid' : actorOfSess, {
      type: 'bestuur', titel: 'Beroep: ' + b.tegen, omschrijving: b.reden,
      eiser: b.codenaam, eiserKey: b.key, verweerder: 'Rijksoverheid',
      bron: { soort: 'bezwaar', ref: b.ref } });
    if (r.error) return r;
    b.beroepRef = r.zaak.ref;
    save();
    return r;
  }
  const rbBeroep = (actor, bezwaarRef) => beroep(actor, bezwaarRef, null);
  const beroepIndienen = (sess, bezwaarRef) => beroep(null, bezwaarRef, sess);
  function mijnZaken(key) {
    return { ok: true, zaken: zaken().filter(z => z.eiser.key === key).slice(0, 30).map(publiek) };
  }

  /* ---- de zittingsrol: plannen per zaal en rechter ---- */
  function rbZitting(actor, r, data) {
    data = data || {};
    const z = vind(r);
    if (!z) return { status: 404, error: 'Zaak niet gevonden.' };
    if (z.status === 'uitspraak') return { status: 409, error: 'Na de uitspraak gaat het dossier in het archief; er wordt niets meer gepland.' };
    const datum = String(data.datum || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return { status: 400, error: 'Kies een zittingsdatum (jjjj-mm-dd).' };
    const tijd = /^\d{2}:\d{2}$/.test(String(data.tijd || '')) ? data.tijd : '10:00';
    const zaal = ZALEN.includes(data.zaal) ? data.zaal : ZALEN[0];
    // een zaal is geen dubbelboeking waard: zelfde zaal, datum en tijd is bezet
    const bezet = zaken().some(x => x.ref !== z.ref && x.zitting && x.zitting.datum === datum && x.zitting.tijd === tijd && x.zitting.zaal === zaal);
    if (bezet) return { status: 409, error: zaal + ' is op ' + datum + ' om ' + tijd + ' al bezet; kies een ander moment.' };
    z.zitting = { datum, tijd, zaal, rechter: schoon(data.rechter, 60) || 'de rechter', klaargezet: false, door: actor || 'griffie', at: nu() };
    z.status = 'gepland';
    if (z.eiser.key) bericht(z.eiser.key, 'De Rechtspraak', 'Zitting gepland', 'Je zaak "' + z.titel + '" (' + z.ref + ') staat op de rol: ' + datum + ' om ' + tijd + ' in ' + zaal + '.', 'rechtbank');
    save();
    return { ok: true, zaak: publiek(z) };
  }
  function rbRol(datum) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(String(datum || '')) ? datum : vandaag();
    const rol = zaken().filter(z => z.zitting && z.zitting.datum === d && z.status === 'gepland')
      .sort((a, b) => (a.zitting.zaal + a.zitting.tijd).localeCompare(b.zitting.zaal + b.zitting.tijd)).map(publiek);
    return { ok: true, datum: d, zalen: ZALEN, rol };
  }

  /* ---- de uitspraak: ALTIJD het besluit van een menselijke rechter ---- */
  function rbUitspraak(actor, r, data) {
    data = data || {};
    const z = vind(r);
    if (!z) return { status: 404, error: 'Zaak niet gevonden.' };
    if (z.status === 'uitspraak') return { status: 409, error: 'In deze zaak is al uitspraak gedaan; het dossier is gesloten.' };
    if (z.status !== 'gepland') return { status: 409, error: 'Eerst een zitting op de rol, dan pas een uitspraak.' };
    if (!BESLISSINGEN.includes(data.beslissing)) return { status: 400, error: 'Kies een geldige beslissing (' + BESLISSINGEN.join(', ') + ').' };
    const motivatie = schoon(data.motivatie, 800);
    if (motivatie.length < 10) return { status: 400, error: 'Een uitspraak draagt altijd een motivatie.' };
    z.uitspraak = { beslissing: data.beslissing, motivatie, rechter: actor || 'de rechter', at: nu() };
    z.status = 'uitspraak';
    if (z.eiser.key) bericht(z.eiser.key, 'De Rechtspraak', 'Uitspraak in je zaak', 'De rechter heeft uitspraak gedaan in "' + z.titel + '" (' + z.ref + '): ' + data.beslissing + '. Motivatie: ' + motivatie, 'rechtbank');
    save();
    return { ok: true, zaak: publiek(z) };
  }

  /* ---- de cockpit: het hele huis in een oogopslag ---- */
  function rbCockpit() {
    const alle = zaken();
    const perStatus = {}, perType = {};
    for (const z of alle) { perStatus[z.status] = (perStatus[z.status] || 0) + 1; perType[z.type] = (perType[z.type] || 0) + 1; }
    const klaar = alle.filter(z => z.uitspraak);
    const doorloop = klaar.length ? Math.round(klaar.reduce((s, z) => s + Math.max(0, (new Date(z.uitspraak.at) - new Date(z.at)) / 86400000), 0) / klaar.length) : 0;
    const signalen = [];
    for (const z of alle) {
      if (z.status === 'aangebracht' && dagen(z.at) > 30)
        signalen.push({ soort: 'rol', ref: z.ref, tekst: '"' + z.titel + '" wacht al ' + dagen(z.at) + ' dagen op een zittingsdatum.' });
      if (z.status === 'gepland' && z.zitting.datum === vandaag() && !z.zitting.klaargezet)
        signalen.push({ soort: 'bode', ref: z.ref, tekst: z.zitting.zaal + ' om ' + z.zitting.tijd + ' is nog niet klaargezet door de bode.' });
    }
    const beroepenWachtend = (db.data.rijkBezwaren || []).filter(b => b.status === 'ongegrond' && !b.beroepRef).length;
    return { ok: true, zaken: alle.length, perStatus, perType, doorloopDagen: doorloop,
      rolVandaag: rbRol().rol.length, beroepenWachtend, signalen: signalen.slice(0, 40),
      zaaktypen: ZAAKTYPEN, zalen: ZALEN, beslissingen: BESLISSINGEN };
  }
  function rbZaken(filter) {
    filter = filter || {};
    let lijst = zaken();
    if (ZAAK_STATUS.includes(filter.status)) lijst = lijst.filter(z => z.status === filter.status);
    if (ZAAKTYPEN[filter.type]) lijst = lijst.filter(z => z.type === filter.type);
    return { ok: true, zaken: lijst.slice(0, 200).map(publiek) };
  }

  /* ---- de AI-griffier: helpt met het beeld, oordeelt nooit ---- */
  async function rbAI(vraag) {
    const c = rbCockpit();
    const beeld = c.zaken + ' zaken (' + Object.entries(c.perStatus).map(([k, v]) => v + ' ' + k).join(', ') + '), ' +
      c.rolVandaag + ' op de rol van vandaag, gemiddelde doorlooptijd ' + c.doorloopDagen + ' dagen, ' +
      c.beroepenWachtend + ' ongegronde bezwaren zonder beroep. Signalen: ' +
      (c.signalen.length ? c.signalen.slice(0, 5).map(s => s.tekst).join(' | ') : 'geen') + '.';
    const q = schoon(vraag, 400);
    if (anthropic && q) {
      try {
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 350,
          system: require('../rahul').RAHUL_LEAD + 'je bent de AI-griffier van De Rechtspraak op het RTG-platform. ' +
            'Je helpt de griffie en de rechters met de rol, de planning en de voorbereiding van zittingen, kort en precies. ' +
            'Je oordeelt NOOIT over een zaak en doet geen uitspraak: de rechter beslist altijd zelf. ' +
            'Je geeft partijen geen juridisch advies; dit is het interne huis. Huidige beeld: ' + beeld,
          messages: [{ role: 'user', content: q }]
        });
        const tekst = r.content && r.content[0] && r.content[0].text;
        if (tekst) return { ok: true, antwoord: tekst };
      } catch (e) { /* val terug */ }
    }
    return { ok: true, demo: true, antwoord: 'Het beeld van vandaag: ' + beeld + ' Mijn advies: plan eerst de zaken die het langst wachten, en loop de rol van vandaag na met de bode. Oordelen doet de rechter zelf.' };
  }

  return { rbCockpit, rbZaken, rbZaakMaak, rbBeroep, rbZitting, rbRol, rbUitspraak, rbAI,
    beroepIndienen, mijnZaken, RB_ZALEN: ZALEN, RB_ZAAKTYPEN: ZAAKTYPEN };
};
