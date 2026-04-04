import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import api from "../api/api";
import { CloseIcon, MenuIcon } from "../components/PublicIcons";

const STATUS_COLORS = {
  SUBMITTED: "#6b7280",
  ASSIGNED: "#2563eb",
  IN_PROGRESS: "#c2410c",
  RESOLVED: "#0f766e",
  REJECTED_WRONG_DEPARTMENT: "#b91c1c",
  CLOSED: "#94a3b8",
};

const ALL_DEPARTMENTS = "all";
const SRI_LANKA = [7.8731, 80.7718];
const SECTION_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "departments", label: "Departments" },
  { id: "map", label: "Map" },
  { id: "before-after", label: "Before/After" },
  { id: "recent-activity", label: "Recent Activity" },
];

const numberFormatter = new Intl.NumberFormat("en-LK");
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function makeMarker(status) {
  const color = STATUS_COLORS[status] || "#6b7280";
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:999px;background:${color};border:2px solid #ffffff;box-shadow:0 6px 16px rgba(15,23,42,0.22)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "Pending";
  return dateFormatter.format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "Live now";
  return dateTimeFormatter.format(new Date(value));
}

function formatPercent(value) {
  const numericValue = Number(value || 0);
  return `${Number.isInteger(numericValue) ? numericValue : numericValue.toFixed(1)}%`;
}

function sentenceStatus(value) {
  return value.replace(/_/g, " ").toLowerCase();
}

function titleStatus(value) {
  return sentenceStatus(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function computeResolutionRate(resolved, total) {
  if (!total) return 0;
  return Math.round((Number(resolved) / Number(total)) * 1000) / 10;
}

function buildDepartmentSnapshot(department, recentItems = []) {
  if (!department) return null;

  return {
    name: department.name,
    total_complaints: department.total_complaints,
    resolved_complaints: department.resolved_complaints,
    active_complaints: department.active_complaints,
    resolution_rate:
      department.resolution_rate ??
      computeResolutionRate(department.resolved_complaints, department.total_complaints),
    latest_update_at: recentItems[0]?.resolved_at || null,
  };
}

function departmentParams(departmentId, scope) {
  if (departmentId !== ALL_DEPARTMENTS && scope === "selected") {
    return { department_id: departmentId };
  }

  return undefined;
}

function SectionHeader({ eyebrow, title, description, aside }) {
  return (
    <div className="public-section-heading">
      <div>
        <div className="public-section-eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {aside ? <div className="public-section-aside">{aside}</div> : null}
    </div>
  );
}

function LoadingState({ label }) {
  return <div className="public-panel public-loading-panel">{label}</div>;
}

function EmptyState({ title, description }) {
  return (
    <div className="public-empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function ScopeToggle({ value, onChange, disabled, selectedLabel }) {
  return (
    <div className="public-toggle-group" role="tablist" aria-label="Section scope">
      <button
        type="button"
        className={`public-toggle-button ${value === "all" ? "is-active" : ""}`}
        onClick={() => onChange("all")}
      >
        All departments
      </button>
      <button
        type="button"
        className={`public-toggle-button ${value === "selected" ? "is-active" : ""}`}
        onClick={() => onChange("selected")}
        disabled={disabled}
        title={disabled ? "Select a department to focus this section." : selectedLabel}
      >
        {selectedLabel}
      </button>
    </div>
  );
}

export default function PublicDashboard() {
  const [stats, setStats] = useState(null);
  const [departmentSummary, setDepartmentSummary] = useState([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(ALL_DEPARTMENTS);
  const [selectedDepartmentSummary, setSelectedDepartmentSummary] = useState(null);
  const [mapScope, setMapScope] = useState("all");
  const [comparisonScope, setComparisonScope] = useState("all");
  const [activityScope, setActivityScope] = useState("all");
  const [mapPoints, setMapPoints] = useState([]);
  const [comparisons, setComparisons] = useState([]);
  const [recentResolved, setRecentResolved] = useState([]);
  const [departmentSort, setDepartmentSort] = useState("total");
  const [activeSection, setActiveSection] = useState("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState("");
  const [filterLoading, setFilterLoading] = useState(true);
  const [filterError, setFilterError] = useState("");
  const sectionRefs = useRef({});

  const selectedDepartment =
    departmentSummary.find((department) => department.id === selectedDepartmentId) || null;
  const selectedDepartmentName = selectedDepartment?.name || "Selected department";
  const effectiveSnapshot =
    selectedDepartmentId === ALL_DEPARTMENTS
      ? stats
        ? {
            name: "All departments",
            total_complaints: stats.total_complaints,
            resolved_complaints: stats.resolved_complaints,
            active_complaints: stats.in_progress_complaints,
            resolution_rate: computeResolutionRate(
              stats.resolved_complaints,
              stats.total_complaints
            ),
            latest_update_at: recentResolved[0]?.resolved_at || null,
          }
        : null
      : selectedDepartmentSummary || buildDepartmentSnapshot(selectedDepartment, recentResolved);

  const departmentRows = [...departmentSummary].sort((left, right) => {
    if (departmentSort === "resolution") {
      const rateDiff = Number(right.resolution_rate || 0) - Number(left.resolution_rate || 0);
      if (rateDiff !== 0) return rateDiff;
      return Number(right.total_complaints || 0) - Number(left.total_complaints || 0);
    }

    const totalDiff = Number(right.total_complaints || 0) - Number(left.total_complaints || 0);
    if (totalDiff !== 0) return totalDiff;
    return Number(right.resolution_rate || 0) - Number(left.resolution_rate || 0);
  });

  const syncActiveSection = useEffectEvent((entries) => {
    const visibleSections = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => right.intersectionRatio - left.intersectionRatio);

    if (visibleSections[0]?.target?.id) {
      setActiveSection(visibleSections[0].target.id);
    }
  });

  useEffect(() => {
    let cancelled = false;

    Promise.all([api.get("/public/stats"), api.get("/public/department-summary")])
      .then(([statsRes, departmentSummaryRes]) => {
        if (cancelled) return;

        setStats(statsRes.data.data);
        setDepartmentSummary(departmentSummaryRes.data.data || []);
      })
      .catch(() => {
        if (!cancelled) {
          setBootstrapError(
            "The national overview could not be loaded right now. Please try again shortly."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBootstrapLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const mapRequest = api.get("/public/complaints/map", {
      params: departmentParams(selectedDepartmentId, mapScope),
    });
    const comparisonRequest = api.get("/public/comparisons", {
      params: departmentParams(selectedDepartmentId, comparisonScope),
    });
    const activityRequest = api.get("/public/recent-resolved", {
      params: departmentParams(selectedDepartmentId, activityScope),
    });

    Promise.allSettled([mapRequest, comparisonRequest, activityRequest])
      .then(([mapResult, comparisonResult, activityResult]) => {
        if (cancelled) return;

        const mapFailed = mapResult.status === "rejected";
        const comparisonsFailed = comparisonResult.status === "rejected";
        const activityFailed = activityResult.status === "rejected";

        const activityItems = activityFailed ? [] : activityResult.value.data.data || [];

        setMapPoints(mapFailed ? [] : mapResult.value.data.data || []);
        setComparisons(comparisonsFailed ? [] : comparisonResult.value.data.data || []);
        setRecentResolved(activityItems);
        setSelectedDepartmentSummary(
          selectedDepartmentId === ALL_DEPARTMENTS
            ? null
            : buildDepartmentSnapshot(selectedDepartment, activityItems)
        );

        if (mapFailed || comparisonsFailed || activityFailed) {
          setFilterError(
            "Public activity panels could not be refreshed for the current department filter."
          );
        } else {
          setFilterError("");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setFilterLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDepartmentId, mapScope, comparisonScope, activityScope, selectedDepartment]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        syncActiveSection(entries);
      },
      {
        rootMargin: "-18% 0px -55% 0px",
        threshold: [0.2, 0.35, 0.55],
      }
    );

    SECTION_ITEMS.forEach(({ id }) => {
      const section = sectionRefs.current[id];
      if (section) {
        observer.observe(section);
      }
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    if (mobileNavOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  function handleNavClick(event, sectionId) {
    event.preventDefault();

    const section = sectionRefs.current[sectionId];
    if (!section) return;

    section.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${sectionId}`);
    setActiveSection(sectionId);
    setMobileNavOpen(false);
  }

  function handleDepartmentChange(nextDepartmentId) {
    setFilterLoading(true);
    setFilterError("");

    startTransition(() => {
      setSelectedDepartmentId(nextDepartmentId);

      const nextScope = nextDepartmentId === ALL_DEPARTMENTS ? "all" : "selected";
      setMapScope(nextScope);
      setComparisonScope(nextScope);
      setActivityScope(nextScope);
    });
  }

  function handleScopeChange(scopeSetter, nextScope) {
    setFilterLoading(true);
    setFilterError("");
    scopeSetter(nextScope);
  }

  return (
    <div className="public-dashboard">
      <header className="public-topbar-shell">
        <div className="public-topbar">
          <div className="public-brand">
            <div className="public-brand-mark">C</div>
            <div>
              <div className="public-brand-name">CivicLink</div>
              <div className="public-brand-subtitle">Public Transparency Portal</div>
            </div>
          </div>

          <button
            type="button"
            className="public-menu-toggle"
            aria-label={mobileNavOpen ? "Close transparency menu" : "Open transparency menu"}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((value) => !value)}
          >
            {mobileNavOpen ? <CloseIcon size={18} /> : <MenuIcon size={18} />}
          </button>

          <nav className={`public-anchor-nav ${mobileNavOpen ? "is-open" : ""}`} aria-label="Page sections">
            {SECTION_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={activeSection === item.id ? "is-active" : ""}
                onClick={(event) => handleNavClick(event, item.id)}
              >
                {item.label}
              </a>
            ))}

            <button
              type="button"
              className="public-cta-button public-cta-button-mobile"
              onClick={() => {
                window.location.href = "/";
                setMobileNavOpen(false);
              }}
            >
              Submit a Complaint
            </button>
          </nav>

          <button
            type="button"
            className="public-cta-button"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Submit a Complaint
          </button>
        </div>
      </header>

      <main className="public-main">
        {bootstrapError ? <div className="alert alert-error">{bootstrapError}</div> : null}
        {filterError ? <div className="alert alert-error">{filterError}</div> : null}

        <section
          id="overview"
          className="public-section"
          ref={(node) => {
            sectionRefs.current.overview = node;
          }}
        >
          <div className="public-hero">
            <div className="public-hero-copy">
              <div className="public-kicker">Government of Sri Lanka</div>
              <h1>Citizen complaints, tracked in public view.</h1>
              <p>
                A one-page transparency briefing on how complaints move across departments, where
                they cluster, and what has already been resolved on the ground.
              </p>

              <div className="public-hero-notes">
                <span>National totals stay visible</span>
                <span>Department filters update live</span>
                <span>Recent activity stays public-facing</span>
              </div>
            </div>

            <div className="public-snapshot-card">
              <div className="public-snapshot-eyebrow">Selected department snapshot</div>
              {bootstrapLoading || (selectedDepartmentId !== ALL_DEPARTMENTS && filterLoading) ? (
                <div className="public-snapshot-loading">Refreshing department snapshot...</div>
              ) : effectiveSnapshot ? (
                <>
                  <div className="public-snapshot-title">
                    {selectedDepartmentId === ALL_DEPARTMENTS
                      ? "All departments selected"
                      : effectiveSnapshot.name}
                  </div>
                  <div className="public-snapshot-subtitle">
                    {selectedDepartmentId === ALL_DEPARTMENTS
                      ? "Choose a department to narrow the sections below while keeping the national story in view."
                      : `Focused public view for ${effectiveSnapshot.name}.`}
                  </div>

                  <div className="public-snapshot-metrics">
                    <div>
                      <span>Total</span>
                      <strong>{formatNumber(effectiveSnapshot.total_complaints)}</strong>
                    </div>
                    <div>
                      <span>Resolved</span>
                      <strong>{formatNumber(effectiveSnapshot.resolved_complaints)}</strong>
                    </div>
                    <div>
                      <span>Active</span>
                      <strong>{formatNumber(effectiveSnapshot.active_complaints)}</strong>
                    </div>
                    <div>
                      <span>Resolution rate</span>
                      <strong>{formatPercent(effectiveSnapshot.resolution_rate)}</strong>
                    </div>
                  </div>

                  <div className="public-snapshot-footer">
                    Latest public update: {formatDateTime(effectiveSnapshot.latest_update_at)}
                  </div>
                </>
              ) : (
                <EmptyState
                  title="No department data yet"
                  description="This department does not have public complaint summary data right now."
                />
              )}
            </div>
          </div>

          {bootstrapLoading ? (
            <LoadingState label="Loading national overview..." />
          ) : stats ? (
            <div className="public-kpi-band">
              <article className="public-kpi-card">
                <span>Total complaints</span>
                <strong>{formatNumber(stats.total_complaints)}</strong>
                <p>National complaints recorded in the public system.</p>
              </article>
              <article className="public-kpi-card">
                <span>Resolved</span>
                <strong>{formatNumber(stats.resolved_complaints)}</strong>
                <p>Cases marked complete and visible in the public record.</p>
              </article>
              <article className="public-kpi-card">
                <span>Active</span>
                <strong>{formatNumber(stats.in_progress_complaints)}</strong>
                <p>Complaints currently assigned or in progress.</p>
              </article>
              <article className="public-kpi-card">
                <span>Resolution rate</span>
                <strong>
                  {formatPercent(
                    computeResolutionRate(stats.resolved_complaints, stats.total_complaints)
                  )}
                </strong>
                <p>Share of total complaints already resolved.</p>
              </article>
            </div>
          ) : (
            <EmptyState
              title="National totals unavailable"
              description="Public statistics are not available right now."
            />
          )}
        </section>

        <section
          id="departments"
          className="public-section"
          ref={(node) => {
            sectionRefs.current.departments = node;
          }}
        >
          <SectionHeader
            eyebrow="Departments"
            title="Ranked department performance"
            description="Compare departments by workload or resolution rate, then select one to update the focused public story."
            aside={
              <div className="public-sort-controls">
                <button
                  type="button"
                  className={departmentSort === "total" ? "is-active" : ""}
                  onClick={() => setDepartmentSort("total")}
                >
                  Sort by total complaints
                </button>
                <button
                  type="button"
                  className={departmentSort === "resolution" ? "is-active" : ""}
                  onClick={() => setDepartmentSort("resolution")}
                >
                  Sort by resolution rate
                </button>
              </div>
            }
          />

          {bootstrapLoading ? (
            <LoadingState label="Loading department comparison..." />
          ) : departmentRows.length === 0 ? (
            <EmptyState
              title="No department data"
              description="Public department summaries will appear here once complaint data is available."
            />
          ) : (
            <div className="public-panel public-department-table">
              <div className="public-department-table-head">
                <span>Rank</span>
                <span>Department</span>
                <span>Total</span>
                <span>Resolved</span>
                <span>Active</span>
                <span>Rate</span>
              </div>

              {departmentRows.map((department, index) => (
                <button
                  key={department.id}
                  type="button"
                  className={`public-department-row ${
                    selectedDepartmentId === department.id ? "is-selected" : ""
                  }`}
                  onClick={() => handleDepartmentChange(department.id)}
                >
                  <span className="public-department-rank">#{index + 1}</span>
                  <span className="public-department-name">
                    <strong>{department.name}</strong>
                    <small>
                      {selectedDepartmentId === department.id
                        ? "Selected department"
                        : "Select to focus downstream sections"}
                    </small>
                  </span>
                  <span>{formatNumber(department.total_complaints)}</span>
                  <span>{formatNumber(department.resolved_complaints)}</span>
                  <span>{formatNumber(department.active_complaints)}</span>
                  <span>{formatPercent(department.resolution_rate)}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section
          id="map"
          className="public-section"
          ref={(node) => {
            sectionRefs.current.map = node;
          }}
        >
          <SectionHeader
            eyebrow="Map"
            title="Where complaints are being reported"
            description="The public map keeps the national picture visible while allowing a focused department lens when one is selected."
            aside={
              <ScopeToggle
                value={mapScope}
                onChange={(nextScope) => handleScopeChange(setMapScope, nextScope)}
                disabled={selectedDepartmentId === ALL_DEPARTMENTS}
                selectedLabel={
                  selectedDepartmentId === ALL_DEPARTMENTS
                    ? "Selected department"
                    : selectedDepartmentName
                }
              />
            }
          />

          <div className="public-panel public-map-panel">
            <div className="public-panel-meta">
              <span>
                {mapScope === "selected" && selectedDepartmentId !== ALL_DEPARTMENTS
                  ? `${selectedDepartmentName} map view`
                  : "All departments map view"}
              </span>
              <strong>{formatNumber(mapPoints.length)} geo-tagged complaints</strong>
            </div>

            <div className="public-status-legend">
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <span key={status}>
                  <i style={{ backgroundColor: color }} />
                  {titleStatus(status)}
                </span>
              ))}
            </div>

            <MapContainer center={SRI_LANKA} zoom={8} className="public-map-canvas">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="© OpenStreetMap contributors"
              />
              {mapPoints.map((point) => (
                <Marker
                  key={point.id}
                  position={[point.latitude, point.longitude]}
                  icon={makeMarker(point.status)}
                >
                  <Popup>
                    <div className="public-map-popup">
                      <strong>{point.title}</strong>
                      <span>{point.department_name}</span>
                      <span>{point.issue_type_name}</span>
                      <span>Status: {titleStatus(point.status)}</span>
                      <span>
                        Resolved: {point.resolved_at ? formatDate(point.resolved_at) : "Pending"}
                      </span>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {filterLoading ? (
              <div className="public-panel-note">Refreshing map markers...</div>
            ) : mapPoints.length === 0 ? (
              <div className="public-panel-note">
                {selectedDepartmentId !== ALL_DEPARTMENTS && mapScope === "selected"
                  ? `No geo-tagged complaints are available for ${selectedDepartmentName}.`
                  : "No geo-tagged complaints are available yet."}
              </div>
            ) : null}
          </div>
        </section>

        <section
          id="before-after"
          className="public-section"
          ref={(node) => {
            sectionRefs.current["before-after"] = node;
          }}
        >
          <SectionHeader
            eyebrow="Before / After"
            title="Resolved cases with visible change"
            description="Real comparison cards show what citizens reported and what changed after action was taken."
            aside={
              <ScopeToggle
                value={comparisonScope}
                onChange={(nextScope) => handleScopeChange(setComparisonScope, nextScope)}
                disabled={selectedDepartmentId === ALL_DEPARTMENTS}
                selectedLabel={
                  selectedDepartmentId === ALL_DEPARTMENTS
                    ? "Selected department"
                    : selectedDepartmentName
                }
              />
            }
          />

          {filterLoading ? (
            <LoadingState label="Refreshing comparison gallery..." />
          ) : comparisons.length === 0 ? (
            <EmptyState
              title="No before and after comparisons"
              description={
                selectedDepartmentId !== ALL_DEPARTMENTS && comparisonScope === "selected"
                  ? `Resolved complaints with both before and after images are not available yet for ${selectedDepartmentName}.`
                  : "Resolved complaints with both before and after images are not available yet."
              }
            />
          ) : (
            <div className="public-comparison-grid">
              {comparisons.map((comparison) => (
                <article key={comparison.id} className="public-comparison-card">
                  <div className="public-comparison-header">
                    <div>
                      <div className="public-comparison-title">{comparison.title}</div>
                      <div className="public-comparison-meta">
                        <span>{comparison.department_name}</span>
                        <span>{comparison.complaint_type}</span>
                        <span>Resolved {formatDate(comparison.resolved_at)}</span>
                      </div>
                    </div>
                    <span className="badge badge-resolved">Resolved case</span>
                  </div>

                  <div className="public-comparison-images">
                    <div className="public-comparison-image-panel">
                      <div className="comparison-label comparison-label-before">Before</div>
                      <img
                        src={comparison.before_attachment.file_url}
                        alt={`${comparison.title} before`}
                        className="comparison-image"
                        loading="lazy"
                      />
                    </div>
                    <div className="public-comparison-image-panel">
                      <div className="comparison-label comparison-label-after">After</div>
                      <img
                        src={comparison.after_attachment.file_url}
                        alt={`${comparison.title} after`}
                        className="comparison-image"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section
          id="recent-activity"
          className="public-section"
          ref={(node) => {
            sectionRefs.current["recent-activity"] = node;
          }}
        >
          <SectionHeader
            eyebrow="Recent Activity"
            title="Latest public resolutions"
            description="This stream defaults to resolved complaints and moves the selected department to the front when a focused view is active."
            aside={
              <ScopeToggle
                value={activityScope}
                onChange={(nextScope) => handleScopeChange(setActivityScope, nextScope)}
                disabled={selectedDepartmentId === ALL_DEPARTMENTS}
                selectedLabel={
                  selectedDepartmentId === ALL_DEPARTMENTS
                    ? "Selected department"
                    : selectedDepartmentName
                }
              />
            }
          />

          {filterLoading ? (
            <LoadingState label="Refreshing recent activity..." />
          ) : recentResolved.length === 0 ? (
            <EmptyState
              title="No recent resolved complaints"
              description={
                selectedDepartmentId !== ALL_DEPARTMENTS && activityScope === "selected"
                  ? `There are no recent resolved complaints for ${selectedDepartmentName}.`
                  : "There are no recent resolved complaints available right now."
              }
            />
          ) : (
            <div className="public-panel public-activity-timeline">
              {recentResolved.map((item, index) => (
                <article key={item.id} className="public-activity-item">
                  <div className="public-activity-marker">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="public-activity-content">
                    <div className="public-activity-date">{formatDate(item.resolved_at)}</div>
                    <h3>{item.title}</h3>
                    <div className="public-activity-meta">
                      <span>{item.department_name}</span>
                      <span>{item.complaint_type}</span>
                      <span>{titleStatus(item.status)}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
