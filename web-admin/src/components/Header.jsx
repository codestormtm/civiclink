export default function Header() {
  const name = localStorage.getItem("name");
  const role = localStorage.getItem("role");
  const department = localStorage.getItem("department");

  const logout = () => {
    localStorage.clear();
    window.location.reload();
  };

  return (
    <div className="topbar">
      <div className="topbar-title">
        CivicLink {department ? `| ${department}` : ""}
      </div>

      <div className="topbar-right">
        <span className="topbar-role">{role}</span>
        <span className="topbar-name">{name}</span>
        <button className="topbar-logout" onClick={logout}>Logout</button>
      </div>
    </div>
  );
}
