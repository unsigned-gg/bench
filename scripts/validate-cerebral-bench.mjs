import {loadData} from './bench-data.mjs';
const {data}=loadData(new URL('../cerebral-src/data/',import.meta.url).pathname);
console.log(`Cerebral evidence valid: ${data.systems.length} systems, ${data.measurements.length} numeric records, ${data.artifacts.length} hashed artifacts`);
