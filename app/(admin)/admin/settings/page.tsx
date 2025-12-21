export default function Settings() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">System Settings</h1>
      <div className="bg-white shadow rounded p-6">
        <form className="space-y-4">
          <div>
            <label htmlFor="site-name" className="block mb-1">Site Name</label>
            <input id="site-name" type="text" defaultValue="OTW" className="w-full p-2 border rounded" />
          </div>
          <div>
            <label htmlFor="currency" className="block mb-1">Default Currency</label>
            <select id="currency" className="w-full p-2 border rounded">
              <option>USD</option>
              <option>EUR</option>
            </select>
          </div>
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Save Settings</button>
        </form>
      </div>
    </div>
  );
}