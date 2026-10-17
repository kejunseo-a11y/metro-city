import * as T from "three";
import { human, animate, v } from "./core";
import { World } from "./world";
import { Car } from "./vehicles";
export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();
  yaw = 0;
  pitch = 0.35;
  distance = 11;
  constructor(canvas: HTMLCanvasElement) {
    addEventListener("keydown", (e) => {
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (["Space", "Tab"].includes(e.code)) e.preventDefault();
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => this.keys.clear());
    canvas.onclick = () => this.lockPointer();
    addEventListener("mousemove", (e) => {
      if (document.pointerLockElement) {
        this.yaw -= e.movementX * 0.003;
        this.pitch = T.MathUtils.clamp(
          this.pitch + e.movementY * 0.002,
          -0.1,
          1.1,
        );
      }
    });
    addEventListener(
      "wheel",
      (e) =>
        (this.distance = T.MathUtils.clamp(
          this.distance + e.deltaY * 0.01,
          5,
          28,
        )),
    );
  }
  lockPointer() {
    // Some embedded browsers decline pointer lock; never interrupt gameplay.
    try {
      const request = document
        .querySelector("body > canvas")
        ?.requestPointerLock();
      request?.catch(() => {});
    } catch {}
  }
  has(k: string) {
    return this.keys.has(k);
  }
  take(k: string) {
    const b = this.pressed.has(k);
    this.pressed.delete(k);
    return b;
  }
}
export class Player {
  mesh = human();
  health = 100;
  car: Car | null = null;
  vy = 0;
  constructor(public world: World) {
    this.mesh.position.set(19, 0, 35);
    world.scene.add(this.mesh);
  }
  get position() {
    return this.car ? this.car.mesh.position : this.mesh.position;
  }
  update(dt: number, input: Input, cars: Car[]) {
    if (input.take("KeyE")) {
      if (this.car) {
        if (Math.abs(this.car.speed) < 3) {
          const p = this.car.mesh.position
            .clone()
            .add(
              v(
                4 * Math.cos(this.car.heading),
                -4 * Math.sin(this.car.heading),
              ),
            );
          if (
            !this.world.blocked(p, 0.6) &&
            !cars.some(
              (c) => c !== this.car && c.mesh.position.distanceTo(p) < 3,
            )
          ) {
            this.mesh.position.copy(p);
            this.car = null;
            this.mesh.visible = true;
          }
        }
      } else {
        const c = cars
          .filter((c) => c.health > 0)
          .sort(
            (a, b) =>
              a.mesh.position.distanceTo(this.position) -
              b.mesh.position.distanceTo(this.position),
          )[0];
        if (c && c.mesh.position.distanceTo(this.position) < 7) {
          this.car = c;
          c.traffic = false;
          this.mesh.visible = false;
        }
      }
    }
    if (this.car) {
      this.car.drive(
        dt,
        Number(input.has("KeyW")) - Number(input.has("KeyS")),
        Number(input.has("KeyA")) - Number(input.has("KeyD")),
        input.has("Space"),
      );
      if (this.car.health <= 0) this.health -= dt * 15;
      return;
    }
    const x = Number(input.has("KeyD")) - Number(input.has("KeyA")),
      z = Number(input.has("KeyW")) - Number(input.has("KeyS"));
    const d = v(-x, z);
    if (d.length()) {
      d.normalize().applyAxisAngle(new T.Vector3(0, 1, 0), input.yaw);
      const speed = input.has("ShiftLeft") ? 10 : 4.8;
      const old = this.mesh.position.clone();
      this.world.move(
        this.mesh.position,
        d.x * speed * dt,
        d.z * speed * dt,
        0.6,
      );
      if (
        cars.some((c) => c.mesh.position.distanceTo(this.mesh.position) < 2.6)
      ) {
        this.mesh.position.copy(old);
        if (
          cars.some(
            (c) =>
              Math.abs(c.speed) > 6 && c.mesh.position.distanceTo(old) < 3.5,
          )
        )
          this.health -= dt * 20;
      }
      this.mesh.rotation.y = T.MathUtils.lerp(
        this.mesh.rotation.y,
        Math.atan2(d.x, d.z),
        0.2,
      );
      animate(this.mesh, performance.now() / 1000, speed);
    } else animate(this.mesh, 0, 0);
    if (input.take("Space") && this.mesh.position.y <= 0.01) this.vy = 7;
    this.vy -= 18 * dt;
    this.mesh.position.y = Math.max(0, this.mesh.position.y + this.vy * dt);
    if (this.mesh.position.y === 0) this.vy = 0;
  }
}
export class FollowCamera {
  camera = new T.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 950);
  update(dt: number, p: Player, input: Input, world: World) {
    const center = p.position.clone().add(new T.Vector3(0, p.car ? 2 : 1.7, 0));
    const yaw = p.car
      ? p.car.heading + Math.PI + input.yaw
      : input.yaw + Math.PI;
    let dist = input.distance * (p.car ? 1.3 : 1);
    const dir = new T.Vector3(
      Math.sin(yaw) * Math.cos(input.pitch),
      Math.sin(input.pitch),
      Math.cos(yaw) * Math.cos(input.pitch),
    );
    for (let d = 1; d < dist; d += 0.5) {
      const q = center.clone().addScaledVector(dir, d);
      if (world.solids.some((b) => b.containsPoint(q))) {
        dist = Math.max(1, d - 0.8);
        break;
      }
    }
    this.camera.position.lerp(
      center.clone().addScaledVector(dir, dist),
      1 - Math.exp(-dt * 9),
    );
    this.camera.lookAt(center);
  }
}
