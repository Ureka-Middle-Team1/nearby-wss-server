# 🌐 Moo-Mool Nearby WebSocket Server

> 🧭 실시간 위치 기반 친구 탐색을 위한  
> ✨ *WebSocket 기반 Node.js 서버 애플리케이션*

&nbsp;

## 📦 프로젝트 개요

- **레포지토리명**: `nearby-wss-server`  
- **역할**: 실시간 위치 공유, 반경 100m 내 사용자 탐색 및 실시간 클릭 상호작용 지원  
- **개발 기간**: 2025.06.04 ~ 2025.06.26  
- **사용 기술**: Node.js, WebSocket, Express, CORS, OS 모듈  

&nbsp;

## 🧭 주요 기능 요약

### 🛰 실시간 위치 공유 및 주변 사용자 탐색
- 사용자의 위치 데이터를 주기적으로 수신
- 반경 100m 이내에 있는 사용자 목록 필터링
- `nearby_users` 메시지로 사용자들에게 실시간 전송

### 👥 사용자 페이지 접속 감지 및 알림
- `home_ready` 메시지를 통해 Home 접속자 등록
- `user_join` 메시지를 통해 Nearby 접속자 등록 → Home 사용자에게 알림 전송

### 📍 WebSocket 기반 실시간 상호작용
- 특정 사용자를 클릭 시 `user_click` 메시지 전송
- 대상 사용자에게 실시간 하트 알림(`click_notice`) 전송
- 클릭한 사용자 정보(닉네임 등) 포함하여 피드백 제공

### 🧹 연결 종료 처리
- 사용자가 연결 종료 시 관련 Map 및 Set에서 정리

&nbsp;

## 🛠 기술 스택

| 분야         | 기술 스택 |
|--------------|-----------|
| **Server**   | <img src="https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white" /> <img src="https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white" /> |
| **실시간 통신** | <img src="https://img.shields.io/badge/WebSocket-000000?style=flat&logo=websocket&logoColor=white" /> (`ws` 모듈 사용) |
| **기타 모듈**   | <img src="https://img.shields.io/badge/CORS-00599C?style=flat&logo=cors&logoColor=white" /> `os` |
| **위치 계산**   | 하버사인 공식 (Haversine Formula) |
| **배포 환경**   | <img src="https://img.shields.io/badge/AWS EC2-FF9900?style=flat&logo=amazon-ec2&logoColor=white" /> <img src="https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white" /> |


&nbsp;

## 🔗 메시지 타입 정리

| 타입명               | 설명 |
|---------------------|------|
| `home_ready`        | Home 페이지 접속 시 등록 및 nearby 사용자 존재 여부에 따라 알림 |
| `user_join`         | Nearby 페이지 접속 시 등록 및 Home 사용자에게 알림 전송 |
| `location_update`   | 사용자 위치 업데이트 (userId, lat, lng 포함) |
| `nearby_users`      | 실시간 반경 100m 이내 사용자 목록 전송 |
| `user_click`        | 특정 사용자 클릭 이벤트 전송 |
| `click_notice`      | 클릭 대상 사용자에게 피드백 메시지 전송 |

&nbsp;

## 📂 실행 방법

```bash
# 1. 레포 클론 및 이동
git clone https://github.com/your-org/nearby-wss-server.git
cd nearby-wss-server

# 2. 의존성 설치
npm install

# 3. 서버 실행
node index.js
# 또는 PORT 지정
PORT=8080 node index.js
