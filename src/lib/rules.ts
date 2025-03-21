import * as vm from 'node:vm';
import * as SunCalc from 'suncalc';
import { Holidays } from './holiday';

/**
 * Wait (sleep) x seconds
 *
 * @param seconds time in seconds
 * @returns void
 */
export function wait(seconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

export interface iftime {
    name: string;
    from: string;
    to: string;
    weekday: string;
    range?: string;
    value?: boolean;
    valueold?: boolean;
}

export interface ifstate {
    name: string;
    id: string;
    cmpvalue?: boolean;
    value?: any;
    valueold?: any;
    ack?: boolean;
    ackold?: boolean;
}

export interface ifrule {
    name: string;
    query: string;
    id: string[] | string;
    delay?: string;
    value: any;
}

export interface ifvalue {
    timeout?: ioBroker.Timeout;
    name?: string;
}

export interface ifruleset {
    rulename: string;
    active: boolean;
    times: iftime[];
    states: ifstate[];
    rules: ifrule[];
    value: ifvalue;
}

type coordinate = {
    latitude: number;
    longitude: number;
};
class Ruleset {
    private ruleset: ifruleset;
    private latitude: number;
    private longitude: number;
    private adapter: any;

    /**
     * Constructor
     *
     * @param ruleset
     * @param coordinate
     * @param adapter
     */
    public constructor(ruleset: ifruleset, coordinate: coordinate, adapter: any) {
        this.adapter = adapter;
        this.ruleset = ruleset;
        this.ruleset.value = {};
        this.latitude = coordinate.latitude;
        this.longitude = coordinate.longitude;
    }

    public async checkRuleSet(): Promise<boolean> {
        let ret = true;
        if (!this.ruleset.active) {
            return true;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const time of this.ruleset.times) {
            /* empty */
        }
        for (const state of this.ruleset.states) {
            const obj: any = await this.adapter.getForeignObjectAsync(state.id);
            if (!obj) {
                this.adapter.log.error(
                    `Could not find state id ${state.id} for ${state.name}, ${this.ruleset.rulename}`,
                );
                ret = false;
            }
        }
        for (const rule of this.ruleset.rules) {
            const ids: string[] = typeof rule.id === 'string' ? [rule.id] : rule.id;
            for (const id of ids) {
                const obj: any = await this.adapter.getForeignObjectAsync(id);
                if (!obj) {
                    this.adapter.log.error(`Could not find rule id ${id} for ${rule.name}, ${this.ruleset.rulename}`);
                    ret = false;
                }
            }
        }
        return ret;
    }

    private delSonderzeichen(text: string): string {
        return text.trim().replace(/(\r\n|\n|\r|\t|\s)/g, '');
    }

    private isHoliday(weekdays: string): boolean {
        const holiday = Holidays.isHolidayToday(this.adapter.config.holiday);
        const weekdaysarray = this.delSonderzeichen(weekdays).split(',');
        return weekdaysarray.includes('Hd') && holiday;
    }

    /**
     * is weekday
     *
     * @param weekdays for Excample Sa. So, ....
     * @returns
     */
    private inWeekday(weekdays: string): boolean {
        const now = new Date();
        const day = now.getDay();
        const weekdaynow = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][day];
        // if string like 'sa','so','mo' convert to array [ 'sa', 'so', 'mo']
        const weekdaysarray = this.delSonderzeichen(weekdays).split(',');
        // checks if today in weekday array
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
    private isTimeBetween(startTime: string, endTime: string, time?: string): boolean {
        const toSeconds = (t: string): number => {
            const [hours = 0, minutes = 0, seconds = 0] = t.split(':').map(Number);
            return hours * 3600 + minutes * 60 + seconds;
        };
        if (!time) {
            const now = new Date();
            time = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
    private secToTimeArray(seconds: number): [hours: number, minutes: number, seconds: number] {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
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
    private getTimeString(hours: number, minutes: number, seconds: number): string {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    /**
     * Time between a range. Example 10:00,20:00 => 12:45
     *
     * @param timeRange timestring hh:mm,hh:mm
     * @returns time hh:mm
     */
    private getRandomTimeBetween(timeRange: string): string {
        if (!timeRange.includes(',')) {
            return timeRange;
        }
        const [start, end] = timeRange.split(',').map(time => {
            time = this.addOrSubtractTime(time);
            const [hours = 0, minutes = 0, seconds = 0] = time.split(':').map(Number);
            return hours * 3600 + minutes * 60 + seconds; // Sekunden seit Tagesbeginn
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
    private addOrSubtractTime(time: string): string {
        let time1 = '';
        let time2 = '';
        let operation: '+' | '-' | undefined = undefined;
        if (time.includes('+')) {
            operation = '+';
            [time1, time2] = time.split('+').map(String);
        }
        if (time.includes('-')) {
            operation = '-';
            [time1, time2] = time.split('-').map(String);
        }
        if (operation === undefined) {
            return this.getTimefromSuncalc(time);
        }
        const [h1 = 0, m1 = 0, s1 = 0] = this.getTimefromSuncalc(time1).split(':').map(Number);
        const [h2 = 0, m2 = 0, s2 = 0] = this.getTimefromSuncalc(time2).split(':').map(Number);
        let totalSeconds = h1 * 3600 + m1 * 60 + s1;
        const secondsToAddOrSubtract = h2 * 3600 + m2 * 60 + s2;
        totalSeconds =
            operation === '+' ? totalSeconds + secondsToAddOrSubtract : totalSeconds - secondsToAddOrSubtract;
        // Stellen sicher, dass das Ergebnis im Bereich 0-86400 Sekunden (0-23h) bleibt
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
    private getTimefromSuncalc(time: string): string {
        try {
            const suncalc = SunCalc.getTimes(new Date(), this.latitude, this.longitude);
            const suncalctime = suncalc[time as keyof SunCalc.GetTimesResult];
            return suncalctime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    public checkTIme(timename: string): boolean {
        const timerule = this.ruleset.times.find(item => item.name === timename);
        if (!timerule) {
            return false;
        }
        const inweekday = this.inWeekday(timerule.weekday);
        const isholiday = this.isHoliday(timerule.weekday);
        const intime = this.isTimeBetween(
            this.getRandomTimeBetween(timerule.from),
            this.getRandomTimeBetween(timerule.to),
        );
        return (inweekday || isholiday) && intime;
    }

    /**
     * Delay in seconds 00:00:05,00:00:10 -> 6
     *
     * @param time  like 00:00:05,00:00:10
     * @returns seconds
     */
    private delayInSeconds(time: string): number {
        const randomDelayTime = this.getRandomTimeBetween(time);
        const [h = 0, m = 0, s = 0] = randomDelayTime.split(':').map(Number);
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
    private isEquivalent(a: any, b: any): boolean {
        if (typeof a === 'object' && typeof b === 'object') {
            // Create arrays of property names
            const aProps = Object.getOwnPropertyNames(a);
            const bProps = Object.getOwnPropertyNames(b);
            // If number of properties is different,
            // objects are not equivalent
            if (aProps.length != bProps.length) {
                return false;
            }
            for (let i = 0; i < aProps.length; i++) {
                const propName = aProps[i];
                // If values of same property are not equal,
                // objects are not equivalent
                if (a[propName] !== b[propName]) {
                    return false;
                }
            }
            // If we made it this far, objects
            // are considered equivalent
            return true;
        }
        return a == b ? true : false;
    }

    private unregisterStates(): void {
        for (const state of this.ruleset.states) {
            this.adapter.unsubscribeForeignStates(state.id);
            state.value = undefined;
            state.valueold = undefined;
        }
    }

    public async registeStates(): Promise<void> {
        for (const state of this.ruleset.states) {
            if (this.ruleset.active) {
                const found = this.ruleset.rules.find(rule => rule.query.search(`${state.name}.`) >= 0) !== undefined;
                if (found) {
                    state.value = (await this.adapter.getForeignStateAsync(state.id)).val;
                    state.ack = (await this.adapter.getForeignStateAsync(state.id)).ack;
                    this.adapter.log.info(`Subscribe Id ${state.id}`);
                    this.adapter.subscribeForeignStates(state.id);
                }
            }
        }
    }

    public async sandbox(): Promise<void> {
        const context: vm.Context = {};
        if (!this.ruleset.active) {
            return;
        }
        for (const time of this.ruleset.times) {
            context[time.name] = {
                v: time.value,
                ov: time.valueold,
            };
        }
        for (const state of this.ruleset.states) {
            context[state.name] = {
                v: state.cmpvalue !== undefined ? this.isEquivalent(state.value, state.cmpvalue) : state.value,
                ov: state.cmpvalue !== undefined ? this.isEquivalent(state.valueold, state.cmpvalue) : state.valueold,
                a: state.ack,
                oa: state.ackold,
            };
        }
        for (const rule of this.ruleset.rules) {
            try {
                const result = vm.runInNewContext(rule.query, context);
                if (result) {
                    if (rule.name === this.ruleset.value.name) {
                        return;
                    }
                    this.ruleset.value.name = rule.name;
                    const delay = rule.delay === undefined ? 0 : this.delayInSeconds(rule.delay);
                    const ids: string[] = typeof rule.id === 'string' ? [rule.id] : rule.id;
                    for (const id of ids) {
                        if (delay > 0) {
                            this.adapter.log.info(
                                `${this.ruleset.rulename} : Plan Set ${rule.name}, ${id} value to ${rule.value} in ${delay} seconds`,
                            );
                        }
                        this.adapter.clearTimeout(this.ruleset.value.timeout);
                        this.ruleset.value.timeout = this.adapter.setTimeout(async () => {
                            const statevalue = (await this.adapter.getForeignStateAsync(id)).val;
                            const stateack = (await this.adapter.getForeignStateAsync(id)).ack;
                            if (!this.adapter.config.simulation) {
                                this.adapter.log.info(
                                    `${this.ruleset.rulename} : Set ${rule.name}, ${id} value change from ${statevalue} to ${rule.value} (${stateack} to false)`,
                                );
                                await this.adapter.setForeignStateAsync(id, { val: rule.value, ack: false });
                            } else {
                                this.adapter.log.info(
                                    `${this.ruleset.rulename} : Simulation Set ${rule.name}, ${id} value change from ${statevalue} to ${rule.value} (${stateack} to false)`,
                                );
                            }
                        }, delay * 1000);
                        await this.setStates({
                            name: rule.name,
                            id: id,
                            value: rule.value,
                            query: rule.query,
                            context: context,
                        });
                    }
                    // Firt macht we stop
                    return;
                }
            } catch (err) {
                this.adapter.log.error(`Error in ${this.ruleset.rulename}: ${getErrorMessage(err)}`);
            }
        }
        this.adapter.log.debug(`${this.ruleset.rulename} : No rule found. Nothing will be changed.`);
    }

    public setRuleTime(): void {
        for (const time of this.ruleset.times) {
            time.valueold = time.value;
            time.value = this.checkTIme(time.name);
            this.adapter.log.debug(
                `${this.ruleset.rulename} : ${time.name} - new in time: ${time.value}, old in time: ${time.valueold}`,
            );
        }
    }

    public setRuleStates(id: string, statechange: any): void {
        if (!id || !statechange || !this.ruleset.active) {
            return;
        }
        const state = this.ruleset.states.find(item => item.id === id);
        if (!state) {
            return;
        }
        state.valueold = state.value;
        state.value = statechange.val;
        state.ackold = state.ack;
        state.ack = statechange.ack;
        this.adapter.log.debug(
            `${this.ruleset.rulename} : ${state.name} - new state: ${state.value} (${state.ack}), old state: ${state.valueold} (${state.ackold})`,
        );
    }

    private async setStates(result: {
        name: string;
        id: string;
        value: any;
        query: string;
        context: any;
    }): Promise<void> {
        try {
            const id = `${this.adapter.namespace}.rules.${this.ruleset.rulename.replace(/[^0-9a-zA-Z]/g, '')}`;
            await this.adapter.setState(`${id}.rule`, { val: result.name, ack: true });
            await this.adapter.setState(`${id}.value`, { val: result.value, ack: true });
            await this.adapter.setState(`${id}.id`, { val: result.id, ack: true });
            await this.adapter.setState(`${id}.query`, { val: result.query, ack: true });
            const context =
                typeof result.context === 'object' ? JSON.stringify(result.context) : result.context.toString();
            await this.adapter.setState(`${id}.context`, { val: context, ack: true });
        } catch (err) {
            this.adapter.log.error(`Error setting States in ${this.ruleset.rulename}: ${getErrorMessage(err)}`);
        }
    }
}

export class Rulesets {
    private adapter: any;
    private coordinate: coordinate;
    private rulesets!: {
        rulename: string;
        ruleset: Ruleset;
    }[];

    public constructor(coordinate: coordinate, adapter: any) {
        this.adapter = adapter;
        this.coordinate = coordinate;
        this.rulesets = [];
    }

    public async add(rule: ifruleset): Promise<void> {
        this.del(rule.rulename);
        const ruleset = new Ruleset(rule, this.coordinate, this.adapter);
        this.adapter.log.info(`Add ruleset ${rule.rulename}`);
        if (await ruleset.checkRuleSet()) {
            this.rulesets.push({
                rulename: rule.rulename,
                ruleset: ruleset,
            });
            await ruleset.registeStates();
            ruleset.setRuleTime();
            await ruleset.sandbox();
        }
    }

    public del(rulename: string): void {
        if (this.rulesets.length <= 0) {
            return;
        }
        if (rulename === '*') {
            this.adapter.log.info(`Delete all rulesets`);
            this.rulesets = [];
        } else {
            const index = this.rulesets.findIndex(item => item.rulename === rulename);
            if (index >= 0) {
                this.adapter.log.info(`Delete ruleset ${rulename}`);
                this.rulesets.splice(index, 1);
            }
        }
    }

    public exist(rulname: string): boolean {
        const ruleset = this.rulesets.find(item => item.rulename === rulname);
        return ruleset ? true : false;
    }

    public async listenStates(): Promise<void> {
        await Holidays.setHolidaysSet();
        Holidays.pollHolidays();
        // eslint-disable-next-line @typescript-eslint/require-await
        this.adapter.log.debug(`Listen to state changes`);
        this.adapter.on('stateChange', async (id: string, statechange: any): Promise<void> => {
            for (const ruleset of this.rulesets) {
                ruleset.ruleset.setRuleStates(id, statechange);
                ruleset.ruleset.setRuleTime();
                await ruleset.ruleset.sandbox();
                this.adapter.log.debug(
                    `${ruleset.rulename} : Event called for ${id}, ${statechange.val} (ack = ${statechange.ack})`,
                );
            }
        });
        this.adapter.log.debug(`Schedule state changes`);
        const schedule = async (delay: number): Promise<void> => {
            for (const ruleset of this.rulesets) {
                ruleset.ruleset.setRuleTime();
                await ruleset.ruleset.sandbox();
                this.adapter.log.debug(`${ruleset.rulename} : Time scheduler called`);
            }
            this.adapter.setTimeout(async () => await schedule(delay), delay * 1000);
        };
        await schedule(this.adapter.config.pollInterval);
    }
}
