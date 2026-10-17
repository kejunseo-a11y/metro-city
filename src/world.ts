import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { box, roads, v } from "./core";
import { Atmosphere, canvasTexture, signMaterial } from "./visuals";
export type District =
  "downtown" | "residential" | "commercial" | "industrial" | "park";
const themes = {
  downtown: [0x9caeb1, 0x506e80, 0xc6c6b8, 0x7e939e],
  residential: [0xd8cbb0, 0xe6d8bf, 0xb3c0bb, 0xc5ac98],
  commercial: [0xc7baa0, 0xd8c8ad, 0x8ba6a3, 0xb4b9ab],
  industrial: [0x929d9b, 0x788e94, 0xb8b1a0, 0x8e9f98],
};
export class World {
  scene = new T.Scene();
  solids: T.Box3[] = [];
  sun = new T.DirectionalLight(0xffd7aa, 3);
  moon = new T.DirectionalLight(0x8faed6, 0.7);
  ambient = new T.HemisphereLight(0xd3efff, 0x737865, 1.8);
  time = 16.4;
  timeFrozen = false;
  visuals: Atmosphere;
  private seed = 43;
  private batches: T.Mesh[] = [];
  private signals: { mesh: T.Mesh; x: number; z: number }[] = [];
  private tick = 0;
  private asphalt: T.MeshStandardMaterial;
  private pavement: T.MeshStandardMaterial;
  constructor() {
    this.scene.background = new T.Color(0xaec8ce);
    this.scene.fog = new T.Fog(0xb8ced0, 240, 720);
    this.moon.position.set(-70, 180, 90);
    this.scene.add(this.ambient, this.sun, this.moon);
    this.visuals = new Atmosphere(this.scene);
    this.sun.position.set(90, 160, -70);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.08;
    Object.assign(this.sun.shadow.camera, {
      left: -135,
      right: 135,
      top: 135,
      bottom: -135,
      near: 1,
      far: 550,
    });
    this.asphalt = new T.MeshStandardMaterial({
      color: 0x414c54,
      roughness: 0.96,
      map: canvasTexture((c) => {
        c.fillStyle = "#d1d1d1";
        c.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 1800; i++) {
          c.fillStyle = i % 2 ? "#bababa" : "#e2e2e2";
          c.fillRect(this.rand() * 128, this.rand() * 128, 1, 1);
        }
      }),
    });
    this.pavement = new T.MeshStandardMaterial({
      color: 0xc5c4b6,
      roughness: 0.95,
      map: canvasTexture((c) => {
        c.fillStyle = "#deded6";
        c.fillRect(0, 0, 128, 128);
        c.strokeStyle = "#b8b9b0";
        c.lineWidth = 1;
        c.strokeRect(0, 0, 128, 128);
        c.beginPath();
        c.moveTo(64, 0);
        c.lineTo(64, 128);
        c.moveTo(0, 64);
        c.lineTo(128, 64);
        c.stroke();
      }),
    });
    this.add(box(850, 0.5, 850, 0x6d896c, 0, -0.45));
    this.makeRoads();
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) this.block(i, j);
    this.facilities();
    this.roadFurniture();
    this.batch();
    this.update(0, v(19, 35));
  }
  private rand() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private add(mesh: T.Mesh) {
    this.scene.add(mesh);
    this.batches.push(mesh);
    return mesh;
  }
  private solid(mesh: T.Mesh) {
    this.add(mesh);
    mesh.updateMatrixWorld();
    this.solids.push(new T.Box3().setFromObject(mesh));
    return mesh;
  }
  private tiled(
    w: number,
    d: number,
    x: number,
    z: number,
    y: number,
    mat: T.MeshStandardMaterial,
    tile: number,
  ) {
    const g = new T.PlaneGeometry(w, d);
    const uv = g.getAttribute("uv");
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * d) / tile);
    const m = new T.Mesh(g, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.castShadow = false;
    return this.add(m);
  }
  private makeRoads() {
    for (const z of roads) this.tiled(800, 24, 0, z, 0.025, this.asphalt, 8);
    const edges = [-400, ...roads, 400];
    for (const x of roads)
      for (let i = 0; i < edges.length - 1; i++) {
        const a = edges[i] + (i === 0 ? 0 : 12),
          b = edges[i + 1] - (i === edges.length - 2 ? 0 : 12);
        this.tiled(24, b - a, x, (a + b) / 2, 0.025, this.asphalt, 8);
      }
    for (const r of roads) {
      for (let n = -390; n < 400; n += 16)
        if (!roads.some((a) => Math.abs(a - n) < 22)) {
          for (const side of [-0.4, 0.4]) {
            this.add(box(6, 0.018, 0.12, 0xe4c179, n, 0.048, r + side));
            this.add(box(0.12, 0.018, 6, 0xe4c179, r + side, 0.048, n));
          }
        }
      for (const side of [-10.5, 10.5])
        for (let n = -388; n < 400; n += 8) {
          if (!roads.some((a) => Math.abs(a - n) < 24)) {
            this.add(box(8, 0.015, 0.12, 0xe2e2d1, n, 0.045, r + side));
            this.add(box(0.12, 0.015, 8, 0xe2e2d1, r + side, 0.045, n));
          }
        }
    }
    for (const x of roads)
      for (const z of roads) {
        for (const side of [-1, 1]) {
          for (let k = -9; k <= 9; k += 3) {
            this.add(
              box(1.6, 0.025, 5.5, 0xe4e5da, x + k, 0.075, z + side * 16),
            );
            this.add(
              box(5.5, 0.025, 1.6, 0xe4e5da, x + side * 16, 0.075, z + k),
            );
          }
          this.add(box(20, 0.02, 0.35, 0xe0e3d8, x, 0.078, z + side * 21));
          this.add(box(0.35, 0.02, 20, 0xe0e3d8, x + side * 21, 0.078, z));
        }
      }
  }
  private block(i: number, j: number) {
    const x = roads[i] + 80,
      z = roads[j] + 80;
    const district: District =
      i === 2 && j === 2
        ? "park"
        : i === 3
          ? "industrial"
          : i < 2 && j < 2
            ? "downtown"
            : i < 2
              ? "residential"
              : "commercial";
    this.add(box(135, 0.32, 135, 0x9fa79b, x, 0.01, z));
    this.tiled(132, 132, x, z, 0.19, this.pavement, 6);
    if (district === "park") {
      this.park(x, z);
      return;
    }
    for (const a of [-1, 1])
      for (const b of [-1, 1]) {
        const bx = x + a * 31,
          bz = z + b * 31;
        const palette = themes[district];
        const color = palette[Math.floor(this.rand() * palette.length)];
        if (district === "residential") this.house(bx, bz, color);
        else if (district === "industrial") this.warehouse(bx, bz, color);
        else this.building(bx, bz, district, color);
      }
    for (let n = -52; n <= 52; n += 26) {
      if (district !== "industrial")
        this.tree(x + n, z - 61, district === "residential" ? 3 : 4);
      if (n % 52 === 0) this.bench(x + n, z + 62);
    }
    if (district === "industrial")
      for (let n = -1; n <= 1; n++)
        this.container(x, z + n * 24, n % 2 ? 0xa85f47 : 0x4e8292);
    if (district === "residential") {
      for (const a of [-1, 1])
        for (let n = -58; n < 60; n += 8)
          this.add(box(6, 1.5, 0.25, 0xcfc9ae, x + n, 0.95, z + a * 54));
    }
  }
  private facade(
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    style = 0,
    base = 2.5,
  ) {
    const mat = this.visuals.windows[style];
    const height = h - base - 0.8;
    if (height < 2) return;
    for (const side of [-1, 1]) {
      const plane = (width: number, depth: boolean) => {
        const g = new T.PlaneGeometry(width, height);
        const uv = g.getAttribute("uv");
        for (let i = 0; i < uv.count; i++)
          uv.setXY(i, (uv.getX(i) * width) / 9, (uv.getY(i) * height) / 8);
        const m = new T.Mesh(g, mat);
        m.position.set(x, base + height / 2, z);
        if (depth) {
          m.position.x += side * (w / 2 + 0.025);
          m.rotation.y = (side * Math.PI) / 2;
        } else {
          m.position.z += side * (d / 2 + 0.025);
          m.rotation.y = side === 1 ? 0 : Math.PI;
        }
        m.receiveShadow = true;
        m.castShadow = false;
        this.add(m);
      };
      plane(w, false);
      plane(d, true);
    }
  }
  private building(
    x: number,
    z: number,
    kind: "downtown" | "commercial",
    color: number,
  ) {
    const downtown = kind === "downtown",
      h = downtown ? 32 + this.rand() * 64 : 11 + this.rand() * 10,
      w = downtown ? 37 : 43,
      d = downtown ? 37 : 42;
    this.solid(box(w, h, d, color, x, h / 2 + 0.2, z));
    this.add(box(w + 1, 0.65, d + 1, 0x3d5663, x, h + 0.4, z));
    this.add(box(w + 2, 2.4, d + 2, downtown ? 0x5e727a : 0x7f8f89, x, 1.4, z));
    this.facade(x, z, w, d, h, downtown ? 0 : 2);
    if (downtown) {
      for (const a of [-1, 1])
        this.add(
          box(0.5, h, 0.5, 0xc9d0c8, x + (a * w) / 2, h / 2, z + d / 2 + 0.1),
        );
      if (h > 65) {
        const roofH = 5 + this.rand() * 8;
        this.add(box(w * 0.6, roofH, d * 0.6, 0x6a858f, x, h + roofH / 2, z));
        this.add(box(0.3, 12, 0.3, 0xb1bab1, x + 3, h + roofH + 6, z));
      }
      for (let floor = 12; floor < h; floor += 16)
        this.add(box(w + 0.2, 0.35, d + 0.2, 0x9cafb1, x, floor, z));
    } else {
      const names = [
        "METRO COFFEE",
        "CITY MARKET",
        "RECORD / 레코드",
        "MOTORS CLUB",
      ];
      const text = names[Math.floor(this.rand() * names.length)];
      for (const side of [-1, 1]) {
        this.add(box(w, 1.1, 2.5, 0x4f8e85, x, 4.2, z + side * (d / 2 + 1)));
        const s = new T.Mesh(
          new T.PlaneGeometry(w * 0.74, 2.8),
          signMaterial(text, "#254d54"),
        );
        s.position.set(x, 6.3, z + side * (d / 2 + 0.04));
        s.rotation.y = side === 1 ? 0 : Math.PI;
        this.add(s);
      }
      this.add(box(7, 2, 5, 0x839594, x + 8, h + 1, z - 8));
    }
  }
  private house(x: number, z: number, color: number) {
    const h = 6.7 + this.rand() * 2.5,
      w = 31,
      d = 29;
    this.solid(box(w, h, d, color, x, h / 2 + 0.2, z));
    this.facade(x, z, w, d, h, 1, 0.8);
    const vertices = [
      -17, 0, -16, 17, 0, -16, 0, 5, -16, -17, 0, 16, 0, 5, 16, 17, 0, 16, -17,
      0, -16, 0, 5, -16, 0, 5, 16, -17, 0, -16, 0, 5, 16, -17, 0, 16, 17, 0,
      -16, 17, 0, 16, 0, 5, 16, 17, 0, -16, 0, 5, 16, 0, 5, -16,
    ];
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute(
        new Array((vertices.length / 3) * 2).fill(0),
        2,
      ),
    );
    g.computeVertexNormals();
    const roof = new T.Mesh(
      g,
      new T.MeshStandardMaterial({
        color: [0x846851, 0x6c7b79, 0x996b53][Math.floor(this.rand() * 3)],
        roughness: 0.9,
        side: T.DoubleSide,
      }),
    );
    roof.position.set(x, h, z);
    this.add(roof);
    this.add(box(1.8, 4, 1.8, 0x9f8d79, x + 8, h + 3, z - 7));
    this.add(box(4, 0.6, 4, 0xd6cfb7, x, 0.5, z + 17));
    this.add(box(2.2, 3.5, 0.1, 0x557679, x, 1.95, z + d / 2 + 0.04));
    this.add(box(20, 0.2, 4, 0xbebba8, x, 0.35, z + 21));
    for (const side of [-1, 1]) {
      this.tree(x + side * 19, z - 7, 2.8);
      this.add(box(9, 0.8, 1.3, 0x5d7954, x + side * 11, 0.7, z + 20));
    }
  }
  private warehouse(x: number, z: number, color: number) {
    const h = 9 + this.rand() * 5;
    this.solid(box(43, h, 43, color, x, h / 2 + 0.2, z));
    this.add(box(45, 0.6, 45, 0x4c656b, x, h + 0.4, z));
    for (const side of [-1, 1]) {
      this.add(box(13, 5, 0.15, 0x46575d, x, 2.8, z + side * 21.6));
      for (let n = 0; n < 6; n++)
        this.add(
          box(13, 0.08, 0.1, 0x859897, x, 0.7 + n * 0.8, z + side * 21.75),
        );
      for (let k = -18; k <= 18; k += 4)
        this.add(box(0.22, h, 0.2, 0x778b8e, x + k, h / 2, z + side * 21.6));
      this.add(box(44, 0.7, 0.2, 0xd3a34f, x, h - 2, z + side * 21.6));
    }
    this.add(box(8, 2, 8, 0x6b8085, x + 8, h + 1, z + 8));
    this.add(box(1.5, 11, 1.5, 0x839393, x - 12, h + 5, z - 12));
  }
  private container(x: number, z: number, color: number) {
    this.solid(box(5, 3.5, 17, color, x, 1.95, z));
    for (let n = -7; n <= 7; n += 1.5)
      for (const side of [-1, 1])
        this.add(box(0.1, 3.3, 0.15, 0xa3aaa0, x + side * 2.55, 1.95, z + n));
    this.add(box(5.3, 0.2, 17.2, 0x627778, x, 3.8, z));
  }
  tree(x: number, z: number, size = 3.8) {
    this.add(box(0.5, size, 0.5, 0x846e54, x, size / 2, z));
    for (let i = 0; i < 2; i++) {
      const m = new T.Mesh(
        new T.IcosahedronGeometry(size * (i === 0 ? 1 : 0.75), 0),
        new T.MeshStandardMaterial({
          color: i === 0 ? 0x507f60 : 0x68916a,
          roughness: 1,
        }),
      );
      m.position.set(
        x + (i === 0 ? 0 : size * 0.3),
        size * 1.35 + i * size * 0.45,
        z,
      );
      this.add(m);
    }
  }
  private bench(x: number, z: number) {
    this.add(box(4, 0.25, 1.2, 0x9f7c54, x, 0.9, z));
    this.add(box(4, 0.9, 0.18, 0x9f7c54, x, 1.4, z + 0.55));
    for (const a of [-1.5, 1.5])
      this.add(box(0.18, 0.8, 1, 0x3e565d, x + a, 0.5, z));
  }
  private park(x: number, z: number) {
    this.add(box(126, 0.15, 126, 0x70986b, x, 0.28, z));
    this.add(box(7, 0.1, 127, 0xd8c9a7, x, 0.42, z));
    this.add(box(127, 0.1, 7, 0xd8c9a7, x, 0.42, z));
    const plaza = new T.Mesh(
      new T.CylinderGeometry(16, 16, 0.2, 32),
      new T.MeshStandardMaterial({ color: 0xc6b99e }),
    );
    plaza.position.set(x, 0.47, z);
    this.add(plaza);
    const fountain = new T.Mesh(
      new T.CylinderGeometry(10, 10, 0.7, 32),
      new T.MeshStandardMaterial({ color: 0xc3c7b5 }),
    );
    fountain.position.set(x, 0.85, z);
    this.add(fountain);
    const water = new T.Mesh(
      new T.CylinderGeometry(9, 9, 0.08, 32),
      new T.MeshStandardMaterial({
        color: 0x72b9bd,
        roughness: 0.18,
        metalness: 0.4,
      }),
    );
    water.position.set(x, 1.23, z);
    this.add(water);
    this.add(box(1, 3, 1, 0xc9d5cc, x, 1.8, z));
    for (const a of [-1, 1])
      for (const b of [-1, 1])
        for (let n = 0; n < 5; n++) {
          const tx = x + a * (23 + this.rand() * 30),
            tz = z + b * (23 + this.rand() * 30);
          if (!(tx > 25 && tx < 55 && tz > 48 && tz < 84))
            this.tree(tx, tz, 3 + this.rand() * 2);
        }
    for (const a of [-1, 1]) {
      this.bench(x + a * 20, z + 8);
      this.bench(x + 8, z + a * 25);
    }
    for (const a of [-1, 1])
      for (const b of [-1, 1]) {
        const planter = box(9, 0.8, 9, 0x9da58d, x + a * 52, 0.6, z + b * 52);
        this.add(planter);
        this.add(box(7.5, 0.12, 7.5, 0x645844, x + a * 52, 1.05, z + b * 52));
        for (let n = 0; n < 16; n++) {
          const fx = x + a * 52 + (this.rand() - 0.5) * 6,
            fz = z + b * 52 + (this.rand() - 0.5) * 6;
          this.add(box(0.08, 0.4, 0.08, 0x507a4c, fx, 1.3, fz));
          const flower = new T.Mesh(
            new T.IcosahedronGeometry(0.25, 0),
            new T.MeshStandardMaterial({ color: n % 2 ? 0xe6b359 : 0xc4777b }),
          );
          flower.position.set(fx, 1.55, fz);
          this.add(flower);
        }
      }
  }
  private facilities() {
    this.sign("METRO MOTORS / 판매점", 18, 180);
    this.sign("GARAGE / 내 차고", 18, 65);
    this.sign("CENTRAL / 센트럴", -18, -175);
    this.sign("EAST WORKS / 산업 지구", 175, 175);
    // Small facilities alongside the park leave the starting position and all mission markers clear.
    this.solid(box(15, 5, 18, 0x839c94, 39, 2.7, 67));
    this.add(box(17, 0.7, 20, 0x334f5d, 39, 5.5, 67));
    this.add(box(0.1, 3.6, 11, 0x2a4858, 31.4, 2.1, 67));
    const garageSign = new T.Mesh(
      new T.PlaneGeometry(12, 2),
      signMaterial("METRO GARAGE", "#1a4049"),
    );
    garageSign.rotation.y = -Math.PI / 2;
    garageSign.position.set(31.35, 5, 67);
    this.add(garageSign);
  }
  sign(text: string, x: number, z: number) {
    const m = new T.Mesh(new T.PlaneGeometry(11, 2.1), signMaterial(text));
    m.position.set(x, 5.7, z);
    this.add(m);
    this.add(box(0.16, 5, 0.16, 0x557074, x, 2.5, z));
  }
  private roadFurniture() {
    for (const x of roads)
      for (const z of roads) {
        this.add(box(0.24, 7, 0.24, 0x3b535c, x + 13.2, 3.5, z + 13.2));
        this.add(box(3.5, 0.18, 0.3, 0x3b535c, x + 11.5, 7, z + 13.2));
        const signal = box(0.7, 1.8, 0.65, 0x283f4b, x + 13.2, 5.6, z + 13.2);
        this.add(signal);
        const light = box(0.4, 0.4, 0.08, 0x76dfb5, x + 13.2, 5.25, z + 13.57);
        (light.material as T.MeshStandardMaterial).emissive.setHex(0x4df1aa);
        this.scene.add(light);
        this.signals.push({ mesh: light, x, z });
      }
    for (const r of roads)
      for (let n = -360; n <= 360; n += 80) {
        for (const side of [-1, 1]) {
          const x = r + side * 14.7,
            z = n + 28;
          this.add(box(0.24, 8, 0.24, 0x465d65, x, 4, z));
          this.add(box(3, 0.2, 0.25, 0x465d65, x - side * 1.4, 8, z));
          const bulb = box(1, 0.12, 0.6, 0xffe6b4, x - side * 2.7, 8, z);
          (bulb.material as T.MeshStandardMaterial).dispose();
          bulb.material = this.visuals.bulb;
          this.add(bulb);
          this.visuals.lamp(x - side * 2.7, z);
        }
      }
  }
  /** Merge per material and district-sized chunk; culling remains useful when looking down a street. */
  private batch() {
    const groups = new Map<
      string,
      { parts: T.BufferGeometry[]; material: T.Material; cast: boolean }
    >();
    for (const m of this.batches) {
      const mat = m.material as T.MeshStandardMaterial;
      const key = [
        Math.floor((m.position.x + 400) / 160),
        Math.floor((m.position.z + 400) / 160),
        mat.color?.getHexString(),
        mat.map?.uuid,
        mat.emissiveMap?.uuid,
        mat.emissive?.getHexString(),
        mat.roughness,
        mat.metalness,
        m.castShadow,
      ].join("/");
      let group = groups.get(key);
      if (!group) {
        group = { parts: [], material: mat, cast: m.castShadow };
        groups.set(key, group);
      } else if (group.material !== mat) mat.dispose();
      m.updateMatrix();
      group.parts.push(m.geometry.clone().applyMatrix4(m.matrix));
      this.scene.remove(m);
      m.geometry.dispose();
    }
    for (const group of groups.values()) {
      const geometry = mergeGeometries(group.parts);
      group.parts.forEach((g) => g.dispose());
      if (!geometry) continue;
      const mesh = new T.Mesh(geometry, group.material);
      mesh.castShadow = group.cast;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
    this.batches = [];
  }
  districtAt(p: T.Vector3) {
    return p.x > 160
      ? "이스트 산업 지구"
      : p.x > 0 && p.x < 160 && p.z > 0 && p.z < 160
        ? "그린 파크"
        : p.x < 0 && p.z > 0
          ? "메트로 주택가"
          : p.x > 0
            ? "메트로 상업 지구"
            : "센트럴 도심";
  }
  blocked(p: T.Vector3, r: number) {
    return (
      Math.abs(p.x) > 396 ||
      Math.abs(p.z) > 396 ||
      this.solids.some(
        (b) =>
          p.x > b.min.x - r &&
          p.x < b.max.x + r &&
          p.z > b.min.z - r &&
          p.z < b.max.z + r,
      )
    );
  }
  move(p: T.Vector3, dx: number, dz: number, r: number) {
    const q = p.clone();
    q.x += dx;
    if (!this.blocked(q, r)) p.x = q.x;
    q.copy(p);
    q.z += dz;
    if (!this.blocked(q, r)) p.z = q.z;
    return Math.abs(p.x - q.x) < 0.01;
  }
  update(dt: number, target: T.Vector3) {
    if (!this.timeFrozen) this.time = (this.time + dt * 0.025) % 24;
    this.tick += dt;
    const { day, dusk } = this.visuals.update(this.time, target, dt);
    this.sun.intensity = day * (2.8 + dusk * 0.7);
    this.sun.color.setHex(dusk > 0.15 ? 0xffc498 : 0xffedcc);
    this.ambient.intensity = 0.85 + day * 1.1;
    this.moon.intensity = (1 - day) * 1.1;
    this.ambient.color.setHex(day > 0.3 ? 0xd2eaff : 0x7d9dc4);
    const phase = ((this.time - 6) / 12) * Math.PI;
    this.sun.position
      .copy(target)
      .add(
        new T.Vector3(
          Math.cos(phase) * 180,
          Math.max(30, Math.sin(phase) * 200),
          -100,
        ),
      );
    this.sun.target.position.copy(target);
    this.sun.target.updateMatrixWorld();
    for (const s of this.signals) {
      const green = Math.floor(this.tick / 6) % 2 === 0;
      const mat = s.mesh.material as T.MeshStandardMaterial;
      mat.color.setHex(green ? 0x75deb0 : 0xe87569);
      mat.emissive.setHex(green ? 0x36c887 : 0xe04f42);
    }
  }
}
