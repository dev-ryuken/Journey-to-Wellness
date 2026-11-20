import * as THREE from 'three';

export interface ProceduralTextureSet {
  grass: THREE.CanvasTexture;
  cobble: THREE.CanvasTexture;
  wood: THREE.CanvasTexture;
  roofTile: THREE.CanvasTexture;
  water: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  track: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  maxAniso: number,
  isColor = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAniso;
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(renderer: THREE.WebGLRenderer): ProceduralTextureSet {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // 1. Grass with clover & subtle warm meadow speckles
  const [grassC, grassCtx] = makeCanvas(256);
  grassCtx.fillStyle = '#7EC47B';
  grassCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 420; i++) {
    const x = (Math.sin(i * 78.233) * 0.5 + 0.5) * 256;
    const y = (Math.sin(i * 45.164) * 0.5 + 0.5) * 256;
    grassCtx.fillStyle = i % 3 === 0 ? '#6AB368' : i % 3 === 1 ? '#92D48E' : '#A4DF98';
    grassCtx.beginPath();
    grassCtx.arc(x, y, 2 + (i % 4), 0, Math.PI * 2);
    grassCtx.fill();
  }
  const grass = finalizeTexture(grassC, 22, 22, maxAniso, true);

  // 2. Warm Village Cobblestone
  const [cobbleC, cobbleCtx] = makeCanvas(256);
  cobbleCtx.fillStyle = '#D5CFC2';
  cobbleCtx.fillRect(0, 0, 256, 256);
  const rows = 8;
  const cols = 6;
  const cellW = 256 / cols;
  const cellH = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const offset = (r % 2) * (cellW * 0.5);
      const x = (c * cellW + offset) % 256;
      const y = r * cellH;
      const shade = 215 + ((r * 7 + c * 13) % 24) - 12;
      cobbleCtx.fillStyle = `rgb(${shade}, ${shade - 8}, ${shade - 20})`;
      cobbleCtx.beginPath();
      cobbleCtx.roundRect(x + 2, y + 2, cellW - 4, cellH - 4, 6);
      cobbleCtx.fill();
    }
  }
  const cobble = finalizeTexture(cobbleC, 6, 6, maxAniso, true);

  // 3. Timber Wood Planks
  const [woodC, woodCtx] = makeCanvas(256);
  woodCtx.fillStyle = '#B88456';
  woodCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) {
    const y = i * 32;
    woodCtx.fillStyle = i % 2 === 0 ? '#AD7A4D' : '#C18D5F';
    woodCtx.fillRect(0, y + 1, 256, 30);
    woodCtx.fillStyle = 'rgba(70, 42, 18, 0.25)';
    woodCtx.fillRect(0, y, 256, 2);
  }
  const wood = finalizeTexture(woodC, 2, 2, maxAniso, true);

  // 4. Terracotta / Cottage Roof Shingles
  const [roofC, roofCtx] = makeCanvas(256);
  roofCtx.fillStyle = '#D96B4B';
  roofCtx.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const x = c * 32 + ((r % 2) * 16);
      const y = r * 32;
      roofCtx.fillStyle = (r + c) % 2 === 0 ? '#C95D3E' : '#E27756';
      roofCtx.beginPath();
      roofCtx.arc(x, y + 16, 15, 0, Math.PI);
      roofCtx.fill();
    }
  }
  const roofTile = finalizeTexture(roofC, 3, 3, maxAniso, true);

  // 5. Shimmering Water Ripples
  const [waterC, waterCtx] = makeCanvas(256);
  waterCtx.fillStyle = '#38BDF8';
  waterCtx.fillRect(0, 0, 256, 256);
  waterCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  waterCtx.lineWidth = 3;
  for (let y = 16; y < 256; y += 32) {
    waterCtx.beginPath();
    for (let x = 0; x <= 256; x += 16) {
      const wy = y + Math.sin((x / 256) * Math.PI * 4) * 5;
      if (x === 0) waterCtx.moveTo(x, wy);
      else waterCtx.lineTo(x, wy);
    }
    waterCtx.stroke();
  }
  const water = finalizeTexture(waterC, 3, 3, maxAniso, true);

  // 6. Soft Radial Contact Shadow
  const [shadC, shadCtx] = makeCanvas(128);
  const grad = shadCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.5)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.22)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  shadCtx.fillStyle = grad;
  shadCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shadC);
  contactShadow.colorSpace = THREE.SRGBColorSpace;
  contactShadow.needsUpdate = true;

  // 7. Sports Track Lanes
  const [trackC, trackCtx] = makeCanvas(256);
  trackCtx.fillStyle = '#D96D49';
  trackCtx.fillRect(0, 0, 256, 256);
  trackCtx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let y = 32; y < 256; y += 64) {
    trackCtx.fillRect(0, y, 256, 4);
  }
  const track = finalizeTexture(trackC, 4, 2, maxAniso, true);

  return {
    grass,
    cobble,
    wood,
    roofTile,
    water,
    contactShadow,
    track,
    dispose: () => {
      grass.dispose();
      cobble.dispose();
      wood.dispose();
      roofTile.dispose();
      water.dispose();
      contactShadow.dispose();
      track.dispose();
    },
  };
}
