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

const RADIUS_KM = 0.1; // 100미터 반경

wss.on("connection", (ws) => {
  console.log("🔗 New client connected");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "location_update" && data.userId && data.lat && data.lng) {
        // 위치 정보 저장
        clients.set(ws, {
          userId: data.userId,
          lat: data.lat,
          lng: data.lng,
        });

        // ✅ 모든 사용자 정보 수집
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

        // ✅ 각 사용자에게 nearby + allUsers 목록 전송
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
                  distance: Math.round(dist * 1000), // m 단위
                });
              }
            }
          }

          // 전송
          targetWs.send(
            JSON.stringify({
              type: "nearby_users",
              nearbyUsers,
              allUsers,
              server: serverHost,
            })
          );
        }
      } else if (data.type == "user_click" && data.fromUserId && data.toUserId) {
        console.log(`👆 ${data.fromUserId}님이 ${data.toUserId}님을 클릭했습니다`);

        // to에게 알림 보내기
        for (const [targetWs, info] of clients.entries()) {
          if (info.userId === data.toUserId && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(
              JSON.stringify({
                type: "user_clicked",
                fromUserId: data.fromUserId,
              })
            );
            break;
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

// 서버 시작
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on http://localhost:${PORT}`);
});
