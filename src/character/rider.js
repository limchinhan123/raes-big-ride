import * as THREE from 'three';
import { buildRae } from './rae.js';
import { buildBike } from './vehicles/bike.js';
import { buildScooter } from './vehicles/scooter.js';

// Rider = Rae mounted on a vehicle, with live IK posing and animation.
// group's +Z is forward; origin sits on the ground under the wheels.

const TMP = new THREE.Vector3();
const TMP2 = new THREE.Vector3();

// 2-bone solve in a sagittal plane. target given in joint space
// (down = -y, forward = +z). Returns angles for hip/shoulder + knee/elbow.
function solve2Bone(fwd, down, L1, L2, bendSign) {
  const dist = Math.min(Math.hypot(fwd, down), L1 + L2 - 0.004);
  const phi = Math.atan2(fwd, down); // 0 = straight down, + = forward
  const cosInner = THREE.MathUtils.clamp((L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2), -1, 1);
  const inner = Math.acos(cosInner);
  const flex = Math.PI - inner; // 0 = straight
  const cosPsi = THREE.MathUtils.clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
  const psi = Math.acos(cosPsi);
  return {
    rootAngle: -(phi + bendSign * psi),
    jointAngle: bendSign * flex,
  };
}

export class Rider {
  constructor(type = 'bike', { frameColor, variant = 'rae' } = {}) {
    this.group = new THREE.Group();
    this.type = type;
    this.rae = buildRae({ variant });
    this.vehicle = type === 'bike' ? buildBike({ frameColor }) : buildScooter({ frameColor });
    this.group.add(this.vehicle.group);
    this.group.add(this.rae.root);
    this.crankAngle = 0;
    this.kickPhase = Math.random();
    this.pedalBlend = 1; // 1 = pedaling, 0 = coasting
    this.time = 0;
    this.ponyVel = 0;
    this.ponyRot = -0.3;
    this.#mount();
  }

  #mount() {
    const r = this.rae;
    if (this.type === 'bike') {
      const st = this.vehicle.saddleTop;
      r.root.position.set(st.x, st.y + 0.055, st.z + 0.02);
      r.spine.rotation.x = 0.5;        // proper kid-crouch lean
      r.neck.rotation.x = -0.42;       // look up the road
      r.setHelmet(true);
    } else {
      r.root.position.set(0, 0.46, -0.1);
      r.spine.rotation.x = 0.18;
      r.neck.rotation.x = -0.14;
      r.setHelmet(true);
    }
  }

  setColor(hex) { this.vehicle.setColor(hex); }

  // steer: -1..1, speed m/s, slope: route grade, state: 'ride'|'stop'|'celebrate'
  update(dt, { speed = 0, steer = 0, slope = 0, state = 'ride' } = {}) {
    this.time += dt;
    const r = this.rae;
    const v = this.vehicle;
    const stopped = state === 'stop' || speed < 0.05;

    const dbg = Rider.debugFlags ?? {};
    if (this.type === 'bike') this.#updateBike(dt, speed, steer, slope, stopped, dbg);
    else this.#updateScooter(dt, speed, steer, slope, stopped);
    if (dbg.nopony) return;

    // ponytail spring (sways with speed + lean)
    const targetRot = -0.35 - Math.min(0.5, speed * 0.05) + Math.sin(this.time * 2.2) * 0.05 * Math.min(1, speed * 0.3);
    const k = 26, damp = 7.5;
    this.ponyVel += (targetRot - this.ponyRot) * k * dt;
    this.ponyVel *= Math.exp(-damp * dt);
    this.ponyRot += this.ponyVel * dt;
    r.pony0.rotation.x = this.ponyRot;
    r.pony1.rotation.x = this.ponyRot * 0.55;
    r.pony0.rotation.z = steer * 0.2 + Math.sin(this.time * 3.1) * 0.04 * Math.min(1, speed * 0.25);

    // gentle head bob + steering look
    r.headGrp.rotation.z = -steer * 0.1;
    r.headGrp.rotation.y = steer * 0.35;

    if (state === 'celebrate') {
      const w = Math.sin(this.time * 9);
      for (const key of ['L', 'R']) {
        const a = r.arms[key];
        a.shoulder.rotation.x = Math.PI * 0.92 + w * 0.15;
        a.shoulder.rotation.z = (key === 'L' ? -1 : 1) * 0.45;
        a.elbow.rotation.x = -0.25;
      }
      r.spine.rotation.x = 0.05 + Math.sin(this.time * 6) * 0.04;
    }
  }

  #updateBike(dt, speed, steer, slope, stopped, dbg = {}) {
    const r = this.rae, v = this.vehicle;
    // wheels roll
    const w = speed / v.wheelRadius;
    v.wheels.front.rotation.x += w * dt;
    v.wheels.rear.rotation.x += w * dt;
    for (const tw of v.wheels.training) tw.rotation.x += (speed / 0.062) * dt;
    // steering
    v.handlebar.rotation.y = steer * 0.42;

    // cadence: pedal when powering, freewheel downhill
    const coasting = slope < -0.035 && speed > 2.5;
    this.pedalBlend += ((coasting || stopped ? 0 : 1) - this.pedalBlend) * Math.min(1, dt * 3);
    const cadence = (speed / v.wheelRadius) * 0.52;
    this.crankAngle += cadence * this.pedalBlend * dt;
    v.crank.rotation.x = this.crankAngle;

    // feet follow pedals (counter-rotate pedal platforms to stay level)
    const bb = v.bbPos;
    if (dbg.nolegs) return;
    for (const [key, side, phase] of [['L', -1, Math.PI], ['R', 1, 0]]) {
      const a = this.crankAngle + phase;
      // pedal centre in vehicle space
      TMP.set(side * 0.07, bb.y - Math.cos(a) * v.crankArm, bb.z - Math.sin(a) * v.crankArm);
      const leg = r.legs[key];
      // hip world position in rider space
      const hipY = r.root.position.y - 0.02;
      const hipZ = r.root.position.z;
      const fwd = TMP.z - hipZ;
      const down = hipY - (TMP.y + 0.035);
      const sol = solve2Bone(fwd, down, leg.thighLen, leg.shinLen, 1);
      leg.hip.rotation.x = sol.rootAngle;
      leg.knee.rotation.x = sol.jointAngle;
      // keep foot level-ish
      leg.ankle.rotation.x = -(sol.rootAngle + sol.jointAngle) * 0.85;
    }
    // counter-rotate pedal platforms so they stay level
    for (const pedal of v.pedals) pedal.rotation.x = -this.crankAngle;

    // hands to grips
    if (!dbg.noarms) {
      for (const [key, gripPos] of [['L', v.gripL], ['R', v.gripR]]) {
        const arm = r.arms[key];
        arm.shoulder.getWorldPosition(TMP2);
        this.group.worldToLocal(TMP2);
        const fwd = gripPos.z + (steer * (key === 'L' ? -1 : 1) * 0.02) - TMP2.z;
        const down = TMP2.y - gripPos.y;
        const sol = solve2Bone(fwd, Math.max(0.05, down), arm.upperLen, arm.foreLen, -1);
        arm.shoulder.rotation.x = sol.rootAngle;
        arm.elbow.rotation.x = sol.jointAngle;
        arm.shoulder.rotation.z = (key === 'L' ? 1 : -1) * 0.14;
      }
    }

    // body: slight bob with pedal strokes, lean into steer
    r.spine.rotation.x = 0.38 + Math.sin(this.crankAngle * 2) * 0.015 * this.pedalBlend;
    r.root.rotation.z = -steer * 0.1;
    r.root.rotation.y = steer * 0.06;
  }

  #updateScooter(dt, speed, steer, slope, stopped) {
    const r = this.rae, v = this.vehicle;
    for (const fw of v.wheels.front) fw.rotation.x += (speed / 0.06) * dt;
    v.wheels.rear.rotation.x += (speed / 0.055) * dt;
    v.front.rotation.y = steer * 0.4;

    // kick cycle unless coasting
    const coasting = slope < -0.03 && speed > 2.2;
    const kickRate = THREE.MathUtils.clamp(0.55 + speed * 0.1, 0.55, 1.15);
    if (!coasting && !stopped) this.kickPhase = (this.kickPhase + dt * kickRate) % 1;

    // left foot planted mid-deck
    const legL = r.legs.L;
    const deckY = v.deckTopY;
    {
      const fwd = -0.045 - r.root.position.z;
      const down = r.root.position.y - 0.02 - deckY - 0.045;
      const sol = solve2Bone(fwd, down, legL.thighLen, legL.shinLen, 1);
      legL.hip.rotation.x = sol.rootAngle;
      legL.knee.rotation.x = sol.jointAngle;
      legL.ankle.rotation.x = -(sol.rootAngle + sol.jointAngle);
    }
    // right foot: kick path (swing forward → push back along ground → lift)
    const legR = r.legs.R;
    {
      const p = this.kickPhase;
      let fz, fy;
      if (coasting || stopped) {
        fz = -0.2; fy = deckY; // resting on deck rear
      } else if (p < 0.42) {
        // push: foot near ground sweeping back
        const t = p / 0.42;
        fz = 0.1 - t * 0.42;
        fy = 0.028;
      } else {
        // recover: lift and swing forward
        const t = (p - 0.42) / 0.58;
        fz = -0.32 + t * 0.42;
        fy = 0.028 + Math.sin(t * Math.PI) * 0.1;
      }
      const fwd = fz - r.root.position.z;
      const down = r.root.position.y - 0.02 - fy - 0.045;
      const sol = solve2Bone(fwd, down, legR.thighLen, legR.shinLen, 1);
      legR.hip.rotation.x = sol.rootAngle;
      legR.knee.rotation.x = sol.jointAngle;
      legR.ankle.rotation.x = -(sol.rootAngle + sol.jointAngle) * 0.7;
    }
    // slight body pump with the kick
    const pump = (!coasting && !stopped) ? Math.sin(this.kickPhase * Math.PI * 2) : 0;
    r.root.position.y = 0.46 + pump * 0.012;
    r.spine.rotation.x = 0.16 + pump * 0.03;

    // hands
    for (const [key, gripPos] of [['L', v.gripL], ['R', v.gripR]]) {
      const arm = r.arms[key];
      arm.shoulder.getWorldPosition(TMP2);
      this.group.worldToLocal(TMP2);
      const fwd = gripPos.z - TMP2.z;
      const down = TMP2.y - gripPos.y;
      const sol = solve2Bone(fwd, Math.max(-0.15, down), arm.upperLen, arm.foreLen, -1);
      arm.shoulder.rotation.x = sol.rootAngle;
      arm.elbow.rotation.x = sol.jointAngle;
      arm.shoulder.rotation.z = (key === 'L' ? 1 : -1) * 0.1;
    }
    r.root.rotation.z = -steer * 0.12;
  }
}
