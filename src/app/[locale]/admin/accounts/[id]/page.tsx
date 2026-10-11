import AdminAccountForm from '@/components/admin-account-form';

export default async function EditAccount({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <AdminAccountForm id={id}/>;
}
