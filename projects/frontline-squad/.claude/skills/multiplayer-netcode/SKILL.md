---
name: multiplayer-netcode
description: >
  Build server-authoritative realtime multiplayer for a browser shooter: room and match
  lifecycle, input-based client prediction with server reconciliation, entity interpolation,
  lag-compensated hitscan, snapshot bandwidth budgets, matchmaking and anti-cheat. Use when
  adding or debugging networked play, rubber-banding, hit registration disputes, desync,
  "shots not landing", tick rate or bandwidth questions in this project.
---

# Multiplayer Netcode (browser shooter)

The reference docs in `references/` are vendored from an MIT-licensed collection (see
`LICENSE-claude-code-game-development.txt`). They are engine-neutral JavaScript. This file
records how they apply to **this** project.

## Project decisions

- **Framework:** Colyseus (Node.js, MIT). Version 0.18 ships client prediction with rollback,
  entity interpolation and lag compensation, so do not hand-roll those layers.
- **Authority:** the server owns position, health, ammo, capture progress and score. The client
  owns only camera look and input intent. Never trust a client-reported hit.
- **Tick:** simulate at a fixed step on the server; the client renders interpolated remote
  entities one snapshot behind and predicts only the local player.
- **Hitscan:** resolve on the server against rewound hitboxes at the shooter's view timestamp.
  The existing `Arena.hitscan()` already separates ray math from damage — keep that split so the
  same code can run server-side.
- **Bots** stay in the build and fill empty slots; they must run on the server, never the client.

## Reference map

| File | Read it when |
| --- | --- |
| `references/client-server-architecture.md` | choosing authority model, tick rate, room layout |
| `references/lag-compensation.md` | prediction, reconciliation, interpolation, rewind |
| `references/state-synchronization.md` | snapshots, deltas, interest management, bandwidth |
| `references/websocket-implementation.md` | transport, message framing, reconnect, heartbeats |
| `references/matchmaking-systems.md` | queues, skill buckets, party handling, fill with bots |
| `references/anti-cheat-strategies.md` | input validation, speed/aim checks, rate limits |
| `references/README.md` | index of the above |

## Order of work

1. Move the simulation (movement, collision, hitscan, match rules) behind a shared module that
   runs identically on client and server — prediction is impossible without it.
2. Server room: join, team assignment, spawn, tick loop, state broadcast.
3. Client: send input frames with sequence numbers, predict locally, reconcile on snapshot.
4. Interpolate remote fighters; never render them from raw snapshots.
5. Lag-compensated shooting, then measure: hit rate at 50/150/250 ms simulated latency.
6. Anti-cheat passes last, but design for it from step 1 (server owns everything).

## Verification

Test with artificial latency and packet loss, not on localhost alone. A build is only
"networked" once two clients at 150 ms see the same kill at the same moment.
