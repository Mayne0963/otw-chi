export default function Users() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Users Management</h1>
      <div className="bg-white shadow rounded overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="p-4 text-center">No users found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}