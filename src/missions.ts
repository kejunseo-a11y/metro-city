import * as T from "three";
import { v } from "./core";
import { World } from "./world";
import { Player } from "./player";
import { Police } from "./police";
import { Storage } from "./storage";
export const locations = [
  { id: "delivery", name: "퀵 배송", pos: v(18, 22), color: 0xf0bd5e },
  { id: "race", name: "시티 서킷", pos: v(-18, -140), color: 0x9b8bf2 },
  { id: "escape", name: "추격 탈출", pos: v(175, 18), color: 0xf17b76 },
  { id: "shop", name: "모터스 · 판매점", pos: v(18, 180), color: 0x68d8ce },
  { id: "garage", name: "내 차고", pos: v(18, 65), color: 0x68d8ce },
];
export class Missions {
  active = "";
  stage = 0;
  timer = 0;
  state = "대기";
  message = "";
  goal: T.Vector3 | null = null;
  target: T.Mesh;
  markers: T.Mesh[] = [];
  checkpoints = [v(0, -160), v(160, -160), v(160, 0), v(0, 0), v(0, -160)];
  constructor(
    world: World,
    public save: Storage,
  ) {
    for (const l of locations) {
      const m = new T.Mesh(
        new T.TorusGeometry(3, 0.2, 6, 24),
        new T.MeshBasicMaterial({ color: l.color }),
      );
      m.rotation.x = Math.PI / 2;
      m.position.copy(l.pos);
      m.position.y = 0.3;
      world.scene.add(m);
      this.markers.push(m);
      const pole = new T.Mesh(
        new T.CylinderGeometry(0.08, 0.08, 8, 5),
        new T.MeshBasicMaterial({
          color: l.color,
          transparent: true,
          opacity: 0.6,
        }),
      );
      pole.position.copy(l.pos);
      pole.position.y = 4;
      world.scene.add(pole);
    }
    this.target = new T.Mesh(
      new T.TorusGeometry(6, 0.35, 6, 32),
      new T.MeshBasicMaterial({ color: 0x74edb9 }),
    );
    this.target.rotation.x = Math.PI / 2;
    world.scene.add(this.target);
    this.target.visible = false;
  }
  start(id: string, police: Police) {
    if (this.active) return;
    this.active = id;
    this.stage = 0;
    this.state = "진행 중";
    this.message = "";
    this.timer = id === "race" ? 100 : id === "escape" ? 150 : 240;
    if (id === "delivery") {
      this.goal = v(175, 175);
      this.message = "물건 수령지로 이동하세요. F로 수령";
    }
    if (id === "race") {
      this.goal = this.checkpoints[0];
      this.message = "차량으로 체크포인트를 순서대로 통과하세요";
    }
    if (id === "escape") {
      police.crime(2);
      this.goal = null;
      this.message = "경찰 시야를 벗어나 수배를 모두 해제하세요";
    }
  }
  finish(ok: boolean) {
    const reward =
      { delivery: 500, race: 1000, escape: 1500 }[this.active] || 0;
    this.state = ok ? "성공" : "실패";
    this.message = ok
      ? `미션 성공 · ₩${reward.toLocaleString()} 지급`
      : "미션 실패 · 시작 지점에서 다시 도전하세요";
    if (ok) {
      this.save.data.money += reward;
      if (!this.save.data.completed.includes(this.active))
        this.save.data.completed.push(this.active);
      this.save.save();
    }
    this.active = "";
    this.goal = null;
  }
  update(dt: number, p: Player, police: Police, interact: boolean) {
    this.markers.forEach(
      (m) => (m.position.y = 0.4 + Math.sin(performance.now() * 0.002) * 0.15),
    );
    if (this.active) {
      this.timer -= dt;
      if (this.timer <= 0 || p.health <= 0) this.finish(false);
      else if (
        this.active === "delivery" &&
        this.goal &&
        p.position.distanceTo(this.goal) < 10
      ) {
        if (this.stage === 0 && interact) {
          this.stage = 1;
          this.goal = v(-175, -160);
          this.message = "자동차로 서쪽 물류 거점까지 배송하세요";
        } else if (this.stage === 1 && p.car) this.finish(true);
      } else if (
        this.active === "race" &&
        p.car &&
        this.goal &&
        p.position.distanceTo(this.goal) < 12
      ) {
        this.stage++;
        if (this.stage >= this.checkpoints.length) this.finish(true);
        else this.goal = this.checkpoints[this.stage];
      } else if (this.active === "escape" && police.level === 0)
        this.finish(true);
    }
    this.target.visible = !!this.goal;
    if (this.goal) {
      this.target.position.copy(this.goal);
      this.target.position.y = 0.5;
    }
  }
}
