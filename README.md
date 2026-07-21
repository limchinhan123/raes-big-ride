# Rae's Big Ride 🚲🛴

A voice-controlled 3D riding adventure through Singapore, built for Rae (4).
She rides her real bicycle (white B'Twin with the yellow basket and training
wheels) or her real scooter (the green-deck KUB) from the HDB heartland,
along a park connector, past the sea at East Coast, through the city, and
arrives at a playground — steering the whole way **by reading clue words out
loud**.

## How to play (parents)

1. `npm install` once, then `npm run dev` in this folder.
2. Open this **exact link in Google Chrome** — nothing after the port:

   ### 👉 http://localhost:5178

   (Voice recognition needs Chrome, and internet must be on while playing.)
   **Do not add `?sim=` or `?interval=` to the address** — those are testing
   switches: `sim` feeds the game a fake voice and `interval` drives drawing
   off the display clock. The plain link above is always the one to use.
3. When asked, **allow the microphone**.
4. Tap *Let's play* — Rae picks her ride, her colour, and her pace
   (🐢 gentle · 🐇 quick · 🚀 super zoomy), does a quick "Say GO!" voice
   check, and the journey begins.

The ride takes roughly 4–7 minutes depending on pace. The day moves from
morning to a warm late afternoon as she gets closer to the playground.

### What she'll be asked to do

- **Two cards, two ways** — say the word on the card to choose a path
  (things & animals first, then letters, then numbers — one type per
  chapter, never mixed in the same moment).
- **Somebody's napping on the path!** — say the word on the card to steer
  around cats, puddles, beach balls, and aunties with trolleys.
- **Traffic lights** — red means *"say STOP"*, green means *"say GO"*.
  (She is never allowed to run the red light, even in silence.)
- **The big downhill** — say *WHEEE!* (any happy shout counts).
- If she says nothing, she just slows down gently and the narrator offers
  the word. After three tries the game says it for her and rolls on —
  **the ride can never be failed and never gets stuck.**
- Anytime: saying **"ring ring"** rings the bell (and startles pigeons).

### Helper controls (for grown-ups)

| Key | What it does |
| --- | --- |
| **Esc** | **pause / resume the ride** |
| ⬅ ➡ | steer her by hand |
| Enter | answers the current card for her |
| P | parent corner: music volume, mic boost, narrator on/off |

### Talking to the game

Rae can say **"left"** or **"right"** at *any* moment — including while a
clue card is on screen — and she'll swerve that way immediately. Saying
**"ring ring"** rings her bell anywhere. Clue cards add their own words on
top of these.

### Tips for a good session

- Speakers **low** (the music auto-ducks when the game is listening, but
  soft is better), external mic close to her if you have one.
- Sit with her the first time — the fun is her narrating the world.
- Everything runs locally. The only network use is Chrome's speech service
  hearing single words.

## Developer notes

- Stack: Vite + three.js, no other runtime deps. All textures, models,
  music, and sound effects are generated procedurally in code.
- Useful URLs:
  - `?mode=frame&t=0..1` — lighting style frame (morning→noon→golden).
  - `?mode=ride` — riding testbed, `?inspect=1` close-up camera.
  - `?mode=world&jump=<m>` — teleport along the journey.
  - `?sim=1` — fake child voice; `?auto=1&ts=6` — fast unattended QA run
    that prints a `[QA] SUMMARY` line; add `?interval=1` in embedded
    panes that throttle rAF.
  - `?skipmenu=1&v=scooter&c=pink&pace=zoomy` — jump straight into a ride.
- QA: every interaction logs a `[QA]` JSON line; the full-journey auto run
  ends with outcomes for all ~16 events plus average fps.
