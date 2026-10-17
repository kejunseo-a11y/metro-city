import * as T from "three";
import { box, angle, nearest, roads, v, human, animate } from "./core";
import { World } from "./world";
export type Kind = "sedan" | "sport" | "van";
export const specs = {
  sedan: { name: "시티 세단", max: 36, acc: 15, turn: 1.8, price: 800 },
  sport: { name: "코멧 스포츠", max: 58, acc: 23, turn: 2.3, price: 2500 },
  van: { name: "카고 밴", max: 26, acc: 10, turn: 1.25, price: 1200 },
};
export class Car {
  mesh = new T.Group();
  speed = 0;
  health = 100;
  heading = 0;
  wheels: T.Mesh[] = [];
  route: T.Vector3[] = [];
  index = 0;
  police = false;
  traffic = false;
  constructor(
    public kind: Kind,
    public world: World,
    x: number,
    z: number,
    color = 0xd7a54b,
  ) {
    const van = kind === "van";
    this.mesh.add(
      box(2.5, 1, 4.9, color, 0, 1),
      box(
        2.15,
        van ? 1.6 : 0.9,
        van ? 3.5 : 2.6,
        0x203b4b,
        0,
        van ? 2 : 1.9,
        -0.15,
      ),
    );
    for (const a of [-1, 1])
      for (const b of [-1, 1]) {
        const w = new T.Mesh(
          new T.CylinderGeometry(0.53, 0.53, 0.35, 10),
          new T.MeshStandardMaterial({ color: 0x17202b }),
        );
        w.rotation.z = Math.PI / 2;
        w.position.set(a * 1.25, 0.6, b * 1.5);
        this.wheels.push(w);
        this.mesh.add(w);
      }
    for (const a of [-0.8, 0.8])
      this.mesh.add(
        box(0.55, 0.3, 0.12, 0xffebac, a, 1, 2.5),
        box(0.55, 0.3, 0.12, 0xe75d62, a, 1, -2.5),
      );
    this.mesh.position.set(x, 0, z);
    world.scene.add(this.mesh);
  }
  setPolice() {
    this.police = true;
    this.mesh.add(
      box(0.85, 0.25, 0.55, 0x3b9bff, -0.5, 2.6),
      box(0.85, 0.25, 0.55, 0xff4e60, 0.5, 2.6),
    );
  }
  drive(dt: number, throttle: number, steer: number, brake: boolean) {
    const s = specs[this.kind];
    this.speed += throttle * s.acc * dt;
    this.speed *= Math.exp(-(brake ? 3 : throttle === 0 ? 0.65 : 0.15) * dt);
    this.speed = T.MathUtils.clamp(
      this.speed,
      -10,
      s.max * (this.police ? 1.15 : 1),
    );
    this.heading +=
      steer *
      s.turn *
      dt *
      T.MathUtils.clamp(this.speed / 13, -1, 1) *
      (brake ? 1.4 : 1);
    const p = this.mesh.position,
      old = p.clone();
    this.world.move(
      p,
      Math.sin(this.heading) * this.speed * dt,
      Math.cos(this.heading) * this.speed * dt,
      2.6,
    );
    if (
      old.distanceTo(p) < Math.abs(this.speed * dt) * 0.4 &&
      Math.abs(this.speed) > 2
    ) {
      this.health = Math.max(0, this.health - Math.abs(this.speed) * 0.6);
      this.speed *= -0.25;
    }
    this.mesh.rotation.y = this.heading;
    this.wheels.forEach((w) => (w.rotation.x += this.speed * dt * 1.8));
    if (this.health <= 0) this.speed = 0;
  }
  ai(dt: number, target?: T.Vector3, cars: Car[] = []) {
    if (
      target &&
      (!this.route.length ||
        this.mesh.position.distanceTo(this.route[this.route.length - 1]) < 15)
    ) {
      const p = this.mesh.position;
      const sx = nearest(p.x),
        sz = nearest(p.z),
        tx = nearest(target.x),
        tz = nearest(target.z);
      this.route = [v(sx, sz)];
      let ix = roads.indexOf(sx),
        iz = roads.indexOf(sz);
      while (roads[ix] !== tx) {
        ix += Math.sign(tx - roads[ix]);
        this.route.push(v(roads[ix], roads[iz]));
      }
      while (roads[iz] !== tz) {
        iz += Math.sign(tz - roads[iz]);
        this.route.push(v(roads[ix], roads[iz]));
      }
      this.route.push(
        Math.abs(target.x - tx) < Math.abs(target.z - tz)
          ? v(tx, target.z)
          : v(target.x, tz),
      );
      this.index = 0;
    }
    const dest = this.route[this.index];
    if (!dest) return;
    const p = this.mesh.position;
    if (p.distanceTo(dest) < 10) {
      this.index = (this.index + 1) % this.route.length;
      if (target && this.index === 0) this.route = [];
      return;
    }
    const wanted = Math.atan2(dest.x - p.x, dest.z - p.z);
    const diff = angle(this.heading, wanted);
    let desired = this.police ? (this.kind === "sport" ? 43 : 30) : 14;
    const forward = v(Math.sin(this.heading), Math.cos(this.heading));
    if (
      cars.some(
        (c) =>
          c !== this &&
          c.mesh.position.distanceTo(p) < 10 &&
          c.mesh.position.clone().sub(p).dot(forward) > 0,
      )
    )
      desired = 0;
    if (
      !this.police &&
      Math.abs(p.x - nearest(p.x)) < 22 &&
      Math.abs(p.z - nearest(p.z)) < 22 &&
      Math.floor(performance.now() / 6000) % 2 ===
        (Math.abs(forward.x) > 0.5 ? 0 : 1)
    )
      desired = 0;
    if (Math.abs(diff) > 0.55) desired = Math.min(desired, 6);
    this.heading += T.MathUtils.clamp(diff, -dt * 1.8, dt * 1.8);
    this.speed = T.MathUtils.lerp(this.speed, desired, 1 - Math.exp(-dt * 3));
    this.drive(dt, 0, 0, false);
  }
}
export class Citizens {
  people: { mesh: T.Group; points: T.Vector3[]; i: number; pause: number }[] =
    [];
  cars: Car[] = [];
  constructor(world: World, count = 15, traffic = 10) {
    for (let i = 0; i < count; i++) {
      const x = roads[i % 5] + 17,
        z = -280 + ((i * 37) % 550);
      const mesh = human([0xde795f, 0x4fa49b, 0xe2c478][i % 3]);
      mesh.position.set(x, 0, z);
      world.scene.add(mesh);
      this.people.push({
        mesh,
        points: [v(x, -300), v(x, 300)],
        i: i % 2,
        pause: 0,
      });
    }
    for (let i = 0; i < traffic; i++) {
      const r = roads[i % 5],
        c = new Car(
          i % 3 === 0 ? "van" : "sedan",
          world,
          r + 5,
          -250 + i * 48,
          [0x7dafa6, 0xd8d2be, 0xa97167][i % 3],
        );
      c.traffic = true;
      c.route = [
        v(r + 5, -320 + 5),
        v(320 - 5, -320 + 5),
        v(320 - 5, 320 - 5),
        v(r + 5, 320 - 5),
      ];
      this.cars.push(c);
    }
  }
  update(dt: number, player: T.Vector3, noise: boolean, world: World) {
    this.cars.forEach((c) => {
      if (c.traffic) c.ai(dt, undefined, this.cars);
    });
    for (const p of this.people) {
      if (p.mesh.position.distanceTo(player) > 220) {
        p.mesh.visible = false;
        continue;
      }
      p.mesh.visible = true;
      const d = p.points[p.i].clone().sub(p.mesh.position);
      let speed = 1.7;
      if (noise && p.mesh.position.distanceTo(player) < 22) {
        d.copy(p.mesh.position).sub(player);
        speed = 5;
      }
      if (d.length() < 2) {
        p.i = 1 - p.i;
        p.pause = 1 + Math.random() * 3;
      }
      p.pause -= dt;
      if (p.pause > 0) continue;
      d.normalize();
      world.move(p.mesh.position, d.x * speed * dt, d.z * speed * dt, 0.5);
      p.mesh.rotation.y = Math.atan2(d.x, d.z);
      animate(p.mesh, performance.now() / 1000, speed);
    }
  }
}
