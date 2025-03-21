"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var holiday_exports = {};
__export(holiday_exports, {
  Holidays: () => Holidays
});
module.exports = __toCommonJS(holiday_exports);
var import_axios = __toESM(require("axios"));
var sched = __toESM(require("node-schedule"));
class Holidays {
  static holdiays;
  static schedjob;
  /**
   * Contructor
   *
   * @param state state like HH
   * @param year year like 2025
   */
  constructor() {
  }
  /**
   *  set Holidays
   */
  static async setHolidaysSet() {
    const year = (/* @__PURE__ */ new Date()).getFullYear().toString();
    const url = `https://ipty.de/feiertag/api.php?do=getFeiertage&jahr=${year}&outformat=Y-m-d`;
    const response = await import_axios.default.get(url);
    if (response == null ? void 0 : response.data) {
      this.holdiays = response.data;
    }
  }
  /**
   * holiday today?
   *
   * @param state state like HH
   * @returns bolean
   */
  static isHolidayToday(state) {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    if (this.holdiays) {
      return this.holdiays.some((holiday) => holiday.date === today && holiday.locs.includes(state));
    }
    return false;
  }
  /**
   * Poll once the year the noew holiday calender
   */
  static pollHolidays() {
    if (this.schedjob) {
      sched.cancelJob(this.schedjob);
    }
    this.schedjob = sched.scheduleJob("1 0 * * *", async () => {
      await this.setHolidaysSet();
    });
  }
  /**
   * Get all holidays
   *
   * @returns holidays
   */
  static getHolidays() {
    return this.holdiays;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Holidays
});
//# sourceMappingURL=holiday.js.map
