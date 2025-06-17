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

// 반경 기준 (예: 0.01km = 10m)
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
        // 클라이언트 위치 저장
        clients.set(ws, {
          userId: data.userId,
          lat: data.lat,
          lng: data.lng,
        });

        // 현재 유저 기준으로 반경 내 유저 찾기
        const nearbyUsers = [];
        for (const [otherWs, otherInfo] of clients.entries()) {
          if (
            otherWs !== ws &&
            otherInfo.lat != null &&
            otherInfo.lng != null
          ) {
            const dist = getDistanceKm(
              data.lat,
              data.lng,
              otherInfo.lat,
              otherInfo.lng
            );
            if (dist <= RADIUS_KM) {
              nearbyUsers.push({
                userId: otherInfo.userId,
                lat: otherInfo.lat,
                lng: otherInfo.lng,
                distance: Math.round(dist * 1000), // m 단위
              });
            }
          }
        }

        // 결과 전송 (본인에게만)
        ws.send(
          JSON.stringify({
            type: "nearby_users",
            users: nearbyUsers,
          })
        );
      }
    } catch (err) {
      console.error("❌ 메시지 처리 중 오류:", err.message);
    }
  });

  ws.on("close", () => {
    console.log("❌ Client disconnected");
    clients.delete(ws);

    // 다른 모든 사용자에게 "자신 기준 반경 내 사용자" 목록을 다시 보내주기
    for (const [otherWs, otherInfo] of clients.entries()) {
      if (otherWs.readyState === WebSocket.OPEN) {
        const nearbyUsers = [];

        for (const [ws2, info2] of clients.entries()) {
          if (ws2 !== otherWs && info2.lat != null && info2.lng != null) {
            const dist = getDistanceKm(
              otherInfo.lat,
              otherInfo.lng,
              info2.lat,
              info2.lng
            );
            if (dist <= RADIUS_KM) {
              nearbyUsers.push({
                userId: info2.userId,
                lat: info2.lat,
                lng: info2.lng,
                distance: Math.round(dist * 1000),
              });
            }
          }
        }

        otherWs.send(
          JSON.stringify({
            type: "nearby_users",
            users: nearbyUsers,
          })
        );
      }
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on http://localhost:${PORT}`);
});
