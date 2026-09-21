export type RepoStatus =
  | "connected"
  | "repo_missing"
  | "auth_invalid"
  | "push_denied";

export type ScheduleMode = "fixed" | "random";
export type MessageMode = "fixed" | "random";
export type CommitMode = "empty" | "log";
export type CountMode = "fixed" | "random";
export type Visibility = "public" | "private";

export interface GithubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  email: string | null;
  id: number;
}

export interface RepoInfo {
  owner: string;
  name: string;
  htmlUrl: string;
  visibility: Visibility;
  defaultBranch: string;
  canPush: boolean;
}

export interface Settings {
  scheduleMode: ScheduleMode;
  fixedTime: string;
  randomFrom: string;
  randomTo: string;
  timezone: string;
  messageMode: MessageMode;
  message: string;
  commitMode: CommitMode;
  commitsPerDay: number;
  commitsPerDayMode: CountMode;
  schedulerEnabled: boolean;
  burnEnabled: boolean;
  burnEveryDays: number;
  burnJitterDays: number;
  burnCommits: number;
}

export interface ConnectedRepo {
  id: number;
  repoHttpsUrl: string;
  owner: string;
  name: string;
  visibility: Visibility;
  defaultBranch: string;
  status: RepoStatus;
  lastHealth: string | null;
  lastError: string | null;
  lastCommitAt: string | null;
  createdAt: string;
}

export interface JobLog {
  id: number;
  repoId: number | null;
  ok: boolean;
  message: string;
  createdAt: string;
}

export const DEFAULT_SETTINGS: Settings = {
  scheduleMode: "fixed",
  fixedTime: "09:00",
  randomFrom: "09:00",
  randomTo: "22:00",
  timezone: "Asia/Seoul",
  messageMode: "random",
  message: "janfi-flow: 오늘도 잔디 한 칸",
  commitMode: "empty",
  commitsPerDay: 1,
  commitsPerDayMode: "fixed",
  schedulerEnabled: true,
  burnEnabled: false,
  burnEveryDays: 7,
  burnJitterDays: 2,
  burnCommits: 8
};

export const RANDOM_MESSAGES = [
  "janfi-flow: 잔디 한 칸",
  "오늘도 심었다",
  "pixel sprout",
  "garden tick",
  "도트 한 잎",
  "조용한 커밋",
  "풀잎 추가",
  "잔디밭 유지보수",
  "작은 푸시",
  "green pixel"
];
