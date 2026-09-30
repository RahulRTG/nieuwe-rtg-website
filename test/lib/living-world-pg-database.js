'use strict';
// Ook een herhaalde mutatieproef begint leeg en raakt alleen zijn eigen database.
const {randomUUID}=require('node:crypto');
const {Pool}=require('../../server/pgwire');
module.exports=async source=>{
  const admin=new URL(source);admin.pathname='/postgres';
  const pool=new Pool({connectionString:admin.toString(),max:1});
  const name='living_world_test_'+randomUUID().replaceAll('-','');
  try{await pool.query('CREATE DATABASE '+name);}catch(e){await pool.end();throw e;}
  const url=new URL(source);url.pathname='/'+name;
  return {url:url.toString(),close:async()=>{
    try{await pool.query('DROP DATABASE '+name);}finally{await pool.end();}
  }};
};
