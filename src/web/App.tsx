import { useEffect, useMemo, useState } from "react";
import { api, type JobLog, type Me, type Repo, type Settings } from "./api";
import { PixelArt } from "./pixels";

const PREVIEW = new URLSearchParams(window.location.search).get("preview") === "1";

const PREVIEW_ME: Me = {
  login: "min2h",
  name: "janfi",
  avatarUrl: "",
  email: "min2h@users.noreply.github.com"
};

const PREVIEW_REPOS: Repo[] = [
  {
    id: 1,
    repoHttpsUrl: "https://github.com/min2h/janfi-garden",
    owner: "min2h",
    name: "janfi-garden",
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
  message: "janfi-flow: 오늘도 잔디 한 칸",
  commitMode: "empty",
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
  const [createName, setCreateName] = useState("janfi-garden");
  const [createVis, setCreateVis] = useState<"public" | "private">("public");
  const [connectUrl, setConnectUrl] = useState("");

  const load = async (withMe = true) => {
    if (PREVIEW) {
      setMe(PREVIEW_ME);
      setRepos(PREVIEW_REPOS);
      setSettings(PREVIEW_SETTINGS);
      setLogs([
        { id: 1, repoId: 1, ok: true, message: "min2h/janfi-garden 에 1회 심기 완료", createdAt: new Date().toISOString() }
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
  };

  useEffect(() => {
    void load();
  }, []);

  const cells = useMemo(() => grassCells(grass, grassBurn), [grass, grassBurn]);

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "실패했습니다");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <div className="banner">
        <div className="brand">
          <PixelArt name="sprout" scale={3} />
          <div>
            <div className="kicker">LOCAL PIXEL GARDEN</div>
            <h1 className="pixel-title">janfi-flow</h1>
          </div>
        </div>
        <div className="hint">서버를 켜 두면 매일 잔디가 심어집니다</div>
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
                  })
                }
              >
                <PixelArt name="check" scale={2} />
                로그인
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
          <section className="tile white span-5 tall deco-tile">
            <PixelArt name="sprout" scale={6} />
            <div className="kicker">매일</div>
            <h2>연한 잔디</h2>
            <p>기본값. 하루 1커밋으로 연한 초록칸이 생깁니다.</p>
          </section>
          <section className="tile mint span-3 deco-tile">
            <PixelArt name="leaf" scale={5} />
            <div className="kicker">선택</div>
            <h2>불타는 잔디</h2>
            <p>며칠마다 여러 커밋으로 진한 초록.</p>
          </section>
          <section className="tile peach span-3 deco-tile">
            <PixelArt name="apple" scale={5} />
            <div className="kicker">장식</div>
            <h2>사과</h2>
            <p>기능 버튼이 아닙니다.</p>
          </section>
          <section className="tile dark span-3 deco-tile">
            <PixelArt name="moon" scale={5} />
            <div className="kicker">장식</div>
            <h2>달</h2>
            <p>정원 분위기용 도트입니다.</p>
          </section>
          <section className="tile sky span-3 deco-tile">
            <PixelArt name="bunny" scale={5} />
            <div className="kicker">장식</div>
            <h2>토끼</h2>
            <p>픽셀 갤러리 타일입니다.</p>
          </section>
          <section className="tile light span-4 deco-tile">
            <PixelArt name="kid" scale={5} />
            <div className="kicker">장식</div>
            <h2>정원사</h2>
            <p>로그인 후 잔디를 관리합니다.</p>
          </section>
          <section className="tile mint span-4 deco-tile">
            <PixelArt name="ghost" scale={5} />
            <div className="kicker">장식</div>
            <h2>유령</h2>
            <p>빈 커밋도 잔디는 자랍니다.</p>
          </section>
          <section className="tile dark span-4 deco-tile">
            <PixelArt name="pumpkin" scale={5} />
            <div className="kicker">장식</div>
            <h2>호박</h2>
            <p>클릭해도 설정이 바뀌지 않습니다.</p>
          </section>
        </div>
      ) : (
        <div className="mosaic">
          <section className="tile light span-4">
            <div className="tile-head">
              <PixelArt name="kid" scale={3} />
              <div className="kicker">ACCOUNT</div>
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
                onClick={() =>
                  wrap(async () => {
                    await api.logout();
                    setMe(null);
                  })
                }
              >
                <PixelArt name="ghost" scale={2} />
                로그아웃
              </button>
            </div>
          </section>

          <section className="tile dark span-8 taller">
            <div className="tile-head">
              <PixelArt name="leaf" scale={3} />
              <div>
                <div className="kicker">잔디 미리보기</div>
                <h2>로컬에서 성공한 날만 초록</h2>
              </div>
            </div>
            <div className="grass" aria-label="grass">
              {cells.map((cls, i) => (
                <div key={i} className={`cell ${cls}`} />
              ))}
            </div>
            <div className="deco-corner">
              <PixelArt name="clover" scale={3} />
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
                  })
                }
              >
                <PixelArt name="sprout" scale={2} />
                생성하고 연결
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
                placeholder="https://github.com/min2h/jandi-flow-test-repo"
              />
              <button
                disabled={busy}
                onClick={() =>
                  wrap(async () => {
                    await api.connectRepo(connectUrl);
                    setConnectUrl("");
                    await load(false);
                  })
                }
              >
                <PixelArt name="check" scale={2} />
                연결 확인
              </button>
              <div className="hint">private 테스트면 PAT에 repo 권한이 있어야 합니다. 예: https://github.com/min2h/jandi-flow-test-repo</div>
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
                    <button className="ghost" disabled={busy} onClick={() => wrap(async () => { await api.healthRepo(repo.id); await load(false); })}>
                      <PixelArt name="key" scale={2} />
                      검증
                    </button>
                    <button className="ok" disabled={busy} onClick={() => wrap(async () => { await api.runNow(repo.id); await load(false); })}>
                      <PixelArt name="sprout" scale={2} />
                      지금 심기
                    </button>
                    <button disabled={busy} onClick={() => wrap(async () => { await api.runNow(repo.id, true); await load(false); })}>
                      <PixelArt name="leaf" scale={2} />
                      오늘 불태우기
                    </button>
                    <button className="warn" disabled={busy} onClick={() => wrap(async () => { await api.deleteRepo(repo.id); await load(false); })}>
                      <PixelArt name="warn" scale={2} />
                      해제
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
                  <option value="empty">빈 커밋 (기존 코드 미변경)</option>
                  <option value="log">.janfi/garden.log 만 추가</option>
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
                  onClick={() => wrap(async () => { setSettings(await api.saveSettings(settings)); })}
                >
                  <PixelArt name="star" scale={2} />
                  설정 저장
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
                <div className="kicker">TIP</div>
                <h2>기존 기능은 그대로</h2>
              </div>
            </div>
            <p>빈 커밋이 기본입니다. 대상 레포 소스는 수정하지 않습니다.</p>
            <button disabled={busy} onClick={() => wrap(async () => { await api.runNow(); await load(false); })}>
              <PixelArt name="leaf" scale={2} />
              연결된 모든 레포 지금 심기
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
