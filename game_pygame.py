"""
================================================================================
ASTRO-MINER: COMBAT HARVEST — 2D SPACE SHOOTER (PYTHON / PYGAME IMPLEMENTATION)
Multimedia Systems Lab — Lab Test 2
================================================================================
Requirements:
    pip install pygame

Features:
    - 2D Space Shooter with Mining Lasers (SPACE to fire)
    - Triple Spread Shot Power-Up (⚡)
    - Destructible Hazards: Asteroids (2 HP) & Tracking Mines (1 HP)
    - Shatter Loot Drops: Destroyed hazards release Crystals & Nova Cores
    - Camera Screen Shake on Explosions
    - Complete State Machine: START, PLAYING, PAUSED, GAMEOVER
    - 60 FPS Delta-time Physics & Inertia Movement
    - Dual Collision Detection: Circle-Distance and AABB
    - Dynamic Combo Scoring (x1 to x5) & Difficulty Scaling
    - Hitbox Debugger Overlay (F1 key)
================================================================================
"""

import sys
import math
import random
import pygame

# --- CONFIGURATION & CONSTANTS ---
SCREEN_WIDTH = 900
SCREEN_HEIGHT = 600
FPS = 60

# Palette
COLOR_BG = (7, 9, 19)
COLOR_CYAN = (0, 240, 255)
COLOR_GOLD = (255, 190, 11)
COLOR_GREEN = (57, 255, 20)
COLOR_RED = (255, 51, 68)
COLOR_WHITE = (240, 246, 252)
COLOR_MUTED = (139, 155, 180)
COLOR_CARD = (15, 23, 42)

# States
STATE_START = "START"
STATE_PLAYING = "PLAYING"
STATE_PAUSED = "PAUSED"
STATE_GAMEOVER = "GAMEOVER"

class Laser:
    def __init__(self, x, y, vx=0, vy=-720, color=COLOR_CYAN):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.radius = 3
        self.width = 4
        self.height = 14
        self.color = color
        self.damage = 1

    def update(self, dt):
        self.x += self.vx * dt
        self.y += self.vy * dt

    def is_offscreen(self):
        return self.y < -30 or self.x < -30 or self.x > SCREEN_WIDTH + 30

    def draw(self, surface, show_hitbox):
        rect = pygame.Rect(int(self.x - self.width / 2), int(self.y - self.height / 2), self.width, self.height)
        pygame.draw.rect(surface, self.color, rect)
        if show_hitbox:
            pygame.draw.circle(surface, COLOR_RED, (int(self.x), int(self.y)), self.radius, 1)

class Particle:
    def __init__(self, x, y, vx, vy, color, life=0.5, size=3):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.color = color
        self.life = life
        self.max_life = life
        self.size = size

    def update(self, dt):
        self.x += self.vx * dt
        self.y += self.vy * dt
        self.life -= dt

    def is_dead(self):
        return self.life <= 0

    def draw(self, surface):
        alpha_ratio = max(0.0, self.life / self.max_life)
        radius = max(1, int(self.size * alpha_ratio))
        pygame.draw.circle(surface, self.color, (int(self.x), int(self.y)), radius)

class FloatingText:
    def __init__(self, text, x, y, color, font):
        self.text = text
        self.x = x
        self.y = y
        self.color = color
        self.font = font
        self.life = 0.9
        self.max_life = 0.9
        self.vy = -40

    def update(self, dt):
        self.y += self.vy * dt
        self.life -= dt

    def is_dead(self):
        return self.life <= 0

    def draw(self, surface):
        txt_surf = self.font.render(self.text, True, self.color)
        surface.blit(txt_surf, (int(self.x - txt_surf.get_width() / 2), int(self.y)))

class PlayerShip:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.radius = 22
        self.speed = 360
        self.vx = 0
        self.vy = 0
        self.tilt = 0.0

        # Laser weapons
        self.fire_rate = 0.16
        self.fire_timer = 0.0

        self.is_invulnerable = False
        self.invuln_timer = 0.0
        self.blink_timer = 0.0

    def trigger_invulnerability(self, duration):
        self.is_invulnerable = True
        self.invuln_timer = duration

    def update(self, dt, keys, is_shooting, game):
        move_x = 0
        move_y = 0

        if keys[pygame.K_LEFT] or keys[pygame.K_a]:
            move_x -= 1
        if keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            move_x += 1
        if keys[pygame.K_UP] or keys[pygame.K_w]:
            move_y -= 1
        if keys[pygame.K_DOWN] or keys[pygame.K_s]:
            move_y += 1

        if move_x != 0 and move_y != 0:
            norm = 1.0 / math.sqrt(2)
            move_x *= norm
            move_y *= norm

        self.vx = move_x * self.speed
        self.vy = move_y * self.speed

        self.x += self.vx * dt
        self.y += self.vy * dt

        self.x = max(self.radius + 6, min(SCREEN_WIDTH - self.radius - 6, self.x))
        self.y = max(self.radius + 6, min(SCREEN_HEIGHT - self.radius - 6, self.y))

        self.tilt = (self.vx / self.speed) * 0.25

        # Weapon Firing
        self.fire_timer -= dt
        if is_shooting and self.fire_timer <= 0:
            self.fire_timer = self.fire_rate
            has_spread = game.active_powerup and game.active_powerup['type'] == 'SPREAD'

            if has_spread:
                spd = 740
                sin15 = math.sin(math.radians(15))
                cos15 = math.cos(math.radians(15))
                game.lasers.append(Laser(self.x, self.y - 18, 0, -spd, COLOR_GOLD))
                game.lasers.append(Laser(self.x - 12, self.y - 10, -spd * sin15, -spd * cos15, COLOR_GOLD))
                game.lasers.append(Laser(self.x + 12, self.y - 10, spd * sin15, -spd * cos15, COLOR_GOLD))
            else:
                game.lasers.append(Laser(self.x - 12, self.y - 14, 0, -740, COLOR_CYAN))
                game.lasers.append(Laser(self.x + 12, self.y - 14, 0, -740, COLOR_CYAN))

        if self.is_invulnerable:
            self.invuln_timer -= dt
            self.blink_timer += dt * 18
            if self.invuln_timer <= 0:
                self.is_invulnerable = False

    def draw(self, surface, show_hitbox, active_powerup):
        if self.is_invulnerable and (int(self.blink_timer) % 2 == 0):
            return

        cx, cy = int(self.x), int(self.y)

        # Thruster exhaust flame
        flame_len = random.randint(12, 22)
        flame_pts = [
            (cx - 7, cy + 16),
            (cx, cy + 16 + flame_len),
            (cx + 7, cy + 16)
        ]
        pygame.draw.polygon(surface, COLOR_CYAN, flame_pts)

        # Ship Body
        ship_pts = [
            (cx, cy - 24),
            (cx + 18, cy + 14),
            (cx + 8, cy + 17),
            (cx - 8, cy + 17),
            (cx - 18, cy + 14),
        ]
        pygame.draw.polygon(surface, COLOR_CARD, ship_pts)
        pygame.draw.polygon(surface, COLOR_CYAN, ship_pts, 2)

        # Wing cannons
        pygame.draw.rect(surface, COLOR_GOLD, (cx - 15, cy - 4, 3, 10))
        pygame.draw.rect(surface, COLOR_GOLD, (cx + 12, cy - 4, 3, 10))

        # Cockpit
        pygame.draw.circle(surface, COLOR_GREEN, (cx, cy - 4), 6)

        # Shield Bubble
        if active_powerup and active_powerup['type'] == 'SHIELD':
            pygame.draw.circle(surface, COLOR_GREEN, (cx, cy), self.radius + 8, 2)

        # Tractor Beam Pulse
        if active_powerup and active_powerup['type'] == 'MAGNET':
            pulse_rad = int(self.radius + 12 + math.sin(pygame.time.get_ticks() * 0.01) * 4)
            pygame.draw.circle(surface, COLOR_CYAN, (cx, cy), pulse_rad, 1)

        # Hitbox Debugger
        if show_hitbox:
            pygame.draw.circle(surface, COLOR_RED, (cx, cy), self.radius, 1)
            pygame.draw.rect(surface, COLOR_RED, (cx - self.radius, cy - self.radius, self.radius * 2, self.radius * 2), 1)

class Collectible:
    def __init__(self, x, y, item_type, diff_factor):
        self.x = x
        self.y = y
        self.vx = 0.0
        self.vy = 0.0
        self.type = item_type
        self.speed = random.uniform(90, 130) * diff_factor
        self.rotation = 0.0
        self.rot_speed = random.uniform(-2, 2)

        if item_type == 'NOVA_CORE':
            self.radius = 16
            self.color = COLOR_GOLD
        elif item_type == 'MAGNET':
            self.radius = 18
            self.color = COLOR_CYAN
        elif item_type == 'SHIELD':
            self.radius = 18
            self.color = COLOR_GREEN
        elif item_type == 'SPREAD':
            self.radius = 18
            self.color = COLOR_GOLD
        else: # CRYSTAL
            self.radius = 13
            self.color = COLOR_CYAN

    def update(self, dt, player_target):
        if self.vx != 0 or self.vy != 0:
            self.x += self.vx * dt
            self.y += self.vy * dt
            self.vx *= 0.94
            self.vy += 80 * dt
        else:
            self.y += self.speed * dt

        if player_target and (self.type in ('CRYSTAL', 'NOVA_CORE')):
            dx = player_target.x - self.x
            dy = player_target.y - self.y
            dist = math.hypot(dx, dy)
            if dist < 300:
                pull_speed = 460
                self.x += (dx / dist) * pull_speed * dt
                self.y += (dy / dist) * pull_speed * dt
                return

        self.rotation += self.rot_speed * dt

    def draw(self, surface, show_hitbox, font_sm):
        cx, cy = int(self.x), int(self.y)

        if self.type == 'CRYSTAL':
            pts = [
                (cx, cy - self.radius),
                (cx + int(self.radius * 0.8), cy),
                (cx, cy + self.radius),
                (cx - int(self.radius * 0.8), cy)
            ]
            pygame.draw.polygon(surface, self.color, pts)
            pygame.draw.polygon(surface, COLOR_WHITE, pts, 1)

        elif self.type == 'NOVA_CORE':
            pts = []
            for i in range(16):
                r = self.radius if (i % 2 == 0) else self.radius * 0.5
                angle = (i * math.pi) / 8 + self.rotation
                pts.append((cx + math.cos(angle) * r, cy + math.sin(angle) * r))
            pygame.draw.polygon(surface, self.color, pts)
            pygame.draw.polygon(surface, COLOR_WHITE, pts, 1)

        else: # Power-up Orb (MAGNET, SHIELD, SPREAD)
            pygame.draw.circle(surface, COLOR_CARD, (cx, cy), self.radius)
            pygame.draw.circle(surface, self.color, (cx, cy), self.radius, 2)
            lbl = "M" if self.type == 'MAGNET' else ("S" if self.type == 'SHIELD' else "3X")
            t = font_sm.render(lbl, True, self.color)
            surface.blit(t, (cx - t.get_width() // 2, cy - t.get_height() // 2))

        if show_hitbox:
            pygame.draw.circle(surface, COLOR_CYAN, (cx, cy), self.radius, 1)

class Hazard:
    def __init__(self, x, y, hazard_type, diff_factor):
        self.x = x
        self.y = y
        self.type = hazard_type
        self.rotation = 0.0
        self.rot_speed = random.uniform(-2, 2)
        self.pulse = 0.0
        self.flash_timer = 0.0

        if hazard_type == 'MINE':
            self.radius = 16
            self.hp = 1
            self.speed = random.uniform(90, 120) * diff_factor
        else: # ASTEROID
            self.radius = random.randint(18, 28)
            self.hp = 2
            self.speed = random.uniform(70, 110) * diff_factor
            self.vertices_rel = []
            num_pts = 8
            for i in range(num_pts):
                angle = (i * math.pi * 2) / num_pts
                dist = self.radius * random.uniform(0.75, 1.15)
                self.vertices_rel.append((math.cos(angle) * dist, math.sin(angle) * dist))

    def update(self, dt, player_target):
        if self.flash_timer > 0:
            self.flash_timer -= dt

        if self.type == 'MINE' and player_target:
            dx = player_target.x - self.x
            self.x += math.copysign(min(abs(dx), 60), dx) * dt
            self.y += self.speed * dt
            self.pulse += dt * 8
        else:
            self.y += self.speed * dt

        self.rotation += self.rot_speed * dt

    def draw(self, surface, show_hitbox):
        cx, cy = int(self.x), int(self.y)
        is_flash = self.flash_timer > 0

        if self.type == 'MINE':
            body_col = COLOR_WHITE if is_flash else (30, 41, 59)
            pygame.draw.circle(surface, body_col, (cx, cy), int(self.radius * 0.75))
            for i in range(4):
                angle = (i * math.pi / 4) + self.rotation
                x1 = cx + math.cos(angle) * self.radius
                y1 = cy + math.sin(angle) * self.radius
                x2 = cx - math.cos(angle) * self.radius
                y2 = cy - math.sin(angle) * self.radius
                pygame.draw.line(surface, COLOR_RED, (x1, y1), (x2, y2), 2)
            core_r = max(2, int(4 + math.sin(self.pulse) * 2))
            pygame.draw.circle(surface, COLOR_RED, (cx, cy), core_r)

        else: # Asteroid
            pts = []
            for rx, ry in self.vertices_rel:
                cos_a = math.cos(self.rotation)
                sin_a = math.sin(self.rotation)
                px = cx + (rx * cos_a - ry * sin_a)
                py = cy + (rx * sin_a + ry * cos_a)
                pts.append((px, py))
            fill_col = COLOR_WHITE if is_flash else ((71, 85, 105) if self.hp == 1 else (51, 65, 85))
            edge_col = COLOR_RED if self.hp == 1 else (100, 116, 139)
            pygame.draw.polygon(surface, fill_col, pts)
            pygame.draw.polygon(surface, edge_col, pts, 2)

        if show_hitbox:
            pygame.draw.circle(surface, COLOR_RED, (cx, cy), self.radius, 1)

# --- GAME ENGINE ---
class AstroMinerPygame:
    def __init__(self):
        pygame.init()
        pygame.display.set_caption("Astro-Miner: Combat Harvest — 2D Space Shooter")
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        self.clock = pygame.time.Clock()

        # Fonts
        self.font_title = pygame.font.SysFont("impact", 48)
        self.font_lg = pygame.font.SysFont("arial", 26, bold=True)
        self.font_md = pygame.font.SysFont("arial", 18, bold=True)
        self.font_sm = pygame.font.SysFont("arial", 14)

        # Starfield
        self.stars = [
            [random.uniform(0, SCREEN_WIDTH), random.uniform(0, SCREEN_HEIGHT), random.uniform(20, 60), random.randint(1, 2)]
            for _ in range(80)
        ]

        self.state = STATE_START
        self.score = 0
        self.high_score = 0
        self.lives = 3
        self.combo = 1
        self.max_combo = 1
        self.game_time = 0.0
        self.show_hitbox = False
        self.screen_shake = 0.0

        self.player = PlayerShip(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 90)
        self.lasers = []
        self.collectibles = []
        self.hazards = []
        self.particles = []
        self.floating_texts = []
        self.active_powerup = None

        self.spawn_col_timer = 0.0
        self.spawn_haz_timer = 0.0
        self.spawn_pwr_timer = 0.0

    def reset(self):
        self.score = 0
        self.lives = 3
        self.combo = 1
        self.max_combo = 1
        self.game_time = 0.0
        self.screen_shake = 0.0
        self.lasers.clear()
        self.collectibles.clear()
        self.hazards.clear()
        self.particles.clear()
        self.floating_texts.clear()
        self.active_powerup = None
        self.player = PlayerShip(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 90)

    def run(self):
        running = True
        while running:
            dt = self.clock.tick(FPS) / 1000.0
            dt = min(dt, 0.1)

            keys = pygame.key.get_pressed()
            is_shooting = keys[pygame.K_SPACE] or pygame.mouse.get_pressed()[0]

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE or event.key == pygame.K_p:
                        if self.state == STATE_PLAYING:
                            self.state = STATE_PAUSED
                        elif self.state == STATE_PAUSED:
                            self.state = STATE_PLAYING
                    elif event.key == pygame.K_F1:
                        self.show_hitbox = not self.show_hitbox
                    elif event.key in (pygame.K_SPACE, pygame.K_RETURN):
                        if self.state == STATE_START:
                            self.reset()
                            self.state = STATE_PLAYING
                        elif self.state == STATE_GAMEOVER:
                            self.reset()
                            self.state = STATE_PLAYING
                    elif event.key == pygame.K_r:
                        self.reset()
                        self.state = STATE_PLAYING

            self.update_stars(dt)
            if self.state == STATE_PLAYING:
                self.update_game(dt, keys, is_shooting)

            self.draw()

        pygame.quit()
        sys.exit()

    def update_stars(self, dt):
        for s in self.stars:
            s[1] += s[2] * dt
            if s[1] > SCREEN_HEIGHT:
                s[1] = 0
                s[0] = random.uniform(0, SCREEN_WIDTH)

    def update_game(self, dt, keys, is_shooting):
        self.game_time += dt
        diff_factor = 1.0 + min(self.game_time * 0.018, 2.5)

        if self.screen_shake > 0:
            self.screen_shake -= dt

        # Player
        self.player.update(dt, keys, is_shooting, self)

        # Update Lasers
        for laser in self.lasers[:]:
            laser.update(dt)
            if laser.is_offscreen():
                self.lasers.remove(laser)

        # Power-up Timer
        if self.active_powerup:
            self.active_powerup['timeLeft'] -= dt
            if self.active_powerup['timeLeft'] <= 0:
                self.floating_texts.append(FloatingText("POWER-UP EXPIRED", self.player.x, self.player.y - 30, COLOR_MUTED, self.font_sm))
                self.active_powerup = None

        # Laser vs Hazard Collisions
        for laser in self.lasers[:]:
            for h in self.hazards[:]:
                dist_sq = (laser.x - h.x)**2 + (laser.y - h.y)**2
                combined_r = laser.radius + h.radius
                if dist_sq <= combined_r**2:
                    if laser in self.lasers:
                        self.lasers.remove(laser)
                    h.hp -= laser.damage
                    h.flash_timer = 0.12

                    if h.hp <= 0:
                        self.on_hazard_shattered(h)
                        if h in self.hazards:
                            self.hazards.remove(h)
                    break

        # Spawning Collectibles
        self.spawn_col_timer += dt
        col_interval = max(1.2 / (diff_factor * 0.8), 0.6)
        if self.spawn_col_timer >= col_interval:
            self.spawn_col_timer = 0.0
            is_rare = (random.random() < 0.22)
            self.collectibles.append(Collectible(
                random.uniform(40, SCREEN_WIDTH - 40),
                -20,
                'NOVA_CORE' if is_rare else 'CRYSTAL',
                diff_factor
            ))

        # Spawning Hazards
        self.spawn_haz_timer += dt
        haz_interval = max(1.6 / diff_factor, 0.6)
        if self.spawn_haz_timer >= haz_interval:
            self.spawn_haz_timer = 0.0
            is_mine = (random.random() < 0.3 and self.game_time > 8)
            self.hazards.append(Hazard(
                random.uniform(40, SCREEN_WIDTH - 40),
                -20,
                'MINE' if is_mine else 'ASTEROID',
                diff_factor
            ))

        # Spawning Power-up (Tractor Magnet, Plasma Shield, or Spread Shot)
        self.spawn_pwr_timer += dt
        if self.spawn_pwr_timer >= 12.0 and not self.active_powerup:
            self.spawn_pwr_timer = 0.0
            r = random.random()
            ptype = 'SPREAD' if r < 0.35 else ('MAGNET' if r < 0.7 else 'SHIELD')
            self.collectibles.append(Collectible(random.uniform(40, SCREEN_WIDTH - 40), -20, ptype, diff_factor))

        # Update Collectibles
        has_magnet = self.active_powerup and self.active_powerup['type'] == 'MAGNET'
        for c in self.collectibles[:]:
            c.update(dt, self.player if has_magnet else None)
            dist_sq = (self.player.x - c.x)**2 + (self.player.y - c.y)**2
            combined_r = self.player.radius + c.radius
            if dist_sq <= combined_r**2:
                self.on_collect(c)
                self.collectibles.remove(c)
            elif c.y - c.radius > SCREEN_HEIGHT + 30:
                self.collectibles.remove(c)

        # Update Hazards
        for h in self.hazards[:]:
            h.update(dt, self.player)
            dist_sq = (self.player.x - h.x)**2 + (self.player.y - h.y)**2
            combined_r = self.player.radius + h.radius
            if dist_sq <= combined_r**2:
                self.on_hazard_hit(h)
                self.hazards.remove(h)
            elif h.y - h.radius > SCREEN_HEIGHT + 40:
                self.hazards.remove(h)

        # Particles & Text
        for p in self.particles[:]:
            p.update(dt)
            if p.is_dead():
                self.particles.remove(p)

        for ft in self.floating_texts[:]:
            ft.update(dt)
            if ft.is_dead():
                self.floating_texts.remove(ft)

    def on_hazard_shattered(self, h):
        self.screen_shake = 0.2
        kill_pts = (30 if h.type == 'MINE' else 20) * self.combo
        self.score += kill_pts
        self.floating_texts.append(FloatingText(f"+{kill_pts}", h.x, h.y, COLOR_GREEN, self.font_md))

        # Explosion debris
        for _ in range(20):
            angle = random.uniform(0, math.pi * 2)
            spd = random.uniform(60, 180)
            self.particles.append(Particle(h.x, h.y, math.cos(angle)*spd, math.sin(angle)*spd, COLOR_MUTED, 0.5, 4))

        # Loot Drop: Drops collectible crystal/core
        drop_type = 'NOVA_CORE' if random.random() < 0.35 else 'CRYSTAL'
        drop = Collectible(h.x, h.y, drop_type, 1.0)
        ang = random.uniform(-math.pi / 2, math.pi / 2)
        spd = random.uniform(40, 100)
        drop.vx = math.sin(ang) * spd
        drop.vy = math.cos(ang) * spd
        self.collectibles.append(drop)

    def on_collect(self, item):
        if item.type == 'CRYSTAL':
            pts = 10 * self.combo
            self.score += pts
            self.combo = min(self.combo + 1, 5)
            self.max_combo = max(self.max_combo, self.combo)
            self.floating_texts.append(FloatingText(f"+{pts}", item.x, item.y, COLOR_CYAN, self.font_md))
        elif item.type == 'NOVA_CORE':
            pts = 50 * self.combo
            self.score += pts
            self.combo = min(self.combo + 2, 5)
            self.max_combo = max(self.max_combo, self.combo)
            self.floating_texts.append(FloatingText(f"NOVA CORE +{pts}!", item.x, item.y, COLOR_GOLD, self.font_md))
        else: # Power-up
            duration = 8.5 if item.type == 'SPREAD' else (7.0 if item.type == 'MAGNET' else 8.0)
            self.active_powerup = {'type': item.type, 'timeLeft': duration, 'max': duration}
            name = "TRIPLE SPREAD" if item.type == 'SPREAD' else ("MAGNET TRACTOR" if item.type == 'MAGNET' else "PLASMA SHIELD")
            col = COLOR_GOLD if item.type == 'SPREAD' else (COLOR_CYAN if item.type == 'MAGNET' else COLOR_GREEN)
            self.floating_texts.append(FloatingText(f"{name} ACTIVE!", item.x, item.y, col, self.font_md))

        if self.score > self.high_score:
            self.high_score = self.score

        for _ in range(12):
            angle = random.uniform(0, math.pi * 2)
            spd = random.uniform(40, 120)
            self.particles.append(Particle(item.x, item.y, math.cos(angle)*spd, math.sin(angle)*spd, item.color, 0.4))

    def on_hazard_hit(self, h):
        if self.player.is_invulnerable:
            return

        if self.active_powerup and self.active_powerup['type'] == 'SHIELD':
            self.active_powerup = None
            self.player.trigger_invulnerability(1.2)
            self.floating_texts.append(FloatingText("SHIELD DEFLECTED IMPACT!", self.player.x, self.player.y - 25, COLOR_GREEN, self.font_md))
            return

        self.lives -= 1
        self.combo = 1
        self.screen_shake = 0.35
        self.player.trigger_invulnerability(1.8)
        self.floating_texts.append(FloatingText("HULL DAMAGE! -1 LIFE", self.player.x, self.player.y - 25, COLOR_RED, self.font_md))

        for _ in range(25):
            angle = random.uniform(0, math.pi * 2)
            spd = random.uniform(60, 200)
            self.particles.append(Particle(h.x, h.y, math.cos(angle)*spd, math.sin(angle)*spd, COLOR_RED, 0.6, 4))

        if self.lives <= 0:
            self.state = STATE_GAMEOVER

    def draw(self):
        # Apply screen shake offset
        ox = random.randint(-4, 4) if self.screen_shake > 0 else 0
        oy = random.randint(-4, 4) if self.screen_shake > 0 else 0

        self.screen.fill(COLOR_BG)

        for sx, sy, _, sz in self.stars:
            pygame.draw.circle(self.screen, (200, 220, 255), (int(sx + ox), int(sy + oy)), sz)

        for laser in self.lasers:
            laser.draw(self.screen, self.show_hitbox)

        for c in self.collectibles:
            c.draw(self.screen, self.show_hitbox, self.font_sm)

        for h in self.hazards:
            h.draw(self.screen, self.show_hitbox)

        self.player.draw(self.screen, self.show_hitbox, self.active_powerup)

        for p in self.particles:
            p.draw(self.screen)

        for ft in self.floating_texts:
            ft.draw(self.screen)

        self.draw_hud()

        if self.state == STATE_START:
            self.draw_overlay("ASTRO-MINER", "2D Space Shooter & Cosmic Harvester", "PRESS SPACE OR ENTER TO LAUNCH", COLOR_CYAN)
        elif self.state == STATE_PAUSED:
            self.draw_overlay("MISSION PAUSED", "Thrusters on standby", "PRESS ESC OR P TO RESUME", COLOR_GOLD)
        elif self.state == STATE_GAMEOVER:
            self.draw_overlay(
                "HULL BREACH DETECTED",
                f"Final Score: {self.score}  |  Best: {self.high_score}  |  Max Combo: x{self.max_combo}",
                "PRESS R OR ENTER TO RE-ENGAGE",
                COLOR_RED
            )

        pygame.display.flip()

    def draw_hud(self):
        score_surf = self.font_md.render(f"SCORE: {self.score:04d}", True, COLOR_WHITE)
        high_surf = self.font_md.render(f"HIGH: {self.high_score:04d}", True, COLOR_MUTED)
        combo_surf = self.font_md.render(f"COMBO: x{self.combo}", True, COLOR_GOLD)

        mins = int(self.game_time // 60)
        secs = int(self.game_time % 60)
        time_surf = self.font_md.render(f"TIME: {mins:02d}:{secs:02d}", True, COLOR_WHITE)

        self.screen.blit(score_surf, (20, 15))
        self.screen.blit(combo_surf, (180, 15))
        self.screen.blit(time_surf, (300, 15))
        self.screen.blit(high_surf, (440, 15))

        for i in range(3):
            col = COLOR_CYAN if (i < self.lives) else (50, 60, 80)
            pygame.draw.polygon(self.screen, col, [
                (600 + i * 26, 30),
                (608 + i * 26, 15),
                (616 + i * 26, 30)
            ])

        if self.active_powerup:
            pct = max(0.0, self.active_powerup['timeLeft'] / self.active_powerup['max'])
            bar_w = int(120 * pct)
            p_type = self.active_powerup['type']
            p_col = COLOR_GOLD if p_type == 'SPREAD' else (COLOR_CYAN if p_type == 'MAGNET' else COLOR_GREEN)
            pygame.draw.rect(self.screen, (30, 40, 60), (740, 18, 120, 12))
            pygame.draw.rect(self.screen, p_col, (740, 18, bar_w, 12))
            p_label = self.font_sm.render(p_type, True, p_col)
            self.screen.blit(p_label, (740, 32))

    def draw_overlay(self, title, sub, prompt, theme_col):
        overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
        overlay.fill((5, 10, 20, 215))
        self.screen.blit(overlay, (0, 0))

        card_rect = pygame.Rect(SCREEN_WIDTH // 2 - 280, SCREEN_HEIGHT // 2 - 140, 560, 280)
        pygame.draw.rect(self.screen, COLOR_CARD, card_rect, border_radius=12)
        pygame.draw.rect(self.screen, theme_col, card_rect, 2, border_radius=12)

        t_surf = self.font_title.render(title, True, theme_col)
        s_surf = self.font_md.render(sub, True, COLOR_WHITE)
        p_surf = self.font_lg.render(prompt, True, COLOR_GOLD)

        self.screen.blit(t_surf, (SCREEN_WIDTH // 2 - t_surf.get_width() // 2, card_rect.y + 40))
        self.screen.blit(s_surf, (SCREEN_WIDTH // 2 - s_surf.get_width() // 2, card_rect.y + 110))
        self.screen.blit(p_surf, (SCREEN_WIDTH // 2 - p_surf.get_width() // 2, card_rect.y + 180))

if __name__ == '__main__':
    game = AstroMinerPygame()
    game.run()
