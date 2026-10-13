import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { AdminLoginForm } from '@/components/admin/admin-login-form'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin login | Afterstem' }

export default async function AdminLoginPage() {
  const user = await getSessionUser()
  if (user) {
    // Lawyers have no dashboard — avoid /admin → /admin/candidates bounce.
    redirect(user.role === 'ATTORNEY' ? '/lawyer/candidates' : '/admin')
  }

  return (
    <div className="admin-app flex min-h-screen items-center justify-center bg-[#0C2340] px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0F766E]">Afterstem</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#0C2340]">Admin portal</h1>
        <p className="mt-2 text-sm text-[#5B6B7C]">Staff access only. All sessions are recorded.</p>
        <div className="mt-6">
          <Suspense>
            <AdminLoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
