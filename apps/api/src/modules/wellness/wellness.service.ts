/**
 * Wellness (Anti-addiction) — session tracking, slow mode, minor cap
 *
 * Implements EU DSA-aligned controls:
 * - daily/weekly minute limits
 * - slow mode (one post at a time)
 * - hide counts (likes/reposts/followers)
 * - quiet hours
 * - parental controls (China-style 40 min cap)
 */

import { Injectable, Logger } from '@nestjs/common';
import { getVedadbPool } from '@orbit/db';

export interface WellnessSettings {
  userDid: string;
  dailyMinutesLimit: number;
  weeklyMinutesLimit: number;
  slowMode: boolean;
  hideLikesCount: boolean;
  hideRepostsCount: boolean;
  hideFollowersCount: boolean;
  noInfinitescroll: boolean;
  showTimer: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  reminderIntervalMin: number;
}

@Injectable()
export class WellnessService {
  private readonly db; private readonly logger = new Logger(WellnessService.name);

  constructor() { this.db = getVedadbPool(); }

  async getSettings(userDid: string): Promise<WellnessSettings> {
    const res = await this.db.query<any>(
      `SELECT user_did as "userDid", daily_minutes_limit as "dailyMinutesLimit",
              weekly_minutes_limit as "weeklyMinutesLimit", slow_mode as "slowMode",
              hide_likes_count as "hideLikesCount", hide_reposts_count as "hideRepostsCount",
              hide_followers_count as "hideFollowersCount", no_infinitescroll as "noInfinitescroll",
              show_timer as "showTimer", quiet_hours_start as "quietHoursStart",
              quiet_hours_end as "quietHoursEnd", reminder_interval_min as "reminderIntervalMin"
       FROM user_wellness WHERE user_did = $1`,
      [userDid]
    );
    if (res.rows[0]) return res.rows[0];
    // Return defaults
    return {
      userDid,
      dailyMinutesLimit: 0, weeklyMinutesLimit: 0, slowMode: false,
      hideLikesCount: false, hideRepostsCount: false, hideFollowersCount: false,
      noInfinitescroll: true, showTimer: true, reminderIntervalMin: 30,
    };
  }

  async updateSettings(userDid: string, updates: Partial<WellnessSettings>): Promise<WellnessSettings> {
    const intCols = ['daily_minutes_limit', 'weekly_minutes_limit', 'reminder_interval_min'];
    const boolCols = ['slow_mode', 'hide_likes_count', 'hide_reposts_count', 'hide_followers_count', 'no_infinitescroll', 'show_timer'];
    const map: Record<string, string> = {
      dailyMinutesLimit: 'daily_minutes_limit', weeklyMinutesLimit: 'weekly_minutes_limit',
      slowMode: 'slow_mode', hideLikesCount: 'hide_likes_count', hideRepostsCount: 'hide_reposts_count',
      hideFollowersCount: 'hide_followers_count', noInfinitescroll: 'no_infinitescroll',
      showTimer: 'show_timer', quietHoursStart: 'quiet_hours_start', quietHoursEnd: 'quiet_hours_end',
      reminderIntervalMin: 'reminder_interval_min',
    };
    const existing = await this.db.query(`SELECT 1 FROM user_wellness WHERE user_did = $1`, [userDid]);
    if (!existing.rows[0]) {
      // Insert with defaults + updates
      const cols = ['user_did', ...Object.keys(updates).filter(k => map[k] && updates[k] !== undefined).map(k => `"${map[k]}"`)];
      const placeholders = ['$1'];
      const vals: any[] = [userDid];
      let i = 2;
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined || !map[k]) continue;
        const col = map[k];
        const isInt = intCols.includes(col);
        const isBool = boolCols.includes(col);
        const cast = isInt ? '::int' : isBool ? '::bool' : '';
        placeholders.push(`$${i}${cast}`);
        vals.push(isInt && typeof v === 'string' ? parseInt(v, 10) || 0 : v);
        i++;
      }
      await this.db.query(`INSERT INTO user_wellness (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`, vals);
    } else {
      const fields: string[] = [];
      const values: any[] = [];
      let i = 1;
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined || !map[k]) continue;
        const col = map[k];
        const isInt = intCols.includes(col);
        const isBool = boolCols.includes(col);
        const cast = isInt ? '::int' : isBool ? '::bool' : '';
        const val = isInt && typeof v === 'string' ? parseInt(v, 10) || 0 : v;
        fields.push(`${col} = $${i}${cast}`);
        values.push(val);
        i++;
      }
      if (fields.length > 0) {
        fields.push(`updated_at = NOW()`);
        values.push(userDid);
        await this.db.query(`UPDATE user_wellness SET ${fields.join(', ')} WHERE user_did = $${i}`, values);
      }
    }
    return this.getSettings(userDid);
  }

  /**
   * Track a session ping. Called every minute the user is active.
   * Returns:
   * - { exceeded: false } — OK
   * - { exceeded: 'daily' | 'weekly' } — should prompt user
   * - { exceeded: 'hard', forceLogout: true } — minor with parental controls
   */
  async tickSession(userDid: string, seconds: number): Promise<{
    exceeded: false | 'daily' | 'weekly' | 'hard';
    forceLogout: boolean;
    usedToday: number;
    usedWeek: number;
    limitToday: number;
    limitWeek: number;
  }> {
    const settings = await this.getSettings(userDid);

    // Update today's session log
    await this.db.query(
      `INSERT INTO session_logs (user_did, day, seconds) VALUES ($1, CURRENT_DATE, $2)
       ON CONFLICT (user_did, day) DO UPDATE SET seconds = session_logs.seconds + $2`,
      [userDid, seconds]
    );

    // Compute usage
    const todayRes = await this.db.query<any>(
      `SELECT seconds FROM session_logs WHERE user_did = $1 AND day = CURRENT_DATE`,
      [userDid]
    );
    const weekRes = await this.db.query<any>(
      `SELECT COALESCE(SUM(seconds), 0) as week FROM session_logs
       WHERE user_did = $1 AND day >= CURRENT_DATE - INTERVAL '7 days'`,
      [userDid]
    );
    const usedToday = parseInt(todayRes.rows[0]?.seconds || 0, 10);
    const usedWeek = parseInt(weekRes.rows[0]?.week || 0, 10);

    // Check parental controls (overrides everything)
    const parentRes = await this.db.query<any>(
      `SELECT daily_minutes_limit, enabled FROM parental_controls
       WHERE minor_did = $1 AND enabled = TRUE LIMIT 1`,
      [userDid]
    );
    if (parentRes.rows[0] && usedToday / 60 >= parentRes.rows[0].daily_minutes_limit) {
      return { exceeded: 'hard', forceLogout: true, usedToday, usedWeek, limitToday: 0, limitWeek: 0 };
    }

    // User-set limits
    if (settings.dailyMinutesLimit && usedToday / 60 >= settings.dailyMinutesLimit) {
      return { exceeded: 'daily', forceLogout: false, usedToday, usedWeek, limitToday: settings.dailyMinutesLimit, limitWeek: settings.weeklyMinutesLimit };
    }
    if (settings.weeklyMinutesLimit && usedWeek / 60 >= settings.weeklyMinutesLimit) {
      return { exceeded: 'weekly', forceLogout: false, usedToday, usedWeek, limitToday: settings.dailyMinutesLimit, limitWeek: settings.weeklyMinutesLimit };
    }

    return { exceeded: false, forceLogout: false, usedToday, usedWeek, limitToday: settings.dailyMinutesLimit, limitWeek: settings.weeklyMinutesLimit };
  }

  async getUsage(userDid: string) {
    const todayRes = await this.db.query<any>(
      `SELECT seconds FROM session_logs WHERE user_did = $1 AND day = CURRENT_DATE`, [userDid]
    );
    const weekRes = await this.db.query<any>(
      `SELECT COALESCE(SUM(seconds), 0) as week FROM session_logs
       WHERE user_did = $1 AND day >= CURRENT_DATE - INTERVAL '7 days'`, [userDid]
    );
    const seven = await this.db.query<any>(
      `SELECT day::text, seconds FROM session_logs
       WHERE user_did = $1 AND day >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY day ASC`, [userDid]
    );
    return {
      usedTodaySeconds: parseInt(todayRes.rows[0]?.seconds || 0, 10),
      usedWeekSeconds: parseInt(weekRes.rows[0]?.week || 0, 10),
      daily: seven.rows,
    };
  }

  async setParentalControls(opts: { guardianDid: string; minorDid: string; dailyMinutesLimit?: number; enabled?: boolean }) {
    await this.db.query(
      `INSERT INTO parental_controls (guardian_did, minor_did, daily_minutes_limit, enabled)
       VALUES ($1, $2, $3::int, $4)
       ON CONFLICT (guardian_did, minor_did) DO UPDATE SET
         daily_minutes_limit = EXCLUDED.daily_minutes_limit,
         enabled = EXCLUDED.enabled`,
      [opts.guardianDid, opts.minorDid, opts.dailyMinutesLimit || 40, opts.enabled ?? true]
    );
    return { ok: true };
  }
}
