export default function Membership() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Membership</h1>
      <div className="bg-white shadow rounded p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Current Plan: Premium</h2>
        <p>Next billing: January 21, 2026</p>
        <p>Status: Active</p>
      </div>
      <h2 className="text-2xl font-bold mb-4">Available Plans</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="plan p-4 bg-white shadow rounded">
          <h3 className="text-lg font-semibold">Basic</h3>
          <p>$0/month</p>
        </div>
        <div className="plan p-4 bg-white shadow rounded border-2 border-blue-500">
          <h3 className="text-lg font-semibold">Premium</h3>
          <p>$9.99/month</p>
        </div>
        <div className="plan p-4 bg-white shadow rounded">
          <h3 className="text-lg font-semibold">VIP</h3>
          <p>$19.99/month</p>
        </div>
      </div>
      <button className="mt-6 bg-blue-500 text-white px-4 py-2 rounded">Upgrade Plan</button>
    </div>
  );
}