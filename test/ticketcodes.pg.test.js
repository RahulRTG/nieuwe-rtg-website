/* Echte productie-topologieproef voor travelos.activity_ticket_entry en
   travelos.mobility_transport_ticket.

   Twee onafhankelijke kerninstances delen de autoritatieve `ticketToegang`- en
   `mobKaartToegang`-rij in PostgreSQL. Twee poorten scannen hetzelfde ticket
   tegelijk, twee conducteurs hetzelfde enkeltje, en een scan racet tegen een
   rotatie: telkens wint er precies een, en de database draagt alleen hashes.
   Twee Redis-verbindingen bewijzen dat de multi-instancebus bereikbaar is; de
   claim zelf serialiseert in de collectietransactie (advisory lock + FOR UPDATE).

   Draai los: DATABASE_URL=... REDIS_URL=... node --test test/ticketcodes.pg.test.js */
'use strict';

const test = require('node:test');
const { vereistAlle } = require('./infra');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const PG_URL = process.env.DATABASE_URL || process.env.PG_URL;
const REDIS_URL = process.env.REDIS_URL;
const OVERSLAAN = vereistAlle([['pg', !!PG_URL], ['redis', !!REDIS_URL]], 'vereist echte DATABASE_URL en REDIS_URL voor twee onafhankelijke instances');

test('ticket- en kaartcodes zijn hash-only en claimen atomair over twee PG/Redis-instances',
  { skip: OVERSLAAN, timeout: 120000 }, async () => {
    const { maakPg } = require('../server/pg');
    const { merge3 } = require('../server/db/merge');
    const { createClient } = require('../server/redis');
    const kluis = require('../server/kluis');
    const nieuwPg = () => maakPg({ merge3, kluis, log: { warn() {} }, url: PG_URL });
    const a = nieuwPg(), b = nieuwPg();
    const ra = createClient({ url: REDIS_URL }), rb = createClient({ url: REDIS_URL });
    try {
      await Promise.all([ra.connect(), rb.connect()]);
      const kanaal = 'rtg:test:ticketcodes:' + crypto.randomBytes(8).toString('hex');
      let ontvang, weiger;
      const gezien = new Promise((resolve, reject) => { ontvang = resolve; weiger = reject; });
      const grens = setTimeout(() => weiger(new Error('Redis multi-instancebericht niet ontvangen')), 3000);
      await rb.subscribe(kanaal, bericht => { clearTimeout(grens); ontvang(bericht); });
      await ra.publish(kanaal, 'gereed');
      assert.equal(await gezien, 'gereed');

      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      await a.flush({ ticketToegang: {}, mobKaartToegang: {} }, true);
      const dataA = await a.laadAlles(), dataB = await b.laadAlles();
      const vandaag = new Date().toISOString().slice(0, 10);
      /* De boeking en het kaartje zijn op beide instances dezelfde: in productie
         komen ze uit hun eigen opslag. Hier telt alleen wat in de toegangsrij
         serialiseert. */
      const tickets = new Map([['PG-T1', { ref: 'PG-T1', kind: 'ticket', supplierCode: 'ZAAK', customerKey: 'lid:1',
        datum: vandaag, tijd: '23:00', paid: true, status: 'bevestigd' }],
      ['PG-T2', { ref: 'PG-T2', kind: 'ticket', supplierCode: 'ZAAK', customerKey: 'lid:2',
        datum: vandaag, tijd: '23:00', paid: true, status: 'bevestigd' }]]);
      const kaartje = { id: 'kt-pg', key: 'lid:3', vervoerder: 'BUS', product: 'enkel', validaties: [],
        geldigTot: new Date(Date.now() + 3600000).toISOString() };
      const tk = (pg, data) => require('../server/kern/tickettoegang')({ db: { data, writable: true }, save() {}, crypto,
        bewerkCollectie: (sleutel, werk) => pg.bewerkCollectie(sleutel, data, werk) });
      const ov = (pg, data) => require('../server/kern/mobiliteit/kaarttoegang')({ crypto, save() {},
        nu: () => new Date().toISOString(), opslag: { bak: () => [] }, KAART_PRODUCTEN: { enkel: { ritten: 1 } },
        bewerkCollectie: (sleutel, werk) => pg.bewerkCollectie(sleutel, data, werk) });
      const ta = tk(a, dataA), tb = tk(b, dataB), oa = ov(a, dataA), ob = ov(b, dataB);
      const boekingVan = ref => tickets.get(ref);
      const lees = async sleutel => {
        const { rows } = await a.pool.query('SELECT val FROM kv WHERE key=$1', [sleutel]);
        assert.equal(rows.length, 1);
        return kluis.ontsleutel(rows[0].val);
      };

      // 1. twee poorten scannen hetzelfde ticket tegelijk: een keer binnen
      const t1 = await ta.uitgeven({ boeking: tickets.get('PG-T1'), key: 'lid:1' });
      assert.equal(t1.status, 200);
      const poorten = await Promise.all([
        ta.claim({ code: t1.code, supplierCode: 'ZAAK', actor: { name: 'A' }, boekingVan }),
        tb.claim({ code: t1.code, supplierCode: 'ZAAK', actor: { name: 'B' }, boekingVan })
      ]);
      assert.equal(poorten.filter(x => x.status === 200).length, 1, 'exact een poort laat binnen');
      assert.equal(poorten.filter(x => x.status === 409).length, 1);
      let json = await lees('ticketToegang');
      assert.equal(json.includes(t1.code.slice(3)), false, 'PostgreSQL bevat alleen de hash');
      assert.equal(JSON.parse(json)['PG-T1'].toegang.gebruik, 1);

      // 2. een scan op A tegen een rotatie op B: nooit allebei
      const t2 = await ta.uitgeven({ boeking: tickets.get('PG-T2'), key: 'lid:2' });
      const [scan, rot] = await Promise.all([
        ta.claim({ code: t2.code, supplierCode: 'ZAAK', actor: { name: 'A' }, boekingVan }),
        tb.uitgeven({ boeking: tickets.get('PG-T2'), key: 'lid:2' })
      ]);
      assert.equal([scan.status === 200, rot.status === 200].filter(Boolean).length, 1,
        'binnenlaten en roteren sluiten elkaar uit');

      // 3. twee conducteurs scannen hetzelfde enkeltje tegelijk: een rit
      const k = await oa.kaartToon({ kaartje, key: 'lid:3', stand: { stand: 'geldig' } });
      assert.equal(k.status, 200);
      const conducteurs = await Promise.all([
        oa.kaartClaim({ code: k.code, vervoerder: 'BUS', controleer: () => null }),
        ob.kaartClaim({ code: k.code, vervoerder: 'BUS', controleer: () => null })
      ]);
      assert.equal(conducteurs.filter(x => x.status === 200).length, 1, 'exact een rit wordt geteld');
      json = await lees('mobKaartToegang');
      assert.equal(json.includes(k.code.slice(3)), false);
      assert.equal(JSON.parse(json)['kt-pg'].gebruik, 1);
      // en een nieuwe code speelt de rit niet vrij
      const weer = await ob.kaartToon({ kaartje, key: 'lid:3', stand: { stand: 'geldig' } });
      assert.equal((await oa.kaartClaim({ code: weer.code, vervoerder: 'BUS', controleer: () => null })).status, 409);
    } finally {
      await Promise.allSettled([ra.quit(), rb.quit()]);
      await Promise.allSettled([a.sluit(), b.sluit()]);
    }
  });
