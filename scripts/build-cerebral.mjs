import {readFileSync,writeFileSync,mkdirSync,cpSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {loadData} from './bench-data.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),src=join(root,'cerebral-src'),out=join(root,'cerebral');
const {data,parsed}=loadData(join(src,'data'));const sc=parsed['scorcher-local.json'],m=sc.bench.metrics,sa=parsed['saga-scheduler.json'];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=(n,d=2)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:d}).format(n);
const stat=(value,unit,label)=>`<div class="fact"><div class="fact-value">${escape(value)}<span>${escape(unit)}</span></div><p>${escape(label)}</p></div>`;
const rows=[['Affinity routing',m.ring_p50_ns,m.ring_p99_ns,'ns',sc.iters],['Adaptive routing',m.p2c_p50_ns,m.p2c_p99_ns,'ns',sc.iters],['Hot-cache lookup',m.tier0_p50_ns,m.tier0_p99_ns,'ns',m.tier0_iters],['Durable object write · 64 KiB',m.put_p50_us,m.put_p99_us,'µs',m.put_count],['Verified object read · 64 KiB',m.tier1_p50_us,m.tier1_p99_us,'µs',m.put_count],['Sealed-descriptor delivery · 8 MiB',m.memfd_p50_us,m.memfd_p99_us,'µs',m.ipc_iters],['Copied-socket delivery · 8 MiB',m.raw_p50_us,m.raw_p99_us,'µs',m.ipc_iters],['Shared-memory roundtrip · 8 KiB',sc.shm_roundtrip.latency_p50_us,sc.shm_roundtrip.latency_p99_us,'µs',sc.shm_roundtrip.round_trips]];
const scRows=rows.map(([name,p50,p99,unit,n])=>`<tr><th scope="row">${escape(name)}</th><td>${number(p50)} <span>${unit}</span></td><td>${number(p99)} <span>${unit}</span></td><td>${number(n,0)}</td></tr>`).join('');
const plans=[...new Set(sa.rows.map(r=>r.plan))];const current=plans[2];
const sagaRows=sa.rows.map(r=>`<tr><th scope="row">${escape(r.plan.replace('bench-',''))}</th><td>${escape(r.strategy.toUpperCase())}</td><td>${r.makespan}</td><td>${r.waves}</td><td>${number(r.utilization_ppm/10000,1)}%</td></tr>`).join('');
const bar=(name,value,max,attrs='')=>`<div class="plot-row" ${attrs}><div class="plot-label">${escape(name)}</div><div class="plot-track"><div class="plot-fill" style="width:${100*value/max}%"></div></div><div class="plot-value">${number(value)} <span>µs</span></div></div>`;
const transportChart=[['Sealed descriptor',m.memfd_p50_us,m.memfd_p99_us],['Socket copy',m.raw_p50_us,m.raw_p99_us]].map(([name,p50,p99])=>bar(name,p50,Math.max(m.raw_p50_us,m.memfd_p50_us),`data-latency data-p50="${p50}" data-p99="${p99}"`)).join('');
const sagaChart=sa.rows.filter(r=>r.plan===current).map(r=>`<div class="plot-row" data-strategy="${r.strategy}"><div class="plot-label">${r.strategy.toUpperCase()}</div><div class="plot-track"><div class="plot-fill" style="width:${r.makespan/Math.max(...sa.rows.filter(x=>x.plan===current).map(x=>x.makespan))*100}%"></div></div><div class="plot-value">${r.makespan} <span>units</span></div></div>`).join('');
const protocol=parsed['cortex-protocol.json'];
const controls=parsed['saga-controls.json'].controls.map(c=>`<tr><th scope="row">syn / ${escape(c.task)}</th><td><span class="control-dot"></span> Fails as expected</td><td>${c.referencePatchPassed.length}/${c.referencePatchPassed.length} pass</td><td>${escape(c.validatedAt.slice(0,10))}</td></tr>`).join('');
const record=(name,file)=>`<details class="record"><summary>Read the ${escape(name)} run record <span aria-hidden="true">↗</span></summary><div class="record-body"><p>Evidence and capture context are included with this download.</p><a href="/data/${file}" download>Download ${escape(file)} ↓</a><dl><dt>Artifact SHA-256</dt><dd><code>${data.artifacts.find(a=>a.file===file).sha256}</code></dd></dl></div></details>`;
let template=readFileSync(join(src,'index.html'),'utf8');
const replacements={
 SNAPSHOT:data.snapshot,ROUNDTRIP:number(sc.shm_roundtrip.latency_p50_us),ROUNDTRIP_TAIL:number(sc.shm_roundtrip.latency_p99_us),
 SCORCHER_FACTS:stat(number(m.ring_p50_ns,0),'ns','Affinity routing · p50 · n = 10,000')+stat(number(sc.shm_roundtrip.latency_p50_us),'µs','8 KiB roundtrip · p50 · n = 100')+stat(String(m.actual_calls),`/ ${m.concurrency}`,'Upstream calls / concurrent misses'),
 SCORCHER_ROWS:scRows,TRANSPORT_CHART:transportChart,
 CORTEX_COVERAGE:protocol.coverage.map((s,i)=>`<li><span>${String(i+1).padStart(2,'0')}</span>${escape(s)}<span class="coverage-label">specified</span></li>`).join(''),
 SAGA_CHART:sagaChart,SAGA_ROWS:sagaRows,SAGA_OPTIONS:plans.map(p=>`<option value="${p}"${p===current?' selected':''}>${escape(p.replace('bench-','').replaceAll('-',' '))}</option>`).join(''),
 CONTROL_ROWS:controls,SCORCHER_RECORD:record('Scorcher','scorcher-local.json'),CORTEX_RECORD:record('Cortex protocol','cortex-protocol.json'),SAGA_RECORD:record('Saga simulation','saga-scheduler.json'),
 CLIENT_DATA:JSON.stringify({scheduler:sa.rows}).replaceAll('<','\\u003c')
};
for(const [key,value] of Object.entries(replacements))template=template.replaceAll(`{{${key}}}`,value);
if(/\{\{[A-Z_]+\}\}/.test(template))throw Error('Unresolved template marker');
rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
for(const file of ['styles.css','app.js','favicon.svg','robots.txt','404.html'])cpSync(join(src,file),join(out,file));
cpSync(join(src,'data'),join(out,'data'),{recursive:true});writeFileSync(join(out,'index.html'),template);
const csv=['system,workload,evidence,value,unit,samples,source',...data.measurements.map(r=>[r.system,r.name,r.evidence,r.value,r.unit,r.samples??'',r.source].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(','))].join('\n')+'\n';writeFileSync(join(out,'data/measurements.csv'),csv);
writeFileSync(join(out,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://bench.cerebral.work/</loc></url></urlset>\n');
console.log(`Built ${out}: static results, four evidence records, CSV export`);
