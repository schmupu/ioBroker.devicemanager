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
var main_exports = {};
__export(main_exports, {
  wait: () => wait
});
module.exports = __toCommonJS(main_exports);
var utils = __toESM(require("@iobroker/adapter-core"));
var import_rules = require("./lib/rules");
function wait(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1e3));
}
function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
class Devicemanager extends utils.Adapter {
  rulessets;
  constructor(options = {}) {
    super({
      ...options,
      name: "devicemanager"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    var _a, _b;
    if (!this.config.simulation) {
      this.log.info(`Starting Adapter ${this.namespace} in version ${this.version}`);
    } else {
      this.log.info(`Starting Adapter ${this.namespace} in version ${this.version} in simulation mode`);
    }
    const coordinate = await this.getCoordnatesAsync();
    if (!this.rulessets) {
      this.rulessets = new import_rules.Rulesets(coordinate, this);
      await this.rulessets.listenStates();
    }
    const rules = await this.getStatesOfAsync(`${this.namespace}.rules`);
    for (const rule of rules) {
      if (rule._id.endsWith("ruleset")) {
        try {
          const regel = (_b = (_a = await this.getForeignStateAsync(rule._id)) == null ? void 0 : _a.val) == null ? void 0 : _b.toString();
          if (regel) {
            await this.rulessets.add(JSON.parse(regel));
          }
        } catch (err) {
          this.log.error(`Error starting rulesets: ${getErrorMessage(err)}`);
        }
      }
    }
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   *
   * @param callback callback
   */
  onUnload(callback) {
    try {
      callback();
    } catch (e) {
      callback();
    }
  }
  /**
   * Is called if a subscribed state changes
   *
   * @param id id
   * @param state state
   */
  onStateChange(id, state) {
    if (state) {
      this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
    } else {
      this.log.info(`state ${id} deleted`);
    }
  }
  /**
   * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
   * Using this method requires "common.messagebox" property to be set to true in io-package.json
   *
   * @param obj ivhwxr
   */
  async onMessage(obj) {
    if (!this.rulessets) {
      const coordinate = await this.getCoordnatesAsync();
      this.rulessets = this.rulessets ? this.rulessets : new import_rules.Rulesets(coordinate, this);
      await this.rulessets.listenStates();
    }
    if (typeof obj === "object" && obj.message) {
      switch (obj.command) {
        case "add": {
          if (obj.message) {
            this.log.info(`Add Rule : ${obj.message.rulename}`);
            await this.addObjectAsync(obj.message);
            await this.rulessets.add(obj.message);
          }
          this.sendTo(obj.from, obj.command, `Add Rule ${obj.message.rulename}`, obj.callback);
          break;
        }
        case "delete": {
          const rulename = typeof obj.message === "string" ? obj.message : obj.message.rulename;
          this.log.info(`Delete Rule : ${rulename}`);
          this.rulessets.del(rulename);
          await this.deleteObjectAsync(rulename);
          this.sendTo(obj.from, obj.command, `Delete Rule ${rulename}`, obj.callback);
          break;
        }
        default: {
          this.sendTo(obj.from, obj.command, `Command ${obj.command} unknown`, obj.callback);
        }
      }
    } else {
      this.sendTo(obj.from, obj.command, `Command ${obj.command} unknown`, obj.callback);
    }
  }
  async getCoordnatesAsync() {
    try {
      const states = await this.getForeignObjectAsync("system.config");
      if (states && states.common && states.common.latitude !== void 0 && states.common.longitude !== void 0) {
        return { latitude: states.common.latitude, longitude: states.common.longitude };
      }
      throw new Error(`Could not get coordinates!`);
    } catch (error) {
      throw new Error(`Could not get coordinates!`);
    }
  }
  async deleteObjectAsync(rulename) {
    try {
      const id = rulename === "*" ? `${this.namespace}.rules` : `${this.namespace}.rules.${rulename.replace(/[^0-9a-zA-Z]/g, "")}`;
      await this.delObjectAsync(id, { recursive: true });
    } catch (err) {
      this.log.error(`Error deleting Objects in ${rulename}: ${getErrorMessage(err)}`);
    }
  }
  async addObjectAsync(ruleset) {
    try {
      const id = `${this.namespace}.rules.${ruleset.rulename.replace(/[^0-9a-zA-Z]/g, "")}`;
      await this.setObjectNotExistsAsync(`${id}.rulename`, {
        type: "state",
        common: {
          name: `${ruleset.rulename} - Rulename`,
          type: "string",
          role: "value",
          read: true,
          write: false
        },
        native: {}
      });
      await this.setState(`${id}.rulename`, { val: ruleset.rulename, ack: true });
      await this.setObjectNotExistsAsync(`${id}.active`, {
        type: "state",
        common: {
          name: `${ruleset.rulename} - Active`,
          type: "boolean",
          role: "value",
          read: true,
          write: true
        },
        native: {}
      });
      await this.setState(`${id}.active`, { val: ruleset.active, ack: true });
      await this.setObjectNotExistsAsync(`${id}.ruleset`, {
        type: "state",
        common: {
          name: `${ruleset.rulename} - Ruleset`,
          type: "string",
          role: "value",
          read: true,
          write: true
        },
        native: {}
      });
      await this.setState(`${id}.ruleset`, { val: JSON.stringify(ruleset), ack: true });
      await this.setObjectNotExistsAsync(`${id}.rule`, {
        type: "state",
        common: {
          name: `${ruleset.rulename} - Rule`,
          type: "string",
          role: "value",
          read: true,
          write: false
        },
        native: {}
      });
      await this.setObjectNotExistsAsync(`${id}.value`, {
        type: "state",
        common: {
          name: `${ruleset.rulename} - Value`,
          type: "mixed",
          role: "value",
          read: true,
          write: false
        },
        native: {}
      });
      await this.setObjectNotExistsAsync(`${id}.id`, {
        type: "state",
        common: {
          name: `${ruleset.rulename} - Id`,
          type: "string",
          role: "value",
          read: true,
          write: false
        },
        native: {}
      });
      await this.setObjectNotExistsAsync(`${id}.query`, {
        type: "state",
        common: {
          name: `${ruleset.rulename} - Sandbox Query`,
          type: "string",
          role: "value",
          read: true,
          write: false
        },
        native: {}
      });
      await this.setObjectNotExistsAsync(`${id}.context`, {
        type: "state",
        common: {
          name: `${ruleset.rulename} - Sandbox Context`,
          type: "string",
          role: "value",
          read: true,
          write: false
        },
        native: {}
      });
    } catch (err) {
      this.log.error(`Error creating Objects in ${ruleset.rulename}: ${getErrorMessage(err)}`);
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new Devicemanager(options);
} else {
  (() => new Devicemanager())();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  wait
});
//# sourceMappingURL=main.js.map
