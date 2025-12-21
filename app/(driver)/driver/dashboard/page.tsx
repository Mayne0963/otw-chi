export default function DriverDashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Driver Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card p-4 bg-white shadow rounded">
          <h2 className="text-xl font-semibold">Available Jobs</h2>
          <p className="text-3xl">5</p>
        </div>
        <div className="card p-4 bg-white shadow rounded">
          <h2 className="text-xl font-semibold">Today&apos;s Earnings</h2>
          <p className="text-3xl">$120.50</p>
        </div>
        <div className="card p-4 bg-white shadow rounded">
          <h2 className="text-xl font-semibold">Rating</h2>
          <p className="text-3xl">4.8 ★</p>
        </div>
      </div>
      <h2 className="text-2xl font-bold mb-4">Recent Jobs</h2>
      <div className="bg-white shadow rounded overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={3} className="p-4 text-center">No recent jobs</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}