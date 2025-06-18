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
