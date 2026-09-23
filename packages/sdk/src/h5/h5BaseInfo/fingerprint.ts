import md5 from 'blueimp-md5';

export interface CanvasFingerprint {
  hash: string
  fingerPrint: string
}

// canvas 绘制结果的 md5 作为设备指纹；拼接 UA 与语言得到浏览器指纹
export default function fingerprinting (): CanvasFingerprint {
  const { userAgent, language } = window.navigator
  const canvas = document.createElement('canvas');
  canvas.width = 2000;
  canvas.height = 200;
  canvas.style.display = 'inline';
  const ctx = canvas.getContext('2d');
  if (!ctx) return { hash: '', fingerPrint: md5(userAgent + language) }

  // detect browser support of canvas winding
  // http://blogs.adobe.com/webplatform/2013/01/30/winding-rules-in-canvas/
  ctx.rect(0, 0, 10, 10);
  ctx.rect(2, 2, 6, 6);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f60';
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = '#069';
  // https://github.com/Valve/fingerprintjs2/issues/66
  ctx.font = '11pt no-real-font-123';
  ctx.fillText('Cwm fjordbank glyphs vext quiz, \ud83d\ude03', 2, 15);
  ctx.fillStyle = 'rgba(102, 204, 0, 0.2)';
  ctx.font = '18pt Arial';
  ctx.fillText('Cwm fjordbank glyphs vext quiz, \ud83d\ude03', 4, 45);

  // canvas blending
  // http://blogs.adobe.com/webplatform/2013/01/28/blending-features-in-canvas/
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgb(255,0,255)';
  ctx.beginPath();
  ctx.arc(50, 50, 50, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgb(0,255,255)';
  ctx.beginPath();
  ctx.arc(100, 50, 50, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgb(255,255,0)';
  ctx.beginPath();
  ctx.arc(75, 100, 50, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgb(255,0,255)';
  // canvas winding
  ctx.arc(75, 75, 75, 0, Math.PI * 2, true);
  ctx.arc(75, 75, 25, 0, Math.PI * 2, true);
  ctx.fill('evenodd');

  const rawData = canvas.toDataURL();
  return { hash: md5(rawData), fingerPrint: md5(rawData + userAgent + language) };
}
