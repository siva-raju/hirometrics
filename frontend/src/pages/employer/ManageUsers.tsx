export default function ManageUsers() {
  return (
    <div className="max-w-4xl fade-in">
      <div className="mb-6">
        <h1 className="page-title">Manage Users</h1>
        <p className="page-subtitle">Add and manage internal hiring managers</p>
      </div>
      <div className="card empty-state py-16">
        <div className="empty-state-icon text-4xl">⚙️</div>
        <p className="text-sm font-semibold text-gray-500 mt-3">Coming Soon</p>
        <p className="text-xs text-gray-400 mt-1 max-w-sm text-center">
          This section will allow administrators to create and manage internal hiring managers.
          Each manager will be able to manage their own job folders while administrators
          maintain visibility across all folders and users.
        </p>
      </div>
    </div>
  );
}
