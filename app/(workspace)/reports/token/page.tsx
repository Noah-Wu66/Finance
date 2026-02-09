import { redirect } from 'next/navigation'

export default function TokenStatisticsRedirectPage() {
  redirect('/settings/usage')
}
