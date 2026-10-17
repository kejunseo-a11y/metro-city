import * as T from "three";
import { v, nearest } from "./core";
import { Car } from "./vehicles";
import { World } from "./world";
export class Police {
  level = 0;
  unseen = 0;
  last = v();
  units: Car[] = [];
  seen = false;
  spawn = 0;
  constructor(public world: World) {}
  crime(n = 1) {
    this.level = Math.min(3, this.level + n);
    this.unseen = 0;
  }
  reset() {
    this.level = 0;
    this.unseen = 0;
    for (const c of this.units) this.world.scene.remove(c.mesh);
    this.units = [];
  }
  update(dt: number, p: T.Vector3, all: Car[]) {
    if (!this.level) return;
    this.spawn -= dt;
    if (this.units.length < this.level && this.spawn <= 0) {
      let x = nearest(p.x) + 160;
      if (x > 320) x = nearest(p.x) - 160;
      if (!this.units.length) this.last.copy(p);
      const c = new Car(
        this.level >= 3 ? "sport" : "sedan",
        this.world,
        x,
        nearest(p.z),
        0xe8eced,
      );
      c.setPolice();
      this.units.push(c);
      this.spawn = 3;
    }
    this.seen = this.units.some((c) => {
      if (c.mesh.position.distanceTo(p) > 95) return false;
      const dir = p.clone().sub(c.mesh.position);
      for (let f = 0.1; f < 1; f += 0.1)
        if (
          this.world.blocked(c.mesh.position.clone().addScaledVector(dir, f), 0)
        )
          return false;
      return true;
    });
    if (this.seen) {
      this.last.copy(p);
      this.unseen = 0;
    } else this.unseen += dt;
    for (const c of this.units) {
      c.ai(dt, this.seen ? p : this.last, all);
      if (c.mesh.position.distanceTo(p) < 7) c.speed *= 0.98;
    }
    if (this.unseen > 14) {
      this.level--;
      this.unseen = 0;
      if (!this.level) this.reset();
    }
  }
}
