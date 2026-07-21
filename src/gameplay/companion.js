import * as THREE from 'three';
import { Rider } from '../character/rider.js';

// Cousin Zoe rides along — follows a little behind and to the side, on her
// sunshine-yellow ride, mirroring stops and celebrations.

const P = new THREE.Vector3();
const Q = new THREE.Quaternion();
const QB = new THREE.Quaternion();
const M = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);

export class Companion {
  constructor(engine, route, { vehicle = 'bike' } = {}) {
    this.engine = engine;
    this.route = route;
    this.rider = new Rider(vehicle, { frameColor: 0xf2c035, variant: 'zoe' });
    engine.scene.add(this.rider.group);
    this.s = 1;
    this.lane = -0.7;
    this.speed = 0;
    this.steer = 0;
    this.celebrating = false;
  }

  update(dt, player) {
    // Normally abreast and a little ahead so the chase camera frames her.
    // When Rae is stopped or slowing (traffic light, obstacle) Zoe tucks in
    // BEHIND her instead — riding ahead put Zoe out in the junction where
    // the crossing cars drive straight through her.
    const holdingBack = player.state === 'stop' || player.state === 'slowing';
    const targetS = Math.max(0.5, player.s + (holdingBack ? -1.5 : 0.9));
    const targetLane = THREE.MathUtils.clamp(player.laneD * 0.35 - 1.15, -1.6, 0.5);

    const prevS = this.s;
    this.s += (targetS - this.s) * Math.min(1, dt * 2.2);
    this.speed = THREE.MathUtils.clamp((this.s - prevS) / Math.max(dt, 1e-4), 0, 12);
    const prevLane = this.lane;
    this.lane += (targetLane - this.lane) * Math.min(1, dt * 2.0);
    const laneVel = dt > 1e-5 ? (this.lane - prevLane) / dt : 0;
    this.steer += ((laneVel * 0.55) - this.steer) * Math.min(1, dt * 5);
    if (!Number.isFinite(this.steer)) this.steer = 0;

    const slope = this.route.slopeAt(this.s);
    const crown = 0.045 * (1 - Math.pow(this.lane / 2.7, 2)) - 0.01;
    this.route.lateral(this.s, this.lane, this.route.yAt(this.s) + crown, P);
    this.rider.group.position.copy(P);

    const dir = this.route.dirAt(this.s);
    const tan3 = new THREE.Vector3(dir.x, slope, dir.z).normalize();
    M.lookAt(new THREE.Vector3(0, 0, 0), tan3.clone().negate(), UP);
    Q.setFromRotationMatrix(M);
    QB.setFromAxisAngle(FWD, -this.steer * 0.09);
    Q.multiply(QB);
    this.rider.group.quaternion.slerp(Q, Math.min(1, dt * 8));

    this.rider.update(dt, {
      speed: this.speed,
      steer: this.steer,
      slope,
      state: this.celebrating ? 'celebrate' : (player.state === 'stop' || this.speed < 0.05 ? 'stop' : 'ride'),
    });
  }
}
