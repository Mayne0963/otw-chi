export default function CustomerDashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Customer Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card p-4 bg-white shadow rounded">
          <h2 className="text-xl font-semibold">Active Requests</h2>
          <p className="text-3xl">2</p>
        </div>
        <div className="card p-4 bg-white shadow rounded">
          <h2 className="text-xl font-semibold">Wallet Balance</h2>
          <p className="text-3xl">$45.67</p>
        </div>
        <div className="card p-4 bg-white shadow rounded">
          <h2 className="text-xl font-semibold">Membership Status</h2>
          <p className="text-3xl">Premium</p>
        </div>
      </div>
      <h2 className="text-2xl font-bold mb-4">Recent Requests</h2>
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
              <td colSpan={3} className="p-4 text-center">No recent requests</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}