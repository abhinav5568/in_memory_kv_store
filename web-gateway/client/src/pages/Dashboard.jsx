import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchMe, logout } from "../api/auth";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchMe()
      .then((res) => setUser(res.user))
      .catch(() => navigate("/login"));
  }, [navigate]);

  async function handleLogout() {
    await logout().catch(() => {});
    navigate("/login");
  }

  if (!user) return null;

  return (
    <div className="max-w-lg mx-auto mt-16 p-6 bg-white rounded-xl shadow">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          Log out
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-1">Email</p>
      <p className="mb-4">{user.email}</p>
      <p className="text-sm text-gray-600 mb-1">Engine UUID</p>
      <div className="font-mono text-sm bg-gray-900 text-green-400 p-3 rounded break-all">
        {user.uuid}
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Use this as the <code>userId</code> passed to your app's{" "}
        <code>KVClient</code> constructor.
      </p>
      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
      {/* Live cache stats / admin visibility placeholder — wire up once
          the gateway exposes a read-only TCP command for it. */}
    </div>
  );
}
