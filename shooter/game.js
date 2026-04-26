// ===== Constants =====
const W = 800;
const H = 600;

const PLAYER = {
  radius: 14,
  speed: 220,
  fireCooldown: 0.14,
  invulnTime: 0.8,
};

const BULLET = {
  player: { speed: 650, damage: 25, radius: 4, color: '#ffeb6b', glow: '#fff7a8' },
  enemy:  { speed: 320, damage: 12, radius: 5, color: '#ff5050', glow: '#ff9999' },
};

const ENEMY_TYPES = {
  chaser:  { hp: 25,  speed: 110, radius: 12, contactDmg: 8,  color: '#e84c3d', shape: 'circle' },
  shooter: { hp: 35,  speed: 70,  radius: 13, contactDmg: 6,  color: '#ff944d', shape: 'diamond', fireInterval: 1.4, range: 250 },
  tank:    { hp: 120, speed: 55,  radius: 18, contactDmg: 18, color: '#7d3c98', shape: 'square' },
  boss:    { hp: 600, speed: 50,  radius: 36, contactDmg: 25, color: '#8b1a1a', shape: 'boss',    fireInterval: 1.2 },
};

const LEVELS = [
  { name: 'Level 1', waves: [
    { delay: 0.5,  enemies: [['chaser', 4]] },
    { delay: 6.0,  enemies: [['chaser', 4]] },
    { delay: 12.0, enemies: [['chaser', 4]] },
  ]},
  { name: 'Level 2', waves: [
    { delay: 0.5,  enemies: [['chaser', 3], ['shooter', 2]] },
    { delay: 7.0,  enemies: [['chaser', 3], ['shooter', 2]] },
    { delay: 14.0, enemies: [['chaser', 2], ['shooter', 2]] },
  ]},
  { name: 'Level 3', waves: [
    { delay: 0.5,  enemies: [['chaser', 3], ['shooter', 2]] },
    { delay: 8.0,  enemies: [['tank', 2],   ['shooter', 2]] },
    { delay: 16.0, enemies: [['tank', 1],   ['boss', 1]] },
  ]},
];

const SPAWN_MARKER_TIME = 0.6;

// ===== Canvas / DOM =====
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const hpFill = document.getElementById('hp-fill');
const hpText = document.getElementById('hp-text');
const levelText = document.getElementById('level-text');
const enemiesText = document.getElementById('enemies-text');
const scoreText = document.getElementById('score-text');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');

// ===== State =====
let state = 'title'; // title | playing | levelClear | gameOver | victory
let levelIndex = 0;
let score = 0;
let player = null;
let enemies = [];
let playerBullets = [];
let enemyBullets = [];
let particles = [];
let spawnMarkers = [];
let waveQueue = [];
let levelTime = 0;

const keys = new Set();
const mouse = { x: W / 2, y: H / 2, down: false };

// ===== Utils =====
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

function withAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function isMoving() {
  return keys.has('ArrowLeft') || keys.has('ArrowRight') ||
         keys.has('ArrowUp')   || keys.has('ArrowDown')  ||
         keys.has('a') || keys.has('A') ||
         keys.has('d') || keys.has('D') ||
         keys.has('w') || keys.has('W') ||
         keys.has('s') || keys.has('S');
}

// ===== Init / state transitions =====
function showOverlay(title, sub) {
  overlayTitle.textContent = title;
  overlaySub.innerHTML = sub;
  overlay.classList.add('show');
}
function hideOverlay() {
  overlay.classList.remove('show');
}

function newPlayer() {
  return {
    x: W / 2, y: H / 2,
    hp: 100, maxHp: 100,
    invuln: 0,
    walkTime: 0,
    fireTimer: 0,
    recoil: 0,
    muzzle: 0,
    aim: 0,
    dustTimer: 0,
  };
}

function startLevel(idx) {
  levelIndex = idx;
  player = newPlayer();
  enemies = [];
  playerBullets = [];
  enemyBullets = [];
  particles = [];
  spawnMarkers = [];
  const level = LEVELS[idx];
  waveQueue = level.waves.map(w => ({
    delay: w.delay,
    enemies: w.enemies.map(([t, n]) => [t, n]),
    fired: false,
  }));
  levelTime = 0;
  state = 'playing';
  hideOverlay();
  updateHud();
}

function initTitle() {
  state = 'title';
  player = null;
  enemies = [];
  playerBullets = [];
  enemyBullets = [];
  particles = [];
  spawnMarkers = [];
  waveQueue = [];
  // Overlay starts shown via the .show class in HTML; ensure text is correct.
  showOverlay('TOP-DOWN SHOOTER',
    'Move: Arrows / WASD &nbsp;&middot;&nbsp; Aim: Mouse &nbsp;&middot;&nbsp; Shoot: Click<br>Press Enter to Start');
  updateHud();
}

// ===== Input =====
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
  keys.add(e.key);
  if (e.key === 'Enter') {
    if (state === 'title' || state === 'gameOver' || state === 'victory') {
      score = 0;
      startLevel(0);
    } else if (state === 'levelClear') {
      startLevel(levelIndex + 1);
    }
  }
}, { passive: false });

window.addEventListener('keyup', (e) => {
  keys.delete(e.key);
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
  mouse.y = (e.clientY - rect.top)  * (canvas.height / rect.height);
});

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) mouse.down = true;
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouse.down = false;
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ===== Spawning =====
function pickEdgePoint() {
  const margin = 40;
  const side = Math.floor(Math.random() * 4);
  if (side === 0) return { x: Math.random() * W, y: -margin };
  if (side === 1) return { x: W + margin, y: Math.random() * H };
  if (side === 2) return { x: Math.random() * W, y: H + margin };
  return { x: -margin, y: Math.random() * H };
}

function spawnEnemy(type, x, y) {
  const cfg = ENEMY_TYPES[type];
  enemies.push({
    type, x, y,
    hp: cfg.hp, maxHp: cfg.hp,
    speed: cfg.speed,
    radius: cfg.radius,
    contactDmg: cfg.contactDmg,
    color: cfg.color,
    shape: cfg.shape,
    hit: 0,
    fireTimer: cfg.fireInterval ? cfg.fireInterval * (0.4 + Math.random() * 0.5) : 0,
    fireInterval: cfg.fireInterval || 0,
    range: cfg.range || 0,
    pulse: Math.random() * 6,
    kvx: 0, kvy: 0,
  });
}

function fireSpawnWave(wave) {
  for (const [type, count] of wave.enemies) {
    for (let i = 0; i < count; i++) {
      const off = pickEdgePoint();
      const markerX = clamp(off.x, 30, W - 30);
      const markerY = clamp(off.y, 30, H - 30);
      spawnMarkers.push({
        markerX, markerY,
        spawnX: off.x, spawnY: off.y,
        type,
        t: SPAWN_MARKER_TIME,
        total: SPAWN_MARKER_TIME,
      });
    }
  }
}

function spawnDeathParticles(e) {
  const n = e.type === 'boss' ? 28 : (e.type === 'tank' ? 16 : 10);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 140;
    particles.push({
      x: e.x, y: e.y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.5 + Math.random() * 0.5,
      total: 1.0,
      radius: 2 + Math.random() * 2,
      color: e.color,
    });
  }
}

function fireBullet() {
  const cfg = BULLET.player;
  const a = player.aim;
  const ox = Math.cos(a), oy = Math.sin(a);
  const sx = player.x + ox * (PLAYER.radius + 18);
  const sy = player.y + oy * (PLAYER.radius + 18);
  playerBullets.push({
    x: sx, y: sy,
    vx: ox * cfg.speed, vy: oy * cfg.speed,
    radius: cfg.radius,
    damage: cfg.damage,
    color: cfg.color,
    glow: cfg.glow,
  });
}

function spawnEnemyBullet(x, y, ndx, ndy) {
  const cfg = BULLET.enemy;
  enemyBullets.push({
    x, y,
    vx: ndx * cfg.speed, vy: ndy * cfg.speed,
    radius: cfg.radius,
    damage: cfg.damage,
    color: cfg.color,
    glow: cfg.glow,
  });
}

function damagePlayer(amount) {
  if (player.invuln > 0) return;
  player.hp -= amount;
  player.invuln = PLAYER.invulnTime;
}

// ===== Update =====
function update(dt) {
  levelTime += dt;

  // Trigger waves whose delay has elapsed.
  for (const w of waveQueue) {
    if (!w.fired && levelTime >= w.delay) {
      w.fired = true;
      fireSpawnWave(w);
    }
  }

  // Spawn markers tick down; expired markers convert into enemies.
  for (let i = spawnMarkers.length - 1; i >= 0; i--) {
    const m = spawnMarkers[i];
    m.t -= dt;
    if (m.t <= 0) {
      spawnEnemy(m.type, m.spawnX, m.spawnY);
      spawnMarkers.splice(i, 1);
    }
  }

  // Player movement.
  let dx = 0, dy = 0;
  if (keys.has('ArrowLeft')  || keys.has('a') || keys.has('A')) dx -= 1;
  if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) dx += 1;
  if (keys.has('ArrowUp')    || keys.has('w') || keys.has('W')) dy -= 1;
  if (keys.has('ArrowDown')  || keys.has('s') || keys.has('S')) dy += 1;
  const moving = (dx !== 0 || dy !== 0);
  if (moving) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
  }
  player.x = clamp(player.x + dx * PLAYER.speed * dt, PLAYER.radius, W - PLAYER.radius);
  player.y = clamp(player.y + dy * PLAYER.speed * dt, PLAYER.radius, H - PLAYER.radius);
  if (moving) {
    player.walkTime += dt;
    player.dustTimer -= dt;
    if (player.dustTimer <= 0) {
      particles.push({
        x: player.x - dx * 8, y: player.y - dy * 8 + 6,
        vx: 0, vy: 0,
        life: 0.4, total: 0.4,
        radius: 2,
        color: '#9aa3b0',
      });
      player.dustTimer = 0.12;
    }
  }
  player.aim = Math.atan2(mouse.y - player.y, mouse.x - player.x);

  // Player timers.
  if (player.invuln    > 0) player.invuln    -= dt;
  if (player.recoil    > 0) player.recoil    -= dt;
  if (player.muzzle    > 0) player.muzzle    -= dt;
  if (player.fireTimer > 0) player.fireTimer -= dt;

  // Auto-fire while held.
  if (mouse.down && player.fireTimer <= 0) {
    fireBullet();
    player.fireTimer = PLAYER.fireCooldown;
    player.recoil = 0.06;
    player.muzzle = 0.05;
  }

  // Bullets advance.
  for (const b of playerBullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
  for (const b of enemyBullets)  { b.x += b.vx * dt; b.y += b.vy * dt; }
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    const b = playerBullets[i];
    if (b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) playerBullets.splice(i, 1);
  }
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    if (b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) enemyBullets.splice(i, 1);
  }

  // Enemies update.
  for (const e of enemies) {
    if (e.hit > 0) e.hit -= dt;
    e.pulse += dt;
    const dxp = player.x - e.x;
    const dyp = player.y - e.y;
    const d = Math.hypot(dxp, dyp) || 1;
    const ndx = dxp / d, ndy = dyp / d;

    if (e.type === 'shooter') {
      let moveDir = 0;
      if (d > e.range + 20)      moveDir = 1;
      else if (d < e.range - 20) moveDir = -1;
      e.x += ndx * e.speed * moveDir * dt;
      e.y += ndy * e.speed * moveDir * dt;
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        e.fireTimer = e.fireInterval;
        spawnEnemyBullet(e.x, e.y, ndx, ndy);
      }
    } else if (e.type === 'boss') {
      e.x += ndx * e.speed * dt;
      e.y += ndy * e.speed * dt;
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        e.fireTimer = e.fireInterval;
        const baseAng = Math.atan2(ndy, ndx);
        for (const off of [-0.28, 0, 0.28]) {
          const a = baseAng + off;
          spawnEnemyBullet(e.x, e.y, Math.cos(a), Math.sin(a));
        }
      }
    } else {
      // chaser, tank: chase player
      e.x += ndx * e.speed * dt;
      e.y += ndy * e.speed * dt;
    }

    // Apply knockback impulse (decays).
    if (e.kvx || e.kvy) {
      e.x += e.kvx * dt;
      e.y += e.kvy * dt;
      e.kvx *= 0.86;
      e.kvy *= 0.86;
      if (Math.abs(e.kvx) < 1) e.kvx = 0;
      if (Math.abs(e.kvy) < 1) e.kvy = 0;
    }
  }

  // Player bullets vs enemies.
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    const b = playerBullets[i];
    let consumed = false;
    for (const e of enemies) {
      if (dist(b.x, b.y, e.x, e.y) <= e.radius + b.radius) {
        e.hp -= b.damage;
        e.hit = 0.07;
        const klen = Math.hypot(b.vx, b.vy) || 1;
        const kf = 80;
        e.kvx += (b.vx / klen) * kf;
        e.kvy += (b.vy / klen) * kf;
        consumed = true;
        break;
      }
    }
    if (consumed) playerBullets.splice(i, 1);
  }

  // Remove dead enemies.
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.hp <= 0) {
      spawnDeathParticles(e);
      score += e.type === 'boss' ? 100 : e.type === 'tank' ? 25 : 10;
      enemies.splice(i, 1);
    }
  }

  // Player vs enemy contact.
  if (player.invuln <= 0) {
    for (const e of enemies) {
      if (dist(player.x, player.y, e.x, e.y) <= e.radius + PLAYER.radius) {
        damagePlayer(e.contactDmg);
        break;
      }
    }
  }

  // Player vs enemy bullets.
  if (player.invuln <= 0) {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      if (dist(player.x, player.y, b.x, b.y) <= b.radius + PLAYER.radius) {
        damagePlayer(b.damage);
        enemyBullets.splice(i, 1);
        break;
      }
    }
  }

  // Particles.
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // State transitions.
  if (player.hp <= 0) {
    player.hp = 0;
    state = 'gameOver';
    showOverlay('GAME OVER', `Score: ${score}<br>Press Enter to restart`);
    return;
  }
  const wavesLeft = waveQueue.some(w => !w.fired);
  if (!wavesLeft && enemies.length === 0 && spawnMarkers.length === 0) {
    if (levelIndex === LEVELS.length - 1) {
      state = 'victory';
      showOverlay('VICTORY', `Score: ${score}<br>Press Enter to play again`);
    } else {
      state = 'levelClear';
      showOverlay(`Level ${levelIndex + 1} Cleared`, 'Press Enter for next level');
    }
  }
}

// ===== Render =====
function render() {
  // Background.
  ctx.fillStyle = '#15141a';
  ctx.fillRect(0, 0, W, H);

  // Floor grid.
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Particles (under everything else for now — they look fine here).
  for (const p of particles) {
    const alpha = clamp(p.life / p.total, 0, 1);
    ctx.fillStyle = withAlpha(rgbHex(p.color), alpha);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Spawn markers.
  for (const m of spawnMarkers) {
    drawSpawnMarker(m.markerX, m.markerY, m.t / m.total);
  }

  // Enemies.
  for (const e of enemies) drawEnemy(e);

  // Player.
  if (player) drawPlayer();

  // Bullets above bodies.
  for (const b of playerBullets) drawBullet(b);
  for (const b of enemyBullets)  drawBullet(b);
}

function rgbHex(c) {
  // Accept '#rrggbb' or rgb-ish strings; for non-hex we synthesize a fallback grey.
  if (typeof c === 'string' && c.startsWith('#') && c.length === 7) return c;
  return '#9aa3b0';
}

function drawPlayer() {
  ctx.save();

  // Recoil offset along the negative aim vector.
  let rx = 0, ry = 0;
  if (player.recoil > 0) {
    const k = (player.recoil / 0.06) * 4;
    rx = -Math.cos(player.aim) * k;
    ry = -Math.sin(player.aim) * k;
  }

  // Walk bob.
  let by = 0;
  const moving = isMoving();
  if (moving) by = Math.sin(player.walkTime * 14) * 1.5;

  const px = player.x + rx;
  const py = player.y + ry + by;

  // Invulnerability blink.
  let alpha = 1;
  if (player.invuln > 0) {
    alpha = (Math.floor(player.invuln * 14) % 2 === 0) ? 0.4 : 1;
  }
  ctx.globalAlpha = alpha;

  // Legs (small circles at feet).
  ctx.fillStyle = '#1c2733';
  if (moving) {
    const legPhase = Math.sin(player.walkTime * 14);
    ctx.beginPath(); ctx.arc(px - 6, py + 9 + legPhase * 1.5, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + 6, py + 9 - legPhase * 1.5, 3.5, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(px - 6, py + 9, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + 6, py + 9, 3.5, 0, Math.PI * 2); ctx.fill();
  }

  // Body.
  ctx.fillStyle = '#3aa5d9';
  ctx.beginPath(); ctx.arc(px, py, PLAYER.radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#0e2533';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Head.
  ctx.fillStyle = '#f0c98a';
  ctx.beginPath(); ctx.arc(px, py - 2, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3b2a14';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Arm + gun barrel rotated to aim.
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(player.aim);
  ctx.fillStyle = '#3aa5d9';
  ctx.fillRect(0, -3, PLAYER.radius + 4, 6);
  ctx.strokeStyle = '#0e2533';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, -3, PLAYER.radius + 4, 6);
  ctx.fillStyle = '#222';
  ctx.fillRect(PLAYER.radius + 4, -2, 14, 4);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(PLAYER.radius + 4, -2, 14, 4);

  if (player.muzzle > 0) {
    ctx.fillStyle = 'rgba(255,230,120,0.95)';
    ctx.beginPath(); ctx.arc(PLAYER.radius + 22, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(PLAYER.radius + 22, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  ctx.restore();
}

function drawEnemy(e) {
  ctx.save();
  const flashed = e.hit > 0;
  const fillColor = flashed ? '#ffffff' : e.color;

  if (e.shape === 'circle') {
    ctx.fillStyle = fillColor;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (!flashed) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(e.x + 3, e.y - 3, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(e.x + 3.5, e.y - 3, 1, 0, Math.PI * 2); ctx.fill();
    }
  } else if (e.shape === 'diamond') {
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y - e.radius);
    ctx.lineTo(e.x + e.radius, e.y);
    ctx.lineTo(e.x, e.y + e.radius);
    ctx.lineTo(e.x - e.radius, e.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (!flashed) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(e.x, e.y - 1, 2, 0, Math.PI * 2); ctx.fill();
    }
  } else if (e.shape === 'square') {
    const s = e.radius * 1.6;
    ctx.fillStyle = fillColor;
    roundRect(ctx, e.x - s / 2, e.y - s / 2, s, s, 4);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (!flashed) {
      // armor plates
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(e.x - s / 2 + 4, e.y - 2, s - 8, 4);
    }
  } else if (e.shape === 'boss') {
    const ring = Math.sin(e.pulse * 4) * 4;
    ctx.strokeStyle = 'rgba(220,40,40,0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 12 + ring, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = fillColor;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.stroke();
    if (!flashed) {
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath(); ctx.arc(e.x - 10, e.y - 6, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + 10, e.y - 6, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(e.x - 10, e.y - 6, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + 10, e.y - 6, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    // Boss HP bar above its head.
    const w = 90, h = 6;
    ctx.fillStyle = '#000';
    ctx.fillRect(e.x - w / 2 - 1, e.y - e.radius - 18, w + 2, h + 2);
    ctx.fillStyle = '#aa1a1a';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 17, w * (e.hp / e.maxHp), h);
  }

  ctx.restore();
}

function drawBullet(b) {
  ctx.fillStyle = b.glow;
  ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.arc(b.x, b.y, b.radius + 3, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = b.color;
  ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
}

function drawSpawnMarker(x, y, alpha) {
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.fillStyle = '#ff5050';
  ctx.beginPath();
  ctx.moveTo(x, y - 12);
  ctx.lineTo(x + 10, y + 8);
  ctx.lineTo(x - 10, y + 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ===== HUD =====
function updateHud() {
  const hp = player ? Math.max(0, player.hp) : 100;
  const max = player ? player.maxHp : 100;
  hpFill.style.width = (hp / max * 100) + '%';
  hpText.textContent = Math.ceil(hp);
  levelText.textContent = `Level ${state === 'title' ? 1 : levelIndex + 1}`;

  const queued = waveQueue
    ? waveQueue.filter(w => !w.fired).reduce((s, w) => s + w.enemies.reduce((a, [, n]) => a + n, 0), 0)
    : 0;
  const pending = spawnMarkers ? spawnMarkers.length : 0;
  const alive   = enemies ? enemies.length : 0;
  enemiesText.textContent = `Enemies: ${alive + pending + queued}`;
  scoreText.textContent   = `Score: ${score}`;
}

// ===== Main loop =====
let last = 0;
function loop(ts) {
  if (!last) last = ts;
  const dt = Math.min((ts - last) / 1000, 0.033);
  last = ts;
  if (state === 'playing') update(dt);
  render();
  updateHud();
  requestAnimationFrame(loop);
}

initTitle();
requestAnimationFrame(loop);
