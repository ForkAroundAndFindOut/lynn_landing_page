import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const stage=process.argv[2] || 'before';
const git=(...args)=>execFileSync('git',['-c','safe.directory='+process.cwd().replaceAll('\\','/'),...args],{encoding:'utf8'}).trim();
const aliases=['codex-card-layout','codex-card-layout-tuning','codex-card-layout-swipe-hint'];
const previews={};
for(const alias of aliases){
  const url='https://'+alias+'-lynn-landing-page.nrct6ycww6.workers.dev/';
  const metadata=await fetch(url+'revision.json').then(r=>r.json());
  const assets=await Promise.all(Object.entries(metadata.assets).map(async([name,hash])=>({name,match:createHash('sha256').update(Buffer.from(await fetch(url+name).then(r=>r.arrayBuffer()))).digest('hex')===hash})));
  previews[alias]={url,revision:metadata.revision,assets};
}
const productionSHA256=createHash('sha256').update(Buffer.from(await fetch('https://lynn-landing-page.nrct6ycww6.workers.dev/').then(r=>r.arrayBuffer()))).digest('hex');
const localHeads=Object.fromEntries(git('for-each-ref','--format=%(refname) %(objectname)','refs/heads').split('\n').filter(Boolean).map(line=>line.split(' ')).filter(([name])=>name!=='refs/heads/codex/card-layout-safari-qa'));
const remoteHeads=Object.fromEntries(git('ls-remote','--heads','https://github.com/ForkAroundAndFindOut/lynn_landing_page.git').split('\n').filter(Boolean).map(line=>{const[hash,name]=line.split(/\s+/);return[name,hash];}).filter(([name])=>name!=='refs/heads/codex/card-layout-safari-qa'));
const report={checkedAt:new Date().toISOString(),previews,productionSHA256,localHeads,remoteHeads};
if(stage==='after'){
  const before=JSON.parse(await readFile('verification/safari-qa/integrity-before.json','utf8'));
  report.comparison={localHeadsUnchanged:JSON.stringify(localHeads)===JSON.stringify(before.localHeads),remoteHeadsUnchanged:JSON.stringify(remoteHeads)===JSON.stringify(before.remoteHeads),productionHTMLUnchanged:productionSHA256===before.productionSHA256,protectedPreviewsUnchanged:aliases.every(alias=>previews[alias].revision===before.previews[alias].revision&&previews[alias].assets.every(a=>a.match))};
  if(Object.values(report.comparison).some(value=>!value))throw Error('Isolation check failed: '+JSON.stringify(report.comparison));
}
await mkdir('verification/safari-qa',{recursive:true});
await writeFile('verification/safari-qa/integrity-'+stage+'.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({stage,...report.comparison,productionSHA256,previews:Object.fromEntries(Object.entries(previews).map(([k,v])=>[k,{revision:v.revision,assetsMatch:v.assets.every(a=>a.match)}]))}));
