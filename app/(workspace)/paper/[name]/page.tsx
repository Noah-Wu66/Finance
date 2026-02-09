import { redirect } from 'next/navigation'

interface Props {
  params: {
    name: string
  }
}

export default function PaperNameRedirectPage({ params }: Props) {
  redirect(`/learning/article/${params.name}`)
}
