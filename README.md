# ASTRO-MINER: COMBAT HARVEST — 2D SPACE SHOOTER & HARVESTER
**Course / Subject:** Multimedia Systems Lab — Lab Test 2  
**Topic:** Customizable 2D Arcade Game Development (Space Shooter + Collector)  
**Author / Student:** Lab Test 2 Candidate  
**Technologies:** HTML5 Canvas, Vanilla JavaScript (ES6+), Web Audio API (with Python/Pygame dual-stack)

---

## 1. Project Overview & Objective

**Astro-Miner: Combat Harvest** is a high-octane 2D space shooter and mineral harvesting arcade game designed to satisfy all academic requirements of **Multimedia Systems Lab Test 2**:
- Real-time continuous canvas animation (60 FPS delta-time physics)
- Dual user input & event handling (Keyboard WASD/Arrows + Mouse/Touch dragging, <kbd>Space</kbd> / Left-Click weapon fire)
- Procedural audio synthesis (Web Audio API without external audio files)
- Multi-layer collision detection algorithms:
  - **Player $\to$ Collectibles** (Circle-Distance)
  - **Player $\to$ Hazards** (Circle-Distance)
  - **Mining Lasers $\to$ Hazards** (Circle-to-Point Proximity)
- Multi-state game management (`START`, `PLAYING`, `PAUSED`, `GAMEOVER`)
- Dynamic difficulty scaling, combo multiplier mechanics, and dropped-loot systems
- Screen shake camera system and procedural particle engines

The game requires **zero installation** and runs natively on any modern web browser simply by opening `index.html`. A standalone Python/Pygame implementation (`game_pygame.py`) is also included.

---

## 2. Individual Customization Requirements & Implementation

| Customization Area | Assigned Implementation | Technical Detail / Mechanics |
| :--- | :--- | :--- |
| **Visual Theme & Character** | Armed Deep-Space Mining Drone | Sleek procedural vector ship with dynamic directional roll tilt (`tilt = vx / speed * 0.25`), animated plasma thrusters, and wingtip laser hardpoints. |
| **Combat & Shooting** | ⚡ **Twin Plasma Lasers** & ⚡ **Triple Spread Shot** | Hold <kbd>Space</kbd> or Left-Click to fire twin plasma lasers with 0.16s cooldown. Collecting the Triple Spread power-up unleashes angled tri-lasers ($-15^\circ, 0^\circ, +15^\circ$). |
| **Hazards & Destruction** | 1. **Tumbling Asteroid** (🪨, 2 HP)<br>2. **Tracking Orbital Mine** (💣, 1 HP) | • *Asteroids*: Multi-hit jagged polygonal geometry with hit-flash feedback.<br>• *Orbital Mines*: Active homing guidance with lateral tracking and pulsing danger cores. |
| **Shatter Loot Drops** | **Destruction Loot Scattering** | Destroying asteroids or mines shatters them into 1–2 high-value **Cosmic Crystals** or rare **Nova Cores** that scatter outward for the player to collect. |
| **Special Power-Up 1** | **Magnetic Tractor Beam** (🧲) | Attracts all crystals and Nova Cores within a 320px radius towards the player ship for 7 seconds. |
| **Special Power-Up 2** | **Plasma Shield** (🛡️) | Generates a 360° forcefield barrier that deflects 1 hazard collision without losing a player life. |
| **Custom Scoring & Penalty** | Dynamic Combo Multiplier (x1 to x5) | Collecting minerals consecutively without taking hull damage increments the multiplier up to 5x. Taking damage resets combo to 1x and grants 1.8s invulnerability frames. |
| **Camera Juice** | **Screen Shake System** | Heavy explosions and hull damage trigger dynamic camera jitter ($\pm 5\text{px}$) with rapid exponential decay. |

---

## 3. Game Rules & Controls

### Rules
1. **Objective:** Shoot oncoming asteroids and mines, harvest their dropped cosmic crystals, and survive as long as possible before exhausting your 3 hull lives.
2. **Combat & Loot:** Blasting an asteroid shatters it, yielding $+20$ destruction points and dropping collectable crystals. Collecting dropped crystals advances your combo chain!
3. **Combo Multiplier:** Collect items in quick succession without colliding with hazards to reach up to **x5 Multiplier**.
4. **Damage & Invulnerability:** Colliding with an Asteroid or Orbital Mine deducts 1 life and resets your combo. You gain 1.8 seconds of invulnerability (indicated by ship flashing).
5. **Restart:** Press <kbd>R</kbd> or click the button to restart instantly without refreshing the browser.

### Controls Guide
- **Ship Movement:**
  - <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or Arrow Keys <kbd>▲</kbd> <kbd>◄</kbd> <kbd>▼</kbd> <kbd>►</kbd>
  - Or click and drag with the **Mouse / Touch** on screen.
- **Fire Mining Lasers:** Hold <kbd>SPACE</kbd> or Left Mouse Click.
- **Pause / Resume:** <kbd>P</kbd> or <kbd>ESC</kbd>
- **Audio Mute/Unmute:** <kbd>M</kbd>
- **Collision Hitbox Debugger:** <kbd>F1</kbd> (Toggles live red/cyan hitboxes for evaluation demonstration)
- **Restart Game:** <kbd>R</kbd>

---

## 4. Collision Detection Logic & Algorithm Explanation

This project implements three distinct collision detection calculations:

### A. Circle-to-Circle Collision Detection (Player vs. Items / Hazards)
Given entity $A$ and entity $B$ with center coordinates $(x_A, y_A)$, $(x_B, y_B)$ and collision radii $r_A, r_B$:
1. Euclidean distance formula:
   $$d = \sqrt{(x_A - x_B)^2 + (y_A - y_B)^2}$$
2. Collision occurs if:
   $$d \le (r_A + r_B)$$
3. **Squared Distance Optimization** (avoids expensive square-root computation at 60 FPS):
   $$(x_A - x_B)^2 + (y_A - y_B)^2 \le (r_A + r_B)^2$$

### B. Projectile-to-Circle Collision (Lasers vs. Hazards)
Lasers are tested against hazard circular bounds:
$$(x_{\text{laser}} - x_{\text{hazard}})^2 + (y_{\text{laser}} - y_{\text{hazard}})^2 \le (r_{\text{laser}} + r_{\text{hazard}})^2$$
On impact:
- The laser is consumed and removed from the active projectile pool.
- The hazard flashes white and loses 1 HP.
- If $\text{HP} \le 0$, `onHazardDestroyed()` triggers shatter debris, plays audio crunch, generates screen shake, and spawns dropped mineral loot.

### C. Axis-Aligned Bounding Box (AABB)
Used for canvas boundary clamping and alternative box collisions:
$$\text{Overlap} \iff (x_1 < x_2 + w_2) \land (x_1 + w_1 > x_2) \land (y_1 < y_2 + h_2) \land (y_1 + h_1 > y_2)$$

---

## 5. Multimedia System Integration

1. **Procedural Web Audio API:**
   - **Mining Laser:** Fast downward pitch ramp ($880\text{ Hz} \to 180\text{ Hz}$) using a sawtooth oscillator.
   - **Laser Hit Impact:** Brief triangle wave frequency drop ($420\text{ Hz} \to 120\text{ Hz}$).
   - **Shatter Crunch:** Low-frequency square wave crunch ($220\text{ Hz} \to 60\text{ Hz}$).
   - **Crystal Pickup:** Ascending chime ($587\text{ Hz} \to 880\text{ Hz}$).
   - **Nova Core:** 4-stage ascending arpeggio ($E_5 \to G^\#_5 \to B_5 \to E_6$).
   - **Hull Collision:** Filtered noise burst + sub-bass punch ($140\text{ Hz} \to 30\text{ Hz}$).
   - **Chiptune BGM:** 16-step procedural D-minor bassline arpeggio running on an internal clock.
2. **Visual Animation & Juice:**
   - Screen Shake: Dynamic $\pm 5\text{px}$ camera offset with delta-time decay.
   - Vector procedural rendering: Ship, twin lasers, spread shots, shield bubble, crystals, and jagged asteroids.
   - Particle explosion engine: Radial debris velocity with alpha decay on pickups and shatter events.

---

## 6. How to Run

### Method 1: Instant Browser Launch (Zero Setup)
1. Navigate to `arcade-game/`.
2. Double-click `index.html` (opens in Google Chrome, Edge, Firefox, or Safari).
3. Click **LAUNCH MISSION** or press <kbd>SPACE</kbd>.

### Method 2: Python HTTP Server Launcher
```bash
python run_game.py
```

### Method 3: Desktop Python / Pygame Version
```bash
pip install pygame
python game_pygame.py
```


