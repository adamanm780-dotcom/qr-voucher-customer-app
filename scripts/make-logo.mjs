// Finales lila.-Logo fuer Dashboard: quadratisch, sauber, Lila-BG passend zur Karte.
import sharp from 'sharp';
const SRC='C:\\Users\\maykt\\Downloads\\lila\\e7d3f4be-715b-42eb-9c39-282093e8045b.png';
const O='C:\\Users\\maykt\\Downloads\\qr-voucher-customer-app\\public\\assets\\';
// quadratischer Crop um "lila." (zentriert), dann auf 200x200
await sharp(SRC).extract({left:1720,top:40,width:260,height:140})
  .resize(240,240,{fit:'contain',background:'#b8a5dc'})
  .png().toFile(O+'lila-logo.png');
console.log('lila-logo.png (sauber) geschrieben');
