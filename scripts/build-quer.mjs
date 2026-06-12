// Baut Wallet-Pässe aus den QUERFORMAT-Designs (2.6:1).
// strip = Design (scharf!) + Fade unten in #b8a5dc. backgroundColor = #b8a5dc -> nahtlos.
import { execFileSync } from 'child_process';
import { writeFileSync, mkdirSync, rmSync, createWriteStream, readFileSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import archiver from 'archiver';
import sharp from 'sharp';

const ROOT=process.cwd(), CERTS=join(ROOT,'certs'), PASSDIR=join(ROOT,'public','pass');
const PASS_TYPE_ID='pass.com.lila.gutschein', TEAM_ID='4X4Z2XA87V';
const LILA='rgb(184, 165, 220)', LILAHEX='#b8a5dc';
const SW=1125, SH=432;

async function buildStrip(srcPath){
  // Design auf 1125x432 (cover, falls minimal abweichend), dann Fade unten in Lila
  const base = await sharp(srcPath).resize(SW, SH, { fit:'cover' }).toBuffer();
  const fadeH = 80;
  const fade = Buffer.from(`<svg width="${SW}" height="${SH}"><defs><linearGradient id="f" x1="0" y1="${SH-fadeH}" x2="0" y2="${SH}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${LILAHEX}" stop-opacity="0"/><stop offset="1" stop-color="${LILAHEX}" stop-opacity="1"/></linearGradient></defs><rect x="0" y="${SH-fadeH}" width="${SW}" height="${fadeH}" fill="url(#f)"/></svg>`);
  return await sharp(base).composite([{input:fade,top:0,left:0}]).png().toBuffer();
}

async function makePass({ src, out, label, kind, fields }){
  const BUILD=join(ROOT,'bq-'+label), OUT=join(PASSDIR,out);
  rmSync(BUILD,{recursive:true,force:true}); mkdirSync(BUILD,{recursive:true});

  const strip = await buildStrip(src);
  for(const [w,name] of [[375,'strip.png'],[750,'strip@2x.png'],[1125,'strip@3x.png']]){
    writeFileSync(join(BUILD,name), await sharp(strip).resize({width:w}).png().toBuffer());
  }
  for(const [s,name] of [[29,'icon.png'],[58,'icon@2x.png'],[87,'icon@3x.png']]){
    const svg=`<svg width="${s}" height="${s}"><rect width="${s}" height="${s}" rx="${s*0.2}" fill="${LILA}"/><text x="50%" y="63%" font-family="Georgia,serif" font-size="${s*0.5}" font-weight="700" fill="#3d2a73" text-anchor="middle">l.</text></svg>`;
    writeFileSync(join(BUILD,name), await sharp(Buffer.from(svg)).png().toBuffer());
  }

  const serial='LILA-'+crypto.randomBytes(3).toString('hex').toUpperCase();
  const passJson={
    formatVersion:1, passTypeIdentifier:PASS_TYPE_ID, teamIdentifier:TEAM_ID, serialNumber:serial,
    organizationName:'Lila Wiesbaden', description:'lila.',
    foregroundColor:'rgb(61,42,115)', labelColor:'rgb(90,65,140)', backgroundColor:LILA,
    [kind]: fields,
    barcodes:[{format:'PKBarcodeFormatQR',message:serial,messageEncoding:'iso-8859-1',altText:serial}],
  };
  writeFileSync(join(BUILD,'pass.json'), JSON.stringify(passJson,null,2));

  const files=['pass.json','icon.png','icon@2x.png','icon@3x.png','strip.png','strip@2x.png','strip@3x.png'];
  const manifest={}; for(const f of files) manifest[f]=crypto.createHash('sha1').update(readFileSync(join(BUILD,f))).digest('hex');
  writeFileSync(join(BUILD,'manifest.json'), JSON.stringify(manifest));
  execFileSync('openssl',['smime','-binary','-sign','-certfile',join(CERTS,'wwdr.pem'),'-signer',join(CERTS,'pass.pem'),'-inkey',join(CERTS,'pass.key'),'-in',join(BUILD,'manifest.json'),'-out',join(BUILD,'signature'),'-outform','DER'],{stdio:'inherit'});

  mkdirSync(PASSDIR,{recursive:true}); rmSync(OUT,{force:true});
  const output=createWriteStream(OUT); const archive=archiver('zip',{zlib:{level:9}});
  const done=new Promise((res,rej)=>{output.on('close',res);archive.on('error',rej);}); archive.pipe(output);
  for(const f of [...files,'manifest.json','signature']) archive.file(join(BUILD,f),{name:f});
  await archive.finalize(); await done;
  console.log(`✅ ${out}: ${readFileSync(OUT).length} B | ${serial}`);
}

const LDIR='C:\\Users\\maykt\\Downloads\\lila\\';
try {
  await makePass({ src:LDIR+'e7d3f4be-715b-42eb-9c39-282093e8045b.png', out:'lila-stamp5.pkpass', label:'s5', kind:'storeCard',
    fields:{ headerFields:[{key:'c',label:'STEMPEL',value:'0/5'}], secondaryFields:[{key:'r',label:'BELOHNUNG',value:'Dein Lieblingsdrink'}] }});
  await makePass({ src:LDIR+'5dea4dd6-8b2f-4a55-97de-fce32b53c9c3.png', out:'lila-stamp10.pkpass', label:'s10', kind:'storeCard',
    fields:{ headerFields:[{key:'c',label:'STEMPEL',value:'0/10'}], secondaryFields:[{key:'r',label:'BELOHNUNG',value:'Dein Lieblingsdrink'}] }});
  console.log('\n🎉 2 Stempelkarten gebaut.');
  process.exit(0);
} catch(e){ console.error('FEHLER:',e.message,e.stack); process.exit(1); }
