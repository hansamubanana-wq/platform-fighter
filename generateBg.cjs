const fs = require('fs');
const { createCanvas } = require('canvas');

// Canvas作成
const width = 1920;
const height = 1080;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// --- 背景のグラデーション ---
const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
skyGrad.addColorStop(0, '#0a0a2a'); // 夜空の上部
skyGrad.addColorStop(0.4, '#1a1040'); // 真ん中あたり
skyGrad.addColorStop(0.7, '#4a2550'); // 地平線近くの紫
skyGrad.addColorStop(1, '#8a3c50'); // 地平線のオレンジがかった赤
ctx.fillStyle = skyGrad;
ctx.fillRect(0, 0, width, height);

// --- 星空 ---
ctx.fillStyle = '#ffffff';
for (let i = 0; i < 400; i++) {
  const x = Math.random() * width;
  const y = Math.random() * height * 0.7; // 上部にのみ星
  const r = Math.random() * 2;
  ctx.globalAlpha = Math.random() * 0.8 + 0.2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
ctx.globalAlpha = 1.0;

// --- 雲 (レイヤー1 - 遠景) ---
ctx.fillStyle = '#2a1a4a';
ctx.globalAlpha = 0.6;
for (let i = 0; i < 15; i++) {
  const cx = Math.random() * width;
  const cy = height * 0.6 + Math.random() * 150;
  const w = 200 + Math.random() * 400;
  const h = 50 + Math.random() * 100;
  
  ctx.beginPath();
  ctx.ellipse(cx, cy, w/2, h/2, 0, 0, Math.PI*2);
  ctx.fill();
}

// --- オーロラエフェクト ---
for (let i = 0; i < 3; i++) {
  const aurora = ctx.createLinearGradient(0, 0, 0, height*0.6);
  aurora.addColorStop(0, 'rgba(0, 255, 150, 0)');
  aurora.addColorStop(0.5, 'rgba(0, 255, 150, 0.15)');
  aurora.addColorStop(1, 'rgba(0, 255, 150, 0)');
  
  ctx.fillStyle = aurora;
  ctx.beginPath();
  ctx.moveTo(0, height*0.5);
  ctx.bezierCurveTo(
    width * 0.3, height * 0.2 + i * 50,
    width * 0.6, height * 0.6 - i * 50,
    width, height * 0.3
  );
  ctx.lineTo(width, 0);
  ctx.lineTo(0, 0);
  ctx.fill();
}

// --- 遠くの山並み / 浮遊島 ---
ctx.fillStyle = '#100a1a';
ctx.globalAlpha = 0.8;
ctx.beginPath();
ctx.moveTo(0, height);
for (let i = 0; i <= 10; i++) {
  const x = (width / 10) * i;
  const y = height * 0.85 - Math.random() * 150 + (i % 2 === 0 ? 50 : -50);
  ctx.lineTo(x, y);
}
ctx.lineTo(width, height);
ctx.fill();

// ファイルに保存
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('public/assets/bg.png', buffer);
console.log('Successfully generated new background without front platforms -> public/assets/bg.png');
