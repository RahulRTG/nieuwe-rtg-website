/* Kern-module "postdatum": de datums die in uw eigen post staan, als VOORSTEL.

   HET GAT DAT DIT DICHT. De Control Tower (kern/levensgraaf) vult zich vanzelf
   met wat u op dit platform doet: een boeking die u plaatst, een afspraak die u
   zet, een paspoort dat u scant. Maar de meeste datums in een mensenleven komen
   niet uit een formulier -- ze komen per post. "Uw afspraak staat op 14
   september om 19:30." Die staat dan in een bericht dat u een keer leest, en
   daarna nergens meer.

   WAT DIT WEL DOET EN WAT NIET. Het leest UW EIGEN postvak (RTMAIL), wijst de
   datums aan die het herkent, en zet ze klaar met de ZIN waar ze uit komen. Meer
   niet. Er gaat NIETS vanzelf in uw agenda en NIETS vanzelf in de tower. U
   bevestigt, of u legt het weg.

   WAAROM DIE KNOP ER MOET ZIJN, en dit niet gewoon automatisch gaat: een datum
   uit gewone taal geraden staat vroeg of laat op de verkeerde dag, en een tower
   die dat ongezien opneemt is onbetrouwbaar geworden zonder dat iemand het merkt.
   Dezelfde afweging als bij de paspoortscan, waar de ICAO-controlecijfers moeten
   kloppen voordat er iets wordt ingevuld -- alleen bestaat er voor een zin geen
   controlecijfer. Dus doet een mens dat.

   WAAR HET DAN HEEN GAAT. Naar de AGENDA, en nergens anders. Dat is met opzet:
   de agenda is de app die afspraken beheert, en de levensgraaf leest hem al. Er
   komt dus geen tweede opslag bij waarin dezelfde datum nog een keer staat (lat,
   regel 4). Een aangenomen voorstel is een gewone agenda-afspraak met
   `bron: 'post:<berichtid>'` erop -- dat veld is meteen het antwoord op "welke
   voorstellen zijn al gedaan".

   WAT ER WEL WORDT BEWAARD: welke berichten u hebt WEGGELEGD. Dat is een besluit
   en staat nergens anders; zonder die lijst komt hetzelfde voorstel elke dag
   terug en klikt u het elke dag opnieuw weg.

   EEN POSTVAK, EEN EIGENAAR. Dit leest nooit andermans post: het adres komt uit
   kern/rtmail-wie.js (uit de sessie, nooit uit de body) en de agenda uit de
   sleutelregel in kern/agenda.js. Beide kanten -- lid en zaak -- gebruiken
   dezelfde functies hieronder; alleen het adres en de agendasleutel verschillen.

   Gemount vanuit opzet/kernlaag*.js. De tekstlezer staat in
   ./postdatum-lezer.js en kent geen database. */
'use strict';

const lezer = require('./postdatum-lezer');

// hoeveel berichten er per keer worden gelezen. Ruim voor een postvak dat
// bijgehouden wordt, en begrensd zodat dit scherm niet met het postvak meegroeit.
const BERICHTEN = 40;
// hoeveel weggelegde berichten we per eigenaar onthouden
const NEGEER_MAX = 500;

module.exports = ({ db, save, rtmail, agenda, vandaag }) => {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/postdatum', bezit: { postdatums: 'kaart' } });
  const dag = typeof vandaag === 'function' ? vandaag : () => new Date().toISOString().slice(0, 10);
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const bronVan = (berichtId) => 'post:' + berichtId;

  function store() {
    return eigen.bak('postdatums');
  }
  function weggelegd(eigenaar, maken) {
    const s = store();
    if (!Array.isArray(s[eigenaar])) { if (!maken) return []; s[eigenaar] = []; }
    return s[eigenaar];
  }

  /* Welke berichten al een besluit hebben gehad. AANGENOMEN wordt afgeleid uit de
     agenda zelf en niet apart bijgehouden -- die afspraak IS het besluit, en een
     tweede lijst ernaast zou er precies zolang mee overeenkomen tot iemand de
     afspraak weggooit. */
  function besloten(eigenaar) {
    const uit = new Set(weggelegd(eigenaar, false));
    for (const i of agenda.lijst(eigenaar)) {
      if (i.bron && String(i.bron).startsWith('post:')) uit.add(String(i.bron).slice(5));
    }
    return uit;
  }

  /* DE VOORSTELLEN. Per bericht hoogstens wat de lezer erin vond, met de zin
     erbij. Berichten waarover al is besloten komen niet terug.

     `overgeslagen` telt wat de lezer NIET durfde: een datum die zowel dag-maand
     als maand-dag kon zijn, een 31 februari, iets van tien jaar verderop. Dat
     getal gaat mee naar het scherm, want een lijst die zwijgt over wat hij liet
     liggen, laat dat scherm "dit was alles" zeggen terwijl dat niet zo is. */
  function voorstellen(adres, eigenaar) {
    if (!adres || !eigenaar) return { voorstellen: [], gelezen: 0, overgeslagen: 0, besloten: 0 };
    const post = rtmail.postvak(adres, { limit: BERICHTEN });
    const klaar = besloten(eigenaar);
    const t = dag();
    const uit = [];
    let overgeslagen = 0, afgehandeld = 0;
    for (const m of post) {
      if (klaar.has(m.id)) { afgehandeld++; continue; }
      const r = lezer.lees(m.tekst, { vandaag: t });
      overgeslagen += r.overgeslagen.length;
      if (!r.datums.length) continue;
      uit.push({
        id: m.id,
        van: m.van,
        onderwerp: m.onderwerp,
        at: m.at,
        /* Of de afzender bewezen is. Post van buiten is per definitie
           onbetrouwd (kern/rtmail.js), en dat hoort bij een voorstel te staan:
           iedereen kan een mail sturen waarin een datum staat. */
        vertrouwd: !!m.vertrouwd,
        bron: m.bron,
        datums: r.datums
      });
    }
    return { voorstellen: uit, gelezen: post.length, overgeslagen, besloten: afgehandeld };
  }

  /* EEN VOORSTEL AANNEMEN. De datum moet er een zijn die voor DIT bericht ook
     echt is voorgesteld -- anders is `bron: 'post:...'` een bewering die niet
     klopt, en dan staat er straks een afspraak in de agenda die zegt uit uw post
     te komen terwijl niemand hem daar heeft gezien. */
  async function neem(adres, eigenaar, { id, datum, titel } = {}) {
    if (!adres || !eigenaar) return { error: 'Geen postvak voor deze inlog.' };
    const berichtId = String(id || '');
    if (besloten(eigenaar).has(berichtId)) return { error: 'Over dit bericht is al besloten.' };
    const post = rtmail.postvak(adres, { limit: BERICHTEN });
    const m = post.find(x => x.id === berichtId);
    if (!m) return { error: 'Dat bericht staat niet in uw postvak.' };
    const r = lezer.lees(m.tekst, { vandaag: dag() });
    const gekozen = r.datums.find(d => d.datum === String(datum || ''));
    if (!gekozen) return { error: 'Die datum staat niet in dit bericht.' };

    const r2 = await agenda.voegToe(eigenaar, {
      titel: schoon(titel, 120) || schoon(m.onderwerp, 120) || 'Uit uw post',
      datum: gekozen.datum,
      tijd: gekozen.tijd,
      /* De zin gaat mee als notitie. Zo blijft ook over een half jaar te zien
         waar deze afspraak vandaan kwam, en hoeft niemand het bericht terug te
         zoeken om te weten of de datum klopte. */
      notitie: 'Uit uw post (' + m.van + '): ' + gekozen.zin,
      bron: bronVan(berichtId)
    });
    if (r2.error) return r2;
    return { ok: true, item: r2.item };
  }

  /* EEN VOORSTEL WEGLEGGEN. Het bericht blijft staan; alleen dit scherm houdt
     er zijn mond over. */
  function negeer(eigenaar, id) {
    if (!eigenaar) return { error: 'Geen postvak voor deze inlog.' };
    const berichtId = String(id || '');
    if (!berichtId) return { error: 'Welk bericht?' };
    const lijst = weggelegd(eigenaar, true);
    if (!lijst.includes(berichtId)) {
      lijst.push(berichtId);
      if (lijst.length > NEGEER_MAX) lijst.splice(0, lijst.length - NEGEER_MAX);
      save();
    }
    return { ok: true };
  }

  return { voorstellen, neem, negeer, BERICHTEN };
};
