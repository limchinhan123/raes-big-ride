import * as THREE from 'three';
import { Rider } from '../character/rider.js';

// Moves the rider along the route with slope-aware speed, lane offsets for
// dodging, banking, and a smooth chase camera.

export const PACES = {
  gentle: 4.0,
  quick: 5.6,
  zoomy: 7.4,
};

const P = new THREE.Vector3();
const AHEAD = new THREE.Vector3();
const CAMT = new THREE.Vector3();
const LOOK = new THREE.Vector3();
const Q = new THREE.Quaternion();
const QBANK = new THREE.Quaternion();
const M = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);

export class Player {
  constructor(engine, route, { vehicle = 'bike', frameColor, pace = 'quick' } = {}) {
    this.engine = engine;
    this.route = route;
    this.rider = new Rider(vehicle, { frameColor });
    engine.scene.add(this.rider.group);

    this.s = 4;
    this.speed = 0;
    this.baseSpeed = PACES[pace] ?? PACES.quick;
    this.laneD = 0;          // current lateral offset
    this.laneTarget = 0;     // requested lateral offset
    this.steer = 0;
    this.state = 'ride';     // ride | slowing | stop
    this.stateFactor = 1;    // multiplier toward target speed
    this.camInit = false;
    this.celebrating = false;
    this.orbitT = 0;
  }

  setLane(d) { this.laneTarget = THREE.MathUtils.clamp(d, -1.6, 1.6); }

  setState(state) { this.state = state; }

  get pos() { return this.rider.group.position; }

  update(dt) {
    const route = this.route;
    const slope = route.slopeAt(this.s);

    // target speed: pace, hills, and gameplay state. Hills bite harder now so
    // uphill visibly slows to a labour and downhill clearly whooshes.
    const hillFactor = THREE.MathUtils.clamp(1 - slope * 10.5, 0.42, 1.95);
    const targetFactor = (this.state === 'stop') ? 0 : (this.state === 'slowing' ? 0.22 : 1);
    const stopping = this.state === 'stop';
    // Brake FIRMLY for a full stop so she halts at the line instead of coasting
    // past it (the otter/car-crossing overshoot); ease gently otherwise.
    const sfRate = stopping ? 2.6 : (targetFactor < this.stateFactor ? 1.6 : 1.1);
    this.stateFactor += (targetFactor - this.stateFactor) * Math.min(1, dt * sfRate);
    const vTarget = this.baseSpeed * hillFactor * this.stateFactor;
    this.speed += (vTarget - this.speed) * Math.min(1, dt * (stopping ? 3.6 : 1.4));
    if (this.speed < 0.02 && targetFactor === 0) this.speed = 0;

    this.s = Math.min(route.length - 0.5, this.s + this.speed * dt);

    // lane change eases + produces steer lean
    const prevLane = this.laneD;
    this.laneD += (this.laneTarget - this.laneD) * Math.min(1, dt * 2.4);
    const laneVel = dt > 1e-5 ? (this.laneD - prevLane) / dt : 0;
    this.steer += ((laneVel * 0.55) - this.steer) * Math.min(1, dt * 5);
    if (!Number.isFinite(this.steer)) this.steer = 0;

    // place on road (crown compensation)
    const crown = 0.045 * (1 - Math.pow(this.laneD / 2.7, 2)) - 0.01;
    route.lateral(this.s, this.laneD, route.yAt(this.s) + crown, P);
    this.rider.group.position.copy(P);

    // orient along the 3D tangent, bank composed in — single writer for the transform
    if (!this.debugNoQuat) {
      const dir = route.dirAt(this.s, AHEAD);
      const tan3 = new THREE.Vector3(dir.x, slope, dir.z).normalize();
      M.lookAt(new THREE.Vector3(0, 0, 0), tan3.clone().negate(), UP);
      Q.setFromRotationMatrix(M);
      QBANK.setFromAxisAngle(FWD, -this.steer * 0.09);
      Q.multiply(QBANK);
      this.rider.group.quaternion.slerp(Q, Math.min(1, dt * 8));
    }

    if (!this.debugNoAnim) {
      this.rider.update(dt, {
        speed: this.speed, steer: this.steer, slope,
        state: this.celebrating ? 'celebrate' : this.state,
      });
    }

    this.#camera(dt, slope);
  }

  #camera(dt, slope) {
    const route = this.route;
    const cam = this.engine.camera;
    if (this.celebrating) {
      // slow celebratory orbit around Rae
      this.orbitT += dt * 0.32;
      const p = this.pos;
      cam.position.set(
        p.x + Math.cos(this.orbitT) * 4.6,
        p.y + 1.7 + Math.sin(this.orbitT * 0.7) * 0.3,
        p.z + Math.sin(this.orbitT) * 4.6,
      );
      cam.lookAt(p.x, p.y + 0.7, p.z);
      cam.fov += (50 - cam.fov) * Math.min(1, dt * 2);
      cam.updateProjectionMatrix();
      return;
    }
    const backS = Math.max(0, this.s - 3.8);
    route.lateral(backS, this.laneD * 0.45, route.yAt(backS) + 1.45, CAMT);
    if (!this.camInit) {
      cam.position.copy(CAMT);
      this.camInit = true;
    } else {
      const k = 1 - Math.exp(-dt * 5.2);
      cam.position.lerp(CAMT, k);
    }
    const aheadS = this.s + 5.5;
    route.lateral(aheadS, this.laneD * 0.3, route.yAt(aheadS) + 1.05, LOOK);
    LOOK.lerp(this.pos.clone().add(new THREE.Vector3(0, 0.85, 0)), 0.35);
    cam.lookAt(LOOK);
    cam.rotation.z += -this.steer * 0.03;
    const targetFov = 55 + Math.min(11, this.speed * 1.15) + (slope < -0.04 ? 4 : 0);
    cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 3);
    cam.updateProjectionMatrix();
  }
}
