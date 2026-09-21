import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type JobLog, type Me, type Repo, type Settings } from "./api";
import { DecoBuddy, DecoTile } from "./deco";
import { PixelArt } from "./pixels";

const PREVIEW = new URLSearchParams(window.location.search).get("preview") === "1";

const PREVIEW_ME: Me = {
  login: "garden-user",
  name: "jandi",
  avatarUrl: "",
  email: "garden-user@users.noreply.github.com"
};

const PREVIEW_REPOS: Repo[] = [
  {
    id: 1,
    repoHttpsUrl: "https://github.com/username/repository",
    owner: "username",
    name: "repository",
    visibility: "public",
    defaultBranch: "main",
    status: "connected",
    lastHealth: new Date().toISOString(),
    lastError: null,
    lastCommitAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  }
];

const PREVIEW_SETTINGS: Settings = {
  scheduleMode: "fixed",
  fixedTime: "09:00",
  randomFrom: "09:00",
  randomTo: "22:00",
  timezone: "Asia/Seoul",
  messageMode: "random",
  message: "jandi-flow: 오늘도 잔디 한 칸",
  commitMode: "log",
  commitsPerDay: 1,
  commitsPerDayMode: "fixed",
  schedulerEnabled: true,
  burnEnabled: true,
  burnEveryDays: 7,
  burnJitterDays: 2,
  burnCommits: 8
};

const STATUS_LABEL: Record<Repo["status"], string> = {
  connected: "연결됨",
  repo_missing: "레포 없음",
  auth_invalid: "인증 실패",
  push_denied: "push 불가"
};

const ACTION_LABEL: Record<string, string> = {
  login: "로그인하는 중",
  logout: "로그아웃하는 중",
  create: "레포를 만드는 중",
  connect: "연결을 확인하는 중",
  health: "레포를 검증하는 중",
  plant: "잔디를 심는 중",
  burn: "잔디를 불태우는 중",
  delete: "연결을 해제하는 중",
  save: "설정을 저장하는 중",
  plantAll: "잔디를 심는 중"
};

function busyText(action: string) {
  return ACTION_LABEL[action.split(":")[0]] || "처리 중";
}

function PixelSpinner() {
  return <span className="pixel-spinner" aria-hidden />;
}

function grassCells(days: string[], burnDays: string[]): string[] {
  const light = new Set(days);
  const burn = new Set(burnDays);
  const cells: string[] = [];
  const today = new Date();
  for (let i = 370; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push(burn.has(key) ? "g3" : light.has(key) ? "g1" : "");
  }
  return cells.slice(-371);
}

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [token, setToken] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [grass, setGrass] = useState<string[]>([]);
  const [grassBurn, setGrassBurn] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [booted, setBooted] = useState(PREVIEW);
  const [createName, setCreateName] = useState("garden");
  const [createVis, setCreateVis] = useState<"public" | "private">("public");
  const [connectUrl, setConnectUrl] = useState("");

  const load = async (withMe = true) => {
    try {
      if (PREVIEW) {
        setMe(PREVIEW_ME);
        setRepos(PREVIEW_REPOS);
        setSettings(PREVIEW_SETTINGS);
        setLogs([
          { id: 1, repoId: 1, ok: true, message: "username/repository 에 1회 심기 완료", createdAt: new Date().toISOString() }
        ]);
        setGrass([new Date().toISOString().slice(0, 10)]);
        setGrassBurn([]);
        return;
      }
      if (withMe) {
        try {
          setMe(await api.me());
        } catch {
          setMe(null);
          return;
        }
      }
      const [repoRes, settingRes, logRes] = await Promise.all([api.repos(), api.settings(), api.logs()]);
      setRepos(repoRes.repos);
      setSettings(settingRes);
      setLogs(logRes.logs);
      setGrass(logRes.grass);
      setGrassBurn(logRes.grassBurn || []);
    } finally {
      setBooted(true);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const cells = useMemo(() => grassCells(grass, grassBurn), [grass, grassBurn]);

  const wrap = async (fn: () => Promise<void>, action = "") => {
    setBusy(true);
    setBusyAction(action);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "실패했습니다");
    } finally {
      setBusy(false);
      setBusyAction("");
    }
  };

  const actionIcon = (action: string, idle: ReactNode) =>
    busy && busyAction === action ? <PixelSpinner /> : idle;

  if (!booted) {
    return (
      <div className="boot" aria-busy="true">
        <div className="boot-card">
          <div className="boot-sprout">
            <PixelArt name="sprout" scale={6} />
          </div>
          <h1 className="pixel-title">jandi-flow</h1>
          <p>정원을 여는 중</p>
          <div className="boot-rail" role="progressbar" aria-label="로딩">
            <div className="boot-fill" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app" aria-busy={busy}>
      <div className={`progress-rail ${busy ? "on" : ""}`} aria-hidden={!busy}>
        <div className="progress-bar" />
      </div>
      <div className="banner">
        <div className="brand">
          <PixelArt name="sprout" scale={3} />
          <div>
            <div className="kicker">PIXEL GARDEN</div>
            <h1 className="pixel-title">jandi-flow</h1>
          </div>
        </div>
        <div className="banner-status">
          {busy ? (
            <div className="busy-chip">
              <PixelSpinner />
              {busyText(busyAction)}
            </div>
          ) : (
            <div className="hint">서버를 켜 두면 매일 잔디가 심어집니다</div>
          )}
        </div>
      </div>

      {!me ? (
        <div className="mosaic">
          <section className="tile light span-7 tall">
            <div className="tile-head">
              <PixelArt name="key" scale={3} />
              <div>
                <div className="kicker">깃허브 로그인</div>
                <h2>여기서 로그인하면 됩니다</h2>
              </div>
            </div>
            <p>
              터미널에서 git login을 따로 할 필요 없습니다. GitHub 사이트에서 PAT를 만든 뒤 아래 칸에 넣고 로그인하면,
              앱이 그 계정으로 commit / push 합니다.
            </p>
            <div className="stack">
              <input
                type="password"
                placeholder="ghp_... 또는 github_pat_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <button
                className="ok"
                disabled={busy}
                onClick={() =>
                  wrap(async () => {
                    await api.login(token);
                    setToken("");
                    await load();
                  }, "login")
                }
              >
                {actionIcon("login", <PixelArt name="check" scale={2} />)}
                {busy && busyAction === "login" ? "로그인하는 중" : "로그인"}
              </button>
              {error && (
                <div className="error">
                  <PixelArt name="warn" scale={2} />
                  {error}
                </div>
              )}
              <div className="hint">
                PAT 만드는 곳: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) →
                Generate. 권한은 repo 체크. 나온 ghp_ 값을 여기만 붙여넣기.
              </div>
            </div>
          </section>
          <DecoTile sprite="sprout" tone="white" span="span-5 tall" scale={6} kicker="매일" title="연한 잔디" tip="하루 한 칸, 연한 초록" />
          <DecoTile sprite="leaf" tone="mint" span="span-3" kicker="선택" title="불타는 잔디" tip="며칠마다 진한 초록" />
          <DecoTile sprite="apple" tone="peach" span="span-3" kicker="장식" title="사과" tip="잘 익은 한 알" />
          <DecoTile sprite="moon" tone="dark" span="span-3" kicker="장식" title="달" tip="정원 위 초승달" />
          <DecoTile sprite="bunny" tone="sky" span="span-3" kicker="장식" title="토끼" tip="잔디밭 토끼" />
          <DecoTile sprite="kid" tone="light" span="span-4" kicker="장식" title="정원사" tip="오늘도 물 주는 중" />
          <DecoTile sprite="ghost" tone="mint" span="span-4" kicker="장식" title="유령" tip="밤의 손님" />
          <DecoTile sprite="pumpkin" tone="dark" span="span-4" kicker="장식" title="호박" tip="가을 호박" />
        </div>
      ) : (
        <div className="mosaic">
          <section className="tile light span-4">
            <div className="tile-head">
              <PixelArt name="kid" scale={3} />
              <div className="kicker">계정</div>
            </div>
            <div className="user-chip">
              {me.avatarUrl ? <img src={me.avatarUrl} alt="" /> : <PixelArt name="frog" scale={3} />}
              <div>
                <h2>{me.login}</h2>
                <div className="hint">{me.email}</div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button
                className="ghost"
                disabled={busy}
                onClick={() =>
                  wrap(async () => {
                    await api.logout();
                    setMe(null);
                  }, "logout")
                }
              >
                {actionIcon("logout", <PixelArt name="ghost" scale={2} />)}
                {busy && busyAction === "logout" ? "로그아웃하는 중" : "로그아웃"}
              </button>
            </div>
          </section>

          <section className="tile dark span-8 taller">
            <div className="tile-head">
              <PixelArt name="leaf" scale={3} />
              <div>
                <div className="kicker">잔디 미리보기</div>
                <h2>심기에 성공한 날만 초록</h2>
              </div>
            </div>
            <div className="grass" aria-label="grass">
              {cells.map((cls, i) => (
                <div key={i} className={`cell ${cls}`} />
              ))}
            </div>
            <div className="deco-corner">
              <DecoBuddy name="clover" label="클로버" tip="네잎클로버" />
            </div>
          </section>

          <section className="tile light span-12 deco-bar">
            <div className="kicker">정원 친구들</div>
            <div className="deco-row">
              <DecoBuddy name="apple" label="사과" tip="잘 익은 한 알" />
              <DecoBuddy name="moon" label="달" tip="정원 위 초승달" />
              <DecoBuddy name="bunny" label="토끼" tip="잔디밭 토끼" />
              <DecoBuddy name="ghost" label="유령" tip="밤의 손님" />
              <DecoBuddy name="pumpkin" label="호박" tip="가을 호박" />
              <DecoBuddy name="sprout" label="새싹" tip="연한 새싹" />
              <DecoBuddy name="leaf" label="잎" tip="타오르는 잎" />
              <DecoBuddy name="kid" label="정원사" tip="오늘도 물 주는 중" />
            </div>
          </section>

          <section className="tile light span-6 tall">
            <div className="tile-head">
              <PixelArt name="repo" scale={3} />
              <div>
                <div className="kicker">새 레포 생성</div>
                <h2>잔디 전용 밭 만들기</h2>
              </div>
            </div>
            <div className="stack">
              <input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="레포 이름" />
              <select value={createVis} onChange={(e) => setCreateVis(e.target.value as "public" | "private")}>
                <option value="public">public</option>
                <option value="private">private</option>
              </select>
              <button
                className="ok"
                disabled={busy}
                onClick={() =>
                  wrap(async () => {
                    await api.createRepo({ name: createName, visibility: createVis });
                    await load(false);
                  }, "create")
                }
              >
                {actionIcon("create", <PixelArt name="sprout" scale={2} />)}
                {busy && busyAction === "create" ? "만드는 중" : "생성하고 연결"}
              </button>
            </div>
          </section>

          <section className="tile peach span-6 tall">
            <div className="tile-head">
              <PixelArt name="link" scale={3} />
              <div>
                <div className="kicker">기존 레포 연결</div>
                <h2>HTTPS URL 검증</h2>
              </div>
            </div>
            <div className="stack">
              <input
                value={connectUrl}
                onChange={(e) => setConnectUrl(e.target.value)}
                placeholder="https://github.com/username/repository"
              />
              <button
                disabled={busy}
                onClick={() =>
                  wrap(async () => {
                    await api.connectRepo(connectUrl);
                    setConnectUrl("");
                    await load(false);
                  }, "connect")
                }
              >
                {actionIcon("connect", <PixelArt name="check" scale={2} />)}
                {busy && busyAction === "connect" ? "연결하는 중" : "연결 확인"}
              </button>
              <div className="hint">private 레포는 PAT에 repo 권한이 있어야 합니다.</div>
            </div>
          </section>

          <section className="tile dark span-6 tall">
            <div className="tile-head">
              <PixelArt name="pot" scale={3} />
              <div className="kicker">연결된 레포</div>
            </div>
            <div className="repo-list">
              {repos.length === 0 && <p>아직 연결된 밭이 없습니다.</p>}
              {repos.map((repo) => (
                <div className="repo-item" key={repo.id}>
                  <div className="repo-meta">
                    <PixelArt name={repo.status === "connected" ? "check" : "warn"} scale={2} />
                    <div>
                      <strong>
                        {repo.owner}/{repo.name}
                      </strong>
                      <div className={`status-pill status-${repo.status}`}>{STATUS_LABEL[repo.status]}</div>
                      {repo.lastError && <div className="error">{repo.lastError}</div>}
                    </div>
                  </div>
                  <div className="row">
                    <button
                      className="ghost"
                      disabled={busy}
                      onClick={() => wrap(async () => { await api.healthRepo(repo.id); await load(false); }, `health:${repo.id}`)}
                    >
                      {actionIcon(`health:${repo.id}`, <PixelArt name="key" scale={2} />)}
                      {busy && busyAction === `health:${repo.id}` ? "검증 중" : "검증"}
                    </button>
                    <button
                      className="ok"
                      disabled={busy}
                      onClick={() => wrap(async () => { await api.runNow(repo.id); await load(false); }, `plant:${repo.id}`)}
                    >
                      {actionIcon(`plant:${repo.id}`, <PixelArt name="sprout" scale={2} />)}
                      {busy && busyAction === `plant:${repo.id}` ? "심는 중" : "지금 심기"}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => wrap(async () => { await api.runNow(repo.id, true); await load(false); }, `burn:${repo.id}`)}
                    >
                      {actionIcon(`burn:${repo.id}`, <PixelArt name="leaf" scale={2} />)}
                      {busy && busyAction === `burn:${repo.id}` ? "불태우는 중" : "오늘 불태우기"}
                    </button>
                    <button
                      className="warn"
                      disabled={busy}
                      onClick={() => wrap(async () => { await api.deleteRepo(repo.id); await load(false); }, `delete:${repo.id}`)}
                    >
                      {actionIcon(`delete:${repo.id}`, <PixelArt name="warn" scale={2} />)}
                      {busy && busyAction === `delete:${repo.id}` ? "해제 중" : "해제"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {settings && (
            <section className="tile light span-6 tall">
              <div className="tile-head">
                <PixelArt name="clock" scale={3} />
                <div className="kicker">스케줄 / 메시지</div>
              </div>
              <div className="stack">
                <select
                  value={settings.scheduleMode}
                  onChange={(e) => setSettings({ ...settings, scheduleMode: e.target.value as Settings["scheduleMode"] })}
                >
                  <option value="fixed">매일 고정 시각</option>
                  <option value="random">매일 랜덤 시각</option>
                </select>
                {settings.scheduleMode === "fixed" ? (
                  <input type="time" value={settings.fixedTime} onChange={(e) => setSettings({ ...settings, fixedTime: e.target.value })} />
                ) : (
                  <div className="row">
                    <input type="time" value={settings.randomFrom} onChange={(e) => setSettings({ ...settings, randomFrom: e.target.value })} />
                    <input type="time" value={settings.randomTo} onChange={(e) => setSettings({ ...settings, randomTo: e.target.value })} />
                  </div>
                )}
                <select
                  value={settings.messageMode}
                  onChange={(e) => setSettings({ ...settings, messageMode: e.target.value as Settings["messageMode"] })}
                >
                  <option value="random">랜덤 커밋 메시지</option>
                  <option value="fixed">고정 커밋 메시지</option>
                </select>
                {settings.messageMode === "fixed" && (
                  <input value={settings.message} onChange={(e) => setSettings({ ...settings, message: e.target.value })} />
                )}
                <select
                  value={settings.commitMode}
                  onChange={(e) => setSettings({ ...settings, commitMode: e.target.value as Settings["commitMode"] })}
                >
                  <option value="log">.jandi/GARDEN.md 에 기록 추가</option>
                  <option value="empty">빈 커밋 (파일 변경 없음)</option>
                </select>
                <div className="row">
                  <select
                    value={settings.commitsPerDayMode}
                    onChange={(e) => setSettings({ ...settings, commitsPerDayMode: e.target.value as Settings["commitsPerDayMode"] })}
                  >
                    <option value="fixed">하루 커밋 수 고정</option>
                    <option value="random">하루 커밋 수 랜덤</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={settings.commitsPerDay}
                    onChange={(e) => setSettings({ ...settings, commitsPerDay: Number(e.target.value) })}
                  />
                </div>
                <label className="row">
                  <input
                    type="checkbox"
                    checked={settings.schedulerEnabled}
                    onChange={(e) => setSettings({ ...settings, schedulerEnabled: e.target.checked })}
                    style={{ width: "auto" }}
                  />
                  스케줄러 켜기
                </label>
                <label className="row">
                  <input
                    type="checkbox"
                    checked={settings.burnEnabled}
                    onChange={(e) => setSettings({ ...settings, burnEnabled: e.target.checked })}
                    style={{ width: "auto" }}
                  />
                  불타는 잔디 (며칠마다 진한 초록)
                </label>
                {settings.burnEnabled && (
                  <div className="row">
                    <label className="hint">간격(일)</label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={settings.burnEveryDays}
                      onChange={(e) => setSettings({ ...settings, burnEveryDays: Number(e.target.value) })}
                    />
                    <label className="hint">±랜덤</label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={settings.burnJitterDays}
                      onChange={(e) => setSettings({ ...settings, burnJitterDays: Number(e.target.value) })}
                    />
                    <label className="hint">그날 커밋 수</label>
                    <input
                      type="number"
                      min={4}
                      max={20}
                      value={settings.burnCommits}
                      onChange={(e) => setSettings({ ...settings, burnCommits: Number(e.target.value) })}
                    />
                  </div>
                )}
                <div className="hint">끄면 매일 연한 초록(1커밋). 켜면 간격±랜덤 뒤에만 진한 초록이 올라갑니다.</div>
                <button
                  className="ok"
                  disabled={busy}
                  onClick={() => wrap(async () => { setSettings(await api.saveSettings(settings)); }, "save")}
                >
                  {actionIcon("save", <PixelArt name="star" scale={2} />)}
                  {busy && busyAction === "save" ? "저장하는 중" : "설정 저장"}
                </button>
              </div>
            </section>
          )}

          <section className="tile mint span-7">
            <div className="tile-head">
              <PixelArt name="envelope" scale={3} />
              <div className="kicker">로그</div>
            </div>
            <div className="logs">
              {logs.length === 0 && <p>아직 심은 기록이 없습니다.</p>}
              {logs.map((log) => (
                <div key={log.id} className={log.ok ? "log-ok" : "log-fail"}>
                  <PixelArt name={log.ok ? "check" : "warn"} scale={2} />
                  {log.createdAt.slice(0, 16).replace("T", " ")} · {log.message}
                </div>
              ))}
            </div>
          </section>
          <section className="tile dark span-5">
            <div className="tile-head">
              <PixelArt name="ghost" scale={3} />
              <div>
                <div className="kicker">안내</div>
                <h2>기존 기능은 그대로</h2>
              </div>
            </div>
            <p>기본은 <code>.jandi/GARDEN.md</code> 에 날짜·메시지를 한 줄 추가합니다. 대상 레포의 기존 소스는 건드리지 않습니다.</p>
            <button disabled={busy} onClick={() => wrap(async () => { await api.runNow(); await load(false); }, "plantAll")}>
              {actionIcon("plantAll", <PixelArt name="leaf" scale={2} />)}
              {busy && busyAction === "plantAll" ? "심는 중" : "연결된 모든 레포 지금 심기"}
            </button>
            {error && (
              <div className="error" style={{ marginTop: 8 }}>
                <PixelArt name="warn" scale={2} />
                {error}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
