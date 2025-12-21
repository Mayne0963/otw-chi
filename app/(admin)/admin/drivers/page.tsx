export default function Drivers() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Drivers Management</h1>
      <div className="bg-white shadow rounded overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Vehicle</th>
              <th className="p-2 text-left">Rating</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="p-4 text-center">No drivers found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}