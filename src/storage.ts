import { Kind } from "./vehicles";
export type Save = { money: number; owned: Kind[]; completed: string[] };
export class Storage {
  data: Save = { money: 1000, owned: ["sedan"], completed: [] };
  warning = "";
  constructor() {
    try {
      const d = JSON.parse(localStorage.getItem("metro-city-v1") || "null");
      if (
        d &&
        Number.isFinite(d.money) &&
        d.money >= 0 &&
        Array.isArray(d.owned) &&
        Array.isArray(d.completed)
      )
        this.data = {
          money: d.money,
          owned: d.owned.filter((k: string) =>
            ["sedan", "sport", "van"].includes(k),
          ),
          completed: d.completed.filter((k: unknown) => typeof k === "string"),
        };
    } catch {
      this.warning = "저장 데이터를 읽지 못했습니다.";
    }
  }
  save() {
    try {
      localStorage.setItem("metro-city-v1", JSON.stringify(this.data));
    } catch {
      this.warning = "저장 공간에 접근할 수 없습니다.";
    }
  }
}
