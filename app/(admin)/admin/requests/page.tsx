export default function AdminRequests() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Requests Management</h1>
      <div className="bg-white shadow rounded overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Customer</th>
              <th className="p-2 text-left">Driver</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="p-4 text-center">No requests</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}