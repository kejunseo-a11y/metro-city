import * as T from "three";

/** Generated locally: no external images, downloads, or asset licenses. */
export function canvasTexture(
  draw: (c: CanvasRenderingContext2D) => void,
  w = 128,
  h = 128,
) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d")!);
  const t = new T.CanvasTexture(canvas);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
export function windowMaterial(style: "office" | "home" | "shop") {
  const map = canvasTexture((c) => {
    c.clearRect(0, 0, 128, 128);
    for (let x = 0; x < 2; x++)
      for (let y = 0; y < 2; y++) {
        const px = x * 64 + 11,
          py = y * 64 + 12;
        c.fillStyle = "#192c3e";
        c.fillRect(px - 3, py - 3, 46, 43);
        c.fillStyle =
          style === "office"
            ? "#608f9e"
            : style === "home"
              ? "#8cabae"
              : "#7aa5a8";
        c.fillRect(px, py, 40, 37);
        c.fillStyle = "#c8e3df";
        c.globalAlpha = 0.25;
        c.fillRect(px + 2, py + 2, 36, 4);
        c.globalAlpha = 1;
        c.fillStyle = "#263c4c";
        c.fillRect(px + 19, py, 2, 37);
      }
  });
  const emission = canvasTexture((c) => {
    c.fillStyle = "#000";
    c.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 2; x++)
      for (let y = 0; y < 2; y++) {
        c.fillStyle = (x + y) % 3 === 0 ? "#f5bc6e" : "#b6e9ec";
        if (!(x === 1 && y === 0)) c.fillRect(x * 64 + 11, y * 64 + 12, 40, 37);
      }
  });
  return new T.MeshStandardMaterial({
    map,
    emissiveMap: emission,
    emissive: 0xffffff,
    emissiveIntensity: 0,
    alphaTest: 0.3,
    roughness: 0.3,
    metalness: 0.2,
  });
}
export function signMaterial(text: string, bg = "#173744", fg = "#f9e9c6") {
  const map = canvasTexture(
    (c) => {
      c.fillStyle = bg;
      c.fillRect(0, 0, 512, 96);
      c.fillStyle = fg;
      c.fillRect(10, 83, 492, 3);
      c.font = "bold 31px sans-serif";
      c.textAlign = "center";
      c.fillText(text, 256, 61);
    },
    512,
    96,
  );
  map.wrapS = map.wrapT = T.ClampToEdgeWrapping;
  return new T.MeshStandardMaterial({
    map,
    emissiveMap: map,
    emissive: 0xffffff,
    emissiveIntensity: 0.4,
    roughness: 0.7,
  });
}
export class Atmosphere {
  sky: T.Mesh;
  windows = [
    windowMaterial("office"),
    windowMaterial("home"),
    windowMaterial("shop"),
  ];
  glowTexture = canvasTexture((c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,223,150,.65)");
    g.addColorStop(0.2, "rgba(255,202,110,.18)");
    g.addColorStop(1, "rgba(255,195,90,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
  glows: T.Sprite[] = [];
  bulb = new T.MeshStandardMaterial({
    color: 0xffe6b4,
    emissive: 0xffc676,
    emissiveIntensity: 0,
  });
  pools: T.Mesh[] = [];
  lights: T.PointLight[] = [];
  elapsed = 0;
  constructor(public scene: T.Scene) {
    this.sky = new T.Mesh(
      new T.SphereGeometry(850, 24, 12),
      new T.ShaderMaterial({
        side: T.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new T.Color(0x6aa9ca) },
          horizon: { value: new T.Color(0xe9d9b7) },
        },
        vertexShader:
          "varying vec3 dir; void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader:
          "uniform vec3 top;uniform vec3 horizon;varying vec3 dir;void main(){float h=pow(max(normalize(dir).y,0.0),0.55);gl_FragColor=vec4(mix(horizon,top,h),1.0);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
      }),
    );
    // Shader includes have to start on their own line.
    (this.sky.material as T.ShaderMaterial).fragmentShader = (
      this.sky.material as T.ShaderMaterial
    ).fragmentShader.replace(";#include", ";\n#include");
    this.sky.renderOrder = -100;
    scene.add(this.sky);
    for (let i = 0; i < 6; i++) {
      const light = new T.PointLight(0xffcc8a, 0, 24, 2);
      light.position.y = 7;
      scene.add(light);
      this.lights.push(light);
    }
  }
  lamp(x: number, z: number) {
    const glow = new T.Sprite(
      new T.SpriteMaterial({
        map: this.glowTexture,
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
        opacity: 0,
      }),
    );
    glow.position.set(x, 8, z);
    glow.scale.set(8, 8, 1);
    this.scene.add(glow);
    this.glows.push(glow);
    const pool = new T.Mesh(
      new T.PlaneGeometry(18, 18),
      new T.MeshBasicMaterial({
        map: this.glowTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.115, z);
    this.scene.add(pool);
    this.pools.push(pool);
  }
  update(time: number, target: T.Vector3, dt: number) {
    this.elapsed += dt;
    const day = T.MathUtils.smoothstep(
      Math.sin(((time - 6) / 12) * Math.PI),
      -0.12,
      0.5,
    );
    const dusk = Math.max(0, 1 - Math.abs(time - 18) / 2.5) * day;
    const top = new T.Color(0x08112b)
      .lerp(new T.Color(0x5ca2cb), day)
      .lerp(new T.Color(0x686990), dusk * 0.65);
    const horizon = new T.Color(0x182840)
      .lerp(new T.Color(0xd0e3df), day)
      .lerp(new T.Color(0xf0bb8c), dusk * 0.85);
    const mat = this.sky.material as T.ShaderMaterial;
    mat.uniforms.top.value.copy(top);
    mat.uniforms.horizon.value.copy(horizon);
    this.sky.position.copy(target);
    const night = 1 - T.MathUtils.smoothstep(day, 0.15, 0.8);
    this.windows.forEach((m) => (m.emissiveIntensity = night * 1.25));
    this.bulb.emissiveIntensity = night * 2;
    this.glows.forEach(
      (g) => ((g.material as T.SpriteMaterial).opacity = night * 0.7),
    );
    this.pools.forEach(
      (g) => ((g.material as T.MeshBasicMaterial).opacity = night * 0.45),
    );
    if (this.elapsed > 0.35) {
      this.elapsed = 0;
      const nearby = this.glows
        .filter((g) => g.position.distanceTo(target) < 80)
        .sort(
          (a, b) =>
            a.position.distanceToSquared(target) -
            b.position.distanceToSquared(target),
        );
      this.lights.forEach((l, i) => {
        if (nearby[i]) l.position.copy(nearby[i].position);
        l.intensity = nearby[i] ? night * 65 : 0;
      });
    }
    (this.scene.fog as T.Fog).color.copy(horizon);
    return { day, night, dusk };
  }
}
