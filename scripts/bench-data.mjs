import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function validateData(data, records) {
  if (data.schemaVersion !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(data.snapshot)) throw Error('Invalid snapshot schema');
  if (data.systems.map(s=>s.id).sort().join(',') !== 'cortex,saga,scorcher') throw Error('Expected three named systems');
  const allowed = {scorcher:'measured',cortex:'protocol',saga:'simulation'};
  for(const s of data.systems) if(s.type!==allowed[s.id]) throw Error('System evidence type changed');
  for(const a of data.artifacts) {
    if(!/^[a-z-]+\.json$/.test(a.file)||!records[a.file]) throw Error('Missing evidence record');
    if(digest(records[a.file])!==a.sha256) throw Error('Evidence digest mismatch');
  }
  const parsed=Object.fromEntries(Object.entries(records).map(([name,bytes])=>[name,JSON.parse(bytes)]));
  const seen=new Set();
  for(const m of data.measurements){
    if(seen.has(m.id)) throw Error('Duplicate measurement');seen.add(m.id);
    if(!Number.isFinite(m.value)||m.value<0) throw Error('Invalid measurement value');
    if(m.evidence!==allowed[m.system]||m.system==='cortex') throw Error('Unsupported numeric evidence claim');
    if(!parsed[m.source]) throw Error('Missing measurement source');
    if(m.evidence==='measured'){
      if(!Number.isInteger(m.samples)||m.samples<=0) throw Error('Missing measurement denominator');
      const value=m.pointer.split('/').slice(1).reduce((obj,key)=>obj?.[key],parsed[m.source]);
      if(value!==m.value) throw Error('Measurement differs from receipt');
      const expectedUnit=m.pointer.endsWith('_ns')?'ns':m.pointer.endsWith('_us')?'µs':m.pointer.endsWith('/actual_calls')?'calls':null;
      if(!expectedUnit||m.unit!==expectedUnit) throw Error('Measured unit differs from source schema');
      const count=m.samplePointer?.split('/').slice(1).reduce((obj,key)=>obj?.[key],parsed[m.source]);
      if(count!==m.samples) throw Error('Sample denominator differs from receipt');
    }else{
      const row=parsed[m.source].rows?.find(r=>r.plan===m.plan&&r.strategy===m.strategy);
      if(!row||row.error||row.makespan!==m.value||m.unit!=='plan units') throw Error('Simulation differs from receipt');
    }
  }
  if(parsed['cortex-protocol.json'].result!==null) throw Error('Cortex needs a separate validated result adapter');
  for(const c of parsed['saga-controls.json'].controls){
    if(!c.valid||c.negativeControlPassed!==false||c.referencePatchPassed.length<1||c.referencePatchPassed.some(p=>p!==true)) throw Error('Invalid negative/reference controls');
  }
  const unsafe=/\b(?:ctodie|cygnus|tailnet|tail769bd2|ganymede)\b|\/home\/|https?:\/\/(?:127\.|10\.|192\.168\.)/i;
  if(unsafe.test(JSON.stringify([data,parsed]))) throw Error('Private machine or network detail in public evidence');
  return parsed;
}
export function loadData(root){
  const data=JSON.parse(readFileSync(join(root,'benchmarks.json')));
  const records=Object.fromEntries(data.artifacts.map(a=>[a.file,readFileSync(join(root,a.file))]));
  return {data,records,parsed:validateData(data,records)};
}
