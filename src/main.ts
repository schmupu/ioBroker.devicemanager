/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import type { ifruleset } from './lib/rules';
import { Rulesets } from './lib/rules';

// Load your modules here, e.g.:
// import * as fs from "fs";

/**
 * Wait (sleep) x seconds
 *
 * @param seconds time in seconds
 * @returns void
 */
export function wait(seconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * Error Message
 *
 * @param error error
 * @returns Message
 */
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

class Devicemanager extends utils.Adapter {
    private rulessets: Rulesets | undefined;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'devicemanager',
        });
        this.on('ready', this.onReady.bind(this));
        // this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        if (!this.config.simulation) {
            this.log.info(`Starting Adapter ${this.namespace} in version ${this.version}`);
        } else {
            this.log.info(`Starting Adapter ${this.namespace} in version ${this.version} in simulation mode`);
        }
        const coordinate = await this.getCoordnatesAsync();
        if (!this.rulessets) {
            this.rulessets = new Rulesets(coordinate, this);
            await this.rulessets.listenStates();
        }
        const rules = await this.getStatesOfAsync(`${this.namespace}.rules`);
        for (const rule of rules) {
            if (rule._id.endsWith('ruleset')) {
                try {
                    const regel = (await this.getForeignStateAsync(rule._id))?.val?.toString();
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
    private onUnload(callback: () => void): void {
        try {
            callback();
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    /**
     * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
     * Using this method requires "common.messagebox" property to be set to true in io-package.json
     *
     * @param obj ivhwxr
     */
    private async onMessage(obj: ioBroker.Message): Promise<void> {
        if (!this.rulessets) {
            const coordinate = await this.getCoordnatesAsync();
            this.rulessets = this.rulessets ? this.rulessets : new Rulesets(coordinate, this);
            await this.rulessets.listenStates();
        }
        if (typeof obj === 'object' && obj.message) {
            switch (obj.command) {
                case 'add': {
                    if (obj.message) {
                        this.log.info(`Add Rule : ${obj.message.rulename}`);
                        await this.addObjectAsync(obj.message);
                        await this.rulessets.add(obj.message);
                    }
                    this.sendTo(obj.from, obj.command, `Add Rule ${obj.message.rulename}`, obj.callback);
                    break;
                }
                case 'delete': {
                    const rulename = typeof obj.message === 'string' ? obj.message : obj.message.rulename;
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

    private async getCoordnatesAsync(): Promise<{ latitude: number; longitude: number }> {
        try {
            const states: any = await this.getForeignObjectAsync('system.config');
            if (
                states &&
                states.common &&
                states.common.latitude !== undefined &&
                states.common.longitude !== undefined
            ) {
                return { latitude: states.common.latitude, longitude: states.common.longitude };
            }
            throw new Error(`Could not get coordinates!`);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            throw new Error(`Could not get coordinates!`);
        }
    }

    private async deleteObjectAsync(rulename: string): Promise<void> {
        try {
            const id =
                rulename === '*'
                    ? `${this.namespace}.rules`
                    : `${this.namespace}.rules.${rulename.replace(/[^0-9a-zA-Z]/g, '')}`;
            await this.delObjectAsync(id, { recursive: true });
        } catch (err) {
            this.log.error(`Error deleting Objects in ${rulename}: ${getErrorMessage(err)}`);
        }
    }

    private async addObjectAsync(ruleset: ifruleset): Promise<void> {
        try {
            const id = `${this.namespace}.rules.${ruleset.rulename.replace(/[^0-9a-zA-Z]/g, '')}`;
            await this.setObjectNotExistsAsync(`${id}.rulename`, {
                type: 'state',
                common: {
                    name: `${ruleset.rulename} - Rulename`,
                    type: 'string',
                    role: 'value',
                    read: true,
                    write: false,
                },
                native: {},
            });
            await this.setState(`${id}.rulename`, { val: ruleset.rulename, ack: true });
            await this.setObjectNotExistsAsync(`${id}.active`, {
                type: 'state',
                common: {
                    name: `${ruleset.rulename} - Active`,
                    type: 'boolean',
                    role: 'value',
                    read: true,
                    write: true,
                },
                native: {},
            });
            await this.setState(`${id}.active`, { val: ruleset.active, ack: true });
            await this.setObjectNotExistsAsync(`${id}.ruleset`, {
                type: 'state',
                common: {
                    name: `${ruleset.rulename} - Ruleset`,
                    type: 'string',
                    role: 'value',
                    read: true,
                    write: true,
                },
                native: {},
            });
            await this.setState(`${id}.ruleset`, { val: JSON.stringify(ruleset), ack: true });
            await this.setObjectNotExistsAsync(`${id}.rule`, {
                type: 'state',
                common: {
                    name: `${ruleset.rulename} - Rule`,
                    type: 'string',
                    role: 'value',
                    read: true,
                    write: false,
                },
                native: {},
            });
            await this.setObjectNotExistsAsync(`${id}.value`, {
                type: 'state',
                common: {
                    name: `${ruleset.rulename} - Value`,
                    type: 'mixed',
                    role: 'value',
                    read: true,
                    write: false,
                },
                native: {},
            });
            await this.setObjectNotExistsAsync(`${id}.id`, {
                type: 'state',
                common: {
                    name: `${ruleset.rulename} - Id`,
                    type: 'string',
                    role: 'value',
                    read: true,
                    write: false,
                },
                native: {},
            });
            await this.setObjectNotExistsAsync(`${id}.query`, {
                type: 'state',
                common: {
                    name: `${ruleset.rulename} - Sandbox Query`,
                    type: 'string',
                    role: 'value',
                    read: true,
                    write: false,
                },
                native: {},
            });
            await this.setObjectNotExistsAsync(`${id}.context`, {
                type: 'state',
                common: {
                    name: `${ruleset.rulename} - Sandbox Context`,
                    type: 'string',
                    role: 'value',
                    read: true,
                    write: false,
                },
                native: {},
            });
        } catch (err) {
            this.log.error(`Error creating Objects in ${ruleset.rulename}: ${getErrorMessage(err)}`);
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Devicemanager(options);
} else {
    // otherwise start the instance directly
    (() => new Devicemanager())();
}
