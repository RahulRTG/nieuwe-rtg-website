/* Het handelingsspoor (./handelingsspoor.js): de afdruk van een verzoeklijf en
   WIE er handelt. Geknipt uit dat bestand (keuringsregel 13); de reden achter
   beide staat in de kop daarvan. */
'use strict';

const crypto = require('crypto');
const burger = require('./burgerpad');
const releaseidentiteit = require('./releaseidentiteit');

/* Velden die niet in de afdruk horen: de idem-sleutel is geen inhoud, en vrije
   tekst maakt van twee gelijke handelingen twee verschillende. Zelfde lijst en
   zelfde reden als in lib/idem-poort.js. */
const BUITEN_AFDRUK = new Set(['idem', 'idempotentieSleutel', 'notitie', 'omschrijving', 'oms', 'toelichting']);

function afdrukVan(body) {
  if (!body || typeof body !== 'object') return '';
  const uit = {};
  for (const k of Object.keys(body).sort()) {
    if (BUITEN_AFDRUK.has(k)) continue;
    uit[k] = body[k];
  }
  try { return crypto.createHash('sha256').update(JSON.stringify(uit)).digest('hex').slice(0, 16); }
  catch (e) { return ''; }
}

/* WIE. Zie de kop: liever 'niemand aan te wijzen' dan een verzonnen naam. */
function wieVan(req) {
  const s = req.session;
  if (s && s.key) return String(s.key).slice(0, 60);
  const pad = String(req.path || req.url || '');
  if (pad.startsWith('/api/office') || pad.startsWith('/api/command')) return 'kantoor (gedeelde code)';
  if (pad.startsWith('/api/supplier') || pad.startsWith('/api/partner')) return 'partner (niet herleid)';
  return 'anoniem';
}

function maakRegel(tijd) {
  /* EEN BOUWER VOOR DE REGEL. noteer() legt hem aan de keten; de vroege
     commit (db/verzoekspoor.js) legt hem in zijn eigen transactie aan de keten.
     Twee bouwers lopen binnen een half jaar uiteen, en dan dekt de keten twee
     soorten regels.

     `verzoek` en `release` (audit P2-7) staan IN de regel en dus onder de hash:
     het verzoek koppelt de regel aan het logboek en aan de andere sporen van
     hetzelfde verzoek (lib/correlatie.js maakt het id, de server en nooit de
     client), de release zegt met welke code hij geschreven is. Een burgerpad
     krijgt geen verzoek-id: dat is precies de weg naar de mens die daar met
     opzet ontbreekt. */
  function regelVan({ wie, methode, pad, status, afdruk, grof, stand, verzoek, collecties }) {
    const r = {
      at: grof ? burger.dag(tijd()) : new Date(tijd()).toISOString(),
      wie: String(wie || 'anoniem').slice(0, 60),
      methode: String(methode || '').slice(0, 10),
      pad: String(pad || '').slice(0, 200),
      status: Number(status) || 0,
      afdruk: String(afdruk || '')
    };
    if (stand) r.stand = String(stand).slice(0, 20);   // A-P1-05: `toegestaan` = voor de handeling, duurzaam
    if (collecties && collecties.length) r.collecties = [].concat(collecties).map(String).join(',').slice(0, 200);
    if (verzoek && !grof) r.verzoek = String(verzoek).slice(0, 40);
    const release = releaseidentiteit.release();
    if (release) r.release = release;   // nooit een verzonnen versie
    return r;
  }

  /* De regel voor een VROEGE commit (db/verzoekspoor.js): de domeinmutatie van
     dit verzoek is in dezelfde transactie als deze regel gecommit. */
  function regelVoorVroegeCommit(req, collecties) {
    const pad = String(req.path || req.url || '');
    const pseudoniem = burger.isBurgerpad(pad);
    return regelVan({ wie: pseudoniem ? burger.PSEUDONIEM : wieVan(req), methode: req.method, pad, status: 0,
      afdruk: pseudoniem ? '' : afdrukVan(req.body), grof: pseudoniem, stand: 'vastgelegd',
      verzoek: req.id, collecties });
  }

  return { regelVan, regelVoorVroegeCommit };
}

module.exports = { afdrukVan, wieVan, BUITEN_AFDRUK, maakRegel };
