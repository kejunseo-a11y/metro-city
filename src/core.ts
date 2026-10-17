import * as T from "three";
export const roads = [-320, -160, 0, 160, 320];
export const v = (x = 0, z = 0) => new T.Vector3(x, 0, z);
export function box(
  w: number,
  h: number,
  d: number,
  color: number,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = new T.Mesh(
    new T.BoxGeometry(w, h, d),
    new T.MeshStandardMaterial({ color, roughness: 0.8 }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
export function human(color = 0x39b7b0) {
  const g = new T.Group();
  g.add(
    box(0.65, 1, 0.4, color, 0, 1.35),
    box(0.46, 0.46, 0.46, 0xe6b58d, 0, 2.12),
  );
  const legs = [
    box(0.24, 0.85, 0.26, 0x202e44, -0.2, 0.45),
    box(0.24, 0.85, 0.26, 0x202e44, 0.2, 0.45),
  ];
  const arms = [
    box(0.2, 0.9, 0.23, color, -0.47, 1.3),
    box(0.2, 0.9, 0.23, color, 0.47, 1.3),
  ];
  g.add(...legs, ...arms);
  g.userData.limbs = [...legs, ...arms];
  return g;
}
export function animate(g: T.Group, t: number, speed: number) {
  (g.userData.limbs || []).forEach(
    (m: T.Mesh, i: number) =>
      (m.rotation.x =
        Math.sin(t * 9 + (i % 2) * Math.PI) * Math.min(speed * 0.15, 0.65)),
  );
}
export function angle(a: number, b: number) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}
export const nearest = (n: number) =>
  roads.reduce((a, b) => (Math.abs(n - a) < Math.abs(n - b) ? a : b));
