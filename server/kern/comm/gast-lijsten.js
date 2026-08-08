/* DE TWEE LIJSTEN VAN HET GASTCONTACT: het zaakscherm en de gegevensuitvoer.

   Ze lazen allebei rechtstreeks in db.data.guestChats. Nu lezen ze uit de kern,
   en dat is meer dan een verplaatsing: de zaak krijgt ALLEEN de gesprekken waar
   haar eigen sleutel in zit, en dat is dezelfde poort die de rest van de kern
   gebruikt -- geen filter op een veld dat iemand kan vergeten.

   Ze staan hier bij elkaar omdat ze allebei op dezelfde val staan (zie
   haalBinnen hieronder): een lijst uit de kern ziet alleen wat al verhuisd IS,
   terwijl de lijst nu juist de enige manier is om een gesprek te openen. */
'use strict';

function maakGastLijsten({ db, comm, lijnSleutel, codeVan, zaakVan, kantVan, oudeVorm, gesprek }) {
  /* DE BELANGRIJKSTE REGEL VAN DIT BESTAND.

     De import gebeurt per lijn, op het moment dat die lijn wordt geopend. Dat
     is bij ./dm.js en ./collega.js precies goed: daar is de lijst opgebouwd
     uit iets anders (de vriendenlijst, de personeelslijst) en wordt elke lijn
     onderweg aangeraakt. Hier niet. Een lijst die rechtstreeks uit de kern
     komt, ziet alleen wat al verhuisd IS -- en de lijst is nu juist de enige
     manier om een gesprek te openen.

     Het gevolg zou zijn: op de dag van de verhuizing staat het gastenscherm
     van elke zaak LEEG, en elk gesprek lijkt weg. Niet stuk, niet te
     herstellen door te wachten -- gewoon onbereikbaar, want de deur die je
     nodig hebt om te importeren is de deur die je niet meer kunt vinden.

     Vandaar dat de lijst zijn eigen voorraad eerst binnenhaalt. Begrensd tot
     wat bij DEZE zaak of DIT lid hoort, dus het blijft een verhuizing op
     aanraking en geen script over de hele database. */
  function haalBinnen(mij, filter) {
    let oud = null;
    try { oud = db.data.guestChats || {}; } catch (e) { return; }
    /* Wat er AL is, in een keer opgehaald. Zonder deze verzameling zou elke
       oude regel opnieuw langs gesprekMaak() gaan om te ontdekken dat hij er
       al staat -- en die zoekt zelf ook de hele lijst af. Op een scherm dat
       bij elke verversing langskomt is dat het verschil tussen een wandeling
       en een wandeling per stap. */
    const binnen = new Set();
    for (const g of comm.inbox(mij, {}).gesprekken) {
      const kern = comm.gesprekVan(g.id);
      if (kern && kern.meta && kern.meta.sleutel) binnen.add(kern.meta.sleutel);
    }
    for (const [sleutel, chat] of Object.entries(oud)) {
      const stuk = String(sleutel).split('|');
      if (stuk.length < 3 || !chat) continue;
      const [code, lidKey, dept] = [stuk[0], stuk[1], stuk.slice(2).join('|')];
      if (!filter(code, lidKey)) continue;
      if (binnen.has('gast:' + lijnSleutel(code, lidKey, dept))) continue;
      gesprek(code, lidKey, dept, { codename: chat.codename || null });
    }
  }

  function voorZaak(code) {
    const c = codeVan(code), mij = zaakVan(c);
    haalBinnen(mij, (k) => codeVan(k) === c);
    const uit = [];
    for (const g of comm.inbox(mij, {}).gesprekken) {
      const kern = comm.gesprekVan(g.id);
      if (!kern || !kern.meta || kern.meta.bron !== 'Zaak') continue;
      const lidKey = kern.deelnemers.find((d) => d !== mij) || '';
      const lijst = comm.berichtenVan(g.id).filter((m) => !m.weg);
      if (!lijst.length) continue;
      const laatste = lijst[lijst.length - 1];
      uit.push({ key: 'gast:' + lijnSleutel(c, lidKey, kern.meta.dept), gesprekId: g.id,
        codename: kern.meta.codename || g.titel, dept: kern.meta.dept || 'Team',
        unread: g.ongelezen, last: String(laatste.tekst || '').slice(0, 60),
        lastFrom: kantVan(laatste, lidKey), lastAt: g.at });
    }
    return uit.sort((a, b) => String(b.lastAt || '').localeCompare(String(a.lastAt || '')));
  }

  /* Alles wat dit lid met zaken besproken heeft, voor de gegevensuitvoer
     (routes/member/privacy.js). Die uitvoer is een RECHT en geen extraatje:
     mist er een gesprek, dan is het antwoord op "wat heeft u van mij"
     onvolledig, en dat merkt niemand tot het te laat is. */
  function voorLid(lidKey) {
    const uit = {};
    haalBinnen(String(lidKey), (c, k) => k === String(lidKey));
    for (const g of comm.inbox(String(lidKey), {}).gesprekken) {
      const kern = comm.gesprekVan(g.id);
      if (!kern || !kern.meta || kern.meta.bron !== 'Zaak') continue;
      const sleutel = lijnSleutel(kern.meta.zaak, lidKey, kern.meta.dept);
      uit[sleutel] = {
        supplierCode: kern.meta.zaak, customerKey: String(lidKey),
        codename: kern.meta.codename || null, tier: kern.meta.tier || null,
        dept: kern.meta.dept || 'Team', lastAt: g.at,
        messages: comm.berichtenVan(g.id).filter((m) => !m.weg).map((m) => oudeVorm(m, String(lidKey)))
      };
    }
    return uit;
  }

  return { haalBinnen, voorZaak, voorLid };
}

module.exports = { maakGastLijsten };
