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

const clients = new Map();
const clickedPairs = new Set(); //Set<string> 형태로 from -> to 클릭 상태 저장

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

// 주변 사용자 계산
function getNearbyUsers(lat, lng, includeUserIds = []) {
  return Array.from(clients.values())
    .filter((c) => {
      if (!c.userId || c.lat == null || c.lng == null) return false;
      const dist = getDistanceKm(lat, lng, c.lat, c.lng);
      return dist <= RADIUS_KM || includeUserIds.includes(c.userId);
    })
    .map((c) => ({
      userId: c.userId,
      lat: c.lat,
      lng: c.lng,
      distance: Math.round(getDistanceKm(lat, lng, c.lat, c.lng) * 1000),
    }));
}

const RADIUS_KM = 0.1; // 100미터 반경

wss.on("connection", (ws) => {
  console.log("🔗 New client connected");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "location_update" && data.userId && data.lat && data.lng) {
        clients.set(ws, {
          userId: data.userId,
          lat: data.lat,
          lng: data.lng,
        });

        for (const [targetWs, targetInfo] of clients.entries()) {
          if (targetWs.readyState !== WebSocket.OPEN) continue;

          const nearbyUsers = getNearbyUsers(
            targetInfo.lat,
            targetInfo.lng,
            Array.from(clickedPairs)
              .filter((pair) => pair.startsWith(`${targetInfo.userId}->`))
              .map((pair) => pair.split("->")[1])
          );

          targetWs.send(
            JSON.stringify({
              type: "nearby_users",
              nearbyUsers,
              server: serverHost,
            })
          );
        }
      }

      // 클릭 이벤트 처리
      if (data.type === "user_click" && data.from && data.to) {
        console.log(`📍 ${data.from} clicked ${data.to}`);
        clickedPairs.add(`${data.from}->${data.to}`);

        // A (from)에게 다시 nearby_users 재전송
        const fromWsEntry = [...clients.entries()].find(([, info]) => info.userId === data.from);
        const [fromWs, fromInfo] = fromWsEntry || [];

        if (fromWs && fromInfo && fromWs.readyState === WebSocket.OPEN) {
          const updatedNearby = getNearbyUsers(fromInfo.lat, fromInfo.lng, [data.to]);

          fromWs.send(
            JSON.stringify({
              type: "nearby_users",
              nearbyUsers: updatedNearby,
              server: serverHost,
            })
          );

          fromWs.send(
            JSON.stringify({
              type: "clicked_ack",
              to: data.to,
            })
          );
        }

        // C (to) 에게 알림 전송
        const toWsEntry = [...clients.entries()].find(([, info]) => info.userId === data.to);
        const [toWs] = toWsEntry || [];

        if (toWs && toWs.readyState === WebSocket.OPEN) {
          toWs.send(
            JSON.stringify({
              type: "you_were_clicked",
              from: data.from,
            })
          );
        }
      }
    } catch (err) {
      console.error("❌ Error handling message:", err.message);
    }
  });

  ws.on("close", () => {
    console.log("❌ Client disconnected");
    clients.delete(ws);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on http://localhost:${PORT}`);
});
