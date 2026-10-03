import {WorkspaceQueues} from '@/components/admin-workspace';

export default async function WorkspacePage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return <WorkspaceQueues locale={locale}/>;
}
