export default function Earnings() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Earnings</h1>
      <div className="bg-white shadow rounded p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Total Earnings</h2>
        <p className="text-3xl">$1,234.56</p>
      </div>
      <h2 className="text-2xl font-bold mb-4">Earnings History</h2>
      <div className="bg-white shadow rounded overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Job ID</th>
              <th className="p-2 text-left">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={3} className="p-4 text-center">No earnings history</td>
            </tr>
          </tbody>
        </table>
      </div>
      <button className="mt-6 bg-blue-500 text-white px-4 py-2 rounded">Request Payout</button>
    </div>
  );
}