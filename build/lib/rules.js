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
var rules_exports = {};
__export(rules_exports, {
  Rulesets: () => Rulesets,
  wait: () => wait
});
module.exports = __toCommonJS(rules_exports);
var import_node_vm = __toESM(require("node:vm"));
var import_suncalc = __toESM(require("suncalc"));
var import_holiday = require("./holiday");
function wait(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1e3));
}
function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
class Ruleset {
  ruleset;
  latitude;
  longitude;
  adapter;
  /**
   * Constructor
   *
   * @param ruleset
   * @param coordinate
   * @param adapter
   */
  constructor(ruleset, coordinate, adapter) {
    this.adapter = adapter;
    this.ruleset = ruleset;
    this.ruleset.value = {};
    this.latitude = coordinate.latitude;
    this.longitude = coordinate.longitude;
  }
  async checkRuleSet() {
    let ret = true;
    if (!this.ruleset.active) {
      return true;
    }
    for (const time of this.ruleset.times) {
    }
    for (const state of this.ruleset.states) {
      const obj = await this.adapter.getForeignObjectAsync(state.id);
      if (!obj) {
        this.adapter.log.error(
          `Could not find state id ${state.id} for ${state.name}, ${this.ruleset.rulename}`
        );
        ret = false;
      }
    }
    for (const rule of this.ruleset.rules) {
      const ids = typeof rule.id === "string" ? [rule.id] : rule.id;
      for (const id of ids) {
        const obj = await this.adapter.getForeignObjectAsync(id);
        if (!obj) {
          this.adapter.log.error(`Could not find rule id ${id} for ${rule.name}, ${this.ruleset.rulename}`);
          ret = false;
        }
      }
    }
    return ret;
  }
  delSonderzeichen(text) {
    return text.trim().replace(/(\r\n|\n|\r|\t|\s)/g, "");
  }
  isHoliday(weekdays) {
    const holiday = import_holiday.Holidays.isHolidayToday(this.adapter.config.holiday);
    const weekdaysarray = this.delSonderzeichen(weekdays).split(",");
    return weekdaysarray.includes("Hd") && holiday;
  }
  /**
   * is weekday
   *
   * @param weekdays for Excample Sa. So, ....
   * @returns
   */
  inWeekday(weekdays) {
    const now = /* @__PURE__ */ new Date();
    const day = now.getDay();
    const weekdaynow = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][day];
    const weekdaysarray = this.delSonderzeichen(weekdays).split(",");
    return weekdaysarray.includes(weekdaynow);
  }
  /**
   * Is time between hh:mm and hh:mm
   * Excmple 10:00,12:00,11:00 => true
   * Example 10:00,12:00,08:00 => false
   *
   * @param startTime time hh:mm
   * @param endTime time hh:mm
   * @param time time hh:mm
   * @returns true or false
   */
  isTimeBetween(startTime, endTime, time) {
    const toSeconds = (t) => {
      const [hours = 0, minutes = 0, seconds = 0] = t.split(":").map(Number);
      return hours * 3600 + minutes * 60 + seconds;
    };
    if (!time) {
      const now = /* @__PURE__ */ new Date();
      time = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }
    const timeSeconds = toSeconds(time);
    const startSeconds = toSeconds(startTime);
    const endSeconds = toSeconds(endTime);
    return timeSeconds >= startSeconds && timeSeconds <= endSeconds;
  }
  /**
   * Seconds to array hours, minutes, seconds
   *
   * @param seconds
   * @returns
   */
  secToTimeArray(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    const second = seconds % 60;
    return [hours, minutes, second];
  }
  /**
   * hours, minutes, seconds to timestring HH:MM:SS
   *
   * @param hours hours
   * @param minutes minutes
   * @param seconds seconds
   */
  getTimeString(hours, minutes, seconds) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  /**
   * Time between a range. Example 10:00,20:00 => 12:45
   *
   * @param timeRange timestring hh:mm,hh:mm
   * @returns time hh:mm
   */
  getRandomTimeBetween(timeRange) {
    if (!timeRange.includes(",")) {
      return timeRange;
    }
    const [start, end] = timeRange.split(",").map((time) => {
      time = this.addOrSubtractTime(time);
      const [hours2 = 0, minutes2 = 0, seconds2 = 0] = time.split(":").map(Number);
      return hours2 * 3600 + minutes2 * 60 + seconds2;
    });
    const randomSeconds = Math.floor(Math.random() * (end - start + 1)) + start;
    const [hours, minutes, seconds] = this.secToTimeArray(randomSeconds);
    return this.getTimeString(hours, minutes, seconds);
  }
  /**
   * Add subtract timestring hh:mm+hh:mm or hh:mm-hh:mm
   *
   * @param time hh:mm or hh:mm+hh:mm or hh:mm-hh:mm
   * @returns hh:mm
   */
  addOrSubtractTime(time) {
    let time1 = "";
    let time2 = "";
    let operation = void 0;
    if (time.includes("+")) {
      operation = "+";
      [time1, time2] = time.split("+").map(String);
    }
    if (time.includes("-")) {
      operation = "-";
      [time1, time2] = time.split("-").map(String);
    }
    if (operation === void 0) {
      return this.getTimefromSuncalc(time);
    }
    const [h1 = 0, m1 = 0, s1 = 0] = this.getTimefromSuncalc(time1).split(":").map(Number);
    const [h2 = 0, m2 = 0, s2 = 0] = this.getTimefromSuncalc(time2).split(":").map(Number);
    let totalSeconds = h1 * 3600 + m1 * 60 + s1;
    const secondsToAddOrSubtract = h2 * 3600 + m2 * 60 + s2;
    totalSeconds = operation === "+" ? totalSeconds + secondsToAddOrSubtract : totalSeconds - secondsToAddOrSubtract;
    totalSeconds = (totalSeconds + 86400) % 86400;
    const [hours, minutes, seconds] = this.secToTimeArray(totalSeconds);
    return this.getTimeString(hours, minutes, seconds);
  }
  /**
   * Suncalc, Example: sunrise => 07:01
   *
   * @param time sunrise, sunset, ...
   * @returns time as hh:mm:ss
   */
  getTimefromSuncalc(time) {
    try {
      const suncalc = import_suncalc.default.getTimes(/* @__PURE__ */ new Date(), this.latitude, this.longitude);
      const suncalctime = suncalc[time];
      return suncalctime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch (err) {
      return time;
    }
  }
  /**
   * Checks if time rule is true / or false
   *
   * @param timename name of the time rule
   * @returns boolean
   */
  checkTIme(timename) {
    const timerule = this.ruleset.times.find((item) => item.name === timename);
    if (!timerule) {
      return false;
    }
    const inweekday = this.inWeekday(timerule.weekday);
    const isholiday = this.isHoliday(timerule.weekday);
    const intime = this.isTimeBetween(
      this.getRandomTimeBetween(timerule.from),
      this.getRandomTimeBetween(timerule.to)
    );
    return (inweekday || isholiday) && intime;
  }
  /**
   * Delay in seconds 00:00:05,00:00:10 -> 6
   *
   * @param time  like 00:00:05,00:00:10
   * @returns seconds
   */
  delayInSeconds(time) {
    const randomDelayTime = this.getRandomTimeBetween(time);
    const [h = 0, m = 0, s = 0] = randomDelayTime.split(":").map(Number);
    const totalSeconds = h * 3600 + m * 60 + s;
    return totalSeconds;
  }
  /**
   * if two objects, numbers, arrays are equal
   *
   * @param a any kind of object, number, string
   * @param b any kind of object, number, string
   * @returns boolean
   */
  isEquivalent(a, b) {
    if (typeof a === "object" && typeof b === "object") {
      const aProps = Object.getOwnPropertyNames(a);
      const bProps = Object.getOwnPropertyNames(b);
      if (aProps.length != bProps.length) {
        return false;
      }
      for (let i = 0; i < aProps.length; i++) {
        const propName = aProps[i];
        if (a[propName] !== b[propName]) {
          return false;
        }
      }
      return true;
    }
    return a == b ? true : false;
  }
  unregisterStates() {
    for (const state of this.ruleset.states) {
      this.adapter.unsubscribeForeignStates(state.id);
      state.value = void 0;
      state.valueold = void 0;
    }
  }
  async registeStates() {
    for (const state of this.ruleset.states) {
      if (this.ruleset.active) {
        const found = this.ruleset.rules.find((rule) => rule.query.search(`${state.name}.`) >= 0) !== void 0;
        if (found) {
          state.value = (await this.adapter.getForeignStateAsync(state.id)).val;
          state.ack = (await this.adapter.getForeignStateAsync(state.id)).ack;
          this.adapter.log.info(`Subscribe Id ${state.id}`);
          this.adapter.subscribeForeignStates(state.id);
        }
      }
    }
  }
  async sandbox() {
    const context = {};
    if (!this.ruleset.active) {
      return;
    }
    for (const time of this.ruleset.times) {
      context[time.name] = {
        v: time.value,
        ov: time.valueold
      };
    }
    for (const state of this.ruleset.states) {
      context[state.name] = {
        v: state.cmpvalue !== void 0 ? this.isEquivalent(state.value, state.cmpvalue) : state.value,
        ov: state.cmpvalue !== void 0 ? this.isEquivalent(state.valueold, state.cmpvalue) : state.valueold,
        a: state.ack,
        oa: state.ackold
      };
    }
    for (const rule of this.ruleset.rules) {
      try {
        const result = import_node_vm.default.runInNewContext(rule.query, context);
        if (result) {
          if (rule.name === this.ruleset.value.name) {
            return;
          }
          this.ruleset.value.name = rule.name;
          const delay = rule.delay === void 0 ? 0 : this.delayInSeconds(rule.delay);
          const ids = typeof rule.id === "string" ? [rule.id] : rule.id;
          for (const id of ids) {
            if (delay > 0) {
              this.adapter.log.info(
                `${this.ruleset.rulename} : Plan Set ${rule.name}, ${id} value to ${rule.value} in ${delay} seconds`
              );
            }
            this.adapter.clearTimeout(this.ruleset.value.timeout);
            this.ruleset.value.timeout = this.adapter.setTimeout(async () => {
              const statevalue = (await this.adapter.getForeignStateAsync(id)).val;
              const stateack = (await this.adapter.getForeignStateAsync(id)).ack;
              if (!this.adapter.config.simulation) {
                this.adapter.log.info(
                  `${this.ruleset.rulename} : Set ${rule.name}, ${id} value change from ${statevalue} to ${rule.value} (${stateack} to false)`
                );
                await this.adapter.setForeignStateAsync(id, { val: rule.value, ack: false });
              } else {
                this.adapter.log.info(
                  `${this.ruleset.rulename} : Simulation Set ${rule.name}, ${id} value change from ${statevalue} to ${rule.value} (${stateack} to false)`
                );
              }
            }, delay * 1e3);
            await this.setStates({
              name: rule.name,
              id,
              value: rule.value,
              query: rule.query,
              context
            });
          }
          return;
        }
      } catch (err) {
        this.adapter.log.error(`Error in ${this.ruleset.rulename}: ${getErrorMessage(err)}`);
      }
    }
    this.adapter.log.debug(`${this.ruleset.rulename} : No rule found. Nothing will be changed.`);
  }
  setRuleTime() {
    for (const time of this.ruleset.times) {
      time.valueold = time.value;
      time.value = this.checkTIme(time.name);
      this.adapter.log.debug(
        `${this.ruleset.rulename} : ${time.name} - new in time: ${time.value}, old in time: ${time.valueold}`
      );
    }
  }
  setRuleStates(id, statechange) {
    if (!id || !statechange || !this.ruleset.active) {
      return;
    }
    const state = this.ruleset.states.find((item) => item.id === id);
    if (!state) {
      return;
    }
    state.valueold = state.value;
    state.value = statechange.val;
    state.ackold = state.ack;
    state.ack = statechange.ack;
    this.adapter.log.debug(
      `${this.ruleset.rulename} : ${state.name} - new state: ${state.value} (${state.ack}), old state: ${state.valueold} (${state.ackold})`
    );
  }
  async setStates(result) {
    try {
      const id = `${this.adapter.namespace}.rules.${this.ruleset.rulename.replace(/[^0-9a-zA-Z]/g, "")}`;
      await this.adapter.setState(`${id}.rule`, { val: result.name, ack: true });
      await this.adapter.setState(`${id}.value`, { val: result.value, ack: true });
      await this.adapter.setState(`${id}.id`, { val: result.id, ack: true });
      await this.adapter.setState(`${id}.query`, { val: result.query, ack: true });
      const context = typeof result.context === "object" ? JSON.stringify(result.context) : result.context.toString();
      await this.adapter.setState(`${id}.context`, { val: context, ack: true });
    } catch (err) {
      this.adapter.log.error(`Error setting States in ${this.ruleset.rulename}: ${getErrorMessage(err)}`);
    }
  }
}
class Rulesets {
  adapter;
  coordinate;
  rulesets;
  constructor(coordinate, adapter) {
    this.adapter = adapter;
    this.coordinate = coordinate;
    this.rulesets = [];
  }
  async add(rule) {
    this.del(rule.rulename);
    const ruleset = new Ruleset(rule, this.coordinate, this.adapter);
    this.adapter.log.info(`Add ruleset ${rule.rulename}`);
    if (await ruleset.checkRuleSet()) {
      this.rulesets.push({
        rulename: rule.rulename,
        ruleset
      });
      await ruleset.registeStates();
      ruleset.setRuleTime();
      await ruleset.sandbox();
    }
  }
  del(rulename) {
    if (this.rulesets.length <= 0) {
      return;
    }
    if (rulename === "*") {
      this.adapter.log.info(`Delete all rulesets`);
      this.rulesets = [];
    } else {
      const index = this.rulesets.findIndex((item) => item.rulename === rulename);
      if (index >= 0) {
        this.adapter.log.info(`Delete ruleset ${rulename}`);
        this.rulesets.splice(index, 1);
      }
    }
  }
  exist(rulname) {
    const ruleset = this.rulesets.find((item) => item.rulename === rulname);
    return ruleset ? true : false;
  }
  async listenStates() {
    await import_holiday.Holidays.setHolidaysSet();
    import_holiday.Holidays.pollHolidays();
    this.adapter.log.debug(`Listen to state changes`);
    this.adapter.on("stateChange", async (id, statechange) => {
      for (const ruleset of this.rulesets) {
        ruleset.ruleset.setRuleStates(id, statechange);
        ruleset.ruleset.setRuleTime();
        await ruleset.ruleset.sandbox();
        this.adapter.log.debug(
          `${ruleset.rulename} : Event called for ${id}, ${statechange.val} (ack = ${statechange.ack})`
        );
      }
    });
    this.adapter.log.debug(`Schedule state changes`);
    const schedule = async (delay) => {
      for (const ruleset of this.rulesets) {
        ruleset.ruleset.setRuleTime();
        await ruleset.ruleset.sandbox();
        this.adapter.log.debug(`${ruleset.rulename} : Time scheduler called`);
      }
      this.adapter.setTimeout(async () => await schedule(delay), delay * 1e3);
    };
    await schedule(this.adapter.config.pollInterval);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Rulesets,
  wait
});
//# sourceMappingURL=rules.js.map
