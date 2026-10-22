"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import LanguagePicker from "@/components/LanguagePicker";
import { useT } from "@/lib/i18n";
import { resizeImage } from "@/lib/image";
import { readExif } from "@/lib/exif";
import { sha256 } from "@/lib/hash";
import { OUTCOME_EN } from "@/lib/constants";
import {
  saveOfflineReport,
  getOfflineReports,
  clearOfflineReport,
} from "@/lib/offline";
import { signEvidence } from "@/lib/device";

// Covers both wet and dry land: streets, slums, markets, wetlands, rivers, forests.
// "value" is saved in English for NEMA (must match TYPES in lib/db.js); "key" is the label shown.
const TYPES = [
  { value: "Rubbish or waste", key: "type.rubbish" },
  { value: "Sewage", key: "type.sewage" },
  { value: "Oil or chemicals", key: "type.oil" },
  { value: "Dumping or filling", key: "type.dumping" },
  { value: "Blocked drainage", key: "type.drainage" },
  { value: "Open burning or smoke", key: "type.burning" },
  { value: "Cutting trees or vegetation", key: "type.trees" },
  { value: "Other", key: "type.other" },
];
const MINE_KEY = "ww_mine";
const JSON_HEADERS = { "Content-Type": "application/json" };

const getMine = () => {
  try {
    const items = JSON.parse(localStorage.getItem(MINE_KEY)) || [];
    return items.filter(
      (item) =>
        item && typeof item.id === "string" && typeof item.token === "string",
    );
  } catch {
    return [];
  }
};
const addMine = (report) =>
  localStorage.setItem(
    MINE_KEY,
    JSON.stringify([...getMine(), { id: report.id, token: report.token }]),
  );
const tokenFor = (id) => getMine().find((item) => item.id === id)?.token;

// GPS state is kept as a kind plus data, and turned into words at render time,
// so the text follows the chosen language.
function describeFix(p) {
  const good = Math.round(p.acc) <= 30;
  return { state: good ? "good" : "weak", kind: "fix", fix: p, retry: !good };
}

function gpsText(g, t) {
  switch (g.kind) {
    case "none":
      return { title: t("gps.none"), sub: "" };
    case "denied":
      return { title: t("gps.denied"), sub: t("gps.deniedSub") };
    case "fail":
      return { title: t("gps.fail"), sub: t("gps.failSub") };
    case "photo": {
      const c = `${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}`;
      const when = g.takenAt
        ? t("gps.captured", { d: new Date(g.takenAt).toLocaleString() })
        : t("gps.noTime");
      return { title: t("gps.fromPhoto"), sub: `${c} · ${when}` };
    }
    case "fix": {
      const p = g.fix;
      const a = Math.round(p.acc);
      const c = `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
      const note = p.fromUploadedPhoto ? " · " + t("gps.noPhotoGps") : "";
      return a <= 30
        ? { title: t("gps.good"), sub: `${c} · ${t("gps.acc", { a })}${note}` }
        : { title: t("gps.weak", { a }), sub: `${c} · ${t("gps.weakSub")}${note}` };
    }
    default:
      return { title: t("gps.wait"), sub: t("gps.waitSub") };
  }
}

function agoText(ts, t) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return t("time.now");
  if (s < 3600) return t("time.min", { n: Math.round(s / 60) });
  if (s < 86400) return t("time.hours", { n: Math.round(s / 3600) });
  return new Date(ts).toLocaleDateString();
}

// NEMA saves the outcome in English; show it in the reporter's language when we know it.
function outcomeText(outcome, t) {
  const key = Object.keys(OUTCOME_EN).find((k) => k && OUTCOME_EN[k] === outcome);
  return key ? t("outcome." + key) : outcome;
}

// Turn a refused send into a message in the reporter's language.
function sendErrorText(status, result, t) {
  if (status === 409)
    return String(result.reason || "").includes("elsewhere")
      ? t("notice.duplicateElsewhere")
      : t("notice.duplicate");
  if (status === 429) return t("notice.tooMany");
  return t("notice.sendFail");
}

export default function Reporter() {
  const { t } = useT();
  const [view, setView] = useState("home");
  const [mine, setMine] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [photoMeta, setPhotoMeta] = useState(null);
  const [pos, setPos] = useState(null);
  const [gps, setGps] = useState({ state: "wait", kind: "wait", retry: false });
  const [type, setType] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [current, setCurrent] = useState(null);
  const [phone, setPhone] = useState("");

  const watchId = useRef(null);
  const timer = useRef(null);
  const best = useRef(null);

  /* ---------- GPS ---------- */
  const stopGps = useCallback(() => {
    if (watchId.current != null && "geolocation" in navigator)
      navigator.geolocation.clearWatch(watchId.current);
    clearTimeout(timer.current);
    watchId.current = null;
  }, []);

  const startGps = useCallback(
    (fromUploadedPhoto = false) => {
      stopGps();
      best.current = null;
      setPos(null);
      if (!("geolocation" in navigator)) {
        setGps({ state: "bad", kind: "none", retry: false });
        return;
      }
      setGps({ state: "wait", kind: "wait", retry: false });
      const t0 = Date.now();
      watchId.current = navigator.geolocation.watchPosition(
        (p) => {
          const c = p.coords;
          if (!best.current || c.accuracy < best.current.acc)
            best.current = {
              lat: c.latitude,
              lng: c.longitude,
              acc: c.accuracy,
              fromUploadedPhoto,
              locationSource: "device",
            };
          setPos({ ...best.current });
          setGps(describeFix(best.current));
          if (c.accuracy <= 15 || Date.now() - t0 > 12000) stopGps();
        },
        (err) => {
          stopGps();
          setGps({ state: "bad", kind: err.code === 1 ? "denied" : "fail", retry: true });
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      );
      timer.current = setTimeout(() => {
        stopGps();
        if (!best.current)
          setGps({ state: "bad", kind: "fail", retry: true });
      }, 15000);
    },
    [stopGps],
  );

  useEffect(() => () => stopGps(), [stopGps]);

  /* ---------- Data Fetching ---------- */
  const refreshMine = useCallback(async () => {
    const items = getMine();
    if (!items.length) return setMine([]);
    try {
      const r = await fetch("/api/reports/mine", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ items }),
      });
      if (r.ok) setMine(await r.json());
    } catch {}
  }, []);

  const refreshCurrent = useCallback(async (id) => {
    try {
      const r = await fetch("/api/reports/" + id, {
        cache: "no-store",
        headers: { "x-report-token": tokenFor(id) || "" },
      });
      if (r.ok) setCurrent(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    const tick = () => {
      if (view === "home") refreshMine();
      if (view === "status" && openId) refreshCurrent(openId);
    };
    tick();
    const t = setInterval(tick, 3000);
    return () => clearInterval(t);
  }, [view, openId, refreshMine, refreshCurrent]);

  /* ---------- Actions ---------- */
  async function onPhoto(e, source) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const exif = await readExif(f);
      const hasPhotoLocation =
        Number.isFinite(exif.lat) &&
        Number.isFinite(exif.lng) &&
        exif.lat >= -90 &&
        exif.lat <= 90 &&
        exif.lng >= -180 &&
        exif.lng <= 180;
      const data = await resizeImage(f, 900);
      setPhotoMeta({
        source,
        takenAt: exif.takenAt,
        locationSource: hasPhotoLocation ? "photo" : "device",
      });
      setPhoto(data);
      setType("");
      setNote("");
      setView("review");
      if (hasPhotoLocation) {
        stopGps();
        setPos({
          lat: exif.lat,
          lng: exif.lng,
          acc: null,
          locationSource: "photo",
        });
        setGps({
          state: "good",
          kind: "photo",
          lat: exif.lat,
          lng: exif.lng,
          takenAt: exif.takenAt,
          retry: false,
        });
      } else {
        startGps(source === "upload");
      }
    } catch {
      alert(t("notice.photoRead"));
    }
  }

  async function send() {
    if (!photo || !pos) return;
    stopGps();
    setSending(true);
    const ts = photoMeta?.takenAt || Date.now();

    // 1. Define the exact core evidence
    const coreEvidence = [photo, pos.lat, pos.lng, pos.acc, ts];

    // 2. Hash and cryptographically sign the evidence
    const hash = await sha256(JSON.stringify(coreEvidence));

    let signature = null;
    let publicKey = null;
    try {
      const cryptoData = await signEvidence(coreEvidence);
      signature = cryptoData.signature;
      publicKey = cryptoData.publicKey;
    } catch (e) {
      console.warn(
        "Could not sign evidence. Proceeding with unsigned report.",
        e,
      );
    }

    // 3. Prepare payload with signing data
    const payload = {
      photo,
      lat: pos.lat,
      lng: pos.lng,
      acc: Number.isFinite(pos.acc) ? pos.acc : null,
      ts,
      source: photoMeta?.source || "camera",
      locationSource:
        pos.locationSource || photoMeta?.locationSource || "device",
      timeSource: photoMeta?.takenAt ? "photo" : "submitted",
      type,
      note: note.trim(),
      hash,
      signature,
      publicKey,
    };

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(sendErrorText(res.status, result, t));
        setSending(false);
        return;
      }

      const r = result;
      addMine(r);
      setOpenId(r.id);
      setCurrent(r);
      setView("status");
    } catch (err) {
      console.error("Send failed:", err);
      // Offline fallback
      try {
        await saveOfflineReport(payload);
        alert(t("notice.saved"));
        setView("home");
      } catch {
        alert(t("notice.saveFail"));
      }
    }
    setSending(false);
  }

  async function claim() {
    if (phone.replace(/\D/g, "").length < 9) return;
    const res = await fetch("/api/reports/" + openId, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ claim: true, phone, token: tokenFor(openId) }),
    });
    if (res.ok) setCurrent(await res.json());
  }

  function openReport(id) {
    setOpenId(id);
    setCurrent(mine.find((r) => r.id === id) || null);
    setView("status");
  }

  /* ---------- Background Offline Sync ---------- */
  useEffect(() => {
    async function syncOffline() {
      if (!navigator.onLine) return;
      try {
        const queued = await getOfflineReports();
        let settled = 0;
        let rejected = 0;
        for (const item of queued) {
          // Remove the queueId before sending to the API
          const { queueId, needsUpload, ...payload } = item;

          const res = await fetch("/api/reports", {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            const r = await res.json();
            addMine(r);
            await clearOfflineReport(queueId);
            settled += 1;
            continue;
          }
          // 409 means the server will never take this photo: it is a duplicate.
          // Drop it rather than resending it on every reconnect.
          if (res.status === 409) {
            await clearOfflineReport(queueId);
            settled += 1;
            rejected += 1;
          }
        }
        if (settled > 0) refreshMine();
        if (rejected > 0)
          alert(
            rejected === 1
              ? t("notice.queuedRejected1")
              : t("notice.queuedRejectedN", { n: rejected }),
          );
      } catch (e) {
        console.error("Sync failed, will retry later.");
      }
    }

    window.addEventListener("online", syncOffline);
    syncOffline();
    return () => window.removeEventListener("online", syncOffline);
  }, [refreshMine, t]);

  const viewed = current && current.status === "viewed";
  const gpsWords = gpsText(gps, t);

  return (
    <main className="app">
      <header className="bar">
        <span className="logo">Kuuma Obutonde</span>
        <LanguagePicker />
      </header>

      {view === "home" && (
        <section>
          <div className="notice" role="status">
            {t("notice.screenshot")}
          </div>
          <h1>{t("home.title")}</h1>
          <p className="muted">{t("home.sub")}</p>

          <div className="actions">
            {/* 1. Camera Option */}
            <input
              id="cam"
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => onPhoto(e, "camera")}
            />
            <label
              className="big"
              style={{ flex: 1, padding: "12px" }}
              htmlFor="cam"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  document.getElementById("cam").click();
                }
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{
                  width: 24,
                  height: 24,
                  display: "block",
                  margin: "0 auto 8px",
                }}
              >
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              {t("btn.camera")}
            </label>

            {/* 2. Gallery Upload Option (No capture attribute) */}
            <input
              id="gallery"
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onPhoto(e, "upload")}
            />
            <label
              className="big alt"
              style={{ flex: 1, padding: "12px" }}
              htmlFor="gallery"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  document.getElementById("gallery").click();
                }
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{
                  width: 24,
                  height: 24,
                  display: "block",
                  margin: "0 auto 8px",
                }}
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              {t("btn.upload")}
            </label>
          </div>

          <h2>{t("home.mine")}</h2>
          <ul className="list">
            {mine.length === 0 && <li className="muted">{t("home.none")}</li>}
            {mine.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => openReport(r.id)}>
                  <span className="grow">
                    <span className="t">{r.id}</span>
                    <br />
                    <span className="muted">{agoText(r.ts, t)}</span>
                  </span>
                  {r.status === "viewed" ? (
                    <span className="badge b-ok">{t("badge.viewed")}</span>
                  ) : (
                    <span className="badge b-new">{t("badge.sent")}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view === "review" && (
        <section>
          <button
            type="button"
            className="back"
            onClick={() => {
              stopGps();
              setView("home");
            }}
          >
            {t("form.retake")}
          </button>
          <img
            className="photo"
            alt={t("form.photoAlt")}
            src={photo}
          />
          <div className="loc" data-state={gps.state}>
            <div className="loc-t">{gpsWords.title}</div>
            <div className="loc-s">{gpsWords.sub}</div>
            {gps.retry && (
              <button
                type="button"
                className="ghost"
                onClick={() => startGps(photoMeta?.source === "upload")}
              >
                {t("gps.retry")}
              </button>
            )}
          </div>
          <p className="label">
            {t("form.whatIsIt")} <span className="muted">{t("form.optional")}</span>
          </p>
          <div className="chips">
            {TYPES.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={type === item.value}
                onClick={() => setType(type === item.value ? "" : item.value)}
              >
                {t(item.key)}
              </button>
            ))}
          </div>
          <textarea
            maxLength={200}
            placeholder={t("form.note")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="button"
            className="big"
            disabled={!photo || !pos || sending}
            onClick={send}
          >
            {sending ? t("form.sending") : t("form.send")}
          </button>
        </section>
      )}

      {view === "status" && current && (
        <section>
          <button
            type="button"
            className="back"
            onClick={() => setView("home")}
          >
            {t("back.home")}
          </button>
          <h1>{current.id}</h1>
          <p className="muted">{t("sent.ago", { t: agoText(current.ts, t) })}</p>
          <ol className="steps">
            <li className="done">{t("step.sent")}</li>
            <li className="done">
              {t("step.received")}
              <small>{t("step.thanks")}</small>
            </li>
            {viewed ? (
              <li className="done">
                {t("step.review")}
                <small>
                  {current.outcome
                    ? t("step.next", { o: outcomeText(current.outcome, t) })
                    : t("step.reviewSub")}
                </small>
              </li>
            ) : (
              <li className="now">
                {t("step.waiting")}
                <small>{t("step.safe")}</small>
              </li>
            )}
            <li className={viewed ? "done" : ""}>{t("step.reward")}</li>
          </ol>
          {viewed && (
            <div className="reward">
              <h2>{t("reward.title")}</h2>
              <p>{t("reward.body")}</p>
              {current.claimed ? (
                <p style={{ marginTop: ".7rem" }}>{t("reward.claimed")}</p>
              ) : (
                <div>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder={t("reward.phone")}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <button
                    type="button"
                    className="big"
                    style={{ minHeight: 52 }}
                    onClick={claim}
                  >
                    {t("reward.claim")}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
