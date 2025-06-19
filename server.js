const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const os = require("os");

const serverHost = process.env.HOSTNAME || os.hostname();
const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 접속 클라이언트 정보 저장: Map<ws, { userId, lat, lng }>
const clients = new Map();

// 거리 계산 함수 (Haversine 공식)
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // 지구 반지름 (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getNearbyUsers(centerLat, centerLng, excludeUserIds = []) {
  return Array.from(clients.values())
    .filter(
      (c) =>
        c.lat != null &&
        c.lng != null &&
        !excludeUserIds.includes(c.userId) &&
        getDistanceKm(centerLat, centerLng, c.lat, c.lng) <= RADIUS_KM
    )
    .map((c) => ({
      userId: c.userId,
      lat: c.lat,
      lng: c.lng,
      distance: Math.round(getDistanceKm(centerLat, centerLng, c.lat, c.lng) * 1000),
    }));
}

const RADIUS_KM = 0.1; // 100미터 반경

wss.on("connection", (ws) => {
  console.log("🔗 New client connected");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      // 쿨릭 이벤트 처리
      if (data.type === "user_click" && data.from && data.to) {
        console.log(`사용자 ${data.from} -> ${data.to} 클릭`);

        //form 을 찾기 위해 해당 ws 찾기
        const fromEntry = [...clients.entries()].find(([, info]) => info.userId === data.from);
        if (!fromEntry) return;

        const [fromWs, fromInfo] = fromEntry;
        if (fromWs.readyState !== WebSocket.OPEN) return;

        const nearbyUsers = getNearbyUsers(fromInfo.lat, fromInfo.lng, [data.to, data.from]);

        const allUsers = Array.from(clients.values()).map(({ userId, lat, lng }) => ({
          userId,
          lat,
          lng,
        }));

        fromWs.send(
          JSON.stringify({
            type: "nearby_users",
            nearbyUsers,
            allUsers,
            server: serverHost,
          })
        );
      }

      // 위치 업데이트 처리
      if (data.type === "location_update" && data.userId && data.lat && data.lng) {
        // 위치 정보 저장
        clients.set(ws, {
          userId: data.userId,
          lat: data.lat,
          lng: data.lng,
        });

        // ✅ 모든 사용자 정보 수집
        const allUsers = Array.from(clients.values()).map(({ userId, lat, lng }) => ({
          userId,
          lat,
          lng,
        }));

        for (const [targetWs, targetInfo] of clients.entries()) {
          if (targetWs.readyState !== WebSocket.OPEN) continue;

          const nearbyUsers = getNearbyUsers(targetInfo.lat, targetInfo.lng, [targetInfo.userId]);

          targetWs.send(
            JSON.stringify({
              type: "nearby_users",
              nearbyUsers,
              allUsers,
              server: serverHost,
            })
          );
        }
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

// 서버 시작
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on http://localhost:${PORT}`);
});
