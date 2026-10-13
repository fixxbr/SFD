import { ClientPortal } from '@/components/client/client-portal'

export const metadata = { title: 'Your Afterstem case' }

export default async function ClientTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <div className="admin-app min-h-screen bg-[#F3F5F7] px-4 py-10 text-[#0C2340]">
      <ClientPortal token={token} />
    </div>
  )
}
