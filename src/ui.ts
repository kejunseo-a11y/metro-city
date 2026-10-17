import * as T from "three";
import { roads } from "./core";
import { Player } from "./player";
import { Police } from "./police";
import { Missions, locations } from "./missions";
import { Storage } from "./storage";
import { specs, Kind } from "./vehicles";
export class UI {
  root = document.querySelector<HTMLDivElement>("#app")!;
  map: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  big = false;
  modal = false;
  toast = "";
  constructor() {
    this.root.innerHTML = `<div id="brand"><b>METRO<span> / </span>CITY</b><small id="district">오픈월드 · 자유 탐험</small></div><div id="account"></div><div id="objective"></div><div id="mapWrap"><canvas id="map" width="240" height="240"></canvas><div id="health"></div></div><div id="speed"></div><div id="hint"></div><div id="notice"></div><div id="overlay"></div><div id="controls">WASD 이동 &nbsp; E 탑승 &nbsp; F 상호작용 &nbsp; M 지도 &nbsp; ESC 메뉴</div>`;
    this.map = document.querySelector("#map")!;
    this.ctx = this.map.getContext("2d")!;
  }
  overlay(
    title: string,
    body: string,
    buttons: { text: string; action: () => void }[],
  ) {
    this.modal = true;
    document.exitPointerLock();
    const el = document.querySelector<HTMLDivElement>("#overlay")!;
    el.style.display = "grid";
    el.innerHTML = `<section><div class="eyebrow">METRO CITY / SINGLE PLAYER</div><h1>${title}</h1>${body}<div id="buttons"></div></section>`;
    for (const b of buttons) {
      const bt = document.createElement("button");
      bt.textContent = b.text;
      bt.onclick = b.action;
      el.querySelector("#buttons")!.append(bt);
    }
  }
  close() {
    this.modal = false;
    document.querySelector<HTMLElement>("#overlay")!.style.display = "none";
  }
  shop(save: Storage, garage: boolean, spawn: (k: Kind) => void) {
    const buttons = (Object.keys(specs) as Kind[]).map((k) => ({
      text: garage
        ? `${specs[k].name} ${save.data.owned.includes(k) ? "불러오기" : "미보유"}`
        : `${specs[k].name} · ₩${specs[k].price.toLocaleString()} ${save.data.owned.includes(k) ? "(보유)" : ""}`,
      action: () => {
        if (garage) {
          if (save.data.owned.includes(k)) {
            spawn(k);
            this.close();
          }
        } else if (
          !save.data.owned.includes(k) &&
          save.data.money >= specs[k].price
        ) {
          save.data.money -= specs[k].price;
          save.data.owned.push(k);
          save.save();
          this.toast = "구매 완료 · 차고에서 불러오세요";
          this.close();
        } else this.toast = "이미 보유했거나 잔액이 부족합니다";
      },
    }));
    this.overlay(
      garage ? "당신의 차고" : "메트로 모터스",
      "<p>세단은 처음부터 보유하고 있습니다. 구매 차량은 차고에서 출고하세요.</p>",
      [...buttons, { text: "돌아가기", action: () => this.close() }],
    );
  }
  update(
    p: Player,
    police: Police,
    m: Missions,
    s: Storage,
    time: number,
    hint: string,
    fps: number,
    district: string,
  ) {
    const set = (id: string, html: string) =>
      (document.getElementById(id)!.innerHTML = html);
    const pos = p.position;
    set(
      "account",
      `<small>보유 금액</small><strong>₩ ${s.data.money.toLocaleString()}</strong><div class="stars">${"★".repeat(police.level)}<span>${"☆".repeat(3 - police.level)}</span></div><small>${police.level ? (police.seen ? "추격 중 · 시야를 벗어나세요" : `수색 중 · ${Math.ceil(14 - police.unseen)}초`) : "수배 없음"}</small>`,
    );
    set(
      "district",
      `${district} · ${String(Math.floor(time)).padStart(2, "0")}:${String(Math.floor((time % 1) * 60)).padStart(2, "0")} · ${fps} FPS`,
    );
    set(
      "health",
      `<span>체력 ${Math.ceil(p.health)}</span><i style="width:${p.health}%"></i>`,
    );
    set(
      "speed",
      p.car
        ? `<strong>${Math.round(Math.abs(p.car.speed) * 3.6)}</strong><small> KM/H</small><p>${specs[p.car.kind].name} · 내구도 ${Math.ceil(p.car.health)}%</p>`
        : "<small>ON FOOT</small>",
    );
    set(
      "objective",
      m.active
        ? `<small>진행 중 / ${m.active === "delivery" ? "퀵 배송" : m.active === "race" ? "시티 서킷" : "추격 탈출"}</small><h3>${m.message}</h3><span>${m.goal ? Math.round(pos.distanceTo(m.goal)) + " m · " : ""}${Math.ceil(m.timer)}초 ${m.active === "race" ? `· ${m.stage}/5` : ""}</span>`
        : "<small>자유 탐험</small><h3>이 도시의 다음 이야기는 당신이 만듭니다.</h3><span>금색 배송 · 보라색 경주 · 빨간색 추격 탈출</span>",
    );
    set("hint", hint);
    set("notice", this.toast || m.message || s.warning);
    this.drawMap(p, police, m);
  }
  drawMap(p: Player, police: Police, m: Missions) {
    const size = this.big ? 650 : 240;
    if (this.map.width !== size) {
      this.map.width = size;
      this.map.height = size;
    }
    this.map.parentElement!.classList.toggle("big", this.big);
    const ctx = this.ctx,
      scale = this.big ? size / 840 : 0.64;
    const center = this.big ? new T.Vector3() : p.position;
    const to = (x: number, z: number) => [
      size / 2 + (x - center.x) * scale,
      size / 2 + (z - center.z) * scale,
    ];
    ctx.fillStyle = "#172d35";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "#49616b";
    ctx.lineWidth = 24 * scale;
    for (const r of roads) {
      ctx.beginPath();
      ctx.moveTo(...(to(-400, r) as [number, number]));
      ctx.lineTo(...(to(400, r) as [number, number]));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(...(to(r, -400) as [number, number]));
      ctx.lineTo(...(to(r, 400) as [number, number]));
      ctx.stroke();
    }
    const dot = (x: number, z: number, c: string, r = 4) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(...(to(x, z) as [number, number]), r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const l of locations) {
      dot(l.pos.x, l.pos.z, "#" + l.color.toString(16), 5);
      if (this.big) {
        ctx.fillStyle = "#fff";
        ctx.font = "12px sans-serif";
        const q = to(l.pos.x, l.pos.z);
        ctx.fillText(l.name, q[0] + 8, q[1] - 8);
      }
    }
    if (m.goal) {
      dot(m.goal.x, m.goal.z, "#79ffc4", 7);
    }
    for (const c of police.units)
      dot(c.mesh.position.x, c.mesh.position.z, "#f4777e", 4);
    const q = to(p.position.x, p.position.z);
    ctx.save();
    ctx.translate(q[0], q[1]);
    ctx.rotate(-(p.car ? p.car.heading : p.mesh.rotation.y));
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.lineTo(-6, -6);
    ctx.lineTo(6, -6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#bed0d5";
    ctx.font = "11px sans-serif";
    ctx.fillText("N ↑", 12, 20);
  }
}
