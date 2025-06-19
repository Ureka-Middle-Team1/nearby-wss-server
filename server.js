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

const clients = new Map(); // Map<ws, { userId, lat, lng }>

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const RADIUS_KM = 0.1;

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

        const allUsers = [];
        for (const [, info] of clients.entries()) {
          if (info.userId && info.lat != null && info.lng != null) {
            allUsers.push({
              userId: info.userId,
              lat: info.lat,
              lng: info.lng,
            });
          }
        }

        for (const [targetWs, targetInfo] of clients.entries()) {
          if (targetWs.readyState !== WebSocket.OPEN) continue;

          const nearbyUsers = [];
          for (const [, otherInfo] of clients.entries()) {
            if (
              targetInfo.lat != null &&
              targetInfo.lng != null &&
              otherInfo.lat != null &&
              otherInfo.lng != null &&
              targetInfo !== otherInfo
            ) {
              const dist = getDistanceKm(
                targetInfo.lat,
                targetInfo.lng,
                otherInfo.lat,
                otherInfo.lng
              );

              if (dist <= RADIUS_KM) {
                nearbyUsers.push({
                  userId: otherInfo.userId,
                  lat: otherInfo.lat,
                  lng: otherInfo.lng,
                  distance: Math.round(dist * 1000),
                });
              }
            }
          }

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

      // ✅ 수정된 클릭 이벤트 타입 처리
      else if (data.type === "user_click" && data.fromUserId && data.toUserId) {
        console.log(`👆 ${data.fromUserId}님이 ${data.toUserId}님을 클릭했습니다`);

        for (const [targetWs, info] of clients.entries()) {
          if (info.userId === data.toUserId && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(
              JSON.stringify({
                type: "click_notice",
                from: data.fromUserId,
              })
            );
          }
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

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on http://localhost:${PORT}`);
});
