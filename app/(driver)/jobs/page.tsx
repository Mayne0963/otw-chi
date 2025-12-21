export default function Jobs() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Available Jobs</h1>
      <div className="bg-white shadow rounded overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">From</th>
              <th className="p-2 text-left">To</th>
              <th className="p-2 text-left">Payout</th>
              <th className="p-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="p-4 text-center">No available jobs. Check back later.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}