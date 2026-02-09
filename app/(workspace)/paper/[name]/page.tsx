import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{
    name: string
  }>
}

export default async function PaperNameRedirectPage({ params }: Props) {
  const { name } = await params
  redirect(`/learning/article/${name}`)
}
