export default function DriverProfile() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Driver Profile</h1>
      <div className="bg-white shadow rounded p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block mb-1">Name</label>
            <input id="name" type="text" defaultValue="Jane Smith" className="w-full p-2 border rounded" />
          </div>
          <div>
            <label htmlFor="email" className="block mb-1">Email</label>
            <input id="email" type="email" defaultValue="jane@example.com" className="w-full p-2 border rounded" />
          </div>
          <div>
            <label htmlFor="vehicle" className="block mb-1">Vehicle</label>
            <input id="vehicle" type="text" defaultValue="Toyota Camry" className="w-full p-2 border rounded" />
          </div>
          <div>
            <label htmlFor="license" className="block mb-1">License Number</label>
            <input id="license" type="text" defaultValue="ABC123" className="w-full p-2 border rounded" />
          </div>
        </div>
        <button className="mt-6 bg-blue-500 text-white px-4 py-2 rounded">Save Changes</button>
      </div>
    </div>
  );
}