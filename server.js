const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Map(); // Map<ws, { userId, lat, lng }>

// 거리 계산 함수 (Haversine)
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const RADIUS_KM = 0.01;

wss.on("connection", (ws) => {
  console.log("🔗 New client connected");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (
        data.type === "location_update" &&
        data.userId &&
        data.lat &&
        data.lng
      ) {
        clients.set(ws, {
          userId: data.userId,
          lat: data.lat,
          lng: data.lng,
        });

        console.log(
          `📡 위치 업데이트 from ${data.userId}: (${data.lat}, ${data.lng})`
        );

        // ✅ 현재 접속 중인 클라이언트 수 확인
        console.log("👥 현재 클라이언트 수:", clients.size);

        // ✅ 모든 사용자 ID 출력
        console.log(
          "🆔 현재 접속자 목록:",
          Array.from(clients.values()).map((c) => c.userId)
        );

        // 반경 내 사용자 찾기 로직 생략 (기존대로 유지)
        // ...
      }
    } catch (err) {
      console.error("❌ 메시지 처리 중 오류:", err.message);
    }
  });

  ws.on("close", () => {
    console.log("❌ Client disconnected");
    clients.delete(ws);
  });
});
