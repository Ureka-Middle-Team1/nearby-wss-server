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

        const allUsers = Array.from(clients.values()).map((c) => ({
          userId: c.userId,
          lat: c.lat,
          lng: c.lng,
        }));

        for (const [targetWs, targetInfo] of clients.entries()) {
          if (targetWs.readyState !== WebSocket.OPEN) continue;

          const nearbyUsers = Array.from(clients.values())
            .filter((c) => {
              if (
                !c.userId ||
                c.userId === targetInfo.userId ||
                c.lat == null ||
                c.lng == null ||
                targetInfo.lat == null ||
                targetInfo.lng == null
              )
                return false;

              const dist = getDistanceKm(targetInfo.lat, targetInfo.lng, c.lat, c.lng);
              return dist <= RADIUS_KM;
            })
            .map((c) => ({
              userId: c.userId,
              lat: c.lat,
              lng: c.lng,
              distance: Math.round(
                getDistanceKm(targetInfo.lat, targetInfo.lng, c.lat, c.lng) * 1000
              ),
            }));

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

      // 쿨릭 이벤트 처리
      if (data.type === "user_click" && data.from && data.to) {
        console.log(`사용자 ${data.from} -> ${data.to} 클릭`);

        const fromEntry = [...clients.entries()].find(([, info]) => info.userId === data.from);
        if (!fromEntry) return;

        const [fromWs, fromInfo] = fromEntry;
        if (fromWs.readyState !== WebSocket.OPEN) return;

        // 클릭 상태 기록
        clickedPairs.add(`${data.from}->${data.to}`);

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
      if (data.type === "user_click" && data.from && data.to) {
        console.log(`📍 ${data.from} clicked ${data.to}`);
        const fromWs = [...clients.entries()].find(([, info]) => info.userId === data.from)?.[0];
        if (fromWs && fromWs.readyState === WebSocket.OPEN) {
          // 알림 또는 추가 동작은 여기에
          fromWs.send(JSON.stringify({ type: "clicked_ack", to: data.to }));
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

// 서버 시작
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on http://localhost:${PORT}`);
});
