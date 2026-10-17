import * as T from "three";
import "./style.css";
import { World } from "./world";
import { Player, Input, FollowCamera } from "./player";
import { Car, Citizens } from "./vehicles";
import { Police } from "./police";
import { Missions, locations } from "./missions";
import { Storage } from "./storage";
import { UI } from "./ui";
const world = new World(),
  save = new Storage(),
  ui = new UI(),
  player = new Player(world),
  camera = new FollowCamera();
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);
const input = new Input(renderer.domElement);
let citizens = new Citizens(world),
  parked = [
    new Car("sedan", world, 7, 38, 0x56a7a6),
    new Car("sport", world, -7, 58, 0xd17757),
    new Car("van", world, 7, 85, 0xd8c7a3),
  ];
const police = new Police(world),
  missions = new Missions(world, save);
let started = false,
  last = performance.now(),
  hudTimer = 0,
  frames = 0,
  fps = 60,
  frameTime = 0,
  crimeCooldown = 0;
let density: "low" | "normal" = "normal";
const resume = () => {
  ui.close();
  input.keys.clear();
  input.pressed.clear();
};
const respawn = () => {
  player.car = null;
  player.mesh.visible = true;
  player.mesh.position.set(19, 0, 35);
  player.health = 100;
  player.vy = 0;
  police.reset();
  if (missions.active) missions.finish(false);
  resume();
};
ui.overlay(
  "METRO<br>CITY",
  "<p>길을 걷고, 차에 올라, 도시의 일을 맡으세요.<br>도시 그래픽 업데이트 v1.1 · 새로운 거리와 야경</p><ul><li>WASD 이동 / 운전 · Shift 달리기 · Space 점프 / 핸드브레이크</li><li>E 탑승·하차 (저속) · F 미션·상점 · M 전체 지도</li><li>화면 클릭 후 마우스 시점 조절 · 휠 줌 · ESC 일시정지</li><li>R 소란 발생: 수배 테스트 · 시야 밖에서 14초마다 별 감소</li></ul><p>금색 마커에서 첫 배송을 시작하세요. 근처 도로에 세단이 있습니다.</p>",
  [
    {
      text: "도시로 들어가기 →",
      action: () => {
        started = true;
        resume();
        input.lockPointer();
      },
    },
  ],
);
function pause() {
  ui.overlay(
    "잠시 쉬어가기",
    `<p>도시 그래픽 업데이트 v1.1 · 게임이 일시정지되었습니다.</p>
    <div class="settings-grid"><label>주변 인구 / 교통<select id="density"><option value="low" ${density === "low" ? "selected" : ""}>낮음 · 8명 / 5대</option><option value="normal" ${density === "normal" ? "selected" : ""}>기본 · 15명 / 10대</option></select></label>
    <label>시간대 미리보기<select id="lighting"><option value="keep">현재 시간 유지</option><option value="10">맑은 낮</option><option value="17.5">해 질 녘</option><option value="22">도시의 밤</option></select></label>
    <label><input id="freeze-time" type="checkbox" ${world.timeFrozen ? "checked" : ""}> 선택한 시간대 고정</label></div><p>완료한 미션 ${save.data.completed.length}/3 · 돈과 소유 차량은 자동 저장됩니다.</p>`,
    [
      {
        text: "계속하기",
        action: () => {
          const nextDensity = (
            document.querySelector("#density") as HTMLSelectElement
          ).value as "low" | "normal";
          if (nextDensity !== density) {
            citizens.people.forEach((p) => world.scene.remove(p.mesh));
            // Keep cars the player has taken; only replace the remaining traffic.
            citizens.cars.forEach((c) => {
              if (c.traffic) world.scene.remove(c.mesh);
              else if (!parked.includes(c)) parked.push(c);
            });
            density = nextDensity;
            citizens = new Citizens(
              world,
              density === "low" ? 8 : 15,
              density === "low" ? 5 : 10,
            );
          }
          const lighting = (
            document.querySelector("#lighting") as HTMLSelectElement
          ).value;
          if (lighting !== "keep") world.time = Number(lighting);
          world.timeFrozen = (
            document.querySelector("#freeze-time") as HTMLInputElement
          ).checked;
          world.update(0, player.position);
          resume();
        },
      },
      { text: "시작 위치로 복귀", action: respawn },
    ],
  );
}
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.camera.aspect = innerWidth / innerHeight;
  camera.camera.updateProjectionMatrix();
});
addEventListener("blur", () => {
  if (started && !ui.modal) pause();
});
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.04);
  last = now;
  frames++;
  frameTime += dt;
  if (frameTime > 1) {
    fps = frames;
    frames = 0;
    frameTime = 0;
  }
  if (input.take("Escape") && started) {
    if (ui.modal && player.health > 0) resume();
    else if (!ui.modal) pause();
  }
  if (input.take("KeyM") && !ui.modal) ui.big = !ui.big;
  let hint = "";
  if (started && !ui.modal) {
    const cars = [...parked, ...citizens.cars, ...police.units];
    const previous = player.car;
    player.update(dt, input, cars);
    if (previous !== player.car && player.car) {
      input.yaw = 0;
      if (player.car.police) {
        police.crime();
        player.car.police = false;
        police.units = police.units.filter((c) => c !== player.car);
        parked.push(player.car);
      }
    }
    crimeCooldown -= dt;
    if (input.take("KeyR") && crimeCooldown <= 0) {
      police.crime();
      crimeCooldown = 2;
      ui.toast = "소란 신고 접수 · 경찰 출동";
    }
    citizens.update(
      dt,
      player.position,
      police.level > 0 || (!!player.car && Math.abs(player.car.speed) > 16),
      world,
    );
    police.update(dt, player.position, cars);
    if (player.car) {
      for (const c of cars) {
        if (c === player.car) continue;
        const delta = player.car.mesh.position.clone().sub(c.mesh.position);
        if (delta.length() < 4.4) {
          if (Math.abs(player.car.speed) > 8 && crimeCooldown <= 0) {
            police.crime();
            crimeCooldown = 4;
            player.car.health = Math.max(0, player.car.health - 8);
          }
          if (delta.length() < 0.01) delta.set(1, 0, 0);
          delta.normalize();
          player.car.mesh.position.addScaledVector(delta, 0.4);
          player.car.speed *= -0.25;
        }
      }
      for (const p of citizens.people)
        if (
          p.mesh.position.distanceTo(player.position) < 2.8 &&
          Math.abs(player.car.speed) > 8 &&
          crimeCooldown <= 0
        ) {
          police.crime();
          crimeCooldown = 4;
          p.pause = 2;
        }
    }
    for (const c of police.units)
      if (
        c.mesh.position.distanceTo(player.position) < 6 &&
        Math.abs(c.speed) < 8
      )
        player.health = Math.max(0, player.health - dt * 6);
    const interact = input.take("KeyF");
    missions.update(dt, player, police, interact);
    const near = locations.find((l) => l.pos.distanceTo(player.position) < 10);
    if (near && !missions.active) {
      hint = `F · ${near.name}`;
      if (interact) {
        if (near.id === "shop" || near.id === "garage")
          ui.shop(save, near.id === "garage", (kind) => {
            if (player.car) {
              ui.toast = "차량에서 내린 뒤 출고하세요";
              return;
            }
            const old = parked.find((c) => c.mesh.userData.garage);
            if (old) {
              world.scene.remove(old.mesh);
              parked = parked.filter((c) => c !== old);
            }
            const c = new Car(kind, world, 6, 68, 0x5fc5ad);
            c.mesh.userData.garage = true;
            parked.push(c);
          });
        else {
          const desc =
            near.id === "delivery"
              ? "공업 지구에서 물건을 F로 수령하고 자동차로 서쪽 거점까지 배송하세요. 제한 240초 · 보상 ₩500"
              : near.id === "race"
                ? "자동차로 5개 체크포인트를 순서대로 통과하세요. 제한 100초 · 보상 ₩1,000"
                : "수배 2단계가 발생합니다. 경찰 시야를 피해 수배를 해제하세요. 제한 150초 · 보상 ₩1,500";
          ui.overlay(near.name, `<p>${desc}</p>`, [
            {
              text: "미션 시작",
              action: () => {
                missions.start(near.id, police);
                resume();
              },
            },
            { text: "돌아가기", action: resume },
          ]);
        }
      }
    } else if (
      missions.active === "delivery" &&
      missions.stage === 0 &&
      missions.goal &&
      player.position.distanceTo(missions.goal) < 10
    )
      hint = "F · 배송 물건 수령";
    else if (player.car)
      hint =
        Math.abs(player.car.speed) < 3 ? "E · 하차" : "SPACE · 핸드브레이크";
    else if (cars.some((c) => c.mesh.position.distanceTo(player.position) < 7))
      hint = "E · 차량 탑승";
    world.update(dt, player.position);
    camera.update(dt, player, input, world);
    if (player.health <= 0) {
      if (missions.active) missions.finish(false);
      ui.overlay(
        "다시 시작할 시간",
        "<p>체력이 모두 소진되었습니다. 보유 금액과 구매 차량은 유지됩니다.</p>",
        [{ text: "다시 시작", action: respawn }],
      );
    }
  } else if (!started) camera.update(dt, player, input, world);
  hudTimer += dt;
  if (hudTimer > 0.1) {
    ui.update(
      player,
      police,
      missions,
      save,
      world.time,
      hint,
      fps,
      world.districtAt(player.position),
    );
    hudTimer = 0;
  }
  input.pressed.clear();
  renderer.render(world.scene, camera.camera);
}
requestAnimationFrame(frame);

export { player, world, police, missions, save, parked, citizens, ui, input };
export { renderer, camera };
