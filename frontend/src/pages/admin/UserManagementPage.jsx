import { useState } from 'react'
import PageShell from '../../components/admin/AdminPageShell'
import UserManagementPanel from '../../components/admin/UserManagementPanel'

export default function UserManagementPage() {
  const [search, setSearch] = useState('')

  return (
    <PageShell
      title="User management"
      description="Residents, collectors, and admins"
      showBell
      showSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by name or email"
    >
      <UserManagementPanel search={search} />
    </PageShell>
  )
}
