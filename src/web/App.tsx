import { useEffect, useMemo, useState } from "react";
import { api, type JobLog, type Me, type Repo, type Settings } from "./api";

const PREVIEW = new URLSearchParams(window.location.search).get("preview") === "1";

const PREVIEW_ME: Me = {
  login: "min2h",
  name: "janfi",
  avatarUrl: "https://avatars.githubusercontent.com/u/9919?s=80",
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
  schedulerEnabled: true
};

const STATUS_LABEL: Record<Repo["status"], string> = {
  connected: "연결됨",
  repo_missing: "레포 없음",
  auth_invalid: "인증 실패",
  push_denied: "push 불가"
};

function grassCells(days: string[]): string[] {
  const set = new Set(days);
  const cells: string[] = [];
  const today = new Date();
  for (let i = 370; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push(set.has(key) ? "g2" : "");
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
  };

  useEffect(() => {
    void load();
  }, []);

  const cells = useMemo(() => grassCells(grass), [grass]);

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
        <div>
          <div className="kicker">LOCAL PIXEL GARDEN</div>
          <h1 className="pixel-title">janfi-flow</h1>
        </div>
        <div className="hint">서버를 켜 두면 매일 잔디가 심어집니다</div>
      </div>

      {!me ? (
        <div className="mosaic">
          <section className="tile light span-7 tall">
            <div className="kicker">GITHUB 로그인</div>
            <h2>PAT로 들어오세요</h2>
            <p>토큰은 이 PC의 data 폴더에만 암호화되어 저장되고, git에는 올라가지 않습니다.</p>
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
                로그인
              </button>
              {error && <div className="error">{error}</div>}
              <div className="hint">Classic PAT는 repo 권한. public만 쓸 경우 public_repo 도 가능합니다.</div>
            </div>
          </section>
          <section className="tile dark span-5 tall">
            <div className="kicker">PIXEL</div>
            <h2>도트 잔디밭</h2>
            <p>로그인 후 레포를 만들거나 HTTPS URL로 연결하면, 기존 코드는 건드리지 않고 빈 커밋만 올라갑니다.</p>
            <div className="sprite ghost" />
          </section>
          <section className="tile peach span-4">
            <div className="kicker">DECOR</div>
            <h2>사과 한 입</h2>
            <div className="sprite apple" />
          </section>
          <section className="tile dark span-4">
            <div className="sprite dots" />
            <div className="kicker">PATTERN</div>
            <h2>점점점</h2>
          </section>
          <section className="tile mint span-4">
            <div className="sprite clover" />
            <div className="kicker">GARDEN</div>
            <h2>클로버</h2>
          </section>
        </div>
      ) : (
        <div className="mosaic">
          <section className="tile light span-4">
            <div className="kicker">ACCOUNT</div>
            <div className="user-chip">
              <img src={me.avatarUrl} alt="" />
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
                로그아웃
              </button>
            </div>
          </section>

          <section className="tile dark span-8 taller">
            <div className="kicker">잔디 미리보기</div>
            <h2>로컬에서 성공한 날만 초록</h2>
            <div className="grass" aria-label="grass">
              {cells.map((cls, i) => (
                <div key={i} className={`cell ${cls}`} />
              ))}
            </div>
            <div className="sprite clover" />
          </section>

          <section className="tile light span-6 tall">
            <div className="kicker">새 레포 생성</div>
            <h2>잔디 전용 밭 만들기</h2>
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
                생성하고 연결
              </button>
            </div>
          </section>

          <section className="tile peach span-6 tall">
            <div className="kicker">기존 레포 연결</div>
            <h2>HTTPS URL 검증</h2>
            <div className="stack">
              <input
                value={connectUrl}
                onChange={(e) => setConnectUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
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
                연결 확인
              </button>
              <div className="hint">public/private 모두 가능. 삭제되거나 키가 바뀌면 상태가 끊깁니다.</div>
            </div>
          </section>

          <section className="tile dark span-6 tall">
            <div className="kicker">연결된 레포</div>
            <div className="repo-list">
              {repos.length === 0 && <p>아직 연결된 밭이 없습니다.</p>}
              {repos.map((repo) => (
                <div className="repo-item" key={repo.id}>
                  <div>
                    <strong>
                      {repo.owner}/{repo.name}
                    </strong>
                    <div className={`status-pill status-${repo.status}`}>{STATUS_LABEL[repo.status]}</div>
                    {repo.lastError && <div className="error">{repo.lastError}</div>}
                  </div>
                  <div className="row">
                    <button className="ghost" disabled={busy} onClick={() => wrap(async () => { await api.healthRepo(repo.id); await load(false); })}>
                      검증
                    </button>
                    <button className="ok" disabled={busy} onClick={() => wrap(async () => { await api.runNow(repo.id); await load(false); })}>
                      지금 심기
                    </button>
                    <button className="warn" disabled={busy} onClick={() => wrap(async () => { await api.deleteRepo(repo.id); await load(false); })}>
                      해제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {settings && (
            <section className="tile light span-6 tall">
              <div className="kicker">스케줄 / 메시지</div>
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
                <button
                  className="ok"
                  disabled={busy}
                  onClick={() => wrap(async () => { setSettings(await api.saveSettings(settings)); })}
                >
                  설정 저장
                </button>
              </div>
            </section>
          )}

          <section className="tile mint span-7">
            <div className="kicker">로그</div>
            <div className="logs">
              {logs.length === 0 && <p>아직 심은 기록이 없습니다.</p>}
              {logs.map((log) => (
                <div key={log.id} className={log.ok ? "log-ok" : "log-fail"}>
                  {log.createdAt.slice(0, 16).replace("T", " ")} · {log.message}
                </div>
              ))}
            </div>
          </section>
          <section className="tile dark span-5">
            <div className="sprite ghost" />
            <div className="kicker">TIP</div>
            <h2>기존 기능은 그대로</h2>
            <p>빈 커밋이 기본입니다. 대상 레포 소스는 수정하지 않습니다.</p>
            <button disabled={busy} onClick={() => wrap(async () => { await api.runNow(); await load(false); })}>
              연결된 모든 레포 지금 심기
            </button>
            {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
          </section>
        </div>
      )}
    </div>
  );
}
