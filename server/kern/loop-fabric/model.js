'use strict';

const P=require('./protocol');

function empty() {
  return {schemaVersion:1,consumed:{},observations:{},changes:{},lineage:{},recalls:{},operations:{},journal:[]};
}

function state(raw) {
  if (!raw || Object.keys(raw).length===0) return empty();
  if (raw.schemaVersion!==1 || !raw.consumed || !raw.observations || !raw.changes || !raw.lineage ||
      !raw.recalls || !raw.operations || !Array.isArray(raw.journal))
    P.fail('SCHEMA_UNAVAILABLE','De Loop Fabric-projectie heeft een onbekende versie.',503);
  return P.clone(raw);
}

function append(state,type,body,at,envelop) {
  const previous=state.journal.at(-1);
  const row={sequence:state.journal.length+1,type,at,bodyHash:P.hash(body),envelop,
    previousHash:previous ? previous.hash : null};
  row.hash=P.hash(row); state.journal.push(row); return row;
}

function verify(rows) {
  let previous=null;
  for (const row of rows) {
    const {hash,...body}=row;
    if (body.previousHash!==previous || P.hash(body)!==hash) return false;
    previous=hash;
  }
  return true;
}

module.exports={empty,state,append,verify};
