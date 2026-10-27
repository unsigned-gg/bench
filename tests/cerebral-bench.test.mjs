import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadData,validateData,digest} from '../scripts/bench-data.mjs';
const root=new URL('../cerebral-src/data/',import.meta.url).pathname;
function fixture(){const {data,records}=loadData(root);return {data:structuredClone(data),records:{...records}}}
function editRecord(f,name,edit){const d=JSON.parse(f.records[name]);edit(d);f.records[name]=Buffer.from(JSON.stringify(d));f.data.artifacts.find(a=>a.file===name).sha256=digest(f.records[name])}
test('published snapshot validates against every evidence record',()=>{const f=fixture();assert.doesNotThrow(()=>validateData(f.data,f.records));assert.equal(f.data.measurements.length,16)});
test('a modified evidence file cannot retain its old digest',()=>{const f=fixture();f.records['scorcher-local.json']=Buffer.from('{}');assert.throws(()=>validateData(f.data,f.records),/digest mismatch/)});
test('a displayed result must match its source pointer',()=>{const f=fixture();f.data.measurements[0].value+=1;assert.throws(()=>validateData(f.data,f.records),/differs from receipt/)});
test('measured timings require a sample denominator',()=>{const f=fixture();delete f.data.measurements[0].samples;assert.throws(()=>validateData(f.data,f.records),/denominator/)});
test('simulation cannot be relabeled as a physical measurement',()=>{const f=fixture();f.data.measurements.find(m=>m.system==='saga').evidence='measured';assert.throws(()=>validateData(f.data,f.records),/evidence claim/)});
test('virtual clock rows cannot be labeled milliseconds',()=>{const f=fixture();f.data.measurements.find(m=>m.system==='saga').unit='ms';assert.throws(()=>validateData(f.data,f.records),/Simulation differs/)});
test('Cortex has no numeric score without a separate result adapter',()=>{const f=fixture();editRecord(f,'cortex-protocol.json',r=>{r.result={p50:100}});assert.throws(()=>validateData(f.data,f.records),/separate validated result/)});
test('an ineffective negative control blocks publication',()=>{const f=fixture();editRecord(f,'saga-controls.json',r=>{r.controls[0].negativeControlPassed=true});assert.throws(()=>validateData(f.data,f.records),/negative\/reference controls/)});
test('machine paths and internal addresses cannot enter public evidence',()=>{const f=fixture();f.data.measurements[0].note='/home/example/private';assert.throws(()=>validateData(f.data,f.records),/Private machine/)});
test('the existing model-bank Worker keeps its hostname and asset tree',()=>{const text=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');const config=JSON.parse(text);assert.equal(config.name,'unsigned-bench');assert.equal(config.assets.directory,'./public');assert.equal(config.routes[0].pattern,'bench.unsigned.gg')});

test('timing unit changes cannot inflate a measured result',()=>{const f=fixture();f.data.measurements[0].unit='µs';assert.throws(()=>validateData(f.data,f.records),/Measured unit/)});
test('a displayed sample denominator must match the receipt',()=>{const f=fixture();f.data.measurements[0].samples=100000;assert.throws(()=>validateData(f.data,f.records),/Sample denominator differs/)});
