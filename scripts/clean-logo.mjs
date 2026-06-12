// Sauberes lila.-Logo aus dem Querformat-Stempelkarten-Design (hohe Auflösung, kein Freistell-Matsch).
// Wir nehmen das Logo direkt als Crop MIT lila Hintergrund (kein Threshold) -> sauber + scharf.
// Für den Dashboard-Avatar reicht ein quadratischer Crop um das "lila."-Logo.
import sharp from 'sharp';
const SRC='C:\\Users\\maykt\\Downloads\\lila\\e7d3f4be-715b-42eb-9c39-282093e8045b.png'; // 2024x777 Querformat
const O='C:\\Users\\maykt\\Downloads\\qr-voucher-customer-app\\public\\assets\\';

const m=await sharp(SRC).metadata();
console.log('Quelle:', m.width+'x'+m.height);
// lila. Logo ist oben rechts. Bei 2024 breit: ca x1750..2000, y40..170
// Erst groesseren Bereich als Vorschau
await sharp(SRC).extract({left:1700,top:30,width:300,height:160}).toFile(O+'_logocheck.png');
console.log('logocheck geschrieben');
