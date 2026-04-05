import { GameSummary, PlayerRole } from '../types';

const API_KEY_STORAGE = 'ward_optimizer_riot_api_key';
const PUUID_STORAGE = 'ward_optimizer_puuid';
const SUMMONER_STORAGE = 'ward_optimizer_summoner';

// Regional routing: EUW/EUNE/TR → europe, NA/BR/LAN/LAS → americas, KR/JP → asia
const ACCOUNT_BASE = 'https://europe.api.riotgames.com'; // Default to europe, can be configured
const MATCH_BASE = 'https://europe.api.riotgames.com';

export class RiotAPI {
  private _apiKey: string;

  constructor() {
    this._apiKey = this.loadApiKey();
  }

  public setApiKey(key: string): void {
    this._apiKey = key;
    localStorage.setItem(API_KEY_STORAGE, key);
  }

  public getApiKey(): string {
    return this._apiKey;
  }

  public hasApiKey(): boolean {
    return this._apiKey.length > 0;
  }

  /** Save summoner info from Live Client Data for later API lookups */
  public saveSummonerInfo(gameName: string, tagLine: string): void {
    localStorage.setItem(SUMMONER_STORAGE, JSON.stringify({ gameName, tagLine }));
  }

  public getSummonerInfo(): { gameName: string; tagLine: string } | null {
    try {
      const stored = localStorage.getItem(SUMMONER_STORAGE);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return null;
  }

  /** Get PUUID from Riot ID (gameName#tagLine) */
  public async getPuuid(gameName: string, tagLine: string): Promise<string | null> {
    // Check cache
    const cached = localStorage.getItem(PUUID_STORAGE);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (data.gameName === gameName && data.tagLine === tagLine) {
          return data.puuid;
        }
      } catch (e) {}
    }

    try {
      const url = `${ACCOUNT_BASE}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${this._apiKey}`;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const data = await resp.json();
      if (data.puuid) {
        localStorage.setItem(PUUID_STORAGE, JSON.stringify({
          gameName, tagLine, puuid: data.puuid
        }));
        return data.puuid;
      }
    } catch (e) {}
    return null;
  }

  /** Get recent match IDs */
  public async getMatchIds(puuid: string, count: number = 1): Promise<string[]> {
    try {
      const url = `${MATCH_BASE}/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}&api_key=${this._apiKey}`;
      const resp = await fetch(url);
      if (!resp.ok) return [];
      return await resp.json();
    } catch (e) {}
    return [];
  }

  /** Get full match data */
  public async getMatch(matchId: string): Promise<any | null> {
    try {
      const url = `${MATCH_BASE}/lol/match/v5/matches/${matchId}?api_key=${this._apiKey}`;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      return await resp.json();
    } catch (e) {}
    return null;
  }

  /** Fetch the most recent game and build a GameSummary */
  public async fetchLastGameSummary(): Promise<GameSummary | null> {
    const summoner = this.getSummonerInfo();
    if (!summoner || !this._apiKey) return null;

    const puuid = await this.getPuuid(summoner.gameName, summoner.tagLine);
    if (!puuid) return null;

    const matchIds = await this.getMatchIds(puuid, 1);
    if (matchIds.length === 0) return null;

    const match = await this.getMatch(matchIds[0]);
    if (!match || !match.info) return null;

    return this.buildSummaryFromMatch(match, puuid);
  }

  private buildSummaryFromMatch(match: any, puuid: string): GameSummary {
    const info = match.info;
    const participant = info.participants.find((p: any) => p.puuid === puuid);

    if (!participant) {
      return this.emptySummary();
    }

    const teamId = participant.teamId;
    const team = info.teams.find((t: any) => t.teamId === teamId);
    const enemyTeam = info.teams.find((t: any) => t.teamId !== teamId);

    // Team ward score average
    const teammates = info.participants.filter((p: any) => p.teamId === teamId);
    const teamWardScoreTotal = teammates.reduce((sum: number, p: any) => sum + (p.visionScore || 0), 0);
    const teamAvgWardScore = teammates.length > 0 ? teamWardScoreTotal / teammates.length : 0;

    // Dragon/baron/herald/grubs from team objectives
    const teamObjectives = team?.objectives || {};
    const enemyObjectives = enemyTeam?.objectives || {};

    const duration = info.gameDuration || 0;
    const wardScore = participant.visionScore || 0;

    // Phase ward score estimates from timeline (rough)
    const earlyWardScore = Math.min(wardScore, Math.round(wardScore * 0.3));
    const midWardScore = Math.round(wardScore * 0.45);
    const lateWardScore = wardScore - earlyWardScore - midWardScore;

    const role = this.mapRole(participant.teamPosition || participant.individualPosition || '');

    const summary: GameSummary = {
      matchId: match.metadata?.matchId || `game_${Date.now()}`,
      champion: participant.championName || '',
      role,
      side: teamId === 100 ? 'blue' : 'red',
      win: participant.win || false,
      duration,
      kills: participant.kills || 0,
      deaths: participant.deaths || 0,
      assists: participant.assists || 0,
      wardScore,
      teamAvgWardScore: Math.round(teamAvgWardScore * 100) / 100,
      wardScoreTimeline: [],
      dragonsKilled: teamObjectives.dragon?.kills || 0,
      enemyDragonsKilled: enemyObjectives.dragon?.kills || 0,
      baronsKilled: teamObjectives.baron?.kills || 0,
      heraldsKilled: teamObjectives.riftHerald?.kills || 0,
      grubsKilled: teamObjectives.horde?.kills || 0,
      earlyGameWardScore: Math.max(0, earlyWardScore),
      midGameWardScore: Math.max(0, midWardScore),
      lateGameWardScore: Math.max(0, lateWardScore),
      tips: [],
      timestamp: Date.now()
    };

    return summary;
  }

  private mapRole(position: string): PlayerRole {
    switch (position.toUpperCase()) {
      case 'TOP': return 'top';
      case 'JUNGLE': return 'jungle';
      case 'MIDDLE': return 'mid';
      case 'BOTTOM': return 'bottom';
      case 'UTILITY': return 'support';
      default: return 'unknown';
    }
  }

  private emptySummary(): GameSummary {
    return {
      matchId: `game_${Date.now()}`, champion: '', role: 'unknown', side: 'blue',
      win: false, duration: 0, kills: 0, deaths: 0, assists: 0,
      wardScore: 0, teamAvgWardScore: 0, wardScoreTimeline: [],
      dragonsKilled: 0, enemyDragonsKilled: 0, baronsKilled: 0,
      heraldsKilled: 0, grubsKilled: 0,
      earlyGameWardScore: 0, midGameWardScore: 0, lateGameWardScore: 0,
      tips: [], timestamp: Date.now()
    };
  }

  private loadApiKey(): string {
    try {
      return localStorage.getItem(API_KEY_STORAGE) || '';
    } catch (e) {}
    return '';
  }
}
