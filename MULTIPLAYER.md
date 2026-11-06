# ARDENNE multiplayer — v13

Run **START-MULTIPLAYER.cmd** on a Windows computer with Node.js 20 or newer. Keep its server window open. The game opens at http://localhost:8765. If the browser opens before the server is ready, refresh it.

Friends on the same network open the network address printed by the server, for example `http://192.168.1.25:8765`. They do not use `localhost` on their computers. If Windows asks, allow this server on the network you intend to play on.

1. Choose **Multiplayer → Host a room**. Enter a driver name and choose Time Attack or Race. Race also has AI difficulty 1–100 and laps 2–15.
2. Share the generated six-character room code. Friends choose **Join a room**, enter the code, and appear in the lobby. Maximum 20 drivers.
3. The host clicks **Start session**. Everyone enters the same session.

Time Attack displays everyone's best valid lap, fastest first, with unset times at the bottom. Invalid laps never update the leaderboard. Cars share the circuit; this mode has no car contact. Original solo Time Attack source and physics are unchanged.

Race assigns unique random grid positions and fills all remaining places with AI: 3 humans + 17 AI, or 20 humans + no AI. Everyone shares the start-light schedule. The host simulates the AI and sends its state to the other drivers. Drivers can rev before lights out, but cannot move. Finishing your race locks your car and shows results while the host continues running the field. Restarting a shared race is disabled; return to the menu and create a new room. The host must keep their game open. Pausing stops only your own car; the shared race continues.

Rooms are held in server memory. Leaving as host closes the room and returns everyone to the multiplayer screen. Disconnected connections can reconnect briefly; unconnected sessions expire after 45 seconds. Players cannot join after a session starts.

## Friends on different networks

The room server must be reachable by every driver. Deploy this folder on a Node-capable server and run `node multiplayer-server.cjs`; it uses the `PORT` environment variable, default 8765. Share that server's URL. Keep `/api/events` streaming enabled in any reverse proxy (disable response buffering). Use HTTPS for an internet deployment. The room code identifies a room **on that server**, rather than discovering servers across the internet.

This update includes the working server but does not publish an internet endpoint. Opening the standalone `ARDENNE-v13.html` file supports solo play and explains how to launch multiplayer. For multiplayer, open the server's address instead.

This is a small, client-trusted game server with no accounts, persistent records, host migration, or competitive anti-cheat. Human movement and lap claims originate on each driver's computer; AI is host-authoritative. Network latency and host performance affect synchronization.

## Checks

Run from this folder:

```
node verify-multiplayer.cjs
node verify-race.cjs
node verify-menu.cjs
node verify-laps.cjs
node verify-pits.cjs
```

The multiplayer check exercises real HTTP rooms and a live event stream, the 20-driver limit, host-only start, random unique grids, 3/20-player AI allocation, valid best-lap selection, state relay, and host teardown. Two browser sessions were also checked joining a code and starting both Race and Time Attack.
