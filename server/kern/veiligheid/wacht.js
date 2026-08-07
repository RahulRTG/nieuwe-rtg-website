/* De dodemansknop. Dit is het hart van "Naar huis" en van "Vitale check-in":
   twee schermen, maar onderhuids precies hetzelfde mechanisme.

   HET ONTWERP IN EEN ZIN: de klok loopt op de SERVER, niet op de telefoon.

   Waarom dat de hele zaak is. Een wekker in de app werkt alleen zolang de app
   leeft. Valt de telefoon uit -- batterij leeg, in het water, kapot, of iemand
   zet hem uit -- dan gaat een wekker in de app nooit af, en juist dan zou hij
   moeten afgaan. Hier is het omgekeerd: de server telt af, en de telefoon
   moet zich MELDEN om het alarm tegen te houden. Geen levensteken is dus zelf
   het signaal. Precies wat je wilt: stilte is verdacht.

   Daarom staat de laatst bekende plek ook op de server (zie plek.js). De
   telefoon hoeft op het moment van het alarm niet meer te leven; zijn laatste
   levensteken is genoeg.

   Twee treden, zie alarm.js: eerst een genadetijd met een por naar jezelf,
   daarna pas de kring. En een wacht loopt nooit stiekem door: elke wacht
   heeft een einde, en na het alarm stopt hij. */
module.exports = ({ db, save, crypto, schoon, alarm, plek, meldAan, sociaal }) => {
  const nu = () => new Date().toISOString();
  const MIN_MIN = 1;          // minstens een minuut (en dat is al kort)
  const MAX_MIN = 24 * 60;    // hoogstens een etmaal; langer is geen wacht meer
  const GENADE_STD = 10;      // minuten tussen "je bent over tijd" en de kring

  function lijst() {
    if (!db.data.veilig) db.data.veilig = {};
    if (!db.data.veilig.wachten) db.data.veilig.wachten = [];
    return db.data.veilig.wachten;
  }

  const LOOPT = ['loopt', 'genade'];
  const lopendeVan = (handle) => lijst().filter(w => w.handle === handle && LOOPT.includes(w.status));

  function toon(w) {
    return {
      id: w.id, soort: w.soort, label: w.label, status: w.status,
      deadline: w.deadline, genadeTot: w.genadeTot || null,
      gestart: w.gestart, laatsteCheck: w.laatsteCheck || null,
      herhaal: w.herhaal || null, marge: w.marge,
      restSec: Math.max(0, Math.round((new Date(w.status === 'genade' ? w.genadeTot : w.deadline).getTime() - Date.now()) / 1000))
    };
  }

  /* Een wacht starten.
       soort  'thuis'  -- ik ga op pad en ben over X minuten thuis
              'vitaal' -- ik meld me elke dag om deze tijd (medicatie, leven)
       minuten  de tijd tot de deadline
       marge    genadetijd in minuten voordat de kring aan de beurt is
       herhaal  alleen bij 'vitaal': elke N uur opnieuw */
  function wachtStart(handle, codenaam, body) {
    const w8 = lijst();
    const soort = body.soort === 'vitaal' ? 'vitaal' : 'thuis';
    const minuten = Math.max(MIN_MIN, Math.min(MAX_MIN, Math.round(Number(body.minuten) || 0)));
    if (!minuten) return { status: 400, error: 'Hoe lang duurt het voordat je je meldt?' };
    if (lopendeVan(handle).some(w => w.soort === soort))
      return { status: 409, error: soort === 'thuis' ? 'Er loopt al een wacht. Stop die eerst, of check in.' : 'Er loopt al een check-in. Stop die eerst.' };
    /* EEN WACHT ZONDER KRING WAAKT OVER NIEMAND.

       Trede 2 slaat alarm bij je kring. alarmSlaan weigert bij een lege kring,
       maar sweep() keek alleen naar `r && r.id` en zette de wacht toch op
       'alarm' -- dus stond er "alarm geslagen" terwijl er niemand gebeld was.
       Iemand die alleen thuiskomt en dit aanzet, denkt dat er iemand meekijkt.

       Hier is het nog te zeggen, en dat is het moment dat telt. */
    if (alarm.kringLeeg && alarm.kringLeeg(handle))
      return { status: 400, error: 'Je kring is leeg. Deze wacht waarschuwt je kring als je je niet meldt, dus zet daar eerst iemand in -- anders waakt hij over niemand.' };

    const marge = Math.max(0, Math.min(120, body.marge == null ? GENADE_STD : Math.round(Number(body.marge))));
    const w = {
      id: crypto.randomBytes(6).toString('hex'),
      handle, codenaam, soort,
      label: schoon(body.label, 80) || (soort === 'thuis' ? 'Onderweg naar huis' : 'Check-in'),
      minuten, marge,
      herhaal: soort === 'vitaal' && Number(body.herhaalUur) > 0 ? Math.min(168, Math.round(Number(body.herhaalUur))) : null,
      status: 'loopt',
      gestart: nu(),
      deadline: new Date(Date.now() + minuten * 60000).toISOString(),
      genadeTot: null, laatsteCheck: null
    };
    w8.push(w);
    /* Opruimen mag NOOIT een lopende wacht raken. Een simpele slice(-500) zou
       bij drukte de oudste rij afkappen, en dat kan een wacht zijn waar iemand
       op rekent: die verdwijnt dan zonder alarm, precies het ene dat niet mag
       gebeuren. We gooien daarom alleen AFGERONDE wachten weg. */
    if (w8.length > 500) {
      const lopend = w8.filter(x => LOOPT.includes(x.status) || x.status === 'alarm');
      const klaar = w8.filter(x => !LOOPT.includes(x.status) && x.status !== 'alarm');
      db.data.veilig.wachten = klaar.slice(-Math.max(0, 500 - lopend.length)).concat(lopend);
    } else {
      db.data.veilig.wachten = w8;
    }
    // meekijken mag zolang de wacht loopt, plus de marge; daarna dicht
    if (body.deelLocatie !== false) plek.vensterOpen(handle, minuten + marge + 30, 'wacht');
    save();
    return { status: 200, ok: true, wacht: toon(w) };
  }

  /* Inchecken: "ik ben er". Dat is het levensteken dat het alarm tegenhoudt.
     Bij een herhalende check-in schuift de volgende deadline meteen door. */
  function wachtCheckin(handle, id) {
    const w = lijst().find(x => x.id === id && x.handle === handle);
    if (!w) return { status: 404, error: 'Deze wacht kennen we niet.' };
    if (!LOOPT.includes(w.status) && w.status !== 'alarm')
      return { status: 409, error: 'Deze wacht loopt niet meer.' };
    w.laatsteCheck = nu();
    // Ook NA een alarm mag je inchecken: dan hoort de kring meteen dat het
    // goed is. Dat is geen randgeval maar het normale einde van vals alarm.
    if (w.status === 'alarm' && w.alarmId) alarm.alarmAfsluiten(handle, w.alarmId, 'Alsnog ingecheckt.');
    if (w.herhaal) {
      w.status = 'loopt';
      w.genadeTot = null;
      w.deadline = new Date(Date.now() + w.herhaal * 3600000).toISOString();
    } else {
      w.status = 'klaar';
      w.klaarAt = nu();
      plek.vensterSluit(handle);
    }
    save();
    return { status: 200, ok: true, wacht: toon(w) };
  }

  function wachtVerlengen(handle, id, minuten) {
    const w = lijst().find(x => x.id === id && x.handle === handle);
    if (!w || !LOOPT.includes(w.status)) return { status: 404, error: 'Deze wacht loopt niet.' };
    const m = Math.max(1, Math.min(MAX_MIN, Math.round(Number(minuten) || 15)));
    w.deadline = new Date(Math.max(Date.now(), new Date(w.deadline).getTime()) + m * 60000).toISOString();
    w.status = 'loopt'; w.genadeTot = null;
    save();
    return { status: 200, ok: true, wacht: toon(w) };
  }

  function wachtStop(handle, id) {
    const w = lijst().find(x => x.id === id && x.handle === handle);
    if (!w) return { status: 404, error: 'Deze wacht kennen we niet.' };
    if (w.status === 'alarm' && w.alarmId) alarm.alarmAfsluiten(handle, w.alarmId, 'Wacht gestopt.');
    w.status = 'gestopt'; w.gestoptAt = nu();
    plek.vensterSluit(handle);
    save();
    return { status: 200, ok: true };
  }

  function wachtenVan(handle) {
    return {
      lopend: lopendeVan(handle).map(toon),
      recent: lijst().filter(w => w.handle === handle && !LOOPT.includes(w.status)).slice(-8).reverse()
        .map(w => ({ id: w.id, soort: w.soort, label: w.label, status: w.status, gestart: w.gestart, deadline: w.deadline }))
    };
  }

  /* De sweep: dit draait op de klok van de server en is de reden dat het
     werkt zonder telefoon. Idempotent met opzet: elke overgang kijkt eerst
     naar de huidige status, dus twee sweeps achter elkaar (of een tweede
     server die meedraait) laten hooguit een dubbele melding zien, nooit een
     dubbele toestand. */
  function sweep(nuMs) {
    const t = nuMs || Date.now();
    let veranderd = 0;
    for (const w of lijst()) {
      if (w.status === 'loopt' && new Date(w.deadline).getTime() <= t) {
        // trede 1: eerst jij, met genadetijd
        w.status = 'genade';
        w.genadeTot = new Date(t + (w.marge || 0) * 60000).toISOString();
        meldAan(w.handle, {
          title: w.soort === 'thuis' ? 'Ben je goed thuisgekomen?' : 'Tijd voor je check-in',
          body: w.marge > 0
            ? 'Je bent over tijd. Check in binnen ' + w.marge + ' minuten, anders waarschuw ik je kring.'
            : 'Je bent over tijd; ik waarschuw nu je kring.',
          scope: 'veiligheid', soort: 'genade', wachtId: w.id
        });
        veranderd++;
      }
      if (w.status === 'genade' && new Date(w.genadeTot).getTime() <= t) {
        // trede 2: de kring
        w.status = 'alarm';
        w.alarmAt = nu();
        const r = alarm.alarmSlaan({
          handle: w.handle,
          codenaam: sociaal.codenaamVan(w.handle) || w.codenaam,
          soort: w.soort,
          notitie: w.label
        });
        /* En als het TOCH misgaat (de kring is leeggelopen nadat de wacht
           begon): niet stil op 'alarm' zetten. De stand zegt dan wat er echt
           gebeurde, en het logboek ook -- anders staat er "alarm" terwijl er
           niemand is gewaarschuwd, en dat is een gerustheid die niet klopt. */
        if (r && r.id) w.alarmId = r.id;
        else if (r && r.error) {
          w.status = 'alarm-mislukt';
          w.alarmFout = String(r.error).slice(0, 140);
          console.error('[veiligheid] wacht van ' + w.handle + ' sloeg GEEN alarm: ' + r.error);
          try { meldAan(w.handle, { title: 'Je wacht kon niemand waarschuwen', body: 'De wacht liep af, maar je kring is leeg. Zet iemand in je kring.', icon: 'alarm' }); } catch (e) {}
        }
        veranderd++;
      }
    }
    if (veranderd) save();
    return veranderd;
  }

  return { wachtStart, wachtCheckin, wachtVerlengen, wachtStop, wachtenVan, sweep };
};
