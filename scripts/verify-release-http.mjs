import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { vct2027 } from "../src/features/organizations/data/vct-2027.ts";

const artifacts=process.env.RELEASE_ARTIFACTS??"artifacts/task-17";
const base="http://127.0.0.1:3021", marker="PRIVATE_RELEASE_AUDIT_SENTINEL";
const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:"",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"",DATABASE_URL:marker,SUPABASE_ORGANIZATION_LOGOS_BUCKET:"",SUPABASE_PLAYER_PHOTOS_BUCKET:""};
const report={mode:"production build, local read-only data",pages:[],assets:[],contrast:[],browser:"not used; HTTP and token math do not validate visual layout or interaction"};
await mkdir(artifacts,{recursive:true});
const pkg=JSON.parse(await readFile("package.json","utf8")),lock=JSON.parse(await readFile("package-lock.json","utf8"));
assert.equal(pkg.version,lock.version); assert.equal(pkg.version,lock.packages[""].version);
report.versions={app:pkg.version,node:process.version,next:pkg.dependencies.next,react:pkg.dependencies.react};
report.migrations=await Promise.all((await readdir("supabase/migrations")).filter(name=>name.endsWith(".sql")).sort().map(async name=>({name,sha256:createHash("sha256").update(await readFile(`supabase/migrations/${name}`)).digest("hex")})));
const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port","3021"],{env,stdio:"inherit",windowsHide:true});
try {
  let ready=false;
  for(let i=0;i<100;i++) {
    if(server.exitCode!==null) throw new Error("Release server exited before startup");
    try { if((await fetch(base)).ok) {ready=true;break;} } catch { /* Startup only. */ }
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  assert.ok(ready,"Production server startup timeout");
  const pages=["/",...vct2027.regions.map(row=>`/${row.slug}`),...vct2027.organizations.map(row=>`/team/${row.slug}`),"/transfers","/admin/login"];
  const assets=new Set();
  for(const path of pages) {
    const response=await fetch(base+path),html=await response.text();
    assert.equal(response.status,200,path);
    assert.match(html,/<html[^>]*lang="pt-BR"/); assert.match(html,/<meta name="viewport"[^>]*width=device-width/);
    assert.equal((html.match(/<h1[\s>]/g)??[]).length,1,path); assert.equal((html.match(/<main[\s>]/g)??[]).length,1,path);
    const title=html.match(/<title>([^<]+)<\/title>/)?.[1],description=html.match(/<meta name="description" content="([^"]+)"/)?.[1];
    assert.ok(title&&description,path); assert.ok(!html.includes(marker));
    if(path==="/admin/login") { assert.match(html,/<meta name="robots" content="[^"]*noindex/); assert.match(response.headers.get("cache-control"),/no-store/); }
    else assert.doesNotMatch(html,/<meta name="robots" content="[^"]*noindex/,path);
    if(path==="/transfers") assert.match(html,/Nenhum registro publicado para estes filtros/);
    if(path.startsWith("/team/")) { assert.match(html,/id="titulares-titulo"/); assert.match(html,/Nenhum registro publicado no histórico/); }
    for(const match of html.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)="([^"]+)"[^>]*>/g)) {
      const url=new URL(match[1].replaceAll("&amp;","&"),base);
      if(url.origin===base) assets.add(url.pathname+url.search);
    }
    report.pages.push({path,status:response.status,title,description,lang:"pt-BR",h1:1,main:1});
  }
  for(const [path,label] of [["/regiao-inexistente","Página não encontrada"],["/rota/inexistente","Página não encontrada"],["/team/sem-cadastro","Organização não encontrada"],["/player/sem-cadastro","Jogador não encontrado"]]) {
    const response=await fetch(base+path),html=await response.text();
    assert.equal(response.status,404,path); assert.ok(html.includes(label),path); assert.match(html,/<meta name="robots" content="[^"]*noindex/);
    report.pages.push({path,status:404,recoveryInPortuguese:true,noindex:true});
  }
  const admin=await fetch(base+"/admin",{redirect:"manual"}); assert.equal(admin.status,303); assert.match(admin.headers.get("location"),/\/admin\/login/); assert.match(admin.headers.get("cache-control"),/no-store/);
  report.pages.push({path:"/admin",status:303,protected:true});
  for(const path of assets) {
    const response=await fetch(base+path),content=await response.text();
    assert.equal(response.status,200,path); assert.ok(content.length>0); assert.ok(!content.includes(marker));
    if(path.startsWith("/icon.svg")) assert.match(content,/<svg/);
    report.assets.push({path,status:200,bytes:Buffer.byteLength(content),contentType:response.headers.get("content-type")});
  }
  assert.ok(report.assets.some(row=>row.path.startsWith("/icon.svg")));
  const css=await readFile("src/app/globals.css","utf8"),colors=Object.fromEntries([...css.matchAll(/--([a-z-]+):\s*(#[\da-f]{6});/g)].map(match=>[match[1],match[2]]));
  const luminance=hex=>hex.slice(1).match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[0.2126,0.7152,0.0722][index],0);
  for(const [foreground,background] of [["foreground","background"],["foreground","card"],["muted-foreground","background"],["muted-foreground","card"],["muted-foreground","secondary"],["primary-foreground","primary"],["primary","card"]]) {
    const a=luminance(colors[foreground]),b=luminance(colors[background]),ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
    assert.ok(ratio>=4.5,`${foreground}/${background}: ${ratio}`); report.contrast.push({foreground,background,ratio:Number(ratio.toFixed(2)),minimum:4.5});
  }
  report.status="passed";
  console.log(`Release HTTP: ${report.pages.length} routes, ${report.assets.length} assets, metadata, empty states, private sentinel and 7 text contrast pairs passed.`);
} catch(error) { report.status="failed"; report.error=error.message; throw error; }
finally {
  await writeFile(`${artifacts}/release-http.json`,JSON.stringify(report,null,2)+"\n");
  if(server.exitCode===null) { const exited=once(server,"exit"); server.kill(); await exited; }
}
