export default function CitiesZones() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Cities & Zones Management</h1>
      <div className="bg-white shadow rounded overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 text-left">City</th>
              <th className="p-2 text-left">Zones</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className="p-4 text-center">No cities configured</td>
            </tr>
          </tbody>
        </table>
      </div>
      <button className="mt-6 bg-blue-500 text-white px-4 py-2 rounded">Add City</button>
    </div>
  );
}