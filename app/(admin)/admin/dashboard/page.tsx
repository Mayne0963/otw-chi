export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="card p-4 bg-white shadow rounded">
          <h2 className="text-xl font-semibold">Total Users</h2>
          <p className="text-3xl">1,234</p>
        </div>
        <div className="card p-4 bg-white shadow rounded">
          <h2 className="text-xl font-semibold">Active Drivers</h2>
          <p className="text-3xl">56</p>
        </div>
        <div className="card p-4 bg-white shadow rounded">
          <h2 className="text-xl font-semibold">Pending Requests</h2>
          <p className="text-3xl">23</p>
        </div>
        <div className="card p-4 bg-white shadow rounded">
          <h2 className="text-xl font-semibold">Total Revenue</h2>
          <p className="text-3xl">$12,345</p>
        </div>
      </div>
      <h2 className="text-2xl font-bold mb-4">Recent Activity</h2>
      <div className="bg-white shadow rounded p-4">
        <p>No recent activity</p>
      </div>
    </div>
  );
}