# rtc-server — WebRTC Signaling Server

Standalone Node.js signaling server for the LMS video conferencing feature.
Uses **socket.io** for signaling and validates the same JWT tokens as the main console.

## Architecture

```
Browser A ──┐                      ┌── Browser B
            │  offer/answer/ICE    │
            └──── rtc-server ──────┘
                  (this project)

rtc-server does NOT relay media — it only exchanges SDP and ICE candidates.
Actual video/audio streams flow peer-to-peer (or via TURN for restricted NAT).
```

## Setup

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET to match console's JWT_SECRET
npm install
npm run dev      # development
npm start        # production
```

## Environment variables

| Variable         | Required | Default                             | Description                          |
|------------------|----------|-------------------------------------|--------------------------------------|
| `PORT`           | No       | `5050`                              | Server port                          |
| `JWT_SECRET`     | **Yes**  | hardcoded fallback                  | Must match `console` JWT_SECRET      |
| `ALLOWED_ORIGINS`| No       | `http://localhost:4000`             | Comma-separated CORS origins         |
| `STUN_URLS`      | No       | Google STUN                         | Comma-separated STUN URLs            |
| `TURN_URL`       | No       | —                                   | TURN server URL (for production)     |
| `TURN_USERNAME`  | No       | —                                   | TURN username                        |
| `TURN_CREDENTIAL`| No       | —                                   | TURN credential                      |

## Room naming convention

Rooms are identified by a string ID. The frontend uses:
- `session:<sessionId>` — tied to a ManageSession entry
- Any string for ad-hoc rooms

## Socket events

### Client → Server

| Event           | Payload                          | Description                     |
|-----------------|----------------------------------|---------------------------------|
| `join`          | `{ roomId, nickname }`           | Join a room                     |
| `leave`         | `{ roomId }`                     | Explicit leave                  |
| `offer`         | `{ to, sdp }`                    | Forward SDP offer to peer       |
| `answer`        | `{ to, sdp }`                    | Forward SDP answer to peer      |
| `ice-candidate` | `{ to, candidate }`              | Forward ICE candidate to peer   |
| `toggle-media`  | `{ roomId, video, audio }`       | Broadcast media state change    |

### Server → Client

| Event           | Payload                                    | Description                     |
|-----------------|--------------------------------------------|---------------------------------|
| `joined`        | `{ roomId, peers, iceServers }`            | Join confirmation               |
| `peer-joined`   | `{ peer }`                                 | New peer in room                |
| `peer-left`     | `{ socketId }`                             | Peer disconnected               |
| `offer`         | `{ from, sdp }`                            | Incoming SDP offer              |
| `answer`        | `{ from, sdp }`                            | Incoming SDP answer             |
| `ice-candidate` | `{ from, candidate }`                      | Incoming ICE candidate          |
| `media-state`   | `{ socketId, video, audio }`               | Peer toggled camera/mic         |
| `error`         | `{ message }`                              | Error feedback                  |

## Production TURN

For users behind strict corporate firewalls or symmetric NAT, peer-to-peer
WebRTC will fail. You need a TURN relay server. Options:

- **Self-hosted**: [coturn](https://github.com/coturn/coturn) — free, runs on any VPS
- **Managed**: Twilio TURN, Xirsys, Metered TURN — pay-as-you-go

Set `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` in `.env`.

## Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 5050
CMD ["node", "index.js"]
```