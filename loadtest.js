require('dotenv').config();
console.log('[loadtest WS_URL]', process.env.WS_URL || 'ws://localhost:8080');

const WebSocket = require('ws');
const os = require('os');

const WS_URL = process.env.WS_URL || 'ws://localhost:8080';
const CONCURRENCY = Number(process.env.USERS || 30); // 동시 접속 수
const UPDATE_HZ = Number(process.env.HZ || 1); // 1명이 초당 몇 번 위치전송
const DURATION_SEC = Number(process.env.DURATION || 30); // 테스트 길이(초)
const CENTER = { lat: 37.24958126229168, lng: 127.02893793201447 }; // 내 위치
const SPREAD_M = 50; // 50m 반경

function jitterMeters(m) {
  return (Math.random() - 0.5) * 2 * m;
}
function metersToDegreesLat(m) {
  return m / 111_000;
}
function metersToDegreesLng(m, lat) {
  return m / (111_000 * Math.cos((lat * Math.PI) / 180));
}

function randomStart() {
  const jx = jitterMeters(SPREAD_M);
  const jy = jitterMeters(SPREAD_M);
  const lat = CENTER.lat + metersToDegreesLat(jy);
  const lng = CENTER.lng + metersToDegreesLng(jx, CENTER.lat);
  return { lat, lng };
}

function moveSlightly({ lat, lng }) {
  const step = 2; // 2m 주변 흔들기
  const jx = jitterMeters(step);
  const jy = jitterMeters(step);
  return {
    lat: lat + metersToDegreesLat(jy),
    lng: lng + metersToDegreesLng(jx, lat),
  };
}

let totalRecvBytes = 0;
let totalRecvMsgs = 0;
let alive = 0;

function makeClient(id) {
  const ws = new WebSocket(WS_URL);
  let pos = randomStart();
  let timer = null;

  ws.on('open', () => {
    alive++;
    ws.send(JSON.stringify({ type: 'home_ready' }));
    ws.send(JSON.stringify({ type: 'user_join', userId: `u${id}` }));

    // 위치 주기 전송
    timer = setInterval(() => {
      pos = moveSlightly(pos);
      ws.send(
        JSON.stringify({
          type: 'location_update',
          userId: `u${id}`,
          userName: `User-${id}`,
          lat: pos.lat,
          lng: pos.lng,
        }),
      );
    }, 1000 / UPDATE_HZ);
  });

  ws.on('message', (buf) => {
    totalRecvBytes += buf.length;
    totalRecvMsgs += 1;
  });

  ws.on('close', () => {
    alive--;
    if (timer) clearInterval(timer);
  });

  ws.on('error', () => {
    /* ignore for load */
  });
}

for (let i = 0; i < CONCURRENCY; i++) makeClient(i + 1);

let elapsed = 0;
const statsTimer = setInterval(() => {
  elapsed++;
  const mb = (totalRecvBytes / (1024 * 1024)).toFixed(2);
  console.log(`[t=${elapsed}s] alive=${alive} recvMsgs=${totalRecvMsgs}/s recvBytes=${mb}MB/s`);
  totalRecvBytes = 0;
  totalRecvMsgs = 0;
  if (elapsed >= DURATION_SEC) {
    clearInterval(statsTimer);
    console.log('DONE');
    process.exit(0);
  }
}, 1000);
