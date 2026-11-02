import { BINDING_FIELDS } from '../core/inputmap.js';
import { WORLD, standings } from '../core/game.js';

const CLOUDS = [
  [80, 120, 90, 28], [240, 80, 120, 32], [430, 140, 80, 24],
  [700, 90, 140, 34], [980, 130, 100, 26], [1160, 70, 90, 24],
  [160, 200, 70, 20], [860, 190, 110, 26], [540, 60, 70, 18],
];

const hotspots = [];

export function hitSpot(x, y) {
  for (let i = hotspots.length - 1; i >= 0; i -= 1) {
    const spot = hotspots[i];
    if (x >= spot.x && y >= spot.y && x < spot.x + spot.w && y < spot.y + spot.h) return spot.id;
  }
  return null;
}

function spot(id, x, y, w, h) {
  hotspots.push({ id, x, y, w, h });
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function panel(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(7, 16, 32, 0.82)';
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 214, 120, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function button(ctx, id, x, y, w, h, label, active) {
  spot(id, x, y, w, h);
  ctx.save();
  ctx.fillStyle = active ? 'rgba(233, 180, 35, 0.95)' : 'rgba(255, 248, 230, 0.12)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = active ? '#fff6d8' : 'rgba(255,255,255,0.28)';
  ctx.stroke();
  ctx.fillStyle = active ? '#1b1408' : '#f7f1e4';
  ctx.font = 'bold 20px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}

export function keyLabel(code) {
  const named = {
    Slash: '/',
    Period: '.',
    Semicolon: ';',
    Quote: "'",
    Space: 'Space',
    Enter: 'Enter',
    Escape: 'Esc',
    NumpadEnter: 'Num Enter',
    NumpadAdd: 'Num +',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
  };
  if (named[code]) return named[code];
  if (code?.startsWith('Key')) return code.slice(3);
  if (code?.startsWith('Digit')) return code.slice(5);
  if (code?.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code || '?';
}

function drawSky(ctx, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.h);
  sky.addColorStop(0, '#1a3f78');
  sky.addColorStop(0.45, '#67a4d6');
  sky.addColorStop(0.72, '#f2b56b');
  sky.addColorStop(1, '#8ec8ea');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  ctx.fillStyle = '#6e4b73';
  ctx.beginPath();
  ctx.moveTo(0, 430);
  ctx.lineTo(90, 360);
  ctx.lineTo(170, 410);
  ctx.lineTo(260, 330);
  ctx.lineTo(340, 420);
  ctx.lineTo(0, 430);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(1280, 450);
  ctx.lineTo(1180, 350);
  ctx.lineTo(1080, 420);
  ctx.lineTo(980, 340);
  ctx.lineTo(900, 430);
  ctx.lineTo(1280, 450);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  for (const [x, y, w, h] of CLOUDS) {
    const drift = ((time / 80) + x) % (WORLD.w + 200) - 100;
    blob(ctx, drift, y, w, h);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let x = -40; x < WORLD.w + 40; x += 70) {
    blob(ctx, x, WORLD.floor + 18, 78, 36);
  }
}

function blob(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.45, h, 0, 0, Math.PI * 2);
  ctx.ellipse(x - w * 0.28, y + 4, w * 0.32, h * 0.75, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.28, y + 6, w * 0.3, h * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawNet(ctx) {
  const x = WORLD.netX;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  blob(ctx, x, WORLD.netTop - 8, 90, 28);
  for (let y = WORLD.netTop; y < WORLD.netBot; y += 28) {
    blob(ctx, x, y, 70, 22);
  }
  blob(ctx, x, WORLD.netBot, 100, 30);
  ctx.save();
  ctx.strokeStyle = 'rgba(40, 60, 90, 0.35)';
  ctx.lineWidth = 2;
  for (let y = WORLD.netTop + 8; y < WORLD.netBot - 4; y += 16) {
    ctx.beginPath();
    ctx.moveTo(x - 24, y);
    ctx.lineTo(x + 24, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShip(ctx, ship, time) {
  if (!ship.participating) return;
  ctx.save();
  ctx.translate(ship.x, ship.y);
  if (!ship.alive) ctx.globalAlpha = 0.4;
  const bob = ship.alive ? Math.sin(time / 220 + ship.id) * 2.5 : 0;
  ctx.translate(0, bob);
  ctx.fillStyle = 'rgba(20, 30, 50, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 28, 26, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = ship.color;
  ctx.strokeStyle = '#1c140e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, -16, 48, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#24170f';
  ctx.fillRect(-48, -20, 96, 8);
  ctx.fillStyle = '#f4f0e6';
  ctx.beginPath();
  ctx.arc(0, -16, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c140e';
  ctx.fillRect(-3, -18, 2, 2);
  ctx.fillRect(2, -18, 2, 2);

  ctx.fillStyle = '#6b3a22';
  ctx.strokeStyle = '#1c140e';
  roundRect(ctx, -16, 6, 32, 14, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3d3a38';
  const muzzle = ship.facing >= 0 ? 10 : -24;
  ctx.fillRect(muzzle, 8, 16, 6);

  if (ship.charge > 0.04 && ship.alive) {
    ctx.fillStyle = `rgba(255, 190, 40, ${0.35 + ship.charge * 0.6})`;
    ctx.beginPath();
    ctx.arc(ship.facing * 30, 11, 4 + ship.charge * 10, 0, Math.PI * 2);
    ctx.fill();
  }
  if (ship.buff) {
    ctx.fillStyle = ship.buff === 'keg' ? '#ff8c42' : '#8be9fd';
    ctx.beginPath();
    ctx.arc(-30, -34, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#102033';
  ctx.font = 'bold 13px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(ship.short, 0, 36);
  ctx.restore();
}

function drawBall(ctx, ball, trail) {
  if (!ball?.active && trail.length === 0) return;
  ctx.save();
  for (let i = 0; i < trail.length; i += 1) {
    const t = trail[i];
    ctx.globalAlpha = (i / trail.length) * 0.35;
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(t.x, t.y, ball.radius * (0.4 + i / trail.length), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (!ball.active) return;
  const glow = ctx.createRadialGradient(ball.x, ball.y, 2, ball.x, ball.y, 28);
  glow.addColorStop(0, 'rgba(255, 236, 170, 0.95)');
  glow.addColorStop(1, 'rgba(255, 180, 40, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, 28, 0, Math.PI * 2);
  ctx.fill();
  const body = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 2, ball.x, ball.y, ball.radius);
  body.addColorStop(0, '#fff4c2');
  body.addColorStop(0.6, '#ffc43d');
  body.addColorStop(1, '#e85d04');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius - 2, 0.4, 2.2);
  ctx.stroke();
}

function drawPowerup(ctx, item, time) {
  if (!item) return;
  const pulse = 1 + Math.sin(time / 140) * 0.08;
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = 'rgba(255, 220, 120, 0.35)';
  ctx.beginPath();
  ctx.arc(0, 0, item.r + 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe8a3';
  ctx.strokeStyle = '#7a4b12';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, item.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5c3b09';
  ctx.font = 'bold 12px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const glyph = { tailwind: '»', keg: '!', lifeboat: '+', extraTouch: '+1' }[item.kind] || '*';
  ctx.fillText(glyph, 0, 1);
  ctx.restore();
}

function padIcon(ctx, x, y, on) {
  ctx.save();
  roundRect(ctx, x, y, 22, 14, 4);
  ctx.fillStyle = on ? '#8be9fd' : 'rgba(255,255,255,0.18)';
  ctx.fill();
  ctx.fillStyle = on ? '#083044' : 'rgba(255,255,255,0.45)';
  ctx.fillRect(x + 4, y + 6, 4, 3);
  ctx.beginPath();
  ctx.arc(x + 15, y + 7, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHud(ctx, match, pads) {
  ctx.save();
  ctx.fillStyle = 'rgba(7, 18, 34, 0.92)';
  roundRect(ctx, 16, 12, WORLD.w - 32, 108, 14);
  ctx.fill();
  ctx.fillStyle = '#f7f1e4';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 18px Trebuchet MS, sans-serif';

  if (match.mode === '2v2') {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffb4a2';
    ctx.font = 'bold 28px Georgia, serif';
    ctx.fillText(String(match.score.left), 36, 42);
    ctx.font = 'bold 14px Trebuchet MS, sans-serif';
    ctx.fillStyle = '#f7f1e4';
    ctx.fillText('PORT', 36, 68);
    match.ships.slice(0, 2).forEach((ship, i) => {
      ctx.fillStyle = ship.color;
      const label = ship.participating ? `${ship.short} ${ship.points}` : `${ship.short} —`;
      ctx.fillText(label, 110 + i * 110, 40);
      padIcon(ctx, 110 + i * 110, 52, !!pads[i]);
    });

    ctx.textAlign = 'right';
    ctx.fillStyle = '#bde0fe';
    ctx.font = 'bold 28px Georgia, serif';
    ctx.fillText(String(match.score.right), WORLD.w - 36, 42);
    ctx.font = 'bold 14px Trebuchet MS, sans-serif';
    ctx.fillStyle = '#f7f1e4';
    ctx.fillText('STARBOARD', WORLD.w - 36, 68);
    match.ships.slice(2).forEach((ship, i) => {
      ctx.textAlign = 'right';
      ctx.fillStyle = ship.color;
      const label = ship.participating ? `${ship.points} ${ship.short}` : `— ${ship.short}`;
      ctx.fillText(label, WORLD.w - 120 - i * 120, 40);
      padIcon(ctx, WORLD.w - 142 - i * 120, 52, !!pads[i + 2]);
    });
  } else {
    match.ships.forEach((ship, i) => {
      const x = 40 + i * 250;
      ctx.textAlign = 'left';
      ctx.fillStyle = ship.color;
      ctx.font = 'bold 16px Trebuchet MS, sans-serif';
      const lives = ship.participating ? `♥ ${ship.lives}` : 'out';
      ctx.fillText(`${ship.short}  ${lives}  ${ship.points}`, x, 38);
      padIcon(ctx, x, 52, !!pads[i]);
    });
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff8ea';
  ctx.font = 'bold 20px Georgia, serif';
  const best = match.gamesToWin * 2 - 1;
  ctx.fillText(`Game ${match.gameNumber}`, WORLD.w / 2, 40);
  ctx.font = '14px Trebuchet MS, sans-serif';
  ctx.fillStyle = '#f0e2c4';
  ctx.fillText(match.mode === '2v2' ? `first to ${match.gamesToWin}  ·  best of ${best}` : 'free-for-all  ·  7 lives', WORLD.w / 2, 64);
  ctx.font = 'bold 13px Trebuchet MS, sans-serif';
  ctx.fillStyle = '#f0e2c4';
  if (match.mode === '2v2') {
    const side = match.possessing;
    const used = side ? match.touches[side] : 0;
    const max = 3 + (side ? (match.bonusTouches[side] || 0) : 0);
    ctx.textAlign = 'right';
    ctx.fillText(side ? `${side} touches ${used}/${max}` : 'serve', WORLD.w / 2 - 16, 92);
  }
  const windX = WORLD.w / 2 + 36;
  ctx.textAlign = 'left';
  ctx.fillText('wind', windX, 92);
  ctx.strokeStyle = '#f7f1e4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(windX + 40, 92);
  ctx.lineTo(windX + 108, 92);
  ctx.stroke();
  const wx = windX + 74 + (match.wind / 130) * 30;
  ctx.fillStyle = '#ffe08a';
  ctx.beginPath();
  ctx.arc(wx, 92, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBanner(ctx, match, time) {
  if (match.phase === 'countdown' && match.countdown > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 16, 32, 0.45)';
    ctx.font = 'bold 120px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff8ea';
    ctx.fillText(String(match.countdown), WORLD.w / 2, WORLD.h / 2 - 10);
    ctx.font = 'bold 22px Trebuchet MS, sans-serif';
    ctx.fillText('Cannon ready', WORLD.w / 2, WORLD.h / 2 + 70);
    ctx.restore();
  }
  if (!match.banner || match.phase === 'countdown' || match.phase === 'rally') return;
  if (match.phase === 'match') return;
  ctx.save();
  panel(ctx, 340, 250, 600, 130);
  ctx.fillStyle = '#fff8ea';
  ctx.textAlign = 'center';
  ctx.font = 'bold 32px Georgia, serif';
  ctx.fillText(match.banner.title, WORLD.w / 2, 300);
  ctx.font = '18px Trebuchet MS, sans-serif';
  ctx.fillStyle = '#f0e2c4';
  ctx.fillText(match.banner.reason || '', WORLD.w / 2, 338);
  ctx.restore();
  void time;
}

function drawMatchOver(ctx, match) {
  const board = standings(match);
  panel(ctx, 300, 120, 680, 460);
  ctx.fillStyle = '#fff8ea';
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText(match.banner?.title || 'Match over', WORLD.w / 2, 180);
  ctx.font = '18px Trebuchet MS, sans-serif';
  ctx.fillStyle = '#f0e2c4';
  ctx.fillText('Standings', WORLD.w / 2, 214);
  board.rows.forEach((row, i) => {
    ctx.fillStyle = row.winner ? '#ffe08a' : '#f7f1e4';
    ctx.font = row.winner ? 'bold 22px Trebuchet MS, sans-serif' : '18px Trebuchet MS, sans-serif';
    ctx.fillText(`${row.label}  ·  ${row.detail}`, WORLD.w / 2, 260 + i * 36);
  });
  button(ctx, 'rematch', 420, 500, 180, 48, 'Rematch', true);
  button(ctx, 'to-title', 680, 500, 180, 48, 'Title', false);
}

function drawTitle(ctx, view) {
  if (view.cover?.complete && view.cover.naturalWidth) {
    const iw = view.cover.naturalWidth;
    const ih = view.cover.naturalHeight;
    const scale = Math.max(WORLD.w / iw, WORLD.h / ih);
    const w = iw * scale;
    const h = ih * scale;
    ctx.drawImage(view.cover, (WORLD.w - w) / 2, (WORLD.h - h) / 2, w, h);
  } else {
    drawSky(ctx, view.time);
    ctx.fillStyle = '#fff4d2';
    ctx.textAlign = 'center';
    ctx.font = 'bold 72px Georgia, serif';
    ctx.fillText('SKY PIRATE', WORLD.w / 2, 250);
    ctx.fillStyle = '#e9b423';
    ctx.fillText('VOLLEY', WORLD.w / 2, 330);
  }
  ctx.fillStyle = 'rgba(6, 12, 24, 0.62)';
  ctx.fillRect(0, 560, WORLD.w, 160);
  ctx.fillStyle = '#fff8ea';
  ctx.textAlign = 'center';
  ctx.font = 'bold 42px Georgia, serif';
  ctx.fillText('SKY PIRATE VOLLEY', WORLD.w / 2, 610);
  const blink = 0.45 + Math.sin(view.time / 220) * 0.45;
  ctx.globalAlpha = 0.55 + blink * 0.45;
  ctx.font = 'bold 22px Trebuchet MS, sans-serif';
  ctx.fillStyle = '#ffe08a';
  ctx.fillText('Press Enter / Start', WORLD.w / 2, 656);
  ctx.globalAlpha = 1;
  ctx.font = '16px Trebuchet MS, sans-serif';
  ctx.fillStyle = '#f0e2c4';
  ctx.fillText('Cannon volleyball over the cloud sea', WORLD.w / 2, 688);
  spot('start-title', 0, 0, WORLD.w, WORLD.h);
}

const SLOT_HELP = [
  'W A S D · F fire · G boost',
  'Arrows · / fire · . boost',
  'I J K L · ; fire · \' boost',
  'Num 8 4 5 6 · 0 fire · Num Enter boost',
];

function drawJoin(ctx, view) {
  drawSky(ctx, view.time);
  ctx.fillStyle = 'rgba(6, 12, 24, 0.35)';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.fillStyle = '#fff8ea';
  ctx.textAlign = 'center';
  ctx.font = 'bold 48px Georgia, serif';
  ctx.fillText('Choose your ships', WORLD.w / 2, 78);
  ctx.font = '18px Trebuchet MS, sans-serif';
  ctx.fillStyle = '#f0e2c4';
  ctx.fillText('Press your fire key to join. Secondary toggles bot or off. Empty seats fly as bots.', WORLD.w / 2, 112);

  button(ctx, 'mode-2v2', 390, 140, 220, 46, '2v2 teams', view.mode === '2v2');
  button(ctx, 'mode-ffa', 670, 140, 220, 46, 'Free-for-all', view.mode === 'ffa');

  const seats = [
    [150, 210],
    [150, 380],
    [670, 210],
    [670, 380],
  ];
  view.slots.forEach((slot, i) => {
    const [x, y] = seats[i];
    const ship = view.roster[i];
    ctx.save();
    ctx.fillStyle = 'rgba(8, 16, 32, 0.72)';
    roundRect(ctx, x, y, 460, 150, 16);
    ctx.fill();
    ctx.strokeStyle = ship.color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = ship.color;
    ctx.beginPath();
    ctx.ellipse(x + 70, y + 62, 42, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff8ea';
    ctx.textAlign = 'left';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillText(`P${i + 1}  ${ship.name}`, x + 130, y + 48);
    ctx.font = '16px Trebuchet MS, sans-serif';
    ctx.fillStyle = '#f0e2c4';
    ctx.fillText(SLOT_HELP[i], x + 130, y + 76);
    const status = slot === 'human' ? 'HUMAN ABOARD' : slot === 'off' ? 'SITTING OUT' : 'BOT CREW';
    ctx.fillStyle = slot === 'off' ? '#ffb4a2' : '#c8f7dc';
    ctx.font = 'bold 16px Trebuchet MS, sans-serif';
    ctx.fillText(status, x + 130, y + 104);
    if (view.pads[i]) padIcon(ctx, x + 420, y + 18, true);
    ctx.restore();
    spot(`slot-${i}`, x, y, 460, 150);
  });

  button(ctx, 'start-match', 490, 620, 300, 54, 'Launch match', true);
  if (view.notice) {
    ctx.fillStyle = '#ffb4a2';
    ctx.font = 'bold 16px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(view.notice, WORLD.w / 2, 600);
  }
}

function drawPause(ctx, view) {
  panel(ctx, 390, 160, 500, 380);
  ctx.fillStyle = '#fff8ea';
  ctx.textAlign = 'center';
  ctx.font = 'bold 42px Georgia, serif';
  ctx.fillText('Paused', WORLD.w / 2, 230);
  button(ctx, 'pause-resume', 470, 270, 340, 52, 'Resume', view.menuIndex === 0);
  button(ctx, 'pause-settings', 470, 340, 340, 52, 'Settings', view.menuIndex === 1);
  button(ctx, 'pause-quit', 470, 410, 340, 52, 'Quit to title', view.menuIndex === 2);
  ctx.fillStyle = '#f0e2c4';
  ctx.font = '16px Trebuchet MS, sans-serif';
  ctx.fillText('Esc or Start resumes', WORLD.w / 2, 500);
}

function drawSettings(ctx, view) {
  panel(ctx, 330, 120, 620, 470);
  ctx.fillStyle = '#fff8ea';
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText('Settings', WORLD.w / 2, 180);
  const volume = `${Math.round(view.settings.volume * 100)}%${view.settings.muted ? ' muted' : ''}`;
  button(ctx, 'volume', 420, 220, 440, 52, `Volume  ${volume}`, view.menuIndex === 0);
  button(ctx, 'bestof', 420, 290, 440, 52, `Round count  best of ${view.settings.bestOf}`, view.menuIndex === 1);
  button(ctx, 'open-controls', 420, 360, 440, 52, 'Controls', view.menuIndex === 2);
  button(ctx, 'settings-back', 420, 450, 440, 52, 'Back', view.menuIndex === 3);
  ctx.font = '15px Trebuchet MS, sans-serif';
  ctx.fillStyle = '#f0e2c4';
  ctx.fillText('Left / right change the highlighted row. M mutes.', WORLD.w / 2, 540);
}

function drawControls(ctx, view) {
  panel(ctx, 80, 40, 1120, 640);
  ctx.fillStyle = '#fff8ea';
  ctx.textAlign = 'center';
  ctx.font = 'bold 36px Georgia, serif';
  ctx.fillText('Controls', WORLD.w / 2, 90);
  ctx.font = '16px Trebuchet MS, sans-serif';
  ctx.fillStyle = '#f0e2c4';
  const hint = view.capturing
    ? 'Press the new key. Esc cancels.'
    : 'Arrows move. Enter rebinds. A connected gamepad overrides that seat.';
  ctx.fillText(hint, WORLD.w / 2, 124);

  view.settings.bindings.forEach((binding, player) => {
    const x = 120 + player * 270;
    ctx.fillStyle = view.roster[player].color;
    ctx.font = 'bold 18px Trebuchet MS, sans-serif';
    ctx.fillText(`P${player + 1} ${view.roster[player].short}`, x + 100, 170);
    BINDING_FIELDS.forEach((field, row) => {
      const y = 200 + row * 62;
      const active = view.controlCursor.player === player && view.controlCursor.field === row;
      const armed = active && view.capturing;
      button(ctx, `bind-${player}-${row}`, x, y, 210, 48, `${field}  ${keyLabel(binding[field])}`, active || armed);
    });
  });
  button(ctx, 'controls-back', 400, 590, 200, 48, 'Back', false);
  button(ctx, 'controls-reset', 680, 590, 200, 48, 'Reset', false);
}

function drawParticles(ctx, particles) {
  for (const bit of particles) {
    ctx.globalAlpha = Math.max(0, bit.life / bit.max);
    ctx.fillStyle = bit.color;
    ctx.beginPath();
    ctx.arc(bit.x, bit.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function render(ctx, view) {
  hotspots.length = 0;
  ctx.clearRect(0, 0, WORLD.w, WORLD.h);
  if (view.screen === 'title') {
    drawTitle(ctx, view);
    return;
  }
  if (view.screen === 'join') {
    drawJoin(ctx, view);
    return;
  }
  if (view.screen === 'settings') {
    drawSky(ctx, view.time);
    drawSettings(ctx, view);
    return;
  }
  if (view.screen === 'controls') {
    drawSky(ctx, view.time);
    drawControls(ctx, view);
    return;
  }

  drawSky(ctx, view.time);
  if (view.match?.mode === 'ffa') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(WORLD.netX, 90);
    ctx.lineTo(WORLD.netX, WORLD.floor);
    ctx.moveTo(80, WORLD.midY);
    ctx.lineTo(WORLD.w - 80, WORLD.midY);
    ctx.stroke();
    ctx.restore();
  }
  drawNet(ctx);
  drawPowerup(ctx, view.match?.powerup, view.time);
  if (view.match) {
    for (const ship of view.match.ships) drawShip(ctx, ship, view.time);
    drawBall(ctx, view.match.ball, view.trail || []);
    drawParticles(ctx, view.particles || []);
    drawHud(ctx, view.match, view.pads);
    drawBanner(ctx, view.match, view.time);
    if (view.match.phase === 'match') drawMatchOver(ctx, view.match);
  }
  if (view.screen === 'pause') drawPause(ctx, view);
}
