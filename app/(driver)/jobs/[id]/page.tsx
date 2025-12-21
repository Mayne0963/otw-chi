export default function JobDetails({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Job #{params.id}</h1>
      <div className="bg-white shadow rounded p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h2 className="font-semibold">From</h2>
            <p>123 Main St</p>
          </div>
          <div>
            <h2 className="font-semibold">To</h2>
            <p>456 Elm St</p>
          </div>
          <div>
            <h2 className="font-semibold">Customer</h2>
            <p>John Doe</p>
          </div>
          <div>
            <h2 className="font-semibold">Payout</h2>
            <p>$25.00</p>
          </div>
        </div>
        <div className="mt-6">
          <button className="bg-green-500 text-white px-4 py-2 rounded mr-2">Accept Job</button>
          <button className="bg-red-500 text-white px-4 py-2 rounded">Decline</button>
        </div>
      </div>
    </div>
  );
}