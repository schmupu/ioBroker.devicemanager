import axios from 'axios';
import sched from 'node-schedule';

export interface ifHolidays {
    title: string;
    date: string;
    locs: string[];
    dayName: string;
    tagName: string;
}

export class Holidays {
    private static holdiays?: ifHolidays[];
    private static schedjob?: sched.Job;
    /**
     * Contructor
     *
     * @param state state like HH
     * @param year year like 2025
     */
    private constructor() {}

    /**
     *  set Holidays
     */
    public static async setHolidaysSet(): Promise<void> {
        const year = new Date().getFullYear().toString();
        const url = `https://ipty.de/feiertag/api.php?do=getFeiertage&jahr=${year}&outformat=Y-m-d`;
        const response = await axios.get(url);
        if (response?.data) {
            this.holdiays = response.data; // JSON.parse(response.data);
        }
    }

    /**
     * holiday today?
     *
     * @param state state like HH
     * @returns bolean
     */
    public static isHolidayToday(state: string): boolean {
        const today = new Date().toISOString().split('T')[0]; // Heutiges Datum im Format YYYY-MM-DD
        if (this.holdiays) {
            return this.holdiays.some(holiday => holiday.date === today && holiday.locs.includes(state));
        }
        return false;
    }

    /**
     * Poll once the year the noew holiday calender
     */
    public static pollHolidays(): void {
        if (this.schedjob) {
            sched.cancelJob(this.schedjob);
        }
        this.schedjob = sched.scheduleJob('1 0 * * *', async () => {
            await this.setHolidaysSet();
        });
    }

    /**
     * Get all holidays
     *
     * @returns holidays
     */
    public static getHolidays(): ifHolidays[] | undefined {
        return this.holdiays;
    }
}
